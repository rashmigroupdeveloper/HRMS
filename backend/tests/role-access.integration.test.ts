/**
 * Per-role access matrix (docs/08 §2 grid + §3 navigation).
 *
 * This suite exists because a permission mistake is invisible: nothing crashes,
 * a screen just quietly 403s for the role that was supposed to have it, and
 * nobody notices until that person tries to do their job.
 *
 * It caught exactly that: every report gated on `reports.hr` alone, so the
 * "Reports (BU)" nav docs/08 §3 promises plant_head — and the "Reports (read)"
 * it promises ceo_cell — returned 403 for both. The grid defines THREE parallel
 * report permissions; the code honoured one.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

const ROLES = [
  'employee',
  'manager',
  'senior_manager',
  'hr_ops',
  'hr_head',
  'payroll_admin',
  'plant_head',
  'ceo_cell',
  'it_admin',
  'super_admin',
] as const;
type Role = (typeof ROLES)[number];

run('Per-role access matrix (docs/08)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'RoleMatrix@2026';
  const tokens = new Map<Role, string>();
  const emails = ROLES.map((r) => `matrix-${r}-${String(stamp)}@hrms.test`);
  let companyId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    companyId = (
      await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow()
    ).id;

    // Hash ONCE for all ten probe users. bcrypt is deliberately slow, so
    // hashing per user turned setup into ~20 sequential hashes and could
    // exceed the hook timeout under full-suite load — leaving a token
    // undefined and surfacing as a confusing 401 much later.
    const passwordHash = await hashPassword(password);

    for (const role of ROLES) {
      const email = `matrix-${role}-${String(stamp)}@hrms.test`;
      const user = await db
        .insertInto('core.users')
        .values({ email, password_hash: passwordHash, employee_id: null })
        .returning('id')
        .executeTakeFirstOrThrow();
      const roleRow = await db
        .selectFrom('core.roles')
        .select('id')
        .where('code', '=', role)
        .executeTakeFirstOrThrow();
      await db
        .insertInto('core.user_roles')
        .values({ user_id: user.id, role_id: roleRow.id, scope_org_unit_id: null })
        .execute();

      const login = await request(app).post('/api/auth/login').send({ identifier: email, password });
      const token = (login.body as { accessToken?: string }).accessToken;
      // Fail HERE with a clear message rather than letting an undefined token
      // surface as an unexplained 401 inside an unrelated assertion.
      expect(token, `login failed for probe role ${role} (status ${String(login.status)})`).toBeTruthy();
      tokens.set(role, token ?? '');
    }
    // Ten user creations + ten logins; give setup room under full-suite load.
  }, 60_000);

  afterAll(async () => {
    await db.updateTable('core.users').set({ is_active: false }).where('email', 'in', emails).execute();
    await db.destroy();
  });

  const get = async (role: Role, path: string): Promise<number> => {
    const res = await request(app).get(path).set('Authorization', `Bearer ${tokens.get(role) ?? ''}`);
    return res.status;
  };

  const allowed = async (role: Role, path: string): Promise<void> => {
    const status = await get(role, path);
    expect(status, `${role} SHOULD reach ${path} (docs/08 §3)`).not.toBe(403);
  };
  const denied = async (role: Role, path: string): Promise<void> => {
    const status = await get(role, path);
    expect(status, `${role} must NOT reach ${path}`).toBe(403);
  };

  it('reports are reachable through any of the three report permissions', async () => {
    const reports = `/api/reports/r27-headcount?companyId=${String(companyId)}`;
    // reports.hr
    await allowed('hr_ops', reports);
    await allowed('hr_head', reports);
    // reports.bu — the regression this suite was written for
    await allowed('plant_head', reports);
    // reports.ceo
    await allowed('ceo_cell', reports);
    // and nobody without any of them
    await denied('employee', reports);
    await denied('it_admin', reports);
  });

  it('the CEO dashboard is ceo_cell + super_admin only', async () => {
    await allowed('ceo_cell', '/api/reports/executive');
    for (const role of ['employee', 'manager', 'hr_ops', 'plant_head', 'it_admin'] as Role[]) {
      await denied(role, '/api/reports/executive');
    }
  });

  it('ceo_cell gets no OPERATIONAL screens (docs/08 §3)', async () => {
    // The HR ops dashboard is operational, not a report.
    await denied('ceo_cell', '/api/dashboards/hr-ops');
    await denied('plant_head', '/api/dashboards/hr-ops');
  });

  it('it_admin never reaches compensation or payroll surfaces (separation of duties)', async () => {
    // docs/08 §2 hard rule: it_admin never holds compensation.read.
    await denied('it_admin', `/api/reports/r27-headcount?companyId=${String(companyId)}`);
    await denied('it_admin', '/api/reports/executive');
  });

  it('admin surfaces are limited to the roles that hold them', async () => {
    await allowed('it_admin', '/api/rbac/matrix');
    await allowed('super_admin', '/api/rbac/matrix');
    for (const role of ['employee', 'manager', 'hr_ops', 'payroll_admin', 'plant_head'] as Role[]) {
      await denied(role, '/api/rbac/matrix');
    }

    await allowed('it_admin', '/api/audit?limit=1');
    await allowed('hr_head', '/api/audit?limit=1');
    await denied('employee', '/api/audit?limit=1');
    await denied('manager', '/api/audit?limit=1');
  });

  it('assets are HR + IT, never a plain manager', async () => {
    await allowed('hr_ops', '/api/assets?limit=1');
    await allowed('it_admin', '/api/assets?limit=1');
    await denied('manager', '/api/assets?limit=1');
    await denied('employee', '/api/assets?limit=1');
  });

  it('anyone signed in may raise a helpdesk ticket; only agents work the queue', async () => {
    await allowed('employee', '/api/helpdesk/tickets/mine');
    await allowed('hr_ops', '/api/helpdesk/tickets');
    await allowed('it_admin', '/api/helpdesk/tickets');
    await denied('employee', '/api/helpdesk/tickets');
    await denied('manager', '/api/helpdesk/tickets');
  });

  it('month lock is hr_head / payroll / super_admin only (ATT-15)', async () => {
    const path = `/api/attendance/month-lock/checklist?companyId=${String(companyId)}&month=2026-09`;
    await allowed('hr_head', path);
    await allowed('payroll_admin', path);
    await denied('hr_ops', path);
    await denied('manager', path);
  });

  it('managers never hold attendance.manual_override (PP-v2-18, explicit RML instruction)', async () => {
    // greytHR let managers mark absent employees "Present"; that must be impossible here.
    for (const role of ['manager', 'senior_manager'] as Role[]) {
      const res = await request(app)
        .put('/api/attendance/days/override')
        .set('Authorization', `Bearer ${tokens.get(role) ?? ''}`)
        .send({ employeeId: 1, workDate: '2026-09-01', status: 'P', reason: 'test' });
      expect(res.status, `${role} must never override attendance`).toBe(403);
    }
  });
});
