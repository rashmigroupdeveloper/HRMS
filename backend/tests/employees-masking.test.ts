/**
 * Unit tests for statutory masking + status labels (P0-T33).
 * Hand-checked expectations — no golden from running the code under test.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
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

  it('allows payroll-admin-class unmask for any employee with manage or reopen', () => {
    expect(
      canViewStatutoryIds(
        userOther as never,
        new Set(['employee.statutory_ids.read', 'payroll.run.manage']),
        42,
      ),
    ).toBe(true);

    expect(
      canViewStatutoryIds(
        userOther as never,
        new Set(['employee.statutory_ids.read', 'payroll.run.reopen']),
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

const DB_URL = process.env['DATABASE_URL'];
const runDb = describe.skipIf(!DB_URL);

runDb('Directory & Profile Queries (Live Postgres)', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    const { createDatabase } = await import('../src/core/db/database.js');
    db = createDatabase(DB_URL ?? '');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('lists directory with search query, company filter, status filter, and pagination', async () => {
    const { listEmployees, listDirectoryFacets, getEmployeeByEcode } = await import('../src/modules/employees/employees.service.js');

    // 1. Search query
    const resQ = await listEmployees(db, { q: 'RML', page: 1, pageSize: 5, activeOnly: true });
    expect(resQ).toHaveProperty('items');
    expect(resQ).toHaveProperty('total');
    expect(resQ.page).toBe(1);
    expect(resQ.pageSize).toBe(5);

    // 2. Company code filter and inactive included
    const resComp = await listEmployees(db, { companyCode: 'RML', activeOnly: false });
    expect(Array.isArray(resComp.items)).toBe(true);

    // 3. Facets with activeOnly true and false
    const facetsActive = await listDirectoryFacets(db, { activeOnly: true });
    expect(facetsActive).toHaveProperty('entities');
    expect(facetsActive).toHaveProperty('departments');
    expect(facetsActive).toHaveProperty('categories');

    const facetsAll = await listDirectoryFacets(db, { activeOnly: false });
    expect(facetsAll.total).toBeGreaterThanOrEqual(0);

    // 4. getEmployeeByEcode non-existent returns null
    const dummyUser = { id: 1, employee_id: null } as never;
    const notFound = await getEmployeeByEcode(db, 'NON_EXISTENT_ECODE_XYZ', dummyUser, new Set());
    expect(notFound).toBeNull();

    // 5. getEmployeeByEcode existing employee with and without unmasking
    const emp = await db.selectFrom('core.employees').select(['id', 'ecode']).where('status', '=', 'active').limit(1).executeTakeFirst();
    if (emp) {
      const maskedProfile = await getEmployeeByEcode(db, emp.ecode, dummyUser, new Set());
      expect(maskedProfile).not.toBeNull();
      expect(maskedProfile?.statutoryMasked).toBe(true);
      expect(maskedProfile?.pan).toBeNull();
      expect(maskedProfile?.canViewCompensation).toBe(false);

      const unmaskedProfile = await getEmployeeByEcode(
        db,
        emp.ecode,
        dummyUser,
        new Set(['employee.statutory_ids.read', 'payroll.run.manage', 'employee.compensation.read']),
      );
      expect(unmaskedProfile).not.toBeNull();
      expect(unmaskedProfile?.statutoryMasked).toBe(false);
      expect(unmaskedProfile?.canViewCompensation).toBe(true);
    }
  });
});

