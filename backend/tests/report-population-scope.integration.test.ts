/** CORE-10, RPT-02/06, CORE-13: reports use the authorized population. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import type { EmployeeScope } from '../src/core/rbac/employee-scope.js';
import { createDatabase } from '../src/core/db/database.js';
import { assertCompanyInScope } from '../src/core/rbac/company-scope.js';
import { hrOpsDashboard } from '../src/modules/reports/dashboard.service.js';
import { reportR21Offers, reportR28Assets } from '../src/modules/reports/reports.service.js';
import { policyAckStatus } from '../src/modules/policies/index.js';
import { istDateString } from '../src/core/dates.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
const rollback = new Error('Intentional report fixture rollback');
interface Fixture {
  trx: Transaction<Database>;
  companyId: number;
  people: number[];
  units: number[];
  userId: number;
  scope: EmployeeScope;
  tag: string;
}
describe.skipIf(!url)('Report population isolation (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => {
    db = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await db.destroy();
  });
  async function fixture(run: (f: Fixture) => Promise<void>) {
    try {
      await db.transaction().execute(async (trx) => {
        const tag = 'scope_' + randomUUID().slice(0, 8);
        const company = await trx
          .insertInto('core.companies')
          .values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false })
          .returning('id')
          .executeTakeFirstOrThrow();
        const units: number[] = [];
        const people: number[] = [];
        for (const suffix of ['A', 'B']) {
          const unit = await trx
            .insertInto('core.org_units')
            .values({ company_id: company.id, name: tag + suffix })
            .returning('id')
            .executeTakeFirstOrThrow();
          units.push(unit.id);
          const person = await trx
            .insertInto('core.employees')
            .values({
              company_id: company.id,
              org_unit_id: unit.id,
              ecode: tag + suffix,
              first_name: tag + suffix,
              status: 'active',
              attendance_mode: 'manual',
              category: suffix === 'A' ? 'white_collar' : 'blue_collar',
              doj: sql<Date>`${istDateString()}::date`,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          people.push(person.id);
        }
        const user = await trx
          .insertInto('core.users')
          .values({
            email: tag + '@hrms.invalid',
            password_hash: '!disabled!',
            employee_id: people[0],
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const scope: EmployeeScope = {
          all: false,
          own: false,
          subtree: false,
          orgUnitIds: units.slice(0, 1),
          actorEmployeeId: null,
        };
        await run({ trx, companyId: company.id, people, units, userId: user.id, scope, tag });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  it('requires full company coverage and rejects unmapped populations', async () =>
    fixture(async (f) => {
      await expect(assertCompanyInScope(f.trx, f.scope, f.companyId)).rejects.toThrow(/scope/);
      await expect(
        assertCompanyInScope(f.trx, { ...f.scope, orgUnitIds: f.units }, f.companyId),
      ).resolves.toBeUndefined();
      await f.trx
        .updateTable('core.employees')
        .set({ org_unit_id: null })
        .where('id', '=', f.people[1] ?? 0)
        .execute();
      await expect(
        assertCompanyInScope(f.trx, { ...f.scope, orgUnitIds: f.units }, f.companyId),
      ).rejects.toThrow(/scope/);
    }));
  it('denies scoped checklist, ledger and freeze over HTTP', async () =>
    fixture(async (f) => {
      const role = await f.trx
        .insertInto('core.roles')
        .values({ code: f.tag, name: f.tag })
        .returning('id')
        .executeTakeFirstOrThrow();
      const permission = await f.trx
        .selectFrom('core.permissions')
        .select('id')
        .where('code', '=', 'attendance.month_lock')
        .executeTakeFirstOrThrow();
      await f.trx
        .insertInto('core.role_permissions')
        .values({ role_id: role.id, permission_id: permission.id, scope: 'org_unit' })
        .execute();
      await f.trx
        .insertInto('core.user_roles')
        .values({ user_id: f.userId, role_id: role.id, scope_org_unit_id: f.units[0] })
        .execute();
      const session = await f.trx
        .insertInto('sec.sessions')
        .values({ user_id: f.userId, expires_at: new Date(Date.now() + 60000) })
        .returning('sid')
        .executeTakeFirstOrThrow();
      const secret = 'report-scope-synthetic-secret';
      const token = await signAccessToken(f.userId, f.tag + '@hrms.invalid', secret, session.sid);
      const request = await httpRequest(
        createApp({ db: f.trx, jwtSecret: secret, secureCookies: false }),
      );
      const query = `?companyId=${f.companyId}&month=1998-09`;
      expect(
        (
          await request
            .get('/api/attendance/month-lock/checklist' + query)
            .auth(token, { type: 'bearer' })
        ).status,
      ).toBe(403);
      expect(
        (
          await request
            .get('/api/attendance/manager-approvals' + query)
            .auth(token, { type: 'bearer' })
        ).status,
      ).toBe(403);
      expect(
        (
          await request
            .post('/api/attendance/month-lock')
            .auth(token, { type: 'bearer' })
            .send({ companyId: f.companyId, month: '1998-09' })
        ).status,
      ).toBe(403);
    }));
  it('limits candidate offers and assigned assets to mapped in-scope people', async () =>
    fixture(async (f) => {
      for (const [i, id] of f.people.entries()) {
        await f.trx
          .insertInto('core.onboarding_candidates')
          .values({
            full_name: f.tag + String(i),
            personal_email: f.tag + String(i) + '@hrms.invalid',
            mobile: '0000000000',
            position_title: 'Synthetic',
            company_id: f.companyId,
            category: 'white_collar',
            offered_ctc: '0',
            proposed_doj: sql<Date>`current_date`,
            offer_date: sql<Date>`current_date`,
            employee_id: id,
            status: 'converted',
            updated_at: new Date(),
          })
          .execute();
        const asset = await f.trx
          .insertInto('ast.assets')
          .values({
            company_id: f.companyId,
            asset_no: f.tag + String(i),
            category: 'IT',
            description: 'Synthetic',
            status: 'assigned',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await f.trx
          .insertInto('ast.assignments')
          .values({
            asset_id: asset.id,
            holder_kind: 'employee',
            employee_id: id,
            assigned_by: f.userId,
          })
          .execute();
      }
      expect(
        (await reportR21Offers(f.trx, { companyId: f.companyId, scope: f.scope })).map(
          (r) => r.candidateName,
        ),
      ).toEqual([f.tag + '0']);
      expect(
        (await reportR28Assets(f.trx, { companyId: f.companyId, scope: f.scope })).map(
          (r) => r.assetNo,
        ),
      ).toEqual([f.tag + '0']);
      expect(
        await reportR21Offers(f.trx, {
          companyId: f.companyId,
          scope: { ...f.scope, orgUnitIds: f.units },
        }),
      ).toHaveLength(2);
    }));
  it('uses one policy audience for both numerator and denominator, and scopes dashboard', async () =>
    fixture(async (f) => {
      const policy = await f.trx
        .insertInto('core.policies')
        .values({
          title: f.tag,
          body_summary: 'Synthetic policy audience test',
          effective_date: sql<Date>`current_date`,
          requires_acknowledgment: true,
          audience: JSON.stringify({ categories: ['white_collar'] }),
          created_by: f.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      for (const id of f.people)
        await f.trx
          .insertInto('core.policy_acknowledgments')
          .values({ policy_id: policy.id, employee_id: id })
          .execute();
      const result = (await policyAckStatus(f.trx, { ...f.scope, all: true }, f.companyId)).find(
        (p) => p.id === policy.id,
      );
      expect(result).toMatchObject({ targeted: 1, acknowledged: 1, pct: 100 });
      const dashboard = await hrOpsDashboard(f.trx, f.companyId, f.scope);
      expect(dashboard.headcountByCategory).toEqual([{ category: 'white_collar', count: 1 }]);
      expect(dashboard.joinersMtd).toBe(1);
      const outside = await hrOpsDashboard(f.trx, f.companyId, { ...f.scope, orgUnitIds: [] });
      expect(outside.headcountByCategory).toEqual([]);
      expect(outside.joinersMtd).toBe(0);
    }));
});
