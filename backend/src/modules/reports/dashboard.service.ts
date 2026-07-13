/**
 * ESS + HR Ops home payloads (docs/05 §4.1 / §4.9) — real queries, never fake KPIs.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';
import { policyAckStatus } from '../policies/index.js';
import { getBalances } from '../leave/index.js';

export async function hrOpsDashboard(db: Kysely<Database>, companyId?: number) {
  const today = istDateString();
  const monthStart = `${today.slice(0, 7)}-01`;

  let empQ = db
    .selectFrom('core.employees')
    .select((eb) => ['category', eb.fn.countAll<number>().as('n')])
    .where('status', 'in', ['active', 'on_notice'])
    .groupBy('category');
  if (companyId !== undefined) empQ = empQ.where('company_id', '=', companyId);
  const byCategory = await empQ.execute();

  let joinQ = db
    .selectFrom('core.employees')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('doj', '>=', sql<Date>`${monthStart}::date`)
    .where('doj', '<=', sql<Date>`${today}::date`);
  if (companyId !== undefined) joinQ = joinQ.where('company_id', '=', companyId);
  const joinersMtd = (await joinQ.executeTakeFirstOrThrow()).n;

  let exitQ = db
    .selectFrom('core.employees')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('dol', '>=', sql<Date>`${monthStart}::date`)
    .where('dol', '<=', sql<Date>`${today}::date`);
  if (companyId !== undefined) exitQ = exitQ.where('company_id', '=', companyId);
  const exitsMtd = (await exitQ.executeTakeFirstOrThrow()).n;

  let absentQ = db
    .selectFrom('att.day_records as d')
    .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .where('d.work_date', '=', sql<Date>`${today}::date`)
    .where('d.status', 'in', ['A', 'UAB']);
  if (companyId !== undefined) absentQ = absentQ.where('e.company_id', '=', companyId);
  const absentToday = (await absentQ.executeTakeFirstOrThrow()).n;

  let pendingApprovalsQuery = db
      .selectFrom('wf.request_steps as step')
      .innerJoin('wf.requests as request', 'request.id', 'step.request_id')
      .innerJoin('core.employees as employee', 'employee.id', 'request.subject_employee_id')
      .select(({ fn }) => fn.countAll<number>().as('n'))
      .where('step.action', 'is', null);
  if (companyId !== undefined) {
    pendingApprovalsQuery = pendingApprovalsQuery.where('employee.company_id', '=', companyId);
  }
  const pendingApprovals = (await pendingApprovalsQuery.executeTakeFirstOrThrow()).n;

  let openAbsenceQuery = db
    .selectFrom('att.absence_cases as absence')
    .innerJoin('core.employees as employee', 'employee.id', 'absence.employee_id')
    .select((eb) => ['absence.stage', eb.fn.countAll<number>().as('n')])
    .where('absence.closed_at', 'is', null)
    .groupBy('absence.stage');
  if (companyId !== undefined) {
    openAbsenceQuery = openAbsenceQuery.where('employee.company_id', '=', companyId);
  }
  const openAbsence = await openAbsenceQuery.execute();

  let pendingOtQuery = db
      .selectFrom('att.overtime_entries as overtime')
      .innerJoin('core.employees as employee', 'employee.id', 'overtime.employee_id')
      .select(({ fn }) => fn.countAll<number>().as('n'))
      .where('overtime.status', '=', 'pending');
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
      );
  if (companyId !== undefined) {
    silentDevicesQuery = silentDevicesQuery.where('location.company_id', '=', companyId);
  }
  const silentDevices = (await silentDevicesQuery.executeTakeFirstOrThrow()).n;

  // Overall ack % = acked/targeted across every live policy (audience-aware;
  // company scoping folds in when policies grow a company dimension).
  const perPolicy = await policyAckStatus(db);
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

  const scheme = await db
    .selectFrom('att.employee_shifts as es')
    .innerJoin('att.shifts as s', 's.id', 'es.weekday_shift_id')
    .select(['s.code', 's.name', 's.start_time', 's.end_time'])
    .where('es.employee_id', '=', employeeId)
    .executeTakeFirst();

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
      .select(({ fn }) => fn.countAll<number>().as('n'))
      .where('subject_employee_id', '=', employeeId)
      .where('status', 'in', ['pending', 'sent_back'])
      .executeTakeFirstOrThrow()
  ).n;

  return {
    greetingName: emp.first_name,
    ecode: emp.ecode,
    today,
    shift: scheme
      ? {
          code: scheme.code,
          name: scheme.name,
          startTime: scheme.start_time.slice(0, 5),
          endTime: scheme.end_time.slice(0, 5),
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
    .select(['work_date', 'status', 'first_in', 'last_out', 'ot_minutes', 'late_minutes'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '>=', sql<Date>`${m}::date`)
    .where('work_date', '<', sql<Date>`${mEnd}::date`)
    .orderBy('work_date')
    .execute();
  return rows.map((r) => ({
    date: formatDbDate(r.work_date),
    status: r.status,
    firstIn: r.first_in?.toISOString() ?? null,
    lastOut: r.last_out?.toISOString() ?? null,
    otMinutes: r.ot_minutes,
    lateMinutes: r.late_minutes,
  }));
}

/** Manager team month grid. */
export async function teamMonthGrid(
  db: Kysely<Database>,
  managerEmployeeId: number,
  month: string,
  subtree: boolean,
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
    .selectFrom('core.employees')
    .select(['id', 'ecode', 'first_name', 'last_name'])
    .where('id', 'in', teamIds)
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
    const dayStatuses: Record<string, { status: string; firstIn: string | null; lastOut: string | null }> = {};
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
