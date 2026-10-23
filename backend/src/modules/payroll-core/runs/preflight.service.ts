/**
 * REQ-012: identifiers payroll cannot invent at compute time.
 * Missing PAN, UAN, ESIC IP or bank details are listed before the run,
 * instead of surfacing only when the bank file or TDS export fails.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';

export interface IdentifierGap {
  employeeId: number;
  ecode: string;
  name: string;
  missing: string[];
}

export async function payrollIdentifierGaps(db: Kysely<Database>, companyId: number): Promise<IdentifierGap[]> {
  const rows = await db
    .selectFrom('core.employees')
    .select(['id', 'ecode', 'first_name', 'last_name', 'pan', 'uan', 'esic_ip_number', 'pf_applicable', 'esic_applicable', 'bank_account', 'bank_ifsc'])
    .where('company_id', '=', companyId)
    .where('status', 'in', ['active', 'on_notice'])
    .orderBy('ecode')
    .execute();

  const gaps: IdentifierGap[] = [];
  for (const row of rows) {
    const missing: string[] = [];
    if (row.pan === null || row.pan.trim() === '') missing.push('PAN');
    if (row.pf_applicable && (row.uan === null || row.uan.trim() === '')) missing.push('UAN');
    if (row.esic_applicable && (row.esic_ip_number === null || row.esic_ip_number.trim() === '')) missing.push('ESIC IP');
    if (row.bank_account === null || row.bank_account.trim() === '' || row.bank_ifsc === null || row.bank_ifsc.trim() === '') {
      missing.push('bank account or IFSC');
    }
    if (missing.length === 0) continue;
    gaps.push({
      employeeId: row.id,
      ecode: row.ecode,
      name: [row.first_name, row.last_name].filter((part): part is string => Boolean(part)).join(' '),
      missing,
    });
  }
  return gaps;
}
