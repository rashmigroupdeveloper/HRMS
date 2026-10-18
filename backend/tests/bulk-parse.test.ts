/** Pure parsing/normalisation for bulk imports (no database). */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { coerceCell, formulaSafe, mapUpload, parseCsv, parseDate, parseDateTime, parseNumber, parseUpload, buildValidationReport } from '../src/core/bulk/index.js';
import { validateIdentity, verhoeffValid, ageOn, normalizeIdentity } from '../src/core/validation/identity.js';
import { rowsToExcelBuffer } from '../src/core/excel/workbook.js';
import { parseRegisterUpload } from '../src/modules/payroll-core/parallel-run/register-upload.js';

describe('bulk normalisation', () => {
  it('parses Indian and ISO dates, Excel serials and date-times without guessing month-first', () => {
    expect(parseDate('2026-04-30')).toBe('2026-04-30');
    expect(parseDate('30-04-2026')).toBe('2026-04-30');
    expect(parseDate('30/04/2026')).toBe('2026-04-30');
    expect(parseDate('20 Sep 2024')).toBe('2024-09-20');
    expect(parseDate('20-Sept-2024')).toBe('2024-09-20');
    expect(parseDate(45658)).toBe('2025-01-01');
    expect(parseDate('45658')).toBe('2025-01-01');
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('13/13/2026')).toBeNull();
    expect(parseDate('31 Foo 2026')).toBeNull();
    expect(parseDate(0)).toBeNull();
    expect(parseDateTime('16 Jun 2025 15:03:40')).toBe('2025-06-16 15:03:40');
    expect(parseDateTime('16-06-2025 3:03 PM')).toBe('2025-06-16 15:03:00');
    expect(parseDateTime('16-06-2025 12:10 am')).toBe('2025-06-16 00:10:00');
    expect(parseDateTime('2025-06-16T09:00:00')).toBe('2025-06-16 09:00:00');
    expect(parseDateTime(45658.5)).toBe('2025-01-01 12:00:00');
    expect(parseDateTime('16-06-2025')).toBeNull();
    expect(parseDateTime('16-06-2025 25:00')).toBeNull();
    expect(parseDateTime('xx 10:00')).toBeNull();
    expect(parseDateTime(-1)).toBeNull();
  });

  it('parses amounts with Indian grouping, currency and accounting negatives', () => {
    expect(parseNumber('1,23,456.50')).toBe(123456.5);
    expect(parseNumber('₹ 500')).toBe(500);
    expect(parseNumber('Rs. 75')).toBe(75);
    expect(parseNumber('(250)')).toBe(-250);
    expect(parseNumber('')).toBeNull();
    expect(Number.isNaN(parseNumber('12abc'))).toBe(true);
  });

  it('guards formula injection on export but keeps phone numbers and negatives', async () => {
    expect(formulaSafe('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(formulaSafe('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(formulaSafe('+91 98765 43210')).toBe('+91 98765 43210');
    expect(formulaSafe('-250')).toBe('-250');
    expect(formulaSafe('plain')).toBe('plain');
    const buf = await rowsToExcelBuffer('S', [{ header: 'Name', key: 'n' }, { header: 'Obj', key: 'o' }], [{ n: '=cmd|"/c calc"!A1', o: { a: 1 } }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets[0]?.getRow(2).getCell(1).value).toBe(`'=cmd|"/c calc"!A1`);
    const rep = await buildValidationReport({ title: 't', columns: [{ key: 'a', header: 'A', type: 'string', help: '' }], fileIssues: ['=bad'], rows: [{ rowNumber: 2, issues: [{ column: 'A', severity: 'error', message: '@x' }], values: { a: '=1+1' } }] });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(rep as unknown as ArrayBuffer);
    const values: unknown[] = [];
    wb2.worksheets[0]?.eachRow((r) => { r.eachCell((c) => values.push(c.value)); });
    expect(values).toContain(`'=bad`);
    expect(values).toContain(`'=1+1`);
    expect(values).not.toContain('=1+1');
    const empty = await buildValidationReport({ title: 't', columns: [], fileIssues: [], rows: [] });
    expect(empty.length).toBeGreaterThan(100);
  });

  it('parses RFC 4180 CSV (quotes, embedded newlines, BOM) and rejects unclosed quotes', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","multi\nline"\n"say ""hi""",\n')).toEqual([['a', 'b'], ['x, y', 'multi\nline'], ['say "hi"', null]]);
    expect(() => parseCsv('a,"b\n')).toThrow(/unclosed/);
  });

  it('coerces cells per column type', () => {
    const col = (type: 'integer' | 'boolean' | 'enum' | 'string' | 'number', extra = {}) => ({ key: 'k', header: 'K', type, help: '', ...extra });
    expect(coerceCell(col('integer'), '3.5').issue?.message).toMatch(/whole/);
    expect(coerceCell(col('number', { min: 1 }), 0).issue?.message).toMatch(/at least/);
    expect(coerceCell(col('number', { max: 1 }), 5).issue?.message).toMatch(/at most/);
    expect(coerceCell(col('number', { required: true }), '-').issue?.message).toMatch(/required/);
    expect(coerceCell(col('number'), true).issue).toBeDefined();
    expect(coerceCell(col('boolean'), 'Y').value).toBe(true);
    expect(coerceCell(col('boolean'), 'no').value).toBe(false);
    expect(coerceCell(col('boolean'), false).value).toBe(false);
    expect(coerceCell(col('boolean'), 'maybe').issue).toBeDefined();
    expect(coerceCell(col('enum', { options: ['IN', 'OUT'] }), 'in').value).toBe('IN');
    expect(coerceCell(col('enum', { options: ['IN'] }), 'x').issue).toBeDefined();
    expect(coerceCell(col('string', { maxLength: 2 }), 'abc').issue).toBeDefined();
    expect(coerceCell(col('string'), '=SUM(A1)').issue?.message).toMatch(/formula/);
    expect(coerceCell({ key: 'd', header: 'D', type: 'date', help: '' }, true).issue).toBeDefined();
    expect(coerceCell({ key: 'd', header: 'D', type: 'datetime', help: '' }, false).issue).toBeDefined();
  });

  it('maps headers anywhere in the first rows, reports ignored columns, enforces row limits', () => {
    const columns = [{ key: 'ecode', header: 'Employee code', aliases: ['emp id'], type: 'string' as const, required: true, help: '' }];
    const mapped = mapUpload([{ name: 'Instructions', rows: [['Employee code'], ['IGNORED']] }, { name: 'Data', rows: [['Title'], [], ['Emp ID', 'Extra'], ['A1', 'x'], ['Total', ''], [null, null]] }], columns);
    expect(mapped.sheet).toBe('Data');
    expect(mapped.headerRow).toBe(3);
    expect(mapped.ignoredColumns).toEqual(['Extra']);
    expect(mapped.rows.map((r) => r.values['ecode'])).toEqual(['A1']);
    expect(() => mapUpload([{ name: 'S', rows: [['nothing']] }], columns)).toThrow(/No header row/);
    const many = [['Employee code'], ...Array.from({ length: 20_001 }, (_, i) => [`E${String(i)}`])];
    expect(() => mapUpload([{ name: 'S', rows: many }], columns)).toThrow(/more than/);
  });

  it('reads xlsx cells (formulas, rich text, dates) and refuses bad workbooks', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(['Employee code', 'When', 'Amt']);
    ws.addRow([{ richText: [{ text: 'RML' }, { text: '1' }] }, new Date(Date.UTC(2026, 3, 30)), { formula: '1+1', result: 2 }]);
    ws.addRow([{ text: 'L', hyperlink: 'https://x' }, new Date(Date.UTC(2026, 3, 30, 9, 5, 0)), { error: '#REF!' }]);
    wb.addWorksheet('Hidden', { state: 'hidden' }).addRow(['x']);
    const sheets = await parseUpload('f.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.rows[1]).toEqual(['RML1', '2026-04-30', 2]);
    expect(sheets[0]?.rows[2]).toEqual(['L', '2026-04-30 09:05:00', null]);
    await expect(parseUpload('f.xlsx', Buffer.from('PK\u0003\u0004garbage'))).rejects.toThrow(/could not be read/);
    await expect(parseUpload('f.xlsx', Buffer.from('not zip'))).rejects.toThrow(/not a valid/);
    await expect(parseUpload('f.csv', Buffer.from('PK\u0003\u0004'))).rejects.toThrow(/Excel workbook/);
    await expect(parseUpload('f.csv', Buffer.alloc(0))).rejects.toThrow(/empty/);
  });
});

describe('identity validators (country-pluggable)', () => {
  it('validates Indian PAN, Aadhaar (Verhoeff), UAN, ESIC, IFSC, account, mobile, PIN', () => {
    expect(verhoeffValid('234567890124')).toBe(true);
    expect(verhoeffValid('234567890123')).toBe(false);
    expect(validateIdentity('IN', 'pan', 'abcpg1234k')).toBeNull();
    expect(validateIdentity('IN', 'pan', 'ABCDE1234F')).toMatch(/4th letter/);
    expect(validateIdentity('IN', 'pan', 'AB12')).toMatch(/ABCDE1234F/);
    expect(validateIdentity('IN', 'aadhaar', '2345 6789 0124')).toBeNull();
    expect(validateIdentity('IN', 'aadhaar', '234567890123')).toMatch(/checksum/);
    expect(validateIdentity('IN', 'aadhaar', '123456789012')).toMatch(/12 digits/);
    expect(validateIdentity('IN', 'uan', '1002003004')).toMatch(/12/);
    expect(validateIdentity('IN', 'esic', '1234567890')).toBeNull();
    expect(validateIdentity('IN', 'ifsc', 'HDFC0009686')).toBeNull();
    expect(validateIdentity('IN', 'bank_account', '12ab')).toMatch(/9–18/);
    expect(validateIdentity('IN', 'mobile', '+91 98765-43210')).toBeNull();
    expect(validateIdentity('IN', 'pincode', '721301')).toBeNull();
    expect(normalizeIdentity('mobile', '+91 98765 43210')).toBe('9876543210');
  });
  it('falls back to generic rules for other countries', () => {
    expect(validateIdentity('GB', 'ifsc', 'NWBKGB2L')).toBeNull();
    expect(validateIdentity('AE', 'bank_account', 'AE070331234567890123456')).toBeNull();
    expect(validateIdentity('GB', 'mobile', '+447911123456')).toBeNull();
    expect(validateIdentity('GB', 'pan', '!')).toMatch(/Tax ID/);
    for (const f of ['aadhaar', 'uan', 'esic', 'pincode'] as const) expect(validateIdentity('TZ', f, '!')).not.toBeNull();
    expect(ageOn('2000-06-15', '2018-06-14')).toBe(17);
    expect(ageOn('2000-06-15', '2018-06-15')).toBe(18);
  });
});

describe('parallel-run register upload', () => {
  it('reads a Report 4 register (xlsx) and the template CSV into identical rows', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report 4');
    const head = ['Sl No', 'EmployeeNo', 'Name', 'Department', 'Designation', 'MONH DAYS', 'LOP', 'PAID DAYS', 'BASIC', 'STIPEND', 'HRA', 'EDUCATION ALLOWANCE', 'MEDICAL ALLOWANCE', 'BONUS', 'SPECIAL ALLOWANCE', 'INCENTIVE', 'GROSS', 'PF', 'ESI', 'PROF TAX', 'INCOME TAX', 'LOAN', 'CANTEEN RECOVERY', 'TOTAL DEDUCTIONS', 'NET PAY'];
    ws.addRow(head);
    ws.addRow([1, 'RML033625', 'Prateek Kumar Singh', 'ERP-CELL', 'JGE', 30, 0, 30, 32286, 0, 16143, 200, 1250, 2689, 12005, 0, 64573, 3874, 0, 200, 0, 0, 1375, -5449, 59124]);
    ws.addRow([null, null, null, null, null, null, null, 'Grand Total', 32286, null, 16143, 200, 1250, 2689, 12005, null, 64573, 3874, null, 200, null, null, 1375, -5449, 59124]);
    const r4 = await parseRegisterUpload('Report4.xlsx', Buffer.from(await wb.xlsx.writeBuffer()).toString('base64'));
    expect(r4.layout).toBe('Report 4 pay register');
    expect(r4.rows).toHaveLength(1);
    expect(r4.rows[0]).toMatchObject({ ecode: 'RML033625', payableDays: 30, grossRupees: 64573, pfEeRupees: 3874, ptRupees: 200, otherDeductionsRupees: 1375, totalDeductionsRupees: 5449, netPayRupees: 59124 });
    const csvText = 'ecode,name,payable_days,lop_days,basic,hra,medical,special,education,bonus_advance,other_allowances,gross,pf_ee,esic_ee,pt,lwf,tds,other_deductions,total_deductions,net_pay\nRML033625,Prateek Kumar Singh,30,0,32286,16143,1250,12005,200,2689,0,64573,3874,0,200,0,0,1375,5449,59124\n';
    const tpl = await parseRegisterUpload('vendor.csv', Buffer.from(csvText).toString('base64'));
    expect(tpl.layout).toBe('standard');
    expect(tpl.rows[0]).toMatchObject({ ...r4.rows[0], department: null, designation: null });
    await expect(parseRegisterUpload('bad.csv', Buffer.from('ecode,name,payable_days,gross,net_pay\nX,Y,40,abc,1\n').toString('base64'))).rejects.toThrow(/problem/);
  });
});
