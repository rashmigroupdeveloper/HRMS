/**
 * Payroll Run Service (PAY-03, PAY-04, PAY-08, PAY-16, SOW crosswalk).
 *
 * Implements the full lifecycle orchestration for payroll runs:
 *   Draft -> Inputs Locked -> Computed -> Under Review -> Approved -> Finalized -> Paid
 */

import type { Database } from '../../../core/db/types.js';
import type { Kysely, Selectable } from 'kysely';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { validateRunTransition } from './run-state-machine.js';
import { computeLockedRun, type RunComputationResult } from './run-compute.service.js';
import { readRunSummary, readRunSummaries, type RunSummary } from './run.repository.js';
/**
 * Client decision (C-04): may super_admin co-sign a payroll run as break-glass?
 * Default no (docs/08 §2); set PAYROLL_SUPER_ADMIN_COSIGN=true to opt in.
 */
function superAdminMayCosign(): boolean {
  return process.env['PAYROLL_SUPER_ADMIN_COSIGN'] === 'true';
}

export type { RunSummary } from './run.repository.js';
import { ReconciliationService } from '../reconciliation/reconciliation.service.js';
import type { PayrollRunType, PayrollRunsTable } from '../../../core/db/types.js';
import { inTransaction } from '../../../core/db/database.js';
import { formatDbDate } from '../../../core/dates.js';
import { DomainError, ForbiddenError, NotFoundError } from '../../../core/errors/index.js';
import { decimalRupees, paise, parseRupees } from '../../../core/money/index.js';
import { loanInstalment } from './run-compute.service.js';
import { assertIndiaPayroll } from './run-country.js';

export interface CreateRunInput {
  companyId: number;
  month: string; // YYYY-MM-01
  runType?: PayrollRunType | undefined;
  attendanceLockId?: number | null | undefined;
  notes?: string | undefined;
  actorUserId: number;
}

/** The company-month attendance lock, or null when the month is not locked yet. */
async function resolveAttendanceLock(db: Kysely<Database>, companyId: number, month: string): Promise<number | null> {
  const lock = await db.selectFrom('att.month_locks').select('id').where('company_id', '=', companyId).where('month', '=', month as unknown as Date).executeTakeFirst();
  return lock?.id ?? null;
}

export class PayrollRunService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * 1. Create a new payroll run in 'draft' status.
   */
  async createRun(input: CreateRunInput): Promise<number> {
    return this.withTransaction(async (trx) => {
      await assertIndiaPayroll(trx, input.companyId);
      const runType = input.runType ?? 'regular';

      const existing = await trx
        .selectFrom('pay.payroll_runs')
        .select('id')
        .where('company_id', '=', input.companyId)
        .where('month', '=', input.month as unknown as Date)
        .where('run_type', '=', runType)
        .executeTakeFirst();

      if (existing) {
        throw new DomainError(
          `A ${runType} payroll run already exists for company #${String(input.companyId)} on ${input.month}.`,
        );
      }

      if (!/^\d{4}-\d{2}-01$/.test(input.month)) throw new DomainError('Payroll month must be the first day of a month (YYYY-MM-01)');
      // The attendance lock for the company-month is picked up automatically when not given.
      const lockId = input.attendanceLockId ?? (await resolveAttendanceLock(trx, input.companyId, input.month));
      const inserted = await trx
        .insertInto('pay.payroll_runs')
        .values({
          company_id: input.companyId,
          month: input.month as unknown as Date,
          run_type: runType,
          status: 'draft',
          attendance_lock_id: lockId,
          notes: input.notes ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await writeAudit(trx, {
        actorUserId: input.actorUserId,
        entity: 'pay.payroll_runs',
        entityId: inserted.id,
        action: 'payroll_run_created',
        newValue: JSON.stringify({
          companyId: input.companyId,
          month: input.month,
          runType,
        }),
      });

      return inserted.id;
    });
  }

  /**
   * 2. Lock inputs for the run: transitions draft -> inputs_locked.
   */
  async lockInputs(runId: number, actorUserId: number): Promise<void> {
    return this.withLockedRun(runId, async (trx, run) => {
      const validation = validateRunTransition({
        fromStatus: run.status,
        toStatus: 'inputs_locked',
        actorUserId,
      });

      if (!validation.valid) {
        throw new DomainError(validation.error ?? 'This run cannot move to that state now', 'CONFLICT');
      }

      const lockId = run.attendance_lock_id ?? (await resolveAttendanceLock(trx, run.company_id, formatDbDate(run.month)));
      if (lockId === null) {
        throw new DomainError('Approve and close attendance for this company and month before locking payroll inputs.', 'CONFLICT');
      }
      await trx
        .updateTable('pay.payroll_runs')
        .set({
          status: 'inputs_locked',
          attendance_lock_id: lockId,
        })
        .where('id', '=', runId)
        .execute();

      await writeAudit(trx, {
        actorUserId,
        entity: 'pay.payroll_runs',
        entityId: runId,
        action: 'payroll_inputs_locked',
        oldValue: run.status,
        newValue: 'inputs_locked',
      });
    });
  }

  /**
   * 3. Compute the run: executes the full deterministic payroll engine across all employees.
   */
  async computeRun(runId: number, actorUserId: number): Promise<RunComputationResult> {
    return this.withLockedRun(runId, async (trx, run) => {
      // Recover older inputs-locked runs only after their authoritative period closes.
      if (run.attendance_lock_id === null && ['inputs_locked', 'reopened'].includes(run.status)) {
        const lockId = await resolveAttendanceLock(trx, run.company_id, formatDbDate(run.month));
        if (lockId === null) throw new DomainError('Approve and close attendance before computing this payroll run.', 'CONFLICT');
        await trx.updateTable('pay.payroll_runs').set({ attendance_lock_id: lockId }).where('id', '=', runId).execute();
        await writeAudit(trx, { actorUserId, entity: 'pay.payroll_runs', entityId: runId, action: 'payroll_attendance_lock_attached', oldValue: null, newValue: String(lockId) });
        return computeLockedRun(trx, { ...run, attendance_lock_id: lockId }, actorUserId);
      }
      return computeLockedRun(trx, run, actorUserId);
    });
  }

  /**
   * 4. Move run to 'under_review'.
   */
  async reviewRun(runId: number, actorUserId: number): Promise<void> {
    return this.withLockedRun(runId, async (trx, run) => {
      const validation = validateRunTransition({
        fromStatus: run.status,
        toStatus: 'under_review',
        actorUserId,
      });

      if (!validation.valid) {
        throw new DomainError(validation.error ?? 'This run cannot move to that state now', 'CONFLICT');
      }

      await trx
        .updateTable('pay.payroll_runs')
        .set({
          status: 'under_review',
        })
        .where('id', '=', runId)
        .execute();

      await writeAudit(trx, {
        actorUserId,
        entity: 'pay.payroll_runs',
        entityId: runId,
        action: 'payroll_run_under_review',
        oldValue: run.status,
        newValue: 'under_review',
      });
    });
  }

  /**
   * 5. Approve run: Two-person authorization check (maker != checker).
   */
  async approveRun(runId: number, actorUserId: number): Promise<void> {
    return this.withLockedRun(runId, async (trx, run) => {
      await assertIndiaPayroll(trx, run.company_id);
      // The latest successful computation identifies the maker of these results.
      const computationAudit = await trx
        .selectFrom('core.audit_log')
        .select('actor_user_id')
        .where('entity', '=', 'pay.payroll_runs')
        .where('entity_id', '=', runId)
        .where('action', '=', 'payroll_run_computed')
        .orderBy('id', 'desc')
        .executeTakeFirst();

      const makerUserId = computationAudit?.actor_user_id ?? undefined;

      const validation = validateRunTransition({
        fromStatus: run.status,
        toStatus: 'approved',
        makerUserId,
        actorUserId,
      });

      if (!validation.valid) {
        throw new DomainError(validation.error ?? 'This run cannot move to that state now', 'CONFLICT');
      }

      // docs/08 §2 (C-04): the co-sign is a permission, not a role string.
      // super_admin carries every permission (so it can delegate this one) but
      // break-glass co-sign is OFF unless the client opts in (CHANGES.md,
      // "Client decisions needed"); only a non-super_admin grant counts.
      const cosignRoles = await trx.selectFrom('core.user_roles as ur')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .innerJoin('core.role_permissions as rp', 'rp.role_id', 'ur.role_id')
        .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
        .where('ur.user_id', '=', actorUserId)
        .where('p.code', '=', 'payroll.run.cosign')
        .select('r.code').distinct().execute();
      const eligible = cosignRoles.some((row) => row.code !== 'super_admin' || superAdminMayCosign());
      if (!eligible) {
        throw new ForbiddenError('Only the HR Head can co-sign (approve) a payroll run.');
      }

      await trx
        .updateTable('pay.payroll_runs')
        .set({
          status: 'approved',
          approved_at: new Date(),
          approved_by: actorUserId,
        })
        .where('id', '=', runId)
        .execute();

      await writeAudit(trx, {
        actorUserId,
        entity: 'pay.payroll_runs',
        entityId: runId,
        action: 'payroll_run_approved',
        newValue: JSON.stringify({
          makerUserId,
          approvedBy: actorUserId,
        }),
      });
    });
  }

  /**
   * 6. Finalize run: Requires exact reconciliation match (diff == 0 paise).
   */
  async finalizeRun(runId: number, actorUserId: number): Promise<void> {
    return this.withLockedRun(runId, async (trx, run) => {
      await assertIndiaPayroll(trx, run.company_id);
      // Run independent secondary reconciliation
      const recon = await new ReconciliationService(trx).reconcileRun(runId);
      if (!recon.isReconciled) {
        throw new DomainError(`Cannot finalize payroll run: ${recon.anomalies.join(' ')}`, 'CONFLICT');
      }

      const validation = validateRunTransition({
        fromStatus: run.status,
        toStatus: 'finalized',
        reconciliationDiffPaise: recon.discrepancyPaise,
        actorUserId,
      });

      if (!validation.valid) {
        throw new DomainError(validation.error ?? 'This run cannot move to that state now', 'CONFLICT');
      }

      await trx
        .updateTable('pay.payroll_runs')
        .set({
          status: 'finalized',
          finalized_at: new Date(),
          finalized_by: actorUserId,
        })
        .where('id', '=', runId)
        .execute();

      const postings = await this.postRunRecoveries(trx, runId, run.month);

      await writeAudit(trx, {
        actorUserId,
        entity: 'pay.payroll_runs',
        entityId: runId,
        action: 'payroll_run_finalized',
        newValue: JSON.stringify({
          employeeCount: recon.employeeCount,
          totalGrossRupees: recon.totalGrossRupees,
          totalNetRupees: recon.totalNetRupees,
          reconciled: recon.isReconciled,
          loanPostings: postings.loanPostings,
          arrearsSettled: postings.arrearsSettled,
        }),
      });
    });
  }

  /**
   * 7. Reopen run: Audited reversal back to draft/inputs_locked.
   */
  async reopenRun(runId: number, reason: string, actorUserId: number): Promise<void> {
    return this.withLockedRun(runId, async (trx, run) => {
      const validation = validateRunTransition({
        fromStatus: run.status,
        toStatus: 'reopened',
        reopenReason: reason,
        actorUserId,
      });

      if (!validation.valid) {
        throw new DomainError(validation.error ?? 'This run cannot move to that state now', 'CONFLICT');
      }

      if (run.status === 'finalized') {
        const balances = await trx.selectFrom('pay.recovery_carry_forwards').select('consumed_run_id')
          .where('from_run_id', '=', runId).orderBy('id').forUpdate().execute();
        if (balances.some(balance => balance.consumed_run_id !== null)) {
          throw new DomainError('A later payroll run has consumed this run’s recovery balance. Reconcile that dependent run before reopening.', 'CONFLICT');
        }
        await this.reverseRunRecoveries(trx, runId);
      }

      await trx
        .updateTable('pay.payroll_runs')
        .set({
          status: 'reopened',
          notes: `Reopened: ${reason}`,
        })
        .where('id', '=', runId)
        .execute();

      await writeAudit(trx, {
        actorUserId,
        entity: 'pay.payroll_runs',
        entityId: runId,
        action: 'payroll_run_reopened',
        oldValue: run.status,
        newValue: 'reopened',
      });
    });
  }

  /**
   * Send an unapproved run back to draft so variable inputs can be corrected
   * (inputs_locked / computed / under_review / reopened → draft). Computed items are
   * discarded on the next compute; audited.
   */
  async returnToDraft(runId: number, actorUserId: number, reason: string): Promise<void> {
    return this.withLockedRun(runId, async (trx, run) => {
      // E2E-021: a reopened run (super-admin sanctioned) may also go back to draft to correct inputs.
      if (!['inputs_locked', 'computed', 'under_review', 'reopened'].includes(run.status)) {
        throw new DomainError(`A ${run.status} run cannot go back to draft${run.status === 'approved' || run.status === 'finalized' ? ' (ask a super admin to reopen it)' : ''}`, 'CONFLICT');
      }
      // Draft results cannot reserve settled balances against other runs. A
      // fresh compute must re-read the currently eligible origins.
      const released = await trx.updateTable('pay.recovery_carry_forwards').set({ consumed_run_id: null })
        .where('consumed_run_id', '=', runId).executeTakeFirst();
      await trx.updateTable('pay.payroll_runs').set({ status: 'draft' }).where('id', '=', runId).execute();
      await writeAudit(trx, { actorUserId, entity: 'pay.payroll_runs', entityId: runId, action: 'payroll_run_returned_to_draft', oldValue: run.status, newValue: JSON.stringify({ status: 'draft', reason, releasedRecoveryBalances: Number(released.numUpdatedRows) }) });
    });
  }

  /**
   * 8. Mark a finalized run paid once its bank file exists (finalized → paid).
   */
  async markPaid(runId: number, actorUserId: number, paymentReference: string): Promise<void> {
    return this.withLockedRun(runId, async (trx, run) => {
      const validation = validateRunTransition({ fromStatus: run.status, toStatus: 'paid', actorUserId });
      if (!validation.valid) throw new DomainError(validation.error ?? 'Only a finalized run can be marked paid', 'CONFLICT');
      // Only a bank file generated from THIS finalization counts (a reopen makes older files stale).
      const batch = await trx.selectFrom('pay.bank_batches').select('id').where('run_id', '=', runId)
        .where('superseded_at', 'is', null)
        .where('created_at', '>=', run.finalized_at ?? new Date()).orderBy('id', 'desc').executeTakeFirst();
      if (!batch) throw new DomainError('Generate the bank file for this finalized run before marking it paid', 'CONFLICT');
      await trx.updateTable('pay.payroll_runs').set({ status: 'paid', notes: `Paid: ${paymentReference}` }).where('id', '=', runId).execute();
      await writeAudit(trx, { actorUserId, entity: 'pay.payroll_runs', entityId: runId, action: 'payroll_run_paid', oldValue: run.status, newValue: JSON.stringify({ paymentReference, bankBatchId: batch.id }) });
    });
  }

  /** Finalize side effects: loan ledger postings (P-08) and settled arrears. */
  private async postRunRecoveries(trx: Kysely<Database>, runId: number, month: Date): Promise<{ loanPostings: number; arrearsSettled: number }> {
    const loanLines = await trx
      .selectFrom('pay.payroll_item_lines as l')
      .innerJoin('pay.payroll_items as i', 'i.id', 'l.item_id')
      .innerJoin('pay.loans as ln', 'ln.id', 'l.loan_id')
      .select(['l.loan_id', 'l.amount', 'ln.outstanding', 'ln.emi', 'ln.interest_rate', 'ln.loan_type'])
      .where('i.run_id', '=', runId)
      .where('i.payment_status', '!=', 'hold_process')
      .where('l.loan_id', 'is not', null)
      .execute();
    let loanPostings = 0;
    for (const line of loanLines) {
      if (line.loan_id === null) continue;
      const recovered = parseRupees(line.amount);
      if (recovered <= 0) continue;
      const { interestPaise } = loanInstalment(line);
      const interest = Math.min(interestPaise, recovered);
      const principal = Math.min(recovered - interest, parseRupees(line.outstanding));
      const remaining = parseRupees(line.outstanding) - principal;
      await trx.insertInto('pay.loan_postings').values({ loan_id: line.loan_id, run_id: runId, principal_part: decimalRupees(paise(principal)), interest_part: decimalRupees(paise(interest)) }).execute();
      await trx.updateTable('pay.loans').set({ outstanding: decimalRupees(paise(remaining)), status: remaining <= 0 ? 'closed' : 'active' }).where('id', '=', line.loan_id).execute();
      loanPostings++;
    }
    const settled = await trx
      .updateTable('pay.arrears')
      .set({ paid_in_run_id: runId })
      .where('paid_in_run_id', 'is', null)
      .where('for_month', '<=', month)
      .where('employee_id', 'in', trx.selectFrom('pay.payroll_items').select('employee_id').where('run_id', '=', runId).where('payment_status', '!=', 'hold_process'))
      .executeTakeFirst();
    return { loanPostings, arrearsSettled: Number(settled.numUpdatedRows) };
  }

  /** Reopening a finalized run undoes its loan postings and arrears settlement. */
  private async reverseRunRecoveries(trx: Kysely<Database>, runId: number): Promise<void> {
    const postings = await trx.selectFrom('pay.loan_postings').select(['id', 'loan_id', 'principal_part']).where('run_id', '=', runId).execute();
    for (const p of postings) {
      await trx.updateTable('pay.loans').set((eb) => ({ outstanding: eb('outstanding', '+', p.principal_part), status: 'active' })).where('id', '=', p.loan_id).execute();
    }
    await trx.deleteFrom('pay.loan_postings').where('run_id', '=', runId).execute();
    await trx.updateTable('pay.arrears').set({ paid_in_run_id: null }).where('paid_in_run_id', '=', runId).execute();
  }

  /**
   * Get single run details by ID.
   */
  async getRun(runId: number): Promise<RunSummary | null> {
    return readRunSummary(this.db, runId);
  }

  async listRuns(companyId?: number): Promise<RunSummary[]> {
    return readRunSummaries(this.db, companyId);
  }

  private async withLockedRun<T>(
    runId: number,
    operation: (trx: Kysely<Database>, run: Selectable<PayrollRunsTable>) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(async (trx) => {
      const run = await trx
        .selectFrom('pay.payroll_runs')
        .selectAll()
        .where('id', '=', runId)
        .forUpdate()
        .executeTakeFirst();
      if (!run) throw new NotFoundError(`Payroll run #${String(runId)} not found.`);
      return operation(trx, run);
    });
  }

  private async withTransaction<T>(operation: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
    // Workers may already hold the wider source/result transaction.
    if (this.db.isTransaction) return operation(this.db);
    return inTransaction(this.db, operation);
  }
}
