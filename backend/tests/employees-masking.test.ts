/**
 * Unit tests for statutory masking + status labels (P0-T33).
 * Hand-checked expectations — no golden from running the code under test.
 */
import { describe, expect, it } from 'vitest';
import {
  canViewStatutoryIds,
  getOwnProfile,
  statusLabel,
} from '../src/modules/employees/employees.service.js';

describe('canViewStatutoryIds', () => {
  const userOwn = { employee_id: 42 } as { employee_id: number | null };
  const userOther = { employee_id: 99 } as { employee_id: number | null };

  it('denies when permission is absent', () => {
    expect(canViewStatutoryIds(userOwn as never, new Set(), 42)).toBe(false);
  });

  it('allows own record when permission is present', () => {
    expect(
      canViewStatutoryIds(userOwn as never, new Set(['employee.statutory_ids.read']), 42),
    ).toBe(true);
  });

  it('denies peer records for ESS-only holders', () => {
    expect(
      canViewStatutoryIds(userOther as never, new Set(['employee.statutory_ids.read']), 42),
    ).toBe(false);
  });

  it('allows payroll-admin-class unmask for any employee', () => {
    expect(
      canViewStatutoryIds(
        userOther as never,
        new Set(['employee.statutory_ids.read', 'payroll.run.manage']),
        42,
      ),
    ).toBe(true);
  });
});

describe('getOwnProfile', () => {
  it('returns null without touching the DB when the account has no employee link', async () => {
    // db is intentionally a poison value: the null-employee guard must short-circuit
    // before any query, so a self-view for an unlinked account is a clean 404.
    const db = null as never;
    const user = { employee_id: null } as never;
    await expect(getOwnProfile(db, user, new Set())).resolves.toBeNull();
  });
});

describe('statusLabel', () => {
  it('maps statuses to directory labels', () => {
    expect(statusLabel('onboarding', null)).toBe('Onboarding');
    expect(statusLabel('on_notice', null)).toBe('Notice period');
    expect(statusLabel('exited', null)).toBe('Exited');
    expect(statusLabel('active', null)).toBe('Probation');
    expect(statusLabel('active', new Date('2024-01-01'))).toBe('Confirmed');
  });
});
