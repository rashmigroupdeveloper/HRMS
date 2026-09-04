/**
 * Phase 3.5 Stage T1 — budget and claim lifecycle.
 *
 * The rules ported verbatim from the live EMS, because they are the ones
 * people's money depends on:
 *  · a budget must be `approved` before anything can be claimed against it;
 *  · the claimed amount is committed at SUBMISSION, not at approval;
 *  · a rejection or send-back gives the commitment back;
 *  · one live claim per budget.
 *
 * Every commit and release happens inside a transaction that has locked the
 * budget row, so two simultaneous submissions cannot both read the same
 * headroom and both succeed.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';
import { paise, type Paise } from '../../core/money/index.js';
import {
  checkReservation,
  refusalMessage,
  type ReservationDecision,
} from './reservation.js';
import {
  heldByClaim,
  numericToPaise,
  paiseToNumeric,
  readHeadroom,
  releaseForClaim,
  reservedByCategory,
  writeReserve,
} from './ledger.service.js';
import { formatDbDate } from '../../core/dates.js';
import {
  assertCategoryCaps,
  emptyTotals,
  normalizeExpenseType,
  type CapResult,
  type CategoryTotals,
} from './category-caps.js';

export type SubmitResult =
  | { ok: true; reservedMinor: number }
  | { ok: false; reason: 'not_found' | 'not_draft'; message: string }
  | { ok: false; reason: 'refused'; message: string; decision: ReservationDecision }
  | { ok: false; reason: 'category_cap'; message: string; cap: Extract<CapResult, { ok: false }> };

/** What this claim's lines add up to, bucket by bucket. */
async function requestedByCategory(
  db: Parameters<typeof heldByClaim>[0],
  claimId: number,
): Promise<CategoryTotals> {
  const lines = await db
    .selectFrom('pay.claim_lines as l')
    .innerJoin('pay.claim_types as t', 't.id', 'l.claim_type_id')
    .select(['t.code', 'l.amount'])
    .where('l.claim_id', '=', claimId)
    .execute();

  const totals = emptyTotals();
  for (const line of lines) {
    totals[normalizeExpenseType(line.code)] += numericToPaise(line.amount);
  }
  return totals;
}

/** The per-category ceilings on a budget. A category with no row has no cap. */
async function capsForBudget(
  db: Parameters<typeof heldByClaim>[0],
  budgetId: number,
): Promise<CategoryTotals | null> {
  const rows = await db
    .selectFrom('pay.budget_categories as c')
    .innerJoin('pay.claim_types as t', 't.id', 'c.claim_type_id')
    .select(['t.code', 'c.allowance'])
    .where('c.budget_id', '=', budgetId)
    .execute();

  // No category rows at all = this budget is governed by its total only, which
  // is a legitimate shape. Returning null says "skip the per-category pass"
  // rather than silently capping every category at zero.
  if (rows.length === 0) return null;

  const caps = emptyTotals();
  for (const row of rows) {
    caps[normalizeExpenseType(row.code)] += numericToPaise(row.allowance);
  }
  return caps;
}

/**
 * Submit a claim: commit its amount against the budget, or refuse with the
 * numbers named. Refusal messages carry the limit and the shortfall so the UI
 * never has to recompute them (the "blocked action explains itself" rule).
 */
export async function submitClaim(
  db: Kysely<Database>,
  input: { claimId: number; actorUserId: number },
): Promise<SubmitResult> {
  return db.transaction().execute(async (trx) => {
    const claim = await trx
      .selectFrom('pay.claims')
      .select(['id', 'status', 'budget_id', 'claimed_amount', 'reference'])
      .where('id', '=', input.claimId)
      .forUpdate()
      .executeTakeFirst();

    if (!claim) {
      return { ok: false as const, reason: 'not_found' as const, message: 'Claim not found' };
    }
    if (claim.status !== 'draft' && claim.status !== 'sent_back') {
      return {
        ok: false as const,
        reason: 'not_draft' as const,
        message: 'Only a draft or sent-back claim can be submitted',
      };
    }
    // Locks the budget row for the rest of the transaction.
    const headroom = await readHeadroom(trx, claim.budget_id, { lock: true });
    if (!headroom) {
      return { ok: false as const, reason: 'not_found' as const, message: 'Budget not found' };
    }

    const requested = numericToPaise(claim.claimed_amount);
    // A resubmitted claim may already hold a commitment; only the delta matters.
    const alreadyHeld = await heldByClaim(trx, claim.id);

    const decision = checkReservation({
      allowanceMinor: headroom.allowance,
      reservedMinor: paise(headroom.reserved - alreadyHeld),
      requestedMinor: requested,
      fundingApproved: headroom.approved,
    });

    if (!decision.allowed) {
      return {
        ok: false as const,
        reason: 'refused' as const,
        message: refusalMessage(decision),
        decision,
      };
    }

    // D2 — the per-category pass. A claim can fit the total and still blow one
    // line; the live system caps each category separately and so must we.
    const requestedCats = await requestedByCategory(trx, claim.id);
    const caps = await capsForBudget(trx, claim.budget_id);
    if (caps !== null) {
      const already = await reservedByCategory(trx, claim.budget_id, {
        excludeClaimId: claim.id,
      });
      const capResult = assertCategoryCaps({
        caps,
        alreadyClaimed: already,
        credit: emptyTotals(), // already excludes this claim, so nothing to net
        requested: requestedCats,
      });
      if (!capResult.ok) {
        return {
          ok: false as const,
          reason: 'category_cap' as const,
          message: capResult.message,
          cap: capResult,
        };
      }
    }

    if (alreadyHeld > 0) {
      await releaseForClaim(trx, {
        claimId: claim.id,
        reason: `resubmission of ${claim.reference}`,
        actorUserId: input.actorUserId,
      });
    }
    await writeReserve(trx, {
      budgetId: claim.budget_id,
      claimId: claim.id,
      amount: requested,
      byCategory: requestedCats,
      reason: `submitted ${claim.reference}`,
      actorUserId: input.actorUserId,
    });

    await trx
      .updateTable('pay.claims')
      .set({ status: 'submitted', submitted_at: new Date() })
      .where('id', '=', claim.id)
      .execute();

    return { ok: true as const, reservedMinor: requested };
  });
}

/**
 * Route a submitted claim through the approval engine.
 *
 * Kept as a second step on purpose: `submitClaim` owns the money (the budget
 * row is locked while its headroom is checked and committed), and the engine
 * owns the routing. Running the engine's transaction inside the money one would
 * hold the budget lock for the length of approver resolution and notification.
 *
 * The engine gives us, free: RM → HOD → hr_head with vacant/self/duplicate
 * steps skipped and audited, per-step SLA and escalation, delegation, and the
 * `notified_at` receipt that makes "the approver was never told" impossible.
 */
export async function routeClaimForApproval(
  db: Kysely<Database>,
  input: { claimId: number; employeeId: number; requestedByUserId: number },
): Promise<number> {
  const claim = await db
    .selectFrom('pay.claims')
    .select(['reference', 'claimed_amount', 'period_from', 'period_to', 'budget_id'])
    .where('id', '=', input.claimId)
    .executeTakeFirstOrThrow();

  const budget = await db
    .selectFrom('pay.budgets')
    .select(['title', 'allowance', 'approved_allowance'])
    .where('id', '=', claim.budget_id)
    .executeTakeFirst();

  // The lines travel WITH the request, not fetched at read time. An approver
  // must see what they actually approved, and a claim edited afterwards must
  // not silently rewrite the history of that decision.
  const lines = await db
    .selectFrom('pay.claim_lines as l')
    .innerJoin('pay.claim_types as t', 't.id', 'l.claim_type_id')
    .select(['t.name as type', 'l.description', 'l.spent_on', 'l.bill_no', 'l.amount'])
    .where('l.claim_id', '=', input.claimId)
    .orderBy('l.spent_on')
    .execute();

  const headroom = await readHeadroom(db, claim.budget_id);

  return createRequest(
    db,
    {
      definitionCode: 'claim',
      subjectEmployeeId: input.employeeId,
      requestedByUserId: input.requestedByUserId,
      // The payload is what an approver reads in their inbox, so it carries the
      // facts of the decision — not ids they would have to look up.
      payload: {
        claimId: input.claimId,
        reference: claim.reference,
        amount: claim.claimed_amount,
        budgetTitle: budget?.title ?? null,
        // The ruler the amount is read against (docs/05 §9.6) — an approver
        // seeing "6,000" needs "of 20,000" to know whether that is a lot.
        budgetAllowance: paiseToNumeric(headroom?.allowance ?? paise(0)),
        budgetRemaining: paiseToNumeric(headroom?.remaining ?? paise(0)),
        periodFrom: formatDbDate(claim.period_from),
        periodTo: formatDbDate(claim.period_to),
        lines: lines.map((l) => ({
          type: l.type,
          description: l.description,
          spentOn: formatDbDate(l.spent_on),
          billNo: l.bill_no,
          amount: l.amount,
        })),
      },
    },
    async (trx, requestId) => {
      await trx
        .updateTable('pay.claims')
        .set({ workflow_request_id: requestId })
        .where('id', '=', input.claimId)
        .execute();
    },
  );
}

/**
 * The engine's verdict, applied to the claim. Runs INSIDE the approving
 * transaction, so the decision and its money consequence commit together.
 *
 * Approval keeps the commitment — the money is now genuinely owed and clears at
 * settlement. Rejection and lapse give it back, which is the half people forget
 * and the reason budgets slowly starve on money nothing is spending.
 */
export async function applyClaimOnFinal(
  db: Parameters<typeof releaseForClaim>[0],
  request: RequestRow,
  status: WorkflowFinalStatus,
): Promise<void> {
  const claim = await db
    .selectFrom('pay.claims')
    .select(['id', 'status', 'claimed_amount', 'reference'])
    .where('workflow_request_id', '=', request.id)
    .executeTakeFirst();
  if (claim?.status !== 'submitted') return;

  if (status === 'approved') {
    await db
      .updateTable('pay.claims')
      .set({
        status: 'approved',
        approved_amount: claim.claimed_amount,
        decided_at: new Date(),
      })
      .where('id', '=', claim.id)
      .execute();
    return;
  }

  await releaseForClaim(db, {
    claimId: claim.id,
    reason: `${status} by approver`,
    actorUserId: request.requested_by,
  });
  await db
    .updateTable('pay.claims')
    .set({
      status: 'rejected',
      decided_at: new Date(),
      rejection_reason: status === 'lapsed' ? 'No decision within the SLA' : 'Declined by approver',
    })
    .where('id', '=', claim.id)
    .execute();
}

export type DecideResult =
  | { ok: true; releasedMinor: number }
  | { ok: false; reason: 'not_found' | 'not_submitted'; message: string };

/**
 * Reject or send back: the commitment returns to the budget immediately. This
 * is the half people forget, and forgetting it is why a budget slowly runs out
 * of headroom that nothing is actually spending.
 */
export async function releaseClaim(
  db: Kysely<Database>,
  input: {
    claimId: number;
    actorUserId: number;
    outcome: 'rejected' | 'sent_back';
    reason: string;
  },
): Promise<DecideResult> {
  return db.transaction().execute(async (trx) => {
    const claim = await trx
      .selectFrom('pay.claims')
      .select(['id', 'status', 'reference'])
      .where('id', '=', input.claimId)
      .forUpdate()
      .executeTakeFirst();

    if (!claim) {
      return { ok: false as const, reason: 'not_found' as const, message: 'Claim not found' };
    }
    if (claim.status !== 'submitted') {
      return {
        ok: false as const,
        reason: 'not_submitted' as const,
        message: 'Only a submitted claim can be rejected or sent back',
      };
    }

    const released = await releaseForClaim(trx, {
      claimId: claim.id,
      reason: `${input.outcome}: ${input.reason}`,
      actorUserId: input.actorUserId,
    });

    await trx
      .updateTable('pay.claims')
      .set({
        status: input.outcome,
        decided_at: new Date(),
        ...(input.outcome === 'rejected' ? { rejection_reason: input.reason } : {}),
      })
      .where('id', '=', claim.id)
      .execute();

    return { ok: true as const, releasedMinor: released };
  });
}

/**
 * Approve a claim. The commitment STAYS held — approval does not release it,
 * because the money is now genuinely owed. It clears at settlement, when it
 * becomes a payroll or batch payment.
 */
export async function approveClaim(
  db: Kysely<Database>,
  input: { claimId: number; actorUserId: number; approvedAmount?: Paise },
): Promise<DecideResult> {
  const claim = await db
    .selectFrom('pay.claims')
    .select(['id', 'status', 'claimed_amount', 'reference'])
    .where('id', '=', input.claimId)
    .executeTakeFirst();

  if (!claim) {
    return { ok: false as const, reason: 'not_found' as const, message: 'Claim not found' };
  }
  if (claim.status !== 'submitted') {
    return {
      ok: false as const,
      reason: 'not_submitted' as const,
      message: 'Only a submitted claim can be approved',
    };
  }

  const approved = input.approvedAmount ?? numericToPaise(claim.claimed_amount);

  await db
    .updateTable('pay.claims')
    .set({
      status: 'approved',
      approved_amount: paiseToNumeric(approved),
      decided_at: new Date(),
    })
    .where('id', '=', claim.id)
    .execute();

  await writeAudit(db, {
    actorUserId: input.actorUserId,
    action: 'approve',
    entity: 'pay.claims',
    entityId: claim.id,
    newValue: `${claim.reference} approved ${paiseToNumeric(approved)}`,
  });

  return { ok: true as const, releasedMinor: 0 };
}

export interface BudgetPosition {
  budgetId: number;
  reference: string;
  title: string;
  status: string;
  allowance: string;
  reserved: string;
  remaining: string;
  approved: boolean;
}

export async function budgetPosition(
  db: Kysely<Database>,
  budgetId: number,
): Promise<BudgetPosition | undefined> {
  const budget = await db
    .selectFrom('pay.budgets')
    .select(['id', 'reference', 'title', 'status'])
    .where('id', '=', budgetId)
    .executeTakeFirst();
  if (!budget) return undefined;

  const headroom = await readHeadroom(db, budgetId);
  if (!headroom) return undefined;

  return {
    budgetId: budget.id,
    reference: budget.reference,
    title: budget.title,
    status: budget.status,
    allowance: paiseToNumeric(headroom.allowance),
    reserved: paiseToNumeric(headroom.reserved),
    remaining: paiseToNumeric(headroom.remaining),
    approved: headroom.approved,
  };
}
