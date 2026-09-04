/**
 * SHF-08 / LV-03 coverage math — hand-computed weights and user-facing copy.
 * The processor is not the source of expected values.
 */
import { describe, expect, it } from 'vitest';
import {
  formatCoverageWarning,
  formatHeadcount,
  leaveWeightOnDate,
} from '../src/modules/leave/coverage-check.service.js';
import { leaveBlackoutMessage } from '../src/modules/leave/leave-blackout.js';

describe('leaveWeightOnDate', () => {
  it('is 1 on a full day inside the span and 0 outside', () => {
    const span = { from: '2026-12-14', to: '2026-12-16' };
    expect(leaveWeightOnDate('2026-12-13', span)).toBe(0);
    expect(leaveWeightOnDate('2026-12-14', span)).toBe(1);
    expect(leaveWeightOnDate('2026-12-15', span)).toBe(1);
    expect(leaveWeightOnDate('2026-12-16', span)).toBe(1);
    expect(leaveWeightOnDate('2026-12-17', span)).toBe(0);
  });

  it('is 0.5 on a half-day edge (hand: morning off is not a full head)', () => {
    expect(leaveWeightOnDate('2026-12-14', { from: '2026-12-14', to: '2026-12-14', fromHalf: true })).toBe(0.5);
    expect(leaveWeightOnDate('2026-12-14', { from: '2026-12-14', to: '2026-12-16', fromHalf: true })).toBe(0.5);
    expect(leaveWeightOnDate('2026-12-15', { from: '2026-12-14', to: '2026-12-16', fromHalf: true })).toBe(1);
    expect(leaveWeightOnDate('2026-12-16', { from: '2026-12-14', to: '2026-12-16', toHalf: true })).toBe(0.5);
  });
});

describe('formatCoverageWarning', () => {
  it('names the shift and date without internal setting keys', () => {
    const text = formatCoverageWarning({
      shiftCode: 'GEN',
      date: '2026-12-14',
      remaining: 0,
      sanctioned: 1,
      shortfall: 1,
      blocked: false,
    });
    expect(text).toBe(
      'GEN on 14 Dec 2026 would leave 0 against the sanctioned 1 (shortfall 1). Your manager can still approve.',
    );
    expect(text).not.toMatch(/SHF-08|att\.leave_coverage_hard_block/);
  });

  it('says the policy is blocking when the hard-block setting is on', () => {
    expect(
      formatCoverageWarning({
        shiftCode: 'GEN',
        date: '2026-12-14',
        remaining: 0.5,
        sanctioned: 1,
        shortfall: 0.5,
        blocked: true,
      }),
    ).toBe(
      'GEN on 14 Dec 2026 would leave 0.5 against the sanctioned 1 (shortfall 0.5). Coverage policy is blocking this request.',
    );
  });

  it('formatHeadcount keeps whole heads as integers', () => {
    expect(formatHeadcount(0)).toBe('0');
    expect(formatHeadcount(1)).toBe('1');
    expect(formatHeadcount(0.5)).toBe('0.5');
  });
});

describe('leaveBlackoutMessage', () => {
  it('names the blackout date the way the calendar does', () => {
    expect(leaveBlackoutMessage({ date: '2026-12-14', name: 'Year-end shutdown' })).toBe(
      'Leave is blocked on 14 Dec 2026 (Year-end shutdown).',
    );
  });
});
