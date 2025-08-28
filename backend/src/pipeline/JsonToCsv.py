import json
from pathlib import Path
import sys
import pandas as pd
from charset_normalizer import from_path

def aplana(input: Path, output: Path):
    # Detectar codificación automáticamente
    detected = from_path(input).best()
    encoding = detected.encoding if detected else 'utf-8'
    json_data = []

    with open(input, "r", encoding=encoding, errors="replace") as json_file:
        contenido = json_file.read().strip()
        try:
            json_data = json.loads(contenido.replace('\\n', ' '))
            if isinstance(json_data, dict) and len(json_data.keys()) == 1:
                    first_key = next(iter(json_data))
                    if isinstance(json_data[first_key], list):
                        json_data = json_data[first_key]
        except json.JSONDecodeError:
            json_file.seek(0)
            for i, line in enumerate(json_file, 1):
                line = line.strip()
                try:
                    json_data.append(json.loads(line.replace('\\n', ' ')))
                except json.JSONDecodeError:
                    fragments = line.replace('}{', '}#{').split('#')
                    for frag in fragments:
                        frag = frag.strip()
                        if frag:
                            try:
                                json_data.append(json.loads(frag.replace('\\n', ' ')))
                            except json.JSONDecodeError as e:
                                print(f"[!] No se pudo parsear fragmento en línea {i}: {e}")
    df = pd.json_normalize(json_data, sep="_")
    for col in df.columns:
        if df[col].apply(lambda x: isinstance(x, list)).any():
            # Expandir filas para esa columna
            df = df.explode(col, ignore_index=True)

            # Si son diccionarios, expandirlos en columnas nuevas
            mask = df[col].apply(lambda x: isinstance(x, dict))
            if mask.any():
                expanded = pd.json_normalize(df.loc[mask, col]).add_prefix(f"{col}_")
                df = df.join(expanded)
            df = df.drop(columns=[col])
    df.to_csv(output, index=False, encoding="utf-8-sig")



def main():
    if len(sys.argv) != 3:
        print("Usage: python JsonToCsv.py <input_json_file> <output_csv_file>")
        sys.exit(1)

    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])
    aplana(input_file, output_file)

if __name__ == "__main__":
    main()