"""
File Watcher module for monitoring the input directory for new CSV files.
"""
import time
from pathlib import Path
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from .orchestrator import PipelineOrchestrator
from ..config.settings import settings
from ..models.pipeline_run import PipelineRun, init_db
from .orchestrator import Status
import tarfile
import gzip
try:
    import py7zr
except ImportError:
    py7zr = None
try:
    import rarfile
except ImportError:
    rarfile = None

logger = logging.getLogger(__name__)

def extract_archive_recursive(file_path, extract_dir, depth=0, max_depth=3, logger=None):
    """
    Recursively extract supported archives up to max_depth. Returns a list of extracted files.
    """
    supported_archives = {'.zip', '.7z', '.tar', '.gz', '.tgz', '.tar.gz', '.rar'}
    extracted_files = []
    if depth > max_depth:
        if logger:
            logger.warning(f"Max extraction depth {max_depth} reached for {file_path}")
        return []
    ext = file_path.suffix.lower()
    # Handle .tar.gz and .tgz
    if file_path.name.endswith('.tar.gz') or file_path.name.endswith('.tgz'):
        ext = '.tar.gz'
    if ext not in supported_archives:
        return [file_path]
    try:
        if ext == '.zip':
            import zipfile
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
                for name in zip_ref.namelist():
                    ef = extract_dir / name
                    if ef.is_file():
                        extracted_files.append(ef)
        elif ext == '.7z' and py7zr:
            with py7zr.SevenZipFile(file_path, mode='r') as z:
                z.extractall(path=extract_dir)
                for ef in extract_dir.rglob('*'):
                    if ef.is_file():
                        extracted_files.append(ef)
        elif ext == '.rar' and rarfile:
            with rarfile.RarFile(file_path) as rf:
                rf.extractall(extract_dir)
                for name in rf.namelist():
                    ef = extract_dir / name
                    if ef.is_file():
                        extracted_files.append(ef)
        elif ext in {'.tar', '.tar.gz'}:
            with tarfile.open(file_path, 'r:*') as tar:
                tar.extractall(extract_dir)
                for member in tar.getmembers():
                    ef = extract_dir / member.name
                    if ef.is_file():
                        extracted_files.append(ef)
        elif ext == '.gz' and not file_path.name.endswith('.tar.gz'):
            # .gz (single file)
            out_path = extract_dir / file_path.stem
            with gzip.open(file_path, 'rb') as f_in, open(out_path, 'wb') as f_out:
                f_out.write(f_in.read())
            extracted_files.append(out_path)
        else:
            # Not supported or not installed
            if logger:
                logger.warning(f"Archive type {ext} not supported or required library not installed.")
            return []
    except Exception as e:
        if logger:
            logger.error(f"Error extracting {file_path}: {e}")
        return []
    # Recursively extract any archives found inside
    all_files = []
    for ef in extracted_files:
        if ef.suffix.lower() in supported_archives or ef.name.endswith('.tar.gz') or ef.name.endswith('.tgz'):
            sub_extract_dir = ef.parent / f"extracted_{ef.stem}"
            sub_extract_dir.mkdir(exist_ok=True)
            all_files.extend(extract_archive_recursive(ef, sub_extract_dir, depth+1, max_depth, logger))
        else:
            all_files.append(ef)
    return all_files

class CSVHandler(FileSystemEventHandler):
    def __init__(self, orchestrator: PipelineOrchestrator):
        """
        Initialize CSV file handler.
        
        Args:
            orchestrator: Pipeline orchestrator instance
        """
        self.orchestrator = orchestrator
        self.processing = set()  # Track files being processed
        
    def on_created(self, event):
        """Handle file creation events."""
        if event.is_directory:
            return
        file_path = Path(event.src_path)
        ext = file_path.suffix.lower()
        supported_exts = {'.csv', '.tsv', '.psv', '.dat', '.data', '.txt', '.xls', '.xlsx', '.ods'}
        archive_exts = {'.zip', '.7z', '.tar', '.gz', '.tgz', '.tar.gz', '.rar'}
        # Ignore files with .uploading extension
        if file_path.name.endswith('.uploading'):
            return
        if ext in supported_exts:
            # ENQUEUE: Create PipelineRun if not exists
            db = self.orchestrator.db_session_factory()
            try:
                existing = db.query(PipelineRun).filter_by(filename=file_path.name).first()
                if not existing:
                    run = PipelineRun(filename=file_path.name, status=Status.ENQUEUED.value)
                    db.add(run)
                    db.commit()
                logger.info(f"Enqueued file: {file_path}")
            finally:
                db.close()
            return
        # Handle archives (recursive, multi-format)
        if ext in archive_exts:
            logger.info(f"Archive detected: {file_path}. Extracting...")
            extract_dir = file_path.parent / f"extracted_{file_path.stem}"
            extract_dir.mkdir(exist_ok=True)
            extracted_files = extract_archive_recursive(file_path, extract_dir, logger=logger)
            for ef in extracted_files:
                ef_ext = ef.suffix.lower()
                if ef_ext in archive_exts or ef.name.endswith('.tar.gz') or ef.name.endswith('.tgz'):
                    logger.info(f"Skipped nested archive: {ef}")
                    continue
                inbound_dir = Path(settings.INPUT_DIR).resolve()
                ef_abs = ef.resolve()
                dest_path = inbound_dir / ef_abs.name
                if dest_path.exists():
                    logger.warning(f"File {dest_path} already exists in inbound dir. Skipping move of {ef_abs}.")
                    continue
                try:
                    ef_abs.replace(dest_path)
                    logger.info(f"Moved extracted file {ef_abs} to inbound dir as {dest_path}")
                except Exception as e:
                    logger.error(f"Failed to move {ef_abs} to {dest_path}: {e}")
                    continue
                db = self.orchestrator.db_session_factory()
                try:
                    existing = db.query(PipelineRun).filter_by(filename=dest_path.name).first()
                    if not existing:
                        run = PipelineRun(filename=dest_path.name, status=Status.ENQUEUED.value)
                        db.add(run)
                        db.commit()
                    logger.info(f"Enqueued extracted file: {dest_path.name}")
                finally:
                    db.close()
            # Clean up extracted subdirectory
            try:
                import shutil
                shutil.rmtree(extract_dir)
                logger.info(f"Cleaned up extracted directory {extract_dir}")
            except Exception as e:
                logger.warning(f"Failed to clean up extracted directory {extract_dir}: {e}")
            logger.info(f"Finished extracting and enqueuing files from archive: {file_path}")
            return
        # Unsupported extension
        logger.error(f"Unsupported file extension for {file_path}. Only .csv, .txt, .zip, .7z, .tar, .gz, .tgz, .tar.gz, and .rar are supported.")

    def on_moved(self, event):
        """Handle file moved/renamed events (e.g., .uploading -> .csv, .zip, .7z, etc.)."""
        if event.is_directory:
            return
        src_path = Path(event.src_path)
        dest_path = Path(event.dest_path)
        if src_path.name.endswith('.uploading') and not dest_path.name.endswith('.uploading'):
            logger.info(f"Upload finished: {dest_path.name}")
        ext = dest_path.suffix.lower()
        supported_exts = {'.csv', '.tsv', '.psv', '.dat', '.data', '.txt', '.xls', '.xlsx', '.ods'}
        archive_exts = {'.zip', '.7z', '.tar', '.gz', '.tgz', '.tar.gz', '.rar'}
        # Ignore files with .uploading extension
        if dest_path.name.endswith('.uploading'):
            return
        # Process tabular files
        if ext in supported_exts:
            db = self.orchestrator.db_session_factory()
            try:
                existing = db.query(PipelineRun).filter_by(filename=dest_path.name).first()
                if not existing:
                    run = PipelineRun(filename=dest_path.name, status=Status.ENQUEUED.value)
                    db.add(run)
                    db.commit()
                logger.info(f"Enqueued file (moved): {dest_path}")
            finally:
                db.close()
            return
        # Process archives (same logic as on_created)
        if ext in archive_exts:
            logger.info(f"Archive detected (moved): {dest_path}. Extracting...")
            extract_dir = dest_path.parent / f"extracted_{dest_path.stem}"
            extract_dir.mkdir(exist_ok=True)
            extracted_files = extract_archive_recursive(dest_path, extract_dir, logger=logger)
            for ef in extracted_files:
                ef_ext = ef.suffix.lower()
                if ef_ext in archive_exts or ef.name.endswith('.tar.gz') or ef.name.endswith('.tgz'):
                    logger.info(f"Skipped nested archive: {ef}")
                    continue
                inbound_dir = Path(settings.INPUT_DIR).resolve()
                ef_abs = ef.resolve()
                dest_path = inbound_dir / ef_abs.name
                if dest_path.exists():
                    logger.warning(f"File {dest_path} already exists in inbound dir. Skipping move of {ef_abs}.")
                    continue
                try:
                    ef_abs.replace(dest_path)
                    logger.info(f"Moved extracted file {ef_abs} to inbound dir as {dest_path}")
                except Exception as e:
                    logger.error(f"Failed to move {ef_abs} to {dest_path}: {e}")
                    continue
                db = self.orchestrator.db_session_factory()
                try:
                    existing = db.query(PipelineRun).filter_by(filename=dest_path.name).first()
                    if not existing:
                        run = PipelineRun(filename=dest_path.name, status=Status.ENQUEUED.value)
                        db.add(run)
                        db.commit()
                    logger.info(f"Enqueued extracted file (moved): {dest_path.name}")
                finally:
                    db.close()
            # Clean up extracted subdirectory
            try:
                import shutil
                shutil.rmtree(extract_dir)
                logger.info(f"Cleaned up extracted directory {extract_dir}")
            except Exception as e:
                logger.warning(f"Failed to clean up extracted directory {extract_dir}: {e}")
            logger.info(f"Finished extracting and enqueuing files from archive (moved): {dest_path}")
            return
        # Unsupported extension
        logger.error(f"Unsupported file extension for {dest_path}. Only .csv, .txt, .zip, .7z, .tar, .gz, .tgz, .tar.gz, and .rar are supported.")

class FileWatcher:
    def __init__(self, orchestrator: PipelineOrchestrator):
        """
        Initialize file watcher.
        
        Args:
            orchestrator: Pipeline orchestrator instance
        """
        self.orchestrator = orchestrator
        self.observer = Observer()
        
    def start(self):
        """Start watching the input directory."""
        try:
            input_path = Path(settings.INPUT_DIR)
            input_path.mkdir(parents=True, exist_ok=True)
            
            handler = CSVHandler(self.orchestrator)
            self.observer.schedule(handler, str(input_path), recursive=False)
            self.observer.start()
            
            logger.info(f"Started watching directory: {input_path}")
            
            try:
                while self.observer.is_alive():
                    time.sleep(1)
            except KeyboardInterrupt:
                self.stop()
                
        except Exception as e:
            logger.error(f"Error in file watcher: {str(e)}")
            self.stop()
            
    def stop(self):
        """Stop watching the input directory."""
        self.observer.stop()
        self.observer.join()
        logger.info("Stopped watching directory") 