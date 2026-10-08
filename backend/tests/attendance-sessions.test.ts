import { describe, expect, it } from 'vitest';
import { attendanceGlyph, sessionStatusesSchema, validateSessionSummary } from '../src/modules/attendance/session-status.js';
import { computeDayStatus, type AttendancePolicy, type ResolvedShift } from '../src/modules/attendance/day-status.service.js';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import { attendanceConfigRouter } from '../src/modules/attendance/attendance-config.router.js';

const resolved: ResolvedShift = {
  isWeekOff: false, isHoliday: false,
  // Timestamp branding in the catalog is irrelevant to this pure calculation.
  shift: {
    id: 1, code: 'TEST', name: 'Test split', start_time: '09:00', end_time: '18:00',
    crosses_midnight: false, session_split: '13:30', grace_in_minutes: 0, grace_out_minutes: 0,
    min_half_day_hours: '4', min_full_day_hours: '8', break_minutes: 0, is_active: true,
    created_at: new Date(0), updated_at: new Date(0),
  } as unknown as NonNullable<ResolvedShift['shift']>,
};
const policy: AttendancePolicy = {
  earlyMarginMs: 0, lateMarginMs: 0, sessionPresentFraction: 0.5, otMinMinutes: 30, otDecisionHours: 48,
};
const at = (time: string) => new Date(`2026-10-05T${time}:00+05:30`);

describe('ATT-05 ordered attendance sessions', () => {
  it.each([
    ['P', 'P', 'P'], ['A', 'P', 'A:P'], ['P', 'A', 'P:A'], ['A', 'A', 'A'], ['P', 'O', 'P:O'],
  ] as const)('preserves %s / %s as %s', (first, second, glyph) => {
    expect(attendanceGlyph('HD', [{ session: 1, status: first }, { session: 2, status: second }])).toBe(glyph);
  });

  it('rejects duplicate, reversed, missing and unsupported sessions', () => {
    for (const raw of [
      [{ session: 1, status: 'P' }, { session: 1, status: 'A' }],
      [{ session: 2, status: 'A' }, { session: 1, status: 'P' }],
      [{ session: 1, status: 'P' }],
      [{ session: 1, status: 'X' }, { session: 2, status: 'P' }],
    ]) expect(sessionStatusesSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects inconsistent presence summaries and retains an explicit mixed-off summary', () => {
    const pa = sessionStatusesSchema.parse([{ session: 1, status: 'P' }, { session: 2, status: 'A' }]);
    expect(() => { validateSessionSummary('P', pa); }).toThrow();
    expect(() => { validateSessionSummary('HD', pa); }).not.toThrow();
    const po = sessionStatusesSchema.parse([{ session: 1, status: 'P' }, { session: 2, status: 'O' }]);
    expect(() => { validateSessionSummary('P', po); }).not.toThrow();
  });

  it('keeps single-status and leave-code rendering when sessions are absent', () => {
    expect(attendanceGlyph('WO', null)).toBe('WO');
    expect(attendanceGlyph('L', null, 'CL')).toBe('CL');
  });

  it('publishes the ordered session input in the OpenAPI contract', async () => {
    const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] });
    const spec = await generator.generate({ attendance: attendanceConfigRouter }, {
      info: { title: 'Attendance test', version: '1' },
    });
    expect(JSON.stringify(spec.paths?.['/attendance/days/override']?.put?.requestBody)).toContain('sessionStatuses');
  });

  it.each([
    [['09:00', '18:00'], 'P', ['P', 'P']],
    [['13:30', '18:00'], 'HD', ['A', 'P']],
    [['09:00', '13:30'], 'HD', ['P', 'A']],
    [[], 'A', ['A', 'A']],
    [['09:00'], 'A', ['A', 'A']],
  ] as const)('computes swipe fixture %j as %s with both sessions retained', (times, status, sessions) => {
    const result = computeDayStatus(resolved, '2026-10-05', times.map(at), policy);
    expect(result.status).toBe(status);
    expect(result.sessionStatuses?.map((s) => s.status)).toEqual(sessions);
  });
});
