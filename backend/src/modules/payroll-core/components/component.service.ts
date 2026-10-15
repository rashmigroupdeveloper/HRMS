/**
 * Salary Component Service (PAY-01, SOW crosswalk, docs/03 §6).
 */
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import type {
  SalaryComponent,
  UpdateComponentInput,
} from './definitions.js';

export async function listComponents(
  db: Kysely<Database> | Transaction<Database>,
  options: { activeOnly?: boolean | undefined } = {},
): Promise<SalaryComponent[]> {
  let query = db.selectFrom('pay.salary_components').selectAll().orderBy('display_order', 'asc');
  if (options.activeOnly) {
    query = query.where('is_active', '=', true);
  }
  const rows = await query.execute();
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    kind: r.kind,
    formula: r.formula,
    rounding: r.rounding,
    taxable: r.taxable,
    part_of_gross: r.part_of_gross,
    part_of_pf_wages: r.part_of_pf_wages,
    prorate_on_lop: r.prorate_on_lop,
    display_order: r.display_order,
    is_active: r.is_active,
  }));
}

export async function getComponent(
  db: Kysely<Database> | Transaction<Database>,
  code: string,
): Promise<SalaryComponent | null> {
  const row = await db
    .selectFrom('pay.salary_components')
    .selectAll()
    .where('code', '=', code)
    .executeTakeFirst();
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    kind: row.kind,
    formula: row.formula,
    rounding: row.rounding,
    taxable: row.taxable,
    part_of_gross: row.part_of_gross,
    part_of_pf_wages: row.part_of_pf_wages,
    prorate_on_lop: row.prorate_on_lop,
    display_order: row.display_order,
    is_active: row.is_active,
  };
}

export async function createComponent(
  db: Kysely<Database>,
  input: SalaryComponent,
  actorUserId: number | null,
): Promise<SalaryComponent> {
  const existing = await getComponent(db, input.code);
  if (existing) {
    throw new Error(`Salary component with code '${input.code}' already exists`);
  }

  const [inserted] = await db
    .insertInto('pay.salary_components')
    .values({
      code: input.code,
      name: input.name,
      kind: input.kind,
      formula: input.formula ?? null,
      rounding: input.rounding,
      taxable: input.taxable,
      part_of_gross: input.part_of_gross,
      part_of_pf_wages: input.part_of_pf_wages,
      prorate_on_lop: input.prorate_on_lop,
      display_order: input.display_order,
      is_active: input.is_active,
    })
    .returningAll()
    .execute();

  if (!inserted) {
    throw new Error('Failed to create salary component');
  }

  await writeAudit(db, {
    actorUserId,
    action: 'salary_component.create',
    entity: 'pay.salary_components',
    newValue: JSON.stringify(inserted),
  });

  return {
    code: inserted.code,
    name: inserted.name,
    kind: inserted.kind,
    formula: inserted.formula,
    rounding: inserted.rounding,
    taxable: inserted.taxable,
    part_of_gross: inserted.part_of_gross,
    part_of_pf_wages: inserted.part_of_pf_wages,
    prorate_on_lop: inserted.prorate_on_lop,
    display_order: inserted.display_order,
    is_active: inserted.is_active,
  };
}

export async function updateComponent(
  db: Kysely<Database>,
  input: UpdateComponentInput,
  actorUserId: number | null,
): Promise<SalaryComponent> {
  const existing = await getComponent(db, input.code);
  if (!existing) {
    throw new Error(`Salary component with code '${input.code}' not found`);
  }

  const updateValues: Record<string, unknown> = {};
  if (input.name !== undefined) updateValues['name'] = input.name;
  if (input.kind !== undefined) updateValues['kind'] = input.kind;
  if (input.formula !== undefined) updateValues['formula'] = input.formula;
  if (input.rounding !== undefined) updateValues['rounding'] = input.rounding;
  if (input.taxable !== undefined) updateValues['taxable'] = input.taxable;
  if (input.part_of_gross !== undefined) updateValues['part_of_gross'] = input.part_of_gross;
  if (input.part_of_pf_wages !== undefined) updateValues['part_of_pf_wages'] = input.part_of_pf_wages;
  if (input.prorate_on_lop !== undefined) updateValues['prorate_on_lop'] = input.prorate_on_lop;
  if (input.display_order !== undefined) updateValues['display_order'] = input.display_order;
  if (input.is_active !== undefined) updateValues['is_active'] = input.is_active;

  const [updated] = await db
    .updateTable('pay.salary_components')
    .set(updateValues)
    .where('code', '=', input.code)
    .returningAll()
    .execute();

  if (!updated) {
    throw new Error('Failed to update salary component');
  }

  await writeAudit(db, {
    actorUserId,
    action: 'salary_component.update',
    entity: 'pay.salary_components',
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(updated),
  });

  return {
    code: updated.code,
    name: updated.name,
    kind: updated.kind,
    formula: updated.formula,
    rounding: updated.rounding,
    taxable: updated.taxable,
    part_of_gross: updated.part_of_gross,
    part_of_pf_wages: updated.part_of_pf_wages,
    prorate_on_lop: updated.prorate_on_lop,
    display_order: updated.display_order,
    is_active: updated.is_active,
  };
}
