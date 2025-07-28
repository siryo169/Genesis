#!/usr/bin/env python3
"""
Usage examples:

# Clean everything (logs, all data subdirectories, and pipeline.db):
python clean_dirs.py

# Clean only logs (and pipeline.db):
python clean_dirs.py --logs

# Clean only data (all subdirectories, and pipeline.db):
python clean_dirs.py --data

# Clean only specific data subdirectories (e.g. inbound and output, and pipeline.db):
python clean_dirs.py --data inbound output

# Clean both logs and a subset of data subdirectories (and pipeline.db):
python clean_dirs.py --logs --data inbound output

# Clean everything but keep pipeline.db:
python clean_dirs.py --keep-db
"""
import argparse
import os
import shutil
from pathlib import Path

DATA_DIR = Path('backend/data')
LOGS_DIR = Path('backend/logs')
DB_FILE = Path('backend/pipeline.db')

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

def main():
    parser = argparse.ArgumentParser(description="Clean logs/ and backend/data/ subdirectories, and optionally pipeline.db.")
    parser.add_argument('--logs', action='store_true', help='Clean only the logs directory')
    parser.add_argument('--data', nargs='*', help='Clean only the data directory or specific subdirectories (e.g. inbound output)')
    parser.add_argument('--keep-db', action='store_true', help='Do not delete pipeline.db')
    args = parser.parse_args()

    if not args.keep_db and DB_FILE.exists():
        DB_FILE.unlink()
        print(f"Deleted {DB_FILE}")
    elif not args.keep_db:
        print(f"Database file {DB_FILE} does not exist.")
    else:
        print(f"Keeping {DB_FILE}")

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