/**
 * Stage 1.7 — month lock + muster snapshot (ATT-15, RPT-01).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { getMonthLockChecklist, lockMonth } from '../src/modules/attendance/index.js';
import { buildMusterMonth, listMuster } from '../src/modules/reports/index.js';
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

    empEcode = `RML6${String(stamp).slice(-6)}`;
    empId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: empEcode,
          company_id: companyId,
          first_name: 'S17 Emp',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

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

    // Seed a present day for muster
    await db
      .insertInto('att.day_records')
      .values({
        employee_id: empId,
        work_date: sql<Date>`${month}::date` as unknown as Date,
        status: 'P',
        source: 'auto',
        ot_minutes: 60,
      })
      .onConflict((oc) =>
        oc.columns(['employee_id', 'work_date']).doUpdateSet({ status: 'P', ot_minutes: 60 }),
      )
      .execute();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('builds muster snapshot with R1 identity columns', async () => {
    const n = await buildMusterMonth(db, companyId, month);
    expect(n).toBeGreaterThan(0);
    const rows = await listMuster(db, { companyId, month });
    const mine = rows.find((row) => row.ecode === empEcode);
    expect(mine).toBeTruthy();
    if (!mine) return;
    expect(mine.employeeName).toContain('S17');
    expect(mine.present + mine.absent + mine.halfDays).toBeGreaterThanOrEqual(0);
    expect(mine.dayStatuses['01']).toBe('P');
    expect(mine.otHours).toBe(1);
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
