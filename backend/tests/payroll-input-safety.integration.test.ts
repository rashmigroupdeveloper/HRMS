/** SOW-5.1.1/PAY-03: exact input amounts, column mapping and atomic draft boundary. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { addRunInputs, parseInputsCsv, removeRunInput } from '../src/modules/payroll-core/config/config.service.js';

const DB_URL = process.env['DATABASE_URL'];
describe.skipIf(!DB_URL)('payroll input safety', () => {
  let db: Kysely<Database>;
  let companyId = 0; let empId = 0; let actorId = 0; let runId = 0;
  const tag = `KIS${randomUUID().slice(0, 8)}`;
  const input = (amountRupees = 1) => ({ employeeId: empId, componentCode: 'CANTEEN', amountRupees, note: 'Reviewed canteen charge' });

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    actorId = (await db.selectFrom('core.users').select('id').where('email', '=', 'test-baseline-admin@hrms.invalid').executeTakeFirstOrThrow()).id;
    await db.transaction().execute(async trx => {
      companyId = (await trx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
      empId = (await trx.insertInto('core.employees').values({ company_id: companyId, ecode: tag, first_name: 'Kent Input Safety', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
      runId = (await trx.insertInto('pay.payroll_runs').values({ company_id: companyId, month: sql<Date>`DATE '2099-10-01'` }).returning('id').executeTakeFirstOrThrow()).id;
    });
  });
  afterAll(async () => {
    try {
      if (runId) { await db.deleteFrom('pay.inputs').where('run_id', '=', runId).execute(); await db.deleteFrom('pay.payroll_runs').where('id', '=', runId).execute(); }
      if (empId) await db.deleteFrom('core.employees').where('id', '=', empId).execute();
      if (companyId) await db.deleteFrom('core.companies').where('id', '=', companyId).execute();
    } finally { await db.destroy(); }
  });

  it('accepts valid paise amounts and persists independent expected decimals; rejects excess precision atomically', async () => {
    await expect(addRunInputs(db, runId, [input(1.1), input(1.09), input(10.12)], actorId)).resolves.toEqual({ inserted: 3 });
    const amounts = await db.selectFrom('pay.inputs').select('amount').where('run_id', '=', runId).orderBy('id').execute();
    expect(amounts.map(r => r.amount)).toEqual(['1.10', '1.09', '10.12']);
    await expect(addRunInputs(db, runId, [input(1), input(1.005)], actorId)).rejects.toThrow(/amount/);
    expect(await db.selectFrom('pay.inputs').select('id').where('run_id', '=', runId).execute()).toHaveLength(3);
  });

  it('uses the note column alone for reordered quoted CSV headers', async () => {
    const csv = `note,amount,ecode,component_code\n"Lunch, reviewed",1.09,${tag},CANTEEN\n`;
    expect(await parseInputsCsv(db, runId, csv)).toEqual([{ ...input(1.09), note: 'Lunch, reviewed' }]);
  });

  it.each(['add', 'remove'] as const)('serializes %s with an input-lock transition and refuses writes after it', async action => {
    await db.updateTable('pay.payroll_runs').set({ status: 'draft' }).where('id', '=', runId).execute();
    const row = await db.insertInto('pay.inputs').values({ run_id: runId, employee_id: empId, component_code: 'CANTEEN', amount: '1.00', note: 'Lock race fixture', entered_by: actorId }).returning('id').executeTakeFirstOrThrow();
    const locking = await db.startTransaction().execute();
    const editing = await db.startTransaction().execute();
    try {
      await locking.selectFrom('pay.payroll_runs').select('id').where('id', '=', runId).forUpdate().execute();
      await sql`SET LOCAL lock_timeout = '250ms'`.execute(editing);
      const operation = action === 'add' ? addRunInputs(editing, runId, [input()], actorId) : removeRunInput(editing, runId, row.id, actorId);
      await expect(operation).rejects.toMatchObject({ code: '55P03' });
      await editing.rollback().execute();
      await locking.updateTable('pay.payroll_runs').set({ status: 'inputs_locked' }).where('id', '=', runId).execute();
      await locking.commit().execute();
      await expect(action === 'add' ? addRunInputs(db, runId, [input()], actorId) : removeRunInput(db, runId, row.id, actorId)).rejects.toThrow(/draft/);
    } finally {
      if (!editing.isRolledBack && !editing.isCommitted) await editing.rollback().execute();
      if (!locking.isRolledBack && !locking.isCommitted) await locking.rollback().execute();
      await db.updateTable('pay.payroll_runs').set({ status: 'draft' }).where('id', '=', runId).execute();
    }
  });

  it('rechecks draft status after an add waits for a concurrent input lock', async () => {
    const locking = await db.startTransaction().execute();
    const editing = await db.startTransaction().execute();
    try {
      await locking.selectFrom('pay.payroll_runs').select('id').where('id', '=', runId).forUpdate().execute();
      const pid = (await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(editing)).rows[0]?.pid;
      if (!pid) throw new Error('Missing editing connection');
      const outcome = addRunInputs(editing, runId, [input()], actorId)
        .then(() => ({ error: null }), (error: unknown) => ({ error }));
      await expect.poll(async () => (await sql<{ waiting: boolean }>`SELECT cardinality(pg_blocking_pids(${pid})) > 0 AS waiting`.execute(db)).rows[0]?.waiting,
        { interval: 10, timeout: 2000 }).toBe(true);
      await locking.updateTable('pay.payroll_runs').set({ status: 'inputs_locked' }).where('id', '=', runId).execute();
      await locking.commit().execute();
      expect((await outcome).error).toMatchObject({ code: 'CONFLICT' });
    } finally {
      if (!editing.isRolledBack && !editing.isCommitted) await editing.rollback().execute();
      if (!locking.isRolledBack && !locking.isCommitted) await locking.rollback().execute();
      await db.updateTable('pay.payroll_runs').set({ status: 'draft' }).where('id', '=', runId).execute();
    }
  });
});
