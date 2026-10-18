/**
 * Separation Management & Exit Pipeline Service (LC-06, LC-07, PAY-15, SOW crosswalk).
 *
 * 1. ESS resignation: the employee resigns for THEMSELVES only (C-01/B-04); one
 *    open case per employee; the 'resignation' workflow chain (RM → HR head →
 *    HR ops) decides it — nobody flips the status directly.
 * 2. HR-initiated termination / absconding path (decided by HR, audited).
 * 3. Workflow final hook: approved → approved_lwd, on_notice, clearance fan-out;
 *    rejected/lapsed → rejected.
 * 4. F&F: amounts in integer paise from the salary snapshot (which already
 *    stores paise — C-08/P-02), earnings only, EL from the leave ledger, final
 *    month salary only when no payroll run already paid it (P-03), held
 *    salary released from held payroll items.
 * 5. Payment: only with every clearance resolved and a non-negative net (P-02),
 *    in one transaction, then the LC-07 exit-day cascade.
 */
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { Database, SeparationsTable } from '../../../core/db/types.js';
import { addDaysIso, formatDbDate, istDateString } from '../../../core/dates.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from '../../../core/errors/index.js';
import { employeeScopeSql, type EmployeeScope } from '../../../core/rbac/employee-scope.js';
import { parseJsonObject } from '../../../core/json.js';
import { getTypedSetting } from '../../settings/index.js';
import { cancelRequest, createRequest, act } from '../../workflows/index.js';
import { ClearanceService } from './clearance.service.js';
import { computeFnfSettlement, readLockedPayableDays, type FnfSettlementCalculation } from '../../payroll-core/index.js';
import { inTransaction } from '../../../core/db/database.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface ResignationApplicationInput {
  employeeId: number;
  reason: string;
  requestedLwd: string; // YYYY-MM-DD
  userId: number;
}

export interface AbscondingTerminationInput {
  employeeId: number;
  reason: string;
  lastWorkingDay: string;
  absenceCaseId?: number | undefined;
  hrUserId: number;
}

export interface SeparationItem {
  id: number;
  employeeId: number;
  ecode?: string;
  employeeName?: string;
  departmentName?: string;
  designationName?: string;
  companyId?: number;
  initiatedAt: Date | string;
  initiatedBy: 'employee' | 'hr';
  reason: string;
  resignationDate: string;
  noticePeriodDays: number;
  requestedLwd: string;
  approvedLwd: string | null;
  shortfallDays: number;
  workflowRequestId: number | null;
  status: 'pending' | 'approved' | 'withdrawn' | 'rejected' | 'completed';
  fnfId: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const OPEN_STATUSES = ['pending', 'approved'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dayDiff(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

function assertIsoDate(value: string, label: string): void {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new DomainError(`${label} must be a valid date (YYYY-MM-DD)`);
  }
}

async function noticeDaysFor(db: Db, category: string | null): Promise<number> {
  return category === 'white_collar'
    ? getTypedSetting<number>(db, 'lifecycle.notice_days_white_collar', 'number', 90)
    : getTypedSetting<number>(db, 'lifecycle.notice_days_default', 'number', 30);
}

/** E2E-002: the notice the signed-in employee owes, from policy settings and their category. */
export async function myNoticePolicy(db: Db, employeeId: number): Promise<{ noticePeriodDays: number; category: string | null; ecode: string; name: string }> {
  const e = await db.selectFrom('core.employees').select(['category', 'ecode', 'first_name', 'last_name']).where('id', '=', employeeId).executeTakeFirstOrThrow();
  return { noticePeriodDays: await noticeDaysFor(db, e.category), category: e.category, ecode: e.ecode, name: `${e.first_name} ${e.last_name ?? ''}`.trim() };
}

async function assertNoOpenCase(db: Db, employeeId: number): Promise<void> {
  const open = await db
    .selectFrom('core.separations')
    .select('id')
    .where('employee_id', '=', employeeId)
    .where('status', 'in', [...OPEN_STATUSES])
    .executeTakeFirst();
  if (open) throw new ConflictError(`An open separation case (#${String(open.id)}) already exists for this employee`);
}

/** Workflow final hook for 'resignation' — runs inside the deciding transaction. */
export async function applyResignationOnFinal(
  db: Db,
  request: { id: number; requested_by: number },
  status: 'approved' | 'rejected' | 'lapsed',
): Promise<void> {
  const sep = await db
    .selectFrom('core.separations')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .forUpdate()
    .executeTakeFirst();
  if (sep?.status !== 'pending') return; // idempotent: already decided / withdrawn
  if (status !== 'approved') {
    await db.updateTable('core.separations').set({ status: 'rejected', updated_at: new Date() }).where('id', '=', sep.id).execute();
    return;
  }
  const lwd = formatDbDate(sep.approved_lwd ?? sep.requested_lwd);
  const served = dayDiff(formatDbDate(sep.resignation_date), lwd);
  const shortfall = Math.max(0, sep.notice_period_days - served);
  await db
    .updateTable('core.separations')
    .set({ status: 'approved', approved_lwd: sql<Date>`${lwd}::date`, shortfall_days: shortfall.toFixed(1), updated_at: new Date() })
    .where('id', '=', sep.id)
    .execute();
  await db.updateTable('core.employees').set({ status: 'on_notice' }).where('id', '=', sep.employee_id).where('status', '=', 'active').execute();
  await new ClearanceService(db).fanOutClearances(sep.id);
}

export class SeparationService {
  private readonly clearanceService: ClearanceService;

  constructor(private readonly db: Kysely<Database>) {
    this.clearanceService = new ClearanceService(db);
  }

  /** ESS resignation for the caller's own employee record only. */
  async applyResignation(input: ResignationApplicationInput): Promise<SeparationItem> {
    assertIsoDate(input.requestedLwd, 'Requested last working day');
    const employee = await this.db.selectFrom('core.employees').selectAll().where('id', '=', input.employeeId).executeTakeFirst();
    if (!employee) throw new NotFoundError(`Employee #${String(input.employeeId)} not found`);
    if (employee.status === 'exited') throw new DomainError('Cannot submit resignation for an exited employee');

    const today = istDateString();
    if (input.requestedLwd < today) throw new DomainError('Requested last working day cannot be in the past');
    const noticePeriodDays = await noticeDaysFor(this.db, employee.category);
    const shortfallDays = Math.max(0, noticePeriodDays - dayDiff(today, input.requestedLwd));
    await assertNoOpenCase(this.db, employee.id);

    let separationId = 0;
    await createRequest(
      this.db,
      {
        definitionCode: 'resignation',
        subjectEmployeeId: employee.id,
        requestedByUserId: input.userId,
        payload: { requestedLwd: input.requestedLwd, reason: input.reason, noticePeriodDays, shortfallDays },
      },
      async (trx, requestId) => {
        await assertNoOpenCase(trx, employee.id);
        const row = await trx
          .insertInto('core.separations')
          .values({
            employee_id: employee.id,
            initiated_by: 'employee',
            reason: input.reason,
            resignation_date: sql<Date>`${today}::date`,
            notice_period_days: noticePeriodDays,
            requested_lwd: sql<Date>`${input.requestedLwd}::date`,
            approved_lwd: null,
            shortfall_days: shortfallDays.toFixed(1),
            status: 'pending',
            workflow_request_id: requestId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        separationId = row.id;
        await writeAudit(trx, {
          actorUserId: input.userId, action: 'create', entity: 'core.separations', entityId: row.id,
          newValue: JSON.stringify({ requestedLwd: input.requestedLwd, workflowRequestId: requestId }),
        });
      },
    );
    return this.getOne(separationId);
  }

  /** HR-initiated termination / absconding (ATT-10 / SOW-5.7.2), decided by HR. */
  async initiateAbscondingTermination(input: AbscondingTerminationInput): Promise<SeparationItem> {
    assertIsoDate(input.lastWorkingDay, 'Last working day');
    const employee = await this.db.selectFrom('core.employees').selectAll().where('id', '=', input.employeeId).executeTakeFirst();
    if (!employee) throw new NotFoundError(`Employee #${String(input.employeeId)} not found`);
    if (employee.status === 'exited') throw new DomainError('Employee has already exited');
    if (employee.doj && input.lastWorkingDay < formatDbDate(employee.doj)) {
      throw new DomainError('Last working day cannot be before the date of joining');
    }
    const today = istDateString();
    const id = await inTransaction(this.db, async (trx) => {
      await assertNoOpenCase(trx, employee.id);
      const inserted = await trx
        .insertInto('core.separations')
        .values({
          employee_id: employee.id,
          initiated_by: 'hr',
          reason: `HR Termination / Absconding: ${input.reason}`,
          resignation_date: sql<Date>`${today}::date`,
          notice_period_days: 0,
          requested_lwd: sql<Date>`${input.lastWorkingDay}::date`,
          approved_lwd: sql<Date>`${input.lastWorkingDay}::date`,
          shortfall_days: '0.0',
          status: 'approved',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await new ClearanceService(trx).fanOutClearances(inserted.id);
      await trx.updateTable('core.employees').set({ status: 'on_notice' }).where('id', '=', employee.id).execute();
      await writeAudit(trx, {
        actorUserId: input.hrUserId, action: 'create', entity: 'core.separations', entityId: inserted.id,
        newValue: JSON.stringify({ initiatedBy: 'hr', lastWorkingDay: input.lastWorkingDay, absenceCaseId: input.absenceCaseId ?? null }),
      });
      return inserted.id;
    });
    return this.getOne(id);
  }

  /**
   * Approver decision on the resignation chain. The current workflow approver
   * acts; an approver may propose a different LWD (never before the
   * resignation date). Final effects come from the workflow hook.
   */
  async decideResignation(params: {
    separationId: number;
    action: 'approve' | 'reject';
    approvedLwd?: string | undefined;
    comment?: string | undefined;
    approverUserId: number;
  }): Promise<SeparationItem> {
    const existing = await this.db.selectFrom('core.separations').selectAll().where('id', '=', params.separationId).executeTakeFirst();
    if (!existing) throw new NotFoundError(`Separation #${String(params.separationId)} not found`);
    if (existing.status !== 'pending') throw new ConflictError(`Cannot decide a separation in status '${existing.status}'`);
    if (!existing.workflow_request_id) throw new ConflictError('This separation has no approval request; HR must re-raise it');
    if (params.approvedLwd !== undefined) {
      assertIsoDate(params.approvedLwd, 'Approved last working day');
      if (params.approvedLwd < formatDbDate(existing.resignation_date)) {
        throw new DomainError('Approved last working day cannot be before the resignation date');
      }
    }
    await inTransaction(this.db, async (trx) => {
      if (params.approvedLwd !== undefined && params.action === 'approve') {
        await trx.updateTable('core.separations').set({ approved_lwd: sql<Date>`${params.approvedLwd}::date` }).where('id', '=', existing.id).execute();
      }
    });
    await act(this.db, {
      requestId: existing.workflow_request_id,
      actorUserId: params.approverUserId,
      action: params.action,
      comment: params.comment,
    });
    return this.getOne(existing.id);
  }

  /** Withdrawal by the employee (own case) or HR, before the exit is settled. */
  async withdrawResignation(params: { separationId: number; reason: string; actorUserId: number; actorEmployeeId: number | null; isHr: boolean }): Promise<SeparationItem> {
    const existing = await this.db.selectFrom('core.separations').selectAll().where('id', '=', params.separationId).executeTakeFirst();
    if (!existing) throw new NotFoundError(`Separation #${String(params.separationId)} not found`);
    const own = params.actorEmployeeId !== null && params.actorEmployeeId === existing.employee_id;
    if (!own && !params.isHr) throw new ForbiddenError('You can only withdraw your own resignation');
    if (existing.status !== 'pending' && existing.status !== 'approved') {
      throw new ConflictError(`Cannot withdraw a separation in status '${existing.status}'`);
    }
    if (existing.fnf_id) throw new ConflictError('F&F has already been computed for this separation; it cannot be withdrawn');
    await inTransaction(this.db, async (trx) => {
      if (existing.workflow_request_id && existing.status === 'pending') {
        await cancelRequest(trx, { requestId: existing.workflow_request_id, actorUserId: params.actorUserId, reason: params.reason });
      }
      await trx
        .updateTable('core.separations')
        .set({ status: 'withdrawn', reason: `${existing.reason} [Withdrawn: ${params.reason}]`, updated_at: new Date() })
        .where('id', '=', existing.id)
        .execute();
      await trx.updateTable('core.employees').set({ status: 'active' }).where('id', '=', existing.employee_id).where('status', '=', 'on_notice').execute();
      await trx.deleteFrom('core.clearances').where('separation_id', '=', existing.id).where('status', '=', 'pending').execute();
      await writeAudit(trx, {
        actorUserId: params.actorUserId, action: 'withdraw', entity: 'core.separations', entityId: existing.id, newValue: params.reason,
      });
    });
    return this.getOne(existing.id);
  }

  /** Scoped list (C-16): callers only see employees inside their data scope. */
  async getSeparations(filter: { status?: string | undefined; employeeId?: number | undefined; scope?: EmployeeScope | undefined } = {}): Promise<SeparationItem[]> {
    let query = this.db
      .selectFrom('core.separations as s')
      .innerJoin('core.employees as e', 'e.id', 's.employee_id')
      .leftJoin('core.departments as d', 'd.id', 'e.department_id')
      .leftJoin('core.designations as g', 'g.id', 'e.designation_id')
      .selectAll('s')
      .select(['e.ecode', 'e.first_name', 'e.last_name', 'e.company_id', 'd.name as department_name', 'g.name as designation_name'])
      .where(employeeScopeSql(filter.scope, 'e'));
    if (filter.status && filter.status !== 'all') query = query.where('s.status', '=', filter.status as SeparationItem['status']);
    if (filter.employeeId) query = query.where('s.employee_id', '=', filter.employeeId);
    const rows = await query.orderBy('s.id', 'desc').execute();
    return rows.map((r) => ({
      ...this.mapSeparationRow(r),
      ecode: r.ecode,
      employeeName: `${r.first_name} ${r.last_name ?? ''}`.trim(),
      ...(r.department_name ? { departmentName: r.department_name } : {}),
      ...(r.designation_name ? { designationName: r.designation_name } : {}),
      companyId: r.company_id,
    }));
  }

  private async getOne(id: number, scope?: EmployeeScope): Promise<SeparationItem> {
    const rows = await this.db
      .selectFrom('core.separations')
      .select('id')
      .where('id', '=', id)
      .execute();
    if (rows.length === 0) throw new NotFoundError(`Separation #${String(id)} not found`);
    const [item] = (await this.getSeparations({ scope })).filter((s) => s.id === id);
    if (!item) throw new NotFoundError(`Separation #${String(id)} not found`);
    return item;
  }

  async getSeparationById(id: number, scope?: EmployeeScope): Promise<{
    separation: SeparationItem;
    clearances: ReturnType<ClearanceService['mapClearanceRow']>[];
    fnfSettlement?: unknown;
  }> {
    const separation = await this.getOne(id, scope);
    const clearances = await this.clearanceService.getClearancesBySeparation(id);
    const fnf = await this.db.selectFrom('pay.fnf_settlements').selectAll().where('separation_id', '=', id).executeTakeFirst();
    return { separation, clearances, fnfSettlement: fnf ?? null };
  }

  /** F&F in integer paise (C-08 / P-02 / P-03). */
  async computeFnf(params: {
    separationId: number;
    daysPayable?: number | undefined;
    elBalanceDays?: number | undefined;
    tdsRupees?: number | undefined;
    userId?: number | undefined;
  }): Promise<FnfSettlementCalculation> {
    const separation = await this.db.selectFrom('core.separations').selectAll().where('id', '=', params.separationId).executeTakeFirst();
    if (!separation) throw new NotFoundError(`Separation #${String(params.separationId)} not found`);
    if (separation.status !== 'approved') {
      throw new ConflictError(`Cannot compute F&F for separation in status '${separation.status}' (must be 'approved')`);
    }
    const existingFnf = await this.db.selectFrom('pay.fnf_settlements').select(['id', 'status']).where('separation_id', '=', separation.id).executeTakeFirst();
    if (existingFnf?.status === 'paid') throw new ConflictError('F&F is already paid; it cannot be recomputed');

    const employee = await this.db.selectFrom('core.employees').selectAll().where('id', '=', separation.employee_id).executeTakeFirstOrThrow();
    if (!employee.doj) throw new DomainError('Employee has no date of joining; F&F cannot be computed');
    const lwdStr = formatDbDate(separation.approved_lwd ?? separation.requested_lwd);
    const monthStart = `${lwdStr.slice(0, 7)}-01`;

    // Salary in force on the LWD. component_amounts already holds integer paise.
    const salary = await this.db
      .selectFrom('pay.employee_salaries')
      .selectAll()
      .where('employee_id', '=', employee.id)
      .where('effective_from', '<=', sql<Date>`${lwdStr}::date`)
      .orderBy('effective_from', 'desc')
      .executeTakeFirst();
    if (!salary) throw new DomainError('Employee has no salary in force on the last working day');
    const components = parseJsonObject(salary.component_amounts);
    const catalog = await this.db.selectFrom('pay.salary_components').select(['code', 'kind', 'part_of_gross']).execute();
    const earningGross = new Set(catalog.filter((c) => c.kind === 'earning' && c.part_of_gross).map((c) => c.code));
    const amount = (code: string) => Math.round(Number(components[code] ?? 0));
    const basicMonthlyPaise = amount('BASIC');
    const daMonthlyPaise = amount('DA');
    const grossMonthlyPaise = Object.keys(components).filter((c) => earningGross.has(c)).reduce((sum, c) => sum + amount(c), 0);

    // P-03: if a payroll run for the LWD month already paid this employee, the
    // final-month salary is not paid again in the F&F.
    const paidInRun = await this.db
      .selectFrom('pay.payroll_items as i')
      .innerJoin('pay.payroll_runs as r', 'r.id', 'i.run_id')
      .select(['r.id as run_id'])
      .where('i.employee_id', '=', employee.id)
      .where('r.month', '=', sql<Date>`${monthStart}::date`)
      .where('r.status', 'in', ['computed', 'under_review', 'approved', 'finalized', 'paid'])
      .executeTakeFirst();
    const daysInMonth = new Date(Date.UTC(Number(lwdStr.slice(0, 4)), Number(lwdStr.slice(5, 7)), 0)).getUTCDate();
    let daysPayable: number;
    if (paidInRun) {
      daysPayable = 0;
    } else if (params.daysPayable !== undefined) {
      daysPayable = params.daysPayable;
    } else {
      const lock = await this.db
        .selectFrom('att.month_locks')
        .select('id')
        .where('company_id', '=', employee.company_id)
        .where('month', '=', sql<Date>`${monthStart}::date`)
        .executeTakeFirst();
      const from = formatDbDate(employee.doj) > monthStart ? formatDbDate(employee.doj) : monthStart;
      daysPayable = lock ? await readLockedPayableDays(this.db, employee.id, from, addDaysIso(lwdStr, 1)) : dayDiff(from, lwdStr) + 1;
    }
    if (daysPayable < 0 || daysPayable > daysInMonth) throw new DomainError('Days payable must be within the final month');

    // EL balance from the leave ledger unless HR overrides it.
    let elBalanceDays = params.elBalanceDays;
    if (elBalanceDays === undefined) {
      const el = await this.db
        .selectFrom('lv.ledger as l')
        .innerJoin('lv.leave_types as t', 't.id', 'l.leave_type_id')
        .select(sql<string>`coalesce(sum(l.delta), 0)`.as('days'))
        .where('l.employee_id', '=', employee.id)
        .where('t.code', '=', 'EL')
        .executeTakeFirst();
      elBalanceDays = Math.max(0, Number(el?.days ?? 0));
    }

    const clearanceResolution = await this.clearanceService.areAllClearancesResolved(separation.id);
    const unreturnedAssetRecoveryPaise = Math.round(clearanceResolution.totalRecoveryAmountRupees * 100);
    const loans = await this.db.selectFrom('pay.loans').select(['outstanding']).where('employee_id', '=', employee.id).where('status', '=', 'active').execute();
    const loanOutstandingPaise = loans.reduce((sum, l) => sum + Math.round(Number(l.outstanding) * 100), 0);
    // Held salary: payment-held items from finalized runs are released in the F&F.
    const held = await this.db
      .selectFrom('pay.payroll_items as i')
      .innerJoin('pay.payroll_runs as r', 'r.id', 'i.run_id')
      .select(sql<string>`coalesce(sum(i.net_pay), 0)`.as('net'))
      .where('i.employee_id', '=', employee.id)
      .where('i.payment_status', '=', 'hold_payment')
      .where('r.status', 'in', ['finalized', 'paid'])
      .executeTakeFirst();
    const heldSalaryPaise = Math.round(Number(held?.net ?? 0) * 100);
    // Notice recovery the final payroll runs already deducted is not recovered again.
    const noticeStart = addDaysIso(monthStart, -92);
    const noticeInRuns = await this.db
      .selectFrom('pay.payroll_item_lines as l')
      .innerJoin('pay.payroll_items as i', 'i.id', 'l.item_id')
      .innerJoin('pay.payroll_runs as r', 'r.id', 'i.run_id')
      .select(sql<string>`coalesce(sum(l.amount), 0)`.as('amount'))
      .where('i.employee_id', '=', employee.id)
      .where('l.component_code', '=', 'NOTICE_RECOVERY')
      .where('r.status', 'in', ['computed', 'under_review', 'approved', 'finalized', 'paid'])
      .where('r.month', '>=', sql<Date>`${noticeStart}::date`)
      .where('r.month', '<=', sql<Date>`${monthStart}::date`)
      .executeTakeFirst();
    const noticeAlreadyRecoveredPaise = Math.round(Number(noticeInRuns?.amount ?? 0) * 100);

    const calculation = computeFnfSettlement({
      employeeId: employee.id,
      separationId: separation.id,
      doj: formatDbDate(employee.doj),
      approvedLwd: lwdStr,
      daysPayable,
      daysInMonth,
      basicMonthlyPaise,
      daMonthlyPaise,
      grossMonthlyPaise,
      elBalanceDays,
      shortfallDays: Number(separation.shortfall_days),
      noticeAlreadyRecoveredPaise,
      unreturnedAssetRecoveryPaise,
      loanOutstandingPaise,
      heldSalaryPaise,
      tdsPaise: Math.round((params.tdsRupees ?? 0) * 100),
    });
    const money = (p: number) => (p / 100).toFixed(2);
    const values = {
      last_working_day: sql<Date>`${lwdStr}::date`,
      days_payable: daysPayable.toFixed(1),
      leave_encash_days: elBalanceDays.toFixed(2),
      leave_encash_amount: money(calculation.earnings.leaveEncashmentPaise),
      notice_recovery_days: Number(separation.shortfall_days).toFixed(1),
      notice_recovery_amount: money(calculation.deductions.noticeRecoveryPaise),
      gratuity_amount: money(calculation.earnings.gratuityPaise),
      held_salary_released: money(heldSalaryPaise),
      other_payments: '0.00',
      other_deductions: money(calculation.deductions.assetRecoveryPaise + calculation.deductions.loanRecoveryPaise + calculation.deductions.tdsPaise),
      gross_payable: money(calculation.earnings.grossPayablePaise),
      total_deductions: money(calculation.deductions.totalDeductionsPaise),
      net_payable: money(calculation.netPayablePaise),
      status: clearanceResolution.readyForFnf ? 'computed' : 'clearances_pending',
      tat_due_date: sql<Date>`${calculation.tatDueDate}::date`,
      calc_breakdown: JSON.stringify({ ...calculation, paidInRunId: paidInRun?.run_id ?? null }),
      run_id: paidInRun?.run_id ?? null,
    };
    await inTransaction(this.db, async (trx) => {
      let fnfId: number;
      if (existingFnf) {
        await trx.updateTable('pay.fnf_settlements').set(values).where('id', '=', existingFnf.id).execute();
        fnfId = existingFnf.id;
      } else {
        const inserted = await trx
          .insertInto('pay.fnf_settlements')
          .values({ ...values, employee_id: employee.id, separation_id: separation.id })
          .returning('id')
          .executeTakeFirstOrThrow();
        fnfId = inserted.id;
      }
      await trx.updateTable('core.separations').set({ fnf_id: fnfId }).where('id', '=', separation.id).execute();
      await writeAudit(trx, {
        actorUserId: params.userId ?? null, action: 'fnf_computed', entity: 'pay.fnf_settlements', entityId: fnfId,
        newValue: JSON.stringify({ netPayablePaise: calculation.netPayablePaise, daysPayable, paidInRunId: paidInRun?.run_id ?? null }),
      });
    });
    return calculation;
  }

  /**
   * Pays the F&F and runs the LC-07 exit-day cascade, atomically. Refuses while
   * clearances are pending or when the net is negative (recover first).
   */
  async finalizeAndPayFnf(params: {
    fnfId?: number | undefined;
    separationId?: number | undefined;
    paidByUserId: number;
    paymentReference?: string | undefined;
  }): Promise<{
    settlementId: number;
    employeeId: number;
    status: 'paid';
    relievingLetterId: number;
    serviceCertificateId: number;
    exitDayCommitted: boolean;
  }> {
    const fnf = await this.db
      .selectFrom('pay.fnf_settlements')
      .selectAll()
      .$if(params.fnfId !== undefined, (q) => q.where('id', '=', params.fnfId ?? 0))
      .$if(params.fnfId === undefined, (q) => q.where('separation_id', '=', params.separationId ?? 0))
      .executeTakeFirst();
    if (!fnf) throw new NotFoundError('F&F settlement not found; compute it first');
    if (params.separationId !== undefined && fnf.separation_id !== params.separationId) {
      throw new DomainError('The F&F settlement does not belong to this separation');
    }
    if (fnf.status === 'paid') throw new ConflictError('F&F settlement is already paid');
    const clearance = await this.clearanceService.areAllClearancesResolved(fnf.separation_id);
    if (!clearance.readyForFnf) {
      throw new ConflictError(`F&F cannot be paid while ${String(clearance.pendingCount)} clearance(s) are pending`);
    }
    if (Number(fnf.net_payable) < 0) {
      throw new ConflictError('Net F&F is negative; record the recovery from the employee (or a waiver) before closing the settlement');
    }
    const employee = await this.db.selectFrom('core.employees').selectAll().where('id', '=', fnf.employee_id).executeTakeFirstOrThrow();
    const lwdStr = formatDbDate(fnf.last_working_day);
    const name = `${employee.first_name} ${employee.last_name ?? ''}`.trim();

    return inTransaction(this.db, async (trx) => {
      const letter = (template: string, body: Record<string, unknown>) =>
        trx
          .insertInto('core.letters')
          .values({ employee_id: fnf.employee_id, template_code: template, body_rendered: JSON.stringify(body), status: 'issued', issued_by: params.paidByUserId, issued_at: new Date() })
          .returning('id')
          .executeTakeFirstOrThrow();
      const doj = employee.doj ? formatDbDate(employee.doj) : null;
      const relieving = await letter('relieving_letter', { ecode: employee.ecode, name, doj, dol: lwdStr, settlementId: fnf.id, netPayable: fnf.net_payable });
      const certificate = await letter('service_certificate', { ecode: employee.ecode, name, doj, dol: lwdStr });
      await trx
        .updateTable('pay.fnf_settlements')
        .set({ status: 'paid', paid_at: new Date(), relieving_letter_id: relieving.id, service_certificate_id: certificate.id })
        .where('id', '=', fnf.id)
        .execute();
      await trx.updateTable('core.separations').set({ status: 'completed', updated_at: new Date() }).where('id', '=', fnf.separation_id).execute();
      await trx.updateTable('core.employees').set({ status: 'exited', dol: sql<Date>`${lwdStr}::date` }).where('id', '=', fnf.employee_id).execute();
      // Held payroll items are now released through the F&F.
      await trx.updateTable('pay.salary_holds').set({ released_month: sql<Date>`date_trunc('month', ${lwdStr}::date)::date` }).where('employee_id', '=', fnf.employee_id).where('released_month', 'is', null).execute();
      const linkedUser = await trx.selectFrom('core.users').select(['id']).where('employee_id', '=', fnf.employee_id).executeTakeFirst();
      const alumniRole = await trx.selectFrom('core.roles').select(['id']).where('code', '=', 'alumni').executeTakeFirst();
      if (linkedUser && alumniRole) {
        await trx.deleteFrom('core.user_roles').where('user_id', '=', linkedUser.id).execute();
        await trx.insertInto('core.user_roles').values({ user_id: linkedUser.id, role_id: alumniRole.id, scope_org_unit_id: null }).execute();
      }
      await writeAudit(trx, {
        actorUserId: params.paidByUserId, action: 'fnf_paid', entity: 'pay.fnf_settlements', entityId: fnf.id,
        newValue: JSON.stringify({ netPayable: fnf.net_payable, paymentReference: params.paymentReference ?? null }),
      });
      return {
        settlementId: fnf.id,
        employeeId: fnf.employee_id,
        status: 'paid' as const,
        relievingLetterId: relieving.id,
        serviceCertificateId: certificate.id,
        exitDayCommitted: true,
      };
    });
  }

  /** CEO executive review (LC-06, SOW-221): rejection or notice-recovery waiver. */
  async ceoReview(params: {
    separationId: number;
    decision: 'approved' | 'rejected' | 'waiver_granted';
    ceoUserId: number;
    remarks?: string | undefined;
    waivedRecoveryPaise?: number | undefined;
  }): Promise<SeparationItem> {
    const existing = await this.db.selectFrom('core.separations').selectAll().where('id', '=', params.separationId).executeTakeFirst();
    if (!existing) throw new NotFoundError(`Separation #${String(params.separationId)} not found`);
    if (existing.status === 'completed' || existing.status === 'withdrawn') {
      throw new ConflictError(`Cannot review a separation in status '${existing.status}'`);
    }
    await inTransaction(this.db, async (trx) => {
      if (params.decision === 'rejected') {
        if (existing.workflow_request_id && existing.status === 'pending') {
          await cancelRequest(trx, { requestId: existing.workflow_request_id, actorUserId: params.ceoUserId, reason: params.remarks ?? 'Rejected on CEO review' });
        }
        await trx.updateTable('core.separations').set({ status: 'rejected', updated_at: new Date() }).where('id', '=', existing.id).execute();
        await trx.updateTable('core.employees').set({ status: 'active' }).where('id', '=', existing.employee_id).where('status', '=', 'on_notice').execute();
      } else if (params.decision === 'waiver_granted' && params.waivedRecoveryPaise) {
        const fnf = await trx.selectFrom('pay.fnf_settlements').selectAll().where('separation_id', '=', existing.id).executeTakeFirst();
        if (fnf && fnf.status !== 'paid') {
          const currentPaise = Math.round(Number(fnf.notice_recovery_amount) * 100);
          const waived = Math.min(currentPaise, params.waivedRecoveryPaise);
          const newDeductions = Math.round(Number(fnf.total_deductions) * 100) - waived;
          await trx
            .updateTable('pay.fnf_settlements')
            .set({
              notice_recovery_amount: ((currentPaise - waived) / 100).toFixed(2),
              total_deductions: (newDeductions / 100).toFixed(2),
              net_payable: ((Math.round(Number(fnf.gross_payable) * 100) - newDeductions) / 100).toFixed(2),
            })
            .where('id', '=', fnf.id)
            .execute();
        }
      }
      await writeAudit(trx, {
        actorUserId: params.ceoUserId, action: `ceo_${params.decision}`, entity: 'core.separations', entityId: existing.id,
        newValue: JSON.stringify({ remarks: params.remarks ?? null, waivedRecoveryPaise: params.waivedRecoveryPaise ?? null }),
      });
    });
    return this.getOne(existing.id);
  }

  private mapSeparationRow(row: Selectable<SeparationsTable>): SeparationItem {
    return {
      id: row.id,
      employeeId: row.employee_id,
      initiatedAt: row.initiated_at,
      initiatedBy: row.initiated_by,
      reason: row.reason,
      resignationDate: formatDbDate(row.resignation_date),
      noticePeriodDays: row.notice_period_days,
      requestedLwd: formatDbDate(row.requested_lwd),
      approvedLwd: row.approved_lwd ? formatDbDate(row.approved_lwd) : null,
      shortfallDays: Number(row.shortfall_days),
      workflowRequestId: row.workflow_request_id ?? null,
      status: row.status,
      fnfId: row.fnf_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
