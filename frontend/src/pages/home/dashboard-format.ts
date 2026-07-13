import type { DotState } from '../../ui';

const ATTENDANCE_LABELS: Record<string, string> = {
  P: 'Present',
  A: 'Absent',
  UAB: 'Unauthorised absence',
  L: 'On leave',
  WO: 'Week off',
  H: 'Holiday',
  HD: 'Half day',
};

const TIME_IST = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
});
const TIMESTAMP_IST = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const MONTH_PARTS_IST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
});

export function attendanceLabel(status: string | null | undefined): string {
  if (!status) return 'Awaiting attendance';
  return ATTENDANCE_LABELS[status] ?? status;
}

export function attendanceDot(status: string | null | undefined): DotState {
  if (status === 'P' || status === 'HD') return 'present';
  if (status === 'A' || status === 'UAB') return 'absent';
  if (status === 'L') return 'leave';
  if (status === 'WO' || status === 'H') return 'weekoff';
  return 'none';
}

export function formatTime(value: string | null): string {
  if (!value) return 'Not recorded';
  return TIME_IST.format(new Date(value));
}

export function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  return TIMESTAMP_IST.format(new Date(value));
}

export function currentMonthIST(): string {
  const parts = MONTH_PARTS_IST.formatToParts();
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}
