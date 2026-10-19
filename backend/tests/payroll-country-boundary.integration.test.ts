/** D3, PAY-03: foreign legal entities must never enter the India payroll engine. */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import type { Kysely, Transaction } from 'kysely';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback synthetic country boundary');
describe.skipIf(!url)('India payroll country boundary', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  async function fixture(india: boolean, check: (tx: Transaction<Database>, companyId: number, actorId: number) => Promise<void>) {
    try {
      await db.transaction().execute(async tx => {
        const tag = `COUNTRY${String(Date.now())}`;
        const company = await tx.insertInto('core.companies').values({code:tag,name:'Synthetic country boundary',ecode_prefix:tag,is_india_payroll:india}).returning('id').executeTakeFirstOrThrow();
        const actor = await tx.insertInto('core.users').values({email:tag+'@hrms.invalid',password_hash:'!disabled-test-fixture!'}).returning('id').executeTakeFirstOrThrow();
        await check(tx, company.id, actor.id);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  }
  it('rejects creating an India payroll run for an out-of-scope entity before any run or audit is inserted', async () => fixture(false, async (tx, companyId, actorId) => {
    await expect(new PayrollRunService(tx).createRun({companyId,month:'2025-07-01',actorUserId:actorId})).rejects.toThrow('not enabled for India payroll');
    expect(await tx.selectFrom('pay.payroll_runs').select('id').where('company_id','=',companyId).execute()).toEqual([]);
    expect(await tx.selectFrom('core.audit_log').select('id').where('actor_user_id','=',actorId).execute()).toEqual([]);
  }));
  it('refuses a pre-existing foreign run at compute without moving its state', async () => fixture(false, async (tx, companyId, actorId) => {
    const lock = await tx.insertInto('att.month_locks').values({company_id:companyId,month:'2025-07-01',locked_by:actorId,locked_at:new Date()}).returning('id').executeTakeFirstOrThrow();
    const run = await tx.insertInto('pay.payroll_runs').values({company_id:companyId,month:'2025-07-01',status:'inputs_locked',attendance_lock_id:lock.id}).returning('id').executeTakeFirstOrThrow();
    await expect(new PayrollRunService(tx).computeRun(run.id,actorId)).rejects.toThrow('not enabled for India payroll');
    await expect(new PayrollRunService(tx).approveRun(run.id,actorId)).rejects.toThrow('not enabled for India payroll');
    await expect(new PayrollRunService(tx).finalizeRun(run.id,actorId)).rejects.toThrow('not enabled for India payroll');
    expect((await tx.selectFrom('pay.payroll_runs').select('status').where('id','=',run.id).executeTakeFirstOrThrow()).status).toBe('inputs_locked');
    expect(await tx.selectFrom('pay.payroll_items').select('id').where('run_id','=',run.id).execute()).toEqual([]);
  }));
  it('continues allowing explicitly enabled India entities', async () => fixture(true, async (tx, companyId, actorId) => {
    const id = await new PayrollRunService(tx).createRun({companyId,month:'2025-07-01',actorUserId:actorId});
    expect((await tx.selectFrom('pay.payroll_runs').select('status').where('id','=',id).executeTakeFirstOrThrow()).status).toBe('draft');
  }));
});
