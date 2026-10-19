/** SHF-01: shared shift HTTP schemas and complete catalog mapping. */
import { z } from 'zod';
import { timeSlabsSchema } from './penalty-evaluation.js';
function readSlabs(value: unknown) {
  // Older test/import rows used an empty object to mean no configured rules.
  // This compatibility case contains no policy to lose; nonempty malformed
  // objects still fail validation instead of silently discarding their rules.
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
    return [];
  return timeSlabsSchema.parse(value);
}
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
  graceInMinutes: z.number().int().min(0).max(120).default(0),
  graceOutMinutes: z.number().int().min(0).max(120).default(0),
  minHalfDayHours: z.number().min(0).max(12),
  minFullDayHours: z.number().min(0).max(16),
  breakMinutes: z.number().int().min(0).max(180).default(0),
  breakPaid: z.boolean().optional(),
  otStartOffsetMinutes: z.number().int().min(0).max(240).optional(),
  lateSlabs: timeSlabsSchema.optional(),
  earlyExitSlabs: timeSlabsSchema.optional(),
  allowanceComponentCode: z.string().min(1).max(32).nullish(),
  isActive: z.boolean().default(true),
});

function timeMinutes(value: string): number {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export const shiftOutput = shiftShape.extend({
  sessionSplit: hhmm.nullable(),
  session2Start: hhmm.nullable(),
  session2End: hhmm.nullable(),
  breakPaid: z.boolean(),
  otStartOffsetMinutes: z.number().int(),
  lateSlabs: timeSlabsSchema,
  earlyExitSlabs: timeSlabsSchema,
  allowanceComponentCode: z.string().nullable(),
});

export const shiftInput = shiftShape.superRefine((shift, ctx) => {
  const start = timeMinutes(shift.startTime);
  const end = timeMinutes(shift.endTime);
  if (start === end || (shift.crossesMidnight ? end >= start : end <= start)) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'Shift end must follow start using the crosses-midnight setting',
    });
  }
  if (shift.sessionSplit !== null && shift.sessionSplit !== undefined) {
    const split = timeMinutes(shift.sessionSplit);
    if (shift.crossesMidnight || split <= start || split >= end) {
      ctx.addIssue({
        code: 'custom',
        path: ['sessionSplit'],
        message: 'Session split must fall inside a same-day shift',
      });
    }
    if (shift.session2Start !== null && shift.session2Start !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['session2Start'],
        message: 'Use either a half-day split or a separate second session, not both',
      });
    }
  }
  const secondStart = shift.session2Start ?? null;
  const secondEnd = shift.session2End ?? null;
  if ((secondStart === null) !== (secondEnd === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['session2End'],
      message: 'Second session requires both start and end',
    });
  } else if (secondStart !== null && secondEnd !== null) {
    if (
      shift.crossesMidnight ||
      timeMinutes(secondStart) < end ||
      timeMinutes(secondEnd) <= timeMinutes(secondStart)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['session2Start'],
        message: 'Second session must be a later, non-overlapping same-day window',
      });
    }
  }
});

export function mapShiftRow(r: {
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
    lateSlabs: readSlabs(r.late_slabs),
    earlyExitSlabs: readSlabs(r.early_exit_slabs),
    allowanceComponentCode: r.allowance_component_code,
    isActive: r.is_active,
  };
}
