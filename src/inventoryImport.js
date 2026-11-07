import * as XLSX from "@e965/xlsx";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PRODUCT_ROWS = 20000;

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function cellText(value) {
  return String(value ?? "").trim();
}

function normalizeIdentifier(value, rowNumber) {
  const identifier = cellText(value);
  if (!identifier) {
    throw new Error(`Falta la clave del producto en la fila ${rowNumber}.`);
  }
  if (identifier.length > 64 || /[\u0000-\u001f]/.test(identifier)) {
    throw new Error(`La clave de la fila ${rowNumber} no es válida.`);
  }

  if (/^\d+(?:\.0+)?$/.test(identifier)) {
    return identifier.replace(/\.0+$/, "").padStart(6, "0");
  }
  return identifier;
}

function findHeader(headers, names) {
  const acceptedNames = new Set(names);
  return headers.findIndex((header) => acceptedNames.has(normalizeHeader(header)));
}

export async function readInventoryFile(file) {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("es-MX");
  if (!["xls", "xlsx"].includes(extension)) {
    throw new Error("Selecciona un archivo de Excel con formato .xls o .xlsx.");
  }
  if (file.size === 0) {
    throw new Error("El archivo está vacío.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("El archivo excede el máximo permitido de 10 MB.");
  }

  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: false,
      dense: true,
    });
  } catch (error) {
    console.error("No fue posible leer el archivo Excel seleccionado.", error);
    throw new Error(
      "No se pudo leer el archivo. Verifica que sea un Excel válido y no esté dañado.",
    );
  }

  const sheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    return sheet && sheet["!ref"];
  });
  if (!sheetName) {
    throw new Error("El archivo no contiene una hoja con datos.");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  const headerRowIndex = rows.findIndex((row) =>
    row.some((value) => normalizeHeader(value) === "clave"),
  );
  if (headerRowIndex < 0) {
    throw new Error("No se encontró el encabezado obligatorio `clave` en la hoja.");
  }

  const headers = rows[headerRowIndex];
  const columns = {
    id: findHeader(headers, ["clave", "codigo", "codigo de barras", "identificador"]),
    name: findHeader(headers, ["descripcion", "producto", "nombre"]),
    group: findHeader(headers, ["grupo"]),
    category: findHeader(headers, ["descripciongrupo", "descripcion grupo", "categoria", "descripcion categoria"]),
    unit: findHeader(headers, ["unidad", "unidad de medida"]),
  };
  if (columns.id < 0 || columns.name < 0) {
    throw new Error(
      "La hoja debe contener las columnas `clave` y `descripcion`.",
    );
  }

  const importedProducts = [];
  const seenIds = new Set();
  const errors = [];
  let skippedRows = 0;

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rawId = cellText(row[columns.id]);
    const rawName = cellText(row[columns.name]);
    if (!rawId && !rawName) {
      skippedRows += 1;
      continue;
    }

    const rowNumber = index + 1;
    if (!rawId || !rawName) {
      errors.push(`Fila ${rowNumber}: se requiere clave y descripción.`);
      continue;
    }

    let id;
    try {
      id = normalizeIdentifier(rawId, rowNumber);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (seenIds.has(id)) {
      errors.push(`Fila ${rowNumber}: la clave ${id} aparece más de una vez.`);
      continue;
    }
    seenIds.add(id);

    importedProducts.push({
      id,
      name: rawName,
      category:
        columns.category >= 0
          ? cellText(row[columns.category]) || "Sin categoría"
          : "Sin categoría",
      group: columns.group >= 0 ? cellText(row[columns.group]) : "",
      unit: columns.unit >= 0 ? cellText(row[columns.unit]) || "Unidad" : "Unidad",
    });

    if (importedProducts.length > MAX_PRODUCT_ROWS) {
      throw new Error(
        `El archivo supera el límite de ${MAX_PRODUCT_ROWS.toLocaleString("es-MX")} productos.`,
      );
    }
  }

  if (errors.length) {
    const examples = errors.slice(0, 5).join(" ");
    const remaining = errors.length - 5;
    throw new Error(
      `No se importó ningún producto: ${examples}${remaining > 0 ? ` Y ${remaining} error(es) más.` : ""}`,
    );
  }
  if (!importedProducts.length) {
    throw new Error("No se encontraron productos debajo de los encabezados.");
  }

  return {
    products: importedProducts,
    fileName: file.name,
    sheetName,
    skippedRows,
  };
}
