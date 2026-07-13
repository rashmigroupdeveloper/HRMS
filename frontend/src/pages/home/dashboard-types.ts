export interface EssDashboardData {
  greetingName: string;
  ecode: string;
  today: string;
  shift: {
    code: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  todayStatus: {
    status: string;
    firstIn: string | null;
    lastOut: string | null;
  } | null;
  leaveBalances: {
    leaveTypeId: number;
    code: string;
    name: string;
    balance: number;
    available: number;
    isPaid: boolean;
  }[];
  pendingRequests: number;
}

export interface HrDashboardData {
  asOf: string;
  headcountByCategory: { category: string | null; count: number }[];
  joinersMtd: number;
  exitsMtd: number;
  absentToday: number;
  pendingApprovals: number;
  openAbsenceByStage: { stage: string; count: number }[];
  pendingOt: number;
  silentDevices: number;
  policyAckPercent: number;
}

export interface TeamMemberMonth {
  employeeId: number;
  ecode: string;
  name: string;
  days: Record<string, { status: string; firstIn: string | null; lastOut: string | null }>;
}

export interface DeviceHealth {
  doorCode: string;
  source: string;
  lastSeenAt: string | null;
  watermarkAt: string | null;
  isActive: boolean;
  silent: boolean;
}
