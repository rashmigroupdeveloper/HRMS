/**
 * Sheet → importer rows: finds the header row (anywhere in the first 20 rows
 * of any visible sheet, so reports with title rows like Report 4 work), maps
 * headers by name/alias in any order, coerces types and records row/column
 * issues. Nothing is silently dropped: unknown columns are reported.
 */
import { DomainError } from '../errors/index.js';
import { isFormulaLike, normalizeHeader, parseDate, parseDateTime, parseNumber } from './normalize.js';
import { MAX_DATA_ROWS, type ParsedSheet } from './parse.js';
import type { AlternateLayout, BulkColumn, BulkRow, Cell, RowIssue } from './types.js';

export interface MappedUpload {
  sheet: string;
  layout: string;
  headerRow: number;
  ignoredColumns: string[];
  rows: BulkRow[];
}

/** A layout may attach a warning to a mapped row under this key. */
export const LAYOUT_WARNING = '__warning';

const SKIP_SHEETS = /^(instructions?|readme|examples?|lists?|_lists)$/i;
const TOTAL_ROW = /^(grand\s*total|sub\s*total|total)s?:?$/i;

function columnNames(col: BulkColumn): string[] {
  return [col.key, col.header, ...(col.aliases ?? [])].map(normalizeHeader);
}

function cellText(cell: Cell): string {
  return cell === null ? '' : String(cell).trim();
}

export function coerceCell(col: BulkColumn, raw: Cell): { value: Cell; issue?: RowIssue } {
  const fail = (message: string) => ({ value: null, issue: { column: col.header, severity: 'error' as const, message } });
  if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return col.required ? fail(`${col.header} is required`) : { value: null };
  }
  switch (col.type) {
    case 'string': {
      const s = String(raw).trim();
      if (col.maxLength !== undefined && s.length > col.maxLength) return fail(`${col.header} is longer than ${String(col.maxLength)} characters`);
      if (isFormulaLike(s) && !/^[+-]?[\d\s().]+$/.test(s)) return fail(`${col.header} must not start with = + - @ (spreadsheet formula)`);
      return { value: s };
    }
    case 'integer':
    case 'number':
    case 'money': {
      const n = typeof raw === 'boolean' ? Number.NaN : parseNumber(raw);
      if (n === null) return col.required ? fail(`${col.header} is required`) : { value: null };
      if (!Number.isFinite(n)) return fail(`${col.header} must be a number (got "${String(raw)}")`);
      if (col.type === 'integer' && !Number.isInteger(n)) return fail(`${col.header} must be a whole number`);
      if (col.type === 'money' && Math.round(n * 100) !== Math.round(n * 1e6) / 1e4) return fail(`${col.header} can have at most 2 decimals`);
      if (col.min !== undefined && n < col.min) return fail(`${col.header} must be at least ${String(col.min)}`);
      if (col.max !== undefined && n > col.max) return fail(`${col.header} must be at most ${String(col.max)}`);
      return { value: col.type === 'money' ? Math.round(n * 100) / 100 : n };
    }
    case 'date': {
      const d = typeof raw === 'boolean' ? null : parseDate(raw);
      return d === null ? fail(`${col.header} must be a date like 2026-04-30 or 30-04-2026 (got "${String(raw)}")`) : { value: d };
    }
    case 'datetime': {
      const d = typeof raw === 'boolean' ? null : parseDateTime(raw);
      return d === null ? fail(`${col.header} must be a date and time like 16 Jun 2025 15:03:40 (got "${String(raw)}")`) : { value: d };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { value: raw };
      const s = String(raw).trim().toLowerCase();
      if (['yes', 'y', 'true', '1'].includes(s)) return { value: true };
      if (['no', 'n', 'false', '0'].includes(s)) return { value: false };
      return fail(`${col.header} must be Yes or No`);
    }
    case 'enum': {
      const s = String(raw).trim();
      const hit = (col.options ?? []).find((o) => o.toLowerCase() === s.toLowerCase());
      return hit === undefined ? fail(`${col.header} must be one of: ${(col.options ?? []).join(', ')} (got "${s}")`) : { value: hit };
    }
  }
}

interface Candidate { sheet: ParsedSheet; headerIndex: number; score: number; layout: AlternateLayout | null }

export function mapUpload(
  sheets: readonly ParsedSheet[],
  columns: readonly BulkColumn[],
  layouts: readonly AlternateLayout[] = [],
): MappedUpload {
  let best: Candidate | null = null;
  for (const sheet of sheets) {
    if (SKIP_SHEETS.test(sheet.name.trim())) continue;
    for (let i = 0; i < Math.min(20, sheet.rows.length); i++) {
      const headers = (sheet.rows[i] ?? []).map(normalizeHeader);
      const layout = layouts.find((l) => l.detect(headers)) ?? null;
      const score = layout ? 1000 : columns.filter((c) => columnNames(c).some((n) => headers.includes(n))).length;
      if (score > 0 && (best === null || score > best.score)) best = { sheet, headerIndex: i, score, layout };
    }
  }
  if (best === null) {
    throw new DomainError(`No header row found. The first row must contain the column names: ${columns.map((c) => c.header).join(', ')}. Download the template to see the layout.`);
  }
  const { sheet, headerIndex, layout } = best;
  const headerCells = (sheet.rows[headerIndex] ?? []).map((h) => cellText(h));
  const normalized = headerCells.map(normalizeHeader);

  const colIndex = new Map<string, number>();
  const ignored: string[] = [];
  if (!layout) {
    const missing = columns.filter((c) => c.required && !columnNames(c).some((n) => normalized.includes(n)));
    if (missing.length > 0) {
      throw new DomainError(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.map((c) => c.header).join(', ')}. Download the template to see the expected headers.`);
    }
    for (const c of columns) {
      const idx = normalized.findIndex((n) => n !== '' && columnNames(c).includes(n));
      if (idx >= 0) colIndex.set(c.key, idx);
    }
    const used = new Set(colIndex.values());
    headerCells.forEach((h, i) => { if (h !== '' && !used.has(i)) ignored.push(h); });
  }

  const rows: BulkRow[] = [];
  let dataRows = 0;
  for (let r = headerIndex + 1; r < sheet.rows.length; r++) {
    const cells = sheet.rows[r] ?? [];
    if (cells.every((c) => cellText(c) === '')) continue;
    if (cells.some((c) => typeof c === 'string' && TOTAL_ROW.test(c.trim()))) continue;
    dataRows++;
    if (dataRows > MAX_DATA_ROWS) {
      throw new DomainError(`The file has more than ${MAX_DATA_ROWS.toLocaleString('en-IN')} data rows. Split it into smaller files.`);
    }
    const sources: Record<string, Cell>[] = [];
    if (layout) {
      const byHeader: Record<string, Cell> = {};
      normalized.forEach((h, i) => { if (h !== '' && !(h in byHeader)) byHeader[h] = cells[i] ?? null; });
      sources.push(...layout.map(byHeader));
    } else {
      sources.push(Object.fromEntries(columns.map((c) => {
        const idx = colIndex.get(c.key);
        return [c.key, idx === undefined ? null : (cells[idx] ?? null)];
      })));
    }
    for (const source of sources) {
      const values: Record<string, Cell> = {};
      const issues: RowIssue[] = [];
      const note = source[LAYOUT_WARNING];
      if (typeof note === 'string' && note !== '') issues.push({ column: null, severity: 'warning', message: note });
      for (const c of columns) {
        const { value, issue } = coerceCell(c, source[c.key] ?? null);
        values[c.key] = value;
        if (issue) issues.push(issue);
      }
      rows.push({ rowNumber: r + 1, values, issues });
    }
  }
  if (rows.length === 0) throw new DomainError('The file has a header row but no data rows.');
  return { sheet: sheet.name, layout: layout?.name ?? 'standard', headerRow: headerIndex + 1, ignoredColumns: ignored, rows };
}
