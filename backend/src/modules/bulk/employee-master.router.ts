/**
 * Employee master create / edit, one record at a time (handover item 2,
 * C-25 / C-48, SOW 084-092). It runs the SAME validation and write path as
 * the employee bulk importer, so a form save and an Excel row can never
 * disagree: minors refused (18+ on joining), DOB before DOJ, PAN / Aadhaar
 * (Verhoeff) / UAN / ESIC / IFSC / bank / mobile formats, duplicate PAN,
 * Aadhaar, UAN, ESIC and work e-mail across employees, org-unit data scope,
 * company change refused (that is a transfer). Audited.
 */
import { sql } from 'kysely';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import type { BulkRow, Cell } from '../../core/bulk/index.js';
import { inTransaction } from '../../core/db/database.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';
import { employeesImporter } from './importers/employees.js';

const fields = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  doj: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orgUnit: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  designation: z.string().trim().max(120).optional(),
  grade: z.string().trim().max(120).optional(),
  category: z.enum(['white_collar', 'blue_collar', 'trainee', 'consultant', 'contract']).optional(),
  contractType: z.enum(['permanent', 'temporary', 'probationary', 'consultant', 'fixed_term', 'apprentice']).optional(),
  managerEcode: z.string().trim().max(32).optional(),
  hodEcode: z.string().trim().max(32).optional(),
  workEmail: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(20).optional(),
  pan: z.string().trim().max(20).optional(),
  aadhaar: z.string().trim().max(20).optional(),
  uan: z.string().trim().max(20).optional(),
  esicNo: z.string().trim().max(20).optional(),
  bankName: z.string().trim().max(80).optional(),
  bankAccount: z.string().trim().max(34).optional(),
  bankIfsc: z.string().trim().max(15).optional(),
});
type Fields = z.infer<typeof fields>;

const KEYS: Record<keyof Fields, string> = {
  firstName: 'first_name', lastName: 'last_name', gender: 'gender', dob: 'dob', doj: 'doj', orgUnit: 'org_unit',
  location: 'location', department: 'department', designation: 'designation', grade: 'grade', category: 'category',
  contractType: 'contract_type', managerEcode: 'manager_ecode', hodEcode: 'hod_ecode', workEmail: 'work_email',
  mobile: 'mobile', pan: 'pan', aadhaar: 'aadhaar', uan: 'uan', esicNo: 'esic_no', bankName: 'bank_name',
  bankAccount: 'bank_account', bankIfsc: 'bank_ifsc',
};

const issue = z.object({ column: z.string().nullable(), severity: z.enum(['error', 'warning']), message: z.string() });
const result = z.object({ ecode: z.string(), employeeId: z.number(), warnings: z.array(issue) });

type Ctx = Parameters<Parameters<ReturnType<typeof withPermission>['handler']>[0]>[0]['context'];

async function save(context: Ctx, companyCode: string, ecode: string | null, input: Fields): Promise<z.infer<typeof result>> {
  const values: Record<string, Cell> = { ecode, company: companyCode };
  for (const [k, col] of Object.entries(KEYS) as [keyof Fields, string][]) {
    const v = input[k];
    if (v !== undefined && v !== '') values[col] = v;
  }
  const row: BulkRow = { rowNumber: 1, values, issues: [] };
  const run = {
    db: context.db, context: {},
    actor: { userId: context.user.id, scope: { ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, ip: context.req.ip ?? null },
  };
  await employeesImporter.validate(run, [row]);
  const errors = row.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) throw new DomainError(errors.map((e) => (e.column ? `${e.column}: ${e.message}` : e.message)).join('; '));
  await inTransaction(context.db, async (trx) => {
    await employeesImporter.commit({ ...run, trx }, [row], () => Promise.resolve());
  });
  const code = ecode ?? String(row.values['created_ecode']);
  const saved = await context.db.selectFrom('core.employees').select(['id', 'ecode']).where(sql<string>`upper(ecode)`, '=', code.toUpperCase()).executeTakeFirstOrThrow();
  return { ecode: saved.ecode, employeeId: saved.id, warnings: row.issues.filter((i) => i.severity === 'warning') };
}

export const employeeMasterRouter = {
  create: withPermission('employee.write')
    .route({ method: 'POST', path: '/employees', summary: 'Create an employee (e-code allocated; validated like the bulk importer; audited)' })
    .input(fields.extend({ companyCode: z.string().trim().min(2).max(10) }).refine((v) => v.firstName && v.doj && v.orgUnit, { message: 'First name, date of joining and org unit are required' }))
    .output(result)
    .handler(async ({ input, context }) => {
      const { companyCode, ...rest } = input;
      return save(context, companyCode, null, rest);
    }),
  update: withPermission('employee.write')
    .route({ method: 'PATCH', path: '/employees/{ecode}', summary: 'Edit an employee master record (only supplied fields change; audited)' })
    .input(fields.extend({ ecode: z.string().trim().min(3).max(32) }))
    .output(result)
    .handler(async ({ input, context }) => {
      const { ecode, ...rest } = input;
      const emp = await context.db.selectFrom('core.employees as e').innerJoin('core.companies as c', 'c.id', 'e.company_id')
        .select(['e.ecode', 'c.code']).where(sql<string>`upper(e.ecode)`, '=', ecode.toUpperCase()).executeTakeFirst();
      if (!emp) throw new NotFoundError(`Employee ${ecode} not found`);
      return save(context, emp.code, emp.ecode, rest);
    }),
};
