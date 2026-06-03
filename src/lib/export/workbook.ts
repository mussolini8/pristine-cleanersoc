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

export async function exportCleanerGridReport(
  filename: string,
  monthLabel: string,
  cleaners: { cleanerName: string; weeks: { cleanings: number; amount: number }[] }[],
  rawRows?: ExportRow[]
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet: any = {};
  const merges: any[] = [];

  let maxRow = 0;

  function writeCell(ws: any, r: number, c: number, v: any, format?: string) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const type = typeof v === "number" ? "n" : "s";
    ws[cellRef] = { v, t: type };
    if (format) {
      ws[cellRef].z = format;
    }
  }

  cleaners.forEach((cleaner, i) => {
    const colGroup = i % 2;
    const rowGroup = Math.floor(i / 2);
    const startRow = rowGroup * 9;
    const startCol = colGroup * 5;

    if (startRow + 6 > maxRow) {
      maxRow = startRow + 6;
    }

    // Write Cleaner Name cell (merged across all rows)
    writeCell(worksheet, startRow, startCol, cleaner.cleanerName);
    merges.push({
      s: { r: startRow, c: startCol },
      e: { r: startRow + 6, c: startCol },
    });

    // Write Headers
    writeCell(worksheet, startRow, startCol + 1, "Week");
    writeCell(worksheet, startRow, startCol + 2, "Cleanings");
    writeCell(worksheet, startRow, startCol + 3, "Amount");

    let totalCleanings = 0;
    let totalAmount = 0;

    // Write 5 weeks
    for (let w = 0; w < 5; w++) {
      const r = startRow + 1 + w;
      const weekData = cleaner.weeks[w] ?? { cleanings: 0, amount: 0 };
      writeCell(worksheet, r, startCol + 1, w + 1);
      writeCell(worksheet, r, startCol + 2, weekData.cleanings);
      writeCell(worksheet, r, startCol + 3, weekData.amount, "$#,##0.00");
      
      totalCleanings += weekData.cleanings;
      totalAmount += weekData.amount;
    }

    // Write Totals row
    const totalRowIdx = startRow + 6;
    writeCell(worksheet, totalRowIdx, startCol + 1, "Total");
    writeCell(worksheet, totalRowIdx, startCol + 2, totalCleanings);
    writeCell(worksheet, totalRowIdx, startCol + 3, totalAmount, "$#,##0.00");
  });

  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: maxRow, c: 9 },
  });
  worksheet["!merges"] = merges;

  // Set column widths for neat spacing
  worksheet["!cols"] = [
    { wch: 15 }, // A: Cleaner Name
    { wch: 8 },  // B: Week
    { wch: 12 }, // C: Cleanings
    { wch: 14 }, // D: Amount
    { wch: 4 },  // E: spacing
    { wch: 15 }, // F: Cleaner Name
    { wch: 8 },  // G: Week
    { wch: 12 }, // H: Cleanings
    { wch: 14 }, // I: Amount
    { wch: 4 },  // J: spacing
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Overview");

  if (rawRows && rawRows.length > 0) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sanitizeRows(rawRows)), "Payments Ledger");
  }

  XLSX.writeFile(workbook, filename);
}
