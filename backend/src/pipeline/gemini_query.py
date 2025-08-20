"""
Gemini API query module for analyzing CSV structure and content.
"""
import json
from typing import List, Dict, Tuple
import logging
import os
import google.genai as genai
from google.api_core import exceptions as core_exceptions
from ..config.settings import settings
import concurrent.futures
import time
import ast

logger = logging.getLogger(__name__)

# Configure Gemini API
if not settings.GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY must be set in environment variables")
client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Use a model that is good at following JSON format instructions
MODEL_NAME = 'gemini-2.5-flash'


def load_known_headers() -> Dict:
    """Loads the known headers from the JSON file."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(current_dir, 'known_headers.json')
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"known_headers.json not found at {os.path.basename(json_path)}")
        return {}
    except json.JSONDecodeError:
        logger.error(f"Error decoding known_headers.json at {os.path.basename(json_path)}")
        return {}


def format_prompt_for_gemini(sample_data: List[List[str]], known_headers: Dict) -> str:
    """Formats the data and known headers into a prompt for Gemini."""
    # Try to reconstruct the original lines for clarity in the prompt

    csv_sample_string = "\n".join([",".join(map(str, row)) for row in sample_data])
    # Only send key + description to Gemini (remove variants and conflictive fields)
    filtered_headers = {}
    for k, v in known_headers.items():
        filtered_headers[k] = {
            "description": v.get("description", "")
        }
    known_headers_string = json.dumps(filtered_headers, indent=2)
    total_columns = len(sample_data[0]) if sample_data else 0

    return f"""
You are an expert data analysis assistant. Your task is to analyze a sample of a delimited text file and map its columns to a predefined set of known headers based on their content.

Here are the known headers and their descriptions:
{known_headers_string}

Here is the data sample (it may or may not have a header row):
{csv_sample_string}

IMPORTANT:
- The file may use a mix of different separators between columns (for example: ',', '|', ';', etc.), and the separator sequence is the same for every row.
- Each column is separated from the next by a specific separator, and columns must NOT be merged, even if the separator is not a comma.
- Your job is to detect the exact number of columns and the separator used between each column boundary, in order, for the sample provided.
- For a row with N columns, there must be exactly N-1 column separators.
- The column_separators field must contain ONLY the actual delimiters that appear BETWEEN columns (e.g., ',', '|', ':', etc.), and must NOT include any part of the data value, label, or prefix. Do NOT include any value prefixes (such as 'Name: ' or 'Country: ') or any label that is part of the value in column_separators.
- Any label, prefix, or fixed substring that appears at the start of a value (such as 'Name: ' or 'Country: ') must be included ONLY in strip_prefixes, and NEVER in column_separators.
- WARNING: Including prefixes or labels in column_separators is incorrect and will cause errors in downstream processing.
- The strip_prefixes field should be a mapping from column index or name to the prefix string to strip from the value.
- Example (CORRECT):
  - For the row: email:password | Name: John Doe | Country: US
  - column_separators: [":", "|", "|"]
  - strip_prefixes: {{2: "Name:", 3: "Country:"}}
- Remember there can be multiple type of separators, you should watch if they are being used as separator or not, even if the column is empty, it is a column.
Please perform the following steps:
1. For each column in the sample (indexed from 0), analyze its content to understand what kind of data it represents.
2. Compare the content of each column to the descriptions of the known headers provided above.
3. If a column's content strongly matches the description of a known header, use that known header's key (e.g., 'digid_email', 'pdata_pdata_birthdate') as the new name for that column.
4. If a column's content does NOT match any known header, generate a concise, descriptive header name for it in English (e.g., 'product_id', 'user_rating'). The generated name must not be one of the known_headers keys.
5. Determine if each column requires normalization. A column requires normalization if its content appears to be one of the following types: email, date, number, or phone number.
6. Count how many columns you successfully matched to the list of known headers (how many known headers were used, e.g. 'date_joined' although is similar to diffent dates in the input json, it does not match with any, so it should not be counted)
7. Determine if the first row of the provided sample is a header row containing column titles, or if it is a data row.
8. Detect the separator used between each column in the sample and return a list called 'column_separators' in the JSON output, where each element is the separator string used between columns (e.g., [",", "|", ",", "|", ","]).
9. For each column, if all or nearly all values start with a fixed substring (such as 'Name: ' or 'Country: '), return that substring as a prefix to strip for that column in a dictionary called 'strip_prefixes', where the key is the column index and the value is the prefix string. If no prefix should be stripped, use null or an empty string for that column.
10. For each header in your output, provide:
    - a boolean is_known: true if the header matches a known header, false if it was generated by you (Gemini)
    - a brief description (maximum 10 words) of the column's content (e.g., "password in plain text", "address of the user", etc.)
    - Return this as an object called header_metadata, where each key is the header name and the value is an object with keys is_known and description.

Your final output MUST be a single JSON object with the following structure, with no extra text or explanations before or after it:
{{
  "header_mapping": {{
    "0": "new_header_for_column_0",
    "1": "new_header_for_column_1"
  }},
  "normalization_map": {{
    "new_header_for_column_0": true,
    "new_header_for_column_1": false
  }},
  "matched_columns_count": 7,
  "input_has_header": true,
  "total_columns": {total_columns},
  "column_separators": [",", "|", ",", "|", ","],
  "strip_prefixes": {{
    "2": "Name:",
    "3": "Country:"
  }},
  "header_metadata": {{
    "new_header_for_column_0": {{"is_known": true, "description": "email address of user"}},
    "new_header_for_column_1": {{"is_known": false, "description": "user rating from 1 to 5"}}
  }}
}}

Example for "normalization_map": if 'new_header_for_column_0' is 'digid_email', its value should be true. If it is 'company_name', its value should be false.

Analyze the provided data and return ONLY the JSON object.
"""


def run_gemini(sample_data: List[List[str]]) -> Tuple[Dict, str, list, int, int, int]:
    """
    Sends sample CSV data to Gemini API for analysis and header mapping.

    Args:
        sample_data: List of CSV rows (may or may not include header)

    Returns:
        Tuple[Dict, str, list, int, int, int]:
        - Dictionary containing the structured response from Gemini.
        - Error message (empty string if successful)
        - List of warnings (always empty)
        - Input token count estimate
        - Output token count
        - Total token count
    """
    warnings = []
    if not sample_data:
        return {}, "No sample data provided", warnings, 0, 0, 0

    # Define a conservative token limit to stay under the API's hard limit
    TOKEN_LIMIT = 180000 
    
    # Adaptive sampling loop
    current_sample = sample_data
    known_headers = load_known_headers()
    if not known_headers:
        return {}, "Failed to load known_headers.json", warnings, 0, 0, 0

    while True:
        if not current_sample:
            return {}, "Sample data is empty after attempting to reduce token count.", warnings, 0, 0, 0

        prompt = format_prompt_for_gemini(current_sample, known_headers)
        try:
            input_token_count_estimate = client.models.count_tokens(model=MODEL_NAME, contents=prompt).total_tokens
        except Exception as e:
            error_msg = f"Failed to estimate token count: {e}"
            logger.error(error_msg, exc_info=True)
            return {}, error_msg, warnings, 0, 0, 0

        logger.info(f"Gemini prompt input token estimate: {input_token_count_estimate} with {len(current_sample)} rows.")
        
        if input_token_count_estimate <= TOKEN_LIMIT:
            break  # The sample is within the limit

        # If over the limit, reduce the sample size and try again
        new_size = int(len(current_sample) * 0.8) # Reduce by 20%
        if new_size < 1:
            return {}, f"Cannot reduce sample size further to meet token limit of {TOKEN_LIMIT}.", warnings, 0, 0, 0
        
        logger.warning(
            f"Token estimate ({input_token_count_estimate}) exceeds limit ({TOKEN_LIMIT}). "
            f"Reducing sample from {len(current_sample)} to {new_size} rows."
        )
        # Preserve header if it exists
        header = [current_sample[0]] if current_sample else []
        rows = current_sample[1:] if len(current_sample) > 1 else []
        current_sample = header + rows[:new_size-1]

    max_retries = 2
    timeout_seconds = 180  # 3 minutes
    attempt = 0
    last_exception = None
    prompt_token_count = 0
    candidates_token_count = 0
    total_token_count = 0

    try:
        # logger.debug(f"Final Gemini prompt (using {len(current_sample)} rows): {prompt}")

        while attempt <= max_retries:
            logger.info(f"Gemini API attempt {attempt+1} of {max_retries+1}")
            start_time = time.time()
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        lambda: client.models.generate_content(model=MODEL_NAME, contents=prompt)
                    )
                    response = future.result(timeout=timeout_seconds)
                elapsed = time.time() - start_time
                logger.info(f"Gemini API call succeeded in {elapsed:.2f} seconds on attempt {attempt+1}")

                if hasattr(response, 'usage_metadata') and response.usage_metadata:
                    prompt_token_count = response.usage_metadata.prompt_token_count
                    candidates_token_count = response.usage_metadata.candidates_token_count
                else:
                    prompt_token_count = 0
                    candidates_token_count = 0
                total_token_count = prompt_token_count + candidates_token_count
                
                logger.info(f"Gemini token usage: Input={prompt_token_count}, Output={candidates_token_count}, Total={total_token_count}")
                logger.info(f"Estimate vs. Actual Input Tokens: {input_token_count_estimate} vs. {prompt_token_count}")

                if not response or not getattr(response, 'text', None):
                    logger.error("No response from Gemini API")
                    raise ValueError("No response from Gemini API")

                response_text = response.text.strip()
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1

                if json_start == -1 or json_end == 0:
                    logger.error(f"No JSON object found in Gemini response: {response_text}")
                    raise ValueError("No JSON object found in Gemini response")

                json_str = response_text[json_start:json_end]

                try:
                    gemini_result = json.loads(json_str)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse Gemini response as JSON: {json_str}. Error: {e}")
                    raise ValueError(f"Failed to parse Gemini response as JSON: {str(e)}")

                required_keys = ["header_mapping", "normalization_map", "matched_columns_count", "input_has_header", "total_columns"]
                missing_keys = [key for key in required_keys if key not in gemini_result]
                if missing_keys:
                    logger.error(f"Invalid mapping format from Gemini - missing keys: {missing_keys}. Got: {gemini_result.keys()}")
                    raise ValueError("Invalid mapping format from Gemini - missing required keys")

                if "column_separators" in gemini_result:
                    logger.info(f"Detected column separators: {gemini_result['column_separators']}")

                logger.info(f"Successfully received and parsed mapping from Gemini. {gemini_result.get('matched_columns_count')} columns matched. Total columns: {gemini_result.get('total_columns')}")
                logger.info(f"Gemini response content:\n {json.dumps(gemini_result, indent=2)}")
                return gemini_result, "", warnings, prompt_token_count, candidates_token_count, total_token_count
            except concurrent.futures.TimeoutError:
                logger.error(f"Gemini API call timed out after {timeout_seconds} seconds on attempt {attempt+1}")
                last_exception = f"Timeout after {timeout_seconds} seconds"
            except genai.errors.ClientError as e:
                if "RESOURCE_EXHAUSTED" in str(e):
                    logger.warning(f"Quota exceeded on attempt {attempt+1}. Error: {e}")
                    last_exception = e
                    retry_delay = 0

                    try:
                        # The error message from the SDK is not a clean JSON, so we find the start of the JSON blob.
                        error_str = str(e)
                        dict_start = error_str.find('{')
                        if dict_start != -1:
                            dict_str = error_str[dict_start:]
                            error_data = ast.literal_eval(dict_str)
                            details = error_data.get('error', {}).get('details', [])
                            for detail in details:
                                if detail.get('@type') == 'type.googleapis.com/google.rpc.RetryInfo':
                                    delay_str = detail.get('retryDelay', '0s')
                                    retry_delay = int(delay_str.rstrip('s'))
                                    break
                    except (SyntaxError, ValueError) as eval_e:
                        logger.warning(f"Could not parse retry delay from quota error: {eval_e}")

                    # Halve the sample size for the next attempt
                    new_size = len(current_sample) // 2
                    if new_size < 1:
                        logger.error("Cannot reduce sample size further. Aborting retry for quota error.")
                        break
                    
                    logger.warning(f"Quota error. Halving sample from {len(current_sample)} to {new_size} rows.")
                    current_sample = current_sample[:new_size]
                    prompt = format_prompt_for_gemini(current_sample, known_headers)

                    try:
                        new_token_estimate = client.models.count_tokens(model=MODEL_NAME, contents=prompt).total_tokens
                        logger.info(f"New estimated token count after halving sample: {new_token_estimate}")
                    except Exception as count_e:
                        logger.warning(f"Could not count tokens after halving sample: {count_e}")

                    if retry_delay > 0:
                        logger.info(f"Retrying after {retry_delay} seconds.")
                        time.sleep(retry_delay)
                else:
                    logger.error(f"Gemini API call failed on attempt {attempt+1} with a non-quota client error:\n{e}", exc_info=True)
                    last_exception = str(e)
                    break # Stop retrying for other client errors

            except Exception as e:
                logger.error(f"Gemini API call failed on attempt {attempt+1}:\n{e}", exc_info=True)
                last_exception = str(e)
            attempt += 1
        # All attempts failed
        logger.error(f"All {max_retries+1} attempts to call Gemini API failed. Last error: {last_exception}")
        return {}, f"Gemini API failed after {max_retries+1} attempts. Last error: {last_exception}", warnings, prompt_token_count, candidates_token_count, total_token_count
    except Exception as e:
        error_msg = f"Error querying Gemini API: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {}, str(e), warnings, 0, 0, 0