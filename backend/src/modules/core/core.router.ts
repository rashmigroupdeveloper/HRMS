/**
 * Core Organization Masters Router (CORE-01, LC-05).
 *
 * Provides authenticated master list catalog for:
 * - Legal entities (companies)
 * - Departments
 * - Locations & Plants
 * - Designations
 * - Grades
 */

import { z } from 'zod';
import { sql } from 'kysely';
import { authed, withPermission } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { companiesInScope, requireCompanyInScope } from '../../core/rbac/company-scope.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import { DomainError, ForbiddenError, NotFoundError } from '../../core/errors/index.js';

const companyItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  ecode_prefix: z.string(),
});

const departmentItemSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const locationItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  state_code: z.string().optional(),
});

const designationItemSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const gradeItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  rank: z.number(),
});

const departmentHeadSchema = z.object({
  id: z.number(), departmentId: z.number(), departmentName: z.string(), companyId: z.number().nullable(),
  companyCode: z.string().nullable(), employeeId: z.number(), employeeCode: z.string(), employeeName: z.string(),
});

export const coreRouter = {
  /** List all legal entities (companies) in the group */
  companies: authed
    .route({
      method: 'GET',
      path: '/core/companies',
      summary: 'List canonical company legal entities',
    })
    .input(z.object({}).optional())
    .output(z.object({ companies: z.array(companyItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.companies')
        .select(['id', 'name', 'code', 'ecode_prefix'])
        .orderBy('name', 'asc')
        .execute();
      return { companies: rows };
    }),

  /** Org units (scope picker for entity-scoped role grants, E2E-010). */
  orgUnits: authed
    .route({ method: 'GET', path: '/core/org-units', summary: 'List org units with their company' })
    .output(z.object({ orgUnits: z.array(z.object({ id: z.number(), name: z.string(), companyId: z.number(), companyCode: z.string() })) }))
    .handler(async ({ context }) => {
      const rows = await context.db.selectFrom('core.org_units as u').innerJoin('core.companies as c', 'c.id', 'u.company_id')
        .select(['u.id', 'u.name', 'u.company_id as companyId', 'c.code as companyCode']).orderBy('c.code').orderBy('u.name').execute();
      return { orgUnits: rows };
    }),

  /** List all departments */
  departments: authed
    .route({
      method: 'GET',
      path: '/core/departments',
      summary: 'List corporate and plant departments',
    })
    .input(z.object({}).optional())
    .output(z.object({ departments: z.array(departmentItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.departments')
        .select(['id', 'name'])
        .orderBy('name', 'asc')
        .execute();
      return { departments: rows };
    }),

  /** List all office and plant locations */
  locations: authed
    .route({
      method: 'GET',
      path: '/core/locations',
      summary: 'List office and manufacturing plant locations',
    })
    .input(z.object({}).optional())
    .output(z.object({ locations: z.array(locationItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.locations')
        .select(['id', 'name', 'state_code'])
        .orderBy('name', 'asc')
        .execute();
      return {
        locations: rows.map((r) => ({
          id: r.id,
          name: r.name,
          state_code: r.state_code,
        })),
      };
    }),

  /** List all job designations */
  designations: authed
    .route({
      method: 'GET',
      path: '/core/designations',
      summary: 'List standard job designations',
    })
    .input(z.object({}).optional())
    .output(z.object({ designations: z.array(designationItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.designations')
        .select(['id', 'name'])
        .orderBy('name', 'asc')
        .execute();
      return { designations: rows };
    }),

  /** List all job grades */
  grades: authed
    .route({
      method: 'GET',
      path: '/core/grades',
      summary: 'List job grades and hierarchy ranks',
    })
    .input(z.object({}).optional())
    .output(z.object({ grades: z.array(gradeItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.grades')
        .select(['id', 'name', 'code', 'rank'])
        .orderBy('rank', 'asc')
        .execute();
      return { grades: rows };
    }),

  /** C-02: designated heads of department (HOD approver + department scope). */
  departmentHeads: withPermission('employee.read', 'read')
    .route({ method: 'GET', path: '/core/department-heads', summary: 'Designated heads of department (per company, or group-wide)' })
    .input(z.object({ departmentId: z.coerce.number().int().positive().optional() }).optional())
    .output(z.object({ heads: z.array(departmentHeadSchema) }))
    .handler(async ({ input, context }) => {
      const companies = await companiesInScope(context);
      const rows = await departmentHeadQuery(context.db)
        .$if(input?.departmentId !== undefined, (q) => q.where('dh.department_id', '=', input?.departmentId ?? 0))
        .$if(companies !== null, (q) => q.where((eb) => eb.or([
          eb('dh.company_id', 'is', null),
          ...(companies !== null && companies.length > 0 ? [eb('dh.company_id', 'in', companies)] : []),
        ])))
        .execute();
      return { heads: rows };
    }),

  addDepartmentHead: withPermission('employee.write')
    .route({ method: 'POST', path: '/core/department-heads', summary: 'Designate an employee as head of a department (audited)' })
    .input(z.object({
      departmentId: z.number().int().positive(), companyId: z.number().int().positive().nullable(),
      employeeId: z.number().int().positive().optional(), employeeCode: z.string().trim().min(1).max(40).optional(),
    }).refine((v) => v.employeeId !== undefined || v.employeeCode !== undefined, { message: 'employeeId or employeeCode is required' }))
    .output(z.object({ id: z.number() }))
    .handler(async ({ input, context }) => {
      const emp = await context.db.selectFrom('core.employees').select(['id', 'status'])
        .$if(input.employeeId !== undefined, (q) => q.where('id', '=', input.employeeId ?? 0))
        .$if(input.employeeId === undefined, (q) => q.where(sql`upper(ecode)`, '=', (input.employeeCode ?? '').toUpperCase()))
        .executeTakeFirst();
      if (!emp) throw new NotFoundError('Employee not found');
      await assertHeadChangeAllowed(context, input.companyId, emp.id);
      const dept = await context.db.selectFrom('core.departments').select('id').where('id', '=', input.departmentId).executeTakeFirst();
      if (!dept) throw new NotFoundError('Department not found');
      if (!['active', 'on_notice'].includes(emp.status)) throw new DomainError('The head of department must be an active employee');
      const row = await context.db.insertInto('core.department_heads')
        .values({ department_id: input.departmentId, company_id: input.companyId, employee_id: emp.id, created_by: context.user.id })
        .onConflict((oc) => oc.constraint('department_heads_uq').doNothing())
        .returning('id').executeTakeFirst();
      if (!row) throw new DomainError('That employee is already head of this department');
      await writeAudit(context.db, {
        actorUserId: context.user.id, action: 'department_head_added', entity: 'core.department_heads', entityId: row.id,
        newValue: JSON.stringify({ departmentId: input.departmentId, companyId: input.companyId, employeeId: emp.id }), ip: context.req.ip ?? null,
      });
      return row;
    }),

  removeDepartmentHead: withPermission('employee.write')
    .route({ method: 'POST', path: '/core/department-heads/{id}/remove', summary: 'Remove a head-of-department designation (audited)' })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(z.object({ ok: z.boolean() }))
    .handler(async ({ input, context }) => {
      const row = await context.db.selectFrom('core.department_heads').selectAll().where('id', '=', input.id).executeTakeFirst();
      if (!row) throw new NotFoundError('Designation not found');
      await assertHeadChangeAllowed(context, row.company_id, row.employee_id);
      await context.db.deleteFrom('core.department_heads').where('id', '=', input.id).execute();
      await writeAudit(context.db, {
        actorUserId: context.user.id, action: 'department_head_removed', entity: 'core.department_heads', entityId: row.id,
        oldValue: JSON.stringify({ departmentId: row.department_id, companyId: row.company_id, employeeId: row.employee_id }), ip: context.req.ip ?? null,
      });
      return { ok: true };
    }),
};


function departmentHeadQuery(db: Parameters<typeof writeAudit>[0]) {
  return db.selectFrom('core.department_heads as dh')
    .innerJoin('core.departments as d', 'd.id', 'dh.department_id')
    .innerJoin('core.employees as e', 'e.id', 'dh.employee_id')
    .leftJoin('core.companies as c', 'c.id', 'dh.company_id')
    .select((eb) => [
      'dh.id', 'dh.department_id as departmentId', 'd.name as departmentName', 'dh.company_id as companyId',
      'c.code as companyCode', 'dh.employee_id as employeeId', 'e.ecode as employeeCode',
      eb.fn<string>('concat_ws', [eb.val(' '), 'e.first_name', 'e.last_name']).as('employeeName'),
    ])
    .orderBy('d.name').orderBy('dh.id');
}

/** Group-wide designations need group scope; entity ones need the company and the employee in scope. */
async function assertHeadChangeAllowed(
  context: Parameters<typeof requireCompanyInScope>[0] & { permissionAccess: { all: boolean } },
  companyId: number | null, employeeId: number,
): Promise<void> {
  if (companyId === null) {
    if (!context.permissionAccess.all) throw new ForbiddenError('Only a group-level HR admin can designate a group-wide head of department');
  } else {
    await requireCompanyInScope(context, companyId);
  }
  await assertEmployeesInScope(context.db, { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, [employeeId]);
}
