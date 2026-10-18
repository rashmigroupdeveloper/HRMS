/**
 * P-08 / S-18: loans start 'pending', activate only after RM → HR head →
 * payroll approve, eligibility is enforced, interest comes from policy and the
 * ledger is owner/payroll-scope only. Legacy imports keep their reference.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { act } from '../src/modules/workflows/index.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

interface LoanBody { loanId: number; status: string; annualInterestRate: number; source: string; employeeId: number }

describe.skipIf(!DB_URL)('Loan approval lifecycle (P-08, S-18)', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const p: Record<string, { employeeId: number; userId: number; token: string }> = {};
  const startMonth = (() => { const d = new Date(Date.now() + 5.5 * 3600_000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })();

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = 'loan_' + randomUUID().slice(0, 8);
    const company = await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: true }).returning('id').executeTakeFirstOrThrow();
    const person = async (suffix: string, rm: number | null, role: string | null) => {
      const e = await tx.insertInto('core.employees').values({ company_id: company.id, ecode: `${tag}${suffix}`, first_name: `Synthetic ${suffix}`, status: 'active', doj: '2015-01-01', reporting_manager_id: rm }).returning('id').executeTakeFirstOrThrow();
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${suffix}@hrms.invalid`, employee_id: e.id, password_hash: '!disabled!' }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const roleRow = await tx.selectFrom('core.roles').select('id').where('code', '=', role ?? 'employee').executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: roleRow.id }).execute();
      const session = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      p[suffix] = { employeeId: e.id, userId: u.id, token: await signAccessToken(u.id, u.email, JWT_SECRET, session.sid) };
    };
    await person('mgr', null, null);
    await person('emp', p['mgr']?.employeeId ?? null, null);
    await person('out', null, null);
    await person('head', null, 'hr_head');
    await person('pay', null, 'payroll_admin');
    const structure = await tx.insertInto('pay.salary_structures').values({ name: `${tag}-s`, company_id: company.id, components: JSON.stringify([]) as never }).returning('id').executeTakeFirstOrThrow();
    await tx.insertInto('pay.employee_salaries').values({
      employee_id: p['emp']?.employeeId ?? 0, structure_id: structure.id, effective_from: '2024-04-01' as never, annual_ctc: '774876.00',
      component_amounts: JSON.stringify({ BASIC: 3228600, HRA: 1614300, MEDICAL_ALLOW: 125000, SPECIAL_ALLOW: 1200500, EDUCATION_ALLOW: 20000, STATUTORY_BONUS: 268900 }) as never,
    }).execute();
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });

  it('applies pending with policy interest, then activates only after the full chain', async () => {
    const c = await httpRequest(app);
    const tok = (k: string) => p[k]?.token ?? '';
    const tooBig = await c.post('/api/loans/apply').auth(tok('emp'), { type: 'bearer' }).send({ loanType: 'loan_diminishing', principalRupees: 900000, tenureMonths: 6, startMonth });
    expect(tooBig.status).toBe(400);
    const past = await c.post('/api/loans/apply').auth(tok('emp'), { type: 'bearer' }).send({ loanType: 'salary_advance', principalRupees: 10000, tenureMonths: 1, startMonth: '2020-01-01' });
    expect(past.status).toBe(400);

    const res = await c.post('/api/loans/apply').auth(tok('emp'), { type: 'bearer' }).send({ loanType: 'emi_no_interest', principalRupees: 60000, annualInterestRate: 2, tenureMonths: 6, startMonth });
    expect(res.status).toBe(200);
    const loanId = (res.body as LoanBody).loanId;
    const tx = transaction as unknown as Kysely<Database>;
    const row = await tx.selectFrom('pay.loans').select(['status', 'interest_rate', 'workflow_request_id']).where('id', '=', loanId).executeTakeFirstOrThrow();
    expect(row.status).toBe('pending');
    expect(Number(row.interest_rate)).toBe(0);
    expect(row.workflow_request_id).not.toBeNull();

    expect((await c.get(`/api/loans/${String(loanId)}/ledger`).auth(tok('out'), { type: 'bearer' })).status).toBe(403);
    expect((await c.get(`/api/loans/${String(loanId)}/ledger`).auth(tok('emp'), { type: 'bearer' })).status).toBe(200);
    expect((await c.get(`/api/loans/${String(loanId)}/ledger`).auth(tok('pay'), { type: 'bearer' })).status).toBe(200);
    expect((await c.get('/api/loans/999999999/ledger').auth(tok('pay'), { type: 'bearer' })).status).toBe(404);

    const requestId = Number(row.workflow_request_id);
    await expect(act(tx, { requestId, actorUserId: p['emp']?.userId ?? 0, action: 'approve' })).rejects.toThrow();
    for (const k of ['mgr', 'head']) {
      await act(tx, { requestId, actorUserId: p[k]?.userId ?? 0, action: 'approve' });
      expect((await tx.selectFrom('pay.loans').select('status').where('id', '=', loanId).executeTakeFirstOrThrow()).status).toBe('pending');
    }
    await act(tx, { requestId, actorUserId: p['pay']?.userId ?? 0, action: 'approve' });
    expect((await tx.selectFrom('pay.loans').select('status').where('id', '=', loanId).executeTakeFirstOrThrow()).status).toBe('active');
  });

  it('rejection marks the loan rejected; legacy import keeps a valid source and refuses duplicates', async () => {
    const c = await httpRequest(app);
    const tx = transaction as unknown as Kysely<Database>;
    const res = await c.post('/api/loans/apply').auth(p['emp']?.token ?? '', { type: 'bearer' }).send({ loanType: 'salary_advance', principalRupees: 10000, tenureMonths: 1, startMonth });
    expect(res.status).toBe(200);
    const loan = await tx.selectFrom('pay.loans').select('workflow_request_id').where('id', '=', (res.body as LoanBody).loanId).executeTakeFirstOrThrow();
    await act(tx, { requestId: Number(loan.workflow_request_id), actorUserId: p['mgr']?.userId ?? 0, action: 'reject', comment: 'not now' });
    expect((await tx.selectFrom('pay.loans').select('status').where('id', '=', (res.body as LoanBody).loanId).executeTakeFirstOrThrow()).status).toBe('rejected');

    const legacy = { employeeId: p['emp']?.employeeId, loanType: 'loan_diminishing', originalPrincipalRupees: 200000, outstandingBalanceRupees: 120000, annualInterestRate: 8.5, monthlyEmiRupees: 10000, remainingTenureMonths: 12, startMonth: '2025-01-01', sourceReference: 'SAP-LN-1' };
    const pay = p['pay']?.token ?? '';
    expect((await c.post('/api/loans/legacy-import').auth(p['emp']?.token ?? '', { type: 'bearer' }).send(legacy)).status).toBe(403);
    expect((await c.post('/api/loans/legacy-import').auth(pay, { type: 'bearer' }).send({ ...legacy, outstandingBalanceRupees: 300000 })).status).toBe(400);
    const ok = await c.post('/api/loans/legacy-import').auth(pay, { type: 'bearer' }).send(legacy);
    expect(ok.status).toBe(200);
    const stored = await tx.selectFrom('pay.loans').select(['source', 'source_reference', 'status']).where('id', '=', (ok.body as LoanBody).loanId).executeTakeFirstOrThrow();
    expect(stored).toEqual({ source: 'sap_legacy', source_reference: 'SAP-LN-1', status: 'active' });
    expect((await c.post('/api/loans/legacy-import').auth(pay, { type: 'bearer' }).send(legacy)).status).toBe(409);
  });
});
