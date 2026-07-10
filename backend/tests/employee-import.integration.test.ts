/**
 * Stage 0.5 live proof — org master + two-source employee import:
 *   companies canonicalized (misspelling + typo merge into the right entity),
 *   userid typos flagged, EMS bcrypt hashes usable for login day one,
 *   reporting-tree closure answers the "everyone under X" question (KQ),
 *   e-code generator survives concurrency, greytHR enrich fills what EMS lacks.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { importEmsSeed, importGreythrEnrich } from '../src/modules/employees/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';

const run = describe.skipIf(!DB_URL);

function loadFixture(name: string): unknown[] {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as unknown[];
}

run('employee master + two-source import (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const loginPassword = 'ems-carried-over-password-1!';

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    // Clean slate for THE FIXTURE employees only (other suites own their own
    // employees — e.g. Stage 1.2 keeps a permanently locked day record).
    // Users with audit history can never be hard-deleted (append-only FK — by
    // design); detach + delete audit-free ones; survivors relink via upsert.
    const fixtureEcodes = (loadFixture('ems-users.sample.json') as { userid: string }[]).map((r) => r.userid);
    await db.updateTable('core.users').set({ employee_id: null }).where('employee_id', 'is not', null).execute();
    await sql`
      DELETE FROM core.users u
      WHERE u.email LIKE '%@rashmi.test'
        AND NOT EXISTS (SELECT 1 FROM core.audit_log a WHERE a.actor_user_id = u.id)
    `.execute(db);
    const existing = await db.selectFrom('core.employees').select('id').where('ecode', 'in', fixtureEcodes).execute();
    const ids = existing.map((e) => e.id);
    if (ids.length > 0) {
      await db.deleteFrom('att.recompute_queue').where('employee_id', 'in', ids).execute();
      await db.deleteFrom('att.day_records').where('employee_id', 'in', ids).where('is_locked', '=', false).execute();
      await db.deleteFrom('att.employee_shifts').where('employee_id', 'in', ids).execute();
      await db.deleteFrom('att.rosters').where('employee_id', 'in', ids).execute();
      await db.deleteFrom('core.employees').where('id', 'in', ids).execute();
    }

    const rows = loadFixture('ems-users.sample.json') as Record<string, unknown>[];
    const withRealHash = await Promise.all(
      rows.map(async (r) =>
        r['encrypted_password'] === 'REPLACED_IN_TEST_WITH_REAL_HASH'
          ? { ...r, encrypted_password: await hashPassword(loginPassword) }
          : r,
      ),
    );
    const summary = await importEmsSeed(db, withRealHash);
    expect(summary.imported).toBe(8); // 9 rows − 1 rejected typo userid
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('canonicalizes duplicate/typo company names into the right entity', async () => {
    // 'Rashmi Metalix Ltd' (misspelling) landed under canonical RML…
    const rachna = await db
      .selectFrom('core.employees as e')
      .innerJoin('core.companies as c', 'c.id', 'e.company_id')
      .select('c.code')
      .where('e.ecode', '=', 'RML036000')
      .executeTakeFirstOrThrow();
    expect(rachna.code).toBe('RML');

    // …and 'Rashmi 6 Paradigm Limited' (typo) under canonical RPL.
    const rajeev = await db
      .selectFrom('core.employees as e')
      .innerJoin('core.companies as c', 'c.id', 'e.company_id')
      .select('c.code')
      .where('e.ecode', '=', 'RPL002116')
      .executeTakeFirstOrThrow();
    expect(rajeev.code).toBe('RPL');
  });

  it('flags the userid typo + missing phone into the exception report (nothing silent)', async () => {
    const rows = loadFixture('ems-users.sample.json');
    // Re-import into a throwaway check: exceptions come from the beforeAll run —
    // verify via audit trail instead of re-importing (unique ecodes).
    const audit = await db
      .selectFrom('core.audit_log')
      .select('new_value')
      .where('field', '=', 'ems_seed_import')
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();
    const parsed = JSON.parse(audit.new_value ?? '{}') as { exceptions: number };
    expect(parsed.exceptions).toBeGreaterThanOrEqual(3); // typo userid, missing phone, no-login KIO0007
    expect(rows).toHaveLength(9);

    const typo = await db.selectFrom('core.employees').select('id').where('ecode', '=', 'EIPLL366').executeTakeFirst();
    expect(typo).toBeUndefined(); // rejected, not silently imported
  });

  it('normalizes department/designation variants into single rows', async () => {
    const hrDepts = await db
      .selectFrom('core.departments')
      .select('name')
      .where((eb) => eb(eb.fn('lower', ['name']), '=', 'human resource'))
      .execute();
    expect(hrDepts).toHaveLength(1); // 'Human Resource' + 'human resource' merged

    const hrExecs = await db
      .selectFrom('core.designations')
      .select('name')
      .where((eb) => eb(eb.fn('lower', ['name']), 'like', 'hr%executive'))
      .execute();
    expect(hrExecs).toHaveLength(1); // 'HR Executive' + 'HR  Executive' merged
  });

  it('an EMS-carried bcrypt hash logs in on day one (doc 11 §0.1)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'amit.singh@rashmi.test', password: loginPassword });
    expect(res.status).toBe(200);
  });

  it('login also works with the EMPLOYEE E-CODE as the identifier (the login-page field)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'RML035384', password: loginPassword });
    expect(res.status).toBe(200);
    expect((res.body as { user: { email: string } }).user.email).toBe('amit.singh@rashmi.test');

    // lowercase e-code works too (normalized server-side)
    const lower = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rml035384', password: loginPassword });
    expect(lower.status).toBe(200);
  });

  it('reporting-tree closure answers "everyone under RML000001" incl. cross-entity + depth 2 (KQ)', async () => {
    const ceo = await db.selectFrom('core.employees').select('id').where('ecode', '=', 'RML000001').executeTakeFirstOrThrow();
    const subtree = await db
      .selectFrom('core.reporting_tree as rt')
      .innerJoin('core.employees as e', 'e.id', 'rt.employee_id')
      .select(['e.ecode', 'rt.depth'])
      .where('rt.manager_id', '=', ceo.id)
      .execute();

    const byEcode = new Map(subtree.map((r) => [r.ecode, r.depth]));
    expect(byEcode.get('RML035384')).toBe(1); // direct report
    expect(byEcode.get('RML035999')).toBe(2); // report of a report
    expect(byEcode.get('RGH033256')).toBe(2); // CROSS-ENTITY report of a report
    expect(byEcode.size).toBeGreaterThanOrEqual(6);
  });

  it('e-code generator: 20 concurrent calls → 20 unique sequential codes (CORE-02)', async () => {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        sql<{ code: string }>`SELECT core.next_ecode(${rml.id}) AS code`.execute(db).then((r) => r.rows[0]?.code),
      ),
    );
    const unique = new Set(results);
    expect(unique.size).toBe(20);
    for (const code of results) expect(code).toMatch(/^RML\d{6}$/);
  });

  it('greytHR enrich fills DOB/DOJ/statutory/bank and reports unmatched userids', async () => {
    const summary = await importGreythrEnrich(db, loadFixture('greythr-enrich.sample.json'));
    expect(summary.updated).toBe(2);
    expect(summary.unmatched).toContain('RML999999');

    const amit = await db
      .selectFrom('core.employees')
      .select(['dob', 'doj', 'pan', 'uan', 'bank_ifsc', 'category'])
      .where('ecode', '=', 'RML035384')
      .executeTakeFirstOrThrow();
    expect(amit.dob).not.toBeNull();
    expect(amit.pan).toBe('ABCDE1234F');
    expect(amit.uan).toBe('100234567890');
    expect(amit.bank_ifsc).toBe('SBIN0001234');
    expect(amit.category).toBe('white_collar');
  });
});
