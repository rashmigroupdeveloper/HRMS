/** Stage 2.0 database and mutation invariants (ORG-01..08). */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { listEmployees } from '../src/modules/employees/index.js';
import type { EmployeeScope } from '../src/core/rbac/employee-scope.js';

/**
 * These cases exercise the ORG-05 *filter* predicate, not RBAC scoping, so they
 * run as an all-scope caller. Scope enforcement itself is covered end-to-end in
 * tests/access-matrix.integration.test.ts.
 */
const ALL_SCOPE: EmployeeScope = { all: true, own: false, subtree: false, orgUnitIds: [], actorEmployeeId: null };

import {
  listDepartments,
  setCompanySapCode,
  setDepartmentMisCode,
  upsertGlAccount,
} from '../src/modules/org/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 2.0 — org spine integrity (live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = String(Date.now()).slice(-9);
  const codes = {
    companyA: `OIA${stamp}`,
    companyB: `OIB${stamp}`,
    plantA: `PA${stamp}`,
    plantB: `PB${stamp}`,
    centerA: `CA${stamp}`,
    centerB: `CB${stamp}`,
    misA: `MA${stamp}`,
    misB: `MB${stamp}`,
    department: `Org integrity ${stamp}`,
  };
  let companyAId: number;
  let companyBId: number;
  let plantAId: number;
  let plantBId: number;
  let centerAId: number;
  let centerBId: number;
  let misAId: number;
  let misBId: number;
  let departmentId: number;
  let actorUserId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    actorUserId = (
      await db.selectFrom('core.users').select('id').orderBy('id').executeTakeFirstOrThrow()
    ).id;

    companyAId = (
      await db
        .insertInto('core.companies')
        .values({
          code: codes.companyA,
          name: `Org integrity A ${stamp}`,
          ecode_prefix: codes.companyA,
          is_india_payroll: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    companyBId = (
      await db
        .insertInto('core.companies')
        .values({
          code: codes.companyB,
          name: `Org integrity B ${stamp}`,
          ecode_prefix: codes.companyB,
          is_india_payroll: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    plantAId = (
      await db
        .insertInto('core.plants')
        .values({ company_id: companyAId, plant_code: codes.plantA, name: 'Plant A', location_id: null, is_active: true })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    plantBId = (
      await db
        .insertInto('core.plants')
        .values({ company_id: companyBId, plant_code: codes.plantB, name: 'Plant B', location_id: null, is_active: true })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    centerAId = (
      await db
        .insertInto('core.cost_centers')
        .values({ company_id: companyAId, code: codes.centerA, name: 'Centre A', plant_id: plantAId })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    centerBId = (
      await db
        .insertInto('core.cost_centers')
        .values({ company_id: companyBId, code: codes.centerB, name: 'Centre B', plant_id: plantBId })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    misAId = (
      await db
        .insertInto('core.mis_codes')
        .values({ company_id: companyAId, code: codes.misA, name: 'MIS A', parent_id: null, is_active: true })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    misBId = (
      await db
        .insertInto('core.mis_codes')
        .values({ company_id: companyBId, code: codes.misB, name: 'MIS B', parent_id: null, is_active: true })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    departmentId = (
      await db
        .insertInto('core.departments')
        .values({ name: codes.department })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  afterAll(async () => {
    await db.deleteFrom('pay.gl_accounts').where('company_code', '=', codes.companyA).execute();
    await db
      .deleteFrom('core.employees')
      .where('ecode', 'in', [`OEA${stamp}`, `OEB${stamp}`])
      .execute();
    await db.updateTable('core.departments').set({ mis_code_id: null }).where('id', '=', departmentId).execute();
    await db.deleteFrom('core.departments').where('id', '=', departmentId).execute();
    await db.deleteFrom('core.mis_codes').where('id', 'in', [misAId, misBId]).execute();
    await db.deleteFrom('core.cost_centers').where('id', 'in', [centerAId, centerBId]).execute();
    await db.deleteFrom('core.plants').where('id', 'in', [plantAId, plantBId]).execute();
    await db.deleteFrom('core.companies').where('id', 'in', [companyAId, companyBId]).execute();
    await db.destroy();
  });

  it('rejects a cost-centre to plant jump across companies at the DB boundary', async () => {
    await expect(
      db.updateTable('core.cost_centers').set({ plant_id: plantBId }).where('id', '=', centerAId).execute(),
    ).rejects.toThrow();
  });

  it('rejects an employee company/plant jump at the DB boundary', async () => {
    await expect(
      db
        .insertInto('core.employees')
        .values({
          ecode: `OE${stamp}`,
          company_id: companyAId,
          first_name: 'Cross-company',
          status: 'active',
          plant_id: plantBId,
        })
        .execute(),
    ).rejects.toThrow();
  });

  it('rejects a MIS parent jump across companies at the DB boundary', async () => {
    await expect(
      db.updateTable('core.mis_codes').set({ parent_id: misBId }).where('id', '=', misAId).execute(),
    ).rejects.toThrow();
  });

  it('maps a department through the audited service and returns the exact MIS identity', async () => {
    const mapped = await setDepartmentMisCode(db, {
      departmentId,
      misCodeId: misAId,
      actorUserId,
    });
    expect(mapped).toMatchObject({
      id: departmentId,
      misCodeId: misAId,
      misCode: codes.misA,
      misCompanyCode: codes.companyA,
    });

    const listed = await listDepartments(db);
    expect(listed.find((row) => row.id === departmentId)).toEqual(mapped);
  });

  it('fails closed when the same department is used by another company', async () => {
    await db
      .insertInto('core.employees')
      .values([
        {
          ecode: `OEA${stamp}`,
          company_id: companyAId,
          first_name: 'Company A',
          status: 'active',
          department_id: departmentId,
          plant_id: plantAId,
        },
        {
          ecode: `OEB${stamp}`,
          company_id: companyBId,
          first_name: 'Company B',
          status: 'active',
          department_id: departmentId,
          plant_id: plantBId,
        },
      ])
      .execute();

    const result = await listEmployees(db, {
      misCode: [codes.misA],
      activeOnly: true,
      pageSize: 20,
    }, ALL_SCOPE);
    expect(result.items.map((item) => item.ecode)).toContain(`OEA${stamp}`);
    expect(result.items.map((item) => item.ecode)).not.toContain(`OEB${stamp}`);
  });

  it('rolls back an org mutation when its audit write fails', async () => {
    await expect(
      setCompanySapCode(db, {
        companyId: companyAId,
        sapCompanyCode: `SAP${stamp}`,
        actorUserId: 9_000_000_000,
      }),
    ).rejects.toThrow();

    const company = await db
      .selectFrom('core.companies')
      .select('sap_company_code')
      .where('id', '=', companyAId)
      .executeTakeFirstOrThrow();
    expect(company.sap_company_code).toBeNull();
  });

  it('accepts a real GL tuple and rejects fictional code combinations', async () => {
    const row = await upsertGlAccount(db, {
      companyCode: codes.companyA,
      plantCode: codes.plantA,
      costCenterCode: codes.centerA,
      componentCode: 'TEST_COMPONENT',
      glCode: 'TEST_GL',
      actorUserId,
    });
    expect(row).toMatchObject({ companyCode: codes.companyA, plantCode: codes.plantA });

    await expect(
      db
        .insertInto('pay.gl_accounts')
        .values({
          company_code: codes.companyA,
          plant_code: codes.plantB,
          cost_center_code: codes.centerA,
          component_code: 'BAD_COMPONENT',
          gl_code: 'BAD_GL',
        })
        .execute(),
    ).rejects.toThrow();
  });
});
