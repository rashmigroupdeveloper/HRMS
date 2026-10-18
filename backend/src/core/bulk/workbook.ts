/** Template and validation-report workbooks for bulk imports (formula-safe). */
import ExcelJS from 'exceljs';
import { formulaSafe } from './normalize.js';
import { MAX_DATA_ROWS, MAX_UPLOAD_BYTES } from './parse.js';
import type { BulkColumn, Cell, RowIssue } from './types.js';

const VALIDATED_ROWS = 2000;
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };

function safe(value: Cell | undefined): string | number | boolean {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? formulaSafe(value) : value;
}

/** exceljs supports range validations at runtime (one sqref) but does not type them. */
function rangeValidations(ws: ExcelJS.Worksheet): { add(range: string, validation: ExcelJS.DataValidation): void } {
  return (ws as unknown as { dataValidations: { add(range: string, validation: ExcelJS.DataValidation): void } }).dataValidations;
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function typeLabel(c: BulkColumn): string {
  switch (c.type) {
    case 'date': return 'Date (YYYY-MM-DD or DD-MM-YYYY)';
    case 'datetime': return 'Date + time (e.g. 16 Jun 2025 15:03:40)';
    case 'money': return 'Amount (max 2 decimals, no currency symbol needed)';
    case 'integer': return 'Whole number';
    case 'number': return 'Number';
    case 'boolean': return 'Yes / No';
    case 'enum': return `One of: ${(c.options ?? []).join(', ')}`;
    case 'string': return c.maxLength ? `Text (max ${String(c.maxLength)})` : 'Text';
  }
}

export async function buildTemplate(params: {
  title: string;
  description: string;
  columns: readonly BulkColumn[];
  instructions: readonly string[];
  samples: readonly Record<string, Cell>[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rashmi HRMS';
  wb.created = new Date();
  const data = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  const examples = wb.addWorksheet('Examples');
  const help = wb.addWorksheet('Instructions');
  const lists = wb.addWorksheet('Lists', { state: 'veryHidden' });

  data.columns = params.columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 4) }));
  examples.columns = data.columns.map((c) => ({ header: String(c.header), key: String(c.key), width: c.width ?? 14 }));
  for (const sheet of [data, examples]) {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = HEADER_FILL;
    header.alignment = { vertical: 'middle' };
  }
  params.columns.forEach((c, i) => {
    const cell = data.getRow(1).getCell(i + 1);
    cell.note = `${c.required ? 'Required. ' : 'Optional. '}${typeLabel(c)}. ${c.help}`;
  });
  for (const sample of params.samples) {
    examples.addRow(Object.fromEntries(params.columns.map((c) => [c.key, safe(sample[c.key])])));
  }

  // In-cell validation on the Data sheet (dropdowns for lists, ranges for numbers/dates).
  let listCol = 0;
  params.columns.forEach((c, i) => {
    const letter = colLetter(i);
    const range = `${letter}2:${letter}${String(VALIDATED_ROWS + 1)}`;
    let validation: ExcelJS.DataValidation | null = null;
    const options = c.type === 'boolean' ? ['Yes', 'No'] : c.type === 'enum' ? [...(c.options ?? [])] : null;
    if (options) {
      const lc = colLetter(listCol++);
      options.forEach((o, r) => { lists.getCell(`${lc}${String(r + 1)}`).value = o; });
      validation = {
        type: 'list', allowBlank: !c.required, formulae: [`Lists!$${lc}$1:$${lc}$${String(options.length)}`],
        showErrorMessage: true, errorTitle: c.header, error: `Choose a value from the list: ${options.join(', ')}`,
      };
    } else if (c.type === 'integer' || c.type === 'number' || c.type === 'money') {
      validation = {
        type: c.type === 'integer' ? 'whole' : 'decimal', operator: 'between', allowBlank: !c.required,
        formulae: [c.min ?? -1e12, c.max ?? 1e12], showErrorMessage: true, errorTitle: c.header,
        error: `${c.header} must be a number${c.min !== undefined ? ` ≥ ${String(c.min)}` : ''}${c.max !== undefined ? ` ≤ ${String(c.max)}` : ''}`,
      };
    } else if (c.type === 'string' && c.maxLength !== undefined) {
      validation = { type: 'textLength', operator: 'lessThanOrEqual', allowBlank: !c.required, formulae: [c.maxLength], showErrorMessage: true, error: `Max ${String(c.maxLength)} characters` };
    }
    if (validation) rangeValidations(data).add(range, validation);
    if (c.type === 'date') data.getColumn(i + 1).numFmt = 'yyyy-mm-dd';
    else if (c.type === 'string') data.getColumn(i + 1).numFmt = '@';
  });

  help.columns = [{ width: 28 }, { width: 14 }, { width: 44 }, { width: 70 }];
  help.addRow([params.title]).font = { bold: true, size: 14 };
  help.addRow([params.description]);
  help.addRow([]);
  const general = [
    'Fill the Data sheet: one row per record, headers exactly as given (column order does not matter).',
    'Examples are on the Examples sheet — they are NOT imported.',
    `Accepted files: .xlsx or .csv, up to ${String(MAX_UPLOAD_BYTES / 1048576)} MB and ${MAX_DATA_ROWS.toLocaleString('en-IN')} rows. Old .xls: Save As .xlsx first.`,
    'Upload shows a preview with every error and warning per row and column; nothing is saved until you confirm.',
    'Confirm saves ALL rows or NONE. Re-uploading the same file is detected and not applied twice.',
    'Dates: YYYY-MM-DD or DD-MM-YYYY (day first). Amounts: plain numbers, up to 2 decimals.',
    ...params.instructions,
  ];
  help.addRow(['How to use']).font = { bold: true };
  general.forEach((line, i) => help.addRow([`${String(i + 1)}.`, '', '', line]));
  help.addRow([]);
  const dictHeader = help.addRow(['Column', 'Required', 'Format', 'Meaning']);
  dictHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dictHeader.fill = HEADER_FILL;
  for (const c of params.columns) help.addRow([c.header, c.required ? 'Yes' : 'No', typeLabel(c), c.help]);
  help.getColumn(4).alignment = { wrapText: true, vertical: 'top' };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface ReportRow {
  rowNumber: number;
  issues: readonly RowIssue[];
  values: Readonly<Record<string, Cell>>;
}

/** Row-level validation report: one line per issue, with the row's values for context. */
export async function buildValidationReport(params: {
  title: string;
  columns: readonly BulkColumn[];
  fileIssues: readonly string[];
  rows: readonly ReportRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rashmi HRMS';
  const ws = wb.addWorksheet('Validation report', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Row', key: '__row', width: 8 },
    { header: 'Severity', key: '__sev', width: 10 },
    { header: 'Column', key: '__col', width: 22 },
    { header: 'Problem', key: '__msg', width: 60 },
    ...params.columns.map((c) => ({ header: c.header, key: c.key, width: 16 })),
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = HEADER_FILL;
  for (const issue of params.fileIssues) ws.addRow({ __row: '—', __sev: 'warning', __col: '', __msg: formulaSafe(issue) });
  let any = params.fileIssues.length > 0;
  for (const row of params.rows) {
    for (const issue of row.issues) {
      any = true;
      const added = ws.addRow({
        __row: row.rowNumber, __sev: issue.severity, __col: formulaSafe(issue.column ?? ''), __msg: formulaSafe(issue.message),
        ...Object.fromEntries(params.columns.map((c) => [c.key, safe(row.values[c.key])])),
      });
      added.getCell(2).font = { color: { argb: issue.severity === 'error' ? 'FFB00020' : 'FF8A6D00' }, bold: true };
    }
  }
  if (!any) ws.addRow({ __row: '—', __sev: 'ok', __msg: 'No problems found — every row is valid.' });
  ws.autoFilter = { from: 'A1', to: `${colLetter(3 + params.columns.length)}1` };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
