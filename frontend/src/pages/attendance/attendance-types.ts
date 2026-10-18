export interface AttendanceSession {
  session: number;
  status: 'P' | 'A' | 'O' | 'OD';
}

export interface AttendanceMonthRow {
  date: string;
  status: string;
  sessionStatuses: AttendanceSession[] | null;
  firstIn: string | null;
  lastOut: string | null;
  otMinutes: number;
  lateMinutes: number;
  source?: 'auto' | 'regularized' | 'manual';
  isLocked?: boolean;
  leaveTypeCode?: string | null;
  leaveTypeName?: string | null;
  leaveIsPaid?: boolean | null;
}

export interface AttendanceRequest {
  id: number;
  kind: 'AR' | 'OD' | 'PERMISSION';
  dayPortion?: 'full_day' | 'first_half' | 'second_half';
  fromDate: string;
  toDate: string;
  fromTime: string | null;
  toTime: string | null;
  reason: string;
  requestedStatus: string;
  workflowRequestId: number;
  workflowStatus: string;
  applied: boolean;
}

export interface OvertimeEntry {
  id: number;
  employeeId: number;
  workDate: string;
  detectedMinutes: number;
  claimedMinutes: number;
  approvedMinutes: number | null;
  status: string;
  deadlineAt: string;
  decidedAt: string | null;
  workflowRequestId: number | null;
}
