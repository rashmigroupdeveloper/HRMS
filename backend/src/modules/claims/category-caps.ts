/**
 * D2 — per-category budget caps, ported from the live `assertBudgetLimits`
 * (docs/recon/ems-claims-live-schema.md §7).
 *
 * A budget is not one number. Travel, hotel, daily allowance, visa, local
 * conveyance and miscellaneous each carry their own ceiling, and each is
 * checked on its own. Checking only the total would let a claim blow the hotel
 * line while sitting comfortably under the overall figure — which is precisely
 * what the live system refuses.
 *
 * Amounts here are integer paise, like everywhere else money is handled.
 */

export type ExpenseCategory =
  | 'travel'
  | 'hotel'
  | 'daily_allowance'
  | 'visa'
  | 'local_travel'
  | 'misc';

export type CategoryTotals = Record<ExpenseCategory, number>;

/**
 * The order the live code checks in, and therefore the order a breach is
 * reported in. Kept explicit so the message a user sees does not change just
 * because an object's key order did.
 */
const CHECK_ORDER: readonly ExpenseCategory[] = [
  'travel',
  'hotel',
  'daily_allowance',
  'visa',
  'local_travel',
  'misc',
];

const LABEL: Record<ExpenseCategory, string> = {
  travel: 'travel',
  hotel: 'hotel',
  daily_allowance: 'daily allowance',
  visa: 'visa',
  local_travel: 'local travel',
  misc: 'miscellaneous',
};

/**
 * Legacy data carries several spellings for the same thing, so every item is
 * normalised before it is counted. An importer that skips this mis-buckets real
 * claims — and a mis-bucketed claim is checked against the wrong ceiling.
 */
export function normalizeExpenseType(raw: string | undefined): ExpenseCategory {
  switch (raw) {
    case 'daily_allowances':
    case 'daily_allowance':
    case 'food':
      return 'daily_allowance';
    case 'local_travel':
    case 'local transport':
    case 'local_transport':
      return 'local_travel';
    case 'travel':
      return 'travel';
    case 'hotel':
      return 'hotel';
    case 'visa':
      return 'visa';
    default:
      // Anything unrecognised falls into misc rather than escaping every cap.
      return 'misc';
  }
}

export function emptyTotals(): CategoryTotals {
  return { travel: 0, hotel: 0, daily_allowance: 0, visa: 0, local_travel: 0, misc: 0 };
}

export function sumByCategory(
  items: readonly { expenseType: string | undefined; amount: number }[],
): CategoryTotals {
  const totals = emptyTotals();
  for (const item of items) {
    totals[normalizeExpenseType(item.expenseType)] += item.amount;
  }
  return totals;
}

/**
 * What counts against a cap: everything already claimed, MINUS what this claim
 * itself currently holds. Without the credit a resubmission would be refused
 * against its own money.
 */
export function netClaimedForLimitCheck(claimed: number, credit: number): number {
  return Math.max(0, claimed - credit);
}

export type CapResult =
  | { ok: true }
  | {
      ok: false;
      category: ExpenseCategory;
      message: string;
      capMinor: number;
      alreadyMinor: number;
      requestedMinor: number;
      shortfallMinor: number;
    };

export function assertCategoryCaps(input: {
  caps: CategoryTotals;
  alreadyClaimed: CategoryTotals;
  /** What this claim already holds against the budget (0 for a first submit). */
  credit: CategoryTotals;
  requested: CategoryTotals;
}): CapResult {
  for (const category of CHECK_ORDER) {
    const already = netClaimedForLimitCheck(
      input.alreadyClaimed[category],
      input.credit[category],
    );
    const cap = input.caps[category];
    const requested = input.requested[category];

    if (already + requested > cap) {
      return {
        ok: false,
        category,
        // Wording matches the live ClaimValidationError so the message a person
        // sees does not change with the port.
        message: `Claim amount exceeds available ${LABEL[category]} budget`,
        capMinor: cap,
        alreadyMinor: already,
        requestedMinor: requested,
        shortfallMinor: already + requested - cap,
      };
    }
  }
  return { ok: true };
}
