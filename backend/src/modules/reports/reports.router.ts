/**
 * Stage 1.7 reports + dashboards + month-lock surface.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import {
  getMonthLockChecklist,
  lockMonth,
} from '../attendance/index.js';
import { buildMusterMonth, exportMusterExcel, listMuster } from './muster.service.js';
import {
  reportR2Swipes,
  reportR3Regularizations,
  reportR4Exceptions,
  reportR5Ot,
  reportR6AbsenceCases,
  reportR24Boarding,
  reportR27Headcount,
} from './reports.service.js';
import { essHome, hrOpsDashboard, myAttendanceMonth, teamMonthGrid } from './dashboard.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthStr = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/);

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
  }
  return user.employee_id;
}

// ── Month lock ──────────────────────────────────────────────────────────────

const monthLockChecklist = withPermission('attendance.month_lock')
  .route({ method: 'GET', path: '/attendance/month-lock/checklist', summary: 'ATT-15 pre-lock checklist' })
  .input(z.object({ companyId: z.number().int().positive(), month: monthStr }))
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
  .handler(async ({ input, context }) => getMonthLockChecklist(context.db, input.companyId, input.month));

const monthLock = withPermission('attendance.month_lock')
  .route({ method: 'POST', path: '/attendance/month-lock', summary: 'Lock attendance month (typed confirm on UI)' })
  .input(z.object({ companyId: z.number().int().positive(), month: monthStr }))
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      return await lockMonth(context.db, {
        companyId: input.companyId,
        month: input.month,
        actorUserId: context.user.id,
      });
    } catch (err) {
      asBadRequest(err);
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

const musterList = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/muster', summary: 'R1 Muster Summary list (from snapshot)' })
  .input(z.object({ companyId: z.number().int().positive(), month: monthStr }))
  .output(
    z.array(
      z.object({
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
      }),
    ),
  )
  .handler(async ({ input, context }) =>
    listMuster(context.db, { companyId: input.companyId, month: input.month }),
  );

const musterExport = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/muster/export', summary: 'R1 Muster Excel export' })
  .input(z.object({ companyId: z.number().int().positive(), month: monthStr }))
  .output(z.object({ filename: z.string(), base64: z.string() }))
  .handler(async ({ input, context }) => {
    const buf = await exportMusterExcel(context.db, { companyId: input.companyId, month: input.month });
    return {
      filename: `muster-${input.month}.xlsx`,
      base64: buf.toString('base64'),
    };
  });

// ── Supporting reports ──────────────────────────────────────────────────────

const r2 = withPermission('attendance.team.read')
  .route({ method: 'GET', path: '/reports/r2-swipes', summary: 'R2 daily attendance / swipe detail' })
  .input(z.object({ employeeId: z.number().int().positive(), fromDate: isoDate, toDate: isoDate }))
  .output(z.array(z.object({
    workDate: z.string(),
    status: z.string(),
    firstIn: z.string().nullable(),
    lastOut: z.string().nullable(),
    workedMinutes: z.number().nullable(),
    lateMinutes: z.number(),
    earlyExitMinutes: z.number(),
    otMinutes: z.number(),
  })))
  .handler(async ({ input, context }) => reportR2Swipes(context.db, input));

const r3 = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r3-regularizations', summary: 'R3 AR/OD report' })
  .input(z.object({ companyId: z.number().int().positive() }))
  .output(z.array(z.object({
    id: z.number(),
    ecode: z.string(),
    kind: z.string(),
    fromDate: z.string(),
    toDate: z.string(),
    reason: z.string(),
    applied: z.boolean(),
    workflowStatus: z.string(),
  })))
  .handler(async ({ input, context }) => reportR3Regularizations(context.db, input.companyId));

const r4 = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r4-exceptions', summary: 'R4 late/early/UAB' })
  .input(z.object({ companyId: z.number().int().positive(), month: monthStr }))
  .output(z.array(z.object({
    ecode: z.string(),
    workDate: z.string(),
    status: z.string(),
    lateMinutes: z.number(),
    earlyExitMinutes: z.number(),
  })))
  .handler(async ({ input, context }) => reportR4Exceptions(context.db, input.companyId, input.month));

const r5 = withPermission('attendance.muster.export')
  .route({ method: 'GET', path: '/reports/r5-ot', summary: 'R5 OT register' })
  .input(z.object({ companyId: z.number().int().positive(), month: monthStr }))
  .output(z.array(z.object({
    ecode: z.string(),
    workDate: z.string(),
    detectedMinutes: z.number(),
    claimedMinutes: z.number(),
    approvedMinutes: z.number().nullable(),
    status: z.string(),
    deadlineAt: z.string(),
    decidedAt: z.string().nullable(),
    convertedCompOff: z.boolean(),
  })))
  .handler(async ({ input, context }) => reportR5Ot(context.db, input.companyId, input.month));

const r6 = withPermission('reports.hr')
  .route({ method: 'GET', path: '/reports/r6-absence', summary: 'R6 absence cases' })
  .input(z.object({ companyId: z.number().int().positive() }))
  .output(z.array(z.object({
    id: z.number(),
    ecode: z.string(),
    startDate: z.string(),
    daysAbsent: z.number(),
    stage: z.string(),
    letterId: z.number().nullable(),
    resolution: z.string().nullable(),
    closedAt: z.string().nullable(),
  })))
  .handler(async ({ input, context }) => reportR6AbsenceCases(context.db, input.companyId));

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

const r24 = withPermission('reports.hr')
  .route({ method: 'GET', path: '/reports/r24-boarding', summary: 'R24 boarding/exit for a date' })
  .input(z.object({ companyId: z.number().int().positive(), reportDate: isoDate }))
  .output(z.object({ joins: z.array(boardingRow), exits: z.array(boardingRow) }))
  .handler(async ({ input, context }) =>
    reportR24Boarding(context.db, input.reportDate, input.companyId),
  );

const r27 = withPermission('reports.hr')
  .route({ method: 'GET', path: '/reports/r27-headcount', summary: 'R27 headcount demographics' })
  .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
  .output(z.array(z.object({
    status: z.string(),
    category: z.string().nullable(),
    count: z.number(),
  })))
  .handler(async ({ input, context }) => reportR27Headcount(context.db, input?.companyId));

// ── Dashboards / ESS ────────────────────────────────────────────────────────

const hrDashboard = withPermission('reports.hr')
  .route({ method: 'GET', path: '/dashboards/hr-ops', summary: 'HR Ops home KPIs (05 §4.1)' })
  .input(z.object({ companyId: z.number().int().positive().optional() }).optional())
  .output(z.object({
    asOf: z.string(),
    headcountByCategory: z.array(z.object({ category: z.string().nullable(), count: z.number() })),
    joinersMtd: z.number(),
    exitsMtd: z.number(),
    absentToday: z.number(),
    pendingApprovals: z.number(),
    openAbsenceByStage: z.array(z.object({ stage: z.string(), count: z.number() })),
    pendingOt: z.number(),
    silentDevices: z.number(),
    policyAckPercent: z.number(),
  }))
  .handler(async ({ input, context }) => hrOpsDashboard(context.db, input?.companyId));

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
    firstIn: z.string().nullable(),
    lastOut: z.string().nullable(),
    otMinutes: z.number(),
    lateMinutes: z.number(),
  })))
  .handler(async ({ input, context }) =>
    myAttendanceMonth(context.db, requireEmployeeId(context.user), input.month),
  );

const teamGrid = withPermission('attendance.team.read')
  .route({ method: 'GET', path: '/my/team/grid', summary: 'Manager team month grid' })
  .input(z.object({ month: monthStr, subtree: z.boolean().optional() }))
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

export const reportsRouter = {
  monthLockChecklist,
  monthLock,
  musterBuild,
  musterList,
  musterExport,
  r2,
  r3,
  r4,
  r5,
  r6,
  r24,
  r27,
  hrDashboard,
  ess,
  myAttendance,
  teamGrid,
};
