/**
 * Stage 2.0 — plants start empty; directory ORG-05 plant filter works after insert.
 *
 * Uses service + repository (lead registers orgRouter separately). Plant codes
 * carry a unique stamp prefix so tests never invent production WERKS values.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { listEmployees } from '../src/modules/employees/index.js';
import { listMisCodes, listPlants, upsertPlant } from '../src/modules/org/index.js';
import type { EmployeeScope } from '../src/core/rbac/employee-scope.js';

/**
 * These cases exercise the ORG-05 *filter* predicate, not RBAC scoping, so they
 * run as an all-scope caller. Scope enforcement itself is covered end-to-end in
 * tests/access-matrix.integration.test.ts.
 */
const ALL_SCOPE: EmployeeScope = { all: true, own: false, subtree: false, orgUnitIds: [], actorEmployeeId: null };


const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 2.0 — org plants + directory plant filter (live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const plantCode = `TSTP${String(stamp).slice(-8)}`;
  const otherPlantCode = `TSTO${String(stamp).slice(-8)}`;
  const ecode = `ORG${String(stamp).slice(-8)}`;
  let companyId: number;
  let plantId: number;
  let employeeId: number;
  let actorUserId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    companyId = (
      await db
        .selectFrom('core.companies')
        .select('id')
        .where('code', '=', 'RML')
        .executeTakeFirstOrThrow()
    ).id;

    const actor = await db
      .selectFrom('core.users')
      .select('id')
      .orderBy('id')
      .executeTakeFirstOrThrow();
    actorUserId = actor.id;
  });

  afterAll(async () => {
    if (employeeId) {
      await db
        .updateTable('core.employees')
        .set({ status: 'exited', plant_id: null, dol: new Date() })
        .where('id', '=', employeeId)
        .execute();
    }
    if (plantId) {
      await db.updateTable('core.plants').set({ is_active: false }).where('id', '=', plantId).execute();
    }
    const other = await db
      .selectFrom('core.plants')
      .select('id')
      .where('plant_code', '=', otherPlantCode)
      .executeTakeFirst();
    if (other) {
      await db.updateTable('core.plants').set({ is_active: false }).where('id', '=', other.id).execute();
    }
    await db.destroy();
  });

  it('lists plants empty for a fresh stamp filter, then inserts one plant', async () => {
    const before = await listPlants(db, { activeOnly: true, companyId });
    expect(before.find((p) => p.plantCode === plantCode)).toBeUndefined();

    const mis = await listMisCodes(db, { activeOnly: true });
    // Empty MIS is correct — Finance has not supplied codes.
    expect(Array.isArray(mis)).toBe(true);

    const plant = await upsertPlant(db, {
      companyId,
      plantCode,
      name: `Test plant ${String(stamp)}`,
      locationId: null,
      isActive: true,
      actorUserId,
    });
    plantId = plant.id;

    const after = await listPlants(db, { activeOnly: true, companyId });
    expect(after.some((p) => p.plantCode === plantCode)).toBe(true);
  });

  it('directory plantCode filter includes only employees on that plant', async () => {
    const emp = await db
      .insertInto('core.employees')
      .values({
        ecode,
        company_id: companyId,
        first_name: 'Org',
        last_name: 'Scope',
        status: 'active',
        plant_id: plantId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    employeeId = emp.id;

    await upsertPlant(db, {
      companyId,
      plantCode: otherPlantCode,
      name: `Other plant ${String(stamp)}`,
      locationId: null,
      isActive: true,
      actorUserId,
    });

    const hit = await listEmployees(db, {
      plantCode: [plantCode],
      activeOnly: true,
      pageSize: 50,
    }, ALL_SCOPE);
    expect(hit.items.some((row) => row.ecode === ecode)).toBe(true);

    const miss = await listEmployees(db, {
      plantCode: [otherPlantCode],
      activeOnly: true,
      pageSize: 50,
    }, ALL_SCOPE);
    expect(miss.items.some((row) => row.ecode === ecode)).toBe(false);

    const unfiltered = await listEmployees(db, {
      plantCode: [],
      q: ecode,
      activeOnly: true,
      pageSize: 10,
    }, ALL_SCOPE);
    expect(unfiltered.items.some((row) => row.ecode === ecode)).toBe(true);
  });
});
