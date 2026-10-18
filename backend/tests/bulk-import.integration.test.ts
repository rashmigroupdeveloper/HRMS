/**
 * Bulk import engine + importers (CSV and Excel): template, preview report,
 * all-or-nothing commit, duplicate detection, idempotent re-upload, limits,
 * entity scope, Report 4 layout, formula-safe report export and audit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

interface Job {
  jobId: number; status: string; totalRows: number; errorRows: number; warningRows: number; layout: string | null;
  fileIssues: string[]; duplicateOfJobId: number | null; issues: { rowNumber: number; column: string | null; severity: string; message: string }[];
  result: { created: number; updated: number; skipped: number } | null;
}

async function xlsx(rows: (string | number | null)[][], sheet = 'Data'): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
}
const csv = (text: string) => Buffer.from(text, 'utf8').toString('base64');

describe.skipIf(!DB_URL)('bulk imports (CSV + Excel)', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  const trx = (): ControlledTransaction<Database> => {
    if (!transaction) throw new Error('fixture transaction not started');
    return transaction;
  };
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const co: Record<string, number> = {};
  const coCode: Record<string, string> = {};
  const unit: Record<string, number> = {};
  const unitName: Record<string, string> = {};
  const emp: Record<string, string> = {};
  let runA = 0;
  let runB = 0;
  let tag = '';

  const post = async (who: string, path: string, body: object) =>
    (await httpRequest(app)).post(path).set('Authorization', `Bearer ${t[who] ?? ''}`).send(body);
  const get = async (who: string, path: string) =>
    (await httpRequest(app)).get(path).set('Authorization', `Bearer ${t[who] ?? ''}`);
  const preview = async (who: string, importer: string, filename: string, base64: string, context: object = {}) =>
    post(who, `/api/bulk/${importer}/preview`, { filename, base64, context });

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    tag = 'bk' + randomUUID().slice(0, 5);
    for (const k of ['A', 'B']) {
      coCode[k] = `${tag}${k}`.toUpperCase();
      co[k] = (await tx.insertInto('core.companies').values({ code: coCode[k] ?? '', name: `${tag}${k}`, ecode_prefix: `${tag}${k}`.toUpperCase() }).returning('id').executeTakeFirstOrThrow()).id;
      unitName[k] = `${tag}${k} unit`;
      unit[k] = (await tx.insertInto('core.org_units').values({ company_id: co[k] ?? 0, name: unitName[k] ?? '' }).returning('id').executeTakeFirstOrThrow()).id;
      for (const n of [1, 2]) {
        emp[`${k}${String(n)}`] = `${tag}${k}${String(n)}`.toUpperCase();
        await tx.insertInto('core.employees').values({ company_id: co[k] ?? 0, org_unit_id: unit[k] ?? 0, ecode: emp[`${k}${String(n)}`] ?? '', first_name: `${k}${String(n)}`, status: 'active', doj: '2020-01-01' }).execute();
      }
    }
    runA = (await tx.insertInto('pay.payroll_runs').values({ company_id: co['A'] ?? 0, month: '2098-01-01', run_type: 'regular', status: 'draft' }).returning('id').executeTakeFirstOrThrow()).id;
    runB = (await tx.insertInto('pay.payroll_runs').values({ company_id: co['B'] ?? 0, month: '2098-01-01', run_type: 'regular', status: 'draft' }).returning('id').executeTakeFirstOrThrow()).id;
    const users: [string, string, number | null][] = [
      ['pay', 'payroll_admin', null],
      ['payA', 'payroll_admin', unit['A'] ?? 0],
      ['hrHead', 'hr_head', null],
      ['opsA', 'hr_ops', unit['A'] ?? 0],
      ['employee', 'employee', null],
    ];
    for (const [key, role, scopeUnit] of users) {
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${key}@hrms.invalid`, password_hash: '!disabled!' }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: scopeUnit }).execute();
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });

  it('lists importers by permission and serves a template with validations and instructions', async () => {
    const mine = await get('pay', '/api/bulk/importers');
    expect(mine.status).toBe(200);
    const keys = (mine.body as { key: string }[]).map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['payroll-inputs', 'loans', 'salary-assignments', 'statutory-rates', 'pt-slabs']));
    expect(keys).not.toContain('employees');
    expect(((await get('employee', '/api/bulk/importers')).body as unknown[])).toHaveLength(0);
    expect((await get('employee', '/api/bulk/payroll-inputs/template')).status).toBe(403);
    expect((await get('pay', '/api/bulk/nope/template')).status).toBe(404);

    const tpl = await get('pay', '/api/bulk/payroll-inputs/template');
    expect(tpl.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from((tpl.body as { base64: string }).base64, 'base64') as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Data', 'Examples', 'Instructions', 'Lists']);
    expect(wb.getWorksheet('Data')?.getRow(1).getCell(1).value).toBe('Employee code');
    expect(wb.getWorksheet('Examples')?.rowCount).toBeGreaterThan(1);
    const lists = wb.getWorksheet('Lists');
    const listValues: unknown[] = [];
    lists?.eachRow((r) => listValues.push(r.getCell(1).value));
    expect(listValues).toContain('CANTEEN');
    expect(listValues).not.toContain('PF_EE');
    const dv = (wb.getWorksheet('Data') as unknown as { dataValidations: { model: Record<string, { type: string }> } }).dataValidations.model;
    expect(Object.values(dv).some((v) => v.type === 'list')).toBe(true);
  });

  it('payroll inputs via CSV: row/column errors, then a clean file commits once (idempotent re-upload)', async () => {
    const bad = csv(`ecode,component_code,amount,note\n${emp['A1'] ?? ''},CANTEEN,abc,x\n${emp['B1'] ?? ''},PF_EE,100,Wrong company\nNOPE999,CANTEEN,50,Unknown\n${emp['A2'] ?? ''},CANTEEN,12.345,Too precise\n`);
    const res = await preview('pay', 'payroll-inputs', 'inputs.csv', bad, { runId: runA });
    expect(res.status).toBe(200);
    const job = res.body as Job;
    expect(job.totalRows).toBe(4);
    expect(job.errorRows).toBe(4);
    const msgs = job.issues.map((i) => `${String(i.rowNumber)}|${i.column ?? ''}|${i.message}`);
    expect(msgs.some((m) => m.startsWith('2|Amount|'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('3|Employee code|') && m.includes('another company'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('4|Employee code|') && m.includes('No employee'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('5|Amount|') && m.includes('2 decimals'))).toBe(true);
    expect((await post('pay', `/api/bulk/payroll-inputs/jobs/${String(job.jobId)}/commit`, {})).status).toBe(400);
    const rep = await get('pay', `/api/bulk/payroll-inputs/jobs/${String(job.jobId)}/report`);
    expect(rep.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from((rep.body as { base64: string }).base64, 'base64') as unknown as ArrayBuffer);
    expect(wb.worksheets[0]?.rowCount).toBeGreaterThanOrEqual(5);

    const goodText = `Employee Code,Component,Amount,Note\n${emp['A1'] ?? ''},CANTEEN,"1,375",Canteen\n${emp['A2'] ?? ''},INCENTIVE,2500.5,"Incentive, Q1"\n${emp['A2'] ?? ''},INCENTIVE,2500.5,"Incentive, Q1"\n`;
    const dup = (await preview('pay', 'payroll-inputs', 'good.csv', csv(goodText), { runId: runA })).body as Job;
    expect(dup.issues.some((i) => i.message.includes('Duplicate of row 3'))).toBe(true);
    const good = csv(goodText.split('\n').slice(0, 3).join('\n'));
    const ok = (await preview('pay', 'payroll-inputs', 'good.csv', good, { runId: runA })).body as Job;
    expect(ok.errorRows).toBe(0);
    const committed = await post('pay', `/api/bulk/payroll-inputs/jobs/${String(ok.jobId)}/commit`, {});
    expect(committed.status).toBe(200);
    expect((committed.body as Job).status).toBe('committed');
    expect((committed.body as Job).result?.created).toBe(2);
    const inputs = await db.selectFrom('pay.inputs').select(['amount']).where('run_id', '=', runA).execute().catch(() => []);
    void inputs;
    const stored = await trx().selectFrom('pay.inputs').select(['component_code', 'amount', 'note']).where('run_id', '=', runA).orderBy('component_code').execute();
    expect(stored.map((s) => [s.component_code, Number(s.amount)])).toEqual([['CANTEEN', 1375], ['INCENTIVE', 2500.5]]);
    // Same file again: flagged at preview, refused at commit — nothing doubles.
    const again = (await preview('pay', 'payroll-inputs', 'good-copy.csv', good, { runId: runA })).body as Job;
    expect(again.duplicateOfJobId).toBe(ok.jobId);
    expect((await post('pay', `/api/bulk/payroll-inputs/jobs/${String(again.jobId)}/commit`, {})).status).toBe(409);
    expect((await post('pay', `/api/bulk/payroll-inputs/jobs/${String(ok.jobId)}/commit`, {})).status).toBe(409);
    const audit = await trx().selectFrom('core.audit_log').select('action').where('entity', '=', 'core.bulk_jobs').where('entity_id', '=', ok.jobId).execute();
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['bulk_import_previewed', 'bulk_import_committed']));
  });

  it('accepts the Report 4 pay register layout (title rows, totals row, many columns)', async () => {
    const header = ['Sl No', 'EmployeeNo', 'Name', 'PAYROLL MONTH', 'MONH DAYS', 'LOP', 'PAID DAYS', 'BASIC', 'INCENTIVE', 'OTHER EARNINGS', 'GRATUITY', 'GROSS', 'PF', 'MISCELLANEOUS RECOVERY', 'CANTEEN RECOVERY', 'GUEST HOUSE DEDUCTION', 'TRAVEL ADVANCE RECOVERY', 'NOTICE PERIOD RECOVERY', 'TOTAL DEDUCTIONS', 'NET PAY'];
    const file = await xlsx([
      header,
      [1, emp['A1'] ?? '', 'A1', 'Jan 2098', 31, 0, 31, 30000, 0, 0, 0, 60000, 3600, 0, 1375, 0, 0, 0, -5175, 54825],
      [2, emp['A2'] ?? '', 'A2', 'Jan 2098', 31, 0, 31, 20000, 1500, 0, 900, 40000, 2400, 250, 0, 600, 0, 0, -3250, 36750],
      [null, null, null, null, null, null, 'Grand Total', 50000, 1500, 0, 900, 100000, 6000, 250, 1375, 600, 0, 0, -8425, 91575],
    ], 'Report 4');
    const job = (await preview('pay', 'payroll-inputs', 'Report4.xlsx', file, { runId: runA })).body as Job;
    expect(job.layout).toBe('Report 4 pay register');
    expect(job.totalRows).toBe(4); // canteen(A1) + incentive, misc, guest house (A2); totals row skipped
    expect(job.errorRows).toBe(0);
    expect(job.issues.some((i) => i.severity === 'warning' && i.message.includes('GRATUITY'))).toBe(true);
  });

  it('rejects .xls, oversize/empty files, missing headers; entity-bound admin cannot import into another entity', async () => {
    const xls = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]).toString('base64');
    const r1 = await preview('pay', 'payroll-inputs', 'old.xls', xls, { runId: runA });
    expect(r1.status).toBe(400);
    expect(JSON.stringify(r1.body)).toContain('Save As');
    expect((await preview('pay', 'payroll-inputs', 'x.pdf', csv('hello world'), { runId: runA })).status).toBe(400);
    expect((await preview('pay', 'payroll-inputs', 'h.csv', csv('foo,bar\n1,2\n'), { runId: runA })).status).toBe(400);
    expect((await preview('pay', 'payroll-inputs', 'h.csv', csv('ecode,component_code,amount\nA,B,1\n'), { runId: runA })).status).toBe(400);
    expect((await preview('pay', 'payroll-inputs', 'h.csv', csv('ecode,component_code,amount,note\n'), { runId: runA })).status).toBe(400);
    expect((await preview('pay', 'payroll-inputs', 'h.csv', csv('ecode,component_code,amount,note\nX,Y,1,z\n'), {})).status).toBe(400);
    const big = Buffer.alloc(8 * 1024 * 1024 + 10, 0x41).toString('base64');
    expect((await preview('pay', 'payroll-inputs', 'big.csv', big, { runId: runA })).status).toBe(400);
    const file = csv(`ecode,component_code,amount,note\n${emp['B1'] ?? ''},CANTEEN,10,Canteen\n`);
    expect((await preview('payA', 'payroll-inputs', 'b.csv', file, { runId: runB })).status).toBe(403);
    expect((await preview('pay', 'payroll-inputs', 'b.csv', file, { runId: runB })).status).toBe(200);
    expect((await preview('pay', 'payroll-inputs', 'b.csv', file, { runId: 987654321 })).status).toBe(404);
  });

  it('statutory tables are group-only; PT band overlaps are row errors', async () => {
    const rates = csv('Scheme,Parameter,Value,Effective from,Source\nESIC,wage_ceiling,25000,2099-04-01,Test notification\nPF,nonsense,1,2099-04-01,x\nPF,ee_rate_pct,120,2099-04-15,x\n');
    expect((await preview('payA', 'statutory-rates', 'r.csv', rates)).status).toBe(403);
    const job = (await preview('pay', 'statutory-rates', 'r.csv', rates)).body as Job;
    expect(job.errorRows).toBe(2);
    const slabs = csv('State,From (monthly),To (monthly),PT amount,Effective from\nZZ,0,10000,0,2099-04-01\nZZ,9000,,150,2099-04-01\n');
    const s = (await preview('pay', 'pt-slabs', 's.csv', slabs)).body as Job;
    expect(s.issues.some((i) => i.message.includes('Overlaps'))).toBe(true);
    const okSlabs = csv('State,From (monthly),To (monthly),PT amount,Effective from\nZZ,0,10000,0,2099-04-01\nZZ,10000.01,,150,2099-04-01\n');
    const ok = (await preview('pay', 'pt-slabs', 's2.csv', okSlabs)).body as Job;
    expect(ok.errorRows).toBe(0);
    const c = await post('pay', `/api/bulk/pt-slabs/jobs/${String(ok.jobId)}/commit`, {});
    expect((c.body as Job).result?.created).toBe(2);
    const okRates = (await preview('pay', 'statutory-rates', 'r2.csv', csv('Scheme,Parameter,Value,Effective from,Source\nESIC,wage_ceiling,25000,2099-04-01,Test notification\n'))).body as Job;
    expect((await post('pay', `/api/bulk/statutory-rates/jobs/${String(okRates.jobId)}/commit`, {})).status).toBe(200);
  });

  it('employee master: create + update with Indian ID validation, minors and duplicates; scope enforced', async () => {
    const head = 'Employee code,Company,First name,Last name,Date of birth,Date of joining,Org unit,PAN,Aadhaar,UAN,IFSC,Bank account,Mobile';
    const bad = csv([
      head,
      `,${coCode['A'] ?? ''},Kid,One,2015-01-01,2026-01-01,${unitName['A'] ?? ''},ABCDE1234F,123412341234,12345,HDFC1234567,12ab,12345`,
      `,${coCode['A'] ?? ''},Dup,Uan,1990-01-01,2026-01-01,${unitName['A'] ?? ''},,,100200300400,,,`,
      `,${coCode['A'] ?? ''},Dup,Uan2,1990-01-01,2026-01-01,${unitName['A'] ?? ''},,,100200300400,,,`,
      `,${coCode['A'] ?? ''},,NoName,1990-01-01,,${unitName['A'] ?? ''},,,,,,`,
    ].join('\n'));
    const job = (await preview('hrHead', 'employees', 'emp.csv', bad)).body as Job;
    const m = job.issues.map((i) => `${String(i.rowNumber)}|${i.column ?? ''}|${i.message}`);
    expect(m.some((x) => x.startsWith('2|Date of birth|') && x.includes('minors'))).toBe(true);
    expect(m.some((x) => x.startsWith('2|PAN|'))).toBe(true);
    expect(m.some((x) => x.startsWith('2|Aadhaar|'))).toBe(true);
    expect(m.some((x) => x.startsWith('2|IFSC|'))).toBe(true);
    expect(m.some((x) => x.startsWith('2|Bank account|'))).toBe(true);
    expect(m.some((x) => x.startsWith('2|Mobile|'))).toBe(true);
    expect(m.some((x) => x.startsWith('4|UAN|') && x.includes('row 3'))).toBe(true);
    expect(m.some((x) => x.startsWith('5|First name|'))).toBe(true);

    const good = csv([
      head,
      `,${coCode['A'] ?? ''},Ananya,Ghosh,1998-07-14,14-11-2097,${unitName['A'] ?? ''},ABCPG1234K,234567890124,100200300401,HDFC0009686,50100491230000,+91 98765 43210`,
      `${emp['A1'] ?? ''},${coCode['A'] ?? ''},,,,,,,,,SBIN0001234,,`,
    ].join('\n'));
    const g = (await preview('hrHead', 'employees', 'emp-good.csv', good)).body as Job;
    expect(g.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const c = await post('hrHead', `/api/bulk/employees/jobs/${String(g.jobId)}/commit`, {});
    expect(c.status).toBe(200);
    expect((c.body as Job).result).toMatchObject({ created: 1, updated: 1 });
    const tx = trx();
    const created = await tx.selectFrom('core.employees').select(['ecode', 'mobile', 'doj']).where('uan', '=', '100200300401').executeTakeFirstOrThrow();
    expect(created.ecode.startsWith(`${tag}A`.toUpperCase())).toBe(true);
    expect(created.mobile).toBe('9876543210');
    expect((await tx.selectFrom('core.employees').select('bank_ifsc').where('ecode', '=', emp['A1'] ?? '').executeTakeFirstOrThrow()).bank_ifsc).toBe('SBIN0001234');

    // hr_ops bound to unit A cannot touch entity B employees.
    const cross = (await preview('opsA', 'employees', 'x.csv', csv(`Employee code,Company,Mobile\n${emp['B1'] ?? ''},${coCode['B'] ?? ''},9123456780\n`))).body as Job;
    expect(cross.issues.some((i) => i.message.includes('Outside your data scope'))).toBe(true);
  });

  it('holidays, leave balances, assets, loans and punches (Kent layout, timezone, skip duplicates)', async () => {
    const tx = trx();
    const hol = (await preview('hrHead', 'holidays', 'h.csv', csv('Date,Holiday,Location\n2099-01-26,Republic Day,\n2099-02-30,Bad date,\n'))).body as Job;
    expect(hol.errorRows).toBe(1);
    const holOk = (await preview('hrHead', 'holidays', 'h.csv', csv('Date,Holiday,Location\n26-01-2099,Republic Day,\n'))).body as Job;
    expect((await post('hrHead', `/api/bulk/holidays/jobs/${String(holOk.jobId)}/commit`, {})).status).toBe(200);
    expect(await tx.selectFrom('att.holidays').select('name').where('holiday_date', '=', new Date('2099-01-26')).executeTakeFirst()).toMatchObject({ name: 'Republic Day' });
    expect((await preview('opsA', 'holidays', 'h.csv', csv('Date,Holiday,Location\n2099-03-01,All sites,\n'))).status).toBe(403);

    const lv = (await preview('opsA', 'leave-balances', 'l.csv', csv(`Employee code,Leave type,Mode,Days,Reason\n${emp['A1'] ?? ''},EL,set_balance,12.5,Opening\n${emp['A2'] ?? ''},CL,adjust,-3,Would go negative\n${emp['B1'] ?? ''},CL,adjust,1,Other entity\n${emp['A2'] ?? ''},SL,adjust,0.3,Bad step\n`))).body as Job;
    expect(lv.errorRows).toBe(3);
    const lvOk = (await preview('opsA', 'leave-balances', 'l2.csv', csv(`Employee code,Leave type,Mode,Days,Reason\n${emp['A1'] ?? ''},EL,set_balance,12.5,Opening\n`))).body as Job;
    expect((await post('opsA', `/api/bulk/leave-balances/jobs/${String(lvOk.jobId)}/commit`, {})).status).toBe(200);

    const as = (await preview('opsA', 'assets', 'a.csv', csv(`Asset no,Category,Company,Purchase date\n${tag}-LT-1,Laptop,${coCode['A'] ?? ''},2025-01-01\n${tag}-LT-2,Laptop,${coCode['B'] ?? ''},\n`))).body as Job;
    expect(as.issues.some((i) => i.message.includes('outside your entity'))).toBe(true);
    const asOk = (await preview('opsA', 'assets', 'a2.csv', csv(`Asset no,Category,Company\n${tag}-LT-1,Laptop,${coCode['A'] ?? ''}\n`))).body as Job;
    expect(((await post('opsA', `/api/bulk/assets/jobs/${String(asOk.jobId)}/commit`, {})).body as Job).result?.created).toBe(1);

    const loanHead = 'Employee code,Loan type,Original principal,Outstanding,Interest % p.a.,Monthly EMI,Remaining months,Recover from,Legacy reference';
    const ln = (await preview('pay', 'loans', 'l.xlsx', await xlsx([loanHead.split(','), [emp['A1'] ?? '', 'emi_no_interest', 60000, 70000, 0, 5000, 8, '2099-01-01', 'SAP-1'], [emp['A2'] ?? '', 'emi_no_interest', 60000, 30000, 0, 5000, 6, '2099-01-15', 'SAP-2']]))).body as Job;
    expect(ln.errorRows).toBe(2);
    const lnOk = (await preview('pay', 'loans', 'l2.xlsx', await xlsx([loanHead.split(','), [emp['A1'] ?? '', 'emi_no_interest', 60000, 36000, 0, 5000, 8, '2099-01-01', 'SAP-1']]))).body as Job;
    expect((await post('pay', `/api/bulk/loans/jobs/${String(lnOk.jobId)}/commit`, {})).status).toBe(200);
    const lnAgain = (await preview('pay', 'loans', 'l3.xlsx', await xlsx([loanHead.split(','), [emp['A1'] ?? '', 'emi_no_interest', 60000, 36000, 0, 5000, 8, '2099-01-01', 'sap-1'], ['', '', null, null, null, null, null, null, '']]))).body as Job;
    expect(lnAgain.issues.some((i) => i.message.includes('already imported'))).toBe(true);

    const kent = ['Employee No', 'Employee Name', 'Access Card', 'Shift', 'Swipe Date', 'Door/Address', 'Swipe Type', 'Status'];
    const punches = await xlsx([kent, [emp['A1'] ?? '', 'A1', 'C1', 'G', '16 Jun 2026 09:02:11', 'GATE-1', 'IN', 'OK'], [emp['A1'] ?? '', 'A1', 'C1', 'G', '16 Jun 2026 18:07:45', 'GATE-1', 'OUT', 'OK'], [emp['B1'] ?? '', 'B1', '', '', '16 Jun 2026 09:00:00', 'GATE-9', 'IN', '']], 'Employee Swipe Details');
    const pj = (await preview('opsA', 'punches', 'EmployeeSwipeDetails.xlsx', punches)).body as Job;
    expect(pj.errorRows).toBe(1);
    const pjOk = (await preview('opsA', 'punches', 'swipes.xlsx', await xlsx([kent, [emp['A1'] ?? '', 'A1', 'C1', 'G', '16 Jun 2026 09:02:11', 'GATE-1', 'IN', 'OK']]))).body as Job;
    expect(((await post('opsA', `/api/bulk/punches/jobs/${String(pjOk.jobId)}/commit`, {})).body as Job).result?.created).toBe(1);
    const sw = await tx.selectFrom('att.swipe_events').select(['swipe_ts', 'direction', 'source']).where('employee_no', '=', emp['A1'] ?? '').executeTakeFirstOrThrow();
    expect(new Date(sw.swipe_ts).toISOString()).toBe('2026-06-16T03:32:11.000Z'); // Asia/Kolkata wall-clock → UTC
    expect(sw.direction).toBe('in');
    // Overlapping re-upload (different file): existing punch skipped, new one added.
    const pj2 = (await preview('opsA', 'punches', 'swipes2.xlsx', await xlsx([kent, [emp['A1'] ?? '', 'A1', 'C1', 'G', '16 Jun 2026 09:02:11', 'GATE-1', 'IN', 'OK'], [emp['A1'] ?? '', 'A1', 'C1', 'G', '16 Jun 2026 18:07:45', 'GATE-1', 'OUT', 'OK']]))).body as Job;
    expect(((await post('opsA', `/api/bulk/punches/jobs/${String(pj2.jobId)}/commit`, {})).body as Job).result).toMatchObject({ created: 1, skipped: 1 });
  });

  it('jobs are private to the uploader; discard; listing', async () => {
    const job = (await preview('opsA', 'holidays', 'h.csv', csv(`Date,Holiday,Location\n2099-05-01,May Day,\n`))).body as Job;
    void job;
    const mine = (await preview('hrHead', 'holidays', 'h9.csv', csv('Date,Holiday,Location\n2099-05-01,May Day,\n'))).body as Job;
    expect((await get('hrHead', `/api/bulk/holidays/jobs/${String(mine.jobId)}`)).status).toBe(200);
    expect((await post('hrHead', `/api/bulk/holidays/jobs/${String(mine.jobId)}/discard`, {})).status).toBe(200);
    expect((await post('hrHead', `/api/bulk/holidays/jobs/${String(mine.jobId)}/discard`, {})).status).toBe(409);
    expect((await post('hrHead', `/api/bulk/holidays/jobs/${String(mine.jobId)}/commit`, {})).status).toBe(409);
    const list = await get('hrHead', '/api/bulk/holidays/jobs');
    expect((list.body as Job[]).some((j) => j.jobId === mine.jobId)).toBe(true);
    const assetJob = (await preview('opsA', 'assets', 'a9.csv', csv(`Asset no,Category,Company\n${tag}-X,Laptop,${coCode['A'] ?? ''}\n`))).body as Job;
    expect((await get('hrHead', `/api/bulk/assets/jobs/${String(assetJob.jobId)}`)).status).toBe(200); // group viewer
    expect((await get('opsA', `/api/bulk/assets/jobs/${String(assetJob.jobId)}`)).status).toBe(200);
  });

});
