/** Build good/bad upload files (CSV, XLSX, legacy XLS) on the fly into the test output dir. */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

export function csvFile(dir: string, name: string, rows: (string | number)[][]) {
  const p = path.join(dir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(',')).join('\n') + '\n');
  return p;
}
export async function xlsxFile(dir: string, name: string, rows: (string | number)[][]) {
  const p = path.join(dir, name);
  fs.mkdirSync(dir, { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inputs');
  rows.forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(p);
  return p;
}
/** A legacy .xls (BIFF header bytes) — the app must refuse it with a clear message. */
export function xlsFile(dir: string, name: string) {
  const p = path.join(dir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]));
  return p;
}
