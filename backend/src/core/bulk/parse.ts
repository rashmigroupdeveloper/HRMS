/**
 * Upload parsing: .xlsx (exceljs — maintained, no known advisories) and CSV.
 * Legacy binary .xls is refused with a "Save As .xlsx" message: the only npm
 * .xls parser (SheetJS on npm) carries unpatched prototype-pollution/ReDoS
 * advisories, and a vulnerable parser on an upload path is not acceptable.
 */
import ExcelJS from 'exceljs';
import { DomainError } from '../errors/index.js';
import type { Cell } from './types.js';

// 8 MB keeps the base64 JSON body (≈ 10.7 MB) under the 12 MB API body limit.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_DATA_ROWS = 20_000;

export interface ParsedSheet {
  name: string;
  rows: Cell[][];
}

export type UploadKind = 'xlsx' | 'csv';

function uploadKind(filename: string, bytes: Buffer): UploadKind {
  const lower = filename.toLowerCase();
  const zip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes.length > 7 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (lower.endsWith('.xls') || ole) {
    throw new DomainError('Old Excel 97-2003 (.xls) files are not accepted. Open the file in Excel and use File → Save As → Excel Workbook (.xlsx), then upload again.');
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    if (!zip) throw new DomainError('This file is not a valid .xlsx workbook. Re-save it from Excel and try again.');
    return 'xlsx';
  }
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    if (zip) throw new DomainError('This file is an Excel workbook, not CSV. Rename it to .xlsx or export it as CSV.');
    return 'csv';
  }
  throw new DomainError('Upload a .xlsx or .csv file.');
}

function cellOf(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) {
    // exceljs returns sheet dates as UTC wall-clock; keep the wall-clock text.
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
  }
  if (typeof value === 'object') {
    if ('result' in value) return cellOf((value as { result?: ExcelJS.CellValue }).result ?? null);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('error' in value) return null;
  }
  return null;
}

async function parseXlsx(bytes: Buffer): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new DomainError('The workbook could not be read. Re-save it from Excel as .xlsx and try again.');
  }
  const sheets: ParsedSheet[] = [];
  workbook.eachSheet((sheet) => {
    if (sheet.state !== 'visible') return;
    const rows: Cell[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > MAX_DATA_ROWS + 50) return;
      const cells: Cell[] = [];
      const count = Math.min(row.cellCount, 200);
      for (let c = 1; c <= count; c++) cells.push(cellOf(row.getCell(c).value));
      rows[rowNumber - 1] = cells;
    });
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
    sheets.push({ name: sheet.name, rows });
  });
  return sheets;
}

/** RFC 4180 CSV (quoted fields, embedded commas/newlines, "" escapes, BOM). */
export function parseCsv(text: string): Cell[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (quoted) {
      if (ch === '"' && src.charAt(i + 1) === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
      continue;
    }
    if (ch === '"' && cur.trim() === '') { quoted = true; cur = ''; }
    else if (ch === ',') { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src.charAt(i + 1) === '\n') i++;
      row.push(cur.trim()); rows.push(row); row = []; cur = '';
      if (rows.length > MAX_DATA_ROWS + 50) break;
    } else cur += ch;
  }
  if (quoted) throw new DomainError('The CSV has an unclosed quote. Check the file and try again.');
  if (cur !== '' || row.length > 0) { row.push(cur.trim()); rows.push(row); }
  return rows.map((r) => r.map((c) => (c === '' ? null : c)));
}

export async function parseUpload(filename: string, bytes: Buffer): Promise<ParsedSheet[]> {
  if (bytes.length === 0) throw new DomainError('The file is empty.');
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new DomainError(`The file is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is ${String(MAX_UPLOAD_BYTES / 1048576)} MB. Split it into smaller files.`);
  }
  const kind = uploadKind(filename, bytes);
  if (kind === 'xlsx') return parseXlsx(bytes);
  return [{ name: 'CSV', rows: parseCsv(bytes.toString('utf8')) }];
}
