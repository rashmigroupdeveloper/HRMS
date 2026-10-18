/**
 * Attendance configuration surface (Stage 1.2) — the sponsor's centralization
 * rule made concrete: shifts, schemes, rosters and holidays are ALL runtime
 * data behind the central permission gates. Nothing here requires a deploy.
 *   shifts            → admin.settings           (policy config)
 *   holidays GET      → attendance.own            (ESS calendar — ATT-13 / P1-T43)
 *   holidays PUT      → admin.settings           (policy config)
 *   schemes/rosters   → attendance.roster.write   (managers — ATT-04)
 *   manual override   → attendance.manual_override (HR only, reason + audit — ATT-17)
 *   recompute/week ops→ admin.integrations
 *   day records read  → attendance.team.read
 */
import { ORPCError } from '@orpc/server';
import { sql } from 'kysely';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { booleanQuery } from '../../api/zod.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { holidayAppliesSql, loadHolidaySubject, resolveHolidayScope, upsertScopedHoliday } from '../../core/db/holiday-calendar.js';
import { assertCompanyInScope } from '../../core/rbac/company-scope.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import {
  closeWeek,
  drainRecomputeQueue,
  recomputeDay,
  setManualStatus,
} from './day-status.service.js';
import { applyRosterEntries } from './roster.service.js';
import { assignEmployeeScheme } from './scheme.service.js';
import { AttendanceMutationError } from './attendance-mutation.js';
import { readSessionStatuses, sessionStatusesSchema, validateSessionSummary } from './session-status.js';

const isoDate = z.string().date('YYYY-MM-DD');

function attendanceError(error: unknown): never {
  if (error instanceof AttendanceMutationError) throw new ORPCError(error.code, { message: error.message });
  throw error;
}

const shiftShape = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  crossesMidnight: z.boolean().default(false),
  sessionSplit: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  graceInMinutes: z.number().int().min(0).max(120).default(0),
  graceOutMinutes: z.number().int().min(0).max(120).default(0),
  minHalfDayHours: z.number().min(0).max(12),
  minFullDayHours: z.number().min(0).max(16),
  breakMinutes: z.number().int().min(0).max(180).default(0),
  isActive: z.boolean().default(true),
});

function mapShiftRow(r: {
  id: number;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  session_split: string | null;
  grace_in_minutes: number;
  grace_out_minutes: number;
  min_half_day_hours: string;
  min_full_day_hours: string;
  break_minutes: number;
  is_active: boolean;
}) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    crossesMidnight: r.crosses_midnight,
    sessionSplit: r.session_split?.slice(0, 5) ?? null,
    graceInMinutes: r.grace_in_minutes,
    graceOutMinutes: r.grace_out_minutes,
    minHalfDayHours: Number(r.min_half_day_hours),
    minFullDayHours: Number(r.min_full_day_hours),
    breakMinutes: r.break_minutes,
    isActive: r.is_active,
  };
}

const listShifts = withPermission('admin.settings')
  .route({ method: 'GET', path: '/attendance/config/shifts', summary: 'Shift catalog (admin full)' })
  .output(z.array(shiftShape.extend({ id: z.number() })))
  .handler(async ({ context }) => {
    const rows = await context.db.selectFrom('att.shifts').selectAll().orderBy('code').execute();
    return rows.map(mapShiftRow);
  });

/** Manager-readable active shift catalog for roster editing (P1-T42). */
const listShiftsForRoster = withPermission('attendance.roster.write')
  .route({
    method: 'GET',
    path: '/attendance/config/shifts/active',
    summary: 'Active shifts for roster editors (ATT-04 manager surface)',
  })
  .output(
    z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        crossesMidnight: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await context.db
      .selectFrom('att.shifts')
      .selectAll()
      .where('is_active', '=', true)
      .orderBy('code')
      .execute();
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      startTime: r.start_time.slice(0, 5),
      endTime: r.end_time.slice(0, 5),
      crossesMidnight: r.crosses_midnight,
    }));
  });

const upsertShift = withPermission('admin.settings')
  .route({ method: 'PUT', path: '/attendance/config/shifts/{code}', summary: 'Create/update a shift (audited)' })
  .input(shiftShape)
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const values = {
      code: input.code,
      name: input.name,
      start_time: input.startTime,
      end_time: input.endTime,
      crosses_midnight: input.crossesMidnight,
      session_split: input.sessionSplit ?? null,
      grace_in_minutes: input.graceInMinutes,
      grace_out_minutes: input.graceOutMinutes,
      min_half_day_hours: String(input.minHalfDayHours),
      min_full_day_hours: String(input.minFullDayHours),
      break_minutes: input.breakMinutes,
      is_active: input.isActive,
    };
    await context.db
      .insertInto('att.shifts')
      .values(values)
      .onConflict((oc) => oc.column('code').doUpdateSet(values))
      .execute();
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'update',
      entity: 'att.shifts',
      field: input.code,
      newValue: JSON.stringify(input),
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

const holidayRow = z.object({
  date: z.string(),
  name: z.string(),
  companyId: z.number().nullable(),
  plantId: z.number().nullable(),
  locationId: z.number().nullable(),
});

const listHolidays = withPermission('attendance.own')
  .route({ method: 'GET', path: '/attendance/config/holidays', summary: 'Holiday calendar (ESS-readable; group, company, plant or location scope)' })
  .input(z.object({
    year: z.coerce.number().int().optional(),
    companyId: z.coerce.number().int().positive().optional(),
    /** Only the holidays that apply to the caller's own company / plant / location (ESS calendar). */
    mine: booleanQuery().optional(),
  }).optional())
  .output(z.array(holidayRow))
  .handler(async ({ input, context }) => {
    let q = context.db.selectFrom('att.holidays').selectAll().orderBy('holiday_date').orderBy('id');
    if (input?.year) {
      q = q
        .where('holiday_date', '>=', sql<Date>`${`${String(input.year)}-01-01`}::date`)
        .where('holiday_date', '<=', sql<Date>`${`${String(input.year)}-12-31`}::date`);
    }
    if (input?.companyId) {
      const companyId = input.companyId;
      q = q.where((eb) => eb.or([eb('company_id', 'is', null), eb('company_id', '=', companyId)]));
    }
    if (input?.mine) {
      const employeeId = context.user.employee_id;
      if (employeeId === null) return [];
      q = q.where(holidayAppliesSql('att.holidays', await loadHolidaySubject(context.db, employeeId)));
    }
    const rows = await q.execute();
    return rows.map((r) => ({
      date: formatDbDate(r.holiday_date),
      name: r.name,
      companyId: r.company_id,
      plantId: r.plant_id,
      locationId: r.location_id,
    }));
  });

const upsertHoliday = withPermission('admin.settings')
  .route({ method: 'PUT', path: '/attendance/config/holidays', summary: 'Add/update a holiday for the group, a company, a plant or a location (audited)' })
  .input(z.object({
    date: isoDate,
    name: z.string().trim().min(1).max(120),
    companyId: z.number().int().positive().nullish(),
    plantId: z.number().int().positive().nullish(),
    locationId: z.number().int().positive().nullish(),
  }))
  .output(z.object({ ok: z.literal(true), created: z.boolean() }))
  .handler(async ({ input, context }) => {
    let scope;
    try {
      scope = await resolveHolidayScope(context.db, input);
    } catch (error) {
      throw new ORPCError('BAD_REQUEST', { message: error instanceof Error ? error.message : 'Invalid holiday scope' });
    }
    const access = { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
    if (scope.company_id === null) {
      if (!access.all) throw new ORPCError('FORBIDDEN', { message: 'Only a group-level admin can add a holiday for the whole group; choose a company' });
    } else {
      await assertCompanyInScope(context.db, access, scope.company_id);
    }
    const created = await upsertScopedHoliday(context.db, scope, input.date, input.name);
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'update',
      entity: 'att.holidays',
      field: input.date,
      newValue: JSON.stringify({ name: input.name, ...scope }),
      ip: context.req.ip ?? null,
    });
    return { ok: true as const, created };
  });

const setScheme = withPermission('attendance.roster.write')
  .route({ method: 'PUT', path: '/attendance/config/schemes/{employeeId}', summary: 'Assign weekday/Saturday shifts to an employee' })
  .input(
    z.object({
      employeeId: z.coerce.number().int().positive(),
      weekdayShiftCode: z.string().min(1),
      saturdayShiftCode: z.string().min(1).nullish(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      await assignEmployeeScheme(context.db, { ...input, actorUserId: context.user.id,
        scope: { ...context.permissionAccess, actorEmployeeId: context.user.employee_id } });
    } catch (error) { attendanceError(error); }
    return { ok: true as const };
  });

const monthStr = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/);

/** Team roster month grid for managers (P1-T42). */
const getTeamRoster = withPermission('attendance.roster.write')
  .route({
    method: 'GET',
    path: '/attendance/roster',
    summary: 'Team roster for a month (manager-maintained — ATT-04)',
  })
  .input(
    z.object({
      month: monthStr,
      subtree: booleanQuery().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        employeeId: z.number(),
        ecode: z.string(),
        name: z.string(),
        days: z.record(
          z.object({
            shiftCode: z.string().nullable(),
            weekOff: z.boolean(),
          }),
        ),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const managerId = context.user.employee_id;
    if (managerId === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
    }
    const month = input.month.length === 7 ? `${input.month}-01` : input.month;
    const [y = 0, mo = 1] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const monthEnd = `${y}-${String(mo).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    let teamQuery = context.db
      .selectFrom('core.employees as e')
      .select(['e.id', 'e.ecode', 'e.first_name', 'e.last_name'])
      .where('e.status', 'in', ['active', 'on_notice']);

    if (input.subtree === true) {
      teamQuery = teamQuery.where(
        'e.id',
        'in',
        sql<number>`(SELECT rt.employee_id FROM core.reporting_tree rt WHERE rt.manager_id = ${managerId})`,
      );
    } else {
      teamQuery = teamQuery.where('e.reporting_manager_id', '=', managerId);
    }

    const team = await teamQuery.orderBy('e.ecode').execute();
    if (team.length === 0) return [];

    const ids = team.map((t) => t.id);
    const rosterRows = await context.db
      .selectFrom('att.rosters as r')
      .leftJoin('att.shifts as s', 's.id', 'r.shift_id')
      .select(['r.employee_id', 'r.work_date', 'r.is_week_off', 's.code as shift_code'])
      .where('r.employee_id', 'in', ids)
      .where('r.work_date', '>=', sql<Date>`${month}::date`)
      .where('r.work_date', '<=', sql<Date>`${monthEnd}::date`)
      .execute();

    const byEmp = new Map<number, Record<string, { shiftCode: string | null; weekOff: boolean }>>();
    for (const row of rosterRows) {
      const date = formatDbDate(row.work_date);
      const bucket = byEmp.get(row.employee_id) ?? {};
      bucket[date] = {
        shiftCode: row.shift_code,
        weekOff: row.is_week_off,
      };
      byEmp.set(row.employee_id, bucket);
    }

    return team.map((member) => ({
      employeeId: member.id,
      ecode: member.ecode,
      name: member.last_name ? `${member.first_name} ${member.last_name}` : member.first_name,
      days: byEmp.get(member.id) ?? {},
    }));
  });

const setRoster = withPermission('attendance.roster.write')
  .route({ method: 'PUT', path: '/attendance/roster', summary: 'Set roster days (bulk; manager-maintained — ATT-04)' })
  .input(
    z.object({
      entries: z
        .array(
          z.object({
            employeeId: z.number().int().positive(),
            date: isoDate,
            shiftCode: z.string().min(1).nullish(), // null + weekOff=true = week-off
            weekOff: z.boolean().default(false),
          }),
        )
        .min(1)
        .max(500),
    }),
  )
  .output(z.object({ upserted: z.number() }))
  .handler(async ({ input, context }) => {
    const db = context.db;
    try {
      await assertEmployeesInScope(
        db,
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
        input.entries.map((entry) => entry.employeeId),
      );
    } catch (error) {
      throw new ORPCError('FORBIDDEN', {
        message: error instanceof Error ? error.message : 'Employee outside permitted scope',
      });
    }

    const requestedCodes = [
      ...new Set(
        input.entries
          .filter((entry) => !entry.weekOff)
          .map((entry) => entry.shiftCode)
          .filter((code): code is string => code !== null && code !== undefined),
      ),
    ];
    const shifts = requestedCodes.length === 0
      ? []
      : await db
          .selectFrom('att.shifts')
          .select(['id', 'code'])
          .where('code', 'in', requestedCodes)
          .where('is_active', '=', true)
          .execute();
    const shiftIds = new Map(shifts.map((shift) => [shift.code, shift.id]));
    const missing = requestedCodes.find((code) => !shiftIds.has(code));
    if (missing !== undefined) {
      throw new ORPCError('NOT_FOUND', { message: `Unknown or inactive shift: ${missing}` });
    }

    const entries = input.entries.map((entry) => {
      if (!entry.weekOff && !entry.shiftCode) {
        throw new ORPCError('BAD_REQUEST', { message: 'shiftCode required unless weekOff' });
      }
      return {
        employeeId: entry.employeeId,
        date: entry.date,
        shiftId: entry.weekOff ? null : (shiftIds.get(entry.shiftCode ?? '') ?? null),
        weekOff: entry.weekOff,
      };
    });
    const upserted = await applyRosterEntries(db, {
      actorUserId: context.user.id,
      entries,
      scope: { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
      ip: context.req.ip ?? null,
    });
    return { upserted };
  });

const dayRecords = withPermission('attendance.team.read')
  .route({ method: 'GET', path: '/attendance/days', summary: 'Processed day records for a range' })
  .input(z.object({ employeeId: z.coerce.number().int().positive(), from: isoDate, to: isoDate }))
  .output(
    z.array(
      z.object({
        date: z.string(),
        status: z.string(),
        scheme: z.string().nullable(),
        firstIn: z.string().nullable(),
        lastOut: z.string().nullable(),
        workedMinutes: z.number().nullable(),
        lateMinutes: z.number(),
        earlyExitMinutes: z.number(),
        sessionStatuses: sessionStatusesSchema.nullable(),
        weekoffPaid: z.boolean().nullable(),
        source: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    try { await assertEmployeesInScope(context.db,
      { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, [input.employeeId]); }
    catch { throw new ORPCError('FORBIDDEN', { message: 'Employee outside your permitted data scope' }); }

    const rows = await context.db
      .selectFrom('att.day_records')
      .selectAll()
      .where('employee_id', '=', input.employeeId)
      .where('work_date', '>=', sql<Date>`${input.from}::date`)
      .where('work_date', '<=', sql<Date>`${input.to}::date`)
      .orderBy('work_date')
      .execute();
    return rows.map((r) => ({
      date: formatDbDate(r.work_date),
      status: r.status,
      scheme: r.scheme_code,
      firstIn: r.first_in?.toISOString() ?? null,
      lastOut: r.last_out?.toISOString() ?? null,
      workedMinutes: r.worked_minutes,
      lateMinutes: r.late_minutes,
      earlyExitMinutes: r.early_exit_minutes,
      sessionStatuses: readSessionStatuses(r.session_statuses),
      weekoffPaid: r.weekoff_paid,
      source: r.source,
    }));
  });

const overrideDay = withPermission('attendance.manual_override')
  .route({ method: 'PUT', path: '/attendance/days/override', summary: 'HR manual override — reason mandatory, audited (ATT-17)' })
  .input(
    z.object({
      employeeId: z.number().int().positive(),
      date: isoDate,
      status: z.enum(['P', 'A', 'HD', 'WO', 'H', 'UAB']),
      sessionStatuses: sessionStatusesSchema.nullish(),
      reason: z.string().trim().min(5, 'A meaningful reason is mandatory'),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      validateSessionSummary(input.status, input.sessionStatuses ?? null);
    } catch (error) {
      throw new ORPCError('BAD_REQUEST', { message: error instanceof Error ? error.message : 'Invalid session results' });
    }
    try {
      await setManualStatus(context.db, {
        employeeId: input.employeeId, isoDate: input.date, status: input.status,
        sessionStatuses: input.sessionStatuses ?? null, reason: input.reason, actorUserId: context.user.id,
        scope: { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
      });
    } catch (error) { attendanceError(error); }
    return { ok: true as const };
  });

const recompute = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/attendance/recompute', summary: 'Recompute a day or drain the dirty queue' })
  .input(z.object({ employeeId: z.number().int().positive(), date: isoDate }).optional())
  .output(
    z.object({
      processed: z.number(),
      outcome: z.enum(['P', 'A', 'HD', 'WO', 'H', 'L', 'OD', 'CO', 'UAB', 'held', 'skipped']).nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input) {
      const outcome = await recomputeDay(context.db, input.employeeId, input.date);
      return { processed: 1, outcome };
    }
    return { processed: await drainRecomputeQueue(context.db), outcome: null };
  });

const weekClose = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/attendance/week-close', summary: 'Apply week-off eligibility for a week (ATT-09)' })
  .input(z.object({ weekStart: isoDate }))
  .output(z.object({ updated: z.number() }))
  .handler(async ({ input, context }) => {
    return { updated: await closeWeek(context.db, input.weekStart) };
  });

export const attendanceConfigRouter = {
  listShifts,
  listShiftsForRoster,
  upsertShift,
  listHolidays,
  upsertHoliday,
  setScheme,
  getTeamRoster,
  setRoster,
  dayRecords,
  overrideDay,
  recompute,
  weekClose,
};
