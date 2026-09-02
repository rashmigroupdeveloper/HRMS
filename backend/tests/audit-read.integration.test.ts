/**
 * Audit read surface (CORE-11) — the viewer must be trustworthy:
 *   A1 permission-gated: a user without `audit.read` is refused.
 *   A2 filters compose, and `total` agrees with the rows the same filter returns
 *      (a count that disagreed with the page would misreport the trail).
 *   A3 the page is bounded — `limit` is capped, never unbounded.
 *   A4 the DB-side hash chain verifies intact.
 *   A5 org-scoped readers cannot see another org unit or global/legacy rows.
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
import { writeAudit } from '../src/core/audit/audit.service.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface AuditPage {
  rows: { id: number; entity: string; action: string; field: string | null; actorName: string | null }[];
  total: number;
  limit: number;
  offset: number;
}

run('Audit read API (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'audit-pw-1!';
  const entity = `test.audit_${String(stamp)}`;
  const adminEmail = `audit-admin-${String(stamp)}@hrms.test`;
  const plainEmail = `audit-plain-${String(stamp)}@hrms.test`;
  const scopedEmail = `audit-scoped-${String(stamp)}@hrms.test`;
  const scopedEntity = `${entity}.scope_a`;
  const otherEntity = `${entity}.scope_b`;
  let adminToken: string;
  let plainToken: string;
  let scopedToken: string;
  const employeeIds: number[] = [];

  async function mkUser(email: string, roleCode: string | null, scopeOrgUnitId: number | null = null): Promise<number> {
    const u = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (roleCode !== null) {
      const role = await db.selectFrom('core.roles').select('id').where('code', '=', roleCode).executeTakeFirstOrThrow();
      await db
        .insertInto('core.user_roles')
        .values({ user_id: u.id, role_id: role.id, scope_org_unit_id: scopeOrgUnitId })
        .execute();
    }
    return u.id;
  }

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const [scopeA, scopeB] = await Promise.all([
      db
        .insertInto('core.org_units')
        .values({ company_id: rml.id, parent_id: null, name: `Audit scope A ${String(stamp)}` })
        .returning('id')
        .executeTakeFirstOrThrow(),
      db
        .insertInto('core.org_units')
        .values({ company_id: rml.id, parent_id: null, name: `Audit scope B ${String(stamp)}` })
        .returning('id')
        .executeTakeFirstOrThrow(),
    ]);
    const scopedEmployee = await db
      .insertInto('core.employees')
      .values({
        ecode: `RMLA${String(stamp).slice(-6)}`,
        company_id: rml.id,
        org_unit_id: scopeA.id,
        first_name: 'Audit Scope A',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const otherEmployee = await db
      .insertInto('core.employees')
      .values({
        ecode: `RMLB${String(stamp).slice(-6)}`,
        company_id: rml.id,
        org_unit_id: scopeB.id,
        first_name: 'Audit Scope B',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    employeeIds.push(scopedEmployee.id, otherEmployee.id);

    // it_admin has all-scope audit.read; hr_head is narrowed to one org unit.
    const adminId = await mkUser(adminEmail, 'it_admin');
    await mkUser(plainEmail, 'employee');
    const scopedId = await mkUser(scopedEmail, 'hr_head', scopeA.id);

    // Three rows we can identify unambiguously, two sharing an action.
    await writeAudit(db, { actorUserId: adminId, action: 'update', entity, field: 'alpha', oldValue: '1', newValue: '2' });
    await writeAudit(db, { actorUserId: adminId, action: 'update', entity, field: 'beta', oldValue: '3', newValue: '4' });
    await writeAudit(db, { actorUserId: adminId, action: 'delete', entity, field: 'gamma', oldValue: '5', newValue: null });
    await writeAudit(db, {
      actorUserId: scopedId,
      action: 'update',
      entity: scopedEntity,
      subjectEmployeeId: scopedEmployee.id,
      field: 'visible',
    });
    await writeAudit(db, {
      actorUserId: adminId,
      action: 'update',
      entity: otherEntity,
      subjectEmployeeId: otherEmployee.id,
      field: 'hidden',
    });

    adminToken = await login(adminEmail);
    plainToken = await login(plainEmail);
    scopedToken = await login(scopedEmail);
  });

  afterAll(async () => {
    await db.deleteFrom('core.employees').where('id', 'in', employeeIds).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('email', 'in', [adminEmail, plainEmail, scopedEmail])
      .execute();
    await db.destroy();
  });

  it('A1 refuses a user without audit.read, allows one with it', async () => {
    const denied = await request(app).get('/api/audit').set('Authorization', `Bearer ${plainToken}`);
    expect(denied.status).toBe(403);

    const allowed = await request(app).get('/api/audit').set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
  });

  it('A2 filters compose and `total` matches the filtered rows', async () => {
    const byEntity = await request(app)
      .get(`/api/audit?entity=${entity}&limit=200`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byEntity.status).toBe(200);
    const page = byEntity.body as AuditPage;
    expect(page.total).toBe(3);
    expect(page.rows).toHaveLength(3);
    expect(page.rows.every((r) => r.entity === entity)).toBe(true);
    // newest first
    expect(page.rows[0]?.field).toBe('gamma');
    // the actor is resolved to a label, not left as a bare id
    expect(page.rows[0]?.actorName).toBe(adminEmail);

    const byAction = await request(app)
      .get(`/api/audit?entity=${entity}&action=update&limit=200`)
      .set('Authorization', `Bearer ${adminToken}`);
    const narrowed = byAction.body as AuditPage;
    expect(narrowed.total).toBe(2);
    expect(narrowed.rows).toHaveLength(2);
    expect(narrowed.rows.every((r) => r.action === 'update')).toBe(true);

    const search = await request(app)
      .get(`/api/audit?entity=${entity}&search=BETA&limit=200`)
      .set('Authorization', `Bearer ${adminToken}`);
    const found = (search.body as AuditPage).rows;
    expect(found).toHaveLength(1);
    expect(found[0]?.field).toBe('beta');
  });

  it('A3 paginates and refuses an unbounded page size', async () => {
    const firstPage = await request(app)
      .get(`/api/audit?entity=${entity}&limit=2&offset=0`)
      .set('Authorization', `Bearer ${adminToken}`);
    const p1 = firstPage.body as AuditPage;
    expect(p1.rows).toHaveLength(2);
    expect(p1.total).toBe(3); // total is the FILTER total, not the page size

    const secondPage = await request(app)
      .get(`/api/audit?entity=${entity}&limit=2&offset=2`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect((secondPage.body as AuditPage).rows).toHaveLength(1);

    // Above the cap must be rejected, not silently served.
    const tooBig = await request(app)
      .get(`/api/audit?entity=${entity}&limit=5000`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(tooBig.status).toBe(400);
  });

  it('A4 reports the hash chain intact, and exposes the facets it filters on', async () => {
    const verify = await request(app).get('/api/audit/verify').set('Authorization', `Bearer ${adminToken}`);
    expect(verify.status).toBe(200);
    expect((verify.body as { intact: boolean; brokenAtId: number | null }).intact).toBe(true);
    expect((verify.body as { brokenAtId: number | null }).brokenAtId).toBeNull();

    const facets = await request(app).get('/api/audit/facets').set('Authorization', `Bearer ${adminToken}`);
    expect(facets.status).toBe(200);
    const body = facets.body as { entities: string[]; actions: string[] };
    expect(body.entities).toContain(entity);
    expect(body.actions).toContain('update');
  });

  it('A5 enforces org-unit scope on rows, counts, facets and version-2 evidence', async () => {
    const visible = await request(app)
      .get(`/api/audit?entity=${scopedEntity}`)
      .set('Authorization', `Bearer ${scopedToken}`);
    expect(visible.status).toBe(200);
    expect((visible.body as AuditPage).total).toBe(1);

    const hidden = await request(app)
      .get(`/api/audit?entity=${otherEntity}`)
      .set('Authorization', `Bearer ${scopedToken}`);
    expect(hidden.status).toBe(200);
    expect((hidden.body as AuditPage).total).toBe(0);

    const global = await request(app)
      .get(`/api/audit?entity=${entity}`)
      .set('Authorization', `Bearer ${scopedToken}`);
    expect((global.body as AuditPage).total).toBe(0);

    const facets = await request(app)
      .get('/api/audit/facets')
      .set('Authorization', `Bearer ${scopedToken}`);
    const facetBody = facets.body as { entities: string[] };
    expect(facetBody.entities).toContain(scopedEntity);
    expect(facetBody.entities).not.toContain(otherEntity);

    const stored = await db
      .selectFrom('core.audit_log')
      .select(['scope_org_unit_id', 'hash_version'])
      .where('entity', '=', scopedEntity)
      .executeTakeFirstOrThrow();
    expect(stored.scope_org_unit_id).not.toBeNull();
    expect(stored.hash_version).toBe(2);
  });
});
