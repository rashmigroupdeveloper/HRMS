/**
 * Payroll configuration router — the UI for what previously needed SQL:
 * statutory parameters, PT slabs, GL mapping, run variable inputs (+ CSV),
 * and the run register for the review grid.
 * Reads: payroll.run.view · Writes: payroll.run.manage (payroll_admin, super_admin) — all audited.
 */
import { z } from 'zod';
import { ForbiddenError } from '../../../core/errors/index.js';
import { withPermission } from '../../../api/orpc.js';
import { employeeScopeSql } from '../../../core/rbac/employee-scope.js';
import { requireCompanyInScope, requireRunInScope } from '../../../core/rbac/company-scope.js';
import { payrollIdentifierGaps } from '../runs/preflight.service.js';
import {
  addRunInputs, addStatutoryRate, listGlAccounts, listPtSlabs, listRunInputs, listStatutoryRates,
  parseInputsCsv, removeRunInput, setPtSlabs, upsertGlAccount, STATUTORY_PARAMS,
} from './config.service.js';

const monthStart = z.string().regex(/^\d{4}-\d{2}-01$/, 'Use the first day of a month (YYYY-MM-01)');
const inputRow = z.object({ employeeId: z.number().int().positive(), componentCode: z.string().min(1).max(40), amountRupees: z.number().positive().max(10_000_000), note: z.string().trim().min(2).max(300) });

/** Statutory tables are group-wide reference data: an entity-bound admin must not change other entities' pay. */
function requireGroupScope(access: { all: boolean }): void {
  if (!access.all) throw new ForbiddenError('Statutory rates and PT slabs are group-wide; only a group-level payroll admin can change them');
}

export const payrollConfigRouter = {
  preflight: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/payroll/preflight', summary: 'Employees missing PAN, UAN, ESIC or bank details before compute (REQ-012)' })
    .input(z.object({ companyId: z.coerce.number().int().positive() }))
    .output(z.object({
      gaps: z.array(z.object({ employeeId: z.number(), ecode: z.string(), name: z.string(), missing: z.array(z.string()) })),
    }))
    .handler(async ({ input, context }) => {
      await requireCompanyInScope(context, input.companyId);
      const gaps = await payrollIdentifierGaps(context.db, input.companyId);
      return { gaps: gaps.slice(0, 200) };
    }),

  statutoryParams: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/payroll/config/statutory-params', summary: 'Statutory parameters the engine reads, by scheme' })
    .output(z.record(z.string(), z.array(z.string())))
    .handler(() => Object.fromEntries(Object.entries(STATUTORY_PARAMS).map(([k, v]) => [k, [...v]]))),

  statutoryRates: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/payroll/config/statutory-rates', summary: 'Effective-dated statutory parameters (PF, ESIC, OT, bonus)' })
    .output(z.array(z.object({ id: z.number(), scheme: z.string(), param: z.string(), value: z.number(), effectiveFrom: z.string(), sourceNote: z.string() })))
    .handler(({ context }) => listStatutoryRates(context.db)),

  setStatutoryRate: withPermission('payroll.run.manage')
    .route({ method: 'POST', path: '/payroll/config/statutory-rates', summary: 'Add a new effective-dated version of a statutory parameter (audited)' })
    .input(z.object({ scheme: z.string().min(2).max(10), param: z.string().min(2).max(40), value: z.number(), effectiveFrom: monthStart, sourceNote: z.string().trim().min(3).max(300) }))
    .output(z.object({ id: z.number() }))
    .handler(({ input, context }) => { requireGroupScope(context.permissionAccess); return addStatutoryRate(context.db, { ...input, actorUserId: context.user.id }); }),

  ptSlabs: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/payroll/config/pt-slabs', summary: 'Professional tax slab sets per state' })
    .output(z.array(z.object({ id: z.number(), stateCode: z.string(), minMonthly: z.number(), maxMonthly: z.number().nullable(), amount: z.number(), effectiveFrom: z.string(), basis: z.string() })))
    .handler(({ context }) => listPtSlabs(context.db)),

  setPtSlabs: withPermission('payroll.run.manage')
    .route({ method: 'PUT', path: '/payroll/config/pt-slabs', summary: 'Replace the PT slab set for a state from a month (audited)' })
    .input(z.object({
      stateCode: z.string().length(2), effectiveFrom: monthStart, basis: z.enum(['earned_monthly', 'contracted_monthly']),
      slabs: z.array(z.object({ minMonthly: z.number().min(0), maxMonthly: z.number().min(0).nullable(), amount: z.number().min(0).max(2500) })).max(30),
    }))
    .output(z.object({ count: z.number() }))
    .handler(({ input, context }) => { requireGroupScope(context.permissionAccess); return setPtSlabs(context.db, { ...input, actorUserId: context.user.id }); }),

  glAccounts: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/payroll/config/gl-accounts', summary: 'SAP GL mapping per company/plant/cost centre/component' })
    .output(z.array(z.object({ id: z.number(), companyCode: z.string(), plantCode: z.string(), costCenterCode: z.string(), componentCode: z.string(), glCode: z.string() })))
    .handler(({ context }) => listGlAccounts(context.db)),

  setGlAccount: withPermission('payroll.run.manage')
    .route({ method: 'PUT', path: '/payroll/config/gl-accounts', summary: 'Create or change a GL mapping (audited)' })
    .input(z.object({ companyCode: z.string().min(1).max(20), plantCode: z.string().min(1).max(20), costCenterCode: z.string().min(1).max(20), componentCode: z.string().min(1).max(40), glCode: z.string().trim().min(3).max(20) }))
    .output(z.object({ id: z.number() }))
    .handler(({ input, context }) => upsertGlAccount(context.db, { ...input, actorUserId: context.user.id })),

  runInputs: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/payroll/runs/{runId}/inputs', summary: 'Variable inputs entered for a run' })
    .input(z.object({ runId: z.coerce.number().int().positive() }))
    .output(z.array(z.object({ id: z.number(), employeeId: z.number(), ecode: z.string(), name: z.string(), componentCode: z.string(), amountRupees: z.number(), note: z.string() })))
    .handler(async ({ input, context }) => {
      await requireRunInScope(context, input.runId);
      return listRunInputs(context.db, input.runId);
    }),

  addRunInputs: withPermission('payroll.run.manage')
    .route({ method: 'POST', path: '/payroll/runs/{runId}/inputs', summary: 'Add variable inputs (incentive, canteen, guest house, recoveries) to a draft run' })
    .input(z.object({ runId: z.coerce.number().int().positive(), inputs: z.array(inputRow).min(1).max(5000) }))
    .output(z.object({ inserted: z.number() }))
    .handler(async ({ input, context }) => {
      await requireRunInScope(context, input.runId);
      return addRunInputs(context.db, input.runId, input.inputs, context.user.id);
    }),

  uploadRunInputs: withPermission('payroll.run.manage')
    .route({ method: 'POST', path: '/payroll/runs/{runId}/inputs/upload', summary: 'Bulk upload variable inputs as CSV (ecode,component_code,amount,note); all-or-nothing' })
    .input(z.object({ runId: z.coerce.number().int().positive(), csv: z.string().min(10).max(1_000_000) }))
    .output(z.object({ inserted: z.number() }))
    .handler(async ({ input, context }) => {
      await requireRunInScope(context, input.runId);
      return addRunInputs(context.db, input.runId, await parseInputsCsv(context.db, input.runId, input.csv), context.user.id);
    }),

  removeRunInput: withPermission('payroll.run.manage')
    .route({ method: 'DELETE', path: '/payroll/runs/{runId}/inputs/{inputId}', summary: 'Remove a variable input from a draft run' })
    .input(z.object({ runId: z.coerce.number().int().positive(), inputId: z.coerce.number().int().positive() }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ input, context }) => {
      await requireRunInScope(context, input.runId); await removeRunInput(context.db, input.runId, input.inputId, context.user.id); return { ok: true as const }; }),

  runItems: withPermission('payroll.run.view', 'read')
    .route({ method: 'GET', path: '/payroll/runs/{runId}/items', summary: 'Computed register for a run (review grid)' })
    .input(z.object({ runId: z.coerce.number().int().positive() }))
    .output(z.array(z.object({
      itemId: z.number(), employeeId: z.number(), ecode: z.string(), name: z.string(), payableDays: z.number(), lopDays: z.number(), otMinutes: z.number(),
      grossRupees: z.number(), deductionsRupees: z.number(), netRupees: z.number(), employerCostRupees: z.number(), paymentStatus: z.string(), hasPayslip: z.boolean(),
      lines: z.array(z.object({ code: z.string(), name: z.string(), kind: z.string(), amountRupees: z.number(), calcNote: z.string().nullable() })),
    })))
    .handler(async ({ input, context }) => {
      await requireRunInScope(context, input.runId);
      const scope = { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
      const items = await context.db.selectFrom('pay.payroll_items as i').innerJoin('core.employees as e', 'e.id', 'i.employee_id')
        .select(['i.id', 'i.employee_id', 'e.ecode', 'e.first_name', 'e.last_name', 'i.payable_days', 'i.lop_days', 'i.ot_minutes', 'i.gross', 'i.total_deductions', 'i.net_pay', 'i.employer_cost', 'i.payment_status', 'i.payslip_document_id'])
        .where('i.run_id', '=', input.runId).where(employeeScopeSql(scope, 'e')).orderBy('e.ecode').execute();
      const lines = items.length === 0 ? [] : await context.db.selectFrom('pay.payroll_item_lines as l').innerJoin('pay.salary_components as c', 'c.code', 'l.component_code')
        .select(['l.item_id', 'l.component_code', 'c.name', 'c.kind', 'l.amount', 'l.calc_note', 'c.display_order'])
        .where('l.item_id', 'in', items.map((i) => i.id)).orderBy('c.display_order').execute();
      return items.map((i) => ({
        itemId: i.id, employeeId: i.employee_id, ecode: i.ecode, name: [i.first_name, i.last_name].filter(Boolean).join(' '),
        payableDays: Number(i.payable_days), lopDays: Number(i.lop_days), otMinutes: i.ot_minutes, grossRupees: Number(i.gross), deductionsRupees: Number(i.total_deductions),
        netRupees: Number(i.net_pay), employerCostRupees: Number(i.employer_cost), paymentStatus: i.payment_status, hasPayslip: i.payslip_document_id !== null,
        lines: lines.filter((l) => l.item_id === i.id).map((l) => ({ code: l.component_code, name: l.name, kind: l.kind, amountRupees: Number(l.amount), calcNote: l.calc_note })),
      }));
    }),
};
