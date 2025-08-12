"""
CSV Normalizer module for validating and transforming CSV data.
"""
import csv
import re
from pathlib import Path
from typing import List, Dict, Tuple, Any
import logging
from datetime import datetime
from email_validator import validate_email, EmailNotValidError
from ..config.settings import settings
import json
from pathlib import Path
from .tabular_utils import read_excel_file

logger = logging.getLogger(__name__)

# Load known_headers.json at module level
known_headers_path = Path(__file__).parent / "known_headers.json"
with open(known_headers_path, "r", encoding="utf-8") as f:
    known_headers = json.load(f)

class ValidationError(Exception):
    """Custom exception for validation errors."""
    pass

class Normalizer:
    def __init__(self, gemini_result: Dict[str, Any]):
        """
        Initialize the normalizer with the result from Gemini.

        Args:
            gemini_result (Dict): The structured result from gemini_query,
                                 containing 'header_mapping' and 'normalization_map'.
        """
        self.header_mapping: Dict[str, str] = gemini_result.get("header_mapping", {})
        self.normalization_map: Dict[str, bool] = gemini_result.get("normalization_map", {})
        self.input_has_header: bool = gemini_result.get("input_has_header", True)
        
        # Strip spaces from column separators to handle cases like " | " -> "|"
        raw_separators = gemini_result.get("column_separators")
        self.column_separators = [sep.strip() for sep in raw_separators] if raw_separators else None
        
        # Strip spaces from strip_prefixes to handle cases like " Name: " -> "Name: "
        raw_prefixes = gemini_result.get("strip_prefixes", {})
        self.strip_prefixes = {k: v.strip() for k, v in raw_prefixes.items()} if raw_prefixes else {}
        
        self.total_columns = gemini_result.get("total_columns")

    def _normalize_value(self, header: str, value: Any) -> Any:
        """
        Normalizes a single value based on its header.
        Now: strips quotes from all fields, emails are lowercased/stripped, phone numbers are not modified.
        """
        val = str(value).strip('"\'')
        if "email" in header:
            return val.lower().strip()
        # Dates and phone numbers are not modified except for stripping quotes
        return val

    def _split_row_by_separators(self, line: str) -> list:
        """
        Split a line using the per-column separators, skipping delimiters inside quoted regions.
        If the last field is unquoted and contains fallback delimiters, split further,
        UNLESS a strip_prefix is defined for the last column, in which case do not split further.
        """
        # logger.debug(f"[SPLIT] Processing line: {line}")
        
        def is_quoted(s):
            result = len(s) >= 2 and s.startswith('"') and s.endswith('"')
            return result

        def split_unquoted_fields(field, delimiters):
            # logger.debug(f"[SPLIT] split_unquoted_fields called with field: '{field}', delimiters: {delimiters}")
            # Recursively split unquoted fields by any delimiter, skipping quoted regions
            fields = []
            queue = [field]
            while queue:
                current = queue.pop(0)
                # logger.debug(f"[SPLIT] Processing queue item: '{current}'")
                if is_quoted(current):
                    # logger.debug(f"[SPLIT] Field is quoted, adding as-is: '{current}'")
                    fields.append(current)
                    continue
                for delim in delimiters:
                    # logger.debug(f"[SPLIT] Trying delimiter: '{delim}' in '{current}'")
                    # Find delimiter outside quotes
                    in_quotes = False
                    for i, c in enumerate(current):
                        if c == '"':
                            in_quotes = not in_quotes
                        if not in_quotes and current.startswith(delim, i):
                            left = current[:i].strip()
                            right = current[i+len(delim):].strip()
                            # logger.debug(f"[SPLIT] Found delimiter '{delim}' at position {i}, splitting into: '{left}' and '{right}'")
                            queue.insert(0, right)
                            queue.insert(0, left)
                            break
                    else:
                        continue
                    break
                else:
                    # logger.debug(f"[SPLIT] No delimiters found in '{current}', adding as final field")
                    fields.append(current)
            # logger.debug(f"[SPLIT] split_unquoted_fields result: {fields}")
            return fields

        if not self.column_separators:
            import csv
            result = next(csv.reader([line]))
            # logger.debug(f"[SPLIT] Using standard CSV reader, result: {result}")
            return result

        # logger.debug(f"[SPLIT] Using column_separators: {self.column_separators}")
        fields = []
        start = 0
        in_quotes = False
        sep_idx = 0
        while sep_idx < len(self.column_separators):
            sep = self.column_separators[sep_idx]
            sep_len = len(sep)
            # logger.debug(f"[SPLIT] Looking for separator '{sep}' (index {sep_idx}) starting from position {start}")
            j = start
            while j < len(line):
                c = line[j]
                if c == '"':
                    # Toggle in_quotes unless it's an escaped quote
                    if j+1 < len(line) and line[j+1] == '"':
                        j += 1  # skip escaped quote
                        # logger.debug(f"[SPLIT] Skipped escaped quote at position {j-1}")
                    else:
                        in_quotes = not in_quotes
                        # logger.debug(f"[SPLIT] Quote at position {j}, in_quotes now: {in_quotes}")
                # Only consider separator if not in quotes
                if not in_quotes and line.startswith(sep, j):
                    field = line[start:j]
                    # logger.debug(f"[SPLIT] Found separator '{sep}' at position {j}, extracted field: '{field}'")
                    if is_quoted(field):
                        field = field[1:-1]
                        # logger.debug(f"[SPLIT] Removed quotes from field: '{field}'")
                    else:
                        field = field.strip()
                        # logger.debug(f"[SPLIT] Stripped unquoted field: '{field}'")
                    fields.append(field)
                    start = j + sep_len
                    break
                j += 1
            else:
                # No more separators found
                # logger.debug(f"[SPLIT] No more separators found for separator index {sep_idx}")
                break
            sep_idx += 1
        # Add the last field (even if empty)
        field = line[start:]
        # logger.debug(f"[SPLIT] Last field (raw): '{field}'")
        if is_quoted(field):
            field = field[1:-1]
            # logger.debug(f"[SPLIT] Removed quotes from last field: '{field}'")
        else:
            field = field.strip()
            # logger.debug(f"[SPLIT] Stripped last unquoted field: '{field}'")
        fields.append(field)
        # logger.debug(f"[SPLIT] Fields after primary splitting: {fields}")

        # Now, if the last field is unquoted and contains fallback delimiters, split further
        fallback_delimiters = [',', ';', '|', '\t', ':']
        last_col_idx = len(fields) - 1
        last_field = fields[-1]
        # logger.debug(f"[SPLIT] Checking last field for fallback splitting: '{last_field}' (index {last_col_idx})")

        # Check if we should secure the last column (do not split if strip_prefix is defined for it)
        secure_last = False
        if self.strip_prefixes:
            # logger.debug(f"[SPLIT] Strip prefixes defined: {self.strip_prefixes}")
            # The keys in strip_prefixes are string indices
            if str(last_col_idx) in self.strip_prefixes:
                secure_last = True
                # logger.debug(f"[SPLIT] Last column secured (strip_prefix defined for column {last_col_idx})")
                # Optionally, strip the prefix if present
                prefix = self.strip_prefixes[str(last_col_idx)]
                if isinstance(last_field, str) and last_field.startswith(prefix):
                    # Remove the prefix and leading whitespace
                    last_field = last_field[len(prefix):].lstrip()
                    fields[-1] = last_field
                    # logger.debug(f"[SPLIT] Stripped prefix '{prefix}' from last field: '{last_field}'")

        # After prefix stripping, split last field if it contains fallback delimiters (and is not quoted)
        last_field = fields[-1]
        original_last_field = line[start:]  # Get the original last field before quote stripping
        # logger.debug(f"[SPLIT] Final check - original last field: '{original_last_field}', processed last field: '{last_field}'")
        # logger.debug(f"[SPLIT] is_quoted check on original: {is_quoted(original_last_field)}")
        # logger.debug(f"[SPLIT] Contains fallback delimiters: {any(d in last_field for d in fallback_delimiters)}")
        
        if not is_quoted(original_last_field) and any(d in last_field for d in fallback_delimiters):
            # logger.debug(f"[SPLIT] Applying fallback splitting to last field: '{last_field}'")
            split_fields = split_unquoted_fields(last_field, fallback_delimiters)
            fields = fields[:-1] + split_fields
            # logger.debug(f"[SPLIT] After fallback splitting: {fields}")
        else:
            # logger.debug(f"[SPLIT] No fallback splitting applied")
            pass

        # logger.debug(f"[SPLIT] Final result: {fields} (count: {len(fields)})")
        return fields

    def normalize_file(self, input_path: Path, output_path: Path, be_output_path: Path, encoding: str = None) -> Tuple[bool, str, list, int, int, list, int]:
        """
        Single-pass normalization: verifies and normalizes in one go.
        - If matched_columns_count < 1, raise error and stop.
        - For each line: split, check column count, log/save invalid, normalize and write valid.
        - Discarded lines are logged and written to invalid_rows_<filename>.
        Returns:
            success (bool): True if normalization succeeded, False otherwise.
            error_message (str): Error message if failed, else "".
            warnings (list): Only contains a warning if output_written_rows != input_processed_rows.
            output_written_rows (int): Number of rows written to output, including header if present.
            input_processed_rows (int): Number of input rows processed, including header if present.
            skipped_line_numbers (list): List of row numbers skipped/discarded.
            output_file_size (int): Size in bytes of the normalized output file.
        Note: Both output_written_rows and input_processed_rows now always include the header row if present.
        """
        warnings = []
        if self.header_mapping is None or self.normalization_map is None or self.total_columns is None:
            logger.error("Normalizer not properly initialized with Gemini result.")
            return False, "Normalizer not properly initialized with Gemini result.", warnings, 0, 0, [], 0
        known_header_keys = set(known_headers.keys())
        matched_columns_count = sum(1 for v in self.header_mapping.values() if v in known_header_keys)
        if matched_columns_count < 1:
            logger.error("No known headers matched in the file. At least one known header must be present to process the file. Aborting normalization.")
            return False, "No known headers matched in the file. At least one known header must be present to process the file.", warnings, 0, 0, [], 0
        skipped_line_numbers = []
        output_written_rows = 0
        input_processed_rows = 0
        num_columns = self.total_columns
        new_headers = [self.header_mapping.get(str(i), f"unknown_column_{i}") for i in range(num_columns)]
        input_base = Path(input_path).stem
        invalid_file_path = Path(settings.INVALID_DIR) / f"invalid_rows_{input_base}.csv"
        import os
        text_exts = ('.csv', '.tsv', '.psv', '.dat', '.data', '.txt')
        excel_exts = ('.xlsx', '.xls', '.ods')
        input_path_str = str(input_path)
        if input_path_str.lower().endswith(text_exts):
            input_open_kwargs = {'encoding': encoding or 'utf-8'}
            with open(input_path, 'r', **input_open_kwargs, errors='replace') as infile, \
                 open(output_path, 'w', encoding='utf-8', newline='') as outfile, \
                 open(invalid_file_path, 'w', encoding='utf-8') as invalid_file, \
                 open(be_output_path, 'w', encoding='utf-8') as be_output_file:
                import csv
                writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
                writer.writerow(new_headers)
                output_written_rows += 1  # header written
                invalid_file.write(f"Row_Number,Reason,Original_Line\n")
                row_iter = enumerate(infile, start=1)

                be_header = {}
                for idx,header in enumerate(new_headers):
                    if idx == 0:
                        be_header["field"] = header
                    else:
                        be_header[f"field_{idx-1}"] = header
                be_output_file.write(json.dumps(be_header,ensure_ascii= False) + "\n")

                if self.input_has_header:
                    next(row_iter)
                    input_processed_rows += 1  # header processed
                for row_num, line in row_iter:
                    orig_line = line.rstrip('\n')
                    if not orig_line.strip():
                        # logger.debug(f"Row {row_num} is empty or whitespace. Skipping.")
                        skipped_line_numbers.append(row_num)
                        continue
                    if self.column_separators:
                        row = self._split_row_by_separators(orig_line)
                    else:
                        import csv as pycsv
                        row = next(pycsv.reader([orig_line]))
                    input_processed_rows += 1
                    if len(row) != num_columns:
                        reason = f"Column count mismatch (got {len(row)}, expected {num_columns})"
                        # Safe logging with Unicode handling
                        safe_line = orig_line
                        try:
                            # Try to encode/decode to handle Unicode safely
                            safe_line = orig_line.encode('utf-8', errors='replace').decode('utf-8')
                        except Exception:
                            safe_line = repr(orig_line)  # Use repr as fallback
                        logger.warning(f"Row {row_num} has {len(row)} columns, expected {num_columns}. Discarding row: {safe_line}")
                        invalid_file.write(f"{row_num},{reason},\"{orig_line}\"\n")
                        skipped_line_numbers.append(row_num)
                        continue
                    processed_row = self._process_row(row, new_headers)
                    writer.writerow(processed_row)
                    be_row = {}
                    for i, value in enumerate(processed_row):
                        if i == 0:
                            be_row["field"] = value
                        else:
                            be_row[f"field_{i-1}"] = value
                    be_output_file.write(json.dumps(be_row, ensure_ascii=False) + "\n")
                    output_written_rows += 1

        elif input_path_str.lower().endswith(excel_exts):
            import csv
            import pandas as pd
            df = read_excel_file(input_path, encoding=encoding)
            with open(output_path, 'w', encoding='utf-8', newline='') as outfile, \
                 open(invalid_file_path, 'w', encoding='utf-8') as invalid_file, \
                 open(be_output_path, 'w', encoding='utf-8') as be_output_file:
                writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
                writer.writerow(new_headers)
                output_written_rows += 1  # header written
                invalid_file.write(f"Row_Number,Reason,Original_Line\n")
                row_iter = df.iterrows()
                be_header = {}
                for idx, header in enumerate(new_headers):
                    if idx == 0:
                        be_header["field"] = header
                    else:
                        be_header[f"field_{idx-1}"] = header
                if self.input_has_header:
                    next(row_iter)
                    input_processed_rows += 1  # header processed
                for row_num, (_, row) in enumerate(row_iter, start=1):
                    row_list = list(row.values)
                    if not any(str(cell).strip() for cell in row_list):
                        # logger.debug(f"Row {row_num} is empty or whitespace. Skipping.")
                        skipped_line_numbers.append(row_num)
                        continue
                    if len(row_list) != num_columns:
                        reason = f"Column count mismatch (got {len(row_list)}, expected {num_columns})"
                        # Safe logging with Unicode handling
                        safe_row = str(row_list)
                        try:
                            safe_row = str(row_list).encode('utf-8', errors='replace').decode('utf-8')
                        except Exception:
                            safe_row = repr(row_list)
                        logger.warning(f"Row {row_num} has {len(row_list)} columns, expected {num_columns}. Discarding row: {safe_row}")
                        invalid_file.write(f"{row_num},{reason},\"{row_list}\"\n")
                        skipped_line_numbers.append(row_num)
                        continue
                    processed_row = self._process_row(row_list, new_headers)
                    writer.writerow(processed_row)
                    be_row = {}
                    for i, value in enumerate(processed_row):
                        if i == 0:
                            be_row["field"] = value
                        else:
                            be_row[f"field_{i-1}"] = value
                    be_output_file.write(json.dumps(be_row, ensure_ascii=False) + "\n")
                    output_written_rows += 1
        else:
            return False, "Unsupported file type for normalization", warnings, 0, 0, [], 0
        
        # Post-processing analysis: Check for repetitive substrings in each column
        self._analyze_repetitive_patterns(output_path, new_headers)
        
        output_file_size = 0
        be_output_file_size = 0
        try:
            output_file_size = os.path.getsize(output_path)
            be_output_file_size = os.path.getsize(be_output_path)
        except Exception:
            pass
        if output_written_rows != input_processed_rows:
            warnings.append(f"{output_written_rows} of {input_processed_rows} non-empty rows written to normalized CSV (some rows were skipped)")
        return True, "", warnings, output_written_rows, input_processed_rows, skipped_line_numbers, output_file_size, be_output_file_size

    def _analyze_repetitive_patterns(self, output_path: Path, headers: List[str]):
        """
        Analyze the output file for repetitive substring patterns in each column.
        Logs warnings for the longest substrings (length >= 3) that appear in more than 50% of rows in the same column.
        Avoids reporting substrings that are contained within longer reported substrings.
        """
        try:
            import pandas as pd
            # Read the normalized output file
            df = pd.read_csv(output_path, encoding='utf-8')
            
            if len(df) == 0:
                return  # No data to analyze
            
            total_rows = len(df)
            threshold = total_rows * 0.5  # 50% threshold
            
            for col_idx, header in enumerate(headers):
                if col_idx >= len(df.columns):
                    continue
                    
                column_name = df.columns[col_idx]
                column_data = df[column_name].astype(str).fillna('')
                
                # Skip if column has too few non-empty values
                non_empty_values = [val for val in column_data if val.strip()]
                if len(non_empty_values) < 3:
                    continue
                
                # Extract all substrings of length >= 3 from all values in this column
                substring_counts = {}
                
                for value in non_empty_values:
                    value_str = str(value).strip()
                    if len(value_str) < 3:
                        continue
                    
                    # Generate all substrings of length >= 3
                    seen_substrings = set()  # Avoid counting same substring multiple times per value
                    for i in range(len(value_str)):
                        for j in range(i + 3, len(value_str) + 1):
                            substring = value_str[i:j]
                            if substring not in seen_substrings:
                                seen_substrings.add(substring)
                                substring_counts[substring] = substring_counts.get(substring, 0) + 1
                
                # Find substrings that exceed the threshold
                qualifying_substrings = []
                for substring, count in substring_counts.items():
                    if count > threshold and len(substring) >= 3:
                        qualifying_substrings.append((substring, count))
                
                # Sort by length (descending) then by count (descending)
                qualifying_substrings.sort(key=lambda x: (-len(x[0]), -x[1]))
                
                # Filter out substrings that are contained in longer ones
                reported_substrings = []
                for substring, count in qualifying_substrings:
                    # Check if this substring is contained in any already reported substring
                    is_contained = False
                    for reported_sub, _ in reported_substrings:
                        if substring in reported_sub and substring != reported_sub:
                            is_contained = True
                            break
                    
                    if not is_contained:
                        reported_substrings.append((substring, count))
                
                # Report the filtered substrings
                for substring, count in reported_substrings:
                    percentage = (count / total_rows) * 100
                    logger.warning(f"Repetitive pattern detected in column {col_idx} '{header}': "
                                 f"substring '{substring}' appears in {count}/{total_rows} rows "
                                 f"({percentage:.1f}% of all rows)")
                        
        except Exception as e:
            logger.debug(f"Error during repetitive pattern analysis: {e}")
            # Don't fail the normalization process if analysis fails
            pass

    def _process_row(self, row: List[Any], new_headers: List[str]) -> List[Any]:
        """Processes a single row for normalization, including stripping prefixes if specified."""
        processed_row = []
        for i, value in enumerate(row):
            header = new_headers[i]
            # Strip prefix if specified for this column
            prefix = self.strip_prefixes.get(str(i))
            val = value
            if prefix and isinstance(val, str):
                if val.startswith(prefix):
                    val = val[len(prefix):].lstrip()
            # Check the normalization map to see if this column should be normalized
            if self.normalization_map.get(header, False):
                processed_row.append(self._normalize_value(header, val))
            else:
                processed_row.append(val)
        return processed_row

    def _validate_header(self, header: List[str]) -> bool:
        """Validate that at least one header matches field mappings."""
        return any(col in self.header_mapping for col in header)

    def _validate_field(self, field: str, rules: Dict, row_num: int, col_name: str):
        """Validate a field against its rules."""
        if not field and rules.get('required', False):
            raise ValidationError(f"Row {row_num}, Column {col_name}: Required field is empty")
            
        if field:  # Only validate non-empty fields
            field_type = rules.get('type', '').lower()
            if field_type in self.validators:
                self.validators[field_type](field, row_num, col_name)

    def _transform_field(self, field: str, rules: Dict) -> str:
        """Transform a field according to its rules."""
        if not field:
            return ""
            
        # Apply transformations
        field = field.strip()
        
        # Handle specific types
        field_type = rules.get('type', '').lower()
        if field_type == 'date':
            # Convert to ISO format
            try:
                dt = datetime.strptime(field, rules.get('format', '%Y-%m-%d'))
                field = dt.isoformat()[:10]
            except ValueError:
                pass
                
        elif field_type == 'phone':
            # Strip non-numeric chars except + for country code
            field = re.sub(r'[^\d+]', '', field)
            
        return field

    # Field Validators
    def _validate_email(self, field: str, row_num: int, col_name: str):
        try:
            validate_email(field)
        except EmailNotValidError:
            raise ValidationError(f"Row {row_num}, Column {col_name}: Invalid email format")

    def _validate_date(self, field: str, row_num: int, col_name: str):
        try:
            datetime.strptime(field, '%Y-%m-%d')
        except ValueError:
            raise ValidationError(f"Row {row_num}, Column {col_name}: Invalid date format (use YYYY-MM-DD)")

    def _validate_number(self, field: str, row_num: int, col_name: str):
        try:
            float(field)
        except ValueError:
            raise ValidationError(f"Row {row_num}, Column {col_name}: Invalid number format")

    def _validate_phone(self, field: str, row_num: int, col_name: str):
        # Basic phone validation (adjust pattern as needed)
        if not re.match(r'^\+?[\d\s\-\(\)]+$', field):
            raise ValidationError(f"Row {row_num}, Column {col_name}: Invalid phone number format")

    def _verify_row(self, row: List[Any], new_headers: List[str]) -> Tuple[bool, str]:
        """
        Verifies a row for:
        - Phone numbers: must only contain digits (no non-digit chars), allowing quotes around the number
        - Person names: must not contain digits
        - Emails: must comply with standard constraints, but ONLY if normalization_map[header] is True
        Returns (True, "") if all checks pass, else (False, reason)
        """
        for i, value in enumerate(row):
            header = new_headers[i]
            header_lower = header.lower()
            val = str(value).strip('"\'')
            # Phone number check
            if "phone" in header_lower:
                if val and not re.match(r'^\+?[\d\s\-()]+$', val):
                    return False, f"Phone number contains invalid characters in column '{header_lower}'"
            # Person name check (simple: header contains 'name', not 'company', not 'filename', not 'username', etc.)
            if "name" in header_lower and not any(x in header_lower for x in ["company", "filename", "username"]):
                if any(c.isdigit() for c in val):
                    return False, f"Person name contains digits in column '{header_lower}'"
            # Email check (ONLY if normalization_map says so)
            if "email" in header_lower and val.strip() and self.normalization_map.get(header, False):
                try:
                    validate_email(val, check_deliverability=False)
                except EmailNotValidError:
                    return False, f"Invalid email format in column '{header_lower}'"
        return True, "" 

    def _underline_invalid_field(self, row: list, headers: list, reason: str) -> str:
        """
        Returns a string of the row with the invalid field wrapped in triple underscores (___field___), based on the reason message.
        """
        import re
        # Try to extract the column name from the reason
        match = re.search(r"column '([^']+)'", reason)
        if not match:
            return str(row)
        col_name = match.group(1)
        try:
            idx = [h.lower() for h in headers].index(col_name)
        except ValueError:
            return str(row)
        underlined = f"___{row[idx]}___"
        row_copy = list(row)
        row_copy[idx] = underlined
        return str(row_copy) 

    # Remove field_mapping_check, uniform_format_check, and field_normalization methods and any related code