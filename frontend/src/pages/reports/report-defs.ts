/**
 * Report definitions R2–R6 + R27 (docs/06) — one declarative shape drives the
 * runner page: filters → query string → rows → table AND the CSV export, so
 * the download is provably the view with the same applied filters.
 * (R1 muster and R24 boarding/exit have dedicated pages with server XLSX.)
 */

export type ReportScalar = string | number | boolean | null;
export type ReportRow = Record<string, ReportScalar>;

export interface ReportFilter {
  key: string;
  label: string;
  kind: 'number' | 'month' | 'date' | 'text';
  required?: boolean;
  hint?: string;
}

export interface ReportColumn {
  key: string;
  header: string;
  numeric?: boolean;
  width?: string;
  /** 'negative' rows get badge emphasis (e.g. UAB) — optional. */
  badgeWhen?: (row: ReportRow) => boolean;
}

export interface ReportDef {
  code: string;
  title: string;
  subtitle: string;
  endpoint: string;
  filters: ReportFilter[];
  columns: ReportColumn[];
}

const companyId: ReportFilter = {
  key: 'companyId',
  label: 'Company ID',
  kind: 'number',
  required: true,
  hint: 'Numeric company id (RML = 1 in the seed)',
};
const month: ReportFilter = { key: 'month', label: 'Month', kind: 'month', required: true };

export const REPORT_DEFS: Record<string, ReportDef> = {
  r2: {
    code: 'R2',
    title: 'Swipe detail',
    subtitle: 'Processed first-in / last-out per day for one employee',
    endpoint: '/api/reports/r2-swipes',
    filters: [
      { key: 'employeeId', label: 'Employee ID', kind: 'number', required: true },
      { key: 'fromDate', label: 'From', kind: 'date', required: true },
      { key: 'toDate', label: 'To', kind: 'date', required: true },
    ],
    columns: [
      { key: 'workDate', header: 'Date', width: '110px' },
      { key: 'status', header: 'Status', width: '90px' },
      { key: 'firstIn', header: 'First in' },
      { key: 'lastOut', header: 'Last out' },
      { key: 'workedMinutes', header: 'Worked min', numeric: true },
      { key: 'lateMinutes', header: 'Late', numeric: true },
      { key: 'earlyExitMinutes', header: 'Early exit', numeric: true },
      { key: 'otMinutes', header: 'OT min', numeric: true },
    ],
  },
  r3: {
    code: 'R3',
    title: 'AR / OD register',
    subtitle: 'Regularisations with workflow state and applied flag',
    endpoint: '/api/reports/r3-regularizations',
    filters: [companyId],
    columns: [
      { key: 'ecode', header: 'Emp ID', width: '110px' },
      { key: 'kind', header: 'Kind', width: '110px' },
      { key: 'fromDate', header: 'From', width: '110px' },
      { key: 'toDate', header: 'To', width: '110px' },
      { key: 'reason', header: 'Reason', width: 'minmax(200px,2fr)' },
      { key: 'workflowStatus', header: 'Workflow', width: '110px' },
      { key: 'applied', header: 'Applied', width: '90px' },
    ],
  },
  r4: {
    code: 'R4',
    title: 'Attendance exceptions',
    subtitle: 'Late, early exit and unauthorised absence for a month',
    endpoint: '/api/reports/r4-exceptions',
    filters: [companyId, month],
    columns: [
      { key: 'ecode', header: 'Emp ID', width: '110px' },
      { key: 'workDate', header: 'Date', width: '110px' },
      {
        key: 'status',
        header: 'Status',
        width: '100px',
        badgeWhen: (row) => row['status'] === 'A' || row['status'] === 'UAB',
      },
      { key: 'lateMinutes', header: 'Late min', numeric: true },
      { key: 'earlyExitMinutes', header: 'Early-exit min', numeric: true },
    ],
  },
  r5: {
    code: 'R5',
    title: 'Overtime register',
    subtitle: 'Detected → claimed → approved with the 48-hour outcome',
    endpoint: '/api/reports/r5-ot',
    filters: [companyId, month],
    columns: [
      { key: 'ecode', header: 'Emp ID', width: '110px' },
      { key: 'workDate', header: 'Date', width: '110px' },
      { key: 'detectedMinutes', header: 'Detected', numeric: true },
      { key: 'claimedMinutes', header: 'Claimed', numeric: true },
      { key: 'approvedMinutes', header: 'Approved', numeric: true },
      { key: 'status', header: 'Status', width: '130px', badgeWhen: (row) => row['status'] === 'lapsed' },
      { key: 'decidedAt', header: 'Decided at' },
      { key: 'convertedCompOff', header: 'Comp-off', width: '90px' },
    ],
  },
  r6: {
    code: 'R6',
    title: 'Absence cases',
    subtitle: 'Continuous-absence engine stages and resolutions',
    endpoint: '/api/reports/r6-absence',
    filters: [companyId],
    columns: [
      { key: 'ecode', header: 'Emp ID', width: '110px' },
      { key: 'startDate', header: 'Since', width: '110px' },
      { key: 'daysAbsent', header: 'Days', numeric: true },
      {
        key: 'stage',
        header: 'Stage',
        width: '150px',
        badgeWhen: (row) => row['stage'] === 'show_cause' || row['stage'] === 'termination_review',
      },
      { key: 'letterId', header: 'Letter', width: '90px' },
      { key: 'resolution', header: 'Resolution', width: '120px' },
    ],
  },
  r27: {
    code: 'R27',
    title: 'Headcount demographics',
    subtitle: 'Status × employment-category counts',
    endpoint: '/api/reports/r27-headcount',
    filters: [{ ...companyId, required: false, hint: 'Leave blank for all companies' }],
    columns: [
      { key: 'status', header: 'Status', width: '160px' },
      { key: 'category', header: 'Category', width: '180px' },
      { key: 'count', header: 'Count', numeric: true },
    ],
  },
};
