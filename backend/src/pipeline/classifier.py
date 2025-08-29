"""
CSV Classifier module to determine if a file is a valid tabular CSV.
"""
import csv
from pathlib import Path
import logging
from typing import Tuple, List, Any
from collections import Counter
import chardet
import pandas as pd
import json
from . import tabular_utils

logger = logging.getLogger(__name__)

def load_known_headers() -> dict:
    """Load known headers from JSON file."""
    try:
        known_headers_path = Path(__file__).parent / "known_headers.json"
        with open(known_headers_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load known headers: {e}")
        return {}

def extract_headers_from_first_line(first_line: str) -> List[str]:
    """
    Extract headers from the first line by trying different delimiters.
    Returns the split that produces the most columns (minimum 2).
    """
    if not first_line.strip():
        return []
    
    # Try different delimiters and pick the one that gives most columns
    delimiters = [',', ';', '\t', '|', ':']
    best_headers = []
    max_columns = 1
    
    for delimiter in delimiters:
        try:
            headers = [h.strip().strip('"\'') for h in first_line.split(delimiter)]
            # Only consider if we get at least 2 columns and more than current best
            if len(headers) >= 2 and len(headers) > max_columns:
                max_columns = len(headers)
                best_headers = headers
        except Exception:
            continue
    
    return best_headers

def detect_separators_from_headers(first_line: str) -> Tuple[List[str], str]:
    """
    Detect the separators used between columns in the first line.
    Returns a tuple of (separators_list, best_delimiter).
    
    For example, if the line is "name,email,phone", it returns ([",", ","], ",")
    """
    if not first_line.strip():
        return [], ""
    
    # Try different delimiters and pick the one that gives most columns
    delimiters = [',', ';', '\t', '|', ':']
    best_delimiter = ""
    max_columns = 1
    
    for delimiter in delimiters:
        try:
            headers = [h.strip().strip('"\'') for h in first_line.split(delimiter)]
            # Only consider if we get at least 2 columns and more than current best
            if len(headers) >= 2 and len(headers) > max_columns:
                max_columns = len(headers)
                best_delimiter = delimiter
        except Exception:
            continue
    
    # Generate separators list: for N columns, there are N-1 separators
    if best_delimiter and max_columns > 1:
        separators_list = [best_delimiter] * (max_columns - 1)
        return separators_list, best_delimiter
    
    return [], ""

def calculate_known_headers_percentage(headers: List[str], known_headers: dict) -> Tuple[float, int, int, List[str], List[bool]]:
    """
    Calculate the percentage of headers that match known headers (non-conflictive).
    Also returns the standardized headers list with known header keys replacing original headers,
    and a list indicating which headers need normalization.
    
    Args:
        headers: List of headers from the file
        known_headers: Dictionary of known headers with variants
    
    Returns:
        Tuple of (percentage, known_count, total_count, standardized_headers, normalize_flags)
    """
    if not headers:
        return 0.0, 0, 0, [], []
    
    # Normalize input headers
    normalized_headers = normalize_headers(headers)
    
    # Create lookup dictionaries for known headers and their normalize flags (non-conflictive only)
    known_lookup = {}
    normalize_lookup = {}
    
    for header_key, header_info in known_headers.items():
        # Skip conflictive headers
        if header_info.get('conflictive', False):
            continue
        
        # Get normalize flag (default False)
        should_normalize = header_info.get('normalize', False)
        
        # Add the main header (normalized from key)
        main_header = normalize_headers([header_key])[0] if header_key else ""
        if main_header:
            known_lookup[main_header] = header_key
            normalize_lookup[main_header] = should_normalize
        
        # Add all variants (normalized)
        variants = header_info.get('variants', [])
        for variant in variants:
            normalized_variant = normalize_headers([variant])[0] if variant else ""
            if normalized_variant:
                known_lookup[normalized_variant] = header_key
                normalize_lookup[normalized_variant] = should_normalize
    
    # Count matches and create standardized headers list with normalize flags
    known_count = 0
    matched_headers = []
    standardized_headers = []
    normalize_flags = []
    
    for i, header in enumerate(normalized_headers):
        original_header = headers[i]  # Keep reference to original
        if header in known_lookup:
            known_count += 1
            known_header_key = known_lookup[header]
            should_normalize = normalize_lookup[header]
            standardized_headers.append(known_header_key)  # Use known header key
            normalize_flags.append(should_normalize)  # Add normalize flag
            matched_headers.append(f"{original_header} -> {known_header_key} (normalize: {should_normalize})")
        else:
            standardized_headers.append(original_header)  # Keep original if not found
            normalize_flags.append(False)  # Unknown headers always False
    
    total_count = len(normalized_headers)
    percentage = (known_count / total_count) * 100 if total_count > 0 else 0.0
    
    if matched_headers:
        logger.info(f"Matched headers: {', '.join(matched_headers)}")
    
    return percentage, known_count, total_count, standardized_headers, normalize_flags

def has_content(df: pd.DataFrame) -> Tuple[bool, str]:
    """Check if a DataFrame has any content beyond empty strings or whitespace."""
    if df.empty:
        return False, "File is empty (no columns or rows)."
    
    # Check if all cells are empty or just whitespace
    all_whitespace = all(
        str(cell).strip() == ""
        for col in df.columns
        for cell in df[col]
    )

    if all_whitespace:
        return False, "File contains only whitespace or empty cells."

    return True, ""

def robust_read_lines(file_path: Path, logger) -> Tuple[List[str], Any, str, int, int, list]:
    """
    Try to read lines from a file using UTF-8 first, then encoding detection and fallbacks.
    Returns (lines, encoding, error_message, file_size, row_count, warnings)
    """
    file_size = None
    row_count = 0
    warnings = []
    try:
        file_size = file_path.stat().st_size
    except Exception:
        pass
    # 1. Try UTF-8 first
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        if lines and lines[0].startswith('\ufeff'):
            lines[0] = lines[0].lstrip('\ufeff')
        lines = [line.replace('\r\n', '\n').replace('\r', '\n') for line in lines]
        non_empty_lines = [line for line in lines if line.strip()]
        row_count = len(lines)
        logger.info(f"[ENCODING] Successfully read {len(lines)} lines from {file_path.name} using encoding: utf-8 (non-empty: {len(non_empty_lines)})")
        return lines, 'utf-8', None, file_size, row_count, warnings
    except UnicodeDecodeError:
        warning_msg = f"[ENCODING] UTF-8 decode failed for {file_path.name}, trying chardet and other encodings."
        logger.warning(warning_msg)
        warnings.append(warning_msg)
    except Exception as e:
        warning_msg = f"[ENCODING] Unexpected error reading {file_path.name} as UTF-8: {e}"
        logger.warning(warning_msg)
        warnings.append(warning_msg)

    encodings_to_try = []
    try:
        with open(file_path, 'rb') as f:
            raw = f.read(4096)
        import chardet
        detected = chardet.detect(raw)
        detected_encoding = detected['encoding']
        confidence = detected.get('confidence', 0)
        logger.info(f"[ENCODING] Detected encoding for {file_path.name}: {detected_encoding} (confidence: {confidence})")
        if detected_encoding:
            encodings_to_try.append(detected_encoding)
    except Exception as e:
        warning_msg = f"[ENCODING] Could not detect encoding for {file_path.name}: {e}"
        logger.warning(warning_msg)
        warnings.append(warning_msg)
    encodings_to_try += ['utf-8-sig', 'utf-16', 'utf-32', 'latin1']
    tried = set()
    for enc in encodings_to_try:
        if not enc or enc.lower() in tried:
            continue
        tried.add(enc.lower())
        try:
            with open(file_path, 'r', encoding=enc, errors='replace') as f:
                lines = f.readlines()
            if lines and lines[0].startswith('\ufeff'):
                lines[0] = lines[0].lstrip('\ufeff')
            lines = [line.replace('\r\n', '\n').replace('\r', '\n') for line in lines]
            non_empty_lines = [line for line in lines if line.strip()]
            row_count = len(lines)
            logger.info(f"[ENCODING] Tried encoding: {enc}, total lines: {len(lines)}, non-empty lines: {len(non_empty_lines)}")
            if len(non_empty_lines) > 0:
                logger.info(f"[ENCODING] Successfully read {len(lines)} lines from {file_path.name} using encoding: {enc}")
                return lines, enc, None, file_size, row_count, warnings
            else:
                warning_msg = f"[ENCODING] Read 0 non-empty lines from {file_path.name} with encoding {enc}. Trying next encoding..."
                logger.warning(warning_msg)
                warnings.append(warning_msg)
        except Exception as e:
            warning_msg = f"[ENCODING] Failed to read {file_path.name} with encoding {enc}: {e}"
            logger.warning(warning_msg)
            warnings.append(warning_msg)
    try:
        with open(file_path, 'rb') as f:
            raw_bytes = f.read(32)
        hex_bytes = ' '.join(f'{b:02x}' for b in raw_bytes)
        error_msg = f"[ENCODING] All encoding attempts failed for {file_path.name}. First 32 bytes (hex): {hex_bytes}"
        logger.error(error_msg)
        warnings.append(error_msg)
    except Exception as e:
        warning_msg = f"[ENCODING] Could not read raw bytes for {file_path.name}: {e}"
        logger.error(warning_msg)
        warnings.append(warning_msg)
    return [], None, f"Could not read file with any known encoding. Tried: {list(tried)}", file_size, row_count, warnings


def classify_file(file_path: str | Path) -> dict:
    """
    Classifies the file: determines encoding, file size, row count, tabular status, and known headers percentage.

    Tabular detection logic (for text files):
    - For each sampled line, counts the occurrences of each of the common delimiters [',', ';', '|', '\\t', ':'].
    - Builds a dictionary for each line mapping each present delimiter to its count (e.g., {',': 2, '|': 3}).
    - The file is considered tabular if at least 10% of lines have the exact same delimiter-count dictionary (i.e., the same delimiters with the same counts).
    - If this threshold is not met for any delimiter-count dictionary, the file is not considered tabular.

    Returns a dict with keys: encoding, file_size, row_count, is_tabular, error_message, warnings, known_per,
    standardized_headers, normalize_flags, known_columns_count, total_columns_count, separators_list
    """
    file_path = Path(file_path)
    warnings = []
    
    # Load known headers once
    known_headers = load_known_headers()
    
    # Check for supported file types first
    from .constants import SUPPORTED_EXTENSIONS, TEXT_EXTENSIONS, EXCEL_EXTENSIONS
    file_ext = file_path.suffix.lower()

    if file_ext not in SUPPORTED_EXTENSIONS:
        return {
            'encoding': None, 'file_size': None, 'row_count': 0, 'is_tabular': False,
            'error_message': f'Unsupported file type: {file_path.suffix}',
            'warnings': [f'Unsupported file type: {file_path.suffix}'],
            'known_per': 0, 'known_columns_count': 0, 'total_columns_count': 0, 'separators_list': []
        }
        
    # Check for empty file by size, which is a reliable first check.
    try:
        file_size = file_path.stat().st_size
        if file_size == 0:
            return {
                'encoding': None, 'file_size': 0, 'row_count': 0, 'is_tabular': False,
                'error_message': 'File is empty',
                'warnings': ['File is empty'],
                'known_per': 0, 'known_columns_count': 0, 'total_columns_count': 0, 'separators_list': []
            }
    except FileNotFoundError:
        return {
            'encoding': None, 'file_size': None, 'row_count': 0, 'is_tabular': False,
            'error_message': 'File not found',
            'warnings': ['File not found'],
            'known_per': 0, 'known_columns_count': 0, 'total_columns_count': 0, 'separators_list': []
        }
    
    known_per = 0
    
    # Branch logic based on file type for more accurate content validation
    if file_ext in EXCEL_EXTENSIONS:
        try:
            df = tabular_utils.read_excel_file(file_path)
            
            has_data, reason = has_content(df)
            if not has_data:
                return {
                    'encoding': None, 'file_size': file_size, 'row_count': 0, 'is_tabular': False,
                    'error_message': reason, 'warnings': [reason], 'known_per': 0
                }

            # Calculate known headers percentage for Excel files
            standardized_headers = []
            normalize_flags = []
            known_columns_count = 0
            total_columns_count = 0
            separators_list = []
            
            if not df.empty and len(df.columns) > 0:
                headers = [str(col) for col in df.columns]
                known_per, known_columns_count, total_columns_count, standardized_headers, normalize_flags = calculate_known_headers_percentage(headers, known_headers)
                logger.info(f"Excel file standardized headers: {standardized_headers}")
                logger.info(f"Excel file normalize flags: {normalize_flags}")
                
                # For Excel files, separators are not applicable (columns are already separated)
                # But we can represent it as empty separators between columns
                if total_columns_count > 1:
                    separators_list = [""] * (total_columns_count - 1)  # Empty separators for Excel

            # If it has data, it's considered tabular by definition.
            return {
                'encoding': None,  # Pandas handles encoding internally
                'file_size': file_size,
                'row_count': len(df),
                'is_tabular': True,
                'error_message': None,
                'warnings': warnings,
                'known_per': known_per,
                'standardized_headers': standardized_headers,
                'normalize_flags': normalize_flags,
                'known_columns_count': known_columns_count,
                'total_columns_count': total_columns_count,
                'separators_list': separators_list
            }
        except Exception as e:
            error_msg = f"Failed to read and validate Excel file content: {e}"
            logger.warning(error_msg)
            warnings.append(error_msg)
            return {
                'encoding': None, 'file_size': file_size, 'row_count': 0, 'is_tabular': False,
                'error_message': error_msg, 'warnings': warnings, 'known_per': 0,
                'known_columns_count': 0, 'total_columns_count': 0, 'separators_list': []
            }

    # For text files, use the existing line-based logic
    lines, encoding, error_message, file_size, row_count, warnings = robust_read_lines(file_path, logger)
    
    # Check for empty or whitespace-only file
    if not any(line.strip() for line in lines):
        return {
            'encoding': encoding,
            'file_size': file_size,
            'row_count': row_count,
            'is_tabular': False,
            'error_message': 'File is empty or only contains whitespace',
            'warnings': warnings,
            'known_per': 0, 'known_columns_count': 0, 'total_columns_count': 0, 'separators_list': []
        }

    if error_message:
        return {
            'encoding': encoding,
            'file_size': file_size,
            'row_count': row_count,
            'is_tabular': False,
            'error_message': error_message,
            'warnings': warnings,
            'known_per': 0, 'known_columns_count': 0, 'total_columns_count': 0, 'separators_list': []
        }
    # Heuristic: is tabular?
    try:
        # Initialize variables for column and separator information
        standardized_headers = []
        normalize_flags = []
        known_columns_count = 0
        total_columns_count = 0
        separators_list = []
        
        # Extract headers for known headers calculation from first non-empty line
        first_line = ""
        for line in lines:
            if line.strip():
                first_line = line.strip()
                break
        
        if first_line:
            headers = extract_headers_from_first_line(first_line)
            separators_list, best_delimiter = detect_separators_from_headers(first_line)
            
            if headers:
                known_per, known_columns_count, total_columns_count, standardized_headers, normalize_flags = calculate_known_headers_percentage(headers, known_headers)
                logger.info(f"Known headers: {known_columns_count}/{total_columns_count} ({known_per:.1f}%)")
                logger.info(f"Standardized headers: {standardized_headers}")
                logger.info(f"Normalize flags: {normalize_flags}")
                logger.info(f"Detected {total_columns_count} columns with separator '{best_delimiter}'")
                logger.info(f"Separators list: {separators_list}")
            
        delimiters = [',', ';', '|', '\t', ':']
        min_percent = 0.10
        sample_lines = 10000
        first_n = 50
        total_lines = len(lines)
        first_lines = list(range(min(first_n, total_lines)))
        remaining_needed = max(0, sample_lines - len(first_lines))
        if total_lines > first_n and remaining_needed > 0:
            step = max(1, (total_lines - first_n) // remaining_needed)
            sampled_indices = list(range(first_n, total_lines, step))[:remaining_needed]
        else:
            sampled_indices = []
        selected_indices = first_lines + sampled_indices

        # Stricter: Track the dict of delimiter counts for each line
        delimiter_count_dicts = []
        for i in selected_indices:
            line = lines[i].strip()
            if not line:
                continue
            delim_counts = {d: line.count(d) for d in delimiters if line.count(d) > 0}
            # Use frozenset of items to make it hashable for Counter
            delimiter_count_dicts.append(frozenset(delim_counts.items()))

        if not delimiter_count_dicts:
            return {
                'encoding': encoding,
                'file_size': file_size,
                'row_count': row_count,
                'is_tabular': False,
                'error_message': 'No non-empty lines found',
                'warnings': warnings,
                'known_per': known_per,
                'known_columns_count': known_columns_count,
                'total_columns_count': total_columns_count,
                'separators_list': separators_list
            }

        set_counter = Counter(delimiter_count_dicts)
        top3 = set_counter.most_common(3)
        def dict_str(fs):
            d = dict(fs)
            return '{' + ', '.join(f"'{k}': {v}" for k, v in sorted(d.items())) + '}'
        top3_str = ', '.join(
            f"{dict_str(val) if val else 'None'} ({cnt/len(delimiter_count_dicts)*100:.1f}%)"
            for val, cnt in top3
        )

        is_tabular = False
        error_msg = None
        if len(top3) == 0:
            is_tabular = False
            error_msg = 'No non-empty lines found'
        else:
            mode_set, mode_count = top3[0]
            percent = mode_count / len(delimiter_count_dicts)
            if mode_set and percent >= min_percent:
                is_tabular = True
                logger.info(f"[CLASSIFIER] File {file_path.name} is tabular: {percent*100:.1f}% of lines have delimiter counts {dict_str(mode_set)} (>=10%). Top 3: {top3_str}")
            elif not mode_set and len(top3) > 1:
                second_set, second_count = top3[1]
                second_percent = second_count / len(delimiter_count_dicts)
                if second_set and second_percent >= min_percent:
                    is_tabular = True
                    warning_msg = f"[CLASSIFIER] File {file_path.name} is tabular: although the most common line type has no delimiters, the second most common has delimiter counts {dict_str(second_set)} in {second_percent*100:.1f}% of lines (>=10%). Top 3: {top3_str}"
                    logger.warning(warning_msg)
                    warnings.append(warning_msg)
                else:
                    is_tabular = False
                    error_msg = f"Not tabular: the most common line type has no delimiters, and no delimiter-count pattern appears in at least 10% of lines. Top 3: {top3_str}"
                    logger.error(f"[CLASSIFIER] File {file_path.name} is not tabular: {error_msg}")
            else:
                is_tabular = False
                error_msg = f"Not tabular: only {percent*100:.1f}% of lines have delimiter counts {dict_str(mode_set)}, which is below the 10% threshold. Top 3: {top3_str}"
                logger.error(f"[CLASSIFIER] File {file_path.name} is not tabular: {error_msg}")

        return {
            'encoding': encoding,
            'file_size': file_size,
            'row_count': row_count,
            'is_tabular': is_tabular,
            'error_message': error_msg,
            'warnings': warnings,
            'known_per': known_per,
            'standardized_headers': standardized_headers if is_tabular else None,
            'normalize_flags': normalize_flags if is_tabular else None,
            'known_columns_count': known_columns_count,
            'total_columns_count': total_columns_count,
            'separators_list': separators_list if is_tabular else []
        }
    except Exception as e:
        warning_msg = f"Exception during classification: {str(e)}"
        logger.warning(warning_msg)
        warnings.append(warning_msg)
        return {
            'encoding': encoding,
            'file_size': file_size,
            'row_count': row_count,
            'is_tabular': False,
            'error_message': str(e),
            'warnings': warnings,
            'known_per': known_per,
            'known_columns_count': 0,
            'total_columns_count': 0,
            'separators_list': []
        }

def normalize_headers(headers: list[str]) -> list[str]:
    """
    Normalize headers by stripping whitespace, converting to lowercase and removing - or _ or whitespace.
    """
    return [header.strip().lower().replace('-', '').replace('_', '').replace(' ', '') for header in headers if header.strip()]