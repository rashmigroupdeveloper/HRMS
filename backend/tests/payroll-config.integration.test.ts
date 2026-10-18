/**
 * Payroll configurability without SQL: effective-dated statutory parameters and
 * PT slabs (no retro edits of finalized months), GL mapping, run variable
 * inputs incl. CSV bulk upload, the run register, and domain ownership of
 * policy settings (payroll vs technical vs HR). Every write is audited.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { httpRequest } from './http-client.js';
import { canEditSetting, settingOwners } from '../src/modules/settings/settings-ownership.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe('setting ownership map', () => {
  it('routes each namespace to its owning role; super_admin owns all', () => {
    expect(settingOwners('auth.password_min_length')).toEqual(['it_admin']);
    expect(settingOwners('att.device_silent_minutes')).toEqual(['it_admin']);
    expect(settingOwners('pay.pf_wage_base')).toEqual(['payroll_admin']);
    expect(settingOwners('loans.interest_rate_pct')).toEqual(['payroll_admin', 'hr_head']);
    expect(settingOwners('lv.rh_max_per_year')).toEqual(['hr_head']);
    expect(settingOwners('mystery.key')).toEqual([]);
    expect(canEditSetting(new Set(['super_admin']), 'mystery.key')).toBe(true);
    expect(canEditSetting(new Set(['payroll_admin']), 'auth.failure_threshold')).toBe(false);
  });
});

describe.skipIf(!DB_URL)('Payroll configuration API', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const uid: Record<string, number> = {};
  let companyId = 0; let otherCompanyId = 0; let tag = '';
  const emp: Record<string, number> = {};

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    tag = 'cfg' + randomUUID().slice(0, 6);
    companyId = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    otherCompanyId = (await tx.insertInto('core.companies').values({ code: `${tag}x`, name: `${tag}x`, ecode_prefix: `${tag}x` }).returning('id').executeTakeFirstOrThrow()).id;
    for (const [code, company] of [['E1', companyId], ['E2', companyId], ['X1', otherCompanyId]] as const) {
      emp[code] = (await tx.insertInto('core.employees').values({ company_id: company, ecode: `${tag}${code}`, first_name: code, status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    }
    for (const role of ['payroll_admin', 'hr_head', 'it_admin', 'super_admin', 'employee']) {
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${role}@hrms.invalid`, password_hash: '!disabled!' }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id }).execute();
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      uid[role] = u.id;
      t[role] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });
  const tx = () => { if (!transaction) throw new Error('no transaction'); return transaction; };

  it('versions statutory parameters by month, audited, never retro into a finalized month', async () => {
    const c = await httpRequest(app);
    const body = { scheme: 'ESIC', param: 'wage_ceiling', value: 25000, effectiveFrom: '2098-01-01', sourceNote: 'ESIC notification (synthetic)' };
    expect((await c.post('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['it_admin'] ?? ''}`).send(body)).status).toBe(403);
    expect((await c.post('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['hr_head'] ?? ''}`).send(body)).status).toBe(403);
    expect((await c.post('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`).send({ ...body, param: 'bogus' })).status).toBe(400);
    expect((await c.post('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`).send({ ...body, effectiveFrom: '2098-01-15' })).status).toBe(400);
    expect((await c.post('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`).send({ ...body, scheme: 'PF', param: 'ee_rate_pct', value: 120 })).status).toBe(400);
    const params = await c.get('/api/payroll/config/statutory-params').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`);
    expect((params.body as Record<string, string[]>)['ESIC']).toContain('wage_ceiling');
    const ok = await c.post('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`).send(body);
    expect(ok.status).toBe(200);
    const list = await c.get('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['hr_head'] ?? ''}`);
    expect(list.status).toBe(200);
    expect((list.body as { scheme: string; param: string; value: number; effectiveFrom: string }[]).some((r) => r.scheme === 'ESIC' && r.value === 25000 && r.effectiveFrom === '2098-01-01')).toBe(true);
    const audit = await tx().selectFrom('core.audit_log').select(['old_value', 'new_value']).where('action', '=', 'statutory_rate_set').orderBy('id', 'desc').executeTakeFirstOrThrow();
    expect(String(audit.new_value)).toContain('25000');
    expect(String(audit.old_value)).toContain('21000');
    // Finalized June 2098 blocks a change effective from March 2098.
    const lock = await tx().insertInto('att.month_locks').values({ company_id: companyId, month: '2098-06-01', locked_at: new Date(), locked_by: uid['payroll_admin'] ?? 0 }).returning('id').executeTakeFirstOrThrow();
    await tx().insertInto('pay.payroll_runs').values({ company_id: companyId, month: '2098-06-01' as never, status: 'finalized', attendance_lock_id: lock.id, finalized_at: new Date() }).execute();
    const retro = await c.post('/api/payroll/config/statutory-rates').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`).send({ ...body, effectiveFrom: '2098-03-01' });
    expect(retro.status).toBe(409);
    expect((retro.body as { message: string }).message).toMatch(/already finalized/);
  });

  it('replaces PT slab sets per state with contiguity checks', async () => {
    const c = await httpRequest(app);
    const auth = `Bearer ${t['payroll_admin'] ?? ''}`;
    const overlap = await c.put('/api/payroll/config/pt-slabs').set('Authorization', auth).send({ stateCode: 'MH', effectiveFrom: '2099-01-01', basis: 'earned_monthly', slabs: [{ minMonthly: 0, maxMonthly: 10000, amount: 0 }, { minMonthly: 9000, maxMonthly: null, amount: 200 }] });
    expect(overlap.status).toBe(400);
    const open = await c.put('/api/payroll/config/pt-slabs').set('Authorization', auth).send({ stateCode: 'MH', effectiveFrom: '2099-01-01', basis: 'earned_monthly', slabs: [{ minMonthly: 0, maxMonthly: null, amount: 0 }, { minMonthly: 9000, maxMonthly: null, amount: 200 }] });
    expect(open.status).toBe(400);
    const ok = await c.put('/api/payroll/config/pt-slabs').set('Authorization', auth).send({ stateCode: 'mh', effectiveFrom: '2099-01-01', basis: 'earned_monthly', slabs: [{ minMonthly: 10001, maxMonthly: null, amount: 200 }, { minMonthly: 0, maxMonthly: 10000, amount: 0 }] });
    expect(ok.status).toBe(200);
    expect((ok.body as { count: number }).count).toBe(2);
    const again = await c.put('/api/payroll/config/pt-slabs').set('Authorization', auth).send({ stateCode: 'MH', effectiveFrom: '2099-01-01', basis: 'contracted_monthly', slabs: [{ minMonthly: 0, maxMonthly: null, amount: 175 }] });
    expect(again.status).toBe(200);
    const list = (await c.get('/api/payroll/config/pt-slabs').set('Authorization', auth)).body as { stateCode: string; effectiveFrom: string; amount: number }[];
    expect(list.filter((r) => r.stateCode === 'MH' && r.effectiveFrom === '2099-01-01').map((r) => r.amount)).toEqual([175]);
    expect((await c.put('/api/payroll/config/pt-slabs').set('Authorization', `Bearer ${t['employee'] ?? ''}`).send({ stateCode: 'MH', effectiveFrom: '2099-01-01', basis: 'earned_monthly', slabs: [] })).status).toBe(403);
  });

  it('GL mapping requires a real component and payroll rights', async () => {
    const c = await httpRequest(app);
    const body = { companyCode: 'RML', plantCode: 'P1', costCenterCode: 'CC1', componentCode: 'NOPE', glCode: '510001' };
    expect((await c.put('/api/payroll/config/gl-accounts').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`).send(body)).status).toBe(404);
    expect((await c.put('/api/payroll/config/gl-accounts').set('Authorization', `Bearer ${t['it_admin'] ?? ''}`).send(body)).status).toBe(403);
    expect((await c.get('/api/payroll/config/gl-accounts').set('Authorization', `Bearer ${t['payroll_admin'] ?? ''}`)).status).toBe(200);
  });

  it('takes variable inputs on a draft run (single + CSV), refuses engine components, other companies and locked runs', async () => {
    const c = await httpRequest(app);
    const auth = `Bearer ${t['payroll_admin'] ?? ''}`;
    const lock = await tx().insertInto('att.month_locks').values({ company_id: companyId, month: '2099-05-01', locked_at: new Date(), locked_by: uid['payroll_admin'] ?? 0 }).returning('id').executeTakeFirstOrThrow();
    const run = await tx().insertInto('pay.payroll_runs').values({ company_id: companyId, month: '2099-05-01' as never, attendance_lock_id: lock.id }).returning('id').executeTakeFirstOrThrow();
    const url = `/api/payroll/runs/${String(run.id)}/inputs`;
    const good = { employeeId: emp['E1'], componentCode: 'INCENTIVE', amountRupees: 1500, note: 'Q1 incentive' };
    expect((await c.post(url).set('Authorization', `Bearer ${t['employee'] ?? ''}`).send({ inputs: [good] })).status).toBe(403);
    const bad = await c.post(url).set('Authorization', auth).send({ inputs: [good, { ...good, componentCode: 'PF_EE' }, { ...good, employeeId: emp['X1'] }, { ...good, componentCode: 'ZZZ' }, { ...good, amountRupees: 1.005 }] });
    expect(bad.status).toBe(400);
    const msg = (bad.body as { message: string }).message;
    expect(msg).toMatch(/Row 2: PF_EE is computed/);
    expect(msg).toMatch(/Row 3: employee .* not in this run's company/);
    expect(msg).toMatch(/Row 4: unknown component ZZZ/);
    expect(msg).toMatch(/Row 5: amount/);
    expect((await c.post(url).set('Authorization', auth).send({ inputs: [good] })).status).toBe(200);
    const csv = `ECode,Component_Code,Amount,Note\n${tag}E1,canteen,450.50,June canteen\n${tag}E2,GUEST_HOUSE,1200,"Room 4, two nights"\n`;
    const up = await c.post(`${url}/upload`).set('Authorization', auth).send({ csv });
    expect(up.status).toBe(200);
    expect((up.body as { inserted: number }).inserted).toBe(2);
    expect((await c.post(`${url}/upload`).set('Authorization', auth).send({ csv: `ecode,component_code,amount,note\nNOBODY,CANTEEN,1,x y\n` })).status).toBe(400);
    expect((await c.post(`${url}/upload`).set('Authorization', auth).send({ csv: `ecode,amount,note\n${tag}E1,1,xy\n` })).status).toBe(400);
    const list = (await c.get(url).set('Authorization', auth)).body as { id: number; componentCode: string; amountRupees: number; note: string }[];
    expect(list.map((r) => r.componentCode).sort()).toEqual(['CANTEEN', 'GUEST_HOUSE', 'INCENTIVE']);
    expect(list.find((r) => r.componentCode === 'GUEST_HOUSE')?.note).toBe('Room 4, two nights');
    const first = list[0];
    expect((await c.delete(`${url}/${String(first?.id)}`).set('Authorization', auth)).status).toBe(200);
    expect((await c.delete(`${url}/${String(first?.id)}`).set('Authorization', auth)).status).toBe(404);
    expect((await tx().selectFrom('core.audit_log').select('id').where('action', 'in', ['payroll_inputs_added', 'payroll_input_removed']).where('entity_id', '=', run.id).execute()).length).toBe(3);
    await tx().updateTable('pay.payroll_runs').set({ status: 'inputs_locked' }).where('id', '=', run.id).execute();
    expect((await c.post(url).set('Authorization', auth).send({ inputs: [good] })).status).toBe(409);
    expect((await c.post('/api/payroll/runs/99999999/inputs').set('Authorization', auth).send({ inputs: [good] })).status).toBe(404);
    const items = await c.get(`/api/payroll/runs/${String(run.id)}/items`).set('Authorization', auth);
    expect(items.status).toBe(200);
    expect(items.body).toEqual([]);
  });

  it('enforces setting ownership: payroll vs technical vs HR', async () => {
    const c = await httpRequest(app);
    const put = (role: string, key: string, value: unknown, valueType: string) => c.put(`/api/settings/${key}`).set('Authorization', `Bearer ${t[role] ?? ''}`).send({ value, valueType, description: 'ownership test' });
    expect((await put('payroll_admin', 'auth.password_min_length', 14, 'number')).status).toBe(403);
    expect((await put('it_admin', 'pay.negative_net_policy', 'flag', 'string')).status).toBe(403);
    expect((await put('hr_head', 'pay.pf_wage_base', 'CEILING_15000', 'string')).status).toBe(403);
    expect((await put('payroll_admin', 'pay.negative_net_policy', 'flag', 'string')).status).toBe(200);
    expect((await put('it_admin', 'auth.password_min_length', 12, 'number')).status).toBe(200);
    expect((await put('hr_head', 'lv.rh_max_per_year', 2, 'number')).status).toBe(200);
    expect((await put('super_admin', 'pay.pf_wage_base', 'ACTUAL', 'string')).status).toBe(200);
  });
});
