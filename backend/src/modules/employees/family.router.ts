/** Family & nominee API (RQ-CORE-025). ESS changes go to HR approval; HR edits directly. */
import { sql } from 'kysely';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import { RELATIONS, applyFamilyChange, listFamily, listPendingFamilyChanges, requestFamilyChange } from './family.service.js';

const member = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.enum(RELATIONS),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  aadhaar: z.string().trim().max(20).nullable().optional(),
  isEsicDependent: z.boolean().optional(),
  isNominee: z.boolean().optional(),
  nomineeSharePct: z.number().min(0).max(100).nullable().optional(),
});
const change = z.object({ action: z.enum(['add', 'update', 'remove']), memberId: z.number().int().positive().optional(), member: member.optional() });
const memberOut = z.object({
  id: z.number(), name: z.string(), relation: z.string(), dob: z.string().nullable(), aadhaarMasked: z.string().nullable(),
  isEsicDependent: z.boolean(), isNominee: z.boolean(), nomineeSharePct: z.number().nullable(),
});
const familyOut = z.object({
  members: z.array(memberOut),
  pending: z.array(z.object({ id: z.number(), change: z.unknown(), status: z.string(), createdAt: z.string(), workflowRequestId: z.number().nullable() })),
});

function ownEmployee(employeeId: number | null): number {
  if (employeeId === null) throw new NotFoundError('No employee profile is linked to your account');
  return employeeId;
}

type ScopedCtx = Parameters<Parameters<ReturnType<typeof withPermission>['handler']>[0]>[0]['context'];
async function employeeInScope(context: ScopedCtx, ecode: string): Promise<number> {
  const emp = await context.db.selectFrom('core.employees').select('id').where(sql<string>`upper(ecode)`, '=', ecode.toUpperCase()).executeTakeFirst();
  if (!emp) throw new NotFoundError(`Employee ${ecode} not found`);
  await assertEmployeesInScope(context.db, { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, [emp.id]);
  return emp.id;
}

export const familyRouter = {
  mine: withPermission('employee.read', 'read')
    .route({ method: 'GET', path: '/employees/me/family', summary: 'My family & nominees, with changes awaiting HR' })
    .output(familyOut)
    .handler(async ({ context }) => {
      const id = ownEmployee(context.user.employee_id);
      return { members: await listFamily(context.db, id), pending: await listPendingFamilyChanges(context.db, id) };
    }),
  requestMine: withPermission('employee.read', 'read')
    .route({ method: 'POST', path: '/employees/me/family/requests', summary: 'Submit a family/nominee change for HR approval' })
    .input(change)
    .output(z.object({ requestId: z.number(), workflowRequestId: z.number(), status: z.literal('pending_hr_approval') }))
    .handler(async ({ input, context }) => {
      const r = await requestFamilyChange(context.db, ownEmployee(context.user.employee_id), input, context.user.id);
      return { ...r, status: 'pending_hr_approval' as const };
    }),
  ofEmployee: withPermission('employee.read', 'read')
    .route({ method: 'GET', path: '/employees/{ecode}/family', summary: 'An employee’s family & nominees (data scope enforced)' })
    .input(z.object({ ecode: z.string().min(3).max(32) }))
    .output(familyOut)
    .handler(async ({ input, context }) => {
      const id = await employeeInScope(context, input.ecode);
      return { members: await listFamily(context.db, id), pending: await listPendingFamilyChanges(context.db, id) };
    }),
  change: withPermission('employee.write')
    .route({ method: 'POST', path: '/employees/{ecode}/family', summary: 'HR: add, update or remove a family member directly (audited)' })
    .input(change.extend({ ecode: z.string().min(3).max(32) }))
    .output(z.object({ memberId: z.number().nullable() }))
    .handler(async ({ input, context }) => {
      const { ecode, ...c } = input;
      const id = await employeeInScope(context, ecode);
      if (id === context.user.employee_id) throw new DomainError('HR cannot approve their own family change; submit it through Me → Family');
      return applyFamilyChange(context.db, id, c, context.user.id, context.req.ip ?? null);
    }),
};
