/**
 * LC-06 / LC-07 / PAY-15 against PostgreSQL:
 *  C-01/B-04 resignation is self-only; one open case; the resignation chain
 *  (RM → HR head → HR ops) decides it; scoped reads (C-16); F&F in paise
 *  (C-08/P-02); payment gated on clearances (P-02); exit-day cascade.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { addDaysIso, istDateString } from '../src/core/dates.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

interface Sep { id: number; status: string; workflowRequestId: number | null; approvedLwd: string | null; employeeId: number }
interface Body { separation: Sep; separations: Sep[]; clearances: { department: string; status: string }[]; calculation: Record<string, unknown> & { earnings: Record<string, number>; netPayablePaise: number; daysPayable: number }; status: string }

describe.skipIf(!DB_URL)('Separation lifecycle (LC-06/07, PAY-15)', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const emp: Record<string, number> = {};

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    tx = await db.startTransaction().execute();
    const tag = 'sep_' + randomUUID().slice(0, 8);
    const company = await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: true }).returning('id').executeTakeFirstOrThrow();
    const unit = await tx.insertInto('core.org_units').values({ company_id: company.id, name: `${tag}-unit` }).returning('id').executeTakeFirstOrThrow();
    const person = async (key: string, rm: number | null, role: string | null, extra: Record<string, unknown> = {}) => {
      const e = await tx.insertInto('core.employees').values({ company_id: company.id, ecode: `${tag}${key}`, first_name: `Synthetic ${key}`, status: 'active', doj: '2017-11-01', reporting_manager_id: rm, category: 'white_collar', org_unit_id: unit.id, ...extra }).returning('id').executeTakeFirstOrThrow();
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${key}@hrms.invalid`, employee_id: e.id, password_hash: '!disabled!' }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role ?? 'employee').executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: role === 'hr_ops' ? unit.id : null }).execute();
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      emp[key] = e.id;
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    };
    await person('mgr', null, null);
    await person('emp', null, null);
    await tx.updateTable('core.employees').set({ reporting_manager_id: emp['mgr'] ?? null }).where('id', '=', emp['emp'] ?? 0).execute();
    await person('other', null, null);
    await person('head', null, 'hr_head');
    await person('ops', null, 'hr_ops');
    await person('pay', null, 'payroll_admin');
    await person('it', null, 'it_admin');
    const structure = await tx.insertInto('pay.salary_structures').values({ name: `${tag}-staff`, company_id: company.id, components: JSON.stringify([]) as never }).returning('id').executeTakeFirstOrThrow();
    await tx.insertInto('pay.employee_salaries').values({
      employee_id: emp['emp'] ?? 0, structure_id: structure.id, effective_from: '2024-04-01' as never, annual_ctc: '774876.00',
      // Integer paise — the RML G1 baseline.
      component_amounts: JSON.stringify({ BASIC: 3228600, HRA: 1614300, MEDICAL_ALLOW: 125000, SPECIAL_ALLOW: 1200500, EDUCATION_ALLOW: 20000, STATUTORY_BONUS: 268900, PF_EE: 387400, PF_ER: 262400 }) as never,
    }).execute();
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (!tx.isRolledBack && !tx.isCommitted) await tx.rollback().execute(); } finally { await db.destroy(); }
  });

  it('runs the resignation chain, scoped reads, paise-correct F&F and the gated exit cascade', async () => {
    const c = await httpRequest(app);
    const post = (path: string, who: string, body: object = {}) => c.post(path).auth(t[who] ?? '', { type: 'bearer' }).send(body);
    const get = (path: string, who: string) => c.get(path).auth(t[who] ?? '', { type: 'bearer' });
    const lwd = addDaysIso(istDateString(), 95);

    // C-01 / B-04: nobody resigns on someone else's behalf.
    expect((await post('/api/lifecycle/separations/apply', 'other', { employeeId: emp['emp'], reason: 'Resigning for a colleague', requestedLwd: lwd })).status).toBe(403);
    expect((await post('/api/lifecycle/separations/apply', 'emp', { reason: 'Career move', requestedLwd: addDaysIso(istDateString(), -1) })).status).toBe(400);
    const applied = await post('/api/lifecycle/separations/apply', 'emp', { reason: 'Career move outside', requestedLwd: lwd });
    expect(applied.status).toBe(200);
    const sep = (applied.body as Body).separation;
    expect(sep.status).toBe('pending');
    expect(sep.workflowRequestId).not.toBeNull();
    expect((await post('/api/lifecycle/separations/apply', 'emp', { reason: 'Second attempt', requestedLwd: lwd })).status).toBe(409);

    // Reads: own + approvers in scope; an unrelated employee is refused.
    expect((await get(`/api/lifecycle/separations/${sep.id}`, 'emp')).status).toBe(200);
    expect((await get(`/api/lifecycle/separations/${sep.id}`, 'other')).status).toBe(403);
    expect(((await get('/api/lifecycle/separations/mine', 'emp')).body as Body).separations).toHaveLength(1);
    expect((await get('/api/lifecycle/separations', 'other')).status).toBe(403);

    // The chain decides; out-of-turn approvers and the subject are refused.
    expect((await post(`/api/lifecycle/separations/${sep.id}/approve`, 'head')).status).toBe(403);
    expect((await post(`/api/lifecycle/separations/${sep.id}/approve`, 'emp')).status).toBe(403);
    expect((await post(`/api/lifecycle/separations/${sep.id}/approve`, 'mgr', { approvedLwd: '2001-01-01' })).status).toBe(400);
    const step1 = await post(`/api/lifecycle/separations/${sep.id}/approve`, 'mgr');
    expect(step1.status).toBe(200);
    expect((step1.body as Body).separation.status).toBe('pending');
    expect((await post(`/api/lifecycle/separations/${sep.id}/approve`, 'head')).status).toBe(200);
    const final = await post(`/api/lifecycle/separations/${sep.id}/approve`, 'ops');
    expect(final.status).toBe(200);
    expect((final.body as Body).separation.status).toBe('approved');
    expect((final.body as Body).separation.approvedLwd).toBe(lwd);
    const after = await tx.selectFrom('core.employees').select('status').where('id', '=', emp['emp'] ?? 0).executeTakeFirstOrThrow();
    expect(after.status).toBe('on_notice');

    // C-08 / P-02: paise-correct F&F from the paise snapshot, earnings only.
    // Explicit frozen final-month facts replace the old assumed-presence fallback.
    await tx.insertInto('att.day_records').values(Array.from({length:Number(lwd.slice(8,10))},(_,i)=>({
      employee_id:emp['emp'] ?? 0,work_date:addDaysIso(`${lwd.slice(0,7)}-01`,i),status:'P' as const,is_locked:true,
    }))).execute();
    const fnf = await post(`/api/lifecycle/separations/${sep.id}/compute-fnf`, 'pay', { elBalanceDays: 10 });
    expect(fnf.status).toBe(200);
    const calc = (fnf.body as Body).calculation;
    const days = Number(lwd.slice(8, 10));
    const dim = new Date(Date.UTC(Number(lwd.slice(0, 4)), Number(lwd.slice(5, 7)), 0)).getUTCDate();
    expect(calc.daysPayable).toBe(days);
    expect(calc.earnings['proratedSalaryPaise']).toBe(Math.round((6457300 / dim) * days));
    expect(calc.earnings['leaveEncashmentPaise']).toBe(Math.round((3228600 / 30) * 10));
    expect(calc.earnings['gratuityPaise']).toBeLessThan(40_000_000); // ~₹1.7–2.2L, never the ₹20L cap
    expect(calc.netPayablePaise).toBeGreaterThan(0);

    // Payment is refused while clearances are pending, and only owners clear their department.
    expect((await post(`/api/lifecycle/separations/${sep.id}/pay`, 'pay')).status).toBe(409);
    expect((await post('/api/lifecycle/clearances/update', 'pay', { separationId: sep.id, department: 'IT', status: 'cleared' })).status).toBe(403);
    expect((await post('/api/lifecycle/clearances/update', 'it', { separationId: sep.id, department: 'IT', status: 'cleared' })).status).toBe(200);
    expect((await post('/api/lifecycle/clearances/update', 'it', { separationId: sep.id, department: 'Admin', status: 'cleared' })).status).toBe(200);
    expect((await post('/api/lifecycle/clearances/update', 'pay', { separationId: sep.id, department: 'Finance', status: 'cleared' })).status).toBe(200);
    expect((await post('/api/lifecycle/clearances/update', 'head', { separationId: sep.id, department: 'HR', status: 'cleared' })).status).toBe(200);
    expect((await post(`/api/lifecycle/separations/${sep.id}/compute-fnf`, 'pay', { elBalanceDays: 10 })).status).toBe(200);
    // Two-person rule: payroll_admin initiates, payment needs finalize authority.
    const paid = await post(`/api/lifecycle/separations/${sep.id}/pay`, 'pay', { paymentReference: 'UTR-TEST-1' });
    expect(paid.status).toBe(200);
    const exited = await tx.selectFrom('core.employees').select(['status', 'dol']).where('id', '=', emp['emp'] ?? 0).executeTakeFirstOrThrow();
    expect(exited.status).toBe('exited');
    expect((await post(`/api/lifecycle/separations/${sep.id}/pay`, 'pay')).status).toBe(409);
    const audits = await tx.selectFrom('core.audit_log').select('action').where('entity', 'in', ['pay.fnf_settlements', 'core.separations']).execute();
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(['create', 'fnf_computed', 'fnf_paid']));
  });

  it('lets the employee withdraw a pending resignation, cancelling its approval request', async () => {
    const c = await httpRequest(app);
    const lwd = addDaysIso(istDateString(), 40);
    const applied = await c.post('/api/lifecycle/separations/apply').auth(t['other'] ?? '', { type: 'bearer' }).send({ reason: 'Relocating home', requestedLwd: lwd });
    expect(applied.status).toBe(200);
    const sep = (applied.body as Body).separation;
    expect((await c.post(`/api/lifecycle/separations/${sep.id}/withdraw`).auth(t['mgr'] ?? '', { type: 'bearer' }).send({ reason: 'not mine' })).status).toBe(403);
    const w = await c.post(`/api/lifecycle/separations/${sep.id}/withdraw`).auth(t['other'] ?? '', { type: 'bearer' }).send({ reason: 'Changed my mind' });
    expect(w.status).toBe(200);
    expect((w.body as Body).separation.status).toBe('withdrawn');
    const req = await tx.selectFrom('wf.requests').select('status').where('id', '=', sep.workflowRequestId ?? 0).executeTakeFirstOrThrow();
    expect(req.status).toBe('cancelled');
  });
});
