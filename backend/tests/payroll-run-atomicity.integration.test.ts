/** PAY-03, CORE-06: payroll state and append-only evidence commit together. */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';

const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('Payroll state changes are atomic with audit', () => {
  let db: Kysely<Database>;
  let runId: number;
  let companyId: number;
  let service: PayrollRunService;
  const invalidActor = 2147483647;
  beforeAll(async () => {
    db = createDatabase(url ?? '');
    service = new PayrollRunService(db);
    companyId = (
      await db.selectFrom('core.companies').select('id').orderBy('id').executeTakeFirstOrThrow()
    ).id;
    expect(
      await db
        .selectFrom('core.users')
        .select('id')
        .where('id', '=', invalidActor)
        .executeTakeFirst(),
    ).toBeUndefined();
    const run = await db
      .insertInto('pay.payroll_runs')
      .values({
        company_id: companyId,
        month: '2097-02-01' as unknown as Date,
        run_type: 'regular',
        status: 'draft',
        attendance_lock_id: null,
        notes: 'Synthetic audit failure regression',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    runId = run.id;
  });
  afterAll(async () => {
    // Failed audit has no history; these synthetic draft rows may be deleted.
    await db
      .deleteFrom('pay.payroll_runs')
      .where('company_id', '=', companyId)
      .where('month', 'in', ['2097-02-01', '2097-03-01'] as unknown as Date[])
      .execute();
    await db.destroy();
  });
  it('rolls back run creation when audit persistence fails', async () => {
    await expect(
      service.createRun({ companyId, month: '2097-03-01', actorUserId: invalidActor }),
    ).rejects.toThrow();
    expect(
      await db
        .selectFrom('pay.payroll_runs')
        .select('id')
        .where('company_id', '=', companyId)
        .where('month', '=', '2097-03-01' as unknown as Date)
        .executeTakeFirst(),
    ).toBeUndefined();
  });
  it('rolls back input locking when audit persistence fails', async () => {
    await expect(service.lockInputs(runId, invalidActor)).rejects.toThrow();
    expect(
      (
        await db
          .selectFrom('pay.payroll_runs')
          .select('status')
          .where('id', '=', runId)
          .executeTakeFirstOrThrow()
      ).status,
    ).toBe('draft');
  });
});
