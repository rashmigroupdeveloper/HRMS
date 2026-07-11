/**
 * Employees read API — directory + profile shell (P0-T33 / CORE-01, docs/05 §4.2).
 * Guarded by `employee.read`. Statutory fields masked in the service layer.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { getEmployeeByEcode, listEmployees } from './employees.service.js';

const guard = () => withPermission('employee.read');

const directoryItem = z.object({
  ecode: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  entity: z.string(),
  entityName: z.string(),
  status: z.string(),
  statusLabel: z.string(),
});

const listProcedure = guard()
  .route({
    method: 'GET',
    path: '/employees',
    summary: 'Employee directory (filterable, paginated)',
  })
  .input(
    z
      .object({
        q: z.string().optional(),
        companyCode: z.string().optional(),
        status: z.enum(['onboarding', 'active', 'on_notice', 'exited']).optional(),
        activeOnly: z.coerce.boolean().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(200).optional(),
      })
      .optional(),
  )
  .output(
    z.object({
      items: z.array(directoryItem),
      total: z.number().int(),
      page: z.number().int(),
      pageSize: z.number().int(),
    }),
  )
  .handler(async ({ input, context }) => {
    return listEmployees(context.db, input ?? {});
  });

const profileOutput = z.object({
  ecode: z.string(),
  name: z.string(),
  photoPath: z.string().nullable(),
  gender: z.string().nullable(),
  dob: z.string().nullable(),
  maritalStatus: z.string().nullable(),
  bloodGroup: z.string().nullable(),
  personalEmail: z.string().nullable(),
  workEmail: z.string().nullable(),
  mobile: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
  presentAddress: z.string().nullable(),
  permanentAddress: z.string().nullable(),
  category: z.string().nullable(),
  contractType: z.string().nullable(),
  doj: z.string().nullable(),
  dol: z.string().nullable(),
  status: z.string(),
  statusLabel: z.string(),
  exitReason: z.string().nullable(),
  confirmationDate: z.string().nullable(),
  probationDueDate: z.string().nullable(),
  entity: z.string(),
  entityName: z.string(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  locationName: z.string().nullable(),
  gradeName: z.string().nullable(),
  reportingManagerEcode: z.string().nullable(),
  reportingManagerName: z.string().nullable(),
  statutoryMasked: z.boolean(),
  pan: z.string().nullable(),
  aadhaar: z.string().nullable(),
  uan: z.string().nullable(),
  pfNumber: z.string().nullable(),
  esicIpNumber: z.string().nullable(),
  bankName: z.string().nullable(),
  bankAccount: z.string().nullable(),
  bankIfsc: z.string().nullable(),
  paymentMode: z.string(),
  canViewCompensation: z.boolean(),
});

const getByEcodeProcedure = guard()
  .route({
    method: 'GET',
    path: '/employees/{ecode}',
    summary: 'Employee profile by e-code (statutory fields permission-masked)',
  })
  .input(z.object({ ecode: z.string().min(3).max(32) }))
  .output(profileOutput)
  .handler(async ({ input, context }) => {
    const profile = await getEmployeeByEcode(
      context.db,
      input.ecode,
      context.user,
      context.permissions,
    );
    if (!profile) {
      throw new ORPCError('NOT_FOUND', { message: `Employee ${input.ecode} not found` });
    }
    return profile;
  });

export const employeesRouter = {
  list: listProcedure,
  getByEcode: getByEcodeProcedure,
};
