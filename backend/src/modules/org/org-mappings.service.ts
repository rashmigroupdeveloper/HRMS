/** Stage 2.0 cost-centre, department and GL mappings (ORG-02/03/08). */
import type { Kysely, Transaction } from 'kysely';
import { writeAudit } from '../../core/audit/audit.service.js';
import type { Database } from '../../core/db/types.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface CostCenterRow {
  id: number;
  companyId: number;
  companyCode: string;
  code: string;
  name: string;
  plantId: number | null;
  plantCode: string | null;
}

export interface DepartmentRow {
  id: number;
  name: string;
  misCodeId: number | null;
  misCode: string | null;
  misName: string | null;
  misCompanyCode: string | null;
}

export interface GlAccountRow {
  id: number;
  companyCode: string;
  plantCode: string;
  costCenterCode: string;
  componentCode: string;
  glCode: string;
}

export async function listCostCenters(
  db: Db,
  opts: { companyId?: number } = {},
): Promise<CostCenterRow[]> {
  let query = db
    .selectFrom('core.cost_centers as cc')
    .innerJoin('core.companies as c', 'c.id', 'cc.company_id')
    .leftJoin('core.plants as p', 'p.id', 'cc.plant_id')
    .select([
      'cc.id',
      'cc.company_id',
      'c.code as company_code',
      'cc.code',
      'cc.name',
      'cc.plant_id',
      'p.plant_code',
    ])
    .orderBy('c.code')
    .orderBy('cc.code');

  if (opts.companyId !== undefined) query = query.where('cc.company_id', '=', opts.companyId);

  const rows = await query.execute();
  return rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    companyCode: row.company_code,
    code: row.code,
    name: row.name,
    plantId: row.plant_id,
    plantCode: row.plant_code,
  }));
}

export async function setCostCenterPlant(
  db: Kysely<Database>,
  input: { costCenterId: number; plantId: number | null; actorUserId: number; ip?: string | null },
): Promise<CostCenterRow> {
  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('core.cost_centers')
      .select(['id', 'plant_id', 'company_id'])
      .where('id', '=', input.costCenterId)
      .forUpdate()
      .executeTakeFirst();
    if (!existing) throw new Error('Cost centre not found');

    if (input.plantId !== null) {
      const plant = await trx
        .selectFrom('core.plants')
        .select('id')
        .where('id', '=', input.plantId)
        .where('company_id', '=', existing.company_id)
        .executeTakeFirst();
      if (!plant) throw new Error('Plant must belong to the same company as the cost centre');
    }

    await trx
      .updateTable('core.cost_centers')
      .set({ plant_id: input.plantId })
      .where('id', '=', input.costCenterId)
      .execute();

    await writeAudit(trx, {
      actorUserId: input.actorUserId,
      action: 'update',
      entity: 'core.cost_centers',
      entityId: input.costCenterId,
      field: 'plant_id',
      oldValue: existing.plant_id === null ? null : String(existing.plant_id),
      newValue: input.plantId === null ? null : String(input.plantId),
      ip: input.ip ?? null,
    });

    const rows = await listCostCenters(trx, { companyId: existing.company_id });
    const row = rows.find((center) => center.id === input.costCenterId);
    if (!row) throw new Error('Cost centre update failed');
    return row;
  });
}

export async function listDepartments(db: Db): Promise<DepartmentRow[]> {
  const rows = await db
    .selectFrom('core.departments as d')
    .leftJoin('core.mis_codes as m', 'm.id', 'd.mis_code_id')
    .leftJoin('core.companies as c', 'c.id', 'm.company_id')
    .select([
      'd.id',
      'd.name',
      'd.mis_code_id',
      'm.code as mis_code',
      'm.name as mis_name',
      'c.code as mis_company_code',
    ])
    .orderBy('d.name')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    misCodeId: row.mis_code_id,
    misCode: row.mis_code,
    misName: row.mis_name,
    misCompanyCode: row.mis_company_code,
  }));
}

export async function setDepartmentMisCode(
  db: Kysely<Database>,
  input: { departmentId: number; misCodeId: number | null; actorUserId: number; ip?: string | null },
): Promise<DepartmentRow> {
  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('core.departments')
      .select(['id', 'mis_code_id'])
      .where('id', '=', input.departmentId)
      .forUpdate()
      .executeTakeFirst();
    if (!existing) throw new Error('Department not found');

    if (input.misCodeId !== null) {
      const mis = await trx
        .selectFrom('core.mis_codes')
        .select('id')
        .where('id', '=', input.misCodeId)
        .where('is_active', '=', true)
        .executeTakeFirst();
      if (!mis) throw new Error('Active MIS code not found');
    }

    await trx
      .updateTable('core.departments')
      .set({ mis_code_id: input.misCodeId })
      .where('id', '=', input.departmentId)
      .execute();

    await writeAudit(trx, {
      actorUserId: input.actorUserId,
      action: 'update',
      entity: 'core.departments',
      entityId: input.departmentId,
      field: 'mis_code_id',
      oldValue: existing.mis_code_id === null ? null : String(existing.mis_code_id),
      newValue: input.misCodeId === null ? null : String(input.misCodeId),
      ip: input.ip ?? null,
    });

    const rows = await listDepartments(trx);
    const row = rows.find((department) => department.id === input.departmentId);
    if (!row) throw new Error('Department update failed');
    return row;
  });
}

export async function listGlAccounts(
  db: Db,
  opts: { companyCode?: string } = {},
): Promise<GlAccountRow[]> {
  let query = db
    .selectFrom('pay.gl_accounts')
    .selectAll()
    .orderBy('company_code')
    .orderBy('plant_code')
    .orderBy('cost_center_code')
    .orderBy('component_code');

  if (opts.companyCode !== undefined && opts.companyCode !== '') {
    query = query.where('company_code', '=', opts.companyCode);
  }

  const rows = await query.execute();
  return rows.map((row) => ({
    id: row.id,
    companyCode: row.company_code,
    plantCode: row.plant_code,
    costCenterCode: row.cost_center_code,
    componentCode: row.component_code,
    glCode: row.gl_code,
  }));
}

export async function upsertGlAccount(
  db: Kysely<Database>,
  input: {
    companyCode: string;
    plantCode: string;
    costCenterCode: string;
    componentCode: string;
    glCode: string;
    actorUserId: number;
    ip?: string | null;
  },
): Promise<GlAccountRow> {
  const values = {
    company_code: input.companyCode.trim(),
    plant_code: input.plantCode.trim(),
    cost_center_code: input.costCenterCode.trim(),
    component_code: input.componentCode.trim(),
    gl_code: input.glCode.trim(),
  };
  if (Object.values(values).some((value) => value === '')) {
    throw new Error('Company, plant, cost centre, component and GL codes are required');
  }

  return db.transaction().execute(async (trx) => {
    const org = await trx
      .selectFrom('core.companies as c')
      .innerJoin('core.plants as p', (join) =>
        join.onRef('p.company_id', '=', 'c.id').on('p.plant_code', '=', values.plant_code),
      )
      .innerJoin('core.cost_centers as cc', (join) =>
        join
          .onRef('cc.company_id', '=', 'c.id')
          .onRef('cc.plant_id', '=', 'p.id')
          .on('cc.code', '=', values.cost_center_code),
      )
      .select('c.id')
      .where('c.code', '=', values.company_code)
      .executeTakeFirst();
    if (!org) throw new Error('Company, plant and cost centre must be an existing assigned combination');

    const existing = await trx
      .selectFrom('pay.gl_accounts')
      .select('id')
      .where('company_code', '=', values.company_code)
      .where('plant_code', '=', values.plant_code)
      .where('cost_center_code', '=', values.cost_center_code)
      .where('component_code', '=', values.component_code)
      .forUpdate()
      .executeTakeFirst();

    const id = existing
      ? existing.id
      : (
          await trx
            .insertInto('pay.gl_accounts')
            .values(values)
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;

    if (existing) {
      await trx.updateTable('pay.gl_accounts').set({ gl_code: values.gl_code }).where('id', '=', id).execute();
    }

    await writeAudit(trx, {
      actorUserId: input.actorUserId,
      action: existing ? 'update' : 'create',
      entity: 'pay.gl_accounts',
      entityId: id,
      field: `${values.company_code}/${values.plant_code}/${values.cost_center_code}/${values.component_code}`,
      newValue: values.gl_code,
      ip: input.ip ?? null,
    });

    return {
      id,
      companyCode: values.company_code,
      plantCode: values.plant_code,
      costCenterCode: values.cost_center_code,
      componentCode: values.component_code,
      glCode: values.gl_code,
    };
  });
}
