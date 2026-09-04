export type AttendanceStatus = 'P' | 'A' | 'HD' | 'WO' | 'H' | 'L' | 'OD' | 'CO' | 'UAB';

export interface AttendanceSessionStatus {
  session: number;
  status: 'P' | 'A';
}

export interface AttendanceMonthRow {
  date: string;
  status: AttendanceStatus;
  scheme: string | null;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number | null;
  otMinutes: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  sessionStatuses: AttendanceSessionStatus[] | null;
}

export interface AttendanceRequest {
  id: number;
  kind: 'AR' | 'OD' | 'PERMISSION';
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
