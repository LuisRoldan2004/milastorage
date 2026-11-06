"""Export the Excel inventory into the JSON data used by the React app."""

import argparse
import json
import math
from pathlib import Path

import xlrd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "inventario03112026.xls"
DEFAULT_OUTPUT = ROOT / "src" / "data" / "products.json"


def text(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def main():
    parser = argparse.ArgumentParser(
        description="Importa productos de un archivo Excel .xls al inventario QR."
    )
    parser.add_argument("archivo", nargs="?", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--salida", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    if not args.archivo.is_file():
        parser.error(f"No se encontró el archivo: {args.archivo}")

    workbook = xlrd.open_workbook(str(args.archivo))
    sheet = workbook.sheet_by_index(0)
    headers = {
        text(sheet.cell_value(0, column)).casefold(): column
        for column in range(sheet.ncols)
    }
    for required in ("clave", "descripcion"):
        if required not in headers:
            parser.error(f"El archivo debe tener una columna '{required}'.")

    products = []
    seen = set()
    for row_index in range(1, sheet.nrows):
        raw_id = text(sheet.cell_value(row_index, headers["clave"]))
        name = text(sheet.cell_value(row_index, headers["descripcion"]))
        if not raw_id and not name:
            continue
        if not raw_id or not name:
            parser.error(f"Falta clave o descripción en la fila {row_index + 1}.")

        product_id = raw_id.zfill(6) if raw_id.isdigit() else raw_id
        if product_id in seen:
            parser.error(f"La clave '{product_id}' está repetida.")
        seen.add(product_id)

        group_name = (
            text(sheet.cell_value(row_index, headers["descripciongrupo"]))
            if "descripciongrupo" in headers
            else ""
        )
        products.append(
            {
                "id": product_id,
                "name": name,
                "category": group_name or "Sin categoría",
                "group": text(sheet.cell_value(row_index, headers["grupo"]))
                if "grupo" in headers
                else "",
                "unit": text(sheet.cell_value(row_index, headers["unidad"]))
                if "unidad" in headers
                else "",
            }
        )

    if not products:
        parser.error("No se encontraron productos en la hoja.")

    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_text(
        json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{len(products)} productos importados en {args.salida.resolve()}")


if __name__ == "__main__":
    main()
