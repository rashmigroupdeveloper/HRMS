/** Handover item 3: ESS investment declarations, TDS challans + reconciliation, Form 24Q, Form 16. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type ControlledTransaction, type Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { fyLabel, fyMonths, inWindow, quarterMonths } from '../src/modules/tds/tds.service.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe('tds date helpers', () => {
  it('derives FY, months, quarters and windows', () => {
    expect(fyLabel('2026-06-15')).toBe('2026-27');
    expect(fyLabel('2027-03-31')).toBe('2026-27');
    expect(fyMonths('2026-27')[0]).toBe('2026-04-01');
    expect(fyMonths('2026-27')[11]).toBe('2027-03-01');
    expect(quarterMonths('2026-27', 4)).toEqual(['2027-01-01', '2027-02-01', '2027-03-01']);
    const w = { open: '04-01', close: '01-15' };
    expect(inWindow('2026-04-01', '2026-27', w)).toBe(true);
    expect(inWindow('2027-01-15', '2026-27', w)).toBe(true);
    expect(inWindow('2027-01-16', '2026-27', w)).toBe(false);
    expect(inWindow('2026-03-31', '2026-27', w)).toBe(false);
  });
});

describe.skipIf(!DB_URL)('tds compliance API', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  let company = 0;
  let other = 0;
  let emp = 0;
  const fy = fyLabel(new Date().toISOString().slice(0, 10));

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = ('tx' + randomUUID().slice(0, 5)).toUpperCase();
    company = (await tx.insertInto('core.companies').values({ code: tag, name: `${tag} Ltd`, ecode_prefix: tag, tan: 'CALR12345A', pan: 'AABCR1234K' }).returning('id').executeTakeFirstOrThrow()).id;
    other = (await tx.insertInto('core.companies').values({ code: `${tag}O`, name: `${tag}O`, ecode_prefix: `${tag}O` }).returning('id').executeTakeFirstOrThrow()).id;
    const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: `${tag} u` }).returning('id').executeTakeFirstOrThrow()).id;
    emp = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode: `${tag}E1`, first_name: 'Tax', last_name: 'Payer', pan: 'ABCPT1234K', status: 'active', doj: '2020-01-01', tax_regime: 'old' }).returning('id').executeTakeFirstOrThrow()).id;
    const nopan = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode: `${tag}E2`, first_name: 'No', status: 'exited', doj: '2020-01-01', dol: '2026-05-31' }).returning('id').executeTakeFirstOrThrow()).id;
    // Finalized April + May runs with TDS lines.
    const months = fyMonths(fy).slice(0, 2);
    const locker = (await tx.insertInto('core.users').values({ email: `${tag.toLowerCase()}-lock@hrms.invalid`, password_hash: '!disabled!', is_active: true }).returning('id').executeTakeFirstOrThrow()).id;
    for (const [i, month] of months.entries()) {
      const lock = (await tx.insertInto('att.month_locks').values({ company_id: company, month: sql<Date>`${month}::date`, locked_by: locker, checklist: '{}' }).returning('id').executeTakeFirstOrThrow()).id;
      const run = (await tx.insertInto('pay.payroll_runs').values({ company_id: company, month: month as unknown as Date, status: 'computed', attendance_lock_id: lock }).returning('id').executeTakeFirstOrThrow()).id;
      for (const [e, tds] of [[emp, 5000 + i * 1000], [nopan, 200]] as const) {
        const item = (await tx.insertInto('pay.payroll_items').values({ run_id: run, employee_id: e, days_in_month: '30', payable_days: '30', gross: '100000.00', total_deductions: String(tds), net_pay: String(100000 - tds) }).returning('id').executeTakeFirstOrThrow()).id;
        await tx.insertInto('pay.payroll_item_lines').values({ item_id: item, component_code: 'TDS', amount: String(tds) }).execute();
      }
      await tx.updateTable('pay.payroll_runs').set({ status: 'finalized' }).where('id', '=', run).execute();
    }
    const users: [string, string, number | null, number | null][] = [['ess', 'employee', emp, null], ['pay', 'payroll_admin', null, null], ['alum', 'employee', nopan, null], ['ops', 'hr_ops', null, unit]];
    for (const [key, role, employeeId, scope] of users) {
      const u = await tx.insertInto('core.users').values({ email: `${tag.toLowerCase()}-${key}@hrms.invalid`, password_hash: '!disabled!', employee_id: employeeId, is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: scope }).execute();
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });
  const tx = () => { if (!transaction) throw new Error('no transaction'); return transaction; };
  const call = async (method: 'get' | 'post' | 'delete', who: string, path: string, body?: unknown) => {
    const r = (await httpRequest(app))[method](path).set('Authorization', `Bearer ${t[who] ?? ''}`);
    return body === undefined ? r : r.send(body as object);
  };
  const setWindow = async (open: string, close: string) => {
    await tx().insertInto('core.settings').values({ key: 'tax.declaration_window', value: JSON.stringify({ open, close }), value_type: 'json', description: 'test' })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value: JSON.stringify({ open, close }) })).execute();
  };

  it('employee declares within the window; verified rows lock; closed window refuses', async () => {
    await setWindow('04-01', '03-31');
    expect((await call('post', 'ess', '/api/tax/me/declarations', { fy, section: '80C', amountRupees: 150000 })).status).toBe(200);
    expect((await call('post', 'ess', '/api/tax/me/declarations', { fy, section: '80C', amountRupees: 9999999 })).status).toBe(400);
    expect((await call('post', 'ess', '/api/tax/me/declarations', { fy, section: 'HRA', amountRupees: 1 })).status).toBe(400);
    expect((await call('post', 'ess', '/api/tax/me/regime', { fy, regime: 'new' })).body).toEqual({ regime: 'new' });
    expect((await call('post', 'ess', '/api/tax/me/regime', { fy, regime: 'old' })).status).toBe(200);
    const mine = (await call('get', 'ess', `/api/tax/me/declarations?fy=${fy}`)).body as { declarationOpen: boolean; items: { section: string; status: string }[] };
    expect(mine.declarationOpen).toBe(true);
    expect(mine.items).toEqual([expect.objectContaining({ section: '80C', status: 'declared' })]);
    // Proof must be the employee's own document.
    const doc = (await tx().insertInto('core.documents').values({ owner_employee_id: emp, kind: 'tax_proof', path: 'x', original_name: 'lic.pdf', mime: 'application/pdf', size_bytes: 1 }).returning('id').executeTakeFirstOrThrow()).id;
    const foreign = (await tx().insertInto('core.documents').values({ owner_employee_id: null, kind: 'x', path: 'y', original_name: 'y', mime: 'application/pdf', size_bytes: 1 }).returning('id').executeTakeFirstOrThrow()).id;
    expect((await call('post', 'ess', '/api/tax/me/declarations', { fy, section: '80C', amountRupees: 150000, proofDocumentId: foreign })).status).toBe(400);
    expect((await call('post', 'ess', '/api/tax/me/declarations', { fy, section: '80C', amountRupees: 150000, proofDocumentId: doc })).status).toBe(200);
    await tx().updateTable('pay.investment_declarations').set({ verified_amount: '150000', verified_at: sql`now()` }).where('employee_id', '=', emp).execute();
    expect((await call('post', 'ess', '/api/tax/me/declarations', { fy, section: '80C', amountRupees: 1000 })).status).toBe(409);
    // Closed window (a window that cannot contain today).
    await setWindow('04-01', '04-01');
    const today = new Date().toISOString().slice(5, 10);
    if (today !== '04-01') {
      expect((await call('post', 'ess', '/api/tax/me/declarations', { fy, section: '80D', amountRupees: 25000 })).status).toBe(400);
      expect((await call('post', 'ess', '/api/tax/me/regime', { fy, regime: 'new' })).status).toBe(400);
    }
    expect((await call('get', 'pay', '/api/tax/me/declarations')).status).toBe(404);
    const up = await call('post', 'ess', '/api/tax/me/proofs', { filename: 'rent.pdf', base64: Buffer.from('%PDF-1.4').toString('base64') });
    expect(up.status).toBe(200);
    expect((up.body as { documentId: number }).documentId).toBeGreaterThan(0);
    expect((await call('post', 'ess', '/api/tax/me/proofs', { filename: 'x.exe', base64: 'AAAA' })).status).toBe(400); // no employee profile
  });

  it('challans reconcile against deducted TDS; scope and validation hold', async () => {
    const [apr, may] = fyMonths(fy);
    const bad = [{ bsrCode: '12', challanNo: '00001' }, { bsrCode: '0510308', challanNo: 'x' }];
    for (const b of bad) expect((await call('post', 'pay', '/api/tax/challans', { companyId: company, month: apr, amountRupees: 5200, paidOn: '2026-05-07', ...b })).status).toBe(400);
    expect((await call('post', 'pay', '/api/tax/challans', { companyId: company, month: apr, amountRupees: 5200, paidOn: `${(apr ?? '').slice(0, 4)}-03-01`, bsrCode: '0510308', challanNo: '00001' })).status).toBe(400);
    const aprPaid = `${(apr ?? '').slice(0, 4)}-05-07`;
    expect((await call('post', 'pay', '/api/tax/challans', { companyId: company, month: apr, amountRupees: 5200, paidOn: aprPaid, bsrCode: '0510308', challanNo: '00001' })).status).toBe(200);
    expect((await call('post', 'pay', '/api/tax/challans', { companyId: company, month: apr, amountRupees: 5200, paidOn: aprPaid, bsrCode: '0510308', challanNo: '00001' })).status).toBe(409);
    const late = await call('post', 'pay', '/api/tax/challans', { companyId: company, month: may, amountRupees: 6000, paidOn: `${(may ?? '').slice(0, 4)}-06-20`, bsrCode: '0510308', challanNo: '00002' });
    expect(late.status).toBe(200);
    const rec = (await call('get', 'pay', `/api/tax/reconciliation?companyId=${String(company)}&fy=${fy}`)).body as { lines: { month: string; deductedRupees: number; depositedRupees: number; status: string }[]; totals: { differenceRupees: number } };
    expect(rec.lines[0]).toMatchObject({ month: apr, deductedRupees: 5200, depositedRupees: 5200, status: 'matched' });
    expect(rec.lines[1]).toMatchObject({ month: may, deductedRupees: 6200, depositedRupees: 6000, status: 'short' });
    expect(rec.lines[2]?.status).toBe('nil');
    expect(rec.totals.differenceRupees).toBe(200);
    expect((await call('get', 'ops', `/api/tax/reconciliation?companyId=${String(company)}&fy=${fy}`)).status).toBe(403);
    expect((await call('get', 'ess', `/api/tax/challans?companyId=${String(company)}&fy=${fy}`)).status).toBe(403);
    expect((await call('get', 'pay', `/api/tax/challans?companyId=${String(company)}&fy=2026-28`)).status).toBe(400);
    const list = (await call('get', 'pay', `/api/tax/challans?companyId=${String(company)}&fy=${fy}`)).body as { id: number }[];
    expect(list).toHaveLength(2);
    expect((await call('delete', 'pay', `/api/tax/challans/${String(list[1]?.id)}`)).body).toEqual({ ok: true });
    expect((await call('delete', 'pay', `/api/tax/challans/${String(list[1]?.id)}`)).status).toBe(404);
    expect(other).toBeGreaterThan(0);
  });

  it('Form 24Q quarter data + CSV; Form 16 JSON/PDF for payroll, employee and alumni', async () => {
    const q = (await call('get', 'pay', `/api/tax/form24q?companyId=${String(company)}&fy=${fy}&quarter=1`)).body as { deductees: { pan: string }[]; totals: { tdsRupees: number; deductees: number }; warnings: string[]; deductor: { tan: string } };
    expect(q.deductor.tan).toBe('CALR12345A');
    expect(q.totals).toMatchObject({ tdsRupees: 11400, deductees: 2 });
    expect(q.deductees.some((d) => d.pan === 'PANNOTAVBL')).toBe(true);
    expect(q.warnings.join(' ')).toMatch(/without PAN/);
    const csv = (await call('get', 'pay', `/api/tax/form24q?companyId=${String(company)}&fy=${fy}&quarter=1&format=csv`)).body as { filename: string; base64: string };
    expect(csv.filename).toMatch(/Form24Q-.*Q1\.csv/);
    expect(Buffer.from(csv.base64, 'base64').toString('utf8')).toContain('"ABCPT1234K"');
    const f16 = (await call('get', 'pay', `/api/tax/form16?employeeId=${String(emp)}&fy=${fy}`)).body as { partA: { totalTdsRupees: number }; partB: { grossSalaryRupees: number; chapterViaRupees: number; taxableIncomeRupees: number } };
    expect(f16.partA.totalTdsRupees).toBe(11000);
    expect(f16.partB).toMatchObject({ grossSalaryRupees: 200000, chapterViaRupees: 150000, taxableIncomeRupees: 0 });
    const pdf = (await call('get', 'ess', `/api/tax/me/form16?fy=${fy}&format=pdf`)).body as { base64: string };
    expect(Buffer.from(pdf.base64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect((await call('get', 'alum', `/api/tax/me/form16?fy=${fy}`)).status).toBe(200);
    expect((await call('get', 'ess', '/api/tax/me/form16?fy=2001-02')).status).toBe(404);
    expect((await call('get', 'ops', `/api/tax/form16?employeeId=${String(emp)}&fy=${fy}`)).status).toBe(403);
    expect((await call('get', 'pay', `/api/tax/form16?employeeId=${String(emp)}&fy=${fy}&format=pdf`)).status).toBe(200);
    const ecode = (await tx().selectFrom('core.employees').select('ecode').where('id', '=', emp).executeTakeFirstOrThrow()).ecode;
    expect((await call('get', 'pay', `/api/tax/form16?ecode=${ecode.toLowerCase()}&fy=${fy}`)).status).toBe(200);
    expect((await call('get', 'pay', `/api/tax/form16?ecode=NOPE999&fy=${fy}`)).status).toBe(404);
    expect((await call('get', 'pay', `/api/tax/form16?fy=${fy}`)).status).toBe(400);
  });
});
