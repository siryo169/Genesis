"""
Sample Extractor module for reading a subset of CSV data for analysis.
"""
import csv
from pathlib import Path
from typing import List, Tuple
import logging
from ..config.settings import settings
from .tabular_utils import read_excel_file

logger = logging.getLogger(__name__)

def extract_sample(file_path: str | Path, encoding: str = None) -> Tuple[List[List[str]], str, list]:
    """
    Extracts up to a maximum of 1000 rows from a file to create a sample.
    The final token-based sampling is now handled in the gemini_query module.
    Returns (sampled_rows, error_message, warnings)
    """
    import os
    MAX_LINES = 1000
    file_path_str = str(file_path)
    file_name = Path(file_path).name
    text_exts = ('.csv', '.tsv', '.psv', '.dat', '.data', '.txt')
    excel_exts = ('.xlsx', '.xls', '.ods')
    warnings = []
    try:
        if file_path_str.lower().endswith(text_exts):
            # Read up to MAX_LINES robustly, skip lines that can't be parsed
            lines = []
            with open(file_path, 'r', encoding=encoding or 'utf-8', errors='replace') as f:
                for i, line in enumerate(f):
                    if i >= MAX_LINES + 1:
                        break
                    lines.append(line.rstrip('\n'))

            # Use csv.reader for robust splitting (handles quoted fields)
            data = []
            for line in lines:
                try:
                    row = next(csv.reader([line]))
                    data.append(row)
                except Exception as e:
                    warning_msg = f"[SAMPLER] Failed to parse line: {line[:50]}... ({e})"
                    logger.warning(warning_msg)
                    warnings.append(warning_msg)
                    continue  # skip lines that can't be parsed
            
            logger.info(f"Extracted {len(data)} lines from {file_name} for sampling.")
            return data, "", warnings

        elif file_path_str.lower().endswith(excel_exts):
            df = read_excel_file(file_path, encoding=encoding)
            # Limit to MAX_LINES
            if len(df) > MAX_LINES:
                df = df.head(MAX_LINES)
                warnings.append(f"Excel file has more than {MAX_LINES} rows, truncating for sample.")

            data = [df.columns.tolist()] + df.values.tolist()
            logger.info(f"Extracted {len(data)} lines from {file_name} for sampling.")
            return data, "", warnings

    except Exception as e:
        error_msg = f"Error sampling {file_name}: {str(e)}"
        logger.error(error_msg)
        warnings.append(error_msg)
        return [], error_msg, warnings
