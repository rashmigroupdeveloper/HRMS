/**
 * CMP-15/16/19 — statutory registrations, licences and compliance posture.
 *
 * Posture maps per-entity risk (who is about to have a problem).
 * Active registrations are retired with reason, never hard-deleted.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { RegistrationKind } from '../../core/db/types.cmp.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { enqueue } from '../notifications/index.js';
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
  allowedCompanyIds?: Set<number> | null;
}

const iso = formatDbDate;

export async function listRegistrations(
  db: Kysely<Database>,
  filters: RegistrationFilters,
  today: Date,
  stages: readonly number[],
): Promise<RegistrationView[]> {
  if (filters.allowedCompanyIds?.size === 0) {
    return [];
  }

  if (filters.companyId !== undefined && filters.allowedCompanyIds) {
    if (!filters.allowedCompanyIds.has(filters.companyId)) {
      return [];
    }
  }

  const allowedList = filters.allowedCompanyIds ? Array.from(filters.allowedCompanyIds) : null;

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
    .$if(filters.companyId === undefined && allowedList !== null, (q) =>
      q.where('r.company_id', 'in', allowedList ?? []),
    )
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

/** CMP-19 — the board: per-company compliance posture. */
export async function registrationPosture(
  db: Kysely<Database>,
  today: Date,
  stages: readonly number[],
  allowedCompanyIds?: Set<number> | null,
): Promise<CompanyPosture[]> {
  const rows = await listRegistrations(
    db,
    { ...(allowedCompanyIds ? { allowedCompanyIds } : {}) },
    today,
    stages,
  );
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
    (a, b) =>
      b.expired - a.expired ||
      b.expiring - a.expiring ||
      a.companyName.localeCompare(b.companyName),
  );
}

export interface RegistrationAlertReceipt {
  notificationId: number;
  recipientUserId: number;
}

export async function sendRegistrationAlert(
  db: Kysely<Database>,
  registrationId: number,
  actorUserId: number,
  stages: readonly number[],
): Promise<{ ok: boolean; receipt?: RegistrationAlertReceipt; error?: string }> {
  const reg = await db
    .selectFrom('cmp.registrations')
    .select([
      'id',
      'kind',
      'registration_no',
      'valid_to',
      'renewal_owner_user_id',
      'is_active',
    ])
    .where('id', '=', registrationId)
    .executeTakeFirst();

  if (!reg?.is_active) return { ok: false, error: 'Registration not found or inactive' };
  if (!reg.renewal_owner_user_id) return { ok: false, error: 'No renewal owner assigned' };

  const today = new Date();
  const expiry = expiryState(reg.valid_to, today, stages);

  const notificationId = await enqueue(db, {
    channel: 'in_app',
    recipientUserId: reg.renewal_owner_user_id,
    templateCode: 'cmp_licence_expiry',
    payload: {
      registrationId: reg.id,
      kind: reg.kind,
      registrationNo: reg.registration_no,
      validTo: reg.valid_to ? iso(reg.valid_to) : null,
      state: expiry.state,
      daysRemaining: expiry.daysRemaining,
      stage: expiry.stage,
    },
  });

  await writeAudit(db, {
    actorUserId,
    action: 'notified',
    entity: 'cmp.registrations',
    entityId: reg.id,
    newValue: `Expiry alert dispatched to owner user ${String(reg.renewal_owner_user_id)} (receipt #${String(notificationId)})`,
  });

  return {
    ok: true,
    receipt: {
      notificationId,
      recipientUserId: reg.renewal_owner_user_id,
    },
  };
}
