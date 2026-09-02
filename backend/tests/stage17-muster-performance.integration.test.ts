/**
 * Stage 1.7 scale gate — R1 must export a 3,000 employee × 31 day snapshot
 * within the docs/06 §12 ten-second target.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { sql, type Insertable, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { exportMusterExcel } from '../src/modules/reports/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 1.7 — 3,000 × 31 muster export performance', () => {
  let db: Kysely<Database>;
  let companyId: number | undefined;
  const stamp = Date.now();
  const month = '2099-01-01';
  const employeeCount = 3_000;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const code = `P${stamp.toString(36).toUpperCase()}`;
    const createdCompanyId = (await db
      .insertInto('core.companies')
      .values({ code, name: `Muster performance ${String(stamp)}`, ecode_prefix: code })
      .returning('id')
      .executeTakeFirstOrThrow()).id;
    companyId = createdCompanyId;

    const employees: Insertable<Database['core.employees']>[] = Array.from(
      { length: employeeCount },
      (_, index) => ({
        ecode: `${code}${String(index + 1).padStart(4, '0')}`,
        company_id: createdCompanyId,
        first_name: 'Scale',
        last_name: `Employee ${String(index + 1)}`,
        status: 'active',
        category: index % 2 === 0 ? 'white_collar' : 'blue_collar',
      }),
    );

    const employeeIds: { id: number; ecode: string }[] = [];
    for (let offset = 0; offset < employees.length; offset += 500) {
      employeeIds.push(...await db
        .insertInto('core.employees')
        .values(employees.slice(offset, offset + 500))
        .returning(['id', 'ecode'])
        .execute());
    }

    const dayStatuses = JSON.stringify(Object.fromEntries(
      Array.from({ length: 31 }, (_, index) => [String(index + 1).padStart(2, '0'), 'P']),
    ));
    const snapshots: Insertable<Database['reporting.muster_month']>[] = employeeIds.map((employee, index) => ({
      company_id: createdCompanyId,
      month: sql<Date>`${month}::date` as unknown as Date,
      employee_id: employee.id,
      ecode: employee.ecode,
      employee_name: `Scale Employee ${String(index + 1)}`,
      reporting_manager: null,
      functional_manager: null,
      department: null,
      designation: null,
      org_unit: null,
      cost_center: null,
      contact: null,
      category: index % 2 === 0 ? 'white_collar' : 'blue_collar',
      day_statuses: dayStatuses,
      present: 31,
      absent: 0,
      half_days: 0,
      weekoffs: 0,
      weekoffs_unpaid: 0,
      holidays: 0,
      leave_days: '0',
      od_days: 0,
      co_days: 0,
      uab_days: 0,
      lop_days: '0',
      ot_hours: '0',
    }));
    for (let offset = 0; offset < snapshots.length; offset += 500) {
      await db.insertInto('reporting.muster_month').values(snapshots.slice(offset, offset + 500)).execute();
    }
  }, 30_000);

  afterAll(async () => {
    if (companyId !== undefined) {
      await db.deleteFrom('reporting.muster_month').where('company_id', '=', companyId).execute();
      await db.deleteFrom('core.employees').where('company_id', '=', companyId).execute();
      await db.deleteFrom('core.companies').where('id', '=', companyId).execute();
    }
    await db.destroy();
  });

  it('exports the full matrix in under ten seconds', async () => {
    if (companyId === undefined) throw new Error('Performance fixture was not created');
    const startedAt = performance.now();
    const buffer = await exportMusterExcel(db, { companyId, month });
    const elapsedMs = performance.now() - startedAt;

    expect(elapsedMs).toBeLessThan(10_000);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    expect(workbook.worksheets[0]?.actualRowCount).toBe(employeeCount + 1);
  }, 15_000);
});
