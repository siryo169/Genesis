import re
import csv
import os
from collections import defaultdict
from charset_normalizer import from_path


def sql_to_csv(sql_path: str, output_dir: str):
    """
    Convierte un dump SQL en múltiples CSVs (uno por tabla).
    Detecta automáticamente los nombres de las tablas y columnas.

    Args:
        sql_path (str): Ruta al archivo .sql de entrada
        output_dir (str): Carpeta donde guardar los CSVs
    """
    os.makedirs(output_dir, exist_ok=True)

    # Detectar encoding automáticamente
    detected = from_path(sql_path).best()
    encoding = detected.encoding if detected else 'utf-8'
    print(f"[*] Detectado encoding: {encoding}")

    patron_insert = re.compile(r"INSERT INTO [`\"]?(\w+)[`\"]?", re.IGNORECASE)

    # Estructura: tabla → {"tmp": ruta temporal, "file": handle CSV, "writer": writer, "header_written": bool}
    tablas = defaultdict(dict)

    insertando = False
    bloque_insert = ''
    tabla_actual = None

    with open(sql_path, 'r', encoding=encoding, errors="replace") as f_sql:
        for linea in f_sql:
            # Detectar inicio de bloque INSERT
            m = patron_insert.match(linea.strip())
            if m:
                insertando = True
                tabla_actual = m.group(1)  # nombre de la tabla
                bloque_insert = linea.strip()

                # Inicializar CSV si es la primera vez que se ve esta tabla
                if "writer" not in tablas[tabla_actual]:
                    csv_path = os.path.join(output_dir, f"{tabla_actual}.csv")
                    tmp_csv_path = csv_path + ".uploading"
                    f_csv = open(tmp_csv_path, 'w', newline='', encoding='utf-8')
                    tablas[tabla_actual] = {
                        "csv_path": csv_path,
                        "tmp_path": tmp_csv_path,
                        "file": f_csv,
                        "writer": csv.writer(f_csv),
                        "header_written": False,
                    }
                continue

            if insertando and tabla_actual:
                bloque_insert += ' ' + linea.strip()
                if linea.strip().endswith(';'):
                    insertando = False

                    writer = tablas[tabla_actual]["writer"]

                    # Extraer nombres de columnas si aparecen
                    columnas = re.findall(
                        r'INSERT INTO [`"]?\w+[`"]?\s*\((.*?)\)\s*VALUES',
                        bloque_insert, re.IGNORECASE
                    )
                    if columnas and not tablas[tabla_actual]["header_written"]:
                        header = [c.strip(" `") for c in columnas[0].split(",")]
                        writer.writerow(header)
                        tablas[tabla_actual]["header_written"] = True

                    # Extraer tuplas ( ... )
                    tuplas = re.findall(r'\((.*?)\)', bloque_insert)
                    for t in tuplas:
                        valores = re.findall(r"(?:'([^']*)'|([^,]+))", t)
                        fila = [v[0] if v[0] else v[1].strip() for v in valores]
                        writer.writerow(fila)

                    bloque_insert = ''

    # Cerrar y renombrar todos los CSVs
    for tabla, info in tablas.items():
        info["file"].close()
        os.replace(info["tmp_path"], info["csv_path"])
        print(f"[+] CSV generado: {info['csv_path']}")
