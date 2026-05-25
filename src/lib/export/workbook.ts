export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportCell>;
export type ExportSheet = {
  name: string;
  rows: ExportRow[];
};

function sanitizeCell(value: ExportCell) {
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value ?? "";
}

function sanitizeRows(rows: ExportRow[]) {
  return rows.map((row) => {
    const sanitized: ExportRow = {};
    for (const [key, value] of Object.entries(row)) {
      sanitized[key] = sanitizeCell(value);
    }
    return sanitized;
  });
}

export async function exportWorkbook(filename: string, sheets: ExportSheet[]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sanitizeRows(sheet.rows)), sheet.name);
  }

  XLSX.writeFile(workbook, filename);
}

export async function exportRows(filename: string, rows: ExportRow[], sheetName = "Report") {
  await exportWorkbook(filename, [{ name: sheetName, rows }]);
}
