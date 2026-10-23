/**
 * Holiday calendars per group / company / plant / location (C-35, handover item 4).
 * A holiday row applies to an employee when every non-null scope column matches:
 * company_id NULL = whole group; plant_id / location_id narrow it further.
 * Shared by day resolution, leave spans, payroll working-day divisors and the muster.
 */
import { sql, type Kysely, type RawBuilder } from 'kysely';
import { inTransaction } from './database.js';
import type { Database } from './types.js';

export interface HolidayScopeSubject {
  companyId: number;
  plantId: number | null;
  locationId: number | null;
}

export function holidayAppliesSql(alias: string, who: HolidayScopeSubject): RawBuilder<boolean> {
  const col = (c: string) => sql.ref(`${alias}.${c}`);
  return sql<boolean>`((${col('company_id')} IS NULL OR ${col('company_id')} = ${who.companyId}::bigint)
    AND (${col('plant_id')} IS NULL OR ${col('plant_id')} = ${who.plantId}::bigint)
    AND (${col('location_id')} IS NULL OR ${col('location_id')} = ${who.locationId}::bigint))`;
}

export async function loadHolidaySubject(db: Kysely<Database>, employeeId: number): Promise<HolidayScopeSubject> {
  const e = await db.selectFrom('core.employees').select(['company_id', 'plant_id', 'location_id'])
    .where('id', '=', employeeId).executeTakeFirstOrThrow();
  return { companyId: e.company_id, plantId: e.plant_id, locationId: e.location_id };
}

/** The applicable holiday on a date (most specific scope first), if any. */
export async function findHoliday(
  db: Kysely<Database>, who: HolidayScopeSubject, isoDate: string,
): Promise<{ id: number; name: string } | undefined> {
  return db.selectFrom('att.holidays as h').select(['h.id', 'h.name'])
    .where('h.holiday_date', '=', sql<Date>`${isoDate}::date`)
    .where(holidayAppliesSql('h', who))
    .orderBy(sql`(h.location_id IS NOT NULL)::int + (h.plant_id IS NOT NULL)::int + (h.company_id IS NOT NULL)::int`, 'desc')
    .executeTakeFirst();
}

/**
 * Planned off days (holiday, rostered week-off, or Sunday without a roster row)
 * in [from, until) — the same precedence as attendance day resolution.
 */
export async function readPlannedOffDays(
  db: Kysely<Database>, employeeId: number, from: string, until: string,
): Promise<Set<string>> {
  if (from >= until) return new Set();
  const who = await loadHolidaySubject(db, employeeId);
  const rows = await sql<{ d: string }>`
    SELECT to_char(g.d, 'YYYY-MM-DD') AS d
    FROM generate_series(${from}::date, ${until}::date - 1, interval '1 day') AS g(d)
    LEFT JOIN att.rosters r ON r.employee_id = ${employeeId} AND r.work_date = g.d::date
    WHERE EXISTS (SELECT 1 FROM att.holidays h WHERE h.holiday_date = g.d::date AND ${holidayAppliesSql('h', who)})
       OR r.is_week_off = true
       OR (r.employee_id IS NULL AND extract(dow FROM g.d) = 0)
  `.execute(db);
  return new Set(rows.rows.map((r) => r.d));
}

export interface HolidayScopeInput {
  companyId?: number | null | undefined;
  plantId?: number | null | undefined;
  locationId?: number | null | undefined;
}

export interface HolidayScope {
  company_id: number | null;
  plant_id: number | null;
  location_id: number | null;
}

export interface HolidayWriter {
  all: boolean;
  orgUnitIds: readonly number[];
  actorEmployeeId: number | null;
}

export interface HolidayWriteCompany {
  id: number;
  name: string;
  code: string;
}

/**
 * Companies this person may attach a holiday to.
 * Group-wide (`all`) may also save a holiday with no company.
 * An org-unit HR role may save for the companies of those units and for
 * their own employing company. Full org-unit coverage is the payroll-run
 * rule; it must not block a calendar when some employees are still unmapped.
 */
export async function holidayWriteTargets(
  db: Kysely<Database>,
  writer: HolidayWriter,
): Promise<{
  groupWide: boolean;
  companies: HolidayWriteCompany[];
  plants: { id: number; companyId: number; name: string; plantCode: string }[];
  locations: { id: number; companyId: number; name: string }[];
}> {
  const listed = () => db.selectFrom('core.companies').select(['id', 'name', 'code']).orderBy('name');
  const withPlaces = async (groupWide: boolean, companies: HolidayWriteCompany[]) => {
    if (companies.length === 0) return { groupWide, companies, plants: [], locations: [] };
    const ids = companies.map((company) => company.id);
    const [plants, locations] = await Promise.all([
      db.selectFrom('core.plants').select(['id', 'company_id', 'name', 'plant_code'])
        .where('company_id', 'in', ids).orderBy('name').execute(),
      db.selectFrom('core.locations').select(['id', 'company_id', 'name'])
        .where('company_id', 'in', ids).orderBy('name').execute(),
    ]);
    return {
      groupWide,
      companies,
      plants: plants.map((plant) => ({ id: plant.id, companyId: plant.company_id, name: plant.name, plantCode: plant.plant_code })),
      locations: locations.map((location) => ({ id: location.id, companyId: location.company_id, name: location.name })),
    };
  };
  if (writer.all) return withPlaces(true, await listed().execute());
  const ids = new Set<number>();
  if (writer.orgUnitIds.length > 0) {
    const units = await db.selectFrom('core.org_units').select('company_id')
      .where('id', 'in', [...writer.orgUnitIds]).execute();
    for (const unit of units) ids.add(unit.company_id);
  }
  if (writer.actorEmployeeId !== null) {
    const self = await db.selectFrom('core.employees').select('company_id')
      .where('id', '=', writer.actorEmployeeId).executeTakeFirst();
    if (self) ids.add(self.company_id);
  }
  if (ids.size === 0) return { groupWide: false, companies: [], plants: [], locations: [] };
  return withPlaces(false, await listed().where('id', 'in', [...ids]).execute());
}

/** Normalise a holiday scope: plant/location imply (and must match) their company. */
export async function resolveHolidayScope(db: Kysely<Database>, input: HolidayScopeInput): Promise<HolidayScope> {
  let companyId = input.companyId ?? null;
  const plantId = input.plantId ?? null;
  const locationId = input.locationId ?? null;
  if (plantId !== null) {
    const plant = await db.selectFrom('core.plants').select('company_id').where('id', '=', plantId).executeTakeFirst();
    if (!plant) throw new Error(`Unknown plant #${String(plantId)}`);
    if (companyId !== null && companyId !== plant.company_id) throw new Error('Plant belongs to a different company');
    companyId = plant.company_id;
  }
  if (locationId !== null) {
    const loc = await db.selectFrom('core.locations').select('company_id').where('id', '=', locationId).executeTakeFirst();
    if (!loc) throw new Error(`Unknown location #${String(locationId)}`);
    if (companyId !== null && companyId !== loc.company_id) throw new Error('Location belongs to a different company');
    companyId = loc.company_id;
  }
  if (companyId !== null) {
    const company = await db.selectFrom('core.companies').select('id').where('id', '=', companyId).executeTakeFirst();
    if (!company) throw new Error(`Unknown company #${String(companyId)}`);
  }
  return { company_id: companyId, plant_id: plantId, location_id: locationId };
}

/**
 * Insert or rename a holiday for a scope; returns whether it was created.
 * Unlocked, auto-computed days of covered employees on that date are queued
 * for recompute so the holiday replaces an A/P computed before it was added.
 */
export async function upsertScopedHoliday(
  db: Kysely<Database>, scope: HolidayScope, isoDate: string, name: string,
): Promise<boolean> {
  return inTransaction(db, async trx => {
  // Target-free insert handles both old and new null-aware unique indexes.
  // A losing concurrent insert waits for its winner, then updates that row.
  const inserted = await trx.insertInto('att.holidays')
    .values({ holiday_date: sql<Date>`${isoDate}::date` as unknown as Date, name, ...scope })
    .onConflict(oc => oc.doNothing()).returning('id').executeTakeFirst();
  if (!inserted) {
    await trx.updateTable('att.holidays').set({ name })
      .where('holiday_date', '=', sql<Date>`${isoDate}::date`)
      .where(sql<boolean>`company_id IS NOT DISTINCT FROM ${scope.company_id}::bigint`)
      .where(sql<boolean>`plant_id IS NOT DISTINCT FROM ${scope.plant_id}::bigint`)
      .where(sql<boolean>`location_id IS NOT DISTINCT FROM ${scope.location_id}::bigint`)
      .returning('id').executeTakeFirstOrThrow();
  }
  await sql`
    INSERT INTO att.recompute_queue (employee_id, work_date)
    SELECT d.employee_id, d.work_date
    FROM att.day_records d JOIN core.employees e ON e.id = d.employee_id
    WHERE d.work_date = ${isoDate}::date AND d.is_locked = false AND d.source = 'auto'
      AND (${scope.company_id}::bigint IS NULL OR e.company_id = ${scope.company_id}::bigint)
      AND (${scope.plant_id}::bigint IS NULL OR e.plant_id = ${scope.plant_id}::bigint)
      AND (${scope.location_id}::bigint IS NULL OR e.location_id = ${scope.location_id}::bigint)
    ON CONFLICT (employee_id, work_date) DO NOTHING
  `.execute(trx);
  return inserted !== undefined;
  });
}
