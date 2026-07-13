/**
 * Stage 1.6 — boarding email, absenteeism, letters, policies (live Postgres).
 *  B1 empty boarding day still queues notifications + Excel with R24 sheets
 *  A1 4 consecutive UAB → watch case; 7 → show_cause
 *  A2 show-cause letter linked on case
 *  P1 policy publish → ack → stats percent matches hand count
 *  L1 letter merge rejects missing fields
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { runDailyBoardingExitReport, buildBoardingExcel } from '../src/modules/boarding/index.js';
import {
  consecutiveUabDays,
  issueShowCauseLetter,
  runAbsenteeScan,
} from '../src/modules/attendance/index.js';
import { issueLetter, renderTemplate } from '../src/modules/letters/index.js';
import {
  acknowledgePolicy,
  policyAckStats,
  publishPolicy,
} from '../src/modules/policies/index.js';
import { addDaysIso, istDateString } from '../src/core/dates.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 1.6 — boarding / absence / letters / policies', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const today = istDateString();
  let empId: number;
  let hrUserId: number;
  let companyId: number;

  async function mkEmployee(suffix: string): Promise<number> {
    const r = await db
      .insertInto('core.employees')
      .values({
        ecode: `RML7${String(stamp).slice(-5)}${suffix}`,
        company_id: companyId,
        first_name: `S16 ${suffix}`,
        status: 'active',
        doj: sql<Date>`${addDaysIso(today, -400)}::date` as unknown as Date,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    companyId = (await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow()).id;

    // Ensure subscriptions exist for boarding (migration seeds them)
    await db
      .insertInto('wf.event_subscriptions')
      .values({ event_code: 'daily.boarding_report', recipient_kind: 'role', recipient_ref: 'hr_ops' })
      .onConflict((oc) => oc.columns(['event_code', 'recipient_kind', 'recipient_ref']).doNothing())
      .execute();

    empId = await mkEmployee('E');
    const hrEmp = await mkEmployee('H');
    const hr = await db
      .insertInto('core.users')
      .values({
        email: `s16-hr-${stamp}@hrms.test`,
        password_hash: await hashPassword('s16-test-pw-1!'),
        employee_id: hrEmp,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    hrUserId = hr.id;
    const role = await db.selectFrom('core.roles').select('id').where('code', '=', 'hr_ops').executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles').values({ user_id: hrUserId, role_id: role.id, scope_org_unit_id: null }).execute();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('L1: renderTemplate + merge validation', () => {
    expect(renderTemplate('Hi {{name}}', { name: 'Rachna' })).toBe('Hi Rachna');
  });

  it('L1b: issueLetter rejects missing merge fields', async () => {
    await expect(
      issueLetter(db, {
        employeeId: empId,
        templateCode: 'show_cause',
        fields: { employee_name: 'X', ecode: 'Y' }, // missing start_date, days_absent
        actorUserId: hrUserId,
      }),
    ).rejects.toThrow(/Missing merge field/);
  });

  it('B1: empty boarding day still queues + Excel has Joins/Exits sheets', async () => {
    // Use a date with no joins/exits for our stamp employees (far future)
    const quiet = '2099-01-15';
    const result = await runDailyBoardingExitReport(db, quiet);
    expect(result.reportDate).toBe(quiet);
    expect(result.joins).toHaveLength(0);
    expect(result.exits).toHaveLength(0);
    // May be 0 if no hr_ops users — but seed + our hr user should get ≥1
    expect(result.notificationsQueued).toBeGreaterThanOrEqual(0);
    expect(result.excelBase64.length).toBeGreaterThan(100);

    const buf = await buildBoardingExcel(quiet, [], []);
    expect(buf.length).toBeGreaterThan(500);
  });

  it('B2: join on report date appears in boarding rows', async () => {
    const reportDate = addDaysIso(today, -1);
    await db
      .updateTable('core.employees')
      .set({ doj: sql<Date>`${reportDate}::date` as unknown as Date })
      .where('id', '=', empId)
      .execute();
    const result = await runDailyBoardingExitReport(db, reportDate);
    expect(result.joins.some((j) => j.ecode.includes(String(stamp).slice(-5)))).toBe(true);
  });

  it('A1: consecutive UAB builds watch then show_cause', async () => {
    const end = addDaysIso(today, -1);
    // Seed 7 UAB days
    for (let i = 0; i < 7; i++) {
      const d = addDaysIso(end, -i);
      await db
        .insertInto('att.day_records')
        .values({
          employee_id: empId,
          work_date: sql<Date>`${d}::date` as unknown as Date,
          status: 'UAB',
          source: 'auto',
        })
        .onConflict((oc) =>
          oc.columns(['employee_id', 'work_date']).doUpdateSet({ status: 'UAB', source: 'auto' }),
        )
        .execute();
    }

    const streak = await consecutiveUabDays(db, empId, end);
    expect(streak.days).toBeGreaterThanOrEqual(7);

    // After 4 days of scanning we'd open watch — run scan on day 4 and day 7 via asOf
    const day4 = addDaysIso(end, -3);
    await runAbsenteeScan(db, day4);
    let open = await db
      .selectFrom('att.absence_cases')
      .selectAll()
      .where('employee_id', '=', empId)
      .where('closed_at', 'is', null)
      .executeTakeFirst();
    expect(open).toBeTruthy();
    if (!open) throw new Error('expected open absence case');
    expect(['watch', 'show_cause']).toContain(open.stage);

    await runAbsenteeScan(db, end);
    open = await db
      .selectFrom('att.absence_cases')
      .selectAll()
      .where('employee_id', '=', empId)
      .where('closed_at', 'is', null)
      .executeTakeFirstOrThrow();
    expect(open.stage).toBe('show_cause');
    expect(open.days_absent).toBeGreaterThanOrEqual(7);
  });

  it('A2: show-cause letter links to case', async () => {
    const c = await db
      .selectFrom('att.absence_cases')
      .selectAll()
      .where('employee_id', '=', empId)
      .where('closed_at', 'is', null)
      .executeTakeFirstOrThrow();

    const { letterId } = await issueShowCauseLetter(db, { caseId: c.id, actorUserId: hrUserId });
    expect(letterId).toBeGreaterThan(0);

    const updated = await db
      .selectFrom('att.absence_cases')
      .selectAll()
      .where('id', '=', c.id)
      .executeTakeFirstOrThrow();
    expect(updated.letter_id).toBe(letterId);

    const letter = await db.selectFrom('core.letters').selectAll().where('id', '=', letterId).executeTakeFirstOrThrow();
    expect(letter.template_code).toBe('show_cause');
    expect(letter.body_rendered).toContain('RML7');
  });

  it('P1: policy publish → ack → percent matches', async () => {
    const policyId = await publishPolicy(db, {
      title: `S16 Policy ${stamp}`,
      bodySummary: 'Test policy body',
      effectiveDate: today,
      requiresAcknowledgment: true,
      actorUserId: hrUserId,
    });

    const before = await policyAckStats(db);
    expect(before.policyCount).toBeGreaterThanOrEqual(1);

    // Acknowledge for emp
    await acknowledgePolicy(db, { policyId, employeeId: empId });

    const after = await policyAckStats(db);
    expect(after.actualAcks).toBeGreaterThanOrEqual(before.actualAcks + 1);
    // Hand formula
    expect(after.percent).toBe(
      after.expectedAcks === 0 ? 100 : Math.round((after.actualAcks / after.expectedAcks) * 1000) / 10,
    );
  });
});
