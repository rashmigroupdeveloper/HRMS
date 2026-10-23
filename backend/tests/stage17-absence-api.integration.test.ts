/**
 * Stage 1.7 (frontend-support) — the absence-case queue API honours its
 * `open` boolean query param. Guards the bug where z.coerce.boolean() turns
 * the string 'false' truthy, so "show all cases" silently stayed "open only".
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpRequest } from './http-client.js';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface CaseDto {
  id: number;
  ecode: string;
  closedAt: string | null;
}

run('Stage 1.7 — absence-case API open filter (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 's17api-pw-1!';
  let openEmpId: number;
  let closedEmpId: number;
  let caseUnitId: number;
  let token: string;

  async function mkEmployee(suffix: string): Promise<number> {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const r = await db
      .insertInto('core.employees')
      .values({ ecode: `RMLQ${String(stamp).slice(-5)}${suffix}`, company_id: rml.id, org_unit_id: caseUnitId, first_name: `S17API ${suffix}`, status: 'active' })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const company = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    caseUnitId = (await db.insertInto('core.org_units').values({ company_id: company.id, name: `S17 Cases ${stamp}` }).returning('id').executeTakeFirstOrThrow()).id;

    openEmpId = await mkEmployee('O');
    closedEmpId = await mkEmployee('C');
    await db
      .insertInto('att.absence_cases')
      .values({ employee_id: openEmpId, start_date: sql<Date>`'2039-01-02'::date` as unknown as Date, days_absent: 5, stage: 'show_cause' })
      .execute();
    await db
      .insertInto('att.absence_cases')
      .values({
        employee_id: closedEmpId,
        start_date: sql<Date>`'2039-02-02'::date` as unknown as Date,
        days_absent: 6,
        stage: 'watch',
        resolution: 'returned',
        closed_at: new Date(),
      })
      .execute();

    // An hr_ops user holds attendance.team.read.
    const u = await db
      .insertInto('core.users')
      .values({ email: `s17api-${stamp}@hrms.test`, password_hash: await hashPassword(password), employee_id: openEmpId })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await db.selectFrom('core.roles').select('id').where('code', '=', 'hr_ops').executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: role.id, scope_org_unit_id: caseUnitId }).execute();

    const login = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: `s17api-${stamp}@hrms.test`, password });
    token = (login.body as { accessToken: string }).accessToken;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    const empIds = [openEmpId, closedEmpId];
    await db.deleteFrom('att.absence_cases').where('employee_id', 'in', empIds).execute();
    await db.deleteFrom('core.user_roles').where('user_id', 'in', db.selectFrom('core.users').select('id').where('email', '=', `s17api-${stamp}@hrms.test`)).execute();
    await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('email', 'like', `s17api-${stamp}@hrms.test`).execute();
    await db.updateTable('core.employees').set({ org_unit_id: null, status: 'onboarding' }).where('id', 'in', empIds).execute();
    // The immutable request audit references the fixture unit; retain it.
    await db.destroy();
  });

  const our = (rows: CaseDto[]): CaseDto[] => rows.filter((r) => r.ecode.includes(`Q${String(stamp).slice(-5)}`));

  it('open=true returns only open cases; open=false returns closed ones too', async () => {
    const openOnly = await (await httpRequest(app)).get('/api/attendance/absence-cases?open=true').set('Authorization', `Bearer ${token}`);
    expect(openOnly.status).toBe(200);
    const openRows = our(openOnly.body as CaseDto[]);
    expect(openRows.every((r) => r.closedAt === null)).toBe(true);
    expect(openRows.some((r) => r.ecode.endsWith('O'))).toBe(true);
    expect(openRows.some((r) => r.ecode.endsWith('C'))).toBe(false); // the closed case is hidden

    const all = await (await httpRequest(app)).get('/api/attendance/absence-cases?open=false').set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200); // 'false' must PARSE, not 400
    const allRows = our(all.body as CaseDto[]);
    expect(allRows.some((r) => r.ecode.endsWith('C') && r.closedAt !== null)).toBe(true); // closed now visible
  });

  it('CORE-10: the queue, escalation and letter actions are confined to the caller’s data scope', async () => {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();

    // Two org units in RML; the hr_ops caller is bound to unit A only.
    const ouA = await db.insertInto('core.org_units').values({ company_id: rml.id, name: `S17 Unit A ${stamp}` }).returning('id').executeTakeFirstOrThrow();
    const ouB = await db.insertInto('core.org_units').values({ company_id: rml.id, name: `S17 Unit B ${stamp}` }).returning('id').executeTakeFirstOrThrow();

    const mkEmp = async (suffix: string, orgUnitId: number) => {
      const r = await db
        .insertInto('core.employees')
        .values({ ecode: `RMLS${String(stamp).slice(-5)}${suffix}`, company_id: rml.id, first_name: `S17Scope ${suffix}`, status: 'active', org_unit_id: orgUnitId })
        .returning('id')
        .executeTakeFirstOrThrow();
      return r.id;
    };
    const inEmp = await mkEmp('IN', ouA.id); // inside the caller's unit
    const outEmp = await mkEmp('OUT', ouB.id); // outside it
    const mkCase = async (employeeId: number) =>
      (await db
        .insertInto('att.absence_cases')
        .values({ employee_id: employeeId, start_date: sql<Date>`'2039-03-02'::date` as unknown as Date, days_absent: 8, stage: 'show_cause' })
        .returning('id')
        .executeTakeFirstOrThrow()).id;
    const inCaseId = await mkCase(inEmp);
    const outCaseId = await mkCase(outEmp);

    // An hr_ops user (holds attendance.team.read + letters.issue, both org_unit) bound to unit A.
    const scopedEmail = `s17scope-${stamp}@hrms.test`;
    const u = await db.insertInto('core.users').values({ email: scopedEmail, password_hash: await hashPassword(password), employee_id: inEmp }).returning('id').executeTakeFirstOrThrow();
    const hrOps = await db.selectFrom('core.roles').select('id').where('code', '=', 'hr_ops').executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: hrOps.id, scope_org_unit_id: ouA.id }).execute();
    const login = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: scopedEmail, password });
    const scopedToken = (login.body as { accessToken: string }).accessToken;
    const auth = { Authorization: `Bearer ${scopedToken}` };

    try {
      // List: the in-unit case is visible, the out-of-unit case is NOT.
      const list = await (await httpRequest(app)).get('/api/attendance/absence-cases?open=true').set(auth);
      expect(list.status).toBe(200);
      const ids = (list.body as { id: number }[]).map((r) => r.id);
      expect(ids).toContain(inCaseId);
      expect(ids).not.toContain(outCaseId);

      // Escalation + letter on the out-of-scope case are refused with 403 (not 400/200).
      const escOut = await (await httpRequest(app)).post(`/api/attendance/absence-cases/${outCaseId}/stage`).set(auth).send({ stage: 'warning' });
      expect(escOut.status).toBe(403);
      const letterOut = await (await httpRequest(app)).post(`/api/attendance/absence-cases/${outCaseId}/letter`).set(auth).send({ template: 'show_cause' });
      expect(letterOut.status).toBe(403);

      // The same escalation on the in-scope case is allowed.
      const escIn = await (await httpRequest(app)).post(`/api/attendance/absence-cases/${inCaseId}/stage`).set(auth).send({ stage: 'warning' });
      expect(escIn.status).toBe(200);
    } finally {
      await db.deleteFrom('att.absence_cases').where('id', 'in', [inCaseId, outCaseId]).execute();
      await db.deleteFrom('core.user_roles').where('user_id', '=', u.id).execute();
      await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('email', '=', scopedEmail).execute();
      // Detach from the org units (FK) rather than hard-deleting audited employees.
      await db.updateTable('core.employees').set({ org_unit_id: null, status: 'onboarding' }).where('id', 'in', [inEmp, outEmp]).execute();
      // Audit scope FKs retain these units even after users/employees detach.
    }
  });

  it('numeric query params coerce from the string (?limit / ?companyId) — no 400', async () => {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();

    // `?limit=20` on a `z.number()` query param would 400 without the smart-
    // coercion plugin (query values are strings). Proves the global fix.
    const unmatched = await (await httpRequest(app))
      .get('/api/attendance/exceptions/unmatched?limit=20')
      .set('Authorization', `Bearer ${token}`);
    expect(unmatched.status).toBe(200);

    const r6 = await (await httpRequest(app))
      .get(`/api/reports/r6-absence?companyId=${String(rml.id)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(r6.status).toBe(200);
    expect(Array.isArray(r6.body)).toBe(true);
  });
});
