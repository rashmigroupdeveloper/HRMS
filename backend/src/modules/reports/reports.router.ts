/**
 * Stage 1.7 reports + dashboards + month-lock surface.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withAnyPermission, withPermission } from '../../api/orpc.js';
import { booleanQuery } from '../../api/zod.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import type { Database } from '../../core/db/types.js';
import type { EmployeeScope } from '../../core/rbac/employee-scope.js';
import { assertCompanyInScope } from '../../core/rbac/company-scope.js';
import { getUserPermissionAccess } from '../../core/rbac/permissions.service.js';
import type { PermissionAccess } from '../../core/rbac/permissions.service.js';
import type { Kysely } from 'kysely';
import {
  approveManagerMonth,
  getManagerApprovalLedger,
  getMonthLockChecklist,
  lockMonth,
  sessionStatusesSchema,
  penaltyEvaluationSchema,
} from '../attendance/index.js';
import { buildMusterMonth, exportMusterExcel, listMuster } from './muster.service.js';
import { buildKpiSnapshot, kpiTrend, readKpiSnapshot } from './kpi-snapshot.service.js';
import {
  exportR2Excel,
  exportR3Excel,
  exportR4Excel,
  exportR5Excel,
  exportR6Excel,
  exportR21Excel,
  exportR23Excel,
  exportR24Excel,
  exportR25Excel,
  exportR26Excel,
  exportR27Excel,
  exportR28Excel,
  exportR29Excel,
  exportR30Excel,
  exportR31Excel,
} from './reports-export.service.js';
import {
  reportR2Swipes,
  reportR2RawSwipes,
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
import {
  businessUnitDashboard,
  essHome,
  hrOpsDashboard,
  myAttendanceMonth,
  teamMonthGrid,
} from './dashboard.service.js';

/**
 * docs/08 §2 grants report access through THREE parallel permissions to
 * different roles. Scope still narrows the rows (plant_head is org_unit).
 */
const reportGuard = () => withAnyPermission('reports.hr', 'reports.bu', 'reports.ceo');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const closingMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-01)?$/);
const monthStr = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/);
const fileOut = z.object({ filename: z.string(), base64: z.string() });

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
  }
  return user.employee_id;
}

function filePayload(filename: string, buf: Buffer) {
  return { filename, base64: buf.toString('base64') };
}

function employeeScope(context: {
  permissionAccess: PermissionAccess;
  user: { employee_id: number | null };
}): EmployeeScope {
  return { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
}

async function requireCompanyScope(db: Kysely<Database>, scope: EmployeeScope, companyId: number) {
  try { await assertCompanyInScope(db, scope, companyId); }
  catch { throw new ORPCError('FORBIDDEN', { message: 'Company outside your permitted data scope' }); }
}

async function auditedFilePayload(
  db: Kysely<Database>,
  actorUserId: number,
  ip: string | null,
  reportCode: string,
  filters: unknown,
  filename: string,
  buf: Buffer,
) {
  await writeAudit(db, {
    actorUserId,
    action: 'export',
    entity: 'reporting.report_export',
    field: reportCode,
    newValue: JSON.stringify(filters),
    ip,
  });
  return filePayload(filename, buf);
}

// ── Month lock ──────────────────────────────────────────────────────────────

const monthLockChecklist = withPermission('attendance.month_lock')
  .route({ method: 'GET', path: '/attendance/month-lock/checklist', summary: 'ATT-15 pre-lock checklist' })
  .input(z.object({ companyId: z.number().int().positive(), month: closingMonth }))
  .output(
    z.object({
      companyId: z.number(),
      month: z.string(),
      canLock: z.boolean(),
      alreadyLocked: z.boolean(),
      items: z.array(
        z.object({
          code: z.string(),
          label: z.string(),
          ok: z.boolean(),
          detail: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCompanyScope(context.db, employeeScope(context), input.companyId);
    return getMonthLockChecklist(context.db, input.companyId, input.month);
  });

const monthLock = withPermission('attendance.month_lock')
  .route({ method: 'POST', path: '/attendance/month-lock', summary: 'Lock attendance month (typed confirm on UI)' })
  .input(z.object({ companyId: z.number().int().positive(), month: closingMonth }))
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    await requireCompanyScope(context.db, employeeScope(context), input.companyId);
    try {
      return await lockMonth(context.db, {
        companyId: input.companyId,
        month: input.month,
        actorUserId: context.user.id,
        scope: employeeScope(context),
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const managerApprovalRow = z.object({
  managerEmployeeId: z.number(),
  managerEcode: z.string(),
  managerName: z.string(),
  reportCount: z.number(),
  approved: z.boolean(),
  approvedAt: z.string().nullable(),
  approvedByUserId: z.number().nullable(),
  note: z.string().nullable(),
});

/** HR/payroll view of the full company ledger (ATT-12). */
const managerApprovalLedger = withPermission('attendance.month_lock')
  .route({
    method: 'GET',
    path: '/attendance/manager-approvals',
    summary: 'Manager attendance-approval ledger for a company×month (ATT-12)',
  })
  .input(z.object({ companyId: z.number().int().positive(), month: closingMonth }))
  .output(z.array(managerApprovalRow))
  .handler(async ({ input, context }) => {
    await requireCompanyScope(context.db, employeeScope(context), input.companyId);
    return getManagerApprovalLedger(context.db, input.companyId, input.month);
  });

/**
 * Manager self-approval for own team (or HR co-sign via month_lock holders).
 * Managers need attendance.team.read; HR can pass any managerEmployeeId when they
 * hold attendance.month_lock (enforced here via permission OR identity).
 */
const approveManagerAttendance = withPermission('attendance.team.read')
  .route({
    method: 'POST',
    path: '/attendance/manager-approvals',
    summary: 'Approve team attendance for a month (ATT-12)',
  })
  .input(
    z.object({
      companyId: z.number().int().positive(),
      month: closingMonth,
      /** Defaults to the caller's employee_id when omitted. */
      managerEmployeeId: z.number().int().positive().optional(),
      note: z.string().max(500).optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const selfId = context.user.employee_id;
    const targetId = input.managerEmployeeId ?? selfId;
    if (targetId === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
    }
    const isSelf = selfId !== null && selfId === targetId;
    const isHr = context.permissions.has('attendance.month_lock');
    if (!isSelf && !isHr) {
      throw new ORPCError('FORBIDDEN', {
        message: 'You may only approve your own team attendance',
      });
    }
    if (!isSelf) {
      const access = await getUserPermissionAccess(context.db, context.user.id, 'attendance.month_lock', 'write');
      if (!access) throw new ORPCError('FORBIDDEN');
      await requireCompanyScope(context.db, { ...access, actorEmployeeId: selfId }, input.companyId);
    }
    try {
      return await approveManagerMonth(context.db, {
        companyId: input.companyId,
        month: input.month,
        managerEmployeeId: targetId,
        actorUserId: context.user.id,
        note: input.note,
      });
    } catch (error) {
      asBadRequest(error);
    }
  });

// ── Muster R1 ───────────────────────────────────────────────────────────────

const musterBuild = withPermission('attendance.muster.export')
  .route({ method: 'POST', path: '/reports/muster/build', summary: 'Rebuild R1 muster snapshot for company×month' })
  .input(z.object({ companyId: z.number().int().positive(), month: monthStr }))
  .output(z.object({ rows: z.number() }))
  .handler(async ({ input, context }) => ({
    rows: await buildMusterMonth(context.db, input.companyId, input.month),
  }));

const musterRowOut = z.object({
  ecode: z.string(),
  employeeName: z.string(),
  reportingManager: z.string().nullable(),
  functionalManager: z.string().nullable(),
  department: z.string().nullable(),
  designation: z.string().nullable(),
  orgUnit: z.string().nullable(),
  costCenter: z.string().nullable(),
  contact: z.string().nullable(),
  category: z.string().nullable(),
  dayStatuses: z.record(z.string()),
  leaveByType: z.record(z.number()),
  present: z.number(),
  absent: z.number(),
  halfDays: z.number(),
  weekoffs: z.number(),
  weekoffsUnpaid: z.number(),
  holidays: z.number(),
  leaveDays: z.number(),
  odDays: z.number(),
  coDays: z.number(),
  uabDays: z.number(),
  lopDays: z.number(),
  otHours: z.number(),
});

/** Shared R1 filter contract — list and export must stay identical (RPT-06). */
const musterFilterInput = z.object({
  companyId: z.number().int().positive(),
  month: monthStr,
  department: z.string().min(1).optional(),
  costCenter: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  orgUnit: z.string().min(1).optional(),
  category: z
    .enum(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract'])
    .optional(),
  employeeStatus: z.enum(['active', 'on_notice', 'exited', 'onboarding']).optional(),
  reportingManagerId: z.number().int().positive().optional(),
  subtree: z.boolean().optional(),
  ecode: z.string().min(1).optional(),
});

const musterList = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/muster', summary: 'R1 Muster Summary list (from snapshot)' })
  .input(musterFilterInput)
  .output(z.array(musterRowOut))
  .handler(async ({ input, context }) =>
    listMuster(context.db, { ...input, scope: employeeScope(context) }),
  );

const musterExport = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/muster/export', summary: 'R1 Muster Excel export (same filters as list)' })
  .input(musterFilterInput)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const filters = { ...input, scope: employeeScope(context) };
    const buf = await exportMusterExcel(context.db, filters);
    return auditedFilePayload(
      context.db,
      context.user.id,
      context.req.ip ?? null,
      'R1',
      input,
      `muster-${input.month}.xlsx`,
      buf,
    );
  });

// ── Supporting reports R2–R6, R24, R27 ──────────────────────────────────────

const r2Row = z.object({
  ecode: z.string(),
  employeeName: z.string(),
  workDate: z.string(),
  status: z.string(),
  firstIn: z.string().nullable(),
  lastOut: z.string().nullable(),
  workedMinutes: z.number().nullable(),
  lateMinutes: z.number(),
  earlyExitMinutes: z.number(),
  otMinutes: z.number(),
  firstDoor: z.string().nullable(),
  lastDoor: z.string().nullable(),
  mappedLocation: z.string().nullable(),
  majoritySwipeLocation: z.string().nullable(),
  crossPlantFlag: z.boolean(),
  rawSwipeCount: z.number(),
  statusVsSwipes: z.enum([
    'match',
    'status_without_swipes',
    'swipes_without_presence',
    'both_absent',
  ]),
});

const r2Input = z.object({
  companyId: z.number().int().positive(),
  month: monthStr,
  ecode: z.string().min(1).optional(),
});

const r2 = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r2-swipes', summary: 'R2 daily attendance / swipe detail' })
  .input(r2Input)
  .output(z.array(r2Row))
  .handler(async ({ input, context }) =>
    reportR2Swipes(context.db, { ...input, scope: employeeScope(context) }),
  );

const r2Export = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r2-swipes/export', summary: 'R2 Excel (same filters as list)' })
  .input(r2Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR2Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R2', input, `r2-swipes-${input.month}.xlsx`, buf);
  });

const r2RawSwipeRow = z.object({
  employeeNo: z.string(),
  accessCard: z.string().nullable(),
  shiftLabel: z.string().nullable(),
  swipeTs: z.string(),
  doorCode: z.string().nullable(),
  longitude: z.string().nullable(),
  latitude: z.string().nullable(),
  locationType: z.string().nullable(),
  mobileDeviceName: z.string().nullable(),
  mobileDeviceId: z.string().nullable(),
  swipeType: z.string().nullable(),
  direction: z.string().nullable(),
  remarks: z.string().nullable(),
  permissionReason: z.string().nullable(),
  signedBy: z.string().nullable(),
  receivedAt: z.string(),
  source: z.string(),
});

const r2Raw = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r2-swipes/raw', summary: 'R2 lossless raw-swipe drill-down' })
  .input(z.object({ ecode: z.string().min(1), workDate: isoDate }))
  .output(z.array(r2RawSwipeRow))
  .handler(async ({ input, context }) =>
    reportR2RawSwipes(context.db, { ...input, scope: employeeScope(context) }),
  );

const r3Row = z.object({
  id: z.number(),
  ecode: z.string(),
  employeeName: z.string(),
  kind: z.string(),
  dayPortion: z.string(),
  fromDate: z.string(),
  toDate: z.string(),
  fromTime: z.string().nullable(),
  toTime: z.string().nullable(),
  reason: z.string(),
  requestedStatus: z.string(),
  applied: z.boolean(),
  workflowStatus: z.string(),
  currentStep: z.number(),
  decidedAt: z.string().nullable(),
  timeline: z.array(z.object({
    stepNo: z.number(),
    approverName: z.string(),
    delegatedFromName: z.string().nullable(),
    action: z.string().nullable(),
    comment: z.string().nullable(),
    notifiedAt: z.string(),
    actedAt: z.string().nullable(),
    slaDueAt: z.string(),
  })),
});

const r3Input = z.object({
  companyId: z.number().int().positive(),
  kind: z.string().optional(),
  status: z.string().optional(),
});

const r3 = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r3-regularizations', summary: 'R3 AR/OD report' })
  .input(r3Input)
  .output(z.array(r3Row))
  .handler(async ({ input, context }) =>
    reportR3Regularizations(context.db, { ...input, scope: employeeScope(context) }),
  );

const r3Export = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r3-regularizations/export', summary: 'R3 Excel' })
  .input(r3Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR3Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R3', input, `r3-regularizations-${String(input.companyId)}.xlsx`, buf);
  });

const r4Row = z.object({
  ecode: z.string(),
  employeeName: z.string(),
  workDate: z.string(),
  status: z.string(),
  lateMinutes: z.number(),
  earlyExitMinutes: z.number(),
  monthlyExceptionCount: z.number(),
  monthlyLateMinutes: z.number(),
  monthlyEarlyExitMinutes: z.number(),
  monthlyUabDays: z.number(),
});

const r4Input = z.object({ companyId: z.number().int().positive(), month: monthStr });

const r4 = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r4-exceptions', summary: 'R4 late/early/UAB' })
  .input(r4Input)
  .output(z.array(r4Row))
  .handler(async ({ input, context }) =>
    reportR4Exceptions(context.db, input.companyId, input.month, employeeScope(context)),
  );

const r4Export = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r4-exceptions/export', summary: 'R4 Excel' })
  .input(r4Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR4Excel(context.db, input.companyId, input.month, employeeScope(context));
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R4', input, `r4-exceptions-${input.month}.xlsx`, buf);
  });

const r5Row = z.object({
  ecode: z.string(),
  employeeName: z.string(),
  workDate: z.string(),
  detectedMinutes: z.number(),
  claimedMinutes: z.number(),
  approvedMinutes: z.number().nullable(),
  status: z.string(),
  managerEcode: z.string().nullable(),
  managerName: z.string().nullable(),
  deadlineAt: z.string(),
  decidedAt: z.string().nullable(),
  decisionLatencyHours: z.number().nullable(),
  convertedCompOff: z.boolean(),
  compOffCreditId: z.number().nullable(),
  payrollItemId: z.number().nullable(),
  within48h: z.boolean().nullable(),
  managerDecisionCount: z.number(),
  managerAverageLatencyHours: z.number().nullable(),
});

const r5Input = z.object({ companyId: z.number().int().positive(), month: monthStr });

// The manager-latency league table is explicitly HR-only (docs/06 R5).
const r5 = reportGuard()
  .route({ method: 'GET', path: '/reports/r5-ot', summary: 'R5 OT register' })
  .input(r5Input)
  .output(z.array(r5Row))
  .handler(async ({ input, context }) =>
    reportR5Ot(context.db, input.companyId, input.month, employeeScope(context)),
  );

const r5Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r5-ot/export', summary: 'R5 Excel' })
  .input(r5Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR5Excel(context.db, input.companyId, input.month, employeeScope(context));
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R5', input, `r5-ot-${input.month}.xlsx`, buf);
  });

const r6Row = z.object({
  id: z.number(),
  ecode: z.string(),
  employeeName: z.string(),
  startDate: z.string(),
  daysAbsent: z.number(),
  stage: z.string(),
  ownerName: z.string().nullable(),
  letterId: z.number().nullable(),
  letterStatus: z.string().nullable(),
  letterContentPath: z.string().nullable(),
  resolution: z.string().nullable(),
  closedAt: z.string().nullable(),
});

const r6Input = z.object({
  companyId: z.number().int().positive(),
  stage: z.string().optional(),
  openOnly: z.boolean().optional(),
});

const r6 = reportGuard()
  .route({ method: 'GET', path: '/reports/r6-absence', summary: 'R6 absence cases' })
  .input(r6Input)
  .output(z.array(r6Row))
  .handler(async ({ input, context }) =>
    reportR6AbsenceCases(context.db, { ...input, scope: employeeScope(context) }),
  );

const r6Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r6-absence/export', summary: 'R6 Excel' })
  .input(r6Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR6Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R6', input, `r6-absence-${String(input.companyId)}.xlsx`, buf);
  });

const boardingRow = z.object({
  ecode: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  reportingManager: z.string().nullable(),
  costCenter: z.string().nullable(),
  location: z.string().nullable(),
  doj: z.string().nullable(),
  dol: z.string().nullable(),
  exitReason: z.string().nullable(),
  kind: z.enum(['join', 'exit']),
});

const r24Input = z.object({
  companyId: z.number().int().positive().optional(),
  fromDate: isoDate,
  toDate: isoDate,
}).refine((value) => value.fromDate <= value.toDate, {
  message: 'fromDate must be on or before toDate',
  path: ['toDate'],
});

const r24 = reportGuard()
  .route({ method: 'GET', path: '/reports/r24-boarding', summary: 'R24 boarding/exit for a date range' })
  .input(r24Input)
  .output(z.object({ joins: z.array(boardingRow), exits: z.array(boardingRow) }))
  .handler(async ({ input, context }) =>
    reportR24Boarding(context.db, input.fromDate, input.toDate, input.companyId, employeeScope(context)),
  );

const r24Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r24-boarding/export', summary: 'R24 Excel' })
  .input(r24Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR24Excel(context.db, input.fromDate, input.toDate, input.companyId, employeeScope(context));
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R24', input, `r24-boarding-${input.fromDate}-${input.toDate}.xlsx`, buf);
  });

const r27Row = z.object({
  snapshotDate: z.string(),
  status: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  category: z.string().nullable(),
  department: z.string().nullable(),
  grade: z.string().nullable(),
  gender: z.string().nullable(),
  ageBand: z.string(),
  tenureBand: z.string(),
  count: z.number(),
});

const r27Input = z.object({
  companyId: z.number().int().positive().optional(),
  asOf: isoDate.optional(),
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  toMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
}).refine((value) =>
  (value.fromMonth === undefined && value.toMonth === undefined) ||
  (value.fromMonth !== undefined && value.toMonth !== undefined && value.fromMonth <= value.toMonth),
  { message: 'fromMonth and toMonth must be supplied together in ascending order' },
).refine((value) => {
  if (value.fromMonth === undefined || value.toMonth === undefined) return true;
  const [fromYear, fromMonth] = value.fromMonth.split('-').map(Number);
  const [toYear, toMonth] = value.toMonth.split('-').map(Number);
  return ((toYear ?? 0) * 12 + (toMonth ?? 0)) - ((fromYear ?? 0) * 12 + (fromMonth ?? 0)) <= 59;
},
  { message: 'Headcount trend is limited to 60 months per request' },
).optional();

const r27 = reportGuard()
  .route({ method: 'GET', path: '/reports/r27-headcount', summary: 'R27 headcount demographics' })
  .input(r27Input)
  .output(z.array(r27Row))
  .handler(async ({ input, context }) =>
    reportR27Headcount(context.db, { ...input, scope: employeeScope(context) }),
  );

const r27Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r27-headcount/export', summary: 'R27 Excel' })
  .input(r27Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR27Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R27', input ?? {}, 'r27-headcount.xlsx', buf);
  });

// ── Dashboards / ESS ────────────────────────────────────────────────────────

// NOT reportGuard: this is an OPERATIONAL dashboard, and docs/08 §3 is
// explicit that ceo_cell gets "no operational screens".
const hrDashboard = withPermission('reports.hr')
  .route({ method: 'GET', path: '/dashboards/hr-ops', summary: 'HR Ops home KPIs (05 §4.1)' })
  .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
  .output(z.object({
    asOf: z.string(),
    headcountByCategory: z.array(z.object({ category: z.string().nullable(), count: z.number() })),
    joinersMtd: z.number(),
    exitsMtd: z.number(),
    absentToday: z.number(),
    expectedToday: z.number(),
    processedToday: z.number(),
    awaitingToday: z.number(),
    pendingApprovals: z.number(),
    openAbsenceByStage: z.array(z.object({ stage: z.string(), count: z.number() })),
    pendingOt: z.number(),
    silentDevices: z.number(),
    policyAckPercent: z.number(),
  }))
  .handler(async ({ input, context }) => hrOpsDashboard(context.db, input?.companyId, employeeScope(context)));

const ess = withPermission('attendance.own')
  .route({ method: 'GET', path: '/dashboards/ess', summary: 'ESS home (05 §4.9)' })
  .output(z.object({
    greetingName: z.string(),
    ecode: z.string(),
    today: z.string(),
    shift: z.object({
      code: z.string(),
      name: z.string(),
      startTime: z.string(),
      endTime: z.string(),
    }).nullable(),
    todayStatus: z.object({
      status: z.string(),
      firstIn: z.string().nullable(),
      lastOut: z.string().nullable(),
    }).nullable(),
    leaveBalances: z.array(z.object({
      leaveTypeId: z.number(),
      code: z.string(),
      name: z.string(),
      balance: z.number(),
      available: z.number(),
      isPaid: z.boolean(),
    })),
    pendingRequests: z.number(),
  }))
  .handler(async ({ context }) => essHome(context.db, requireEmployeeId(context.user)));

const myAttendance = withPermission('attendance.own')
  .route({ method: 'GET', path: '/my/attendance', summary: 'My attendance month calendar (ESS)' })
  .input(z.object({ month: monthStr }))
  .output(z.array(z.object({
    date: z.string(),
    status: z.string(),
    sessionStatuses: sessionStatusesSchema.nullable(),
    source: z.enum(['auto', 'regularized', 'manual']),
    isLocked: z.boolean(),
    leaveTypeCode: z.string().nullable(),
    leaveTypeName: z.string().nullable(),
    leaveIsPaid: z.boolean().nullable(),
    firstIn: z.string().nullable(),
    lastOut: z.string().nullable(),
    workedMinutes: z.number().nullable(),
    otMinutes: z.number(),
    lateMinutes: z.number(),
    penaltyFlag: z.boolean(),
    penaltyEvaluation: penaltyEvaluationSchema,
  })))
  .handler(async ({ input, context }) =>
    myAttendanceMonth(context.db, requireEmployeeId(context.user), input.month),
  );

const teamGrid = withPermission('attendance.team.read')
  .route({ method: 'GET', path: '/my/team/grid', summary: 'Manager team month grid' })
  .input(z.object({ month: monthStr, subtree: booleanQuery().optional() }))
  .output(z.array(z.object({
    employeeId: z.number(),
    ecode: z.string(),
    name: z.string(),
    days: z.record(z.object({
      status: z.string(),
      firstIn: z.string().nullable(),
      lastOut: z.string().nullable(),
    })),
  })))
  .handler(async ({ input, context }) => {
    const managerId = requireEmployeeId(context.user);
    return teamMonthGrid(context.db, managerId, input.month, input.subtree ?? false);
  });

/**
 * RPT-03 — the CEO dashboard reads a PRECOMPUTED snapshot. It never triggers an
 * aggregation: opening this page must not scan att.day_records (docs/06 §4,
 * CLAUDE.md §1.9). A metric that cannot be computed yet comes back with a null
 * value AND a reason, so the UI explains the gap instead of showing a zero.
 */
const executiveKpis = withPermission('reports.ceo')
  .route({ method: 'GET', path: '/reports/executive', summary: 'RPT-03 CEO dashboard KPI snapshot' })
  .input(z.object({ date: isoDate.optional() }).optional())
  .output(
    z.object({
      snapshotDate: z.string(),
      computedAt: z.string().nullable(),
      metrics: z.array(
        z.object({
          companyId: z.number().nullable(),
          category: z.string(),
          metric: z.string(),
          value: z.number().nullable(),
          unavailableReason: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const snapshot = await readKpiSnapshot(context.db, { date: input?.date });
    if (!snapshot) {
      throw new ORPCError('NOT_FOUND', {
        message: 'No KPI snapshot has been built yet — run the nightly job or rebuild now.',
      });
    }
    return snapshot;
  });

/**
 * RPT-04 — the Business-Unit dashboard (docs/06 §5). Gated on `reports.bu`
 * (plant heads) or `reports.hr` (HR previewing a plant), and scoped so a plant
 * head can never see another plant's numbers.
 */
const businessUnit = withAnyPermission('reports.bu', 'reports.hr')
  .route({ method: 'GET', path: '/dashboards/business-unit', summary: 'RPT-04 BU / plant dashboard' })
  .input(
    z.object({
      companyId: z.coerce.number().int().positive().optional(),
      locationId: z.coerce.number().int().positive().optional(),
    }).optional(),
  )
  .output(
    z.object({
      scopeLabel: z.string(),
      headcount: z.array(z.object({ category: z.string(), count: z.number() })),
      headcountTotal: z.number(),
      absentToday: z.number(),
      scheduledToday: z.number(),
      presenceTodayPct: z.number().nullable(),
      shiftScheduleCompliancePct: z.number().nullable(),
      absenteeismTodayPct: z.number().nullable(),
      otHoursMtd: z.number(),
      activeOvertimeHours: z.number(),
      pendingApprovalsCount: z.number(),
      joinersMtd: z.number(),
      exitsMtd: z.number(),
      openAbsenceCases: z.array(z.object({ stage: z.string(), count: z.number() })),
    }),
  )
  .handler(({ input, context }) =>
    businessUnitDashboard(context.db, {
      companyId: input?.companyId,
      locationId: input?.locationId,
      all: context.permissionAccess.all,
      orgUnitIds: context.permissionAccess.orgUnitIds,
      actorEmployeeId: context.user.employee_id,
    }),
  );

/** Trend series for the dashboard charts — reads snapshots, never aggregates. */
const executiveTrend = reportGuard()
  .route({ method: 'GET', path: '/reports/executive/trend', summary: 'KPI trend from the daily snapshots' })
  .input(
    z.object({
      metric: z.string().min(1),
      months: z.coerce.number().int().min(1).max(24).optional(),
      category: z.string().optional(),
    }),
  )
  .output(z.array(z.object({ label: z.string(), date: z.string(), value: z.number().nullable() })))
  .handler(({ input, context }) => kpiTrend(context.db, input));

const rebuildExecutiveKpis = withAnyPermission('reports.ceo', 'reports.hr', 'admin.integrations', 'admin.settings')
  .route({ method: 'POST', path: '/reports/executive/rebuild', summary: 'Rebuild the KPI snapshot now' })
  .input(z.object({ date: isoDate.optional() }).optional())
  .output(z.object({ snapshotDate: z.string(), metrics: z.number() }))
  .handler(async ({ input, context }) => {
    return buildKpiSnapshot(context.db, { date: input?.date });
  });

const executiveLeavers = withAnyPermission('reports.ceo', 'reports.hr')
  .route({ method: 'GET', path: '/reports/executive/leavers', summary: 'Leavers drill-down for executive attrition KPI' })
  .input(z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).optional())
  .output(
    z.array(
      z.object({
        id: z.number(),
        employeeName: z.string(),
        ecode: z.string(),
        company: z.string(),
        department: z.string().nullable(),
        location: z.string().nullable(),
        category: z.string(),
        dol: z.string().nullable(),
        reason: z.string(),
        exitType: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const list = await reportR26Attrition(context.db, { scope: employeeScope(context) });
    return list.slice(0, input?.limit ?? 50).map((r) => ({
      id: r.id,
      employeeName: r.employeeName,
      ecode: r.ecode,
      company: r.company,
      department: r.department,
      location: r.location,
      category: r.category,
      dol: r.dol,
      reason: r.reason,
      exitType: r.exitType,
    }));
  });

// ── R21 Offers ─────────────────────────────────────────────────────────────
const r21Row = z.object({
  id: z.number(),
  candidateName: z.string(),
  orgUnit: z.string().nullable(),
  designationOffered: z.string(),
  doj: z.string(),
  offerDate: z.string(),
  offeredSalary: z.number(),
  probationPercentage: z.number(),
  loiStatus: z.enum(['Accepted', 'Rejected', 'Yet to Accept']),
  workLocation: z.string().nullable(),
  status: z.string(),
});

const r21Input = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
  status: z.string().optional(),
}).optional();

const r21 = reportGuard()
  .route({ method: 'GET', path: '/reports/r21-offers', summary: 'R21 offers & candidates' })
  .input(r21Input)
  .output(z.array(r21Row))
  .handler(async ({ input, context }) =>
    reportR21Offers(context.db, { ...input, scope: employeeScope(context) }),
  );

const r21Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r21-offers/export', summary: 'R21 Excel' })
  .input(r21Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR21Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R21', input, 'r21-offers.xlsx', buf);
  });

// ── R23 Transfers ──────────────────────────────────────────────────────────
const r23Row = z.object({
  id: z.number(),
  employeeName: z.string(),
  ecode: z.string(),
  fromCompany: z.string(),
  toCompany: z.string().nullable(),
  fromDepartment: z.string().nullable(),
  toDepartment: z.string().nullable(),
  fromLocation: z.string().nullable(),
  toLocation: z.string().nullable(),
  transferType: z.string(),
  effectiveDate: z.string(),
  status: z.string(),
  approverName: z.string().nullable(),
});

const r23Input = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
}).optional();

const r23 = reportGuard()
  .route({ method: 'GET', path: '/reports/r23-transfers', summary: 'R23 promotions & transfers' })
  .input(r23Input)
  .output(z.array(r23Row))
  .handler(async ({ input, context }) =>
    reportR23Transfers(context.db, { ...input, scope: employeeScope(context) }),
  );

const r23Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r23-transfers/export', summary: 'R23 Excel' })
  .input(r23Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR23Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R23', input, 'r23-transfers.xlsx', buf);
  });

// ── R25 Probation ──────────────────────────────────────────────────────────
const r25Row = z.object({
  id: z.number(),
  employeeName: z.string(),
  ecode: z.string(),
  department: z.string().nullable(),
  designation: z.string().nullable(),
  doj: z.string().nullable(),
  dueDate: z.string(),
  status: z.string(),
  outcome: z.string().nullable(),
  extensionMonths: z.number().nullable(),
  decidedBy: z.string().nullable(),
  isOverdue: z.boolean(),
});

const r25Input = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
}).optional();

const r25 = reportGuard()
  .route({ method: 'GET', path: '/reports/r25-probation', summary: 'R25 probation reviews' })
  .input(r25Input)
  .output(z.array(r25Row))
  .handler(async ({ input, context }) =>
    reportR25Probation(context.db, { ...input, scope: employeeScope(context) }),
  );

const r25Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r25-probation/export', summary: 'R25 Excel' })
  .input(r25Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR25Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R25', input, 'r25-probation.xlsx', buf);
  });

// ── R26 Attrition ──────────────────────────────────────────────────────────
const r26Row = z.object({
  id: z.number(),
  employeeName: z.string(),
  ecode: z.string(),
  company: z.string(),
  department: z.string().nullable(),
  location: z.string().nullable(),
  category: z.string(),
  doj: z.string().nullable(),
  dol: z.string().nullable(),
  tenureBand: z.string(),
  reason: z.string(),
  resignationDate: z.string(),
  noticePeriodDays: z.number(),
  shortfallDays: z.number(),
  exitType: z.enum(['Voluntary', 'Involuntary']),
  status: z.string(),
});

const r26Input = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
}).optional();

const r26 = reportGuard()
  .route({ method: 'GET', path: '/reports/r26-attrition', summary: 'R26 exit and attrition' })
  .input(r26Input)
  .output(z.array(r26Row))
  .handler(async ({ input, context }) =>
    reportR26Attrition(context.db, { ...input, scope: employeeScope(context) }),
  );

const r26Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r26-attrition/export', summary: 'R26 Excel' })
  .input(r26Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR26Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R26', input, 'r26-attrition.xlsx', buf);
  });

// ── R28 Assets ─────────────────────────────────────────────────────────────
const r28Row = z.object({
  assetId: z.number(),
  assetNo: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  serialNo: z.string().nullable(),
  status: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  holderName: z.string().nullable(),
  holderEcode: z.string().nullable(),
  holderKind: z.string().nullable(),
  assignedAt: z.string().nullable(),
  warrantyTill: z.string().nullable(),
});

const r28Input = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
}).optional();

const r28 = reportGuard()
  .route({ method: 'GET', path: '/reports/r28-assets', summary: 'R28 asset custody register' })
  .input(r28Input)
  .output(z.array(r28Row))
  .handler(async ({ input, context }) =>
    reportR28Assets(context.db, { ...input, scope: employeeScope(context) }),
  );

const r28Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r28-assets/export', summary: 'R28 Excel' })
  .input(r28Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR28Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R28', input, 'r28-assets.xlsx', buf);
  });

// ── R29 Helpdesk Performance ───────────────────────────────────────────────
const r29Row = z.object({
  month: z.string(),
  category: z.string(),
  totalTickets: z.number(),
  resolvedTickets: z.number(),
  resolutionRatePct: z.number(),
  breachedCount: z.number(),
  escalatedCount: z.number(),
  avgFirstResponseHours: z.number().nullable(),
  avgResolutionHours: z.number().nullable(),
});

const r29Input = z.object({
  month: monthStr.optional(),
}).optional();

const r29 = reportGuard()
  .route({ method: 'GET', path: '/reports/r29-helpdesk', summary: 'R29 helpdesk monthly performance' })
  .input(r29Input)
  .output(z.array(r29Row))
  .handler(async ({ input, context }) =>
    reportR29Helpdesk(context.db, input),
  );

const r29Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r29-helpdesk/export', summary: 'R29 Excel' })
  .input(r29Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR29Excel(context.db, input);
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R29', input, 'r29-helpdesk.xlsx', buf);
  });

// ── R30 Policy Compliance ──────────────────────────────────────────────────
const r30Row = z.object({
  policyId: z.number(),
  title: z.string(),
  effectiveDate: z.string(),
  requiresAcknowledgment: z.boolean(),
  targetedCount: z.number(),
  acknowledgedCount: z.number(),
  pendingCount: z.number(),
  compliancePct: z.number(),
});

const r30 = reportGuard()
  .route({ method: 'GET', path: '/reports/r30-policies', summary: 'R30 policy compliance matrix' })
  .output(z.array(r30Row))
  .handler(async ({ context }) => reportR30Policies(context.db));

const r30Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r30-policies/export', summary: 'R30 Excel' })
  .output(fileOut)
  .handler(async ({ context }) => {
    const buf = await exportR30Excel(context.db);
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R30', {}, 'r30-policies.xlsx', buf);
  });

// ── R31 Reimbursements ─────────────────────────────────────────────────────
const r31Row = z.object({
  claimId: z.number(),
  employeeName: z.string(),
  ecode: z.string(),
  department: z.string().nullable(),
  claimType: z.string(),
  periodFrom: z.string(),
  periodTo: z.string(),
  claimedAmount: z.number(),
  approvedAmount: z.number().nullable(),
  status: z.string(),
  billsCount: z.number(),
  verifiedBillsCount: z.number(),
  paidInRunId: z.number().nullable(),
  rejectionReason: z.string().nullable(),
});

const r31Input = z.object({
  companyId: z.coerce.number().int().positive().optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
  status: z.string().optional(),
}).optional();

const r31 = reportGuard()
  .route({ method: 'GET', path: '/reports/r31-claims', summary: 'R31 reimbursements register' })
  .input(r31Input)
  .output(z.array(r31Row))
  .handler(async ({ input, context }) =>
    reportR31Claims(context.db, { ...input, scope: employeeScope(context) }),
  );

const r31Export = reportGuard()
  .route({ method: 'GET', path: '/reports/r31-claims/export', summary: 'R31 Excel' })
  .input(r31Input)
  .output(fileOut)
  .handler(async ({ input, context }) => {
    const buf = await exportR31Excel(context.db, { ...input, scope: employeeScope(context) });
    return auditedFilePayload(context.db, context.user.id, context.req.ip ?? null, 'R31', input, 'r31-reimbursements.xlsx', buf);
  });

export const reportsRouter = {
  executiveKpis,
  executiveTrend,
  executiveLeavers,
  businessUnit,
  rebuildExecutiveKpis,
  monthLockChecklist,
  monthLock,
  managerApprovalLedger,
  approveManagerAttendance,
  musterBuild,
  musterList,
  musterExport,
  r2,
  r2Raw,
  r2Export,
  r3,
  r3Export,
  r4,
  r4Export,
  r5,
  r5Export,
  r6,
  r6Export,
  r21,
  r21Export,
  r23,
  r23Export,
  r24,
  r24Export,
  r25,
  r25Export,
  r26,
  r26Export,
  r27,
  r27Export,
  r28,
  r28Export,
  r29,
  r29Export,
  r30,
  r30Export,
  r31,
  r31Export,
  hrDashboard,
  ess,
  myAttendance,
  teamGrid,
};
