/**
 * Payslip Generator (PAY-06, SOW crosswalk).
 *
 * Assembles payslip data, renders HTML and PDF representations,
 * archives to core.documents via StorageAdapter, and updates payslip_document_id.
 */

import { inTransaction } from '../../../core/db/database.js';
import { ConflictError, NotFoundError } from '../../../core/errors/index.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { createDocument } from '../../../core/storage/index.js';
import {
  type PayslipData,
  type PayslipType,
  maskIdentifier,
  renderPayslipHtml,
  renderPayslipPdf,
  computeFactoriesActOt,
  formatCurrencyInWords,
} from './template.service.js';

export class PayslipGeneratorService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Assembles the complete RML payslip data structure for an employee and run.
   */
  async assemblePayslipData(
    runId: number,
    employeeId: number,
    type: PayslipType = 'regular'
  ): Promise<PayslipData> {
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

    // 2. Fetch Employee details
    const emp = await this.db
      .selectFrom('core.employees as e')
      .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
      .leftJoin('core.departments as dept', 'dept.id', 'e.department_id')
      .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
      .select([
        'e.id',
        'e.ecode',
        'e.first_name',
        'e.last_name',
        'e.doj',
        'e.pan',
        'e.uan',
        'e.pf_number',
        'e.esic_ip_number',
        'e.bank_name',
        'e.bank_account',
        'e.bank_ifsc',
        'd.name as designation',
        'dept.name as department',
        'cc.name as cost_center',
      ])
      .where('e.id', '=', employeeId)
      .executeTakeFirst();

    if (!emp) {
      throw new Error(`Employee #${String(employeeId)} not found.`);
    }

    // 3. Fetch Payroll Item
    const item = await this.db
      .selectFrom('pay.payroll_items')
      .selectAll()
      .where('run_id', '=', runId)
      .where('employee_id', '=', employeeId)
      .executeTakeFirst();

    if (!item) {
      throw new Error(
        `Payroll item for employee #${String(employeeId)} in run #${String(runId)} not found.`
      );
    }

    // 4. Fetch Payroll Item Lines
    const lines = await this.db
      .selectFrom('pay.payroll_item_lines as l')
      .innerJoin('pay.salary_components as sc', 'sc.code', 'l.component_code')
      .select([
        'l.component_code',
        'sc.name',
        'sc.kind',
        'sc.display_order',
        'l.amount',
        'l.calc_note',
      ])
      .where('l.item_id', '=', item.id)
      .orderBy('sc.display_order', 'asc')
      .execute();

    const earnings = lines
      .filter((l) => l.kind === 'earning')
      .map((l) => ({
        code: l.component_code,
        name: l.name,
        amountRupees: Number(l.amount),
        calcNote: l.calc_note,
      }));

    const deductions = lines
      .filter((l) => l.kind === 'deduction')
      .map((l) => ({
        code: l.component_code,
        name: l.name,
        amountRupees: Number(l.amount),
        calcNote: l.calc_note,
      }));

    const employerContributions = lines
      .filter((l) => l.kind === 'employer_contribution')
      .map((l) => ({
        code: l.component_code,
        name: l.name,
        amountRupees: Number(l.amount),
        calcNote: l.calc_note,
      }));

    // Date formatting
    const monthDate = new Date(run.month);
    const monthStr = monthDate.toISOString().slice(0, 7);
    const monthName = monthDate.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const fullName = emp.last_name
      ? `${emp.first_name} ${emp.last_name}`
      : emp.first_name;

    const dojFormatted = emp.doj
      ? new Date(emp.doj).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null;

    // Attendance numbers
    const attendance = {
      daysInMonth: Number(item.days_in_month),
      payableDays: Number(item.payable_days),
      lopDays: Number(item.lop_days),
      lopReversalDays: Number(item.lop_reversal_days),
      otMinutes: item.ot_minutes,
    };

    const grossRupees = Number(item.gross);
    const totalDeductionsRupees = Number(item.total_deductions);
    const netPayRupees = Number(item.net_pay);
    const netPayInWords = formatCurrencyInWords(netPayRupees);

    // Overtime breakdown if overtime type requested
    let overtimeBreakdown;
    if (type === 'overtime' || attendance.otMinutes > 0) {
      const basicLine = earnings.find((e) => e.code === 'BASIC')?.amountRupees ?? 0;
      const daLine = earnings.find((e) => e.code === 'DA')?.amountRupees ?? 0;
      const otAllow = earnings
        .filter((e) => ['HRA', 'SPECIAL', 'OT_ALLOW'].includes(e.code))
        .reduce((sum, e) => sum + e.amountRupees, 0);

      overtimeBreakdown = computeFactoriesActOt(
        basicLine,
        daLine,
        otAllow,
        attendance.otMinutes
      );
    }

    // Leave balances footer (from lv.leave_types and immutable lv.ledger)
    const leaveTypes = await this.db
      .selectFrom('lv.leave_types')
      .select(['id', 'code'])
      .where('is_active', '=', true)
      .execute();

    const leaveFooter: {
      type: string;
      opening: number;
      accrued: number;
      availed: number;
      balance: number;
    }[] = [];

    for (const lt of leaveTypes) {
      const ledgerEntries = await this.db
        .selectFrom('lv.ledger')
        .select(['txn_type', 'delta'])
        .where('employee_id', '=', employeeId)
        .where('leave_type_id', '=', lt.id)
        .execute();

      let opening = 0;
      let accrued = 0;
      let availed = 0;
      let balance = 0;

      for (const entry of ledgerEntries) {
        const delta = Number(entry.delta);
        balance += delta;
        if (entry.txn_type === 'grant') accrued += delta;
        else if (entry.txn_type === 'application') availed += Math.abs(delta);
        else if (entry.txn_type === 'adjustment' && delta > 0) opening += delta;
      }

      leaveFooter.push({
        type: lt.code,
        opening,
        accrued,
        availed,
        balance,
      });
    }

    return {
      companyName: run.company_name,
      monthStr,
      monthName,
      type,
      employee: {
        id: emp.id,
        ecode: emp.ecode,
        name: fullName,
        designation: emp.designation,
        department: emp.department,
        costCenter: emp.cost_center,
        doj: dojFormatted,
        bankAccountMasked: maskIdentifier(emp.bank_account, 4),
        bankName: emp.bank_name,
        ifsc: emp.bank_ifsc,
        panMasked: maskIdentifier(emp.pan, 4),
        uanMasked: maskIdentifier(emp.uan, 4),
        pfNumberMasked: maskIdentifier(emp.pf_number, 4),
        esicNumberMasked: maskIdentifier(emp.esic_ip_number, 4),
      },
      attendance,
      earnings,
      deductions,
      employerContributions,
      grossRupees,
      totalDeductionsRupees,
      netPayRupees,
      netPayInWords,
      overtimeBreakdown,
      leaveBalances: leaveFooter,
    };
  }

  /**
   * Generates HTML and PDF for a payslip, archives PDF to core.documents,
   * and links payslip_document_id on pay.payroll_items.
   */
  async generateAndArchivePayslip(
    runId: number,
    employeeId: number,
    type: PayslipType = 'regular',
    actorUserId?: number
  ): Promise<{
    payslipData: PayslipData;
    html: string;
    pdfBuffer: Buffer;
    documentId: number;
  }> {
    const data = await this.assemblePayslipData(runId, employeeId, type);
    const html = renderPayslipHtml(data);
    const pdfBuffer = renderPayslipPdf(data);

    // P-09: the document row and the item link commit together (no orphans);
    // the immutability trigger allows exactly this one post-finalize link.
    const docId = await inTransaction(this.db, async (trx) => {
      const id = await createDocument(trx, {
        ownerEmployeeId: employeeId,
        kind: 'payslip',
        originalName: `payslip-${data.monthStr}-${data.employee.ecode}.pdf`,
        mime: 'application/pdf',
        content: pdfBuffer,
        uploadedBy: actorUserId ?? null,
      });
      const linked = await trx
        .updateTable('pay.payroll_items')
        .set({ payslip_document_id: id })
        .where('run_id', '=', runId)
        .where('employee_id', '=', employeeId)
        .where('payslip_document_id', 'is', null)
        .executeTakeFirst();
      if (Number(linked.numUpdatedRows) !== 1) throw new ConflictError('This payslip is already archived');
      if (actorUserId !== undefined) {
        await writeAudit(trx, { actorUserId, action: 'create', entity: 'core.documents', entityId: id, newValue: `payslip run ${String(runId)} employee ${String(employeeId)}` });
      }
      return id;
    });

    return {
      payslipData: data,
      html,
      pdfBuffer,
      documentId: docId,
    };
  }

  /**
   * Batch generation: generate and archive payslips for all employees in a run.
   */
  async generateRunPayslips(
    runId: number,
    actorUserId?: number
  ): Promise<{
    totalItems: number;
    generatedCount: number;
  }> {
    const run = await this.db.selectFrom('pay.payroll_runs').select('status').where('id', '=', runId).executeTakeFirst();
    if (!run) throw new NotFoundError(`Payroll run #${String(runId)} not found`);
    if (run.status !== 'finalized' && run.status !== 'paid') throw new ConflictError('Payslips are archived only after the run is finalized');
    // Idempotent: already-archived payslips are skipped.
    const items = await this.db
      .selectFrom('pay.payroll_items')
      .select(['employee_id'])
      .where('run_id', '=', runId)
      .where('payslip_document_id', 'is', null)
      .where('payment_status', '!=', 'hold_process')
      .execute();

    let generatedCount = 0;
    for (const it of items) {
      await this.generateAndArchivePayslip(runId, it.employee_id, 'regular', actorUserId);
      generatedCount++;
    }

    return {
      totalItems: items.length,
      generatedCount,
    };
  }
}
