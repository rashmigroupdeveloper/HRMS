/**
 * THE ACCESS MATRIX — the regression net for docs/audit/05-SECURITY-REVIEW.md §1.
 *
 * The audit proved, against a live server, that data scope was computed on every
 * request by `withPermission()` and then discarded by 20 of 24 modules. A plain
 * ESS user read another company's employee record and the whole directory; an
 * hr_ops user scoped to one plant could read and WRITE anywhere in the group.
 *
 * This file is the reason that cannot come back. It builds two org units in two
 * companies, puts one employee in each, and then asserts — for every scoped
 * surface — that a caller cannot reach across the boundary. Each case names the
 * exploit it closes.
 *
 * The 404-not-403 rule matters and is asserted: an out-of-scope e-code and a
 * non-existent one must be indistinguishable, or the endpoint becomes an
 * existence oracle for the whole 1,066-person master.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface LoginBody { accessToken: string }
interface ProfileBody {
  ecode: string;
  statutoryMasked: boolean;
  pan: string | null;
  canViewCompensation: boolean;
}
interface DirectoryBody { items: { ecode: string }[]; total: number }
interface FacetsBody { entities: { code: string }[]; total: number }
interface VaultBody { rows: { employeeId: number }[] }

run('access matrix — data scope is enforced, not merely computed', () => {
  let db: Kysely<Database>;
  let app: Express;

  const stamp = Date.now();
  const P = `AM${stamp.toString(36).toUpperCase().slice(0, 6)}`;
  const password = 'AccessMatrix-2026-x1!';

  let companyA = 0;
  let companyB = 0;
  let ouA = 0;
  let ouB = 0;
  let empA = 0;
  let empB = 0;
  const ecodeA = `${P}A001`;
  const ecodeB = `${P}B001`;

  /** ESS user linked to employee A. `employee.read` scope is `own`. */
  let essToken = '';
  /** hr_ops user scoped to org unit A only. Every HR permission is `org_unit`. */
  let hrAToken = '';
  /** hr_head user — scope `all`. The control: proves the endpoints still work. */
  let hrHeadToken = '';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** `.find(...)!` is banned by lint for good reason — a silent undefined here
   *  would make the whole matrix pass vacuously. Fail loudly instead. */
  function byKey<T, K extends keyof T>(rows: readonly T[], key: K, value: T[K]): T {
    const hit = rows.find((r) => r[key] === value);
    if (hit === undefined) throw new Error(`fixture row missing: ${String(key)}=${String(value)}`);
    return hit;
  }

  async function login(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: email, password });
    expect(res.status).toBe(200);
    return (res.body as LoginBody).accessToken;
  }

  async function makeUser(email: string, employeeId: number | null): Promise<number> {
    const row = await db
      .insertInto('core.users')
      .values({
        email,
        password_hash: await hashPassword(password),
        ...(employeeId === null ? {} : { employee_id: employeeId }),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function giveRole(userId: number, code: string, scopeOrgUnitId: number | null): Promise<void> {
    const role = await db
      .selectFrom('core.roles').select('id').where('code', '=', code).executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: userId, role_id: role.id, scope_org_unit_id: scopeOrgUnitId })
      .execute();
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const companies = await db
      .insertInto('core.companies')
      .values([
        { code: `${P}A`, name: `Access Matrix A ${stamp}`, ecode_prefix: `${P}A` },
        { code: `${P}B`, name: `Access Matrix B ${stamp}`, ecode_prefix: `${P}B` },
      ])
      .returning(['id', 'code'])
      .execute();
    companyA = byKey(companies, 'code', `${P}A`).id;
    companyB = byKey(companies, 'code', `${P}B`).id;

    ouA = (await db.insertInto('core.org_units')
      .values({ company_id: companyA, name: `Unit A ${stamp}` })
      .returning('id').executeTakeFirstOrThrow()).id;
    ouB = (await db.insertInto('core.org_units')
      .values({ company_id: companyB, name: `Unit B ${stamp}` })
      .returning('id').executeTakeFirstOrThrow()).id;

    const emps = await db.insertInto('core.employees').values([
      {
        ecode: ecodeA, company_id: companyA, org_unit_id: ouA, first_name: 'Asha', last_name: 'Alpha',
        status: 'active', doj: '2024-01-01', category: 'white_collar',
        pan: 'ABCDE1234F', aadhaar: '111122223333', bank_account: '99887766554433',
      },
      {
        ecode: ecodeB, company_id: companyB, org_unit_id: ouB, first_name: 'Bikram', last_name: 'Beta',
        status: 'active', doj: '2024-02-01', category: 'white_collar',
        pan: 'ZYXWV9876Q', aadhaar: '444455556666', bank_account: '11223344556677',
      },
    ]).returning(['id', 'ecode']).execute();
    empA = byKey(emps, 'ecode', ecodeA).id;
    empB = byKey(emps, 'ecode', ecodeB).id;

    const essId = await makeUser(`${P}-ess@hrms.test`.toLowerCase(), empA);
    await giveRole(essId, 'employee', null);
    const hrAId = await makeUser(`${P}-hra@hrms.test`.toLowerCase(), null);
    await giveRole(hrAId, 'hr_ops', ouA);
    const hrHeadId = await makeUser(`${P}-head@hrms.test`.toLowerCase(), null);
    await giveRole(hrHeadId, 'hr_head', null);

    essToken = await login(`${P}-ess@hrms.test`.toLowerCase());
    hrAToken = await login(`${P}-hra@hrms.test`.toLowerCase());
    hrHeadToken = await login(`${P}-head@hrms.test`.toLowerCase());
  }, 120_000);

  afterAll(async () => {
    // Users with audit history can never be hard-deleted (CORE-06, append-only
    // FK by design) — deactivate and detach, exactly as every suite here does.
    await db.updateTable('core.users').set({ is_active: false, employee_id: null })
      .where('email', 'like', `${P}-%`).execute();
    await db.destroy();
  });

  /* ── §1 exploit 1: profile across a company boundary ─────────────────── */

  it('ESS cannot read another employee’s profile — and gets 404, not 403', async () => {
    const res = await request(app).get(`/api/employees/${ecodeB}`).set(auth(essToken));
    expect(res.status).toBe(404);
  });

  it('the 404 is indistinguishable from a genuinely missing e-code', async () => {
    // The response echoes whichever e-code was asked for, so compare the SHAPE:
    // same status, same sentence with the requested code substituted out. If an
    // out-of-scope hit ever said something different, that difference would be
    // the oracle.
    const shape = (code: string, msg: string | undefined): string =>
      (msg ?? '').replace(code, '<code>');
    const real = await request(app).get(`/api/employees/${ecodeB}`).set(auth(essToken));
    const fake = await request(app).get(`/api/employees/${P}ZZZ999`).set(auth(essToken));
    expect(real.status).toBe(fake.status);
    expect(shape(ecodeB, (real.body as { message?: string }).message))
      .toBe(shape(`${P}ZZZ999`, (fake.body as { message?: string }).message));
  });

  it('ESS can still read its OWN profile', async () => {
    const res = await request(app).get(`/api/employees/${ecodeA}`).set(auth(essToken));
    expect(res.status).toBe(200);
    expect((res.body as ProfileBody).ecode).toBe(ecodeA);
  });

  /* ── §1 exploit 2: the whole directory ───────────────────────────────── */

  it('ESS directory returns only the caller’s own record', async () => {
    const res = await request(app).get('/api/employees').query({ pageSize: 200 }).set(auth(essToken));
    expect(res.status).toBe(200);
    const body = res.body as DirectoryBody;
    const codes = body.items.map((i) => i.ecode);
    expect(codes).toContain(ecodeA);
    expect(codes).not.toContain(ecodeB);
  });

  it('the directory TOTAL is scoped too — a count is a disclosure', async () => {
    const res = await request(app).get('/api/employees').query({ pageSize: 1 }).set(auth(essToken));
    expect((res.body as DirectoryBody).total).toBe(1);
  });

  /* ── §1 exploit 3: facet headcounts ──────────────────────────────────── */

  it('ESS facets do not reveal other entities’ headcounts', async () => {
    const res = await request(app).get('/api/employees/facets').set(auth(essToken));
    expect(res.status).toBe(200);
    const codes = (res.body as FacetsBody).entities.map((e) => e.code);
    expect(codes).not.toContain(`${P}B`);
  });

  /* ── W0-T13: the Compensation tab on a colleague ─────────────────────── */

  it('canViewCompensation is false for a colleague and true for oneself', async () => {
    const own = await request(app).get(`/api/employees/${ecodeA}`).set(auth(essToken));
    expect((own.body as ProfileBody).canViewCompensation).toBe(true);

    // hr_ops holds employee.read at org_unit but NOT compensation.read at all
    // (docs/08 §2), so the flag must be false even for an in-scope subject.
    const other = await request(app).get(`/api/employees/${ecodeA}`).set(auth(hrAToken));
    expect(other.status).toBe(200);
    expect((other.body as ProfileBody).canViewCompensation).toBe(false);
  });

  it('statutory IDs stay masked for a caller without the permission', async () => {
    const res = await request(app).get(`/api/employees/${ecodeA}`).set(auth(hrAToken));
    const body = res.body as ProfileBody;
    expect(body.statutoryMasked).toBe(true);
    expect(body.pan).toBeNull();
  });

  /* ── org-unit scoped HR: the "plant A HR sees plant B" case ──────────── */

  it('hr_ops scoped to unit A cannot read unit B’s profile', async () => {
    const inScope = await request(app).get(`/api/employees/${ecodeA}`).set(auth(hrAToken));
    expect(inScope.status).toBe(200);
    const outOfScope = await request(app).get(`/api/employees/${ecodeB}`).set(auth(hrAToken));
    expect(outOfScope.status).toBe(404);
  });

  it('hr_ops scoped to unit A cannot READ unit B’s leave balances', async () => {
    const ok = await request(app).get(`/api/leave/balances/${String(empA)}`).set(auth(hrAToken));
    expect(ok.status).toBe(200);
    const denied = await request(app).get(`/api/leave/balances/${String(empB)}`).set(auth(hrAToken));
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(denied.status).toBeLessThan(500);
  });

  it('hr_ops scoped to unit A cannot WRITE a balance adjustment for unit B', async () => {
    const res = await request(app)
      .post('/api/leave/adjustments')
      .set(auth(hrAToken))
      .send({ employeeId: empB, leaveType: 'CL', delta: 5, note: 'access matrix probe' });
    expect(res.status).toBeGreaterThanOrEqual(400);

    // and nothing reached the ledger — the write must not half-happen
    const rows = await db
      .selectFrom('lv.ledger').select('id').where('employee_id', '=', empB).execute();
    expect(rows).toHaveLength(0);
  });

  it('hr_ops scoped to unit A cannot list or upload into unit B’s document vault', async () => {
    const list = await request(app).get('/api/documents').set(auth(hrAToken));
    expect(list.status).toBe(200);
    expect((list.body as VaultBody).rows.some((r) => r.employeeId === empB)).toBe(false);

    const upload = await request(app)
      .post('/api/documents')
      .set(auth(hrAToken))
      .send({
        employeeId: empB, documentType: 'pan', fileName: 'probe.pdf',
        mime: 'application/pdf', content: Buffer.from('%PDF-1.4 probe').toString('base64'),
      });
    expect(upload.status).toBeGreaterThanOrEqual(400);
  });

  it('hr_ops scoped to unit A cannot list unit B’s letters', async () => {
    const denied = await request(app)
      .get(`/api/letters/employee/${String(empB)}`).set(auth(hrAToken));
    expect(denied.status).toBeGreaterThanOrEqual(400);
  });

  it('hr_ops scoped to unit A cannot list assets held by a unit B employee', async () => {
    const denied = await request(app)
      .get(`/api/assets/held-by/${String(empB)}`).set(auth(hrAToken));
    expect(denied.status).toBeGreaterThanOrEqual(400);
  });

  /* ── workflow subject spoofing — 05-SECURITY-REVIEW §2 ───────────────── */

  it('ESS cannot raise a workflow request naming another employee', async () => {
    const res = await request(app)
      .post('/api/workflows/requests')
      .set(auth(essToken))
      .send({
        definitionCode: 'resignation',
        payload: { reason: 'forged by another employee' },
        subjectEmployeeId: empB,
      });
    expect(res.status).toBe(403);

    const rows = await db
      .selectFrom('wf.requests').select('id').where('subject_employee_id', '=', empB).execute();
    expect(rows).toHaveLength(0);
  });

  it('ESS CAN still raise a request about itself — and it does not self-approve', async () => {
    const res = await request(app)
      .post('/api/workflows/requests')
      .set(auth(essToken))
      .send({ definitionCode: 'resignation', payload: { reason: 'legitimate self-service' } });
    expect(res.status).toBe(200);

    const requestId = (res.body as { requestId: number }).requestId;
    const row = await db
      .selectFrom('wf.requests').select('status').where('id', '=', requestId).executeTakeFirstOrThrow();
    // empA has no reporting manager and this fixture seeds no hr_head, so every
    // step is vacant. Before the fix that meant `approved` with zero steps.
    expect(row.status).not.toBe('approved');
  });

  it('a chain preview for another employee is scoped by employee.read, not by participation', async () => {
    // The gate on this route is `workflow.participate`, which every role holds
    // at scope `all`. Scoping the preview by THAT would restrict nothing — the
    // live re-run of the §2 exploit caught exactly that.
    const denied = await request(app)
      .get('/api/workflows/preview')
      .query({ definitionCode: 'leave', subjectEmployeeId: empB })
      .set(auth(essToken));
    expect(denied.status).toBe(404);

    const own = await request(app)
      .get('/api/workflows/preview')
      .query({ definitionCode: 'leave' })
      .set(auth(essToken));
    expect(own.status).toBe(200);
  });

  /* ── the control: an all-scope caller still sees everything ──────────── */

  it('hr_head (scope all) still reaches both companies — scoping is not a blanket deny', async () => {
    const a = await request(app).get(`/api/employees/${ecodeA}`).set(auth(hrHeadToken));
    const b = await request(app).get(`/api/employees/${ecodeB}`).set(auth(hrHeadToken));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const dir = await request(app).get('/api/employees').query({ pageSize: 200 }).set(auth(hrHeadToken));
    const codes = (dir.body as DirectoryBody).items.map((i) => i.ecode);
    expect(codes).toEqual(expect.arrayContaining([ecodeA, ecodeB]));
  });
});
