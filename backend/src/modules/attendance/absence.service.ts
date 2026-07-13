/**
 * Absenteeism engine (ATT-10/11, docs/04 §1.5, PP-7):
 * Daily scan of UAB days → alerts → absence_cases watch (≥4) → show_cause (≥7)
 * with optional show-cause letter via CORE-09.
 *
 * Thresholds from core.settings — never hardcoded.
 */
import { sql, type Kysely, type Selectable } from 'kysely';
import type { AttAbsenceCasesTable, Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { addDaysIso, formatDbDate, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';
import { enqueue, enqueueEvent } from '../notifications/index.js';
import { employeeMergeFields, issueLetter } from '../letters/index.js';

export type AbsenceCase = Selectable<AttAbsenceCasesTable>;

/**
 * Count consecutive UAB days ending on `asOf` (walking backwards).
 * Stops at first non-UAB day or gap.
 */
export async function consecutiveUabDays(
  db: Kysely<Database>,
  employeeId: number,
  asOf: string,
): Promise<{ startDate: string; days: number }> {
  let days = 0;
  let cursor = asOf;
  let startDate = asOf;
  for (let i = 0; i < 60; i++) {
    const row = await db
      .selectFrom('att.day_records')
      .select('status')
      .where('employee_id', '=', employeeId)
      .where('work_date', '=', sql<Date>`${cursor}::date`)
      .executeTakeFirst();
    if (row?.status !== 'UAB') break;
    days += 1;
    startDate = cursor;
    cursor = addDaysIso(cursor, -1);
  }
  return { startDate, days };
}

export interface AbsenteeScanResult {
  uabAlerts: number;
  casesOpened: number;
  casesEscalated: number;
  casesClosedReturned: number;
}

/** Daily 06:00 job: scan yesterday's day_records for UAB and maintain cases. */
export async function runAbsenteeScan(
  db: Kysely<Database>,
  asOf?: string,
): Promise<AbsenteeScanResult> {
  const today = istDateString();
  const scanDate = asOf ?? addDaysIso(today, -1);
  const watchDays = await getTypedSetting(db, 'att.absence_watch_days', 'number', 4);
  const showCauseDays = await getTypedSetting(db, 'att.show_cause_days', 'number', 7);

  const uabYesterday = await db
    .selectFrom('att.day_records')
    .select(['employee_id'])
    .where('work_date', '=', sql<Date>`${scanDate}::date`)
    .where('status', '=', 'UAB')
    .execute();

  let uabAlerts = 0;
  let casesOpened = 0;
  let casesEscalated = 0;

  for (const row of uabYesterday) {
    const emp = await db
      .selectFrom('core.employees')
      .select(['id', 'ecode', 'reporting_manager_id', 'first_name', 'last_name'])
      .where('id', '=', row.employee_id)
      .where('status', 'in', ['active', 'on_notice'])
      .executeTakeFirst();
    if (!emp) continue;

    // ATT-11: alert employee + RM
    const empUser = await db
      .selectFrom('core.users')
      .select('id')
      .where('employee_id', '=', emp.id)
      .where('is_active', '=', true)
      .executeTakeFirst();
    if (empUser) {
      await enqueue(db, {
        recipientUserId: empUser.id,
        channel: 'in_app',
        templateCode: 'attendance_uab',
        payload: { date: scanDate, ecode: emp.ecode },
      });
      uabAlerts += 1;
    }
    if (emp.reporting_manager_id !== null) {
      const mgrUser = await db
        .selectFrom('core.users')
        .select('id')
        .where('employee_id', '=', emp.reporting_manager_id)
        .where('is_active', '=', true)
        .executeTakeFirst();
      if (mgrUser) {
        await enqueue(db, {
          recipientUserId: mgrUser.id,
          channel: 'in_app',
          templateCode: 'attendance_uab_manager',
          payload: { date: scanDate, ecode: emp.ecode, employeeId: emp.id },
        });
      }
    }
    await enqueueEvent(db, 'attendance.uab', 'attendance_uab_hr', {
      date: scanDate,
      ecode: emp.ecode,
      employeeId: emp.id,
    });

    const streak = await consecutiveUabDays(db, emp.id, scanDate);
    if (streak.days < watchDays) continue;

    let openCase = await db
      .selectFrom('att.absence_cases')
      .selectAll()
      .where('employee_id', '=', emp.id)
      .where('closed_at', 'is', null)
      .executeTakeFirst();

    if (!openCase) {
      openCase = await db
        .insertInto('att.absence_cases')
        .values({
          employee_id: emp.id,
          start_date: sql<Date>`${streak.startDate}::date` as unknown as Date,
          days_absent: streak.days,
          stage: streak.days >= showCauseDays ? 'show_cause' : 'watch',
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      casesOpened += 1;
    } else {
      const nextStage =
        streak.days >= showCauseDays && openCase.stage === 'watch'
          ? 'show_cause'
          : openCase.stage;
      await db
        .updateTable('att.absence_cases')
        .set({
          days_absent: streak.days,
          stage: nextStage,
        })
        .where('id', '=', openCase.id)
        .execute();
      if (nextStage === 'show_cause' && openCase.stage === 'watch') {
        casesEscalated += 1;
        await enqueueEvent(db, 'attendance.absence_show_cause', 'absence_show_cause', {
          caseId: openCase.id,
          ecode: emp.ecode,
          days: streak.days,
          startDate: streak.startDate,
        });
      }
      openCase = { ...openCase, days_absent: streak.days, stage: nextStage };
    }
  }

  // Close open cases when employee is no longer on UAB streak (returned)
  const openCases = await db
    .selectFrom('att.absence_cases')
    .selectAll()
    .where('closed_at', 'is', null)
    .execute();

  let casesClosedReturned = 0;
  for (const c of openCases) {
    const yesterday = await db
      .selectFrom('att.day_records')
      .select('status')
      .where('employee_id', '=', c.employee_id)
      .where('work_date', '=', sql<Date>`${scanDate}::date`)
      .executeTakeFirst();
    if (yesterday && yesterday.status !== 'UAB' && yesterday.status !== 'A') {
      await db
        .updateTable('att.absence_cases')
        .set({
          stage: 'closed',
          resolution: 'returned',
          closed_at: new Date(),
        })
        .where('id', '=', c.id)
        .execute();
      casesClosedReturned += 1;
    }
  }

  return { uabAlerts, casesOpened, casesEscalated, casesClosedReturned };
}

/** HR: issue show-cause letter and link to case. */
export async function issueShowCauseLetter(
  db: Kysely<Database>,
  params: { caseId: number; actorUserId: number },
): Promise<{ letterId: number }> {
  const c = await db
    .selectFrom('att.absence_cases')
    .selectAll()
    .where('id', '=', params.caseId)
    .executeTakeFirstOrThrow();
  if (c.closed_at !== null) throw new Error('Case is already closed');
  if (c.letter_id !== null) throw new Error('Letter already issued for this case');

  const base = await employeeMergeFields(db, c.employee_id);
  const { id: letterId } = await issueLetter(db, {
    employeeId: c.employee_id,
    templateCode: 'show_cause',
    fields: {
      ...base,
      start_date: formatDbDate(c.start_date),
      days_absent: String(c.days_absent),
    },
    actorUserId: params.actorUserId,
  });

  await db
    .updateTable('att.absence_cases')
    .set({
      letter_id: letterId,
      stage: c.stage === 'watch' ? 'show_cause' : c.stage,
      hr_owner_id: params.actorUserId,
    })
    .where('id', '=', c.id)
    .execute();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'update',
    entity: 'att.absence_cases',
    entityId: c.id,
    field: 'letter_id',
    newValue: String(letterId),
  });

  return { letterId };
}

export async function listOpenAbsenceCases(db: Kysely<Database>): Promise<AbsenceCase[]> {
  return db
    .selectFrom('att.absence_cases')
    .selectAll()
    .where('closed_at', 'is', null)
    .orderBy('days_absent', 'desc')
    .limit(500)
    .execute();
}

export async function closeAbsenceCase(
  db: Kysely<Database>,
  params: {
    caseId: number;
    resolution: 'returned' | 'regularized' | 'exited';
    actorUserId: number;
  },
): Promise<void> {
  await db
    .updateTable('att.absence_cases')
    .set({
      stage: 'closed',
      resolution: params.resolution,
      closed_at: new Date(),
      hr_owner_id: params.actorUserId,
    })
    .where('id', '=', params.caseId)
    .where('closed_at', 'is', null)
    .execute();
  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'update',
    entity: 'att.absence_cases',
    entityId: params.caseId,
    field: 'resolution',
    newValue: params.resolution,
  });
}
