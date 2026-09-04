/**
 * CMP-17/18 — the compliance calendar and its filing evidence.
 *
 * `overdue` is computed here from `due_on`, never stored (see the migration
 * header). The consequence worth stating: this module is the ONLY place that
 * decides what overdue means, so a filing cannot look green in one screen and
 * red in another.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { CalendarFrequency, CalendarStatus } from '../../core/db/types.cmp.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';

/** What a person sees — the stored status, widened by the derived one. */
export type DerivedStatus = 'due' | 'overdue' | 'filed' | 'waived';

export interface CalendarItemView {
  id: number;
  companyId: number;
  companyName: string;
  obligationCode: string;
  title: string;
  frequency: CalendarFrequency;
  periodLabel: string;
  dueOn: string;
  ownerEmail: string | null;
  status: DerivedStatus;
  daysUntilDue: number;
  evidenceCount: number;
  filedAt: string | null;
  waivedReason: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// DATE columns arrive as local midnight — see core/dates.ts (the F6 bug).
const iso = formatDbDate;

function startOfDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * A stored `due` item whose date has passed is overdue. `filed` and `waived`
 * are terminal — a filing does not become overdue after the fact.
 */
export function deriveStatus(stored: CalendarStatus, dueOn: Date, today: Date): DerivedStatus {
  if (stored !== 'due') return stored;
  return startOfDay(dueOn) < startOfDay(today) ? 'overdue' : 'due';
}

export interface CalendarFilters {
  companyId?: number;
  /** Days ahead to include. Past-due items are ALWAYS included regardless. */
  lookaheadDays: number;
  includeSettled: boolean;
}

export async function listCalendar(
  db: Kysely<Database>,
  filters: CalendarFilters,
  today: Date,
): Promise<CalendarItemView[]> {
  const horizon = new Date(startOfDay(today) + filters.lookaheadDays * MS_PER_DAY);

  const rows = await db
    .selectFrom('cmp.calendar_items as i')
    .innerJoin('core.companies as c', 'c.id', 'i.company_id')
    .leftJoin('core.users as u', 'u.id', 'i.owner_user_id')
    .select((eb) => [
      'i.id',
      'i.company_id',
      'i.obligation_code',
      'i.title',
      'i.frequency',
      'i.period_label',
      'i.due_on',
      'i.status',
      'i.filed_at',
      'i.waived_reason',
      'c.name as company_name',
      'u.email as owner_email',
      eb
        .selectFrom('cmp.filing_evidence as e')
        .select((inner) => inner.fn.countAll<string>().as('n'))
        .whereRef('e.calendar_item_id', '=', 'i.id')
        .as('evidence_count'),
    ])
    .$if(filters.companyId !== undefined, (q) => q.where('i.company_id', '=', filters.companyId ?? 0))
    .$if(!filters.includeSettled, (q) => q.where('i.status', '=', 'due'))
    // Anything already past due stays visible however far back it goes: an
    // obligation missed four months ago is the one that matters most.
    .where((eb) =>
      eb.or([eb('i.due_on', '<=', horizon), eb('i.status', '=', 'due')]),
    )
    .orderBy('i.due_on', 'asc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    obligationCode: row.obligation_code,
    title: row.title,
    frequency: row.frequency,
    periodLabel: row.period_label,
    dueOn: iso(row.due_on),
    ownerEmail: row.owner_email,
    status: deriveStatus(row.status, row.due_on, today),
    daysUntilDue: Math.round((startOfDay(row.due_on) - startOfDay(today)) / MS_PER_DAY),
    evidenceCount: Number(row.evidence_count ?? 0),
    filedAt: row.filed_at?.toISOString() ?? null,
    waivedReason: row.waived_reason,
  }));
}

export interface CalendarItemInput {
  id?: number;
  companyId: number;
  obligationCode: string;
  title: string;
  frequency: CalendarFrequency;
  periodLabel: string;
  dueOn: string;
  ownerUserId: number | null;
  registrationId: number | null;
}

export async function upsertCalendarItem(
  db: Kysely<Database>,
  input: CalendarItemInput,
  actorUserId: number,
): Promise<number> {
  const values = {
    company_id: input.companyId,
    obligation_code: input.obligationCode.trim(),
    title: input.title.trim(),
    frequency: input.frequency,
    period_label: input.periodLabel.trim(),
    due_on: input.dueOn,
    owner_user_id: input.ownerUserId,
    registration_id: input.registrationId,
  };

  if (input.id === undefined) {
    const created = await db
      .insertInto('cmp.calendar_items')
      .values(values)
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAudit(db, {
      actorUserId,
      action: 'create',
      entity: 'cmp.calendar_items',
      entityId: created.id,
      newValue: `${values.obligation_code} ${values.period_label} due ${input.dueOn}`,
    });
    return created.id;
  }

  await db.updateTable('cmp.calendar_items').set(values).where('id', '=', input.id).execute();
  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'cmp.calendar_items',
    entityId: input.id,
    newValue: `${values.obligation_code} ${values.period_label} due ${input.dueOn}`,
  });
  return input.id;
}

export type FilingResult = { ok: true } | { ok: false; reason: 'not_found' | 'already_settled' };

/**
 * CMP-18 — filing and its evidence are ONE transaction. Marking something filed
 * without the challan attached is the failure mode this whole table exists to
 * prevent, so the two cannot come apart.
 */
export async function recordFiling(
  db: Kysely<Database>,
  input: { itemId: number; reference: string; documentPath: string | null; remark: string | null },
  actorUserId: number,
): Promise<FilingResult> {
  const item = await db
    .selectFrom('cmp.calendar_items')
    .select(['id', 'status', 'obligation_code', 'period_label'])
    .where('id', '=', input.itemId)
    .executeTakeFirst();

  if (!item) return { ok: false, reason: 'not_found' };
  if (item.status !== 'due') return { ok: false, reason: 'already_settled' };

  const filedAt = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('cmp.filing_evidence')
      .values({
        calendar_item_id: input.itemId,
        reference: input.reference.trim(),
        document_path: input.documentPath,
        remark: input.remark,
        filed_by_user_id: actorUserId,
      })
      .execute();
    await trx
      .updateTable('cmp.calendar_items')
      .set({ status: 'filed', filed_at: filedAt, filed_by_user_id: actorUserId })
      .where('id', '=', input.itemId)
      .execute();
  });

  await writeAudit(db, {
    actorUserId,
    action: 'filed',
    entity: 'cmp.calendar_items',
    entityId: input.itemId,
    newValue: `${item.obligation_code} ${item.period_label} — ref ${input.reference.trim()}`,
  });
  return { ok: true };
}

/**
 * A waiver is the only way to settle an obligation without evidence, so it
 * demands a reason (the DB enforces it too) and is audited under its own action
 * — "waived" must never be indistinguishable from "filed" in the log.
 */
export async function waiveItem(
  db: Kysely<Database>,
  input: { itemId: number; reason: string },
  actorUserId: number,
): Promise<FilingResult> {
  const item = await db
    .selectFrom('cmp.calendar_items')
    .select(['id', 'status', 'obligation_code', 'period_label'])
    .where('id', '=', input.itemId)
    .executeTakeFirst();

  if (!item) return { ok: false, reason: 'not_found' };
  if (item.status !== 'due') return { ok: false, reason: 'already_settled' };

  await db
    .updateTable('cmp.calendar_items')
    .set({
      status: 'waived',
      waived_reason: input.reason.trim(),
      waived_by_user_id: actorUserId,
      waived_at: new Date(),
    })
    .where('id', '=', input.itemId)
    .execute();

  await writeAudit(db, {
    actorUserId,
    action: 'waived',
    entity: 'cmp.calendar_items',
    entityId: input.itemId,
    newValue: `${item.obligation_code} ${item.period_label} — ${input.reason.trim()}`,
  });
  return { ok: true };
}

export async function listEvidence(
  db: Kysely<Database>,
  itemId: number,
): Promise<{ reference: string; remark: string | null; recordedAt: string; filedByEmail: string }[]> {
  const rows = await db
    .selectFrom('cmp.filing_evidence as e')
    .innerJoin('core.users as u', 'u.id', 'e.filed_by_user_id')
    .select(['e.reference', 'e.remark', 'e.recorded_at', 'u.email as filed_by_email'])
    .where('e.calendar_item_id', '=', itemId)
    .orderBy('e.recorded_at', 'desc')
    .execute();

  return rows.map((row) => ({
    reference: row.reference,
    remark: row.remark,
    recordedAt: row.recorded_at.toISOString(),
    filedByEmail: row.filed_by_email,
  }));
}
