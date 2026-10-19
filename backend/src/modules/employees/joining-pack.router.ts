/** HR walk-in joining pack (LC-01). Medical read is a separate permission managers do not hold. */
import { sql } from 'kysely';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { NotFoundError } from '../../core/errors/index.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import { joiningPackInputSchema } from '../lifecycle/onboarding/joining-pack.schema.js';
import { readMedicalNotes, saveJoiningPack } from '../lifecycle/onboarding/joining-pack.js';

async function employeeId(context: { db: Parameters<typeof assertEmployeesInScope>[0]; permissionAccess: Parameters<typeof assertEmployeesInScope>[1]; user: { employee_id: number | null } }, ecode: string): Promise<number> {
  const row = await context.db.selectFrom('core.employees').select('id').where(sql<string>`upper(ecode)`, '=', ecode.toUpperCase()).executeTakeFirst();
  if (!row) throw new NotFoundError(`Employee ${ecode} not found`);
  await assertEmployeesInScope(context.db, { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, [row.id]);
  return row.id;
}

export const joiningPackRouter = {
  save: withPermission('employee.write')
    .route({ method: 'PUT', path: '/employees/{ecode}/joining-pack', summary: 'Save joining-form grids for a walk-in or correction (medical is stored apart from the profile)' })
    .input(joiningPackInputSchema)
    .output(z.object({ saved: z.literal(true) }))
    .handler(async ({ input, context }) => {
      const { ecode, ...pack } = input;
      const id = await employeeId(context, ecode);
      await saveJoiningPack(context.db, id, pack, context.user.id);
      return { saved: true as const };
    }),
  medical: withPermission('employee.medical.read')
    .route({ method: 'GET', path: '/employees/{ecode}/medical', summary: 'Read the joining medical notes (HR medical only; not managers)' })
    .input(z.object({ ecode: z.string().trim().min(3).max(32) }))
    .output(z.object({ notes: z.string().nullable() }))
    .handler(async ({ input, context }) => {
      const id = await employeeId(context, input.ecode);
      return { notes: await readMedicalNotes(context.db, id, context.user.id) };
    }),
};
