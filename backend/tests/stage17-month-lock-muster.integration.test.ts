/**
 * Stage 1.7 — month lock + muster snapshot (ATT-15, RPT-01) + R1 filters.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { getMonthLockChecklist, lockMonth } from '../src/modules/attendance/index.js';
import { buildMusterMonth, exportMusterExcel, listMuster } from '../src/modules/reports/index.js';
import { istDateString } from '../src/core/dates.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 1.7 — month lock + muster', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const today = istDateString();
  const month = `${today.slice(0, 7)}-01`;
  let companyId: number;
  let empId: number;
  let empEcode: string;
  let hrEmpId: number;
  let hrUserId: number;
  let otherEmpId: number;
  let otherEcode: string;
  let deptId: number;
  let locId: number;
  let ccId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const companyCode = `S${stamp.toString(36).toUpperCase()}`;
    companyId = (
      await db
        .insertInto('core.companies')
        .values({
          code: companyCode,
          name: `Stage 1.7 Test ${String(stamp)}`,
          ecode_prefix: companyCode,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    deptId = (
      await db
        .insertInto('core.departments')
        .values({ name: `Muster Dept ${String(stamp)}` })
        .onConflict((oc) => oc.column('name').doUpdateSet({ name: `Muster Dept ${String(stamp)}` }))
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    locId = (
      await db
        .insertInto('core.locations')
        .values({
          company_id: companyId,
          name: `Plant ${String(stamp).slice(-4)}`,
          state_code: 'WB',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    ccId = (
      await db
        .insertInto('core.cost_centers')
        .values({
          company_id: companyId,
          code: `CC${String(stamp).slice(-4)}`,
          name: `Cost centre ${String(stamp).slice(-4)}`,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    empEcode = `RML6${String(stamp).slice(-6)}`;
    empId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: empEcode,
          company_id: companyId,
          first_name: 'S17 Emp',
          status: 'active',
          category: 'white_collar',
          department_id: deptId,
          location_id: locId,
          cost_center_id: ccId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    otherEcode = `RML6${String(stamp).slice(-5)}X`;
    otherEmpId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: otherEcode,
          company_id: companyId,
          first_name: 'S17 Other',
          status: 'active',
          category: 'blue_collar',
          reporting_manager_id: empId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    // reporting_tree is statement-trigger maintained — force a link for subtree tests
    await db
      .insertInto('core.reporting_tree')
      .values({ manager_id: empId, employee_id: otherEmpId, depth: 1 })
      .onConflict((oc) => oc.columns(['manager_id', 'employee_id']).doNothing())
      .execute();

    hrEmpId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `RML6${String(stamp).slice(-5)}H`,
          company_id: companyId,
          first_name: 'S17 HR',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    hrUserId = (
      await db
        .insertInto('core.users')
        .values({
          email: `s17-hr-${stamp}@hrms.test`,
          password_hash: await hashPassword('s17-test-pw-1!'),
          employee_id: hrEmpId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    // Seed present days for muster
    for (const id of [empId, otherEmpId]) {
      await db
        .insertInto('att.day_records')
        .values({
          employee_id: id,
          work_date: sql<Date>`${month}::date` as unknown as Date,
          status: 'P',
          source: 'auto',
          ot_minutes: id === empId ? 60 : 0,
        })
        .onConflict((oc) =>
          oc.columns(['employee_id', 'work_date']).doUpdateSet({ status: 'P', ot_minutes: id === empId ? 60 : 0 }),
        )
        .execute();
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('builds muster snapshot with R1 identity columns', async () => {
    const n = await buildMusterMonth(db, companyId, month);
    expect(n).toBeGreaterThanOrEqual(2);
    const rows = await listMuster(db, { companyId, month });
    const mine = rows.find((row) => row.ecode === empEcode);
    expect(mine).toBeTruthy();
    if (!mine) return;
    expect(mine.employeeName).toContain('S17');
    expect(mine.present + mine.absent + mine.halfDays).toBeGreaterThanOrEqual(0);
    expect(mine.dayStatuses['01']).toBe('P');
    expect(mine.otHours).toBe(1);

    const raw = await db
      .selectFrom('att.day_records')
      .where('employee_id', '=', empId)
      .where('work_date', '>=', sql<Date>`${month}::date`)
      .where('work_date', '<', sql<Date>`(${month}::date + interval '1 month')`)
      .select([
        sql<number>`count(*) FILTER (WHERE status = 'P')::int`.as('present'),
        sql<number>`count(*) FILTER (WHERE status = 'A')::int`.as('absent'),
        sql<number>`count(*) FILTER (WHERE status = 'UAB')::int`.as('uab'),
        sql<number>`coalesce(sum(ot_minutes), 0)::int`.as('ot_minutes'),
      ])
      .executeTakeFirstOrThrow();
    expect({ present: mine.present, absent: mine.absent, uab: mine.uabDays, otMinutes: mine.otHours * 60 })
      .toEqual({ present: raw.present, absent: raw.absent, uab: raw.uab, otMinutes: raw.ot_minutes });
  });

  it('R1 filters: category + department + RM subtree; export uses same rows (RPT-06)', async () => {
    await buildMusterMonth(db, companyId, month);

    const byCategory = await listMuster(db, {
      companyId,
      month,
      category: 'white_collar',
    });
    expect(byCategory.some((r) => r.ecode === empEcode)).toBe(true);
    expect(byCategory.every((r) => r.category === 'white_collar')).toBe(true);
    expect(byCategory.some((r) => r.ecode === otherEcode)).toBe(false);

    const byDept = await listMuster(db, {
      companyId,
      month,
      department: `Muster Dept ${String(stamp)}`,
    });
    expect(byDept.map((r) => r.ecode)).toContain(empEcode);

    const byRmDirect = await listMuster(db, {
      companyId,
      month,
      reportingManagerId: empId,
      subtree: false,
    });
    expect(byRmDirect.map((r) => r.ecode)).toEqual([otherEcode]);

    const byRmSubtree = await listMuster(db, {
      companyId,
      month,
      reportingManagerId: empId,
      subtree: true,
    });
    expect(byRmSubtree.map((r) => r.ecode)).toContain(otherEcode);

    const filtered = await listMuster(db, {
      companyId,
      month,
      category: 'white_collar',
      location: `Plant ${String(stamp).slice(-4)}`,
    });
    const excel = await exportMusterExcel(db, {
      companyId,
      month,
      category: 'white_collar',
      location: `Plant ${String(stamp).slice(-4)}`,
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(excel.subarray(0, 2).toString('utf8')).toBe('PK');
    // Zip must not be a trivial empty shell when rows exist
    expect(excel.byteLength).toBeGreaterThan(800);
  });

  it('month lock checklist + lock freezes days', async () => {
    // Unique far-future month per run (avoid leftover locks from prior suites)
    const mon = String((stamp % 12) + 1).padStart(2, '0');
    const quietMonth = `2097-${mon}-01`;
    await db
      .insertInto('att.day_records')
      .values({
        employee_id: empId,
        work_date: sql<Date>`${quietMonth}::date`,
        status: 'P',
        source: 'auto',
      })
      .execute();

    const cl = await getMonthLockChecklist(db, companyId, quietMonth);
    expect(cl.alreadyLocked).toBe(false);
    expect(cl.items.length).toBeGreaterThanOrEqual(4);
    expect(cl.items.every((i) => i.code && i.label)).toBe(true);

    if (cl.canLock) {
      const { id } = await lockMonth(db, {
        companyId,
        month: quietMonth,
        actorUserId: hrUserId,
      });
      expect(id).toBeGreaterThan(0);
      const again = await getMonthLockChecklist(db, companyId, quietMonth);
      expect(again.alreadyLocked).toBe(true);
      expect(again.canLock).toBe(false);
      const frozen = await db
        .selectFrom('att.day_records')
        .select('is_locked')
        .where('employee_id', '=', empId)
        .where('work_date', '=', sql<Date>`${quietMonth}::date`)
        .executeTakeFirstOrThrow();
      expect(frozen.is_locked).toBe(true);
      await expect(
        db
          .insertInto('att.day_records')
          .values({
            employee_id: hrEmpId,
            work_date: sql<Date>`${quietMonth}::date`,
            status: 'P',
            source: 'auto',
          })
          .execute(),
      ).rejects.toThrow(/locked/i);
    } else {
      await expect(
        lockMonth(db, { companyId, month: quietMonth, actorUserId: hrUserId }),
      ).rejects.toThrow(/blocked|already/i);
    }
  });

  it('lock blocked when already locked', async () => {
    const m = `2096-${String((stamp % 12) + 1).padStart(2, '0')}-01`;
    await db
      .insertInto('att.month_locks')
      .values({
        company_id: companyId,
        month: sql<Date>`${m}::date` as unknown as Date,
        locked_by: hrUserId,
        checklist: JSON.stringify([]),
      })
      .execute();
    const cl = await getMonthLockChecklist(db, companyId, m);
    expect(cl.alreadyLocked).toBe(true);
  });
});
