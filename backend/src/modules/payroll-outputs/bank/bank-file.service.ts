/**
 * Bank Bulk Payment File Service (PAY-05, R8, SOW crosswalk).
 *
 * Generates NEFT/RTGS batch CSV formatted to Finance specification:
 * - Excludes employees with active payment hold (payment_status === 'held').
 * - Unmasked account numbers and IFSC for banking network processing.
 * - Header record, detail records, and trailer control totals.
 * - Archives batch file into core.documents and registers in pay.bank_batches.
 */

import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { createDocument } from '../../../core/storage/index.js';
import { createHash } from 'node:crypto';

export interface BankPaymentRecord {
  employeeId: number;
  ecode: string;
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
  amountRupees: number;
  narration: string;
}

export interface BankBatchSummary {
  batchId: number;
  documentId: number;
  runId: number;
  companyName: string;
  month: string;
  recordCount: number;
  totalAmountRupees: number;
  heldCount: number;
  heldAmountRupees: number;
  csvContent: string;
}

export class BankFileService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Generates NEFT/RTGS bulk payment batch for a payroll run.
   */
  async generateBankBatch(
    runId: number,
    actorUserId: number
  ): Promise<BankBatchSummary> {
    // 1. Fetch Run & Company
    const run = await this.db
      .selectFrom('pay.payroll_runs as r')
      .innerJoin('core.companies as c', 'c.id', 'r.company_id')
      .select([
        'r.id',
        'r.month',
        'r.status',
        'c.id as company_id',
        'c.name as company_name',
      ])
      .where('r.id', '=', runId)
      .executeTakeFirst();

    if (!run) {
      throw new Error(`Payroll run #${String(runId)} not found.`);
    }

    const monthStr = new Date(run.month).toISOString().slice(0, 7);

    // 2. Fetch all payroll items joined with employee bank details
    const items = await this.db
      .selectFrom('pay.payroll_items as it')
      .innerJoin('core.employees as e', 'e.id', 'it.employee_id')
      .select([
        'it.id as item_id',
        'it.employee_id',
        'it.net_pay',
        'it.payment_status',
        'e.ecode',
        'e.first_name',
        'e.last_name',
        'e.bank_name',
        'e.bank_account',
        'e.bank_ifsc',
        'e.payment_mode',
      ])
      .where('it.run_id', '=', runId)
      .execute();

    if (items.length === 0) {
      throw new Error(`Run #${String(runId)} has no computed payroll items.`);
    }

    const payableRecords: BankPaymentRecord[] = [];
    let totalPayableAmount = 0;
    let heldCount = 0;
    let heldAmountRupees = 0;

    for (const it of items) {
      const netPay = Number(it.net_pay);

      // EXCLUSION RULE: Skip if payment status is held or payment mode is hold
      if (
        it.payment_status === 'hold_payment' ||
        it.payment_status === 'hold_process' ||
        it.payment_mode === 'hold' ||
        netPay <= 0
      ) {
        heldCount++;
        heldAmountRupees += netPay > 0 ? netPay : 0;
        continue;
      }

      const fullName = it.last_name
        ? `${it.first_name} ${it.last_name}`
        : it.first_name;

      const accountNo = (it.bank_account ?? '').trim();
      const ifsc = (it.bank_ifsc ?? '').trim().toUpperCase();

      if (!accountNo || !ifsc) {
        throw new Error(
          `Employee ${it.ecode} (${fullName}) is missing bank account or IFSC.`
        );
      }

      payableRecords.push({
        employeeId: it.employee_id,
        ecode: it.ecode,
        beneficiaryName: fullName,
        accountNumber: accountNo,
        ifsc,
        amountRupees: netPay,
        narration: `SALARY FOR ${monthStr}`,
      });

      totalPayableAmount += netPay;
    }

    // Format Bank Batch CSV Lines
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const headerLine = `H,NEFT_RTGS,${run.company_name.replace(/,/g, ' ')},${todayStr},RUN_${String(runId)}`;

    const detailLines = payableRecords.map((r) => {
      const amtStr = r.amountRupees.toFixed(2);
      const cleanName = r.beneficiaryName.replace(/,/g, ' ');
      return `D,${cleanName},${r.accountNumber},${r.ifsc},${amtStr},${r.ecode},${r.narration}`;
    });

    const totalAmtStr = totalPayableAmount.toFixed(2);
    const contentToHash = `${headerLine}\n${detailLines.join('\n')}\n`;
    const hash = createHash('sha256').update(contentToHash).digest('hex').slice(0, 16);

    const trailerLine = `T,${String(payableRecords.length)},${totalAmtStr},${hash}`;
    const csvContent = `${headerLine}\n${detailLines.join('\n')}\n${trailerLine}\n`;

    // 3. Save into core.documents
    const documentId = await createDocument(this.db, {
      ownerEmployeeId: null,
      kind: 'bank_batch',
      originalName: `BANK-BULK-${monthStr}-${run.company_name.replace(/\s+/g, '_')}.csv`,
      mime: 'text/csv',
      content: csvContent,
      uploadedBy: actorUserId,
    });

    // 4. Register in pay.bank_batches
    const batchRow = await this.db
      .insertInto('pay.bank_batches')
      .values({
        run_id: runId,
        file_document_id: documentId,
        total_amount: totalAmtStr,
        record_count: payableRecords.length,
        generated_by: actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return {
      batchId: batchRow.id,
      documentId,
      runId,
      companyName: run.company_name,
      month: monthStr,
      recordCount: payableRecords.length,
      totalAmountRupees: totalPayableAmount,
      heldCount,
      heldAmountRupees,
      csvContent,
    };
  }
}
