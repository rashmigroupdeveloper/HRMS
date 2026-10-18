/**
 * Org masters CRUD (SOW 004, C-48, handover item 2): companies with their
 * statutory registrations, org units, locations, cost centres, departments,
 * designations and grades. super_admin only (`org.masters.manage`); every
 * change is audited; a master that is still referenced cannot be deleted.
 */
import type { Kysely } from 'kysely';
import { writeAudit } from '../../core/audit/audit.service.js';
import type { Database } from '../../core/db/types.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';

export const MASTER_KINDS = ['companies', 'org_units', 'locations', 'cost_centers', 'departments', 'designations', 'grades'] as const;
export type MasterKind = (typeof MASTER_KINDS)[number];

type Table = 'core.companies' | 'core.org_units' | 'core.locations' | 'core.cost_centers' | 'core.departments' | 'core.designations' | 'core.grades';
const TABLE: Record<MasterKind, Table> = {
  companies: 'core.companies', org_units: 'core.org_units', locations: 'core.locations', cost_centers: 'core.cost_centers',
  departments: 'core.departments', designations: 'core.designations', grades: 'core.grades',
};

/** Columns a caller may set, per master (anything else is ignored). */
const WRITABLE: Record<MasterKind, readonly string[]> = {
  companies: ['code', 'name', 'ecode_prefix', 'gstin', 'pan', 'tan', 'pf_establishment_code', 'esic_code', 'pt_registration_no', 'address'],
  org_units: ['company_id', 'parent_id', 'name'],
  locations: ['company_id', 'name', 'state_code'],
  cost_centers: ['company_id', 'code', 'name'],
  departments: ['name'],
  designations: ['name'],
  grades: ['code', 'name', 'rank'],
};

/** Columns that must be present on create. */
const REQUIRED: Record<MasterKind, readonly string[]> = {
  companies: ['code', 'name', 'ecode_prefix'], org_units: ['company_id', 'name'], locations: ['company_id', 'name', 'state_code'],
  cost_centers: ['company_id', 'code', 'name'], departments: ['name'], designations: ['name'], grades: ['code', 'name', 'rank'],
};

/** Who references each master — a delete is refused while any row points at it. */
const REFERENCES: Record<MasterKind, readonly [string, string][]> = {
  companies: [['core.employees', 'company_id'], ['core.org_units', 'company_id'], ['core.locations', 'company_id']],
  org_units: [['core.employees', 'org_unit_id'], ['core.org_units', 'parent_id']],
  locations: [['core.employees', 'location_id']],
  cost_centers: [['core.employees', 'cost_center_id']],
  departments: [['core.employees', 'department_id'], ['core.department_heads', 'department_id']],
  designations: [['core.employees', 'designation_id']],
  grades: [['core.employees', 'grade_id']],
};

/** Company statutory registration formats (India). null = valid. */
const COMPANY_ID_RULES: Record<string, [RegExp, string]> = {
  pan: [/^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/, 'Company PAN must look like AABCR1234K'],
  tan: [/^[A-Z]{4}\d{5}[A-Z]$/, 'TAN must look like CALR12345A'],
  gstin: [/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'GSTIN must be 15 characters like 19AABCR1234K1Z5'],
  pf_establishment_code: [/^[A-Z]{5}\d{7}(\d{3})?$/, 'PF establishment code must look like WBCAL0012345 (optionally +3-digit extension)'],
  esic_code: [/^\d{17}$/, 'ESIC employer code must be 17 digits'],
  pt_registration_no: [/^[A-Z0-9/-]{4,30}$/, 'PT registration: 4–30 letters, digits, / or -'],
};

export type MasterValues = Record<string, string | number | null>;

export function validateMaster(kind: MasterKind, values: MasterValues, creating: boolean): MasterValues {
  const out: MasterValues = {};
  for (const key of WRITABLE[kind]) {
    if (!(key in values)) continue;
    let v = values[key] ?? null;
    if (typeof v === 'string') {
      v = v.trim();
      if (v === '') v = null;
    }
    out[key] = v;
  }
  if (creating) {
    for (const key of REQUIRED[kind]) if (out[key] === null || out[key] === undefined) throw new DomainError(`${key.replace(/_/g, ' ')} is required`);
  } else {
    for (const key of REQUIRED[kind]) if (key in out && out[key] === null) throw new DomainError(`${key.replace(/_/g, ' ')} cannot be blank`);
  }
  if (kind === 'companies') {
    for (const [key, [re, msg]] of Object.entries(COMPANY_ID_RULES)) {
      const v = out[key];
      if (typeof v === 'string') {
        const norm = v.toUpperCase().replace(/\s/g, '');
        if (!re.test(norm)) throw new DomainError(msg);
        out[key] = norm;
      }
    }
    for (const key of ['code', 'ecode_prefix'] as const) {
      const v = out[key];
      if (typeof v === 'string') {
        if (!/^[A-Z][A-Z0-9]{1,9}$/i.test(v)) throw new DomainError(`${key === 'code' ? 'Company code' : 'E-code prefix'} must be 2–10 letters/digits`);
        out[key] = v.toUpperCase();
      }
    }
    const pan = out['pan'];
    const gstin = out['gstin'];
    if (typeof pan === 'string' && typeof gstin === 'string' && gstin.slice(2, 12) !== pan) throw new DomainError('GSTIN characters 3–12 must equal the company PAN');
  }
  if (kind === 'locations' && typeof out['state_code'] === 'string' && !/^[A-Z]{2}$/i.test(out['state_code'])) throw new DomainError('State code must be 2 letters (e.g. WB)');
  if (kind === 'locations' && typeof out['state_code'] === 'string') out['state_code'] = out['state_code'].toUpperCase();
  if (kind === 'grades' && out['rank'] !== undefined && out['rank'] !== null && (!Number.isInteger(Number(out['rank'])) || Number(out['rank']) < 0)) throw new DomainError('Rank must be a whole number ≥ 0');
  return out;
}

export async function listMasters(db: Kysely<Database>, kind: MasterKind, companyIds: number[] | null): Promise<Record<string, unknown>[]> {
  const companyBound = WRITABLE[kind].includes('company_id');
  let q = db.selectFrom(TABLE[kind]).selectAll();
  if (companyIds !== null) {
    if (kind === 'companies') q = q.where('id' as never, 'in', [...companyIds, 0] as never);
    else if (companyBound) q = q.where('company_id' as never, 'in', [...companyIds, 0] as never);
  }
  const rows = await q.orderBy('id' as never).execute();
  return rows;
}

export async function createMaster(db: Kysely<Database>, kind: MasterKind, values: MasterValues, actorUserId: number, ip: string | null): Promise<{ id: number }> {
  const clean = validateMaster(kind, values, true);
  if (kind === 'org_units') await assertParentSameCompany(db, clean);
  const row = await db.insertInto(TABLE[kind]).values(clean as never).returning('id' as never).executeTakeFirstOrThrow() as { id: number };
  await writeAudit(db, { actorUserId, action: 'create', entity: TABLE[kind], entityId: row.id, newValue: JSON.stringify(clean), ip });
  return { id: row.id };
}

export async function updateMaster(db: Kysely<Database>, kind: MasterKind, id: number, values: MasterValues, actorUserId: number, ip: string | null): Promise<{ id: number }> {
  const before = await db.selectFrom(TABLE[kind]).selectAll().where('id' as never, '=', id as never).executeTakeFirst() as Record<string, unknown> | undefined;
  if (!before) throw new NotFoundError(`${kind.replace(/_/g, ' ')} #${String(id)} not found`);
  const clean = validateMaster(kind, values, false);
  if (Object.keys(clean).length === 0) throw new DomainError('Nothing to change');
  if ('company_id' in clean && clean['company_id'] !== before['company_id']) {
    const used = await countReferences(db, kind, id);
    if (used > 0) throw new DomainError('This master is in use; its company cannot change');
  }
  if (kind === 'org_units') {
    if (clean['parent_id'] === id) throw new DomainError('An org unit cannot be its own parent');
    await assertParentSameCompany(db, { company_id: before['company_id'] as number, ...clean });
  }
  await db.updateTable(TABLE[kind]).set({ ...clean, updated_at: new Date() } as never).where('id' as never, '=', id as never).execute();
  const old: Record<string, unknown> = {};
  for (const k of Object.keys(clean)) old[k] = before[k];
  await writeAudit(db, { actorUserId, action: 'update', entity: TABLE[kind], entityId: id, oldValue: JSON.stringify(old), newValue: JSON.stringify(clean), ip });
  return { id };
}

export async function deleteMaster(db: Kysely<Database>, kind: MasterKind, id: number, actorUserId: number, ip: string | null): Promise<{ ok: boolean }> {
  const before = await db.selectFrom(TABLE[kind]).selectAll().where('id' as never, '=', id as never).executeTakeFirst();
  if (!before) throw new NotFoundError(`${kind.replace(/_/g, ' ')} #${String(id)} not found`);
  const used = await countReferences(db, kind, id);
  if (used > 0) throw new DomainError(`Cannot delete: still used by ${String(used)} record(s). Reassign them first.`);
  await db.deleteFrom(TABLE[kind]).where('id' as never, '=', id as never).execute();
  await writeAudit(db, { actorUserId, action: 'delete', entity: TABLE[kind], entityId: id, oldValue: JSON.stringify(before), ip });
  return { ok: true };
}

async function countReferences(db: Kysely<Database>, kind: MasterKind, id: number): Promise<number> {
  let total = 0;
  for (const [table, col] of REFERENCES[kind]) {
    const r = await db.selectFrom(table as 'core.employees').select((eb) => eb.fn.countAll<string>().as('n'))
      .where(col as 'company_id', '=', id).executeTakeFirst();
    total += Number(r?.n ?? 0);
  }
  return total;
}

async function assertParentSameCompany(db: Kysely<Database>, v: MasterValues): Promise<void> {
  const parentId = v['parent_id'];
  if (parentId === null || parentId === undefined) return;
  const parent = await db.selectFrom('core.org_units').select(['company_id']).where('id', '=', Number(parentId)).executeTakeFirst();
  if (!parent) throw new DomainError('Parent org unit not found');
  if (v['company_id'] !== undefined && parent.company_id !== Number(v['company_id'])) throw new DomainError('Parent org unit belongs to another company');
}
