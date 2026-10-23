/** LV-01 / CORE-10/11: the type catalog is global; employee adjustments remain scoped. */
import { z } from 'zod';
import { ORPCError } from '@orpc/server';
import { withPermission } from '../../api/orpc.js';
import { inTransaction } from '../../core/db/database.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getUserPermissionAccess } from '../../core/rbac/permissions.service.js';
import type { LeaveTypeRow } from './leave-core.service.js';

const category = z.enum(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract']);
const typeShape = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120), isPaid: z.boolean(),
  accrualPerMonth: z.number().finite().nonnegative().max(999.99).multipleOf(0.01),
  accrualRequiresServiceMonths: z.number().int().nonnegative().max(32767),
  maxCarryForward: z.number().finite().nonnegative().max(999.99).multipleOf(0.01).nullable(), encashable: z.boolean(),
  maxPerRequest: z.number().finite().positive().max(999.9).multipleOf(0.1).nullable(), allowHalfDay: z.boolean(),
  sandwichRule: z.enum(['include', 'exclude']), isActive: z.boolean(),
  applicableGender: z.string().nullable(), applicableCategories: z.array(category).min(1).nullable(),
});
const inputShape = typeShape.extend({ isActive: z.boolean().default(true),
  applicableGender: z.enum(['M', 'F']).nullish(), applicableCategories: z.array(category).min(1).nullish(),
}).refine(value => value.isPaid || (!value.encashable && value.accrualPerMonth === 0), {
  message: 'Unpaid leave cannot accrue a paid balance or be encashable',
});
export function leaveTypeDto(t: LeaveTypeRow) {
  return { code: t.code, name: t.name, isPaid: t.is_paid, accrualPerMonth: Number(t.accrual_per_month),
    accrualRequiresServiceMonths: t.accrual_requires_service_months,
    maxCarryForward: t.max_carry_forward === null ? null : Number(t.max_carry_forward), encashable: t.encashable,
    maxPerRequest: t.max_per_request === null ? null : Number(t.max_per_request), allowHalfDay: t.allow_half_day,
    sandwichRule: t.sandwich_rule, isActive: t.is_active, applicableGender: t.applicable_gender,
    applicableCategories: t.applicable_categories };
}
export const leaveTypeOutput = typeShape;

const adminTypes = withPermission('leave.admin')
  .route({ method: 'GET', path: '/leave/admin/types', summary: 'Full leave policy catalog, including inactive types, and writable capabilities' })
  .output(z.object({ types: z.array(typeShape), canManageTypes: z.boolean(), canRunJobs: z.boolean() }))
  .handler(async ({ context }) => {
    const edit = await getUserPermissionAccess(context.db, context.user.id, 'leave.admin', 'write');
    const jobs = await getUserPermissionAccess(context.db, context.user.id, 'admin.integrations', 'write');
    return { types: (await context.db.selectFrom('lv.leave_types').selectAll().orderBy('code').execute()).map(leaveTypeDto),
      canManageTypes: edit?.all === true, canRunJobs: jobs?.all === true };
  });

const upsertType = withPermission('leave.admin')
  .route({ method: 'PUT', path: '/leave/types/{code}', summary: 'Maintain global leave policy (group authority, validated and audited)' })
  .input(inputShape).output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    if (!context.permissionAccess.all) throw new ORPCError('FORBIDDEN', { message: 'Leave types apply to the whole group. Ask an HR administrator with group-wide leave authority to change this policy.' });
    return inTransaction(context.db, async db => {
      const old = await db.selectFrom('lv.leave_types').selectAll().where('code', '=', input.code).forUpdate().executeTakeFirst();
      if (old && old.is_paid !== input.isPaid) {
        const used = await db.selectFrom('lv.ledger').select('id').where('leave_type_id', '=', old.id).executeTakeFirst()
          ?? await db.selectFrom('lv.applications').select('id').where('leave_type_id', '=', old.id).executeTakeFirst()
          ?? await db.selectFrom('att.day_records').select('id').where('leave_type_id', '=', old.id).executeTakeFirst();
        if (used) throw new ORPCError('CONFLICT', { message: 'Paid/unpaid treatment is already used by leave or attendance history. Create a new leave type instead of changing historical pay.' });
      }
      const values = { code: input.code, name: input.name, is_paid: input.isPaid,
        accrual_per_month: String(input.accrualPerMonth), accrual_requires_service_months: input.accrualRequiresServiceMonths,
        max_carry_forward: input.maxCarryForward === null ? null : String(input.maxCarryForward), encashable: input.encashable,
        max_per_request: input.maxPerRequest === null ? null : String(input.maxPerRequest), allow_half_day: input.allowHalfDay,
        sandwich_rule: input.sandwichRule, applicable_gender: input.applicableGender === undefined ? old?.applicable_gender ?? null : input.applicableGender,
        applicable_categories: input.applicableCategories === undefined ? old?.applicable_categories ?? null : input.applicableCategories, is_active: input.isActive };
      await db.insertInto('lv.leave_types').values(values).onConflict(oc => oc.column('code').doUpdateSet(values)).execute();
      await writeAudit(db, { actorUserId: context.user.id, action: old ? 'update' : 'create', entity: 'lv.leave_types', field: input.code,
        oldValue: old ? JSON.stringify(leaveTypeDto(old)) : null, newValue: JSON.stringify(input), ip: context.req.ip ?? null });
      return { ok: true as const };
    });
  });

export const leaveConfigRouter = { adminTypes, upsertType };
