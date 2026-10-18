import type { AttendanceSession } from './attendance-types';

export function attendanceSessionGlyph(status: string, sessions?: readonly AttendanceSession[] | null): string {
  const first = sessions?.[0];
  const second = sessions?.[1];
  if (!first || !second) return status;
  return first.status === second.status ? first.status : `${first.status}:${second.status}`;
}

const SESSION_LABEL = { P: 'Present', A: 'Absent', O: 'Off', OD: 'Official duty' } as const;
export function attendanceSessionDescription(sessions?: readonly AttendanceSession[] | null): string {
  return sessions?.map((s) => `${s.session === 1 ? 'First half' : 'Second half'}: ${SESSION_LABEL[s.status]}`).join('; ') ?? '';
}
