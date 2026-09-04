/**
 * Stage 5.6 — register catalog + honest blocked / header-only previews.
 * No invented wages: wage register stays blocked; muster may return 0 rows.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import {
  listRegisterCatalog,
  PAYROLL_BLOCK_REASON,
  previewRegister,
  REGISTER_CODES,
} from '../src/modules/compliance/registers.service.js';

describe('register catalog (CMP-08 stub)', () => {
  it('lists Form 12, Form 15, Form 22, Muster and Wage with expected codes', () => {
    const rows = listRegisterCatalog();
    expect(rows.map((r) => r.code)).toEqual([...REGISTER_CODES]);
    expect(rows.map((r) => r.code)).toEqual([
      'form_12',
      'form_15',
      'form_22',
      'muster',
      'wage',
    ]);
  });

  it('marks wage-dependent forms pending_payroll and header-only forms available', () => {
    const byCode = Object.fromEntries(listRegisterCatalog().map((r) => [r.code, r]));
    expect(byCode['form_12']?.status).toBe('available');
    expect(byCode['muster']?.status).toBe('available');
    expect(byCode['form_15']?.status).toBe('pending_payroll');
    expect(byCode['form_22']?.status).toBe('pending_payroll');
    expect(byCode['wage']?.status).toBe('pending_payroll');
    expect(byCode['wage']?.dependency).toBe(PAYROLL_BLOCK_REASON);
  });
});

describe('register preview — wage blocked without inventing numbers', () => {
  it('blocks the wage register with the Stage 2 payroll dependency', async () => {
    // No DB needed: pending_payroll short-circuits before any query.
    const fakeDb = null as unknown as Kysely<Database>;
    const result = await previewRegister(fakeDb, { code: 'wage', companyId: 1 });
    expect(result).toEqual({
      status: 'blocked',
      code: 'wage',
      reason: PAYROLL_BLOCK_REASON,
    });
  });

  it('blocks Form 22 the same way (muster-cum-wages needs payroll)', async () => {
    const fakeDb = null as unknown as Kysely<Database>;
    const result = await previewRegister(fakeDb, { code: 'form_22', companyId: 1 });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe(PAYROLL_BLOCK_REASON);
    }
  });
});

const DB_URL = process.env['DATABASE_URL'];
const live = describe.skipIf(!DB_URL);

live('register preview — muster header-only (live Postgres)', () => {
  let db: Kysely<Database>;
  let companyId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .orderBy('id')
      .executeTakeFirstOrThrow();
    companyId = company.id;
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns ≥0 header rows (ecode, name, doj) without inventing wages', async () => {
    const result = await previewRegister(db, { code: 'muster', companyId });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.mode).toBe('header_only');
    expect(result.columns).toEqual(['ecode', 'name', 'doj']);
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
    for (const row of result.rows) {
      expect(row.ecode.length).toBeGreaterThan(0);
      expect(row.name.length).toBeGreaterThan(0);
      expect(row).not.toHaveProperty('wage');
      expect(row).not.toHaveProperty('basic');
    }
  });
});
