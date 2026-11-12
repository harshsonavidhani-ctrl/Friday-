import ExcelJS from "exceljs";

const MAX_ROWS = 5000;
const MAX_COLS = 30;

/** Reads the first sheet with data from an .xlsx or .csv file into plain text cells. */
export async function readSheet(file: File): Promise<{ rows: string[][]; sheet: string } | { error: string }> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return { rows: parseCsv(buf.toString("utf8").replace(/^﻿/, "")), sheet: file.name };
  }
  if (name.endsWith(".xls") || (buf[0] === 0xd0 && buf[1] === 0xcf)) {
    return { error: "Old .xls file — in Excel choose File → Save As → “Excel Workbook (.xlsx)”, then upload that." };
  }
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) return { error: "Please upload an Excel (.xlsx) or .csv file" };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { error: "Could not read this Excel file. Open it in Excel, Save As .xlsx, and try again." };
  }
  for (const ws of wb.worksheets) {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= MAX_ROWS) return;
      const cells: string[] = [];
      for (let c = 1; c <= Math.min(MAX_COLS, ws.columnCount || MAX_COLS); c++) cells.push(cellText(row.getCell(c)));
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      rows.push(cells);
    });
    if (rows.some((r) => r.filter(Boolean).length >= 2)) return { rows, sheet: ws.name };
  }
  return { error: "This file looks empty" };
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result != null) return String(v.result).trim();
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text).trim();
  }
  return (cell.text ?? "").trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cur.trim());
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur.trim());
      if (row.some(Boolean)) rows.push(row.slice(0, MAX_COLS));
      row = [];
      cur = "";
      if (rows.length >= MAX_ROWS) break;
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur.trim());
    if (row.some(Boolean)) rows.push(row.slice(0, MAX_COLS));
  }
  return rows;
}
