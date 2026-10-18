/** Owner bar #2: no-swipe days are materialised so a Kent-fed month can close; muster LOP = payroll LOP. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type ControlledTransaction, type Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { formatDbDate } from '../src/core/dates.js';
import { queueMissingDays, queueRecentMissingDays } from '../src/modules/attendance/index.js';
import { buildMusterMonth } from '../src/modules/reports/muster.service.js';
import { setSetting } from '../src/modules/settings/index.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('attendance day materialisation + muster LOP parity', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  let company = 0;
  let legacy = 0;
  const emp: Record<string, number> = {};

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    tx = await db.startTransaction().execute();
    const tag = ('DM' + randomUUID().slice(0, 5)).toUpperCase();
    company = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    legacy = (await tx.insertInto('core.companies').values({ code: `${tag}L`, name: `${tag}L`, ecode_prefix: `${tag}L` }).returning('id').executeTakeFirstOrThrow()).id;
    const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: tag }).returning('id').executeTakeFirstOrThrow()).id;
    const legacyUnit = (await tx.insertInto('core.org_units').values({ company_id: legacy, name: `${tag}L` }).returning('id').executeTakeFirstOrThrow()).id;
    const add = async (key: string, values: { company_id?: number; status?: 'active' | 'exited' | 'onboarding'; doj: string; dol?: string }) => {
      emp[key] = (await tx.insertInto('core.employees').values({ company_id: values.company_id ?? company, org_unit_id: values.company_id === legacy ? legacyUnit : unit, ecode: `${tag}${key}`, first_name: key, status: values.status ?? 'active', doj: values.doj as never, dol: (values.dol ?? null) as never }).returning('id').executeTakeFirstOrThrow()).id;
    };
    await add('J', { doj: '2030-03-03' });                                   // joiner
    await add('X', { doj: '2020-01-01', dol: '2030-03-05', status: 'exited' }); // leaver
    await add('O', { doj: '2020-01-01', status: 'onboarding' });             // not yet employed → never queued
    await add('LG', { company_id: legacy, doj: '2020-01-01' });              // legacy lock without a stored window
    const user = await tx.insertInto('core.users').values({ email: `${tag.toLowerCase()}@hrms.invalid`, password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
    await tx.insertInto('att.month_locks').values({ company_id: company, month: '2030-02-01' as never, locked_by: user.id, period_from: '2030-02-01' as never, period_until: '2030-03-01' as never }).execute();
    await tx.insertInto('att.month_locks').values({ company_id: legacy, month: '2030-02-01' as never, locked_by: user.id }).execute();
    await tx.insertInto('att.day_records').values({ employee_id: emp['J'] ?? 0, work_date: '2030-03-04' as never, status: 'P' }).execute();

    for (const [key, role, scope] of [['admin', 'super_admin', null], ['entity', 'hr_head', unit]] as const) {
      const u = await tx.insertInto('core.users').values({ email: `${tag.toLowerCase()}-${key}@hrms.invalid`, password_hash: '!disabled!', is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: scope }).execute();
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (!tx.isRolledBack && !tx.isCommitted) await tx.rollback().execute(); } finally { await db.destroy(); }
  });

  const queued = async (key: string) => (await tx.selectFrom('att.recompute_queue').select('work_date').where('employee_id', '=', emp[key] ?? 0).orderBy('work_date').execute()).map((r) => formatDbDate(r.work_date));

  it('queues employment days without a record, outside locked periods, idempotently', async () => {
    expect(await queueMissingDays(tx, { from: '2030-03-08', until: '2030-03-08' })).toBe(0);
    await queueMissingDays(tx, { companyId: company, from: '2030-02-25', until: '2030-03-08' });
    expect(await queued('J')).toEqual(['2030-03-03', '2030-03-05', '2030-03-06', '2030-03-07']);  // from DOJ, 4 Mar has a record
    expect(await queued('X')).toEqual(['2030-03-01', '2030-03-02', '2030-03-03', '2030-03-04', '2030-03-05']); // Feb locked, ends at LWD
    expect(await queued('O')).toEqual([]);
    expect(await queued('LG')).toEqual([]); // other company not in range
    expect(await queueMissingDays(tx, { companyId: company, from: '2030-02-25', until: '2030-03-08' })).toBe(0);
    await queueMissingDays(tx, { companyId: legacy, from: '2030-02-27', until: '2030-03-02' });
    expect(await queued('LG')).toEqual(['2030-03-01']); // legacy calendar-month lock covers February
  });

  it('sweeps the configured lookback up to yesterday and rejects a bad lookback', async () => {
    await setSetting(tx, { key: 'att.materialize_lookback_days', value: 2, type: 'number', description: 'test', actorUserId: null });
    await queueRecentMissingDays(tx, '2030-03-10');
    expect((await queued('J')).filter((d) => d >= '2030-03-08')).toEqual(['2030-03-08', '2030-03-09']);
    await expect(setSetting(tx, { key: 'att.materialize_lookback_days', value: 0, type: 'number', description: 'test', actorUserId: null })).rejects.toThrow();
    await tx.updateTable('core.settings').set({ value: sql`'0'::jsonb` }).where('key', '=', 'att.materialize_lookback_days').execute();
    await expect(queueRecentMissingDays(tx, '2030-03-10')).rejects.toThrow(/lookback/);
  });

  it('materialises a company period through the recompute API, scoped and bounded', async () => {
    const post = (who: string, body: object) => httpRequest(app).then((h) => h.post('/api/attendance/recompute').set('Authorization', `Bearer ${t[who] ?? ''}`).send(body));
    const ok = await post('admin', { companyId: company, from: '2030-03-10', until: '2030-03-12' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ outcome: null });
    expect((await post('admin', { companyId: company, from: '2030-03-12', until: '2030-03-10' })).status).toBe(400);
    expect((await post('admin', { companyId: company, from: '2030-01-01', until: '2030-06-01' })).status).toBe(400);
    expect((await post('entity', { companyId: legacy, from: '2030-03-10', until: '2030-03-12' })).status).toBe(403);
  });

  it('counts muster LOP exactly as payroll deducts it', async () => {
    const lt = new Map((await tx.selectFrom('lv.leave_types').select(['id', 'code']).execute()).map((l) => [l.code, l.id]));
    const p = emp['LG'] ?? 0;
    const rows: { d: string; status: 'P' | 'A' | 'HD' | 'WO'; leave?: string; sessions?: string; wo?: boolean | null }[] = [
      { d: '2030-04-01', status: 'HD', leave: 'CL', sessions: '[{"session":1,"status":"P"},{"session":2,"status":"A"}]' }, // paid half + worked half → 0
      { d: '2030-04-02', status: 'HD', leave: 'LWP' },   // unpaid half, other half not worked → 1
      { d: '2030-04-03', status: 'A' },                  // 1
      { d: '2030-04-04', status: 'HD' },                 // 0.5
      { d: '2030-04-07', status: 'WO', wo: false },      // forfeited → 1 (calendar divisors only)
      { d: '2030-04-14', status: 'WO', wo: null },       // week not closed yet → shown paid
    ];
    for (const r of rows) {
      await tx.insertInto('att.day_records').values({ employee_id: p, work_date: r.d as never, status: r.status, leave_type_id: r.leave ? (lt.get(r.leave) ?? null) : null, session_statuses: r.sessions ?? null, weekoff_paid: r.wo ?? null }).execute();
    }
    const lop = async () => {
      await buildMusterMonth(tx, legacy, '2030-04-01');
      return Number((await tx.selectFrom('reporting.muster_month').select('lop_days').where('employee_id', '=', p).executeTakeFirstOrThrow()).lop_days);
    };
    expect(await lop()).toBe(3.5);
    await setSetting(tx, { key: 'pay.lop_divisor', value: 'FIXED_26', type: 'string', description: 'test', actorUserId: null });
    expect(await lop()).toBe(2.5);
  });
});
