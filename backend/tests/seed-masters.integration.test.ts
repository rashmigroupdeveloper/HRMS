/** Production master seed: idempotent, no demo data, validates references. */
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/core/db/database.js';
import { seedMasters } from '../src/core/seed/masters.js';

const DB_URL = process.env['DATABASE_URL'];

describe.skipIf(!DB_URL)('seed:masters', () => {
  const db = createDatabase(DB_URL ?? '');
  afterAll(async () => { await db.destroy(); });
  it('upserts real masters idempotently and refuses unknown references', async () => {
    const tag = ('SM' + randomUUID().slice(0, 5)).toUpperCase();
    const file = {
      companies: [{ code: tag, name: `${tag} Ltd`, ecodePrefix: tag }],
      orgUnits: [{ company: tag, name: 'Works' }, { company: tag, name: 'Line 1', parent: 'Works' }],
      locations: [{ company: tag, name: 'Site', stateCode: 'wb' }],
      costCenters: [{ company: tag, code: `${tag}-CC`, name: 'CC' }],
      departments: [`${tag} Dept`], designations: [`${tag} Desig`], grades: [{ code: `${tag}G`, name: 'G', rank: 1 }],
    };
    try {
      expect(await seedMasters(db, file)).toEqual({ companies: 1, orgUnits: 2, locations: 1, costCenters: 1, departments: 1, designations: 1, grades: 1 });
      expect(await seedMasters(db, file)).toEqual({ companies: 0, orgUnits: 0, locations: 0, costCenters: 0, departments: 0, designations: 0, grades: 0 });
      await expect(seedMasters(db, { orgUnits: [{ company: 'NOPE_X', name: 'x' }] })).rejects.toThrow(/Unknown company/);
      await expect(seedMasters(db, { orgUnits: [{ company: tag, name: 'Orphan', parent: 'Missing' }] })).rejects.toThrow(/parent/);
      const cid = (await db.selectFrom('core.companies').select('id').where('code', '=', tag).executeTakeFirstOrThrow()).id;
      expect((await db.selectFrom('core.employees').select('id').where('company_id', '=', cid).execute())).toHaveLength(0);
    } finally {
      const c = await db.selectFrom('core.companies').select('id').where('code', '=', tag).executeTakeFirst();
      if (c) {
        await db.deleteFrom('core.cost_centers').where('company_id', '=', c.id).execute();
        await db.deleteFrom('core.locations').where('company_id', '=', c.id).execute();
        await db.deleteFrom('core.org_units').where('company_id', '=', c.id).where('parent_id', 'is not', null).execute();
        await db.deleteFrom('core.org_units').where('company_id', '=', c.id).execute();
        await db.deleteFrom('core.companies').where('id', '=', c.id).execute();
      }
      await db.deleteFrom('core.departments').where('name', '=', `${tag} Dept`).execute();
      await db.deleteFrom('core.designations').where('name', '=', `${tag} Desig`).execute();
      await db.deleteFrom('core.grades').where('code', '=', `${tag}G`).execute();
    }
  });
});
