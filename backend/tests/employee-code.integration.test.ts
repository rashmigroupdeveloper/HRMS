/** CORE-02 / LC-01 / LC-05: one atomic series for onboarding and transfers. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { OnboardingService } from '../src/modules/lifecycle/onboarding/onboarding.service.js';
import { generateTargetEcode } from '../src/modules/lifecycle/transfers/transfer.service.js';

const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('CORE-02 shared employee code allocation (real PostgreSQL)', () => {
  let db: Kysely<Database>;
  let companyId: number;
  const tag = Date.now().toString(36).toUpperCase();
  const prefix = `EC${tag}`;

  beforeAll(async () => {
    db = createDatabase(url ?? '');
    const company = await db.insertInto('core.companies').values({
      code: `CO${tag}`, name: `Employee code fixture ${tag}`,
      ecode_prefix: prefix, ecode_next_seq: 40,
    }).returning('id').executeTakeFirstOrThrow();
    companyId = company.id;
    await db.insertInto('core.employees').values({
      ecode: `${prefix}000040`, company_id: companyId, first_name: 'Pre-existing series fixture',
    }).execute();
  });
  afterAll(async () => {
    await db.deleteFrom('core.employees').where('company_id', '=', companyId).execute();
    await db.deleteFrom('core.companies').where('id', '=', companyId).execute();
    await db.destroy();
  });

  it('uses the configured prefix and skips an already-used sequence number', async () => {
    expect(await generateTargetEcode(db, companyId)).toBe(`${prefix}000041`);
    expect(await OnboardingService.generateEcode(db, companyId)).toBe(`${prefix}000042`);
  });

  it('allocates 20 distinct consecutive codes across simultaneous onboarding and transfer callers', async () => {
    const codes = await Promise.all(Array.from({ length: 20 }, (_, index) => index % 2 === 0
      ? OnboardingService.generateEcode(db, companyId)
      : generateTargetEcode(db, companyId)));
    const expected = Array.from({ length: 20 }, (_, index) => `${prefix}${String(43 + index).padStart(6, '0')}`);
    expect(new Set(codes).size).toBe(20);
    expect([...codes].sort()).toEqual(expected);
    const row = await db.selectFrom('core.companies').select('ecode_next_seq')
      .where('id', '=', companyId).executeTakeFirstOrThrow();
    expect(row.ecode_next_seq).toBe(63);
  });

  it('fails for an unknown company instead of inventing a default RML code', async () => {
    await expect(OnboardingService.generateEcode(db, -1)).rejects.toThrow();
    await expect(generateTargetEcode(db, -1)).rejects.toThrow();
  });

  it('enforces company prefix uniqueness in PostgreSQL without advancing the existing cursor', async () => {
    await expect(db.insertInto('core.companies').values({
      code: `DUP${tag}`, name: `Conflicting prefix fixture ${tag}`, ecode_prefix: prefix,
    }).execute()).rejects.toMatchObject({ code: '23505', constraint: 'companies_ecode_prefix_key' });
    const original = await db.selectFrom('core.companies').select('ecode_next_seq')
      .where('id', '=', companyId).executeTakeFirstOrThrow();
    expect(original.ecode_next_seq).toBe(63);
  });
  it('keeps every sequence digit beyond the six-digit minimum width',async()=>{
    const rollback=new Error('Intentional employee series boundary rollback');
    try{await db.transaction().execute(async tx=>{
      await tx.updateTable('core.companies').set({ecode_next_seq:999999}).where('id','=',companyId).execute();
      expect(await OnboardingService.generateEcode(tx,companyId)).toBe(`${prefix}999999`);
      expect(await generateTargetEcode(tx,companyId)).toBe(`${prefix}1000000`);
      throw rollback;
    });}catch(error){if(error!==rollback)throw error;}
  });

});
