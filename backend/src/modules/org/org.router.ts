/**
 * Stage 2.0 org spine API (ORG-01..05, ORG-08 GL map).
 *
 * Reads of active plants / MIS: `employee.read` (directory + report filters).
 * All writes: `admin.settings`, audited. MIS stays empty until Finance seeds it.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { booleanQuery } from '../../api/zod.js';
import {
  listCostCenters,
  listDepartments,
  listGlAccounts,
  setCostCenterPlant,
  setDepartmentMisCode,
  upsertGlAccount,
} from './org-mappings.service.js';
import {
  listCompanies,
  listMisCodes,
  listPlants,
  setCompanySapCode,
  upsertMisCode,
  upsertPlant,
} from './org.service.js';

const companyOutput = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  sapCompanyCode: z.string().nullable(),
  isIndiaPayroll: z.boolean(),
});

const plantOutput = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  companyCode: z.string(),
  plantCode: z.string(),
  name: z.string(),
  locationId: z.number().int().nullable(),
  isActive: z.boolean(),
});

const misOutput = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  companyCode: z.string(),
  code: z.string(),
  name: z.string(),
  parentId: z.number().int().nullable(),
  isActive: z.boolean(),
});

const costCenterOutput = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  companyCode: z.string(),
  code: z.string(),
  name: z.string(),
  plantId: z.number().int().nullable(),
  plantCode: z.string().nullable(),
});

const departmentOutput = z.object({
  id: z.number().int(),
  name: z.string(),
  misCodeId: z.number().int().nullable(),
  misCode: z.string().nullable(),
  misName: z.string().nullable(),
  misCompanyCode: z.string().nullable(),
});

const glOutput = z.object({
  id: z.number().int(),
  companyCode: z.string(),
  plantCode: z.string(),
  costCenterCode: z.string(),
  componentCode: z.string(),
  glCode: z.string(),
});

function asOrpcError(err: unknown): never {
  const message = err instanceof Error ? err.message : 'Request failed';
  if (message.toLowerCase().includes('not found')) {
    throw new ORPCError('NOT_FOUND', { message });
  }
  throw new ORPCError('BAD_REQUEST', { message });
}

const listCompaniesProc = withPermission('employee.read')
  .route({
    method: 'GET',
    path: '/org/companies',
    summary: 'Company codes + optional SAP company code (ORG-01)',
  })
  .input(z.object({}).optional())
  .output(z.object({ rows: z.array(companyOutput) }))
  .handler(async ({ context }) => ({ rows: await listCompanies(context.db) }));

const setSapCodeProc = withPermission('admin.settings')
  .route({
    method: 'PUT',
    path: '/org/companies/{companyId}/sap-code',
    summary: 'Set sap_company_code when it diverges from code (ORG-01)',
  })
  .input(
    z.object({
      companyId: z.coerce.number().int().positive(),
      sapCompanyCode: z.string().max(32).nullable(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      await setCompanySapCode(context.db, {
        companyId: input.companyId,
        sapCompanyCode: input.sapCompanyCode,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asOrpcError(err);
    }
    return { ok: true as const };
  });

/** Active plants for directory / report filters — empty until recon backfill. */
const listPlantsProc = withPermission('employee.read')
  .route({
    method: 'GET',
    path: '/org/plants',
    summary: 'Plant catalog (active by default; ORG-02)',
  })
  .input(
    z
      .object({
        companyId: z.coerce.number().int().positive().optional(),
        activeOnly: booleanQuery().optional(),
      })
      .optional(),
  )
  .output(z.object({ rows: z.array(plantOutput) }))
  .handler(async ({ input, context }) => ({
    rows: await listPlants(context.db, {
      activeOnly: input?.activeOnly ?? true,
      ...(input?.companyId === undefined ? {} : { companyId: input.companyId }),
    }),
  }));

/** Admin full plant list (includes inactive). */
const listPlantsAdminProc = withPermission('admin.settings')
  .route({
    method: 'GET',
    path: '/org/plants/admin',
    summary: 'Plant catalog including inactive (admin masters)',
  })
  .input(
    z
      .object({
        companyId: z.coerce.number().int().positive().optional(),
      })
      .optional(),
  )
  .output(z.object({ rows: z.array(plantOutput) }))
  .handler(async ({ input, context }) => ({
    rows: await listPlants(context.db, {
      activeOnly: false,
      ...(input?.companyId === undefined ? {} : { companyId: input.companyId }),
    }),
  }));

const upsertPlantProc = withPermission('admin.settings')
  .route({
    method: 'PUT',
    path: '/org/plants',
    summary: 'Create or update a plant (ORG-02; audited)',
  })
  .input(
    z.object({
      companyId: z.number().int().positive(),
      plantCode: z.string().min(1).max(32),
      name: z.string().min(1).max(200),
      locationId: z.number().int().positive().nullable(),
      isActive: z.boolean().default(true),
    }),
  )
  .output(plantOutput)
  .handler(async ({ input, context }) => {
    try {
      return await upsertPlant(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asOrpcError(err);
    }
  });

const listMisProc = withPermission('employee.read')
  .route({
    method: 'GET',
    path: '/org/mis-codes',
    summary: 'MIS codes (active; empty until Finance supplies — ORG-03)',
  })
  .input(
    z
      .object({
        companyId: z.coerce.number().int().positive().optional(),
        activeOnly: booleanQuery().optional(),
      })
      .optional(),
  )
  .output(z.object({ rows: z.array(misOutput) }))
  .handler(async ({ input, context }) => ({
    rows: await listMisCodes(context.db, {
      activeOnly: input?.activeOnly ?? true,
      ...(input?.companyId === undefined ? {} : { companyId: input.companyId }),
    }),
  }));

const listMisAdminProc = withPermission('admin.settings')
  .route({
    method: 'GET',
    path: '/org/mis-codes/admin',
    summary: 'MIS codes including inactive (admin masters)',
  })
  .input(
    z
      .object({
        companyId: z.coerce.number().int().positive().optional(),
      })
      .optional(),
  )
  .output(z.object({ rows: z.array(misOutput) }))
  .handler(async ({ input, context }) => ({
    rows: await listMisCodes(context.db, {
      activeOnly: false,
      ...(input?.companyId === undefined ? {} : { companyId: input.companyId }),
    }),
  }));

const upsertMisProc = withPermission('admin.settings')
  .route({
    method: 'PUT',
    path: '/org/mis-codes',
    summary: 'Create or update an MIS code from Finance catalog (ORG-03; audited)',
  })
  .input(
    z.object({
      companyId: z.number().int().positive(),
      code: z.string().min(1).max(64),
      name: z.string().min(1).max(200),
      parentId: z.number().int().positive().nullable(),
      isActive: z.boolean().default(true),
    }),
  )
  .output(misOutput)
  .handler(async ({ input, context }) => {
    try {
      return await upsertMisCode(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asOrpcError(err);
    }
  });

const listCostCentersProc = withPermission('admin.settings')
  .route({
    method: 'GET',
    path: '/org/cost-centers',
    summary: 'Cost centres with plant mapping (ORG-02/04)',
  })
  .input(
    z
      .object({
        companyId: z.coerce.number().int().positive().optional(),
      })
      .optional(),
  )
  .output(z.object({ rows: z.array(costCenterOutput) }))
  .handler(async ({ input, context }) => ({
    rows: await listCostCenters(context.db, {
      ...(input?.companyId === undefined ? {} : { companyId: input.companyId }),
    }),
  }));

const setCostCenterPlantProc = withPermission('admin.settings')
  .route({
    method: 'PUT',
    path: '/org/cost-centers/{costCenterId}/plant',
    summary: 'Assign a cost centre to exactly one plant (ORG-02)',
  })
  .input(
    z.object({
      costCenterId: z.coerce.number().int().positive(),
      plantId: z.number().int().positive().nullable(),
    }),
  )
  .output(costCenterOutput)
  .handler(async ({ input, context }) => {
    try {
      return await setCostCenterPlant(context.db, {
        costCenterId: input.costCenterId,
        plantId: input.plantId,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asOrpcError(err);
    }
  });

const listDepartmentsProc = withPermission('admin.settings')
  .route({
    method: 'GET',
    path: '/org/departments',
    summary: 'Departments with their Finance MIS mapping (ORG-03/05)',
  })
  .input(z.object({}).optional())
  .output(z.object({ rows: z.array(departmentOutput) }))
  .handler(async ({ context }) => ({ rows: await listDepartments(context.db) }));

const setDepartmentMisCodeProc = withPermission('admin.settings')
  .route({
    method: 'PUT',
    path: '/org/departments/{departmentId}/mis-code',
    summary: 'Map a department to a Finance MIS code (ORG-03; audited)',
  })
  .input(
    z.object({
      departmentId: z.coerce.number().int().positive(),
      misCodeId: z.number().int().positive().nullable(),
    }),
  )
  .output(departmentOutput)
  .handler(async ({ input, context }) => {
    try {
      return await setDepartmentMisCode(context.db, {
        departmentId: input.departmentId,
        misCodeId: input.misCodeId,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asOrpcError(err);
    }
  });

const listGlProc = withPermission('admin.settings')
  .route({
    method: 'GET',
    path: '/org/gl-accounts',
    summary: 'JV / SAP GL map (ORG-08)',
  })
  .input(
    z
      .object({
        companyCode: z.string().min(1).optional(),
      })
      .optional(),
  )
  .output(z.object({ rows: z.array(glOutput) }))
  .handler(async ({ input, context }) => ({
    rows: await listGlAccounts(context.db, {
      ...(input?.companyCode === undefined ? {} : { companyCode: input.companyCode }),
    }),
  }));

const upsertGlProc = withPermission('admin.settings')
  .route({
    method: 'PUT',
    path: '/org/gl-accounts',
    summary: 'Upsert a GL map row (ORG-08; audited)',
  })
  .input(
    z.object({
      companyCode: z.string().min(1).max(32),
      plantCode: z.string().min(1).max(32),
      costCenterCode: z.string().min(1).max(32),
      componentCode: z.string().min(1).max(64),
      glCode: z.string().min(1).max(64),
    }),
  )
  .output(glOutput)
  .handler(async ({ input, context }) => {
    try {
      return await upsertGlAccount(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asOrpcError(err);
    }
  });

export const orgRouter = {
  listCompanies: listCompaniesProc,
  setSapCode: setSapCodeProc,
  listPlants: listPlantsProc,
  listPlantsAdmin: listPlantsAdminProc,
  upsertPlant: upsertPlantProc,
  listMisCodes: listMisProc,
  listMisCodesAdmin: listMisAdminProc,
  upsertMisCode: upsertMisProc,
  listCostCenters: listCostCentersProc,
  setCostCenterPlant: setCostCenterPlantProc,
  listDepartments: listDepartmentsProc,
  setDepartmentMisCode: setDepartmentMisCodeProc,
  listGlAccounts: listGlProc,
  upsertGlAccount: upsertGlProc,
};
