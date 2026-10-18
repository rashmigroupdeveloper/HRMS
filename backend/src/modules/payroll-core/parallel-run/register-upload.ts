/**
 * Vendor pay-register upload for the parallel run: .xlsx or .csv, either the
 * HRMS template columns or the client's Report 4 register as exported (title
 * rows and the Grand Total row are skipped). Returns normalised register rows
 * plus row-level issues; nothing is stored.
 */
import { DomainError } from '../../../core/errors/index.js';
import { mapUpload, normalizeHeader, parseUpload, type AlternateLayout, type BulkColumn, type Cell } from '../../../core/bulk/index.js';
import type { ProtivitiRegisterRow } from './parallel-import.js';

const MONEY: [keyof ProtivitiRegisterRow, string, string[]][] = [
  ['basicRupees', 'basic', ['basic']], ['hraRupees', 'hra', ['hra']], ['medicalAllowRupees', 'medical', ['medical allowance']],
  ['specialAllowRupees', 'special', ['special allowance']], ['educationAllowRupees', 'education', ['education allowance']],
  ['bonusAdvanceRupees', 'bonus_advance', ['bonus']], ['otherAllowancesRupees', 'other_allowances', []], ['grossRupees', 'gross', []],
  ['pfEeRupees', 'pf_ee', ['pf']], ['esicEeRupees', 'esic_ee', ['esi']], ['ptRupees', 'pt', ['prof tax', 'professional tax']], ['lwfRupees', 'lwf', []],
  ['tdsRupees', 'tds', ['income tax']], ['otherDeductionsRupees', 'other_deductions', []], ['totalDeductionsRupees', 'total_deductions', []], ['netPayRupees', 'net_pay', ['net pay']],
];

const COLUMNS: BulkColumn[] = [
  { key: 'ecode', header: 'ecode', aliases: ['employee code', 'employeeno'], type: 'string', required: true, help: '' },
  { key: 'name', header: 'name', type: 'string', required: true, help: '' },
  { key: 'department', header: 'department', type: 'string', help: '' },
  { key: 'designation', header: 'designation', type: 'string', help: '' },
  { key: 'payableDays', header: 'payable_days', aliases: ['paid days'], type: 'number', required: true, min: 0, max: 31, help: '' },
  { key: 'lopDays', header: 'lop_days', aliases: ['lop'], type: 'number', min: 0, max: 31, help: '' },
  ...MONEY.map(([key, header, aliases]): BulkColumn => ({ key, header, aliases, type: 'money', required: ['grossRupees', 'netPayRupees'].includes(key), help: '' })),
];

const R4_OTHER_EARNINGS = ['STIPEND', 'PROJECT ALLOWANCE', 'INCENTIVE', 'OTHER EARNINGS', 'GRATUITY', 'LEAVE ENCASHMENT', 'OVERTIME', 'EX-GRATIA', 'HOLD SALARY', 'Performance-Linked Earnings'];
const R4_OTHER_DEDUCTIONS = ['LOAN', 'LOAN2', 'MISCELLANEOUS RECOVERY', 'CANTEEN RECOVERY', 'GUEST HOUSE DEDUCTION', 'TRAVEL ADVANCE RECOVERY', 'NOTICE PERIOD RECOVERY'];

function n(row: Readonly<Record<string, Cell>>, header: string): number {
  const v = row[normalizeHeader(header)];
  if (v === null || v === undefined || v === '') return 0;
  const x = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(x) ? x : 0;
}

const report4: AlternateLayout = {
  name: 'Report 4 pay register',
  detect: (h) => h.includes('employeeno') && h.includes('netpay') && h.includes('paiddays'),
  map: (row) => {
    const ecode = row['employeeno'];
    if (ecode === null || ecode === undefined || String(ecode).trim() === '') return [];
    return [{
      ecode: String(ecode).trim(), name: row['name'] ?? '', department: row['department'] ?? null, designation: row['designation'] ?? null,
      payableDays: n(row, 'PAID DAYS'), lopDays: n(row, 'LOP'), basicRupees: n(row, 'BASIC'), hraRupees: n(row, 'HRA'),
      medicalAllowRupees: n(row, 'MEDICAL ALLOWANCE'), specialAllowRupees: n(row, 'SPECIAL ALLOWANCE'), educationAllowRupees: n(row, 'EDUCATION ALLOWANCE'),
      bonusAdvanceRupees: n(row, 'BONUS'), otherAllowancesRupees: R4_OTHER_EARNINGS.reduce((s, h) => s + n(row, h), 0), grossRupees: n(row, 'GROSS'),
      pfEeRupees: n(row, 'PF'), esicEeRupees: n(row, 'ESI'), ptRupees: n(row, 'PROF TAX'), lwfRupees: 0, tdsRupees: n(row, 'INCOME TAX'),
      otherDeductionsRupees: R4_OTHER_DEDUCTIONS.reduce((s, h) => s + Math.abs(n(row, h)), 0),
      totalDeductionsRupees: Math.abs(n(row, 'TOTAL DEDUCTIONS')), netPayRupees: n(row, 'NET PAY'),
    }];
  },
};

export interface RegisterUpload {
  layout: string;
  rows: ProtivitiRegisterRow[];
  issues: { rowNumber: number; column: string | null; message: string }[];
}

export async function parseRegisterUpload(filename: string, base64: string): Promise<RegisterUpload> {
  const mapped = mapUpload(await parseUpload(filename, Buffer.from(base64, 'base64')), COLUMNS, [report4]);
  const issues = mapped.rows.flatMap((r) => r.issues.filter((i) => i.severity === 'error').map((i) => ({ rowNumber: r.rowNumber, column: i.column, message: i.message })));
  if (issues.length > 0) throw new DomainError(`The register has ${String(issues.length)} problem(s): ${issues.slice(0, 5).map((i) => `row ${String(i.rowNumber)} ${i.message}`).join('; ')}`);
  const rows = mapped.rows.map((r) => {
    const v = r.values;
    const out: Record<string, unknown> = { ecode: String(v['ecode']), name: String(v['name'] ?? ''), department: v['department'] ?? null, designation: v['designation'] ?? null };
    out['payableDays'] = Number(v['payableDays'] ?? 0);
    out['lopDays'] = Number(v['lopDays'] ?? 0);
    for (const [key] of MONEY) out[key] = Number(v[key] ?? 0);
    return out as unknown as ProtivitiRegisterRow;
  });
  return { layout: mapped.layout, rows, issues };
}
