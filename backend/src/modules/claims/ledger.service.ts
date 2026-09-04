/**
 * Phase 3.5 Stage T1 — the budget commitment ledger.
 *
 * Headroom is `allowance − SUM(reserve) + SUM(release)`, computed from
 * `pay.claim_reservations` every time. There is deliberately no `remaining`
 * column: a running total that the application maintains is a running total
 * the application can get wrong, and the wrongness is invisible until finance
 * finds it. The ledger is append-only at the database, so a release is a new
 * row and the history of what was held, and when, survives.
 *
 * Money crosses the DB boundary here and only here: NUMERIC arrives as a
 * string from node-postgres and becomes branded `Paise` before any arithmetic
 * happens (docs/14 §6 — floats never touch money).
 */
import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { paise, type Paise } from '../../core/money/index.js';
import { emptyTotals, type CategoryTotals, type ExpenseCategory } from './category-caps.js';

type Db = Kysely<Database> | Transaction<Database>;

/** NUMERIC(14,2) string → integer paise. Rounded because 0.1+0.2 exists. */
export function numericToPaise(value: string | number | null): Paise {
  if (value === null) return paise(0);
  return paise(Math.round(Number(value) * 100));
}

/** Integer paise → the string form NUMERIC expects, exact to two places. */
export function paiseToNumeric(amount: Paise): string {
  return (amount / 100).toFixed(2);
}

export interface BudgetHeadroom {
  allowance: Paise;
  reserved: Paise;
  remaining: Paise;
  approved: boolean;
}

/**
 * Read a budget's live position.
 *
 * `FOR UPDATE` on the budget row when called inside a transaction: two claims
 * submitted in the same instant must not both read the same headroom and both
 * pass. Serialising on the budget row is what makes the reservation rule hold
 * under concurrency, which is exactly the case the rule exists for.
 */
export async function readHeadroom(
  db: Db,
  budgetId: number,
  opts: { lock?: boolean } = {},
): Promise<BudgetHeadroom | undefined> {
  let query = db
    .selectFrom('pay.budgets')
    .select(['allowance', 'approved_allowance', 'status'])
    .where('id', '=', budgetId);
  if (opts.lock === true) query = query.forUpdate();

  const budget = await query.executeTakeFirst();
  if (!budget) return undefined;

  const movements = await db
    .selectFrom('pay.claim_reservations')
    .select((eb) => [
      eb.fn
        .sum<string>(
          sql<string>`CASE WHEN movement = 'reserve' THEN amount ELSE -amount END`,
        )
        .as('net'),
    ])
    .where('budget_id', '=', budgetId)
    .executeTakeFirst();

  // Draw on what was APPROVED, never on what was asked for. The live model
  // keeps totalEstimatedCost and approvedBudget apart precisely because an
  // approver may grant less than the request, and claiming against the request
  // would let a budget spend money nobody sanctioned.
  const allowance =
    budget.status === 'approved' && budget.approved_allowance !== null
      ? numericToPaise(budget.approved_allowance)
      : numericToPaise(budget.allowance);
  const reserved = numericToPaise(movements?.net ?? 0);

  return {
    allowance,
    reserved,
    remaining: paise(Math.max(0, allowance - reserved)),
    approved: budget.status === 'approved',
  };
}

/**
 * Commit an amount against a budget. Caller has already checked the decision.
 *
 * `byCategory` is stored alongside the total because a budget's categories are
 * individually capped, so a refund has to give back the same buckets it took —
 * the live system keeps the same snapshot for exactly that reason.
 */
export async function writeReserve(
  db: Db,
  input: {
    budgetId: number;
    claimId: number;
    amount: Paise;
    byCategory: CategoryTotals;
    reason: string;
    actorUserId: number;
  },
): Promise<void> {
  await db
    .insertInto('pay.claim_reservations')
    .values({
      budget_id: input.budgetId,
      claim_id: input.claimId,
      movement: 'reserve',
      amount: paiseToNumeric(input.amount),
      by_category: input.byCategory,
      reason: input.reason,
      actor_user_id: input.actorUserId,
    })
    .execute();
}

/** Live per-category commitment against a budget: reserves minus releases. */
export async function reservedByCategory(
  db: Db,
  budgetId: number,
  opts: { excludeClaimId?: number } = {},
): Promise<CategoryTotals> {
  let query = db
    .selectFrom('pay.claim_reservations')
    .select(['movement', 'by_category'])
    .where('budget_id', '=', budgetId);
  if (opts.excludeClaimId !== undefined) {
    query = query.where('claim_id', '<>', opts.excludeClaimId);
  }

  const totals = emptyTotals();
  for (const row of await query.execute()) {
    if (row.by_category === null) continue;
    const sign = row.movement === 'reserve' ? 1 : -1;
    for (const [key, value] of Object.entries(row.by_category)) {
      if (key in totals) totals[key as ExpenseCategory] += sign * value;
    }
  }
  // A release can only ever give back what a reserve took, so a negative here
  // would mean the ledger itself is wrong — clamp rather than propagate it.
  for (const key of Object.keys(totals) as ExpenseCategory[]) {
    totals[key] = Math.max(0, totals[key]);
  }
  return totals;
}

/**
 * Give back whatever a claim currently holds. Computed from the claim's own
 * movements rather than passed in, so a caller cannot release more than was
 * ever reserved — the arithmetic that would quietly inflate a budget.
 */
export async function releaseForClaim(
  db: Db,
  input: { claimId: number; reason: string; actorUserId: number },
): Promise<Paise> {
  const rows = await db
    .selectFrom('pay.claim_reservations')
    .select(['budget_id', 'movement', 'amount', 'by_category'])
    .where('claim_id', '=', input.claimId)
    .execute();

  if (rows.length === 0) return paise(0);

  const budgetId = rows[0]?.budget_id;
  if (budgetId === undefined) return paise(0);

  const held = rows.reduce<number>(
    (total, row) =>
      row.movement === 'reserve'
        ? total + numericToPaise(row.amount)
        : total - numericToPaise(row.amount),
    0,
  );
  if (held <= 0) return paise(0);

  // Release the SNAPSHOT that was taken, bucket for bucket — never a
  // recomputation, which could hand back a different shape than was reserved.
  const heldByCategory = emptyTotals();
  for (const row of rows) {
    if (row.by_category === null) continue;
    const sign = row.movement === 'reserve' ? 1 : -1;
    for (const [key, value] of Object.entries(row.by_category)) {
      if (key in heldByCategory) heldByCategory[key as ExpenseCategory] += sign * value;
    }
  }

  await db
    .insertInto('pay.claim_reservations')
    .values({
      budget_id: budgetId,
      claim_id: input.claimId,
      movement: 'release',
      amount: paiseToNumeric(paise(held)),
      by_category: heldByCategory,
      reason: input.reason,
      actor_user_id: input.actorUserId,
    })
    .execute();

  return paise(held);
}

/** What a single claim currently holds against its budget. */
export async function heldByClaim(db: Db, claimId: number): Promise<Paise> {
  const rows = await db
    .selectFrom('pay.claim_reservations')
    .select(['movement', 'amount'])
    .where('claim_id', '=', claimId)
    .execute();

  return paise(
    rows.reduce<number>(
      (total, row) =>
        row.movement === 'reserve'
          ? total + numericToPaise(row.amount)
          : total - numericToPaise(row.amount),
      0,
    ),
  );
}
