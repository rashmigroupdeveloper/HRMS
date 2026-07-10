/**
 * Attendance configuration surface (Stage 1.2) — the sponsor's centralization
 * rule made concrete: shifts, schemes, rosters and holidays are ALL runtime
 * data behind the central permission gates. Nothing here requires a deploy.
 *   shifts/holidays   → admin.settings           (policy config)
 *   schemes/rosters   → attendance.roster.write   (managers — ATT-04)
 *   manual override   → attendance.manual_override (HR only, reason + audit — ATT-17)
 *   recompute/week ops→ admin.integrations
 *   day records read  → attendance.team.read
 */
import { ORPCError } from '@orpc/server';
import { sql } from 'kysely';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import {
  closeWeek,
  drainRecomputeQueue,
  recomputeDay,
  setManualStatus,
} from './day-status.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

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

const listShifts = withPermission('admin.settings')
  .route({ method: 'GET', path: '/attendance/config/shifts', summary: 'Shift catalog' })
  .output(z.array(shiftShape.extend({ id: z.number() })))
  .handler(async ({ context }) => {
    const rows = await context.db.selectFrom('att.shifts').selectAll().orderBy('code').execute();
    return rows.map((r) => ({
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

const listHolidays = withPermission('admin.settings')
  .route({ method: 'GET', path: '/attendance/config/holidays', summary: 'Holiday calendar' })
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
    return rows.map((r) => ({
      date: formatDbDate(r.holiday_date),
      name: r.name,
      locationId: r.location_id,
    }));
  });

const upsertHoliday = withPermission('admin.settings')
  .route({ method: 'PUT', path: '/attendance/config/holidays', summary: 'Add/update a holiday (audited)' })
  .input(z.object({ date: isoDate, name: z.string().min(1), locationId: z.number().int().nullish() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await context.db
      .insertInto('att.holidays')
      .values({
        holiday_date: sql<Date>`${input.date}::date` as unknown as Date,
        name: input.name,
        location_id: input.locationId ?? null,
      })
      .onConflict((oc) => oc.columns(['location_id', 'holiday_date']).doUpdateSet({ name: input.name }))
      .execute();
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'update',
      entity: 'att.holidays',
      field: input.date,
      newValue: input.name,
      ip: context.req.ip ?? null,
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
    const weekday = await context.db.selectFrom('att.shifts').select('id').where('code', '=', input.weekdayShiftCode).executeTakeFirst();
    if (!weekday) throw new ORPCError('NOT_FOUND', { message: `Unknown shift: ${input.weekdayShiftCode}` });
    let saturdayId: number | null = null;
    if (input.saturdayShiftCode) {
      const sat = await context.db.selectFrom('att.shifts').select('id').where('code', '=', input.saturdayShiftCode).executeTakeFirst();
      if (!sat) throw new ORPCError('NOT_FOUND', { message: `Unknown shift: ${input.saturdayShiftCode}` });
      saturdayId = sat.id;
    }
    await context.db
      .insertInto('att.employee_shifts')
      .values({ employee_id: input.employeeId, weekday_shift_id: weekday.id, saturday_shift_id: saturdayId, updated_by: context.user.id })
      .onConflict((oc) =>
        oc.column('employee_id').doUpdateSet({ weekday_shift_id: weekday.id, saturday_shift_id: saturdayId, updated_by: context.user.id }),
      )
      .execute();
    return { ok: true as const };
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
    const shiftIds = new Map<string, number>();
    let upserted = 0;
    for (const entry of input.entries) {
      let shiftId: number | null = null;
      if (!entry.weekOff) {
        if (!entry.shiftCode) throw new ORPCError('BAD_REQUEST', { message: 'shiftCode required unless weekOff' });
        let id = shiftIds.get(entry.shiftCode);
        if (id === undefined) {
          const row = await db.selectFrom('att.shifts').select('id').where('code', '=', entry.shiftCode).executeTakeFirst();
          if (!row) throw new ORPCError('NOT_FOUND', { message: `Unknown shift: ${entry.shiftCode}` });
          id = row.id;
          shiftIds.set(entry.shiftCode, id);
        }
        shiftId = id;
      }
      await db
        .insertInto('att.rosters')
        .values({
          employee_id: entry.employeeId,
          work_date: sql<Date>`${entry.date}::date` as unknown as Date,
          shift_id: shiftId,
          is_week_off: entry.weekOff,
          set_by: context.user.id,
        })
        .onConflict((oc) =>
          oc.columns(['employee_id', 'work_date']).doUpdateSet({ shift_id: shiftId, is_week_off: entry.weekOff, set_by: context.user.id }),
        )
        .execute();
      await db
        .insertInto('att.recompute_queue')
        .values({ employee_id: entry.employeeId, work_date: sql<Date>`${entry.date}::date` as unknown as Date })
        .onConflict((oc) => oc.doNothing())
        .execute();
      upserted += 1;
    }
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
        sessionStatuses: z.unknown().nullable(),
        weekoffPaid: z.boolean().nullable(),
        source: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
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
      sessionStatuses: r.session_statuses,
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
  .output(z.object({ processed: z.number() }))
  .handler(async ({ input, context }) => {
    if (input) {
      await recomputeDay(context.db, input.employeeId, input.date);
      return { processed: 1 };
    }
    return { processed: await drainRecomputeQueue(context.db) };
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
  upsertShift,
  listHolidays,
  upsertHoliday,
  setScheme,
  setRoster,
  dayRecords,
  overrideDay,
  recompute,
  weekClose,
};
