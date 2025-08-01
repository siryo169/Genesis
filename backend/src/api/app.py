"""
FastAPI application serving the CSV pipeline API endpoints.
"""
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
import logging
logging.getLogger("multipart.multipart").setLevel(logging.WARNING)
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Request, Depends
from fastapi.responses import FileResponse
from ..models.pipeline_run import init_db, PipelineRun
from ..pipeline.watcher import FileWatcher
from ..pipeline.orchestrator import PipelineOrchestrator
from ..config.settings import settings
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import threading
import time
from datetime import datetime, timedelta
import json
from typing import Any, Dict, List, Union
from sqlalchemy.orm import Session

def sanitize_for_json(data: Any) -> Any:
    """
    Recursively remove NaN and Inf values from a data structure.
    """
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_for_json(v) for v in data]
    if isinstance(data, float) and (data != data or data == float('inf') or data == float('-inf')):
        return None
    return data

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="CSV Pipeline API",
    description="API for CSV processing pipeline",
    version="1.0.0"
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database and get session
SessionLocal = init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize pipeline components
orchestrator = PipelineOrchestrator(SessionLocal)
watcher = FileWatcher(orchestrator)

clients = set()

def queue_processor(orchestrator):
    """Process files from the queue with improved error handling and connection management."""
    while True:
        db_session = SessionLocal()
        try:
            # Only process one file at a time (simple queue)
            run = db_session.query(PipelineRun).filter_by(status='enqueued').order_by(PipelineRun.insertion_date.asc()).first()
            if run:
                try:
                    logger.info(f"Processing file from queue: {run.filename}")
                    orchestrator.process_file(Path(settings.INPUT_DIR) / run.filename, db_session)
                except Exception as e:
                    logger.error(f"Error processing file {run.filename} from queue: {e}", exc_info=True)
            else:
                # No files to process, sleep longer to reduce DB queries
                time.sleep(5)
                continue
            
            time.sleep(1)  # Brief pause between files
        except Exception as e:
            logger.error(f"Queue processor error: {e}", exc_info=True)
            time.sleep(10)  # Longer sleep on errors
        finally:
            try:
                db_session.close()
            except Exception as close_error:
                logger.error(f"Error closing DB session in queue processor: {close_error}")

@app.on_event("startup")
async def startup_event():
    """Start the file watcher and queue processor on app startup."""
    try:
        settings.validate_paths()
        # Start file watcher in a background thread
        threading.Thread(target=watcher.start, daemon=True).start()
        # Start queue processor in a background thread
        threading.Thread(target=queue_processor, args=(orchestrator,), daemon=True).start()
        logger.info("File watcher and queue processor started in background threads.")
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Stop the file watcher on app shutdown."""
    try:
        watcher.stop()
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

@app.get("/runs", response_model=List[dict])
async def list_runs(db: Session = Depends(get_db)):
    """
    List all pipeline runs with their statuses and durations.
    """
    try:
        # Only return the latest run per filename
        runs = db.query(PipelineRun).order_by(PipelineRun.filename, PipelineRun.insertion_date.desc()).all()
        latest_by_filename = {}
        for run in runs:
            if run.filename not in latest_by_filename:
                latest_by_filename[run.filename] = run
        return [run.to_dict() for run in latest_by_filename.values()]
    except Exception as e:
        logger.error(f"Error listing runs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/runs/{run_id}")
async def get_run(run_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information for a single pipeline run.
    """
    try:
        run = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
            
        # Get log file contents if available
        log_contents = ""
        if run.log_file_path and Path(run.log_file_path).exists():
            try:
                with open(run.log_file_path, 'r', encoding='utf-8', errors='replace') as f:
                    log_contents = f.read()
            except Exception as ex:
                logger.warning(f"Could not read log file {run.log_file_path}: {ex}")
                log_contents = f"[Error reading log file: {ex}]"
                
        result = run.to_dict()
        result['log_contents'] = log_contents
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/runs/{run_id}/download")
async def download_csv(run_id: str, db: Session = Depends(get_db)):
    """
    Download the normalized CSV file for a completed run.
    """
    try:
        run = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
            
        if run.status != 'ok':
            raise HTTPException(
                status_code=400,
                detail="Cannot download file - processing not complete or failed"
            )
            
        output_file = Path(settings.OUTPUT_DIR) / f"normalized_{run.filename}"
        if not output_file.exists():
            raise HTTPException(status_code=404, detail="Output file not found")
            
        return FileResponse(
            str(output_file),
            media_type='text/csv',
            filename=f"normalized_{run.filename}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading CSV for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pipeline/status")
async def get_pipeline_status(db: Session = Depends(get_db)):
    """
    Get pipeline status in the format expected by the frontend.
    """
    try:
        # Only return the latest run per filename
        runs = db.query(PipelineRun).order_by(PipelineRun.filename, PipelineRun.insertion_date.desc()).all()
        latest_by_filename = {}
        for run in runs:
            if run.filename not in latest_by_filename:
                latest_by_filename[run.filename] = run
        pipeline_entries = []
        for run in latest_by_filename.values():
            entry = convert_run_to_frontend_format(run)
            pipeline_entries.append(entry)
        
        # Sanitize data before sending
        sanitized_entries = sanitize_for_json(pipeline_entries)
        return sanitized_entries
    except Exception as e:
        logger.error(f"Error getting pipeline status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pipeline/stats")
async def get_pipeline_stats(db: Session = Depends(get_db)):
    """
    Get pipeline statistics.
    """
    try:
        # Get counts by status
        total = db.query(PipelineRun).count()
        running = db.query(PipelineRun).filter(PipelineRun.status == 'running').count()
        completed = db.query(PipelineRun.status == 'ok').count()
        failed = db.query(PipelineRun.status == 'error').count()
        
        return {
            "total": total,
            "processing": running,
            "completed": completed,
            "failed": failed
        }
        
    except Exception as e:
        logger.error(f"Error getting pipeline stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pipeline/metrics")
async def get_pipeline_metrics(range: str = "auto", bucket: str = "auto", db: Session = Depends(get_db)):
    """
    Aggregate token consumption and estimated cost per time bucket (hour/day/week), cumulative, for all pipeline runs.
    Query params:
      - range: '24h', '7d', '30d', or 'auto'
      - bucket: 'auto', 'hour', 'day', 'week'
    """
    # 1. Determine time range
    now = datetime.utcnow()
    if range == "24h":
        start_time = now - timedelta(hours=24)
        bucket_size = "hour"
    elif range == "7d":
        start_time = now - timedelta(days=7)
        bucket_size = "day"
    elif range == "30d":
        start_time = now - timedelta(days=30)
        bucket_size = "day"
    else:
        # auto: use earliest record to now
        first_run = db.query(PipelineRun).order_by(PipelineRun.insertion_date.asc()).first()
        if first_run and first_run.insertion_date:
            start_time = first_run.insertion_date
        else:
            start_time = now - timedelta(days=7)
        delta = now - start_time
        if delta.days < 2:
            bucket_size = "hour"
        elif delta.days < 60:
            bucket_size = "day"
        else:
            bucket_size = "week"
    if bucket != "auto":
        bucket_size = bucket

    # 2. Query all runs in range
    runs = db.query(PipelineRun).filter(PipelineRun.insertion_date >= start_time).order_by(PipelineRun.insertion_date.asc()).all()
    if not runs:
        return {
            "buckets": [],
            "token_consumption": {"input": [], "output": [], "total": []},
            "cost": [],
            "total_files": []
        }

    # 3. Build buckets
    def bucket_start(dt):
        if bucket_size == "15min":
            minute = (dt.minute // 15) * 15
            return dt.replace(minute=minute, second=0, microsecond=0)
        elif bucket_size == "30min":
            minute = (dt.minute // 30) * 30
            return dt.replace(minute=minute, second=0, microsecond=0)
        elif bucket_size == "hour":
            return dt.replace(minute=0, second=0, microsecond=0)
        elif bucket_size == "day":
            return dt.replace(hour=0, minute=0, second=0, microsecond=0)
        elif bucket_size == "week":
            # ISO week start (Monday)
            return (dt - timedelta(days=dt.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            return dt

    # Find all bucket start times
    bucket_map = {}
    for run in runs:
        b = bucket_start(run.insertion_date)
        if b not in bucket_map:
            bucket_map[b] = []
        bucket_map[b].append(run)
    sorted_buckets = sorted(bucket_map.keys())

    # 4. Aggregate per-bucket (delta) values
    input_tokens = []
    output_tokens = []
    total_tokens = []
    cost = []
    total_files = []
    for b in sorted_buckets:
        runs_in_bucket = bucket_map[b]
        bucket_input = sum(run.gemini_input_tokens or 0 for run in runs_in_bucket)
        bucket_output = sum(run.gemini_output_tokens or 0 for run in runs_in_bucket)
        bucket_total = bucket_input + bucket_output
        bucket_cost = sum(run.estimated_cost or 0 for run in runs_in_bucket)
        bucket_files = len(runs_in_bucket)
        input_tokens.append(bucket_input)
        output_tokens.append(bucket_output)
        total_tokens.append(bucket_total)
        cost.append(round(bucket_cost, 6))
        total_files.append(bucket_files)

    return {
        "buckets": [b.isoformat() + "Z" for b in sorted_buckets],
        "token_consumption": {
            "input": input_tokens,
            "output": output_tokens,
            "total": total_tokens
        },
        "cost": cost,
        "total_files": total_files
    }

def convert_run_to_frontend_format(run: PipelineRun) -> Dict[str, Any]:
    """
    Convert a backend PipelineRun to the frontend CsvProcessingEntry format.
    """
    entry = {
        'id': str(run.id),
        'filename': run.filename,
        'insertion_date': run.insertion_date.isoformat() if run.insertion_date else None,
        'start_time': run.start_time.isoformat() if run.start_time else None,
        'end_time': run.end_time.isoformat() if run.end_time else None,
        'duration_ms': run.duration_ms,
        'status': run.status,
        'log_file_path': run.log_file_path,
        'extracted_fields': [],
        'extracted_fields_more': False,
        'original_file_size': run.original_file_size,
        'original_row_count': run.original_row_count,
        'final_file_size': run.final_file_size,
        'final_row_count': run.final_row_count,
        'valid_row_percentage': run.valid_row_percentage,
        'invalid_lines': run.invalid_lines,
        'invalid_line_numbers': run.invalid_line_numbers if isinstance(run.invalid_line_numbers, list) else json.loads(run.invalid_line_numbers) if run.invalid_line_numbers else [],
        'ai_model': run.ai_model,
        'gemini_input_tokens': run.gemini_input_tokens,
        'gemini_output_tokens': run.gemini_output_tokens,
        'gemini_total_tokens': run.gemini_total_tokens,
        'estimated_cost': run.estimated_cost,
        'stage_stats': run.stage_stats and json.loads(run.stage_stats) or {},
    }
    # Extract up to 4 headers from gemini_header_mapping, prioritizing important ones
    header_mapping = None
    if hasattr(run, 'gemini_header_mapping') and run.gemini_header_mapping:
        try:
            mapping = run.gemini_header_mapping
            if isinstance(mapping, str):
                mapping = json.loads(mapping)
            header_mapping = mapping.get('header_mapping', {})
        except Exception as ex:
            header_mapping = None
    elif hasattr(run, 'to_dict') and callable(run.to_dict):
        d = run.to_dict()
        if d.get('gemini_header_mapping') and isinstance(d['gemini_header_mapping'], dict):
            header_mapping = d['gemini_header_mapping'].get('header_mapping', {})
    if header_mapping:
        headers = list(header_mapping.values())
        entry['extracted_fields'] = headers
        entry['extracted_fields_more'] = len(headers) > 4
    # Add Gemini sample rows (first 5 rows) if available
    sample_rows = None
    if hasattr(run, 'gemini_sample_rows') and run.gemini_sample_rows:
        try:
            rows = run.gemini_sample_rows
            if isinstance(rows, str):
                rows = json.loads(rows)
            sample_rows = rows
        except Exception:
            sample_rows = None
    elif hasattr(run, 'to_dict') and callable(run.to_dict):
        d = run.to_dict()
        if d.get('gemini_sample_rows') and isinstance(d['gemini_sample_rows'], list):
            sample_rows = d['gemini_sample_rows']
    entry['gemini_sample_rows'] = sample_rows
    return entry

def create_processing_step(status: str, start_time=None, end_time=None, error_message=None, value=None) -> Dict[str, Any]:
    """Create a processing step in the frontend format."""
    step = {'status': status}
    if start_time:
        # Convert to local time timestamp (milliseconds)
        step['startTime'] = int(start_time.timestamp() * 1000)
    if end_time:
        # Convert to local time timestamp (milliseconds)
        step['endTime'] = int(end_time.timestamp() * 1000)
    if error_message:
        step['errorMessage'] = error_message
    if value is not None:
        step['value'] = value
    return step

def map_backend_status_to_frontend(backend_status: str) -> str:
    """Map backend status to frontend status."""
    mapping = {
        'enqueued': 'enqueued',
        'running': 'running',
        'ok': 'ok',
        'error': 'error',
    }
    return mapping.get(backend_status, 'enqueued')

@app.websocket("/ws/pipeline")
async def pipeline_ws(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(clients)}")
    
    try:
        while True:
            # Create a fresh database session for each query to ensure latest data
            db_session = SessionLocal()
            try:
                # Fetch the latest pipeline runs from the DB (latest per filename)
                runs = db_session.query(PipelineRun).order_by(PipelineRun.filename, PipelineRun.insertion_date.desc()).all()
                latest_by_filename = {}
                for run in runs:
                    if run.filename not in latest_by_filename:
                        latest_by_filename[run.filename] = run
                data = [convert_run_to_frontend_format(run) for run in latest_by_filename.values()]
                
                # Sanitize data before sending
                sanitized_data = sanitize_for_json(data)
                await websocket.send_json(sanitized_data)
            except Exception as db_error:
                logger.error(f"Database error in WebSocket: {db_error}")
                # Don't break the loop for DB errors, just wait and retry
            finally:
                # Always close the session after each query
                db_session.close()
            
            await asyncio.sleep(5)  # Reduced frequency to 5 seconds to reduce DB load
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        # Ensure websocket is removed from clients
        clients.discard(websocket)
        logger.info(f"WebSocket client removed. Total clients: {len(clients)}")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file and save it to the inbound directory using a temporary extension, then rename.
    """
    try:
        inbound_dir = Path(settings.INPUT_DIR)
        inbound_dir.mkdir(parents=True, exist_ok=True)
        temp_path = inbound_dir / (file.filename + ".uploading")
        final_path = inbound_dir / file.filename
        logger.info(f"Detected start of upload: {file.filename}.uploading")
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        temp_path.rename(final_path)
        return {"filename": file.filename, "status": "uploaded"}
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/runs/{run_id}/retry_gemini_query")
async def retry_gemini_query(run_id: str):
    #TODO: Implement retry_gemini_query
    raise HTTPException(status_code=500, detail="Not implemented")