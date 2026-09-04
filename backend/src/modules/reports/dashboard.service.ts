/**
 * ESS + HR Ops home payloads (docs/05 §4.1 / §4.9) — real queries, never fake KPIs.
 */
import { sql, type Kysely } from 'kysely';
import type { Database, DayStatus } from '../../core/db/types.js';
import { formatDbDate, istDateString } from '../../core/dates.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import { getTypedSetting } from '../settings/index.js';
import { policyAckStatus } from '../policies/index.js';
import { getBalances } from '../leave/index.js';
import { resolveDay } from '../attendance/index.js';

interface CalendarSessionStatus {
  session: number;
  status: 'P' | 'A';
}

function calendarSessionStatuses(value: unknown): CalendarSessionStatus[] | null {
  if (!Array.isArray(value)) return null;
  const sessions: CalendarSessionStatus[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const row = item as Record<string, unknown>;
    if ((row['session'] !== 1 && row['session'] !== 2) || (row['status'] !== 'P' && row['status'] !== 'A')) {
      return null;
    }
    sessions.push({ session: row['session'], status: row['status'] });
  }
  return sessions.length === 2 ? sessions : null;
}

export async function hrOpsDashboard(
  db: Kysely<Database>,
  companyId?: number,
  scope?: EmployeeScope,
) {
  const today = istDateString();
  const monthStart = `${today.slice(0, 7)}-01`;

  let empQ = db
    .selectFrom('core.employees as e')
    .select((eb) => ['e.category as category', eb.fn.countAll<number>().as('n')])
    .where('e.status', 'in', ['active', 'on_notice'])
    .where(employeeScopeSql(scope, 'e'))
    .groupBy('e.category');
  if (companyId !== undefined) empQ = empQ.where('e.company_id', '=', companyId);
  const byCategory = await empQ.execute();

  let joinQ = db
    .selectFrom('core.employees as e')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('e.doj', '>=', sql<Date>`${monthStart}::date`)
    .where('e.doj', '<=', sql<Date>`${today}::date`)
    .where(employeeScopeSql(scope, 'e'));
  if (companyId !== undefined) joinQ = joinQ.where('e.company_id', '=', companyId);
  const joinersMtd = (await joinQ.executeTakeFirstOrThrow()).n;

  let exitQ = db
    .selectFrom('core.employees as e')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('e.dol', '>=', sql<Date>`${monthStart}::date`)
    .where('e.dol', '<=', sql<Date>`${today}::date`)
    .where(employeeScopeSql(scope, 'e'));
  if (companyId !== undefined) exitQ = exitQ.where('e.company_id', '=', companyId);
  const exitsMtd = (await exitQ.executeTakeFirstOrThrow()).n;

  let absentQ = db
    .selectFrom('att.day_records as d')
    .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('d.work_date', '=', sql<Date>`${today}::date`)
    .where('d.status', 'in', ['A', 'UAB'])
    .where(employeeScopeSql(scope, 'e'));
  if (companyId !== undefined) absentQ = absentQ.where('e.company_id', '=', companyId);
  const absentToday = (await absentQ.executeTakeFirstOrThrow()).n;

  let pendingApprovalsQuery = db
      .selectFrom('wf.request_steps as step')
      .innerJoin('wf.requests as request', 'request.id', 'step.request_id')
      .innerJoin('core.employees as employee', 'employee.id', 'request.subject_employee_id')
      .select(({ fn }) => fn.countAll<number>().as('n'))
      .where('step.action', 'is', null)
      .where(employeeScopeSql(scope, 'employee'));
  if (companyId !== undefined) {
    pendingApprovalsQuery = pendingApprovalsQuery.where('employee.company_id', '=', companyId);
  }
  const pendingApprovals = (await pendingApprovalsQuery.executeTakeFirstOrThrow()).n;

  let openAbsenceQuery = db
    .selectFrom('att.absence_cases as absence')
    .innerJoin('core.employees as employee', 'employee.id', 'absence.employee_id')
    .select((eb) => ['absence.stage', eb.fn.countAll<number>().as('n')])
    .where('absence.closed_at', 'is', null)
    .where(employeeScopeSql(scope, 'employee'))
    .groupBy('absence.stage');
  if (companyId !== undefined) {
    openAbsenceQuery = openAbsenceQuery.where('employee.company_id', '=', companyId);
  }
  const openAbsence = await openAbsenceQuery.execute();

  let pendingOtQuery = db
      .selectFrom('att.overtime_entries as overtime')
      .innerJoin('core.employees as employee', 'employee.id', 'overtime.employee_id')
      .select(({ fn }) => fn.countAll<number>().as('n'))
      .where('overtime.status', '=', 'pending')
      .where(employeeScopeSql(scope, 'employee'));
  if (companyId !== undefined) {
    pendingOtQuery = pendingOtQuery.where('employee.company_id', '=', companyId);
  }
  const pendingOt = (await pendingOtQuery.executeTakeFirstOrThrow()).n;

  const silentMinutes = await getTypedSetting(db, 'att.device_silent_minutes', 'number', 15);
  const cutoff = new Date(Date.now() - silentMinutes * 60_000);
  let silentDevicesQuery = db
      .selectFrom('att.devices as device')
      .leftJoin('core.locations as location', 'location.id', 'device.location_id')
      .select(({ fn }) => fn.countAll<number>().as('n'))
      .where('device.is_active', '=', true)
      .where((eb) =>
        eb.or([eb('device.last_seen_at', 'is', null), eb('device.last_seen_at', '<', cutoff)]),
      )
      .$if(scope !== undefined && !scope.all, (query) =>
        query.where(sql<boolean>`EXISTS (
          SELECT 1
            FROM core.employees scoped_employee
           WHERE scoped_employee.location_id = device.location_id
             AND ${employeeScopeSql(scope, 'scoped_employee')}
        )`),
      );
  if (companyId !== undefined) {
    silentDevicesQuery = silentDevicesQuery.where('location.company_id', '=', companyId);
  }
  const silentDevices = (await silentDevicesQuery.executeTakeFirstOrThrow()).n;

  // Overall ack % = acked/targeted across every live policy (audience-aware;
  // company scoping folds in when policies grow a company dimension).
  const perPolicy = await policyAckStatus(db, scope);
  const ackTotals = perPolicy.reduce((acc, p) => ({ targeted: acc.targeted + p.targeted, acked: acc.acked + p.acknowledged }), { targeted: 0, acked: 0 });
  const policyAck = { percent: ackTotals.targeted === 0 ? 100 : Math.round((ackTotals.acked / ackTotals.targeted) * 100) };

  return {
    asOf: today,
    headcountByCategory: byCategory.map((r) => ({ category: r.category, count: r.n })),
    joinersMtd,
    exitsMtd,
    absentToday,
    pendingApprovals,
    openAbsenceByStage: openAbsence.map((r) => ({ stage: r.stage, count: r.n })),
    pendingOt,
    silentDevices,
    policyAckPercent: policyAck.percent,
  };
}

export async function essHome(db: Kysely<Database>, employeeId: number) {
  const today = istDateString();
  const emp = await db
    .selectFrom('core.employees')
    .select(['first_name', 'last_name', 'ecode'])
    .where('id', '=', employeeId)
    .executeTakeFirstOrThrow();

  const day = await db
    .selectFrom('att.day_records')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .where('work_date', '=', sql<Date>`${today}::date`)
    .executeTakeFirst();

  const resolvedToday = await resolveDay(db, employeeId, today);
  const shift = resolvedToday.shift;

  const balanceRows = await getBalances(db, employeeId);
  const balances = balanceRows.map((row) => ({
    leaveTypeId: row.type.id,
    code: row.type.code,
    name: row.type.name,
    balance: row.balance,
    available: row.available,
    isPaid: row.type.is_paid,
  }));
  const pendingRequests = (
    await db
      .selectFrom('wf.requests')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('subject_employee_id', '=', employeeId)
      .where('status', 'in', ['pending', 'sent_back'])
      .executeTakeFirstOrThrow()
  ).n;

  return {
    greetingName: emp.first_name,
    ecode: emp.ecode,
    today,
    shift: shift
      ? {
          code: shift.code,
          name: shift.name,
          startTime: shift.start_time.slice(0, 5),
          endTime: shift.end_time.slice(0, 5),
        }
      : null,
    todayStatus: day
      ? {
          status: day.status,
          firstIn: day.first_in?.toISOString() ?? null,
          lastOut: day.last_out?.toISOString() ?? null,
        }
      : null,
    leaveBalances: balances,
    pendingRequests,
  };
}

/** ESS month calendar cells for My Attendance. */
export async function myAttendanceMonth(
  db: Kysely<Database>,
  employeeId: number,
  month: string,
) {
  const m = month.length === 7 ? `${month}-01` : month;
  const [y = 0, mo = 0] = m.split('-').map(Number);
  const mEnd =
    mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  const rows = await db
    .selectFrom('att.day_records')
    .select([
      'work_date',
      'status',
      'scheme_code',
      'first_in',
      'last_out',
      'worked_minutes',
      'ot_minutes',
      'late_minutes',
      'early_exit_minutes',
      'session_statuses',
    ])
    .where('employee_id', '=', employeeId)
    .where('work_date', '>=', sql<Date>`${m}::date`)
    .where('work_date', '<', sql<Date>`${mEnd}::date`)
    .orderBy('work_date')
    .execute();
  return rows.map((r) => ({
    date: formatDbDate(r.work_date),
    status: r.status,
    scheme: r.scheme_code,
    firstIn: r.first_in?.toISOString() ?? null,
    lastOut: r.last_out?.toISOString() ?? null,
    workedMinutes: r.worked_minutes,
    otMinutes: r.ot_minutes,
    lateMinutes: r.late_minutes,
    earlyExitMinutes: r.early_exit_minutes,
    sessionStatuses: calendarSessionStatuses(r.session_statuses),
  }));
}

/** Manager team month grid. */
export async function teamMonthGrid(
  db: Kysely<Database>,
  managerEmployeeId: number,
  month: string,
  subtree: boolean,
  scope?: EmployeeScope,
) {
  const m = month.length === 7 ? `${month}-01` : month;
  const [y = 0, mo = 0] = m.split('-').map(Number);
  const mEnd =
    mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;

  let teamIds: number[];
  if (subtree) {
    const tree = await db
      .selectFrom('core.reporting_tree')
      .select('employee_id')
      .where('manager_id', '=', managerEmployeeId)
      .execute();
    teamIds = tree.map((t) => t.employee_id);
  } else {
    const directs = await db
      .selectFrom('core.employees')
      .select('id')
      .where('reporting_manager_id', '=', managerEmployeeId)
      .where('status', 'in', ['active', 'on_notice'])
      .execute();
    teamIds = directs.map((d) => d.id);
  }
  if (teamIds.length === 0) return [];

  const emps = await db
    .selectFrom('core.employees as e')
    .select(['e.id', 'e.ecode', 'e.first_name', 'e.last_name'])
    .where('e.id', 'in', teamIds)
    .where('e.status', 'in', ['active', 'on_notice'])
    .where(employeeScopeSql(scope, 'e'))
    .execute();

  const days = await db
    .selectFrom('att.day_records')
    .select(['employee_id', 'work_date', 'status', 'first_in', 'last_out'])
    .where('employee_id', 'in', teamIds)
    .where('work_date', '>=', sql<Date>`${m}::date`)
    .where('work_date', '<', sql<Date>`${mEnd}::date`)
    .execute();

  return emps.map((e) => {
    const myDays = days.filter((d) => d.employee_id === e.id);
    const dayStatuses: Record<string, { status: DayStatus; firstIn: string | null; lastOut: string | null }> = {};
    for (const d of myDays) {
      dayStatuses[formatDbDate(d.work_date)] = {
        status: d.status,
        firstIn: d.first_in?.toISOString() ?? null,
        lastOut: d.last_out?.toISOString() ?? null,
      };
    }
    return {
      employeeId: e.id,
      ecode: e.ecode,
      name: e.last_name ? `${e.first_name} ${e.last_name}` : e.first_name,
      days: dayStatuses,
    };
  });
}

/**
 * Business-Unit dashboard (docs/06 §5, RPT-04) — the plant/BU head's landing.
 *
 * Content is exactly what §5 names: headcount, absenteeism, OT, joiners/exits
 * and absence cases, **scoped to their org unit**. A plant head must not see
 * another plant's numbers, so the scope is applied to every query rather than
 * filtered in the UI.
 *
 * Trends come from `reporting.kpi_daily` (precomputed) — this endpoint does the
 * "today" counts live because they are single-day and indexed, but never a
 * multi-month scan (CLAUDE.md §1.9).
 */
export interface BusinessUnitDashboard {
  scopeLabel: string;
  headcount: { category: string; count: number }[];
  headcountTotal: number;
  absentToday: number;
  scheduledToday: number;
  absenteeismTodayPct: number | null;
  otHoursMtd: number;
  joinersMtd: number;
  exitsMtd: number;
  openAbsenceCases: { stage: string; count: number }[];
}

export async function businessUnitDashboard(
  db: Kysely<Database>,
  filters: {
    companyId?: number | undefined;
    locationId?: number | undefined;
    scope?: EmployeeScope | undefined;
  },
): Promise<BusinessUnitDashboard> {
  const today = istDateString();
  const monthStart = `${today.slice(0, 7)}-01`;

  const headcountRows = await db
    .selectFrom('core.employees as e')
    .select((eb) => ['e.category as category', eb.fn.countAll<string>().as('n')])
    .where('e.status', 'in', ['active', 'on_notice'])
    .where(employeeScopeSql(filters.scope, 'e'))
    .$if(filters.companyId !== undefined, (qb) => qb.where('e.company_id', '=', filters.companyId ?? 0))
    .$if(filters.locationId !== undefined, (qb) => qb.where('e.location_id', '=', filters.locationId ?? 0))
    .groupBy('e.category')
    .orderBy('e.category')
    .execute();

  const headcount = headcountRows.map((r) => ({
    category: r.category ?? 'unspecified',
    count: Number(r.n),
  }));
  const headcountTotal = headcount.reduce((sum, r) => sum + r.count, 0);

  const dayRow = await db
    .selectFrom('att.day_records as d')
    .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
    .select(sql<string>`COUNT(*) FILTER (WHERE d.status IN ('A','UAB'))`.as('absent'))
    .select(sql<string>`COUNT(*) FILTER (WHERE d.status NOT IN ('WO','H'))`.as('scheduled'))
    .where('d.work_date', '=', sql<Date>`${today}::date`)
    .where(employeeScopeSql(filters.scope, 'e'))
    .$if(filters.companyId !== undefined, (qb) => qb.where('e.company_id', '=', filters.companyId ?? 0))
    .$if(filters.locationId !== undefined, (qb) => qb.where('e.location_id', '=', filters.locationId ?? 0))
    .executeTakeFirst();

  const absentToday = Number(dayRow?.absent ?? 0);
  const scheduledToday = Number(dayRow?.scheduled ?? 0);

  const otRow = await db
    .selectFrom('att.overtime_entries as o')
    .innerJoin('core.employees as e', 'e.id', 'o.employee_id')
    .select(sql<string>`COALESCE(SUM(o.approved_minutes), 0)`.as('minutes'))
    .where('o.work_date', '>=', sql<Date>`${monthStart}::date`)
    .where('o.work_date', '<=', sql<Date>`${today}::date`)
    .where('o.status', '=', 'approved')
    .where(employeeScopeSql(filters.scope, 'e'))
    .$if(filters.companyId !== undefined, (qb) => qb.where('e.company_id', '=', filters.companyId ?? 0))
    .$if(filters.locationId !== undefined, (qb) => qb.where('e.location_id', '=', filters.locationId ?? 0))
    .executeTakeFirst();

  const movement = await db
    .selectFrom('core.employees as e')
    .select(
      sql<string>`COUNT(*) FILTER (WHERE e.doj >= ${monthStart}::date AND e.doj <= ${today}::date)`.as(
        'joiners',
      ),
    )
    .select(
      sql<string>`COUNT(*) FILTER (WHERE e.dol >= ${monthStart}::date AND e.dol <= ${today}::date)`.as(
        'exits',
      ),
    )
    .where(employeeScopeSql(filters.scope, 'e'))
    .$if(filters.companyId !== undefined, (qb) => qb.where('e.company_id', '=', filters.companyId ?? 0))
    .$if(filters.locationId !== undefined, (qb) => qb.where('e.location_id', '=', filters.locationId ?? 0))
    .executeTakeFirst();

  const cases = await db
    .selectFrom('att.absence_cases as c')
    .innerJoin('core.employees as e', 'e.id', 'c.employee_id')
    .select((eb) => ['c.stage as stage', eb.fn.countAll<string>().as('n')])
    .where('c.closed_at', 'is', null)
    .where(employeeScopeSql(filters.scope, 'e'))
    .$if(filters.companyId !== undefined, (qb) => qb.where('e.company_id', '=', filters.companyId ?? 0))
    .$if(filters.locationId !== undefined, (qb) => qb.where('e.location_id', '=', filters.locationId ?? 0))
    .groupBy('c.stage')
    .execute();

  const scopeLabel =
    filters.locationId !== undefined
      ? `Location #${String(filters.locationId)}`
      : filters.companyId !== undefined
        ? `Entity #${String(filters.companyId)}`
        : filters.scope !== undefined && !filters.scope.all
          ? 'Your permitted scope'
          : 'All entities';

  return {
    scopeLabel,
    headcount,
    headcountTotal,
    absentToday,
    scheduledToday,
    // Absence with no scheduled days is NOT 0% — it is unmeasured.
    absenteeismTodayPct: scheduledToday === 0 ? null : (absentToday / scheduledToday) * 100,
    otHoursMtd: Number(otRow?.minutes ?? 0) / 60,
    joinersMtd: Number(movement?.joiners ?? 0),
    exitsMtd: Number(movement?.exits ?? 0),
    openAbsenceCases: cases.map((c) => ({ stage: c.stage, count: Number(c.n) })),
  };
}
