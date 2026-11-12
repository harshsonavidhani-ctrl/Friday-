import ExcelJS from "exceljs";

const NAVY = "FF121A4B";
const GOLD = "FFFBB424";

/** A neat sheet: bold navy header, frozen first row, filters, sensible widths. */
export function addTable(
  wb: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width: number; money?: boolean; hidden?: boolean }[],
  rows: Record<string, unknown>[],
) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, hidden: c.hidden }));
  ws.addRows(rows);
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  head.height = 22;
  head.alignment = { vertical: "middle" };
  columns.forEach((c, i) => {
    if (c.money) ws.getColumn(i + 1).numFmt = '"₹"#,##,##0';
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

export function highlightColumns(ws: ExcelJS.Worksheet, cols: number[]) {
  for (const c of cols) {
    const cell = ws.getRow(1).getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    cell.font = { bold: true, color: { argb: NAVY } };
  }
}

export async function xlsxResponse(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function istDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}
