export interface AttendanceMonthRow {
  date: string;
  status: string;
  firstIn: string | null;
  lastOut: string | null;
  otMinutes: number;
  lateMinutes: number;
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
