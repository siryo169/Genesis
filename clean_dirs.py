#!/usr/bin/env python3
"""
Usage examples:

# Clean everything (logs, all data subdirectories, and recreate fresh pipeline.db):
python clean_dirs.py

# Clean only logs (and recreate fresh pipeline.db):
python clean_dirs.py --logs

# Clean only data (all subdirectories, and recreate fresh pipeline.db):
python clean_dirs.py --data

# Clean only specific data subdirectories (e.g. inbound and output, and recreate fresh pipeline.db):
python clean_dirs.py --data inbound output

# Clean both logs and a subset of data subdirectories (and recreate fresh pipeline.db):
python clean_dirs.py --logs --data inbound output

# Clean everything but keep pipeline.db unchanged:
python clean_dirs.py --keep-db
"""
import argparse
import os
import shutil
import sys
from pathlib import Path

# Add src directory to the path so we can import the database models
current_dir = Path(__file__).parent
if (current_dir / 'src').exists():
    # Running from backend directory
    sys.path.append(str(current_dir / 'src'))
    DATA_DIR = Path('data')
    LOGS_DIR = Path('logs')
    DB_FILE = Path('pipeline.db')
else:
    # Running from root directory
    sys.path.append(str(current_dir / 'backend' / 'src'))
    DATA_DIR = Path('backend/data')
    LOGS_DIR = Path('backend/logs')
    DB_FILE = Path('backend/pipeline.db')

try:
    from models.pipeline_run import init_db
    DB_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import database models: {e}")
    print(f"Python path: {sys.path}")
    DB_AVAILABLE = False

DATA_SUBDIRS = [d.name for d in DATA_DIR.iterdir() if d.is_dir()] if DATA_DIR.exists() else []

def clean_dir(path: Path):
    if not path.exists():
        print(f"Directory {path} does not exist.")
        return
    for item in path.iterdir():
        if item.is_file():
            item.unlink()
        elif item.is_dir():
            shutil.rmtree(item)
    print(f"Cleaned {path}")

def clean_data(subdirs=None):
    if not DATA_DIR.exists():
        print(f"Data directory {DATA_DIR} does not exist.")
        return
    if subdirs is None:
        subdirs = DATA_SUBDIRS
    for sub in subdirs:
        sub_path = DATA_DIR / sub
        if sub_path.exists() and sub_path.is_dir():
            for item in sub_path.iterdir():
                if item.is_file():
                    item.unlink()
                elif item.is_dir():
                    shutil.rmtree(item)
            print(f"Cleaned {sub_path}")
        else:
            print(f"Subdirectory {sub_path} does not exist.")

def clean_logs():
    clean_dir(LOGS_DIR)

def clean_database():
    """Clean database by deleting it completely and recreating it with fresh structure"""
    # Delete the database file if it exists
    if DB_FILE.exists():
        DB_FILE.unlink()
        print(f"Deleted existing database {DB_FILE}")
    
    if not DB_AVAILABLE:
        print("Database models not available, cannot recreate database")
        return
    
    # Recreate the database with fresh structure using the same function as the backend
    try:
        print(f"Creating fresh database {DB_FILE}...")
        SessionLocal = init_db(f'sqlite:///{DB_FILE}')
        print(f"Successfully created fresh database {DB_FILE} with clean table structure")
    except Exception as e:
        print(f"Error creating fresh database: {e}")

def main():
    parser = argparse.ArgumentParser(description="Clean logs/ and backend/data/ subdirectories, and recreate fresh pipeline.db.")
    parser.add_argument('--logs', action='store_true', help='Clean only the logs directory')
    parser.add_argument('--data', nargs='*', help='Clean only the data directory or specific subdirectories (e.g. inbound output)')
    parser.add_argument('--keep-db', action='store_true', help='Do not touch pipeline.db')
    args = parser.parse_args()

    # Handle database cleaning (always recreate unless --keep-db is specified)
    if not args.keep_db:
        clean_database()
    else:
        print(f"Keeping {DB_FILE} unchanged")

    if args.logs and args.data:
        # Clean both, but possibly only a subset of data subdirs
        clean_logs()
        if args.data:
            clean_data(args.data)
        else:
            clean_data()
    elif args.logs:
        clean_logs()
    elif args.data is not None:
        if args.data:
            clean_data(args.data)
        else:
            clean_data()
    else:
        # Default: clean everything
        clean_logs()
        clean_data()

if __name__ == "__main__":
    main() 