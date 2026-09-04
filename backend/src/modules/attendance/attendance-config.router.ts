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
import { assertEmployeesInScope, employeeScopeSql } from '../../core/rbac/employee-scope.js';
import {
  closeWeek,
  drainRecomputeQueue,
  recomputeDay,
  setManualStatus,
} from './day-status.service.js';
import { applyRosterEntries } from './roster.service.js';
import { parseTimeSlabs, RosterRuleError } from './shift-windows.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const dayStatus = z.enum(['P', 'A', 'HD', 'WO', 'H', 'L', 'OD', 'CO', 'UAB']);
const sessionStatus = z.object({
  session: z.number().int().min(1).max(2),
  status: z.enum(['P', 'A']),
});

const timeSlab = z.object({
  fromMin: z.number().int().min(0),
  toMin: z.number().int().min(0).nullable(),
  effect: z.enum(['none', 'late', 'half_day']),
});
const hhmm = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');

const shiftShape = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  startTime: hhmm,
  endTime: hhmm,
  crossesMidnight: z.boolean().default(false),
  sessionSplit: hhmm.nullish(),
  session2Start: hhmm.nullish(),
  session2End: hhmm.nullish(),
  graceInMinutes: z.number().int().min(0).max(120),
  graceOutMinutes: z.number().int().min(0).max(120),
  minHalfDayHours: z.number().min(0).max(12),
  minFullDayHours: z.number().min(0).max(16),
  breakMinutes: z.number().int().min(0).max(180),
  breakPaid: z.boolean(),
  otStartOffsetMinutes: z.number().int().min(0).max(240),
  lateSlabs: z.array(timeSlab),
  earlyExitSlabs: z.array(timeSlab),
  allowanceComponentCode: z.string().min(1).max(32).nullish(),
  isActive: z.boolean().default(true),
});

function timeMinutes(value: string): number {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
}

const shiftInput = shiftShape.superRefine((shift, ctx) => {
  const start = timeMinutes(shift.startTime);
  const end = timeMinutes(shift.endTime);
  if (start === end || (shift.crossesMidnight ? end >= start : end <= start)) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Shift end must follow start using the crosses-midnight setting' });
  }
  if (shift.sessionSplit !== null && shift.sessionSplit !== undefined) {
    const split = timeMinutes(shift.sessionSplit);
    if (shift.crossesMidnight || split <= start || split >= end) {
      ctx.addIssue({ code: 'custom', path: ['sessionSplit'], message: 'Session split must fall inside a same-day shift' });
    }
    if (shift.session2Start !== null && shift.session2Start !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['session2Start'], message: 'Use either a half-day split or a separate second session, not both' });
    }
  }
  const secondStart = shift.session2Start ?? null;
  const secondEnd = shift.session2End ?? null;
  if ((secondStart === null) !== (secondEnd === null)) {
    ctx.addIssue({ code: 'custom', path: ['session2End'], message: 'Second session requires both start and end' });
  } else if (secondStart !== null && secondEnd !== null) {
    if (shift.crossesMidnight || timeMinutes(secondStart) < end || timeMinutes(secondEnd) <= timeMinutes(secondStart)) {
      ctx.addIssue({ code: 'custom', path: ['session2Start'], message: 'Second session must be a later, non-overlapping same-day window' });
    }
  }
});

function mapShiftRow(r: {
  id: number;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  session_split: string | null;
  session2_start: string | null;
  session2_end: string | null;
  grace_in_minutes: number;
  grace_out_minutes: number;
  min_half_day_hours: string;
  min_full_day_hours: string;
  break_minutes: number;
  break_paid: boolean;
  ot_start_offset_minutes: number;
  late_slabs: unknown;
  early_exit_slabs: unknown;
  allowance_component_code: string | null;
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
    session2Start: r.session2_start?.slice(0, 5) ?? null,
    session2End: r.session2_end?.slice(0, 5) ?? null,
    graceInMinutes: r.grace_in_minutes,
    graceOutMinutes: r.grace_out_minutes,
    minHalfDayHours: Number(r.min_half_day_hours),
    minFullDayHours: Number(r.min_full_day_hours),
    breakMinutes: r.break_minutes,
    breakPaid: r.break_paid,
    otStartOffsetMinutes: r.ot_start_offset_minutes,
    lateSlabs: parseTimeSlabs(r.late_slabs),
    earlyExitSlabs: parseTimeSlabs(r.early_exit_slabs),
    allowanceComponentCode: r.allowance_component_code,
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
  .input(shiftInput)
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const values = {
      code: input.code,
      name: input.name,
      start_time: input.startTime,
      end_time: input.endTime,
      crosses_midnight: input.crossesMidnight,
      session_split: input.sessionSplit ?? null,
      session2_start: input.session2Start ?? null,
      session2_end: input.session2End ?? null,
      grace_in_minutes: input.graceInMinutes,
      grace_out_minutes: input.graceOutMinutes,
      min_half_day_hours: String(input.minHalfDayHours),
      min_full_day_hours: String(input.minFullDayHours),
      break_minutes: input.breakMinutes,
      break_paid: input.breakPaid,
      ot_start_offset_minutes: input.otStartOffsetMinutes,
      late_slabs: JSON.stringify(input.lateSlabs),
      early_exit_slabs: JSON.stringify(input.earlyExitSlabs),
      allowance_component_code: input.allowanceComponentCode ?? null,
      is_active: input.isActive,
    };
    await context.db.transaction().execute(async (trx) => {
      const saved = await trx
        .insertInto('att.shifts')
        .values(values)
        .onConflict((oc) => oc.column('code').doUpdateSet(values))
        .returning('id')
        .executeTakeFirstOrThrow();
      await sql`
        INSERT INTO att.recompute_queue (employee_id, work_date)
        SELECT employee_id, work_date
          FROM att.day_records
         WHERE shift_id = ${saved.id}
           AND source = 'auto'
           AND is_locked = false
        ON CONFLICT (employee_id, work_date)
        DO UPDATE SET queued_at = now()
      `.execute(trx);
      await writeAudit(trx, {
        actorUserId: context.user.id,
        action: 'update',
        entity: 'att.shifts',
        field: input.code,
        newValue: JSON.stringify(input),
        ip: context.req.ip ?? null,
      });
    });
    return { ok: true as const };
  });

const listHolidays = withPermission('attendance.own')
  .route({ method: 'GET', path: '/attendance/config/holidays', summary: 'Holiday calendar (ESS-readable)' })
  .input(z.object({ year: z.number().int() }).optional())
  .output(z.array(z.object({ date: z.string(), name: z.string(), locationId: z.number().nullable() })))
  .handler(async ({ input, context }) => {
    if (context.user.employee_id === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
    }
    const employee = await context.db
      .selectFrom('core.employees')
      .select('location_id')
      .where('id', '=', context.user.employee_id)
      .executeTakeFirstOrThrow();
    let q = context.db.selectFrom('att.holidays').selectAll().orderBy('holiday_date');
    q = q.where((eb) =>
      employee.location_id === null
        ? eb('location_id', 'is', null)
        : eb.or([
            eb('location_id', 'is', null),
            eb('location_id', '=', employee.location_id),
          ]),
    );
    if (input?.year) {
      q = q
        .where('holiday_date', '>=', sql<Date>`${`${input.year}-01-01`}::date`)
        .where('holiday_date', '<=', sql<Date>`${`${input.year}-12-31`}::date`);
    }
    const rows = await q.execute();
    return rows.map((r) => ({
      date: formatDbDate(r.holiday_date),
      name: r.name,
      locationId: r.location_id,
    }));
  });

const listHolidaysAdmin = withPermission('admin.settings')
  .route({
    method: 'GET',
    path: '/attendance/config/holidays/admin',
    summary: 'Holiday calendar across locations (admin master)',
  })
  .input(z.object({ year: z.number().int() }).optional())
  .output(z.array(z.object({ date: z.string(), name: z.string(), locationId: z.number().nullable() })))
  .handler(async ({ input, context }) => {
    let q = context.db.selectFrom('att.holidays').selectAll().orderBy('holiday_date');
    if (input?.year) {
      q = q
        .where('holiday_date', '>=', sql<Date>`${`${input.year}-01-01`}::date`)
        .where('holiday_date', '<=', sql<Date>`${`${input.year}-12-31`}::date`);
    }
    const rows = await q.execute();
    return rows.map((row) => ({
      date: formatDbDate(row.holiday_date),
      name: row.name,
      locationId: row.location_id,
    }));
  });

const upsertHoliday = withPermission('admin.settings')
  .route({ method: 'PUT', path: '/attendance/config/holidays', summary: 'Add/update a holiday (audited)' })
  .input(z.object({ date: isoDate, name: z.string().min(1), locationId: z.number().int().nullish() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await context.db.transaction().execute(async (trx) => {
      const locationId = input.locationId ?? null;
      const insert = trx
        .insertInto('att.holidays')
        .values({
          holiday_date: sql<Date>`${input.date}::date` as unknown as Date,
          name: input.name,
          location_id: locationId,
        });
      if (locationId === null) {
        await insert
          .onConflict((oc) =>
            oc.column('holiday_date').where('location_id', 'is', null).doUpdateSet({ name: input.name }),
          )
          .execute();
      } else {
        await insert
          .onConflict((oc) =>
            oc
              .columns(['location_id', 'holiday_date'])
              .where('location_id', 'is not', null)
              .doUpdateSet({ name: input.name }),
          )
          .execute();
      }
      await sql`
        INSERT INTO att.recompute_queue (employee_id, work_date)
        SELECT day.employee_id, day.work_date
          FROM att.day_records day
          JOIN core.employees employee ON employee.id = day.employee_id
         WHERE day.work_date = ${input.date}::date
           AND day.source = 'auto'
           AND day.is_locked = false
           AND (${locationId}::bigint IS NULL OR employee.location_id = ${locationId})
        ON CONFLICT (employee_id, work_date)
        DO UPDATE SET queued_at = now()
      `.execute(trx);
      await writeAudit(trx, {
        actorUserId: context.user.id,
        action: 'update',
        entity: 'att.holidays',
        field: `${locationId === null ? 'global' : String(locationId)}:${input.date}`,
        newValue: input.name,
        ip: context.req.ip ?? null,
      });
    });
    return { ok: true as const };
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
      await assertEmployeesInScope(
        context.db,
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
        [input.employeeId],
      );
    } catch (error) {
      throw new ORPCError('FORBIDDEN', {
        message: error instanceof Error ? error.message : 'Employee outside permitted scope',
      });
    }
    const weekday = await context.db.selectFrom('att.shifts').select('id').where('code', '=', input.weekdayShiftCode).executeTakeFirst();
    if (!weekday) throw new ORPCError('NOT_FOUND', { message: `Unknown shift: ${input.weekdayShiftCode}` });
    let saturdayId: number | null = null;
    if (input.saturdayShiftCode) {
      const sat = await context.db.selectFrom('att.shifts').select('id').where('code', '=', input.saturdayShiftCode).executeTakeFirst();
      if (!sat) throw new ORPCError('NOT_FOUND', { message: `Unknown shift: ${input.saturdayShiftCode}` });
      saturdayId = sat.id;
    }
    await context.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('att.employee_shifts')
        .values({ employee_id: input.employeeId, weekday_shift_id: weekday.id, saturday_shift_id: saturdayId, updated_by: context.user.id })
        .onConflict((oc) =>
          oc.column('employee_id').doUpdateSet({ weekday_shift_id: weekday.id, saturday_shift_id: saturdayId, updated_by: context.user.id }),
        )
        .execute();
      await sql`
        INSERT INTO att.recompute_queue (employee_id, work_date)
        SELECT employee_id, work_date
          FROM att.day_records
         WHERE employee_id = ${input.employeeId}
           AND source = 'auto'
           AND is_locked = false
        ON CONFLICT (employee_id, work_date)
        DO UPDATE SET queued_at = now()
      `.execute(trx);
      await writeAudit(trx, {
        actorUserId: context.user.id,
        action: 'update',
        entity: 'att.employee_shifts',
        entityId: input.employeeId,
        subjectEmployeeId: input.employeeId,
        field: 'scheme',
        newValue: JSON.stringify({
          weekdayShiftCode: input.weekdayShiftCode,
          saturdayShiftCode: input.saturdayShiftCode ?? null,
        }),
        ip: context.req.ip ?? null,
      });
    });
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
    const month = input.month.length === 7 ? `${input.month}-01` : input.month;
    const [y = 0, mo = 1] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const monthEnd = `${y}-${String(mo).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    let teamQuery = context.db
      .selectFrom('core.employees as e')
      .select(['e.id', 'e.ecode', 'e.first_name', 'e.last_name'])
      .where('e.status', 'in', ['active', 'on_notice'])
      .where(
        employeeScopeSql(
          { ...context.permissionAccess, actorEmployeeId: managerId },
          'e',
        ),
      );

    if (
      input.subtree !== true &&
      context.permissionAccess.subtree &&
      !context.permissionAccess.all &&
      context.permissionAccess.orgUnitIds.length === 0 &&
      managerId !== null
    ) {
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
            shiftCode: z.string().min(1).nullish(),
            weekOff: z.boolean().default(false),
          }),
        )
        .min(1)
        .max(500),
      reason: z.string().min(5).optional(),
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
    try {
      const upserted = await applyRosterEntries(db, {
        actorUserId: context.user.id,
        entries,
        ip: context.req.ip ?? null,
        reason: input.reason ?? null,
      });
      return { upserted };
    } catch (err) {
      if (err instanceof RosterRuleError) {
        throw new ORPCError('BAD_REQUEST', { message: err.message });
      }
      throw err;
    }
  });

const dayRecords = withPermission('attendance.team.read')
  .route({ method: 'GET', path: '/attendance/days', summary: 'Processed day records for a range' })
  .input(z.object({ employeeId: z.coerce.number().int().positive(), from: isoDate, to: isoDate }))
  .output(
    z.array(
      z.object({
        date: z.string(),
        status: dayStatus,
        scheme: z.string().nullable(),
        firstIn: z.string().nullable(),
        lastOut: z.string().nullable(),
        workedMinutes: z.number().nullable(),
        lateMinutes: z.number(),
        earlyExitMinutes: z.number(),
        sessionStatuses: z.array(sessionStatus).nullable(),
        weekoffPaid: z.boolean().nullable(),
        source: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    try {
      await assertEmployeesInScope(
        context.db,
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
        [input.employeeId],
      );
    } catch (error) {
      throw new ORPCError('FORBIDDEN', {
        message: error instanceof Error ? error.message : 'Employee outside permitted scope',
      });
    }
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
      sessionStatuses: r.session_statuses === null ? null : z.array(sessionStatus).parse(r.session_statuses),
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
      reason: z.string().min(5, 'A meaningful reason is mandatory'),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      await assertEmployeesInScope(
        context.db,
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
        [input.employeeId],
      );
    } catch (error) {
      throw new ORPCError('FORBIDDEN', {
        message: error instanceof Error ? error.message : 'Employee outside permitted scope',
      });
    }
    await setManualStatus(context.db, {
      employeeId: input.employeeId,
      isoDate: input.date,
      status: input.status,
      reason: input.reason,
      actorUserId: context.user.id,
    });
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
  listHolidaysAdmin,
  upsertHoliday,
  setScheme,
  getTeamRoster,
  setRoster,
  dayRecords,
  overrideDay,
  recompute,
  weekClose,
};
