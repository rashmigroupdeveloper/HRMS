/**
 * Leave API surface (LV-01..09). Central permission gates (CORE-10):
 *   ESS (my types/balances/apply/cancel/encash/RH pick) → leave.own
 *   type catalog edits, adjustments, HR balance reads   → leave.admin
 *   accrual / expiry / year-end job triggers            → admin.integrations
 * Approvals themselves ride the generic /workflows inbox.
 */
import { ORPCError } from '@orpc/server';
import { sql } from 'kysely';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { adjustBalance, getBalances, runCompOffExpiry, runMonthlyAccrual, runYearEndCarryForward } from './leave-core.service.js';
import { applyForLeave, requestCancellation, requestEncashment, selectRestrictedHoliday } from './leave-apply.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
  }
  return user.employee_id;
}

const typeShape = z.object({
  code: z.string(),
  name: z.string(),
  isPaid: z.boolean(),
  accrualPerMonth: z.number(),
  accrualRequiresServiceMonths: z.number(),
  maxCarryForward: z.number().nullable(),
  encashable: z.boolean(),
  maxPerRequest: z.number().nullable(),
  allowHalfDay: z.boolean(),
  sandwichRule: z.enum(['include', 'exclude']),
  isActive: z.boolean(),
});

const listTypes = withPermission('leave.own')
  .route({ method: 'GET', path: '/leave/types', summary: 'Leave type catalog (LV-01)' })
  .output(z.array(typeShape))
  .handler(async ({ context }) => {
    const rows = await context.db.selectFrom('lv.leave_types').selectAll().where('is_active', '=', true).orderBy('code').execute();
    return rows.map((t) => ({
      code: t.code,
      name: t.name,
      isPaid: t.is_paid,
      accrualPerMonth: Number(t.accrual_per_month),
      accrualRequiresServiceMonths: t.accrual_requires_service_months,
      maxCarryForward: t.max_carry_forward === null ? null : Number(t.max_carry_forward),
      encashable: t.encashable,
      maxPerRequest: t.max_per_request === null ? null : Number(t.max_per_request),
      allowHalfDay: t.allow_half_day,
      sandwichRule: t.sandwich_rule,
      isActive: t.is_active,
    }));
  });

const upsertType = withPermission('leave.admin')
  .route({ method: 'PUT', path: '/leave/types/{code}', summary: 'Create/update a leave type — every rate is runtime data (audited)' })
  .input(
    typeShape.omit({ isActive: true }).extend({
      isActive: z.boolean().default(true),
      applicableGender: z.string().length(1).nullish(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const values = {
      code: input.code,
      name: input.name,
      is_paid: input.isPaid,
      accrual_per_month: String(input.accrualPerMonth),
      accrual_requires_service_months: input.accrualRequiresServiceMonths,
      max_carry_forward: input.maxCarryForward === null ? null : String(input.maxCarryForward),
      encashable: input.encashable,
      max_per_request: input.maxPerRequest === null ? null : String(input.maxPerRequest),
      allow_half_day: input.allowHalfDay,
      sandwich_rule: input.sandwichRule,
      applicable_gender: input.applicableGender ?? null,
      is_active: input.isActive,
    };
    await context.db
      .insertInto('lv.leave_types')
      .values(values)
      .onConflict((oc) => oc.column('code').doUpdateSet(values))
      .execute();
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'update',
      entity: 'lv.leave_types',
      field: input.code,
      newValue: JSON.stringify(input),
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

const balanceShape = z.object({
  leaveType: z.string(),
  name: z.string(),
  balance: z.number(),
  pending: z.number(),
  available: z.number(),
});

async function balancesDto(db: Parameters<typeof getBalances>[0], employeeId: number): Promise<z.infer<typeof balanceShape>[]> {
  const rows = await getBalances(db, employeeId);
  return rows.map((r) => ({ leaveType: r.type.code, name: r.type.name, balance: r.balance, pending: r.pending, available: r.available }));
}

const myBalances = withPermission('leave.own')
  .route({ method: 'GET', path: '/leave/balances', summary: 'My balances — always SUM(ledger) (LV-05)' })
  .output(z.array(balanceShape))
  .handler(async ({ context }) => balancesDto(context.db, requireEmployeeId(context.user)));

const employeeBalances = withPermission('leave.admin')
  .route({ method: 'GET', path: '/leave/balances/{employeeId}', summary: 'An employee’s balances (HR)' })
  .input(z.object({ employeeId: z.coerce.number().int().positive() }))
  .output(z.array(balanceShape))
  .handler(async ({ input, context }) => balancesDto(context.db, input.employeeId));

const apply = withPermission('leave.own')
  .route({ method: 'POST', path: '/leave/applications', summary: 'Apply for leave (LV-03; CO applies against comp-off balance)' })
  .input(
    z.object({
      leaveType: z.string().min(1),
      fromDate: isoDate,
      toDate: isoDate,
      fromHalf: z.boolean().optional(),
      toHalf: z.boolean().optional(),
      reason: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.number(), workflowRequestId: z.number(), days: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      return await applyForLeave(context.db, {
        employeeId: requireEmployeeId(context.user),
        requestedByUserId: context.user.id,
        leaveTypeCode: input.leaveType,
        fromDate: input.fromDate,
        toDate: input.toDate,
        fromHalf: input.fromHalf,
        toHalf: input.toHalf,
        reason: input.reason,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const myApplications = withPermission('leave.own')
  .route({ method: 'GET', path: '/leave/applications/mine', summary: 'My leave applications' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        leaveType: z.string(),
        fromDate: z.string(),
        toDate: z.string(),
        days: z.number(),
        status: z.string(),
        workflowRequestId: z.number(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await context.db
      .selectFrom('lv.applications as a')
      .innerJoin('lv.leave_types as t', 't.id', 'a.leave_type_id')
      .where('a.employee_id', '=', requireEmployeeId(context.user))
      .select(['a.id', 't.code', 'a.from_date', 'a.to_date', 'a.days', 'a.status', 'a.workflow_request_id'])
      .orderBy('a.id', 'desc')
      .limit(200)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      leaveType: r.code,
      fromDate: formatDbDate(r.from_date),
      toDate: formatDbDate(r.to_date),
      days: Number(r.days),
      status: r.status,
      workflowRequestId: r.workflow_request_id,
    }));
  });

const myLedger = withPermission('leave.own')
  .route({ method: 'GET', path: '/leave/ledger', summary: 'My immutable leave ledger (LV-05)' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        leaveType: z.string(),
        txnType: z.string(),
        delta: z.number(),
        effectiveDate: z.string(),
        expiryDate: z.string().nullable(),
        note: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await context.db
      .selectFrom('lv.ledger as ledger')
      .innerJoin('lv.leave_types as type', 'type.id', 'ledger.leave_type_id')
      .where('ledger.employee_id', '=', requireEmployeeId(context.user))
      .select([
        'ledger.id',
        'type.code',
        'ledger.txn_type',
        'ledger.delta',
        'ledger.effective_date',
        'ledger.expiry_date',
        'ledger.note',
      ])
      .orderBy('ledger.effective_date', 'desc')
      .orderBy('ledger.id', 'desc')
      .limit(500)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      leaveType: row.code,
      txnType: row.txn_type,
      delta: Number(row.delta),
      effectiveDate: formatDbDate(row.effective_date),
      expiryDate: row.expiry_date ? formatDbDate(row.expiry_date) : null,
      note: row.note,
    }));
  });

const cancel = withPermission('leave.own')
  .route({ method: 'POST', path: '/leave/applications/{id}/cancel', summary: 'Cancel approved leave — routes for re-approval (LV-08)' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ workflowRequestId: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const workflowRequestId = await requestCancellation(context.db, {
        applicationId: input.id,
        employeeId: requireEmployeeId(context.user),
        requestedByUserId: context.user.id,
      });
      return { workflowRequestId };
    } catch (err) {
      asBadRequest(err);
    }
  });

const encash = withPermission('leave.own')
  .route({ method: 'POST', path: '/leave/encashments', summary: 'Request leave encashment (LV-06)' })
  .input(z.object({ leaveType: z.string().min(1), days: z.number().positive() }))
  .output(z.object({ workflowRequestId: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const workflowRequestId = await requestEncashment(context.db, {
        employeeId: requireEmployeeId(context.user),
        requestedByUserId: context.user.id,
        leaveTypeCode: input.leaveType,
        days: input.days,
      });
      return { workflowRequestId };
    } catch (err) {
      asBadRequest(err);
    }
  });

const listRestrictedHolidays = withPermission('leave.own')
  .route({ method: 'GET', path: '/leave/restricted-holidays', summary: 'Published RH list with my selection state (LV-09)' })
  .output(z.array(z.object({ id: z.number(), date: z.string(), name: z.string(), myStatus: z.string().nullable() })))
  .handler(async ({ context }) => {
    const employeeId = requireEmployeeId(context.user);
    const rows = await context.db
      .selectFrom('lv.restricted_holidays as h')
      .leftJoin('lv.rh_selections as s', (join) => join.onRef('s.restricted_holiday_id', '=', 'h.id').on('s.employee_id', '=', employeeId))
      .leftJoin('wf.requests as r', 'r.id', 's.workflow_request_id')
      .select(['h.id', 'h.holiday_date', 'h.name', 'r.status as my_status'])
      .orderBy('h.holiday_date')
      .execute();
    return rows.map((r) => ({ id: r.id, date: formatDbDate(r.holiday_date), name: r.name, myStatus: r.my_status ?? null }));
  });

const publishRestrictedHoliday = withPermission('leave.admin')
  .route({ method: 'PUT', path: '/leave/restricted-holidays', summary: 'Publish a restricted holiday (audited)' })
  .input(z.object({ date: isoDate, name: z.string().min(1), locationId: z.number().int().nullish() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await context.db
      .insertInto('lv.restricted_holidays')
      .values({ holiday_date: sql<Date>`${input.date}::date` as unknown as Date, name: input.name, location_id: input.locationId ?? null })
      .onConflict((oc) => oc.columns(['holiday_date', 'name']).doNothing())
      .execute();
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'create',
      entity: 'lv.restricted_holidays',
      field: input.date,
      newValue: input.name,
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

const selectRh = withPermission('leave.own')
  .route({ method: 'POST', path: '/leave/restricted-holidays/{id}/select', summary: 'Pick a restricted holiday (capped per year)' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ workflowRequestId: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const workflowRequestId = await selectRestrictedHoliday(context.db, {
        employeeId: requireEmployeeId(context.user),
        requestedByUserId: context.user.id,
        restrictedHolidayId: input.id,
      });
      return { workflowRequestId };
    } catch (err) {
      asBadRequest(err);
    }
  });

const adjust = withPermission('leave.admin')
  .route({ method: 'POST', path: '/leave/adjustments', summary: 'Manual balance correction — note mandatory, audited' })
  .input(z.object({ employeeId: z.number().int().positive(), leaveType: z.string().min(1), delta: z.number(), note: z.string().min(5) }))
  .output(z.object({ ledgerTxnId: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const ledgerTxnId = await adjustBalance(context.db, {
        employeeId: input.employeeId,
        leaveTypeCode: input.leaveType,
        delta: input.delta,
        note: input.note,
        actorUserId: context.user.id,
      });
      return { ledgerTxnId };
    } catch (err) {
      asBadRequest(err);
    }
  });

const accrualRun = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/leave/accrual/run', summary: 'Run the monthly accrual (idempotent; also runs on the 1st, 00:05 IST)' })
  .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).optional())
  .output(z.object({ credited: z.number(), flagged: z.number() }))
  .handler(async ({ input, context }) => runMonthlyAccrual(context.db, input ? `${input.month}-01` : undefined));

const compOffExpiryRun = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/leave/comp-off/expire', summary: 'Lapse expired comp-off credits (also runs daily)' })
  .output(z.object({ employeesLapsed: z.number() }))
  .handler(async ({ context }) => ({ employeesLapsed: await runCompOffExpiry(context.db) }));

const yearEndRun = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/leave/year-end/run', summary: 'Apply carry-forward caps for a year end (LV year boundary pending P0-T06)' })
  .input(z.object({ yearEnd: isoDate }))
  .output(z.object({ employeesLapsed: z.number() }))
  .handler(async ({ input, context }) => ({ employeesLapsed: await runYearEndCarryForward(context.db, input.yearEnd) }));

export const leaveRouter = {
  listTypes,
  upsertType,
  myBalances,
  employeeBalances,
  apply,
  myApplications,
  myLedger,
  cancel,
  encash,
  listRestrictedHolidays,
  publishRestrictedHoliday,
  selectRh,
  adjust,
  accrualRun,
  compOffExpiryRun,
  yearEndRun,
};
