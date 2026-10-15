/**
 * SAP Journal Voucher (JV) Service (PAY-05, R9, SOW crosswalk).
 *
 * Emits financial accounting journal entries aggregated by GL account code
 * (from pay.gl_accounts mapping) and cost-center.
 *
 * Strict financial invariant:
 *   Total Debits == Total Credits == Total Cost to Company (CTC).
 */

import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { createDocument } from '../../../core/storage/index.js';

export interface SapJvLine {
  glCode: string;
  glDescription: string;
  costCenterCode: string;
  costCenterName: string;
  debitRupees: number;
  creditRupees: number;
  componentCode: string;
  postingType: 'DEBIT' | 'CREDIT';
}

export interface SapJvReport {
  runId: number;
  companyName: string;
  month: string;
  documentId: number;
  totalDebitsRupees: number;
  totalCreditsRupees: number;
  totalCtcRupees: number;
  isBalanced: boolean;
  lines: SapJvLine[];
  csvContent: string;
}

const DEFAULT_GL_MAP: Record<string, { code: string; desc: string }> = {
  // Expense Debits
  BASIC: { code: '510010', desc: 'Salaries - Basic Pay' },
  HRA: { code: '510020', desc: 'Salaries - House Rent Allowance' },
  DA: { code: '510030', desc: 'Salaries - Dearness Allowance' },
  SPECIAL: { code: '510040', desc: 'Salaries - Special Allowance' },
  MEDICAL: { code: '510050', desc: 'Salaries - Medical Allowance' },
  OT_PAY: { code: '510060', desc: 'Salaries - Overtime Wages' },
  PF_ER: { code: '520010', desc: 'Staff Welfare - Employer PF' },
  ESIC_ER: { code: '520020', desc: 'Staff Welfare - Employer ESIC' },
  LWF_ER: { code: '520030', desc: 'Staff Welfare - Employer LWF' },
  DEFAULT_EARNING: { code: '510090', desc: 'Salaries - Other Allowances' },

  // Liability Credits
  PF_EE: { code: '210010', desc: 'Provident Fund Payable - Employee' },
  ESIC_EE: { code: '210020', desc: 'ESIC Payable - Employee' },
  PT: { code: '210030', desc: 'Professional Tax Payable' },
  TDS: { code: '210040', desc: 'TDS Payable u/s 192' },
  LWF_EE: { code: '210050', desc: 'Labour Welfare Fund Payable' },
  DEFAULT_DEDUCTION: { code: '210090', desc: 'Other Deductions Payable' },
  PF_ER_PAYABLE: { code: '210015', desc: 'Provident Fund Payable - Employer' },
  ESIC_ER_PAYABLE: { code: '210025', desc: 'ESIC Payable - Employer' },
  NET_SALARY: { code: '210000', desc: 'Salaries Payable / Bank Clearing' },
};

export class SapJvService {
  constructor(private readonly db: Kysely<Database>) {}

  async generateSapJv(runId: number, actorUserId: number): Promise<SapJvReport> {
    // 1. Fetch Run & Company
    const run = await this.db
      .selectFrom('pay.payroll_runs as r')
      .innerJoin('core.companies as c', 'c.id', 'r.company_id')
      .select(['r.id', 'r.month', 'c.name as company_name'])
      .where('r.id', '=', runId)
      .executeTakeFirst();

    if (!run) {
      throw new Error(`Payroll run #${String(runId)} not found.`);
    }

    const monthStr = new Date(run.month).toISOString().slice(0, 7);

    // 2. Fetch configured GL mapping overrides from pay.gl_accounts
    const glMappings = await this.db
      .selectFrom('pay.gl_accounts')
      .selectAll()
      .execute();

    const glMap = new Map<string, { code: string; desc: string }>();
    for (const m of glMappings) {
      glMap.set(m.component_code, {
        code: m.gl_code,
        desc: m.component_code,
      });
    }

    // 3. Fetch all payroll items and item lines joined with employee cost center
    const itemLines = await this.db
      .selectFrom('pay.payroll_item_lines as l')
      .innerJoin('pay.payroll_items as it', 'it.id', 'l.item_id')
      .innerJoin('core.employees as e', 'e.id', 'it.employee_id')
      .innerJoin('pay.salary_components as sc', 'sc.code', 'l.component_code')
      .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
      .select([
        'l.component_code',
        'l.amount',
        'sc.kind',
        'sc.name as comp_name',
        'cc.code as cost_center_code',
        'cc.name as cost_center_name',
      ])
      .where('it.run_id', '=', runId)
      .execute();

    const items = await this.db
      .selectFrom('pay.payroll_items as it')
      .innerJoin('core.employees as e', 'e.id', 'it.employee_id')
      .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
      .select([
        'it.net_pay',
        'cc.code as cost_center_code',
        'cc.name as cost_center_name',
      ])
      .where('it.run_id', '=', runId)
      .execute();

    const jvLines: SapJvLine[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    // A. DEBITS: Earnings (Gross salary expense by component and cost center)
    // Aggregation key: `${costCenterCode}_${componentCode}_DEBIT`
    const debitMap = new Map<string, { compCode: string; name: string; ccCode: string; ccName: string; amt: number }>();
    const creditMap = new Map<string, { compCode: string; name: string; ccCode: string; ccName: string; amt: number }>();

    for (const line of itemLines) {
      const amt = Number(line.amount);
      if (amt <= 0) continue;

      const ccCode = line.cost_center_code ?? 'GEN';
      const ccName = line.cost_center_name ?? 'General Administration';

      if (line.kind === 'earning') {
        const key = `${ccCode}_${line.component_code}`;
        const existing = debitMap.get(key) ?? {
          compCode: line.component_code,
          name: line.comp_name,
          ccCode,
          ccName,
          amt: 0,
        };
        existing.amt += amt;
        debitMap.set(key, existing);
      } else if (line.kind === 'deduction') {
        const key = `${ccCode}_${line.component_code}`;
        const existing = creditMap.get(key) ?? {
          compCode: line.component_code,
          name: line.comp_name,
          ccCode,
          ccName,
          amt: 0,
        };
        existing.amt += amt;
        creditMap.set(key, existing);
      } else {
        // Employer contribution is both an expense debit AND a payable credit
        const dKey = `${ccCode}_${line.component_code}_DEBIT`;
        const dExisting = debitMap.get(dKey) ?? {
          compCode: line.component_code,
          name: `${line.comp_name} (Expense)`,
          ccCode,
          ccName,
          amt: 0,
        };
        dExisting.amt += amt;
        debitMap.set(dKey, dExisting);

        const cKey = `${ccCode}_${line.component_code}_CREDIT`;
        const cExisting = creditMap.get(cKey) ?? {
          compCode: line.component_code,
          name: `${line.comp_name} (Payable)`,
          ccCode,
          ccName,
          amt: 0,
        };
        cExisting.amt += amt;
        creditMap.set(cKey, cExisting);
      }
    }

    // Build Debit JV lines
    for (const d of debitMap.values()) {
      const gl = glMap.get(d.compCode) ??
        DEFAULT_GL_MAP[d.compCode] ??
        DEFAULT_GL_MAP['DEFAULT_EARNING'] ?? { code: '510090', desc: 'Salaries - Other' };

      jvLines.push({
        glCode: gl.code,
        glDescription: gl.desc,
        costCenterCode: d.ccCode,
        costCenterName: d.ccName,
        debitRupees: d.amt,
        creditRupees: 0,
        componentCode: d.compCode,
        postingType: 'DEBIT',
      });
      totalDebits += d.amt;
    }

    // Build Credit JV lines for Deductions & Employer Payables
    for (const c of creditMap.values()) {
      const gl = glMap.get(c.compCode) ??
        DEFAULT_GL_MAP[c.compCode] ??
        DEFAULT_GL_MAP['DEFAULT_DEDUCTION'] ?? { code: '210090', desc: 'Other Deductions Payable' };

      jvLines.push({
        glCode: gl.code,
        glDescription: gl.desc,
        costCenterCode: c.ccCode,
        costCenterName: c.ccName,
        debitRupees: 0,
        creditRupees: c.amt,
        componentCode: c.compCode,
        postingType: 'CREDIT',
      });
      totalCredits += c.amt;
    }

    // B. CREDITS: Net Salaries Payable by cost center
    const netMap = new Map<string, { ccCode: string; ccName: string; amt: number }>();
    for (const it of items) {
      const net = Number(it.net_pay);
      if (net <= 0) continue;
      const ccCode = it.cost_center_code ?? 'GEN';
      const ccName = it.cost_center_name ?? 'General Administration';

      const existing = netMap.get(ccCode) ?? { ccCode, ccName, amt: 0 };
      existing.amt += net;
      netMap.set(ccCode, existing);
    }

    for (const n of netMap.values()) {
      const netGl = DEFAULT_GL_MAP['NET_SALARY'] ?? {
        code: '210000',
        desc: 'Salaries Payable / Bank Clearing',
      };
      jvLines.push({
        glCode: netGl.code,
        glDescription: netGl.desc,
        costCenterCode: n.ccCode,
        costCenterName: n.ccName,
        debitRupees: 0,
        creditRupees: n.amt,
        componentCode: 'NET_SALARY',
        postingType: 'CREDIT',
      });
      totalCredits += n.amt;
    }

    // Strict Invariant Check (within 1 rupee rounding tolerance)
    const diff = Math.abs(totalDebits - totalCredits);
    const isBalanced = diff < 1.0;

    // Generate CSV export
    const csvHeader = 'GL_CODE,GL_DESCRIPTION,COST_CENTER,DEBIT_INR,CREDIT_INR,POSTING_TYPE\n';
    const csvRows = jvLines
      .map(
        (l) =>
          `"${l.glCode}","${l.glDescription}","${l.costCenterCode}",${l.debitRupees.toFixed(2)},${l.creditRupees.toFixed(2)},${l.postingType}`
      )
      .join('\n');
    const csvTotals = `\n"TOTAL","BALANCE CHECK","ALL",${totalDebits.toFixed(2)},${totalCredits.toFixed(2)},${isBalanced ? 'BALANCED' : 'UNBALANCED'}\n`;
    const csvContent = `${csvHeader}${csvRows}${csvTotals}`;

    // Archive into core.documents
    const documentId = await createDocument(this.db, {
      ownerEmployeeId: null,
      kind: 'sap_jv',
      originalName: `SAP-JV-${monthStr}-${run.company_name.replace(/\s+/g, '_')}.csv`,
      mime: 'text/csv',
      content: csvContent,
      uploadedBy: actorUserId,
    });

    return {
      runId,
      companyName: run.company_name,
      month: monthStr,
      documentId,
      totalDebitsRupees: totalDebits,
      totalCreditsRupees: totalCredits,
      totalCtcRupees: totalDebits,
      isBalanced,
      lines: jvLines,
      csvContent,
    };
  }
}
