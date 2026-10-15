/**
 * Outputs Bundle Service (PAY-05, PAY-06, SOW crosswalk).
 *
 * Provides status, metadata, and download descriptors for all outputs
 * associated with a payroll run:
 *   1. Payslips
 *   2. Bank bulk file
 *   3. SAP Journal Voucher
 *   4. Variance report (R10)
 *   5. PF ECR text
 *   6. ESIC return
 *   7. PT register
 *   8. TDS 24Q data
 */

import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';

export interface RunOutputItem {
  code: string;
  label: string;
  note: string;
  isReady: boolean;
  documentId: number | null;
  generatedAt: string | null;
  recordCount: number | null;
  totalAmountRupees: number | null;
}

export interface RunOutputsStatus {
  runId: number;
  companyName: string;
  month: string;
  status: string;
  canGenerateOutputs: boolean;
  outputs: RunOutputItem[];
}

export class OutputsBundleService {
  constructor(private readonly db: Kysely<Database>) {}

  async getRunOutputsStatus(runId: number): Promise<RunOutputsStatus> {
    const run = await this.db
      .selectFrom('pay.payroll_runs as r')
      .innerJoin('core.companies as c', 'c.id', 'r.company_id')
      .select(['r.id', 'r.month', 'r.status', 'c.name as company_name'])
      .where('r.id', '=', runId)
      .executeTakeFirst();

    if (!run) {
      throw new Error(`Payroll run #${String(runId)} not found.`);
    }

    const monthStr = new Date(run.month).toISOString().slice(0, 7);
    const canGenerateOutputs = ['approved', 'finalized', 'paid'].includes(run.status);

    // Check Bank Batch
    const bankBatch = await this.db
      .selectFrom('pay.bank_batches')
      .selectAll()
      .where('run_id', '=', runId)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    // Check Payslip Documents
    const payslipStats = await this.db
      .selectFrom('pay.payroll_items')
      .select([
        this.db.fn.count<number>('id').as('total_items'),
        this.db.fn.count<number>('payslip_document_id').as('archived_slips'),
      ])
      .where('run_id', '=', runId)
      .executeTakeFirst();

    const totalEmployees = payslipStats?.total_items ?? 0;
    const archivedSlips = payslipStats?.archived_slips ?? 0;

    // Check SAP JV Document in core.documents
    const sapJvDoc = await this.db
      .selectFrom('core.documents')
      .selectAll()
      .where('kind', '=', 'sap_jv')
      .where('original_name', 'like', `SAP-JV-${monthStr}-%`)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    const toIso = (value: unknown): string | null => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') return value;
      return null;
    };

    const outputs: RunOutputItem[] = [
      {
        code: 'payslips',
        label: 'Payslips',
        note: `Fixed RML layout · ${String(archivedSlips)} of ${String(totalEmployees)} archived`,
        isReady: archivedSlips > 0,
        documentId: null,
        generatedAt: archivedSlips > 0 ? new Date().toISOString() : null,
        recordCount: archivedSlips,
        totalAmountRupees: null,
      },
      {
        code: 'bank',
        label: 'Bank Payment File',
        note: 'NEFT/RTGS CSV formatted to Finance specification; holds excluded',
        isReady: Boolean(bankBatch),
        documentId: bankBatch?.file_document_id ?? null,
        generatedAt: toIso(bankBatch?.created_at),
        recordCount: bankBatch?.record_count ?? null,
        totalAmountRupees: bankBatch ? Number(bankBatch.total_amount) : null,
      },
      {
        code: 'jv',
        label: 'SAP Journal Voucher',
        note: 'Balanced debit/credit posting by GL code & cost center',
        isReady: Boolean(sapJvDoc),
        documentId: sapJvDoc?.id ?? null,
        generatedAt: toIso(sapJvDoc?.created_at),
        recordCount: null,
        totalAmountRupees: null,
      },
      {
        code: 'ecr',
        label: 'PF ECR File',
        note: 'EPFO portal #~# delimiter format with NCP days',
        isReady: canGenerateOutputs,
        documentId: null,
        generatedAt: null,
        recordCount: totalEmployees,
        totalAmountRupees: null,
      },
      {
        code: 'esic',
        label: 'ESIC Monthly Return',
        note: 'IP numbers, payable days, and contributions rounded UP',
        isReady: canGenerateOutputs,
        documentId: null,
        generatedAt: null,
        recordCount: totalEmployees,
        totalAmountRupees: null,
      },
      {
        code: 'pt',
        label: 'PT Register',
        note: 'West Bengal slab-wise professional tax return',
        isReady: canGenerateOutputs,
        documentId: null,
        generatedAt: null,
        recordCount: totalEmployees,
        totalAmountRupees: null,
      },
      {
        code: 'tds',
        label: 'TDS / 24Q Summary',
        note: 'Income tax deducted u/s 192 under New & Old regimes',
        isReady: canGenerateOutputs,
        documentId: null,
        generatedAt: null,
        recordCount: totalEmployees,
        totalAmountRupees: null,
      },
    ];

    return {
      runId,
      companyName: run.company_name,
      month: monthStr,
      status: run.status,
      canGenerateOutputs,
      outputs,
    };
  }
}
