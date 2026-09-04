import type { AttendanceSessionStatus, AttendanceStatus } from './attendance-types';

export function formatAttendanceMinutes(minutes: number | null): string {
  if (minutes === null) return 'Not recorded';
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? `${String(hours)} h`
    : `${String(hours)} h ${String(remainder)} min`;
}

export function attendanceState(status: AttendanceStatus) {
  switch (status) {
    case 'P':
    case 'OD':
    case 'CO':
      return 'present' as const;
    case 'A':
    case 'UAB':
      return 'absent' as const;
    case 'L':
      return 'leave' as const;
    case 'HD':
      return 'halfday' as const;
    case 'H':
      return 'holiday' as const;
    case 'WO':
      return 'weekoff' as const;
  }
}

export function sessionLabel(session: AttendanceSessionStatus): string {
  return `${session.session === 1 ? 'First half' : 'Second half'} · ${session.status === 'P' ? 'Present' : 'Absent'}`;
}
