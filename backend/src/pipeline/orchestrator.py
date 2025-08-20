"""
Pipeline Orchestrator module for coordinating tabular file processing stages (CSV, XLS, XLSX).
"""
import logging
from pathlib import Path
from datetime import datetime, timezone
import shutil
from uuid import UUID
import json
import re
from enum import Enum

from ..models.pipeline_run import PipelineRun
from ..config.settings import settings
from . import classifier, sampler, gemini_query, normalizer

logger = logging.getLogger(__name__)

class Stage(Enum):
    CLASSIFICATION = 'classification'
    SAMPLING = 'sampling'
    GEMINI_QUERY = 'gemini_query'
    NORMALIZATION = 'normalization'

class Status(Enum):
    ENQUEUED = 'enqueued'
    RUNNING = 'running'
    OK = 'ok'
    ERROR = 'error'
    SKIPPED = 'skipped'

def ensure_aware(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

class PipelineOrchestrator:
    def __init__(self, db_session_factory):
        """
        Initialize the pipeline orchestrator.
        
        Args:
            db_session_factory: A function that returns a new SQLAlchemy database session
        """
        self.db_session_factory = db_session_factory
        
    def process_file(self, file_path: str | Path, db_session=None) -> UUID:
        """
        Process a single tabular file through all pipeline stages.
        """
        close_session = False
        if db_session is None:
            db_session = self.db_session_factory()
            close_session = True

        file_path = Path(file_path)
        filename = file_path.name

        # Use existing enqueued pipeline run if it exists
        run = db_session.query(PipelineRun).filter_by(filename=filename, status=Status.ENQUEUED.value).first()
        if not run:
            run = PipelineRun(filename=filename, status=Status.ENQUEUED.value)
            db_session.add(run)
            db_session.commit()

        try:
            log_file = Path(settings.LOGS_DIR) / f"{run.id}_{filename}.log"
            file_handler = self._setup_logging(log_file)
            run.log_file_path = str(log_file)
            
            # Set status to RUNNING at the start of actual processing
            run.status = Status.RUNNING.value
            db_session.commit()

            self._update_stage(run, Stage.CLASSIFICATION, Status.RUNNING, db_session=db_session)
            class_result = classifier.classify_file(file_path)
            run.file_encoding = class_result['encoding'].lower() if class_result['encoding'] else None
            run.original_file_size = class_result['file_size']
            run.original_row_count = class_result['row_count']
            automatic = class_result.get('known_per', 0) >= 90
            if not class_result['is_tabular']:
                self._update_stage(
                    run, Stage.CLASSIFICATION, Status.ERROR,
                    error_message=class_result['error_message'] or 'File is not tabular',
                    warning='; '.join(class_result.get('warnings', [])) if class_result.get('warnings') else None,
                    db_session=db_session
                )
                raise ValueError(class_result['error_message'] or 'File is not tabular')
            self._update_stage(
                run, Stage.CLASSIFICATION, Status.OK,
                warning='; '.join(class_result.get('warnings', [])) if class_result.get('warnings') else None,
                db_session=db_session
            )
            if automatic:
                logger.info(f"Automatic classification for {filename} with known percentage: {class_result['known_per']}%")
                # Create JSON with header mapping and normalization info
                json_data = {"header_mapping": {}, "normalization_map": {}}
                standardized_headers = class_result.get('standardized_headers', [])
                normalize_flags = class_result.get('normalize_flags', [])
                known_columns_count = class_result.get('known_columns_count', 0)
                total_columns_count = class_result.get('total_columns_count', 0)
                separators_list = class_result.get('separators_list', [])
                
                # Load known headers to get descriptions
                import json as json_lib
                known_headers_path = Path(__file__).parent / "known_headers.json"
                try:
                    with open(known_headers_path, 'r', encoding='utf-8') as f:
                        known_headers = json_lib.load(f)
                except Exception as e:
                    logger.warning(f"Could not load known_headers.json: {e}")
                    known_headers = {}
                
                # Build the header mapping with normalization info and descriptions
                json_data["header_metadata"] = {}
                for i, header in enumerate(standardized_headers):
                    should_normalize = normalize_flags[i] if i < len(normalize_flags) else False
                    json_data["header_mapping"][f"{i}"] = header
                    json_data["normalization_map"][header] = should_normalize
                    
                    # Add metadata for all headers (known and unknown)
                    if header in known_headers:
                        description = known_headers[header].get("description", "")
                        json_data["header_metadata"][header] = {
                            "is_known": True,
                            "description": description
                        }
                    else:
                        json_data["header_metadata"][header] = {
                            "is_known": False,
                            "description": ""
                        }
                
                json_data["matched_columns_count"] = known_columns_count
                json_data["input_has_header"] = True
                json_data["total_columns"] = total_columns_count
                json_data["column_separators"] = separators_list


                logger.info(f"Complete classification data for {filename}: {json.dumps(json_data, indent=2)}")
                self._update_stage(run, Stage.SAMPLING, Status.SKIPPED, db_session=db_session)
                self._update_stage(run, Stage.GEMINI_QUERY, Status.SKIPPED, db_session=db_session)
                db_session.commit()
                mapping,input_tokens, output_tokens, total_tokens = json_data,0,0,0
                run.gemini_header_mapping = json.dumps(mapping)
                run.gemini_input_tokens = input_tokens
                run.gemini_output_tokens = output_tokens
                run.gemini_total_tokens = total_tokens
                run.estimated_cost = (
                    (run.gemini_input_tokens or 0) * 0.30 / 1_000_000 +
                    (run.gemini_output_tokens or 0) * 2.50 / 1_000_000
                )
            else:
                self._update_stage(run, Stage.SAMPLING, Status.RUNNING, db_session=db_session)
                sample_data, error_msg, sample_warnings = sampler.extract_sample(file_path, encoding=run.file_encoding)
                if error_msg:
                    self._update_stage(run, Stage.SAMPLING, Status.ERROR, error_message=error_msg, warning='; '.join(sample_warnings) if sample_warnings else None, db_session=db_session)
                    raise ValueError(error_msg)
                # Store the sampled rows for frontend access immediately after sampling
                try:
                    run.gemini_sample_rows = json.dumps(sample_data)
                except Exception as e:
                    error_msg = f"Failed to serialize gemini_sample_rows: {str(e)}"
                    self._update_stage(run, Stage.SAMPLING, Status.ERROR, error_message=error_msg, warning='; '.join(sample_warnings) if sample_warnings else None, db_session=db_session)
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                db_session.commit()
                self._update_stage(run, Stage.SAMPLING, Status.OK, warning='; '.join(sample_warnings) if sample_warnings else None, db_session=db_session)

                self._update_stage(run, Stage.GEMINI_QUERY, Status.RUNNING, db_session=db_session)
                mapping, error_msg, gemini_warnings, input_tokens, output_tokens, total_tokens = gemini_query.run_gemini(sample_data)
                if error_msg:
                    self._update_stage(run, Stage.GEMINI_QUERY, Status.ERROR, error_message=error_msg, warning='; '.join(gemini_warnings) if gemini_warnings else None, db_session=db_session)
                    raise ValueError(error_msg)
                run.gemini_header_mapping = json.dumps(mapping)
                run.gemini_input_tokens = input_tokens
                run.gemini_output_tokens = output_tokens
                run.gemini_total_tokens = total_tokens
                run.estimated_cost = (
                    (run.gemini_input_tokens or 0) * 0.30 / 1_000_000 +
                    (run.gemini_output_tokens or 0) * 2.50 / 1_000_000
                )
                self._update_stage(run, Stage.GEMINI_QUERY, Status.OK, warning='; '.join(gemini_warnings) if gemini_warnings else None, db_session=db_session)

            self._update_stage(run, Stage.NORMALIZATION, Status.RUNNING, db_session=db_session)
            norm = normalizer.Normalizer(mapping)
            output_base = Path(filename).stem
            output_path = Path(settings.OUTPUT_DIR) / f"normalized_{output_base}.csv"
            be_output_path = Path(settings.BE_OUTPUT_DIR) / f"be_normalized_{output_base}.json"
            success, error_msg, norm_warnings, output_written_rows, input_processed_rows, norm_invalid_lines, output_file_size, be_output_file_size = norm.normalize_file(file_path, output_path,be_output_path, encoding=run.file_encoding)
            if not success:
                self._update_stage(run, Stage.NORMALIZATION, Status.ERROR, error_message=error_msg, warning='; '.join(norm_warnings) if norm_warnings else None, db_session=db_session)
                raise ValueError(error_msg)
            run.final_file_size = output_file_size
            run.final_row_count = output_written_rows
            if run.original_row_count and run.final_row_count is not None and run.original_row_count > 0:
                run.valid_row_percentage = round((run.final_row_count / run.original_row_count) * 100, 2)
            self._update_stage(run, Stage.NORMALIZATION, Status.OK, warning='; '.join(norm_warnings) if norm_warnings else None, db_session=db_session)
            if norm_invalid_lines:
                # Always treat as a list of line numbers
                serializable_invalid_lines = []
                for item in sorted(norm_invalid_lines):
                    if isinstance(item, datetime):
                        serializable_invalid_lines.append(item.isoformat())
                    else:
                        serializable_invalid_lines.append(item)
                run.invalid_line_numbers = json.dumps(serializable_invalid_lines)

            # Check if all stages are OK or SKIPPED to mark as finished
            stage_stats = json.loads(run.stage_stats) if run.stage_stats else {}
            all_ok = all(
                stage_stats.get(stage.value, {}).get('status') in [Status.OK.value, Status.SKIPPED.value]
                for stage in [Stage.CLASSIFICATION, Stage.SAMPLING, Stage.GEMINI_QUERY, Stage.NORMALIZATION]
            )
            if all_ok:
                run.status = Status.OK.value
                run.end_time = datetime.now(timezone.utc)
                start = ensure_aware(run.start_time)
                end = ensure_aware(run.end_time)
                run.duration_ms = int((end - start).total_seconds() * 1000)
                run.error_message = "success"
                db_session.commit()
                
                # Calculate detailed processing statistics
                original_input_lines = run.original_row_count or 0
                original_non_empty_lines = input_processed_rows
                invalid_lines_count = len(norm_invalid_lines) if norm_invalid_lines else 0
                normalized_output_lines = output_written_rows
                
                logger.info(f"Successfully processed {filename}")
                logger.info(f"Processing statistics for {filename}:")
                logger.info(f"  - Original input lines: {original_input_lines}")
                logger.info(f"  - Original non-empty lines processed: {original_non_empty_lines}")
                logger.info(f"  - Invalid lines (blank/malformed): {invalid_lines_count}")
                logger.info(f"  - Lines written to normalized output: {normalized_output_lines}")
                logger.info(f"  - Valid row percentage: {run.valid_row_percentage}%")
                logger.info(f"  - Processing duration: {run.duration_ms}ms")
            else:
                logger.error(f"Normalization not completed for {filename}, not marking as ok.")
            return run.id

        except Exception as e:
            db_session.rollback()
            logger.error(f"Pipeline failed for {filename}: {str(e)}")
            run.status = Status.ERROR.value
            run.end_time = datetime.now(timezone.utc)
            start = ensure_aware(run.start_time)
            end = ensure_aware(run.end_time)
            run.duration_ms = int((end - start).total_seconds() * 1000)
            # Try to update the current stage to error in stage_stats
            stage_stats = json.loads(run.stage_stats) if run.stage_stats else {}
            last_stage = None
            for stage in [Stage.NORMALIZATION, Stage.GEMINI_QUERY, Stage.SAMPLING, Stage.CLASSIFICATION]:
                if stage.value in stage_stats and stage_stats[stage.value].get('status') == Status.RUNNING.value:
                    last_stage = stage.value
                    break
            if last_stage:
                self._update_stage(run, last_stage, Status.ERROR, error_message=str(e), db_session=db_session)
                run.error_message = f"{last_stage}: {str(e)}"
                if last_stage == Stage.CLASSIFICATION.value:
                    not_tabular_path = Path(settings.NOT_TABULAR_DIR) / filename
                    shutil.move(str(file_path), str(not_tabular_path))
            else:
                run.error_message = f"Unknown: {str(e)}"
            db_session.commit()
            if run.status == Status.ERROR.value:
                logger.error(f"Pipeline processing for {filename} ended with ERRORS (run ID: {run.id}). Check the log file for details.")
            return run.id
        finally:
            # Remove and close the file handler to prevent log mixing between files
            try:
                root_logger = logging.getLogger()
                if 'file_handler' in locals() and file_handler in root_logger.handlers:
                    root_logger.removeHandler(file_handler)
                    file_handler.close()
            except Exception:
                pass
            if close_session:
                db_session.close()
        
    def _update_stage(self, run: PipelineRun, stage: Stage | str, status: Status | str, warning: str = None, error_message: str = None, db_session=None):
        """Update the current stage and its status, including per-stage timestamps and stats."""
        close_session = False
        if db_session is None:
            db_session = self.db_session_factory()
            close_session = True

        stage_value = stage.value if isinstance(stage, Enum) else stage
        status_value = status.value if isinstance(status, Enum) else status
        now = datetime.now(timezone.utc)
        # Load or initialize stage_stats
        if not run.stage_stats:
            stage_stats = {}
        else:
            try:
                stage_stats = json.loads(run.stage_stats)
            except Exception:
                stage_stats = {}
        # Ensure entry for this stage
        if stage_value not in stage_stats:
            stage_stats[stage_value] = {
                'start_time': None,
                'end_time': None,
                'status': None,
                'warnings': [],
                'error_message': None
            }
        entry = stage_stats[stage_value]
        # Set start/end times and status
        if status_value == Status.RUNNING.value and not entry['start_time']:
            entry['start_time'] = now.isoformat()
        if status_value in (Status.OK.value, Status.ERROR.value):
            entry['end_time'] = now.isoformat()
        entry['status'] = status_value
        # Add warning if provided
        if warning:
            if 'warnings' not in entry or not isinstance(entry['warnings'], list):
                entry['warnings'] = []
            entry['warnings'].append(warning)
        # Set error_message if provided
        if error_message:
            entry['error_message'] = error_message
        # Save back to run
        stage_stats[stage_value] = entry
        run.stage_stats = json.dumps(stage_stats)
        # Also update legacy fields for compatibility
        # Set start_time if this is the first running stage
        if status_value == Status.RUNNING.value and not run.start_time:
            run.start_time = now
        logger.info(f"Pipeline stage {stage_value}: {status_value}")
        db_session.commit()
        if close_session:
            db_session.close()
        
    def _setup_logging(self, log_file: Path):
        """Setup file logging for this pipeline run. Ensure logs go to both file and stdout, and both outputs are identical."""
        # Remove all existing handlers to avoid duplicates or conflicts
        root_logger = logging.getLogger()
        for handler in list(root_logger.handlers):
            root_logger.removeHandler(handler)
        
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        
        # File handler
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        root_logger.addHandler(file_handler)
        
        # Stream handler (console) with UTF-8 encoding
        import sys
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        stream_handler.setLevel(logging.DEBUG)
        # Force UTF-8 encoding for the stream handler
        if hasattr(stream_handler.stream, 'reconfigure'):
            try:
                stream_handler.stream.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass
        root_logger.addHandler(stream_handler)
        
        # Set root logger level
        root_logger.setLevel(logging.DEBUG)
        
        return file_handler 