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
export type { RunSummary } from './run.repository.js';
import { ReconciliationService } from '../reconciliation/reconciliation.service.js';
import type { PayrollRunType, PayrollRunsTable } from '../../../core/db/types.js';

export interface CreateRunInput {
  companyId: number;
  month: string; // YYYY-MM-01
  runType?: PayrollRunType | undefined;
  attendanceLockId?: number | null | undefined;
  notes?: string | undefined;
  actorUserId: number;
}

export class PayrollRunService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * 1. Create a new payroll run in 'draft' status.
   */
  async createRun(input: CreateRunInput): Promise<number> {
    return this.withTransaction(async (trx) => {
      const runType = input.runType ?? 'regular';

      const existing = await trx
        .selectFrom('pay.payroll_runs')
        .select('id')
        .where('company_id', '=', input.companyId)
        .where('month', '=', input.month as unknown as Date)
        .where('run_type', '=', runType)
        .executeTakeFirst();

      if (existing) {
        throw new Error(
          `A ${runType} payroll run already exists for company #${String(input.companyId)} on ${input.month}.`,
        );
      }

      const inserted = await trx
        .insertInto('pay.payroll_runs')
        .values({
          company_id: input.companyId,
          month: input.month as unknown as Date,
          run_type: runType,
          status: 'draft',
          attendance_lock_id: input.attendanceLockId ?? null,
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
        throw new Error(validation.error);
      }

      await trx
        .updateTable('pay.payroll_runs')
        .set({
          status: 'inputs_locked',
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
    return this.withLockedRun(runId, (trx, run) => computeLockedRun(trx, run, actorUserId));
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
        throw new Error(validation.error);
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
        throw new Error(validation.error);
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
      // Run independent secondary reconciliation
      const recon = await new ReconciliationService(trx).reconcileRun(runId);
      if (!recon.isReconciled) {
        throw new Error(`Cannot finalize payroll run: ${recon.anomalies.join(' ')}`);
      }

      const validation = validateRunTransition({
        fromStatus: run.status,
        toStatus: 'finalized',
        reconciliationDiffPaise: recon.discrepancyPaise,
        actorUserId,
      });

      if (!validation.valid) {
        throw new Error(validation.error);
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
        throw new Error(validation.error);
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
      if (!run) throw new Error(`Payroll run #${String(runId)} not found.`);
      return operation(trx, run);
    });
  }

  private async withTransaction<T>(operation: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
    // Workers may already hold the wider source/result transaction.
    if (this.db.isTransaction) return operation(this.db);
    return this.db.transaction().execute(operation);
  }
}
