/**
 * C-17 / B-18: a transfer raised by HR goes through its approval chain
 * (RM → HR Ops); HR cannot shortcut it via the direct approve endpoint; a
 * future-dated transfer is approved but changes nothing until its effective
 * date, when applyDueTransfers applies it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { act } from '../src/modules/workflows/index.js';
import { applyDueTransfers, approveTransferRequest, createTransferRequest, rejectTransferRequest } from '../src/modules/lifecycle/transfers/transfer.service.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('transfer approval chain and effective dating', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const uid: Record<string, number> = {};
  let subject = 0;
  let dept1 = 0;
  let dept2 = 0;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = 'tc' + randomUUID().slice(0, 6);
    const company = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: `${tag} unit` }).returning('id').executeTakeFirstOrThrow()).id;
    dept1 = (await tx.insertInto('core.departments').values({ name: `${tag} D1` }).returning('id').executeTakeFirstOrThrow()).id;
    dept2 = (await tx.insertInto('core.departments').values({ name: `${tag} D2` }).returning('id').executeTakeFirstOrThrow()).id;
    const rm = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, department_id: dept1, ecode: `${tag}RM`.toUpperCase(), first_name: 'RM', status: 'active', doj: '2015-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    subject = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, department_id: dept1, reporting_manager_id: rm, ecode: `${tag}E1`.toUpperCase(), first_name: 'E1', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    const users: [string, string | null, number | null][] = [['rm', null, rm], ['ops', 'hr_ops', null], ['ops2', 'hr_ops', null]];
    for (const [key, role, employeeId] of users) {
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${key}@hrms.invalid`, password_hash: '!disabled!', employee_id: employeeId, is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
      if (role !== null) {
        const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
        await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: unit }).execute();
      }
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      uid[key] = u.id;
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });
  const tx = () => { if (!transaction) throw new Error('no transaction'); return transaction; };
  const post = async (who: string, path: string, body: unknown) =>
    (await httpRequest(app)).post(path).set('Authorization', `Bearer ${t[who] ?? ''}`).send(body as object);
  const deptOf = async () => (await tx().selectFrom('core.employees').select('department_id').where('id', '=', subject).executeTakeFirstOrThrow()).department_id;
  const transferRow = async (id: number) => tx().selectFrom('core.transfers').select(['status', 'workflow_request_id', 'approved_by']).where('id', '=', id).executeTakeFirstOrThrow();

  it('HR raises it, RM then HR approve; future-dated stays scheduled until its date', async () => {
    const created = await post('ops', '/api/lifecycle/transfers', { employeeId: subject, transferType: 'department', effectiveDate: '2097-06-01', targetDepartmentId: dept2, reason: 'Plant restructuring' });
    expect(created.status).toBe(200);
    const id = (created.body as { id: number }).id;
    const row = await transferRow(id);
    expect(row.status).toBe('pending');
    expect(row.workflow_request_id).not.toBeNull();
    // HR ops alone cannot complete it (B-18).
    expect((await post('ops', `/api/lifecycle/transfers/${String(id)}/approve`, {})).status).toBe(409);
    expect((await post('ops', `/api/lifecycle/transfers/${String(id)}/reject`, { remarks: 'x' })).status).toBe(409);

    const requestId = row.workflow_request_id ?? 0;
    await act(tx(), { requestId, actorUserId: uid['rm'] ?? 0, action: 'approve' });
    expect((await transferRow(id)).status).toBe('pending'); // HR step still open
    await act(tx(), { requestId, actorUserId: uid['ops2'] ?? 0, action: 'approve' });
    const approved = await transferRow(id);
    expect(approved.status).toBe('approved');
    expect(approved.approved_by).toBe(uid['ops2']);
    expect(await deptOf()).toBe(dept1); // nothing changes before the effective date

    // (Counts are global; other suites' approved rows may also fall due.)
    await applyDueTransfers(tx(), '2097-05-31');
    expect((await transferRow(id)).status).toBe('approved');
    expect((await applyDueTransfers(tx(), '2097-06-01')).applied).toBeGreaterThanOrEqual(1);
    expect((await transferRow(id)).status).toBe('completed');
    expect(await deptOf()).toBe(dept2);
    expect((await transferRow(id)).approved_by).toBe(uid['ops2']); // the approver, not the scheduler
  });

  it('a rejection in the chain rejects the transfer; due-dated approval applies at once; a scheduled one can be called off', async () => {
    const created = await post('ops', '/api/lifecycle/transfers', { employeeId: subject, transferType: 'department', effectiveDate: '2097-07-01', targetDepartmentId: dept1, reason: 'Back again' });
    const id = (created.body as { id: number }).id;
    const requestId = (await transferRow(id)).workflow_request_id ?? 0;
    await act(tx(), { requestId, actorUserId: uid['rm'] ?? 0, action: 'reject', comment: 'Not now' });
    expect((await transferRow(id)).status).toBe('rejected');

    // Legacy (chain-less) path: effective today → applied immediately.
    const today = await createTransferRequest(tx(), { employeeId: subject, transferType: 'department', effectiveDate: '2000-01-01', targetDepartmentId: dept1, reason: 'Backdated' }, uid['ops'] ?? 0);
    expect(await approveTransferRequest(tx(), today.id, uid['ops'] ?? 0)).toMatchObject({ success: true });
    expect((await transferRow(today.id)).status).toBe('completed');
    expect(await deptOf()).toBe(dept1);

    const later = await createTransferRequest(tx(), { employeeId: subject, transferType: 'department', effectiveDate: '2098-01-01', targetDepartmentId: dept2, reason: 'Later' }, uid['ops'] ?? 0);
    expect(await approveTransferRequest(tx(), later.id, uid['ops'] ?? 0)).toMatchObject({ scheduled: true });
    await expect(approveTransferRequest(tx(), later.id, uid['ops'] ?? 0)).rejects.toThrow(/not pending/);
    await rejectTransferRequest(tx(), later.id, 'Plan changed', uid['ops'] ?? 0);
    expect((await transferRow(later.id)).status).toBe('rejected');
    await applyDueTransfers(tx(), '2098-01-01');
    expect((await transferRow(later.id)).status).toBe('rejected');
    expect(await deptOf()).toBe(dept1);
    await expect(approveTransferRequest(tx(), 999999999, uid['ops'] ?? 0)).rejects.toThrow(/not found/);
  });
});
