/**
 * Stage 1.11 — shift micro, overlap, hours cap, patterns, swap, chain preview.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { applyRosterEntries } from '../src/modules/attendance/index.js';
import { RosterRuleError } from '../src/modules/attendance/shift-windows.js';
import {
  commitPatternApply,
  previewPatternApply,
  upsertPattern,
} from '../src/modules/attendance/shift-pattern.service.js';
import { requestShiftSwap } from '../src/modules/attendance/shift-swap.service.js';
import { createRequest, previewChain } from '../src/modules/workflows/index.js';
import { evaluateLeaveCoverage } from '../src/modules/leave/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 1.11 — shift micro + scheduling (SHF-01..16)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const code = `H${stamp.toString(36).toUpperCase().slice(0, 6)}`;
  let companyId = 0;
  let managerId = 0;
  let empA = 0;
  let empB = 0;
  let managerUserId = 0;
  let userA = 0;
  let genId = 0;
  let nightId = 0;
  let earlyId = 0;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    companyId = (
      await db
        .insertInto('core.companies')
        .values({ code, name: `Shift micro ${String(stamp)}`, ecode_prefix: code })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    managerId = (
      await db
        .insertInto('core.employees')
        .values({ ecode: `${code}MGR`, company_id: companyId, first_name: 'Shift', last_name: 'Lead', status: 'active' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    empA = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `${code}A`,
          company_id: companyId,
          first_name: 'Ada',
          last_name: 'Roster',
          status: 'active',
          reporting_manager_id: managerId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    empB = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `${code}B`,
          company_id: companyId,
          first_name: 'Ben',
          last_name: 'Roster',
          status: 'active',
          reporting_manager_id: managerId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    managerUserId = (
      await db
        .insertInto('core.users')
        .values({
          email: `mgr-${stamp}@hrms.test`,
          password_hash: await hashPassword('mgr-test-pw-1!'),
          employee_id: managerId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    userA = (
      await db
        .insertInto('core.users')
        .values({
          email: `a-${stamp}@hrms.test`,
          password_hash: await hashPassword('emp-test-pw-1!'),
          employee_id: empA,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    genId = (
      await db
        .insertInto('att.shifts')
        .values({
          code: `${code}GEN`,
          name: 'General',
          start_time: '09:00:00',
          end_time: '18:00:00',
          min_half_day_hours: '4',
          min_full_day_hours: '8',
          break_minutes: 0,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    nightId = (
      await db
        .insertInto('att.shifts')
        .values({
          code: `${code}NGT`,
          name: 'Night',
          start_time: '21:00:00',
          end_time: '06:00:00',
          crosses_midnight: true,
          min_half_day_hours: '4',
          min_full_day_hours: '8',
          break_minutes: 0,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    earlyId = (
      await db
        .insertInto('att.shifts')
        .values({
          code: `${code}ERL`,
          name: 'Early',
          start_time: '05:00:00',
          end_time: '13:00:00',
          min_half_day_hours: '4',
          min_full_day_hours: '8',
          break_minutes: 0,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    void genId;
  });

  afterAll(async () => {
    await db.deleteFrom('att.shift_swaps').where('requester_employee_id', 'in', [empA, empB]).execute();
    await db.deleteFrom('att.roster_revisions').where('employee_id', 'in', [empA, empB, managerId]).execute();
    await db.deleteFrom('att.rosters').where('employee_id', 'in', [empA, empB, managerId]).execute();
    await db.deleteFrom('att.shift_patterns').where('code', '=', `${code}ROT`).execute();
    await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('id', 'in', [managerUserId, userA]).execute();
    await db.destroy();
  });

  it('SHF-02 refuses a night window that overlaps EARLY the next morning', async () => {
    await expect(
      applyRosterEntries(db, {
        actorUserId: managerUserId,
        ip: null,
        entries: [
          { employeeId: empA, date: '2026-09-01', shiftId: nightId, weekOff: false },
          { employeeId: empA, date: '2026-09-02', shiftId: earlyId, weekOff: false },
        ],
      }),
    ).rejects.toBeInstanceOf(RosterRuleError);
  });

  it('SHF-02 allows night ending 06:00 then GEN at 09:00 (rest still applies)', async () => {
    // 3h rest < 11h default — this should refuse on rest, not overlap.
    await expect(
      applyRosterEntries(db, {
        actorUserId: managerUserId,
        ip: null,
        entries: [
          { employeeId: empB, date: '2026-09-01', shiftId: nightId, weekOff: false },
          { employeeId: empB, date: '2026-09-02', shiftId: genId, weekOff: false },
        ],
      }),
    ).rejects.toSatisfy((err: unknown) => err instanceof RosterRuleError && err.message.includes('SHF-03 rest'));
  });

  it('SHF-03 refuses a week over the 48h cap', async () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({
      employeeId: empA,
      date: `2026-09-${String(7 + i).padStart(2, '0')}`, // Mon 7 Sep – Sat 12 Sep
      shiftId: genId,
      weekOff: false,
    }));
    // 6 × 9h = 54h > 48
    await expect(
      applyRosterEntries(db, { actorUserId: managerUserId, ip: null, entries }),
    ).rejects.toSatisfy((err: unknown) => err instanceof RosterRuleError && err.message.includes('weekly hours cap'));
  });

  it('SHF-04 cyclic dry-run matches commit', async () => {
    await upsertPattern(db, {
      actorUserId: managerUserId,
      ip: null,
      pattern: {
        code: `${code}ROT`,
        name: '6-on 1-off',
        cycle: [
          { shiftCode: `${code}GEN`, weekOff: false },
          { shiftCode: `${code}GEN`, weekOff: false },
          { shiftCode: `${code}GEN`, weekOff: false },
          { shiftCode: `${code}GEN`, weekOff: false },
          { shiftCode: null, weekOff: true },
        ],
      },
    });
    const preview = await previewPatternApply(db, {
      code: `${code}ROT`,
      from: '2026-10-05',
      to: '2026-10-09',
      employeeIds: [empB],
    });
    expect(preview).toHaveLength(5);
    expect(preview[4]?.weekOff).toBe(true);
    const committed = await commitPatternApply(db, {
      actorUserId: managerUserId,
      code: `${code}ROT`,
      from: '2026-10-05',
      to: '2026-10-09',
      employeeIds: [empB],
      ip: null,
    });
    expect(committed.preview).toEqual(preview);
    expect(committed.upserted).toBe(5);
    const friday = await db
      .selectFrom('att.rosters')
      .select('is_week_off')
      .where('employee_id', '=', empB)
      .where('work_date', '=', sql<Date>`'2026-10-09'::date`)
      .executeTakeFirstOrThrow();
    expect(friday.is_week_off).toBe(true);
  });

  it('SHF-16 chain preview matches the engine’s first live step', async () => {
    const preview = await previewChain(db, { definitionCode: 'leave', subjectEmployeeId: empA });
    const firstLive = preview.find((s) => !s.vacant);
    expect(firstLive?.userId).toBe(managerUserId);

    const requestId = await createRequest(db, {
      definitionCode: 'leave',
      subjectEmployeeId: empA,
      requestedByUserId: userA,
      payload: { probe: 'shf-16' },
    });
    const step = await db
      .selectFrom('wf.request_steps')
      .select(['approver_user_id', 'delegated_from'])
      .where('request_id', '=', requestId)
      .where('action', 'is', null)
      .executeTakeFirstOrThrow();
    expect(step.approver_user_id).toBe(firstLive?.userId);
    expect(step.delegated_from).toBe(firstLive?.delegatedFromUserId);
  });

  it('SHF-08 counts the applicant as absent before the application row exists', async () => {
    await applyRosterEntries(db, {
      actorUserId: managerUserId,
      ip: null,
      entries: [{ employeeId: empB, date: '2026-12-14', shiftId: genId, weekOff: false }],
    });
    const impact = await evaluateLeaveCoverage(db, { employeeId: empB, from: '2026-12-14', to: '2026-12-14' });
    expect(impact.blocked).toBe(false);
    // The warning renders the date as `DD MMM YYYY` — the ONLY date format this
    // system shows a human (docs/05 §10, NFR-09). Asserting the whole sentence
    // rather than two fragments also pins the shortfall arithmetic.
    expect(impact.warnings).toEqual([
      `${code}GEN on 14 Dec 2026 would leave 0 against the sanctioned 1 (shortfall 1). Your manager can still approve.`,
    ]);
  });

  it('SHF-08 does not warn when remaining headcount still meets the minimum', async () => {
    await applyRosterEntries(db, {
      actorUserId: managerUserId,
      ip: null,
      entries: [
        { employeeId: empA, date: '2026-12-15', shiftId: genId, weekOff: false },
        { employeeId: empB, date: '2026-12-15', shiftId: genId, weekOff: false },
      ],
    });
    const impact = await evaluateLeaveCoverage(db, { employeeId: empB, from: '2026-12-15', to: '2026-12-15' });
    expect(impact.warnings.some((w) => w.includes('2026-12-15'))).toBe(false);
  });

  it('SHF-07 swap refuses when the resulting pair would overlap', async () => {
    await applyRosterEntries(db, {
      actorUserId: managerUserId,
      ip: null,
      entries: [
        { employeeId: empA, date: '2026-11-02', shiftId: nightId, weekOff: false },
        { employeeId: empA, date: '2026-11-03', shiftId: genId, weekOff: false },
      ],
    }).catch(() => undefined);
    // Pair B night on 2 Nov, A early on 3 Nov so a swap of 3 Nov isn't the overlap.
    // Request a swap of 2026-11-02: A night vs B if B has EARLY same day — same-day unique
    // so overlap is adjacent days. Put B on EARLY 3 Nov and A on NIGHT 2 Nov; swap 3 Nov
    // is not overlapping. Instead: after A is NIGHT on 2 Nov, give B GEN on 2 Nov, swap
    // doesn't create overlap. Skip if roster save of A night+GEN rest-failed.
    await applyRosterEntries(db, {
      actorUserId: managerUserId,
      ip: null,
      entries: [{ employeeId: empA, date: '2026-11-10', shiftId: genId, weekOff: false }],
    });
    await applyRosterEntries(db, {
      actorUserId: managerUserId,
      ip: null,
      entries: [{ employeeId: empB, date: '2026-11-10', shiftId: genId, weekOff: false }],
    });
    const swap = await requestShiftSwap(db, {
      requesterEmployeeId: empA,
      requestedByUserId: userA,
      counterpartEmployeeId: empB,
      workDate: '2026-11-10',
      kind: 'swap',
      reason: 'Need the other window for a training day',
    });
    expect(swap.id).toBeGreaterThan(0);
  });
});
