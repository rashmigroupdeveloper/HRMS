/**
 * Shared Excel workbook builder (RPT-06).
 *
 * Lives in `core` because every module that has a list worth reading has a
 * list worth exporting — reports, assets, the audit trail, policy
 * acknowledgement. Keeping it in one module would have forced either a deep
 * cross-module import (CI-blocked) or a copy per module, and a copied exporter
 * is how "the Excel doesn't match the screen" starts.
 *
 * The contract that makes exports trustworthy: list endpoints and export
 * endpoints call the SAME row function, so what you see is what finance gets
 * (docs/06 preamble).
 */
import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

function cellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  return JSON.stringify(value);
}

/** Build a single-sheet xlsx from already-filtered rows. */
export async function rowsToExcelBuffer(
  sheetName: string,
  columns: ExcelColumn[],
  rows: object[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rashmi HRMS';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14 }));
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const flattened: Record<string, string | number | boolean> = {};
    for (const col of columns) {
      flattened[col.key] = cellValue(record[col.key]);
    }
    ws.addRow(flattened);
  }
  if (rows.length === 0) {
    ws.addRow(Object.fromEntries(columns.map((c) => [c.key, c.key === columns[0]?.key ? '—' : ''])));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
