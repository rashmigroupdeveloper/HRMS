/** PAY-08/13, CORE-10/11: operator controls must preserve scope, audit and settled periods. */
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
const secret = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';
describe.skipIf(!url)('Scoped payroll operator controls', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let app: ReturnType<typeof createApp>;
  let token = '';
  let userId = 0;
  let employeeId = 0;
  let foreignId = 0;
  let companyId = 0;
  beforeAll(async () => {
    db = createDatabase(url ?? '');
    tx = await db.startTransaction().execute();
    const tag = `controls${randomUUID().slice(0, 6)}`;
    companyId = (
      await tx
        .insertInto('core.companies')
        .values({ code: tag, name: tag, ecode_prefix: tag })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const other = (
      await tx
        .insertInto('core.companies')
        .values({ code: `${tag}x`, name: `${tag}x`, ecode_prefix: `${tag}x` })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const org = (
      await tx
        .insertInto('core.org_units')
        .values({ company_id: companyId, name: tag })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    employeeId = (
      await tx
        .insertInto('core.employees')
        .values({
          company_id: companyId,
          org_unit_id: org,
          ecode: tag,
          first_name: 'Own',
          doj: '2020-01-01',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    foreignId = (
      await tx
        .insertInto('core.employees')
        .values({ company_id: other, ecode: `${tag}x`, first_name: 'Foreign', doj: '2020-01-01' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const u = await tx
      .insertInto('core.users')
      .values({ email: `${tag}@hrms.invalid`, password_hash: '!disabled!' })
      .returning(['id', 'email'])
      .executeTakeFirstOrThrow();
    userId = u.id;
    const role = await tx
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'payroll_admin')
      .executeTakeFirstOrThrow();
    await tx
      .insertInto('core.user_roles')
      .values({ user_id: u.id, role_id: role.id, scope_org_unit_id: org })
      .execute();
    const session = await tx
      .insertInto('sec.sessions')
      .values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) })
      .returning('sid')
      .executeTakeFirstOrThrow();
    token = await signAccessToken(u.id, u.email, secret, session.sid);
    app = createApp({ db: tx, jwtSecret: secret, secureCookies: false });
  });
  afterAll(async () => {
    try {
      await tx.rollback().execute();
    } finally {
      await db.destroy();
    }
  });
  const auth = () => `Bearer ${token}`;
  it('refuses foreign hold placement and hides foreign holds', async () => {
    const c = await httpRequest(app);
    const body = {
      employee_id: foreignId,
      hold_type: 'payment',
      reason: 'Synthetic scope test',
      start_month: '2097-01-01',
    };
    expect(
      (await c.post('/api/payroll/holds/place').set('Authorization', auth()).send(body)).status,
    ).toBe(403);
    const row = await tx
      .insertInto('pay.salary_holds')
      .values({
        employee_id: foreignId,
        hold_type: 'payment',
        reason: 'Foreign',
        start_month: new Date('2097-01-01'),
        created_by: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const list = await c.post('/api/payroll/holds/list').set('Authorization', auth()).send({});
    expect(list.status).toBe(200);
    expect((list.body as { id: number }[]).some((x) => x.id === row.id)).toBe(false);
    expect(
      (
        await c
          .post('/api/payroll/holds/release')
          .set('Authorization', auth())
          .send({ hold_id: row.id, released_month: '2097-02-01' })
      ).status,
    ).toBe(403);
  });
  it('audits holds and refuses duplicate overlap, invalid month, reversed release and settled changes', async () => {
    const c = await httpRequest(app);
    const body = {
      employee_id: employeeId,
      hold_type: 'payment',
      reason: 'Synthetic payment hold',
      start_month: '2097-01-01',
    };
    expect(
      (
        await c
          .post('/api/payroll/holds/place')
          .set('Authorization', auth())
          .send({ ...body, start_month: '2097-01-15' })
      ).status,
    ).toBe(400);
    const placed = await c.post('/api/payroll/holds/place').set('Authorization', auth()).send(body);
    expect(placed.status).toBe(200);
    const id = (placed.body as { id: number }).id;
    expect(
      (
        await c
          .post('/api/payroll/holds/place')
          .set('Authorization', auth())
          .send({ ...body, hold_type: 'process' })
      ).status,
    ).toBe(409);
    expect(
      (
        await c
          .post('/api/payroll/holds/release')
          .set('Authorization', auth())
          .send({ hold_id: id, released_month: '2096-12-01' })
      ).status,
    ).toBe(400);
    expect(
      (
        await c
          .post('/api/payroll/holds/release')
          .set('Authorization', auth())
          .send({ hold_id: id, released_month: '2097-02-01' })
      ).status,
    ).toBe(200);
    expect(
      await tx
        .selectFrom('core.audit_log')
        .select('id')
        .where('entity', '=', 'pay.salary_holds')
        .where('entity_id', '=', id)
        .execute(),
    ).toHaveLength(2);
    const lock = await tx
      .insertInto('att.month_locks')
      .values({
        company_id: companyId,
        month: '2097-03-01',
        locked_by: userId,
        locked_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await tx
      .insertInto('pay.payroll_runs')
      .values({
        company_id: companyId,
        month: new Date('2097-03-01'),
        status: 'finalized',
        attendance_lock_id: lock.id,
        finalized_at: new Date(),
      })
      .execute();
    expect(
      (
        await c
          .post('/api/payroll/holds/place')
          .set('Authorization', auth())
          .send({ ...body, start_month: '2097-03-01' })
      ).status,
    ).toBe(409);
  });
  it('refuses foreign declaration reads and verification', async () => {
    const c = await httpRequest(app);
    const row = await tx
      .insertInto('pay.investment_declarations')
      .values({ employee_id: foreignId, fy: '2097-98', section: '80C', declared_amount: '1000' })
      .returning('id')
      .executeTakeFirstOrThrow();
    expect(
      (
        await c
          .post('/api/payroll/statutory/listDeclarations')
          .set('Authorization', auth())
          .send({ employeeId: foreignId, financialYear: '2097-98' })
      ).status,
    ).toBe(403);
    expect(
      (
        await c
          .post('/api/payroll/statutory/verifyDeclaration')
          .set('Authorization', auth())
          .send({ declarationId: row.id, verifiedAmountPaise: 100000 })
      ).status,
    ).toBe(403);
  });
  it('does not verify without owned proof or beyond declared amount', async () => {
    const c = await httpRequest(app);
    const row = await tx
      .insertInto('pay.investment_declarations')
      .values({ employee_id: employeeId, fy: '2097-98', section: '80C', declared_amount: '1000' })
      .returning('id')
      .executeTakeFirstOrThrow();
    expect(
      (
        await c
          .post('/api/payroll/statutory/verifyDeclaration')
          .set('Authorization', auth())
          .send({ declarationId: row.id, verifiedAmountPaise: 100001 })
      ).status,
    ).toBe(400);
    expect(
      (
        await c
          .post('/api/payroll/statutory/verifyDeclaration')
          .set('Authorization', auth())
          .send({ declarationId: row.id, verifiedAmountPaise: 100000 })
      ).status,
    ).toBe(400);
  });
  it('verifies an employee-owned proof once, audits it and provides a scoped queue', async () => {
    const c = await httpRequest(app);
    const doc = await tx
      .insertInto('core.documents')
      .values({
        owner_employee_id: employeeId,
        kind: 'tax_proof',
        path: 'synthetic/unused.pdf',
        original_name: 'proof.pdf',
        mime: 'application/pdf',
        size_bytes: 1,
        uploaded_by: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const row = await tx
      .insertInto('pay.investment_declarations')
      .values({
        employee_id: employeeId,
        fy: '2098-99',
        section: '80C',
        declared_amount: '1000',
        proof_document_id: doc.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const body = { declarationId: row.id, verifiedAmountPaise: 12345 };
    expect(
      (
        await c
          .post('/api/payroll/statutory/verifyDeclaration')
          .set('Authorization', auth())
          .send(body)
      ).status,
    ).toBe(200);
    expect(
      (
        await tx
          .selectFrom('pay.investment_declarations')
          .select('verified_amount')
          .where('id', '=', row.id)
          .executeTakeFirstOrThrow()
      ).verified_amount,
    ).toBe('123.45');
    expect(
      (
        await c
          .post('/api/payroll/statutory/verifyDeclaration')
          .set('Authorization', auth())
          .send(body)
      ).status,
    ).toBe(409);
    expect(
      await tx
        .selectFrom('core.audit_log')
        .select('id')
        .where('entity_id', '=', row.id)
        .where('action', '=', 'investment_verified')
        .execute(),
    ).toHaveLength(1);
    const queue = await c.get('/api/payroll/declarations?fy=2097-98').set('Authorization', auth());
    expect(queue.status).toBe(200);
    expect(
      (queue.body as { items: { employeeId: number }[] }).items.every(
        (i) => i.employeeId === employeeId,
      ),
    ).toBe(true);
  });
  it('allows IT-owned tasks without conversion access and refuses HR task completion', async () => {
    // New permission is seeded by the forward migration, not a blanket conversion grant.
    const user = await tx
      .insertInto('core.users')
      .values({ email: `it-${randomUUID()}@hrms.invalid`, password_hash: '!disabled!' })
      .returning(['id', 'email'])
      .executeTakeFirstOrThrow();
    const role = await tx
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'it_admin')
      .executeTakeFirstOrThrow();
    await tx.insertInto('core.user_roles').values({ user_id: user.id, role_id: role.id }).execute();
    const session = await tx
      .insertInto('sec.sessions')
      .values({ user_id: user.id, expires_at: new Date(Date.now() + 600000) })
      .returning('sid')
      .executeTakeFirstOrThrow();
    const itAuth = `Bearer ${await signAccessToken(user.id, user.email, secret, session.sid)}`;
    const c = await httpRequest(app);
    const create = async (code: string, owner: string) =>
      tx
        .insertInto('core.onboarding_tasks')
        .values({
          employee_id: employeeId,
          task_code: code,
          task_name: code,
          department: owner === 'it_admin' ? 'IT' : 'HR',
          owner_role: owner,
          due_date: new Date('2097-01-01'),
          sla_hours: 24,
          updated_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    const own = await create('it_email', 'it_admin');
    const hr = await create('hr_induction', 'hr_ops');
    const biometric = await create('it_biometric', 'it_admin');
    expect((await c.post('/api/lifecycle/my-tasks/complete').set('Authorization',itAuth).send({taskId:biometric.id})).status).toBe(503);
    expect((await tx.selectFrom('core.onboarding_tasks').select('status').where('id','=',biometric.id).executeTakeFirstOrThrow()).status).toBe('open');
    const list = await c.get('/api/lifecycle/my-tasks').set('Authorization', itAuth);
    expect(list.status).toBe(200);
    expect((list.body as { tasks: { id: number }[] }).tasks.some((t) => t.id === own.id)).toBe(
      true,
    );
    expect((list.body as { tasks: { id: number }[] }).tasks.some((t) => t.id === hr.id)).toBe(
      false,
    );
    expect(
      (
        await c
          .post('/api/lifecycle/my-tasks/complete')
          .set('Authorization', itAuth)
          .send({ taskId: own.id })
      ).status,
    ).toBe(200);
    expect(
      (
        await c
          .post('/api/lifecycle/my-tasks/complete')
          .set('Authorization', itAuth)
          .send({ taskId: hr.id })
      ).status,
    ).toBe(403);
    expect((await c.get('/api/lifecycle/candidates').set('Authorization', itAuth)).status).toBe(
      403,
    );
  });
});
