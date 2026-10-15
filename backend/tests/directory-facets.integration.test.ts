/**
 * Directory facets + the docs/05 §4.2 filter set (CORE-01).
 *
 * Why this suite exists: the filter drawer previously shipped FOUR HARDCODED
 * entity headcounts (667/174/96/57) and a status list that did not match the
 * API's own enum. Both were invisible to typecheck and lint, and both are the
 * exact "never fake data" failure docs/05 §4.8 forbids.
 *
 * D1 facet counts equal a direct count of the same employees.
 * D2 every facet code the drawer offers is a filter the list API applies.
 * D3 multi-select actually unions — the old code silently ignored a second
 *    selection, so choosing two entities filtered by neither.
 * D4 status facets stay visible even when the directory defaults to active-only,
 *    or "Exited" could never be discovered.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpRequest } from './http-client.js';
import { expectHttpStatus } from './http-assertions.js';
import type { Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface Facet {
  code: string;
  label: string;
  count: number;
}
interface Facets {
  entities: Facet[];
  departments: Facet[];
  categories: Facet[];
  locations: Facet[];
  statuses: Facet[];
  total: number;
}
interface Directory {
  items: { ecode: string; entity: string; status: string }[];
  total: number;
}

run('Directory facets and filters (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const tag = `DF${String(stamp).slice(-6)}`;
  const password = 'facets-pw-1!';
  const email = `facets-${String(stamp)}@hrms.test`;
  let token: string;
  let companyId: number;
  let companyCode: string;
  let orgUnitId: number;
  let otherOrgUnitId: number;
  let userId: number;
  let unscopedUserId: number;
  const unscopedEmail = `facets-unscoped-${String(stamp)}@hrms.test`;
  const created: number[] = [];

  async function mkEmployee(
    suffix: string,
    status: 'active' | 'on_notice' | 'exited',
    category: 'white_collar' | 'blue_collar',
    unitId: number = orgUnitId,
  ): Promise<number> {
    const row = await db
      .insertInto('core.employees')
      .values({
        ecode: `${tag}${suffix}`,
        company_id: companyId,
        org_unit_id: unitId,
        first_name: `Facet ${suffix}`,
        status,
        category,
        // CORE-06 is enforced at the DB: an exited employee MUST carry a date
        // of leaving (`employees_check`). The fixture honours the invariant
        // rather than working around it.
        ...(status === 'exited' ? { dol: new Date('2026-01-31') } : {}),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    created.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    // A dedicated company keeps the assertions independent of other test data.
    const company = await db
      .insertInto('core.companies')
      .values({
        code: `F${String(stamp).slice(-4)}`,
        name: `Facet Test Entity ${String(stamp)}`,
        ecode_prefix: tag,
      })
      .returning(['id', 'code'])
      .executeTakeFirstOrThrow();
    companyId = company.id;
    companyCode = company.code;

    const unit = await db.insertInto('core.org_units')
      .values({ company_id: companyId, name: `Facet scope ${stamp}` })
      .returning('id').executeTakeFirstOrThrow();
    orgUnitId = unit.id;
    const otherUnit = await db.insertInto('core.org_units')
      .values({ company_id: companyId, name: `Facet outside scope ${stamp}` })
      .returning('id').executeTakeFirstOrThrow();
    otherOrgUnitId = otherUnit.id;

    await mkEmployee('A', 'active', 'white_collar');
    await mkEmployee('B', 'active', 'blue_collar');
    await mkEmployee('C', 'on_notice', 'white_collar');
    await mkEmployee('D', 'exited', 'blue_collar');
    await mkEmployee('OUT', 'active', 'white_collar', otherOrgUnitId);

    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'hr_ops')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: orgUnitId })
      .execute();

    const unscoped = await db.insertInto('core.users')
      .values({ email: unscopedEmail, password_hash: await hashPassword(password) })
      .returning('id').executeTakeFirstOrThrow();
    unscopedUserId = unscoped.id;
    await db.insertInto('core.user_roles')
      .values({ user_id: unscopedUserId, role_id: role.id, scope_org_unit_id: null })
      .execute();

    const login = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: email, password });
    expectHttpStatus(login, 200);
    token = (login.body as { accessToken: string }).accessToken;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    await db.deleteFrom('core.employees').where('id', 'in', created).execute();
    await db.deleteFrom('core.user_roles').where('user_id', 'in', [userId, unscopedUserId]).execute();
    await db.deleteFrom('core.org_units').where('id', 'in', [orgUnitId, otherOrgUnitId]).execute();
    await db.deleteFrom('core.companies').where('id', '=', companyId).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('id', 'in', [userId, unscopedUserId])
      .execute();
    await db.destroy();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('D1 entity facet count equals a direct count of the same employees', async () => {
    const res = await (await httpRequest(app)).get('/api/employees/facets?activeOnly=true').set(auth());
    expectHttpStatus(res, 200);
    const facets = res.body as Facets;

    const ours = facets.entities.find((e) => e.code === companyCode);
    // 2 active + 1 on_notice = 3 in scope; the exited one is excluded.
    expect(ours?.count).toBe(3);

    const direct = await db
      .selectFrom('core.employees')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('company_id', '=', companyId)
      .where('org_unit_id', '=', orgUnitId)
      .where('status', 'in', ['active', 'on_notice'])
      .executeTakeFirstOrThrow();
    expect(ours?.count).toBe(Number(direct.n));
  });

  it('D2 every facet code offered is a code the list API accepts', async () => {
    const facets = (
      await (await httpRequest(app)).get('/api/employees/facets?activeOnly=true').set(auth())
    ).body as Facets;

    // Entity codes must round-trip through the list filter.
    const byEntity = await (await httpRequest(app))
      .get(`/api/employees?companyCodes=${companyCode}&activeOnly=true&pageSize=200`)
      .set(auth());
    expectHttpStatus(byEntity, 200);
    const list = byEntity.body as Directory;
    expect(list.total).toBe(3);
    expect(list.items.every((i) => i.entity === companyCode)).toBe(true);

    // Category codes are the DB enum, not display labels.
    for (const category of facets.categories) {
      expect(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract']).toContain(
        category.code,
      );
    }
    // Status codes likewise — the old drawer offered "Confirmed"/"Probation",
    // which the API has never accepted.
    for (const status of facets.statuses) {
      expect(['onboarding', 'active', 'on_notice', 'exited']).toContain(status.code);
    }
  });

  it('D3 multi-select unions instead of silently dropping the second value', async () => {
    const both = await (await httpRequest(app))
      .get(
        `/api/employees?companyCodes=${companyCode}&statuses=active,on_notice&activeOnly=false&pageSize=200`,
      )
      .set(auth());
    expectHttpStatus(both, 200);
    expect((both.body as Directory).total).toBe(3);

    const one = await (await httpRequest(app))
      .get(`/api/employees?companyCodes=${companyCode}&statuses=on_notice&activeOnly=false&pageSize=200`)
      .set(auth());
    expect((one.body as Directory).total).toBe(1);

    const categories = await (await httpRequest(app))
      .get(
        `/api/employees?companyCodes=${companyCode}&categories=white_collar,blue_collar&activeOnly=true&pageSize=200`,
      )
      .set(auth());
    expect((categories.body as Directory).total).toBe(3);
  });

  it('D4 status facets remain discoverable under the active-only default', async () => {
    const res = await (await httpRequest(app)).get('/api/employees/facets?activeOnly=true').set(auth());
    const facets = res.body as Facets;
    const codes = facets.statuses.map((s) => s.code);
    // "Exited" must still be offerable, or it can never be filtered FOR.
    expect(codes).toContain('exited');
  });

  it('D5 rejects an unknown category rather than ignoring it', async () => {
    const res = await (await httpRequest(app))
      .get(`/api/employees?categories=not_a_category`)
      .set(auth());
    expectHttpStatus(res, 400);
  });

  it('CORE-10 keeps unassigned HR org-unit access empty and excludes other units', async () => {
    const login = await (await httpRequest(app)).post('/api/auth/login')
      .send({ identifier: unscopedEmail, password });
    expectHttpStatus(login, 200);
    const unscopedToken = (login.body as { accessToken: string }).accessToken;
    const empty = await (await httpRequest(app)).get('/api/employees/facets?activeOnly=false')
      .auth(unscopedToken, { type: 'bearer' });
    expectHttpStatus(empty, 200);
    expect((empty.body as Facets).total).toBe(0);

    const scoped = await (await httpRequest(app))
      .get(`/api/employees?companyCodes=${companyCode}&activeOnly=false&pageSize=200`)
      .set(auth());
    expectHttpStatus(scoped, 200);
    const result = scoped.body as Directory;
    expect(result.total).toBe(4);
    expect(result.items.some(item => item.ecode === `${tag}OUT`)).toBe(false);
  });
});
