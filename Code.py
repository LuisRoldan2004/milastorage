"""Create ticket-sized PDF labels with QR codes from an Excel inventory."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import qrcode
import xlrd
from reportlab.lib import colors
from reportlab.lib.pagesizes import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas


DEFAULT_INVENTORY = "inventario03112026.xls"
DEFAULT_OUTPUT = "inventario_etiquetas_qr.pdf"
PAGE_WIDTH = 80 * mm
PAGE_HEIGHT = 297 * mm
LABELS_PER_PAGE = 4
LABEL_HEIGHT = PAGE_HEIGHT / LABELS_PER_PAGE
QR_SIZE = 94


def cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def identifier_text(value: object) -> str:
    identifier = cell_text(value)
    if identifier.isdigit():
        return identifier.zfill(6)
    return identifier


def read_inventory(path: Path, sheet_name: str | None) -> list[dict[str, str]]:
    workbook = xlrd.open_workbook(str(path))
    if sheet_name:
        try:
            sheet = workbook.sheet_by_name(sheet_name)
        except xlrd.biffh.XLRDError as exc:
            raise ValueError(f"No existe la hoja '{sheet_name}' en {path.name}.") from exc
    else:
        sheet = workbook.sheet_by_index(0)

    headers = {
        cell_text(sheet.cell_value(0, column)).casefold(): column
        for column in range(sheet.ncols)
    }
    if "clave" not in headers or "descripcion" not in headers:
        raise ValueError("El inventario debe incluir las columnas 'clave' y 'descripcion'.")

    records = []
    for row_index in range(1, sheet.nrows):
        identifier = identifier_text(sheet.cell_value(row_index, headers["clave"]))
        description = cell_text(sheet.cell_value(row_index, headers["descripcion"]))
        if not identifier and not description:
            continue
        if not identifier or not description:
            raise ValueError(
                f"Falta clave o descripción en la fila {row_index + 1} de la hoja."
            )
        records.append(
            {
                "clave": identifier,
                "descripcion": description,
                "grupo": cell_text(sheet.cell_value(row_index, headers["grupo"]))
                if "grupo" in headers
                else "",
                "unidad": cell_text(sheet.cell_value(row_index, headers["unidad"]))
                if "unidad" in headers
                else "",
            }
        )

    if not records:
        raise ValueError("No se encontraron artículos para generar etiquetas.")
    return records


def draw_label(
    pdf: canvas.Canvas, record: dict[str, str], label_index: int
) -> None:
    top = PAGE_HEIGHT - label_index * LABEL_HEIGHT
    left = 6 * mm
    right = PAGE_WIDTH - 6 * mm
    center = PAGE_WIDTH / 2
    cursor = top - 8

    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(center, cursor - 8, "ETIQUETA DE INVENTARIO")
    cursor -= 19

    pdf.setFont("Helvetica-Bold", 9)
    description_lines = simpleSplit(record["descripcion"], "Helvetica-Bold", 9, right - left)
    for line in description_lines:
        pdf.drawCentredString(center, cursor - 9, line)
        cursor -= 10
    cursor -= 4

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(record["clave"])
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_y = cursor - QR_SIZE
    pdf.drawImage(
        ImageReader(qr_image),
        center - QR_SIZE / 2,
        qr_y,
        width=QR_SIZE,
        height=QR_SIZE,
        preserveAspectRatio=True,
        mask="auto",
    )

    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(center, qr_y - 15, record["clave"])

    details = "  |  ".join(
        value for value in (record["grupo"], record["unidad"]) if value
    )
    if details:
        pdf.setFont("Helvetica", 7)
        pdf.drawCentredString(center, qr_y - 26, details[:48])

    if label_index < LABELS_PER_PAGE - 1:
        pdf.setStrokeColor(colors.lightgrey)
        pdf.setDash(2, 2)
        pdf.line(left, top - LABEL_HEIGHT, right, top - LABEL_HEIGHT)
        pdf.setDash()


def create_pdf(records: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output_path), pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    pdf.setTitle("Etiquetas QR de inventario")
    pdf.setAuthor("Generador de etiquetas de inventario")

    for start in range(0, len(records), LABELS_PER_PAGE):
        page_records = records[start : start + LABELS_PER_PAGE]
        for label_index, record in enumerate(page_records):
            draw_label(pdf, record, label_index)
        pdf.showPage()

    pdf.save()


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Genera etiquetas QR en PDF con formato de rollo de tienda."
    )
    parser.add_argument(
        "inventario",
        nargs="?",
        type=Path,
        default=script_dir / DEFAULT_INVENTORY,
        help=f"Archivo .xls (predeterminado: {DEFAULT_INVENTORY})",
    )
    parser.add_argument(
        "-o",
        "--salida",
        type=Path,
        default=script_dir / DEFAULT_OUTPUT,
        help=f"PDF de salida (predeterminado: {DEFAULT_OUTPUT})",
    )
    parser.add_argument("--hoja", help="Nombre de la hoja de Excel; por defecto usa la primera.")
    args = parser.parse_args()

    if not args.inventario.is_file():
        parser.error(f"No se encontró el archivo de inventario: {args.inventario}")
    records = read_inventory(args.inventario, args.hoja)
    create_pdf(records, args.salida)
    page_count = math.ceil(len(records) / LABELS_PER_PAGE)
    print(f"PDF generado: {args.salida.resolve()}")
    print(f"Artículos: {len(records)} | Páginas: {page_count} | Formato: 80 x 297 mm")


if __name__ == "__main__":
    main()