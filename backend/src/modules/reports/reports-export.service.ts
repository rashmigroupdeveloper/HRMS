/**
 * Excel exports for R2–R6 / R24 / R27 — always call the same list functions
 * as the on-screen endpoints (RPT-06: export = view filters).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { EmployeeScope } from '../../core/rbac/employee-scope.js';
import { rowsToExcelBuffer, type ExcelColumn } from '../../core/excel/workbook.js';
import {
  reportR2Swipes,
  reportR3Regularizations,
  reportR4Exceptions,
  reportR5Ot,
  reportR6AbsenceCases,
  reportR21Offers,
  reportR23Transfers,
  reportR24Boarding,
  reportR25Probation,
  reportR26Attrition,
  reportR27Headcount,
  reportR28Assets,
  reportR29Helpdesk,
  reportR30Policies,
  reportR31Claims,
} from './reports.service.js';

const R2_COLS: ExcelColumn[] = [
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Date', key: 'workDate', width: 12 },
  { header: 'Status', key: 'status', width: 8 },
  { header: 'First In', key: 'firstIn', width: 22 },
  { header: 'Last Out', key: 'lastOut', width: 22 },
  { header: 'Worked mins', key: 'workedMinutes', width: 12 },
  { header: 'Late mins', key: 'lateMinutes', width: 10 },
  { header: 'Early mins', key: 'earlyExitMinutes', width: 10 },
  { header: 'OT mins', key: 'otMinutes', width: 10 },
  { header: 'First door', key: 'firstDoor', width: 18 },
  { header: 'Last door', key: 'lastDoor', width: 18 },
  { header: 'Mapped location', key: 'mappedLocation', width: 18 },
  { header: 'Majority swipe location', key: 'majoritySwipeLocation', width: 22 },
  { header: 'Cross-plant flag', key: 'crossPlantFlag', width: 14 },
  { header: 'Raw swipe count', key: 'rawSwipeCount', width: 14 },
  { header: 'Status vs swipes', key: 'statusVsSwipes', width: 22 },
];

const R3_COLS: ExcelColumn[] = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Kind', key: 'kind', width: 12 },
  { header: 'From', key: 'fromDate', width: 12 },
  { header: 'To', key: 'toDate', width: 12 },
  { header: 'From time', key: 'fromTime', width: 10 },
  { header: 'To time', key: 'toTime', width: 10 },
  { header: 'Reason', key: 'reason', width: 28 },
  { header: 'Requested status', key: 'requestedStatus', width: 14 },
  { header: 'Applied', key: 'applied', width: 10 },
  { header: 'Workflow', key: 'workflowStatus', width: 12 },
  { header: 'Step', key: 'currentStep', width: 8 },
  { header: 'Decided at', key: 'decidedAt', width: 22 },
  { header: 'Approval timeline', key: 'timelineSummary', width: 52 },
];

const R4_COLS: ExcelColumn[] = [
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Date', key: 'workDate', width: 12 },
  { header: 'Status', key: 'status', width: 8 },
  { header: 'Late mins', key: 'lateMinutes', width: 10 },
  { header: 'Early mins', key: 'earlyExitMinutes', width: 10 },
  { header: 'Monthly exception count', key: 'monthlyExceptionCount', width: 18 },
  { header: 'Monthly late mins', key: 'monthlyLateMinutes', width: 16 },
  { header: 'Monthly early mins', key: 'monthlyEarlyExitMinutes', width: 16 },
  { header: 'Monthly UAB days', key: 'monthlyUabDays', width: 15 },
];

const R5_COLS: ExcelColumn[] = [
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Date', key: 'workDate', width: 12 },
  { header: 'Detected mins', key: 'detectedMinutes', width: 12 },
  { header: 'Claimed mins', key: 'claimedMinutes', width: 12 },
  { header: 'Approved mins', key: 'approvedMinutes', width: 12 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Manager', key: 'managerName', width: 20 },
  { header: 'Manager Emp ID', key: 'managerEcode', width: 14 },
  { header: 'Deadline', key: 'deadlineAt', width: 22 },
  { header: 'Decided at', key: 'decidedAt', width: 22 },
  { header: 'Latency hrs (from open)', key: 'decisionLatencyHours', width: 18 },
  { header: 'Within 48h', key: 'within48h', width: 12 },
  { header: 'Comp-off', key: 'convertedCompOff', width: 10 },
  { header: 'Comp-off credit ID', key: 'compOffCreditId', width: 16 },
  { header: 'Payroll item ID', key: 'payrollItemId', width: 14 },
  { header: 'Manager decisions', key: 'managerDecisionCount', width: 15 },
  { header: 'Manager avg latency h', key: 'managerAverageLatencyHours', width: 19 },
];

const R6_COLS: ExcelColumn[] = [
  { header: 'Case ID', key: 'id', width: 10 },
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Start', key: 'startDate', width: 12 },
  { header: 'Days absent', key: 'daysAbsent', width: 12 },
  { header: 'Stage', key: 'stage', width: 14 },
  { header: 'HR owner', key: 'ownerName', width: 22 },
  { header: 'Letter ID', key: 'letterId', width: 10 },
  { header: 'Letter status', key: 'letterStatus', width: 14 },
  { header: 'Letter content path', key: 'letterContentPath', width: 32 },
  { header: 'Resolution', key: 'resolution', width: 14 },
  { header: 'Closed at', key: 'closedAt', width: 22 },
];

const R24_COLS: ExcelColumn[] = [
  { header: 'Kind', key: 'kind', width: 8 },
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Name', key: 'name', width: 22 },
  { header: 'Designation', key: 'designation', width: 18 },
  { header: 'Department', key: 'department', width: 16 },
  { header: 'Reporting Manager', key: 'reportingManager', width: 20 },
  { header: 'Cost Center', key: 'costCenter', width: 12 },
  { header: 'Location', key: 'location', width: 16 },
  { header: 'DOJ', key: 'doj', width: 12 },
  { header: 'DOL', key: 'dol', width: 12 },
  { header: 'Exit reason', key: 'exitReason', width: 22 },
];

const R27_COLS: ExcelColumn[] = [
  { header: 'Snapshot date', key: 'snapshotDate', width: 14 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Company', key: 'company', width: 24 },
  { header: 'Location', key: 'location', width: 20 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Department', key: 'department', width: 22 },
  { header: 'Grade', key: 'grade', width: 12 },
  { header: 'Gender', key: 'gender', width: 12 },
  { header: 'Age band', key: 'ageBand', width: 12 },
  { header: 'Tenure band', key: 'tenureBand', width: 14 },
  { header: 'Count', key: 'count', width: 10 },
];

const R21_COLS: ExcelColumn[] = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Candidate Name', key: 'candidateName', width: 24 },
  { header: 'Org Unit', key: 'orgUnit', width: 20 },
  { header: 'Designation Offered', key: 'designationOffered', width: 22 },
  { header: 'Proposed DOJ', key: 'doj', width: 14 },
  { header: 'Offer Date', key: 'offerDate', width: 14 },
  { header: 'Offered Salary', key: 'offeredSalary', width: 16 },
  { header: 'Probation %', key: 'probationPercentage', width: 12 },
  { header: 'LOI Status', key: 'loiStatus', width: 16 },
  { header: 'Work Location', key: 'workLocation', width: 18 },
  { header: 'Onboarding Status', key: 'status', width: 16 },
];

const R23_COLS: ExcelColumn[] = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'From Entity', key: 'fromCompany', width: 20 },
  { header: 'To Entity', key: 'toCompany', width: 20 },
  { header: 'From Dept', key: 'fromDepartment', width: 18 },
  { header: 'To Dept', key: 'toDepartment', width: 18 },
  { header: 'From Location', key: 'fromLocation', width: 18 },
  { header: 'To Location', key: 'toLocation', width: 18 },
  { header: 'Transfer Type', key: 'transferType', width: 16 },
  { header: 'Effective Date', key: 'effectiveDate', width: 14 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Approved By', key: 'approverName', width: 20 },
];

const R25_COLS: ExcelColumn[] = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Department', key: 'department', width: 18 },
  { header: 'Designation', key: 'designation', width: 20 },
  { header: 'DOJ', key: 'doj', width: 12 },
  { header: 'Probation Due Date', key: 'dueDate', width: 18 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Outcome', key: 'outcome', width: 14 },
  { header: 'Extension (Months)', key: 'extensionMonths', width: 18 },
  { header: 'Decided By', key: 'decidedBy', width: 20 },
  { header: 'Overdue?', key: 'isOverdue', width: 10 },
];

const R26_COLS: ExcelColumn[] = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Entity', key: 'company', width: 20 },
  { header: 'Department', key: 'department', width: 18 },
  { header: 'Location', key: 'location', width: 18 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'DOJ', key: 'doj', width: 12 },
  { header: 'DOL / LWD', key: 'dol', width: 12 },
  { header: 'Tenure Band', key: 'tenureBand', width: 14 },
  { header: 'Reason', key: 'reason', width: 24 },
  { header: 'Resignation Date', key: 'resignationDate', width: 16 },
  { header: 'Notice Days', key: 'noticePeriodDays', width: 12 },
  { header: 'Shortfall Days', key: 'shortfallDays', width: 14 },
  { header: 'Exit Type', key: 'exitType', width: 14 },
  { header: 'Status', key: 'status', width: 12 },
];

const R28_COLS: ExcelColumn[] = [
  { header: 'Asset ID', key: 'assetId', width: 10 },
  { header: 'Asset No', key: 'assetNo', width: 14 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Description', key: 'description', width: 24 },
  { header: 'Serial No', key: 'serialNo', width: 18 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Entity', key: 'company', width: 20 },
  { header: 'Location', key: 'location', width: 18 },
  { header: 'Holder Name', key: 'holderName', width: 22 },
  { header: 'Holder Emp ID', key: 'holderEcode', width: 14 },
  { header: 'Holder Kind', key: 'holderKind', width: 14 },
  { header: 'Assigned Date', key: 'assignedAt', width: 14 },
  { header: 'Warranty Till', key: 'warrantyTill', width: 14 },
];

const R29_COLS: ExcelColumn[] = [
  { header: 'Month', key: 'month', width: 12 },
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Total Tickets', key: 'totalTickets', width: 14 },
  { header: 'Resolved', key: 'resolvedTickets', width: 12 },
  { header: 'Resolution Rate %', key: 'resolutionRatePct', width: 18 },
  { header: 'SLA Breached', key: 'breachedCount', width: 14 },
  { header: 'Escalated', key: 'escalatedCount', width: 12 },
  { header: 'Avg 1st Response (h)', key: 'avgFirstResponseHours', width: 20 },
  { header: 'Avg Resolution (h)', key: 'avgResolutionHours', width: 18 },
];

const R30_COLS: ExcelColumn[] = [
  { header: 'Policy ID', key: 'policyId', width: 10 },
  { header: 'Title', key: 'title', width: 28 },
  { header: 'Effective Date', key: 'effectiveDate', width: 14 },
  { header: 'Requires Acknowledgment', key: 'requiresAcknowledgment', width: 24 },
  { header: 'Targeted Headcount', key: 'targetedCount', width: 18 },
  { header: 'Acknowledged', key: 'acknowledgedCount', width: 16 },
  { header: 'Pending (Laggards)', key: 'pendingCount', width: 18 },
  { header: 'Compliance %', key: 'compliancePct', width: 14 },
];

const R31_COLS: ExcelColumn[] = [
  { header: 'Claim ID', key: 'claimId', width: 10 },
  { header: 'Emp ID', key: 'ecode', width: 12 },
  { header: 'Employee Name', key: 'employeeName', width: 22 },
  { header: 'Department', key: 'department', width: 18 },
  { header: 'Claim Type', key: 'claimType', width: 18 },
  { header: 'Period From', key: 'periodFrom', width: 12 },
  { header: 'Period To', key: 'periodTo', width: 12 },
  { header: 'Claimed (₹)', key: 'claimedAmount', width: 14 },
  { header: 'Approved (₹)', key: 'approvedAmount', width: 14 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Bills Count', key: 'billsCount', width: 12 },
  { header: 'Verified Bills', key: 'verifiedBillsCount', width: 14 },
  { header: 'Paid in Run ID', key: 'paidInRunId', width: 14 },
  { header: 'Rejection Reason', key: 'rejectionReason', width: 24 },
];

export async function exportR2Excel(
  db: Kysely<Database>,
  params: {
    companyId: number;
    month: string;
    ecode?: string | undefined;
    scope?: EmployeeScope | undefined;
  },
): Promise<Buffer> {
  return rowsToExcelBuffer('R2 Swipes', R2_COLS, await reportR2Swipes(db, params));
}

export async function exportR3Excel(
  db: Kysely<Database>,
  params: {
    companyId: number;
    kind?: string | undefined;
    status?: string | undefined;
    scope?: EmployeeScope | undefined;
  },
): Promise<Buffer> {
  const rows = await reportR3Regularizations(db, params);
  return rowsToExcelBuffer('R3 AR OD', R3_COLS, rows.map((row) => ({
    ...row,
    timelineSummary: row.timeline.map((step) =>
      `Step ${String(step.stepNo)} ${step.approverName}: notified ${step.notifiedAt}; action ${step.action ?? 'pending'}; acted ${step.actedAt ?? '—'}`,
    ).join(' | '),
  })));
}

export async function exportR4Excel(
  db: Kysely<Database>,
  companyId: number,
  month: string,
  scope?: EmployeeScope,
): Promise<Buffer> {
  return rowsToExcelBuffer(
    'R4 Exceptions',
    R4_COLS,
    await reportR4Exceptions(db, companyId, month, scope),
  );
}

export async function exportR5Excel(
  db: Kysely<Database>,
  companyId: number,
  month: string,
  scope?: EmployeeScope,
): Promise<Buffer> {
  return rowsToExcelBuffer('R5 OT', R5_COLS, await reportR5Ot(db, companyId, month, scope));
}

export async function exportR6Excel(
  db: Kysely<Database>,
  params: {
    companyId: number;
    stage?: string | undefined;
    openOnly?: boolean | undefined;
    scope?: EmployeeScope | undefined;
  },
): Promise<Buffer> {
  return rowsToExcelBuffer('R6 Absence', R6_COLS, await reportR6AbsenceCases(db, params));
}

export async function exportR24Excel(
  db: Kysely<Database>,
  fromDate: string,
  toDate: string,
  companyId: number,
  scope?: EmployeeScope,
): Promise<Buffer> {
  const { joins, exits } = await reportR24Boarding(db, fromDate, toDate, companyId, scope);
  return rowsToExcelBuffer('R24 Boarding Exit', R24_COLS, [...joins, ...exits]);
}

export async function exportR27Excel(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    asOf?: string | undefined;
    fromMonth?: string | undefined;
    toMonth?: string | undefined;
    scope?: EmployeeScope | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer(
    'R27 Headcount',
    R27_COLS,
    await reportR27Headcount(db, params),
  );
}

export async function exportR21Excel(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    status?: string | undefined;
    scope?: EmployeeScope | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer('R21 Offers', R21_COLS, await reportR21Offers(db, params));
}

export async function exportR23Excel(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    scope?: EmployeeScope | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer('R23 Transfers', R23_COLS, await reportR23Transfers(db, params));
}

export async function exportR25Excel(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    status?: string | undefined;
    scope?: EmployeeScope | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer('R25 Probation', R25_COLS, await reportR25Probation(db, params));
}

export async function exportR26Excel(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    scope?: EmployeeScope | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer('R26 Attrition', R26_COLS, await reportR26Attrition(db, params));
}

export async function exportR28Excel(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    status?: string | undefined;
    category?: string | undefined;
    scope?: EmployeeScope | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer('R28 Asset Register', R28_COLS, await reportR28Assets(db, params));
}

export async function exportR29Excel(
  db: Kysely<Database>,
  params: {
    month?: string | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer('R29 Helpdesk SLA', R29_COLS, await reportR29Helpdesk(db, params));
}

export async function exportR30Excel(
  db: Kysely<Database>,
): Promise<Buffer> {
  return rowsToExcelBuffer('R30 Policy Compliance', R30_COLS, await reportR30Policies(db));
}

export async function exportR31Excel(
  db: Kysely<Database>,
  params: {
    companyId?: number | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    status?: string | undefined;
    scope?: EmployeeScope | undefined;
  } = {},
): Promise<Buffer> {
  return rowsToExcelBuffer('R31 Reimbursements', R31_COLS, await reportR31Claims(db, params));
}
