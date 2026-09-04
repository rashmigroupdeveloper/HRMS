/**
 * Stage 2.0 — company / plant / MIS / cost-centre / GL map mutations (ORG-01..05, ORG-08 map).
 *
 * MIS codes and plant codes are NEVER invented here. An empty MIS list is correct
 * until Finance supplies the real catalog (plans/phase-2 Stage 2.0).
 */
import type { Kysely, Transaction } from 'kysely';
import { writeAudit } from '../../core/audit/audit.service.js';
import type { Database } from '../../core/db/types.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface CompanyRow {
  id: number;
  code: string;
  name: string;
  sapCompanyCode: string | null;
  isIndiaPayroll: boolean;
}

export interface PlantRow {
  id: number;
  companyId: number;
  companyCode: string;
  plantCode: string;
  name: string;
  locationId: number | null;
  isActive: boolean;
}

export interface MisCodeRow {
  id: number;
  companyId: number;
  companyCode: string;
  code: string;
  name: string;
  parentId: number | null;
  isActive: boolean;
}

export async function listCompanies(db: Db): Promise<CompanyRow[]> {
  const rows = await db
    .selectFrom('core.companies')
    .select(['id', 'code', 'name', 'sap_company_code', 'is_india_payroll'])
    .orderBy('code')
    .execute();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sapCompanyCode: r.sap_company_code,
    isIndiaPayroll: r.is_india_payroll,
  }));
}

export async function setCompanySapCode(
  db: Kysely<Database>,
  input: { companyId: number; sapCompanyCode: string | null; actorUserId: number; ip?: string | null },
): Promise<void> {
  const next = input.sapCompanyCode === null || input.sapCompanyCode.trim() === ''
    ? null
    : input.sapCompanyCode.trim();

  await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('core.companies')
      .select(['id', 'sap_company_code'])
      .where('id', '=', input.companyId)
      .forUpdate()
      .executeTakeFirst();
    if (!existing) throw new Error('Company not found');

    await trx
      .updateTable('core.companies')
      .set({ sap_company_code: next })
      .where('id', '=', input.companyId)
      .execute();

    await writeAudit(trx, {
      actorUserId: input.actorUserId,
      action: 'update',
      entity: 'core.companies',
      entityId: input.companyId,
      field: 'sap_company_code',
      oldValue: existing.sap_company_code,
      newValue: next,
      ip: input.ip ?? null,
    });
  });
}

export async function listPlants(
  db: Db,
  opts: { activeOnly?: boolean; companyId?: number } = {},
): Promise<PlantRow[]> {
  let q = db
    .selectFrom('core.plants as p')
    .innerJoin('core.companies as c', 'c.id', 'p.company_id')
    .select([
      'p.id',
      'p.company_id',
      'c.code as company_code',
      'p.plant_code',
      'p.name',
      'p.location_id',
      'p.is_active',
    ])
    .orderBy('c.code')
    .orderBy('p.plant_code');

  if (opts.activeOnly !== false) {
    q = q.where('p.is_active', '=', true);
  }
  if (opts.companyId !== undefined) {
    q = q.where('p.company_id', '=', opts.companyId);
  }

  const rows = await q.execute();
  return rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyCode: r.company_code,
    plantCode: r.plant_code,
    name: r.name,
    locationId: r.location_id,
    isActive: r.is_active,
  }));
}

export async function upsertPlant(
  db: Kysely<Database>,
  input: {
    companyId: number;
    plantCode: string;
    name: string;
    locationId: number | null;
    isActive: boolean;
    actorUserId: number;
    ip?: string | null;
  },
): Promise<PlantRow> {
  const plantCode = input.plantCode.trim();
  if (plantCode === '') throw new Error('plant_code is required');
  const name = input.name.trim();
  if (name === '') throw new Error('Plant name is required');

  return db.transaction().execute(async (trx) => {
    const company = await trx
      .selectFrom('core.companies')
      .select('id')
      .where('id', '=', input.companyId)
      .executeTakeFirst();
    if (!company) throw new Error('Company not found');

    if (input.locationId !== null) {
      const location = await trx
        .selectFrom('core.locations')
        .select('id')
        .where('id', '=', input.locationId)
        .where('company_id', '=', input.companyId)
        .executeTakeFirst();
      if (!location) throw new Error('Location must belong to the same company as the plant');
    }

    const existing = await trx
      .selectFrom('core.plants')
      .select('id')
      .where('company_id', '=', input.companyId)
      .where('plant_code', '=', plantCode)
      .forUpdate()
      .executeTakeFirst();

    const id = existing
      ? existing.id
      : (
          await trx
            .insertInto('core.plants')
            .values({
              company_id: input.companyId,
              plant_code: plantCode,
              name,
              location_id: input.locationId,
              is_active: input.isActive,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;

    if (existing) {
      await trx
        .updateTable('core.plants')
        .set({ name, location_id: input.locationId, is_active: input.isActive })
        .where('id', '=', id)
        .execute();
    }

    await writeAudit(trx, {
      actorUserId: input.actorUserId,
      action: existing ? 'update' : 'create',
      entity: 'core.plants',
      entityId: id,
      field: plantCode,
      newValue: JSON.stringify({
        companyId: input.companyId,
        plantCode,
        name,
        locationId: input.locationId,
        isActive: input.isActive,
      }),
      ip: input.ip ?? null,
    });

    const rows = await listPlants(trx, { activeOnly: false, companyId: input.companyId });
    const row = rows.find((plant) => plant.id === id);
    if (!row) throw new Error('Plant upsert failed');
    return row;
  });
}

export async function listMisCodes(
  db: Db,
  opts: { activeOnly?: boolean; companyId?: number } = {},
): Promise<MisCodeRow[]> {
  let q = db
    .selectFrom('core.mis_codes as m')
    .innerJoin('core.companies as c', 'c.id', 'm.company_id')
    .select([
      'm.id',
      'm.company_id',
      'c.code as company_code',
      'm.code',
      'm.name',
      'm.parent_id',
      'm.is_active',
    ])
    .orderBy('c.code')
    .orderBy('m.code');

  if (opts.activeOnly !== false) {
    q = q.where('m.is_active', '=', true);
  }
  if (opts.companyId !== undefined) {
    q = q.where('m.company_id', '=', opts.companyId);
  }

  const rows = await q.execute();
  return rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyCode: r.company_code,
    code: r.code,
    name: r.name,
    parentId: r.parent_id,
    isActive: r.is_active,
  }));
}

export async function upsertMisCode(
  db: Kysely<Database>,
  input: {
    companyId: number;
    code: string;
    name: string;
    parentId: number | null;
    isActive: boolean;
    actorUserId: number;
    ip?: string | null;
  },
): Promise<MisCodeRow> {
  const code = input.code.trim();
  if (code === '') throw new Error('MIS code is required');
  const name = input.name.trim();
  if (name === '') throw new Error('MIS name is required');

  return db.transaction().execute(async (trx) => {
    const company = await trx
      .selectFrom('core.companies')
      .select('id')
      .where('id', '=', input.companyId)
      .executeTakeFirst();
    if (!company) throw new Error('Company not found');

    if (input.parentId !== null) {
      const parent = await trx
        .selectFrom('core.mis_codes')
        .select('id')
        .where('id', '=', input.parentId)
        .where('company_id', '=', input.companyId)
        .executeTakeFirst();
      if (!parent) throw new Error('Parent MIS code must belong to the same company');
    }

    const existing = await trx
      .selectFrom('core.mis_codes')
      .select('id')
      .where('company_id', '=', input.companyId)
      .where('code', '=', code)
      .forUpdate()
      .executeTakeFirst();

    const id = existing
      ? existing.id
      : (
          await trx
            .insertInto('core.mis_codes')
            .values({
              company_id: input.companyId,
              code,
              name,
              parent_id: input.parentId,
              is_active: input.isActive,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;

    if (existing) {
      if (input.parentId === id) throw new Error('MIS code cannot be its own parent');
      await trx
        .updateTable('core.mis_codes')
        .set({ name, parent_id: input.parentId, is_active: input.isActive })
        .where('id', '=', id)
        .execute();
    }

    await writeAudit(trx, {
      actorUserId: input.actorUserId,
      action: existing ? 'update' : 'create',
      entity: 'core.mis_codes',
      entityId: id,
      field: code,
      newValue: JSON.stringify({
        companyId: input.companyId,
        code,
        name,
        parentId: input.parentId,
        isActive: input.isActive,
      }),
      ip: input.ip ?? null,
    });

    const rows = await listMisCodes(trx, { activeOnly: false, companyId: input.companyId });
    const row = rows.find((mis) => mis.id === id);
    if (!row) throw new Error('MIS code upsert failed');
    return row;
  });
}

