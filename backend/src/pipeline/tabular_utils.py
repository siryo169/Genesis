import pandas as pd
from pathlib import Path


def read_excel_file(file_path: str | Path, encoding: str = None):
    """
    Reads an Excel file (.xls, .xlsx, .ods) and returns a pandas DataFrame.
    Empty cells are read as empty strings instead of NaN.
    Args:
        file_path: Path to the file
        encoding: Encoding to use for reading the file (optional, only for .xls)
    Returns:
        pd.DataFrame: The loaded data
    Raises:
        ValueError: If the file type is unsupported (by extension)
    """
    file_path = str(file_path)
    excel_exts = ('.xlsx', '.xls', '.ods')
    if file_path.lower().endswith(excel_exts):
        import pandas as pd
        # pandas.read_excel uses encoding only for .xls files, not .xlsx
        if file_path.lower().endswith('.xls') and encoding:
            return pd.read_excel(file_path, encoding=encoding, dtype=str, keep_default_na=False)
        else:
            return pd.read_excel(file_path, dtype=str, keep_default_na=False)
    else:
        raise ValueError("Unsupported file type (by extension): {}. Only .xls, .xlsx, .ods are supported for Excel reading.".format(file_path)) 