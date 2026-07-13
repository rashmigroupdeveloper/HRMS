/**
 * Phase-1 reports R2–R6, R24, R27 (docs/06) — list queries for API + Excel later.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate } from '../../core/dates.js';
import { loadBoardingExitRows } from '../boarding/index.js';
import { monthStart, nextMonthStart } from '../attendance/index.js';

export async function reportR2Swipes(
  db: Kysely<Database>,
  params: { employeeId: number; fromDate: string; toDate: string },
) {
  const days = await db
    .selectFrom('att.day_records')
    .selectAll()
    .where('employee_id', '=', params.employeeId)
    .where('work_date', '>=', sql<Date>`${params.fromDate}::date`)
    .where('work_date', '<=', sql<Date>`${params.toDate}::date`)
    .orderBy('work_date')
    .execute();
  return days.map((d) => ({
    workDate: formatDbDate(d.work_date),
    status: d.status,
    firstIn: d.first_in?.toISOString() ?? null,
    lastOut: d.last_out?.toISOString() ?? null,
    workedMinutes: d.worked_minutes,
    lateMinutes: d.late_minutes,
    earlyExitMinutes: d.early_exit_minutes,
    otMinutes: d.ot_minutes,
  }));
}

export async function reportR3Regularizations(db: Kysely<Database>, companyId: number) {
  const rows = await db
    .selectFrom('att.regularizations as reg')
    .innerJoin('core.employees as e', 'e.id', 'reg.employee_id')
    .innerJoin('wf.requests as r', 'r.id', 'reg.workflow_request_id')
    .where('e.company_id', '=', companyId)
    .select([
      'reg.id',
      'e.ecode',
      'reg.kind',
      'reg.from_date',
      'reg.to_date',
      'reg.reason',
      'reg.applied',
      'r.status as workflow_status',
    ])
    .orderBy('reg.id', 'desc')
    .limit(500)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    ecode: r.ecode,
    kind: r.kind,
    fromDate: formatDbDate(r.from_date),
    toDate: formatDbDate(r.to_date),
    reason: r.reason,
    applied: r.applied,
    workflowStatus: r.workflow_status,
  }));
}

export async function reportR4Exceptions(
  db: Kysely<Database>,
  companyId: number,
  month: string,
) {
  const m = monthStart(month);
  const mEnd = nextMonthStart(m);
  const rows = await db
    .selectFrom('att.day_records as d')
    .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
    .where('e.company_id', '=', companyId)
    .where('d.work_date', '>=', sql<Date>`${m}::date`)
    .where('d.work_date', '<', sql<Date>`${mEnd}::date`)
    .where((eb) =>
      eb.or([
        eb('d.late_minutes', '>', 0),
        eb('d.early_exit_minutes', '>', 0),
        eb('d.status', '=', 'UAB'),
      ]),
    )
    .select([
      'e.ecode',
      'd.work_date',
      'd.status',
      'd.late_minutes',
      'd.early_exit_minutes',
    ])
    .orderBy('d.work_date')
    .limit(2000)
    .execute();
  return rows.map((r) => ({
    ecode: r.ecode,
    workDate: formatDbDate(r.work_date),
    status: r.status,
    lateMinutes: r.late_minutes,
    earlyExitMinutes: r.early_exit_minutes,
  }));
}

export async function reportR5Ot(db: Kysely<Database>, companyId: number, month: string) {
  const m = monthStart(month);
  const mEnd = nextMonthStart(m);
  const rows = await db
    .selectFrom('att.overtime_entries as o')
    .innerJoin('core.employees as e', 'e.id', 'o.employee_id')
    .where('e.company_id', '=', companyId)
    .where('o.work_date', '>=', sql<Date>`${m}::date`)
    .where('o.work_date', '<', sql<Date>`${mEnd}::date`)
    .select([
      'e.ecode',
      'o.work_date',
      'o.detected_minutes',
      'o.claimed_minutes',
      'o.approved_minutes',
      'o.status',
      'o.deadline_at',
      'o.decided_at',
      'o.comp_off_credit_id',
    ])
    .orderBy('o.work_date')
    .execute();
  return rows.map((r) => ({
    ecode: r.ecode,
    workDate: formatDbDate(r.work_date),
    detectedMinutes: r.detected_minutes,
    claimedMinutes: r.claimed_minutes,
    approvedMinutes: r.approved_minutes,
    status: r.status,
    deadlineAt: r.deadline_at.toISOString(),
    decidedAt: r.decided_at?.toISOString() ?? null,
    convertedCompOff: r.comp_off_credit_id !== null,
  }));
}

export async function reportR6AbsenceCases(db: Kysely<Database>, companyId: number) {
  const rows = await db
    .selectFrom('att.absence_cases as c')
    .innerJoin('core.employees as e', 'e.id', 'c.employee_id')
    .where('e.company_id', '=', companyId)
    .select([
      'c.id',
      'e.ecode',
      'c.start_date',
      'c.days_absent',
      'c.stage',
      'c.letter_id',
      'c.resolution',
      'c.closed_at',
    ])
    .orderBy('c.id', 'desc')
    .limit(500)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    ecode: r.ecode,
    startDate: formatDbDate(r.start_date),
    daysAbsent: r.days_absent,
    stage: r.stage,
    letterId: r.letter_id,
    resolution: r.resolution,
    closedAt: r.closed_at?.toISOString() ?? null,
  }));
}

export async function reportR24Boarding(
  db: Kysely<Database>,
  reportDate: string,
  companyId: number,
) {
  return loadBoardingExitRows(db, reportDate, companyId);
}

export async function reportR27Headcount(db: Kysely<Database>, companyId?: number) {
  let q = db
    .selectFrom('core.employees')
    .select((eb) => [
      'status',
      'category',
      eb.fn.countAll<number>().as('n'),
    ])
    .where('status', 'in', ['active', 'on_notice', 'onboarding'])
    .groupBy(['status', 'category']);
  if (companyId !== undefined) {
    q = q.where('company_id', '=', companyId);
  }
  const rows = await q.execute();
  return rows.map((r) => ({
    status: r.status,
    category: r.category,
    count: r.n,
  }));
}
