/**
 * Stage 1.7 (frontend-support) — the absence-case queue API honours its
 * `open` boolean query param. Guards the bug where z.coerce.boolean() turns
 * the string 'false' truthy, so "show all cases" silently stayed "open only".
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
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
  let token: string;

  async function mkEmployee(suffix: string): Promise<number> {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const r = await db
      .insertInto('core.employees')
      .values({ ecode: `RMLQ${String(stamp).slice(-5)}${suffix}`, company_id: rml.id, first_name: `S17API ${suffix}`, status: 'active' })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

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
    await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: role.id, scope_org_unit_id: null }).execute();

    const login = await request(app).post('/api/auth/login').send({ identifier: `s17api-${stamp}@hrms.test`, password });
    token = (login.body as { accessToken: string }).accessToken;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    const empIds = [openEmpId, closedEmpId];
    await db.deleteFrom('att.absence_cases').where('employee_id', 'in', empIds).execute();
    await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('email', 'like', `s17api-${stamp}@hrms.test`).execute();
    await db.destroy();
  });

  const our = (rows: CaseDto[]): CaseDto[] => rows.filter((r) => r.ecode.includes(`Q${String(stamp).slice(-5)}`));

  it('open=true returns only open cases; open=false returns closed ones too', async () => {
    const openOnly = await request(app).get('/api/attendance/absence-cases?open=true').set('Authorization', `Bearer ${token}`);
    expect(openOnly.status).toBe(200);
    const openRows = our(openOnly.body as CaseDto[]);
    expect(openRows.every((r) => r.closedAt === null)).toBe(true);
    expect(openRows.some((r) => r.ecode.endsWith('O'))).toBe(true);
    expect(openRows.some((r) => r.ecode.endsWith('C'))).toBe(false); // the closed case is hidden

    const all = await request(app).get('/api/attendance/absence-cases?open=false').set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200); // 'false' must PARSE, not 400
    const allRows = our(all.body as CaseDto[]);
    expect(allRows.some((r) => r.ecode.endsWith('C') && r.closedAt !== null)).toBe(true); // closed now visible
  });
});
