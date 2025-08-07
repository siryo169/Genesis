"""
SQLAlchemy model for tracking pipeline runs and their statuses.
"""
from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, DateTime, Integer, create_engine, Text, Float, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import json

Base = declarative_base()

class PipelineRun(Base):
    """
    Represents a single pipeline run for processing a CSV file.
    
    Fields:
        id: Unique identifier for the run
        filename: Name of the CSV file being processed
        status: Current status of the run (enqueued/pending/running/ok/error)
        insertion_date: When the file was first inserted into the pipeline
        start_time: When processing began
        end_time: When processing completed
        duration_ms: Total processing time in milliseconds
        log_file_path: Path to the log file for this run
        gemini_header_mapping: JSON string of the Gemini header mapping result for each run
        gemini_sample_rows: JSON string of the Gemini sample rows for each run
        original_file_size: Size of the original file
        original_row_count: Number of rows in the original file
        final_file_size: Size of the final file
        final_row_count: Number of rows in the final file
        valid_row_percentage: Percentage of valid rows
        error_message: Error message for the run
        gemini_input_tokens: Number of input tokens for Gemini
        gemini_output_tokens: Number of output tokens for Gemini
        gemini_total_tokens: Total number of tokens for Gemini
        ai_model: Name of the AI model used for processing
        invalid_lines: Number of invalid lines
        estimated_cost: Estimated cost of the run
        invalid_line_numbers: JSON string of invalid line numbers
        priority: Priority of the run (1-5) default is 3
    """
    __tablename__ = 'pipeline_runs'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    status = Column(String, nullable=False, default='enqueued')
    insertion_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    log_file_path = Column(String, nullable=True)
    original_file_size = Column(Integer, nullable=True)
    original_row_count = Column(Integer, nullable=True)
    final_file_size = Column(Integer, nullable=True)
    final_row_count = Column(Integer, nullable=True)
    valid_row_percentage = Column(Integer, nullable=True)
    invalid_lines = Column(Integer, nullable=True)
    invalid_line_numbers = Column(Text, nullable=True)
    gemini_input_tokens = Column(Integer, nullable=True)
    gemini_output_tokens = Column(Integer, nullable=True)
    gemini_total_tokens = Column(Integer, nullable=True)
    ai_model = Column(String, nullable=False, default='Gemini 2.5 Flash')
    estimated_cost = Column(Float, nullable=True)
    gemini_header_mapping = Column(Text, nullable=True)
    gemini_sample_rows = Column(Text, nullable=True)
    error_message = Column(String, nullable=True)
    file_encoding = Column(String, nullable=True)
    stage_stats = Column(Text, nullable=True)
    priority = Column(Integer, nullable=False, default=3)

    # Indexes for optimization
    __table_args__ = (
        Index('idx_queue_processing', 'status', 'priority', 'insertion_date'),
        Index('idx_filename_lookup', 'filename'),
        Index('idx_status_lookup', 'status'),
    )

    def to_dict(self):
        """Convert the model to a dictionary for API responses."""
        def iso_utc(dt):
            if not dt:
                return None
            if dt.tzinfo is None:
                # Assume naive datetimes are UTC (as per DB)
                return dt.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
            return dt.isoformat().replace('+00:00', 'Z')
        result = {
            'id': str(self.id),
            'filename': self.filename,
            'status': self.status,
            'insertion_date': iso_utc(self.insertion_date),
            'start_time': iso_utc(self.start_time),
            'end_time': iso_utc(self.end_time),
            'duration_ms': self.duration_ms,
            'log_file_path': self.log_file_path,
            'original_file_size': self.original_file_size,
            'original_row_count': self.original_row_count,
            'final_file_size': self.final_file_size,
            'final_row_count': self.final_row_count,
            'valid_row_percentage': self.valid_row_percentage,
            'invalid_lines': self.invalid_lines,
            'invalid_line_numbers': json.loads(self.invalid_line_numbers) if self.invalid_line_numbers else [],
            'gemini_input_tokens': self.gemini_input_tokens,
            'gemini_output_tokens': self.gemini_output_tokens,
            'gemini_total_tokens': self.gemini_total_tokens,
            'ai_model': self.ai_model,
            'estimated_cost': self.estimated_cost,
            'gemini_header_mapping': json.loads(self.gemini_header_mapping) if self.gemini_header_mapping else None,
            'gemini_sample_rows': None,
            'error_message': self.error_message,
            'file_encoding': self.file_encoding,
            'stage_stats': json.loads(self.stage_stats) if self.stage_stats else {},
            'priority': self.priority,
        }
        if self.gemini_sample_rows:
            try:
                result['gemini_sample_rows'] = json.loads(self.gemini_sample_rows)
                # Ensure it's a list of strings
                if result['gemini_sample_rows'] and isinstance(result['gemini_sample_rows'][0], list):
                    result['gemini_sample_rows'] = [','.join(row) for row in result['gemini_sample_rows']]
            except Exception:
                result['gemini_sample_rows'] = None
        else:
            result['gemini_sample_rows'] = None
        return result

# Database setup function
def init_db(db_url='sqlite:///pipeline.db'):
    """Initialize the database and create tables."""
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}, # Required for SQLite
        pool_size=20,  # Increase pool size
        max_overflow=30,  # Increase max overflow
        pool_timeout=60,  # Increase timeout
        pool_recycle=3600,  # Recycle connections every hour
        pool_pre_ping=True  # Validate connections before use
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal 