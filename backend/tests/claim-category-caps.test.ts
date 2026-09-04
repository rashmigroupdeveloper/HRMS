/**
 * D2 — the budget check is PER CATEGORY, never on a total.
 *
 * Ported from the live `assertBudgetLimits` in `claimBudgetLogic.ts`
 * (docs/recon/ems-claims-live-schema.md §7). A total-only check lets someone
 * blow the hotel line while staying under the overall budget, which is the
 * whole reason the live system caps each category separately.
 *
 * `netClaimedForLimitCheck(claimed, credit) = max(0, claimed − credit)` where
 * `credit` is what THIS claim already holds, so a resubmit nets out its own
 * prior reservation instead of double-counting it.
 */
import { describe, expect, it } from 'vitest';
import {
  assertCategoryCaps,
  netClaimedForLimitCheck,
  normalizeExpenseType,
  sumByCategory,
  type CategoryTotals,
} from '../src/modules/claims/category-caps.js';

const zero: CategoryTotals = {
  travel: 0,
  hotel: 0,
  daily_allowance: 0,
  visa: 0,
  local_travel: 0,
  misc: 0,
};

const caps: CategoryTotals = {
  travel: 20_000,
  hotel: 15_000,
  daily_allowance: 6_000,
  visa: 0,
  local_travel: 3_000,
  misc: 2_000,
};

describe('normalizeExpenseType — legacy spellings all exist in live data', () => {
  it('folds every daily-allowance spelling into one bucket', () => {
    for (const raw of ['daily_allowances', 'daily_allowance', 'food']) {
      expect(normalizeExpenseType(raw)).toBe('daily_allowance');
    }
  });

  it('folds every local-travel spelling into one bucket', () => {
    for (const raw of ['local_travel', 'local transport', 'local_transport']) {
      expect(normalizeExpenseType(raw)).toBe('local_travel');
    }
  });

  it('passes the plain types through', () => {
    for (const raw of ['travel', 'hotel', 'visa']) {
      expect(normalizeExpenseType(raw)).toBe(raw);
    }
  });

  it('treats anything unrecognised — including nothing at all — as miscellaneous', () => {
    // Better a claim lands in misc than vanishes from every cap.
    expect(normalizeExpenseType('cab fare')).toBe('misc');
    expect(normalizeExpenseType(undefined)).toBe('misc');
  });
});

describe('sumByCategory', () => {
  it('buckets items by their normalised type', () => {
    const totals = sumByCategory([
      { expenseType: 'travel', amount: 12_000 },
      { expenseType: 'food', amount: 1_500 },
      { expenseType: 'daily_allowances', amount: 500 },
      { expenseType: 'local transport', amount: 300 },
      { expenseType: undefined, amount: 200 },
    ]);
    expect(totals).toEqual({
      ...zero,
      travel: 12_000,
      daily_allowance: 2_000,
      local_travel: 300,
      misc: 200,
    });
  });
});

describe('netClaimedForLimitCheck', () => {
  it('nets out what this claim already holds', () => {
    expect(netClaimedForLimitCheck(10_000, 4_000)).toBe(6_000);
  });

  it('never goes negative', () => {
    expect(netClaimedForLimitCheck(1_000, 4_000)).toBe(0);
  });
});

describe('assertCategoryCaps', () => {
  it('allows a claim inside every cap', () => {
    const result = assertCategoryCaps({
      caps,
      alreadyClaimed: { ...zero, travel: 5_000 },
      credit: zero,
      requested: { ...zero, travel: 10_000, hotel: 5_000 },
    });
    expect(result).toEqual({ ok: true });
  });

  it('refuses when ONE category is over, even though the total fits', () => {
    // The defect this exists to prevent: total 20,000 against a 46,000 budget
    // looks fine, but hotel is 5,000 over its own line.
    const result = assertCategoryCaps({
      caps,
      alreadyClaimed: zero,
      credit: zero,
      requested: { ...zero, travel: 0, hotel: 20_000 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe('hotel');
    expect(result.message).toBe('Claim amount exceeds available hotel budget');
  });

  it('counts what was already claimed against the cap', () => {
    const result = assertCategoryCaps({
      caps,
      alreadyClaimed: { ...zero, travel: 18_000 },
      credit: zero,
      requested: { ...zero, travel: 3_000 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe('travel');
  });

  it('nets out this claim‘s own prior reservation on a resubmit', () => {
    // Without the credit this resubmit would be refused against its own money.
    const result = assertCategoryCaps({
      caps,
      alreadyClaimed: { ...zero, travel: 18_000 },
      credit: { ...zero, travel: 18_000 },
      requested: { ...zero, travel: 19_000 },
    });
    expect(result).toEqual({ ok: true });
  });

  it('refuses a category whose cap is zero', () => {
    // visa cap is 0 here — a trip with no visa budget cannot carry a visa cost.
    const result = assertCategoryCaps({
      caps,
      alreadyClaimed: zero,
      credit: zero,
      requested: { ...zero, visa: 1 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe('visa');
  });

  it('reports the FIRST breached category in the live order', () => {
    // travel is checked before hotel, so a claim breaching both names travel —
    // matching the order the live code throws in.
    const result = assertCategoryCaps({
      caps,
      alreadyClaimed: zero,
      credit: zero,
      requested: { ...zero, travel: 99_000, hotel: 99_000 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe('travel');
  });

  it('allows a claim that lands exactly on a cap', () => {
    const result = assertCategoryCaps({
      caps,
      alreadyClaimed: zero,
      credit: zero,
      requested: { ...zero, hotel: 15_000 },
    });
    expect(result).toEqual({ ok: true });
  });
});
