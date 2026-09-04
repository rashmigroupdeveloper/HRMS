/**
 * CMP-15/16/19 — statutory registrations and licences.
 *
 * The posture view is the point of this file. A list of licences is a filing
 * cabinet; a posture is "which of the fourteen entities is about to have a
 * problem, and whose name is against it".
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { RegistrationKind } from '../../core/db/types.cmp.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { expiryState, expiryUrgency, type ExpiryView } from './expiry.js';

export interface RegistrationView {
  id: number;
  companyId: number;
  companyName: string;
  locationId: number | null;
  locationName: string | null;
  kind: RegistrationKind;
  registrationNo: string;
  issuingAuthority: string | null;
  validFrom: string;
  validTo: string | null;
  renewalOwnerEmail: string | null;
  notes: string | null;
  expiry: ExpiryView;
}

export interface RegistrationFilters {
  companyId?: number;
  locationId?: number;
  kind?: RegistrationKind;
  /** Only rows the ladder is currently alerting on, or already past. */
  needsAttentionOnly?: boolean;
}

// DATE columns arrive as local midnight — see core/dates.ts (the F6 bug).
const iso = formatDbDate;

export async function listRegistrations(
  db: Kysely<Database>,
  filters: RegistrationFilters,
  today: Date,
  stages: readonly number[],
): Promise<RegistrationView[]> {
  const rows = await db
    .selectFrom('cmp.registrations as r')
    .innerJoin('core.companies as c', 'c.id', 'r.company_id')
    .leftJoin('core.locations as l', 'l.id', 'r.location_id')
    .leftJoin('core.users as u', 'u.id', 'r.renewal_owner_user_id')
    .select([
      'r.id',
      'r.company_id',
      'r.location_id',
      'r.kind',
      'r.registration_no',
      'r.issuing_authority',
      'r.valid_from',
      'r.valid_to',
      'r.notes',
      'c.name as company_name',
      'l.name as location_name',
      'u.email as owner_email',
    ])
    .where('r.is_active', '=', true)
    .$if(filters.companyId !== undefined, (q) => q.where('r.company_id', '=', filters.companyId ?? 0))
    .$if(filters.locationId !== undefined, (q) => q.where('r.location_id', '=', filters.locationId ?? 0))
    .$if(filters.kind !== undefined, (q) => q.where('r.kind', '=', filters.kind ?? 'other'))
    .execute();

  const views = rows.map((row): RegistrationView => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    locationId: row.location_id,
    locationName: row.location_name,
    kind: row.kind,
    registrationNo: row.registration_no,
    issuingAuthority: row.issuing_authority,
    validFrom: iso(row.valid_from),
    validTo: row.valid_to === null ? null : iso(row.valid_to),
    renewalOwnerEmail: row.owner_email,
    notes: row.notes,
    expiry: expiryState(row.valid_to, today, stages),
  }));

  const filtered =
    filters.needsAttentionOnly === true
      ? views.filter((v) => v.expiry.state === 'expiring' || v.expiry.state === 'expired')
      : views;

  // Most urgent first — an expired licence outranks everything else on screen.
  return filtered.sort((a, b) => expiryUrgency(a.expiry) - expiryUrgency(b.expiry));
}

export interface RegistrationInput {
  id?: number;
  companyId: number;
  locationId: number | null;
  kind: RegistrationKind;
  registrationNo: string;
  issuingAuthority: string | null;
  validFrom: string;
  validTo: string | null;
  renewalOwnerUserId: number | null;
  documentPath: string | null;
  notes: string | null;
}

export async function upsertRegistration(
  db: Kysely<Database>,
  input: RegistrationInput,
  actorUserId: number,
): Promise<number> {
  const values = {
    company_id: input.companyId,
    location_id: input.locationId,
    kind: input.kind,
    registration_no: input.registrationNo.trim(),
    issuing_authority: input.issuingAuthority,
    valid_from: input.validFrom,
    valid_to: input.validTo,
    renewal_owner_user_id: input.renewalOwnerUserId,
    document_path: input.documentPath,
    notes: input.notes,
  };

  if (input.id === undefined) {
    const created = await db
      .insertInto('cmp.registrations')
      .values(values)
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAudit(db, {
      actorUserId,
      action: 'create',
      entity: 'cmp.registrations',
      entityId: created.id,
      newValue: `${input.kind} ${values.registration_no}`,
    });
    return created.id;
  }

  const previous = await db
    .selectFrom('cmp.registrations')
    .select(['registration_no', 'valid_to'])
    .where('id', '=', input.id)
    .executeTakeFirst();

  await db.updateTable('cmp.registrations').set(values).where('id', '=', input.id).execute();
  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'cmp.registrations',
    entityId: input.id,
    field: 'validity',
    oldValue:
      previous === undefined
        ? null
        : `${previous.registration_no} → ${previous.valid_to === null ? 'perpetual' : iso(previous.valid_to)}`,
    newValue: `${values.registration_no} → ${input.validTo ?? 'perpetual'}`,
  });
  return input.id;
}

/**
 * Registrations are retired, never deleted: the fact that a licence existed and
 * covered a period is itself the evidence an inspection asks for.
 */
export async function retireRegistration(
  db: Kysely<Database>,
  id: number,
  actorUserId: number,
  reason: string,
): Promise<void> {
  await db.updateTable('cmp.registrations').set({ is_active: false }).where('id', '=', id).execute();
  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'cmp.registrations',
    entityId: id,
    field: 'is_active',
    oldValue: 'true',
    newValue: `false — ${reason}`,
  });
}

export interface CompanyPosture {
  companyId: number;
  companyName: string;
  expired: number;
  expiring: number;
  valid: number;
  perpetual: number;
}

/** CMP-19 — the board: which entity is about to have a problem. */
export async function registrationPosture(
  db: Kysely<Database>,
  today: Date,
  stages: readonly number[],
): Promise<CompanyPosture[]> {
  const rows = await listRegistrations(db, {}, today, stages);
  const byCompany = new Map<number, CompanyPosture>();

  for (const row of rows) {
    const entry = byCompany.get(row.companyId) ?? {
      companyId: row.companyId,
      companyName: row.companyName,
      expired: 0,
      expiring: 0,
      valid: 0,
      perpetual: 0,
    };
    entry[row.expiry.state] += 1;
    byCompany.set(row.companyId, entry);
  }

  return [...byCompany.values()].sort(
    (a, b) => b.expired - a.expired || b.expiring - a.expiring || a.companyName.localeCompare(b.companyName),
  );
}
