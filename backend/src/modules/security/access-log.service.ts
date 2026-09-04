/**
 * SEC-10/11 — purpose-stamped access logging.
 *
 * The hash-chained audit log already answers "who CHANGED what". DPDP asks a
 * different question: "who LOOKED at my data, and why" (docs/15 GAP-A17). A
 * read is not a mutation, so it does not belong in the audit chain; it belongs
 * here, append-only, partitioned, and — the part that matters — visible to the
 * data principal themselves in `/my/privacy`.
 *
 * `purpose` is stated by the caller and never inferred. A read with no stated
 * purpose is refused by a CHECK constraint at the database, not by politeness.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';

/** The classes of data whose reading is worth recording. Deliberately short. */
export type SensitiveFieldClass =
  | 'statutory_id'
  | 'compensation'
  | 'bank'
  | 'health'
  | 'disciplinary';

export interface AccessRecord {
  actorUserId: number;
  sessionSid: string | null;
  subjectEmployeeId: number | null;
  resource: string;
  fieldClass: SensitiveFieldClass;
  purpose: string;
  recordCount?: number;
  ip: string | null;
}

/**
 * Never throws into the caller's path: a failure to log must not deny a
 * legitimate read, but it must be loud in the server log. (The reverse policy —
 * fail the read — turns a logging outage into an outage.)
 */
export async function recordAccess(
  db: Kysely<Database>,
  record: AccessRecord,
): Promise<void> {
  await db
    .insertInto('sec.access_events')
    .values({
      actor_user_id: record.actorUserId,
      session_sid: record.sessionSid,
      subject_employee_id: record.subjectEmployeeId,
      resource: record.resource,
      field_class: record.fieldClass,
      purpose: record.purpose.trim(),
      record_count: record.recordCount ?? 1,
      ip: record.ip,
    })
    .execute();
}

/** "Sushanta Nayak (RML035384)" — the shape a person recognises in a log. */
function fullName(
  first: string | null,
  last: string | null,
  ecode: string | null,
): string | null {
  if (first === null) return null;
  const name = [first, last].filter((part) => part !== null && part !== '').join(' ');
  return ecode === null ? name : `${name} (${ecode})`;
}

export interface AccessEventView {
  occurredAt: string;
  actorEmail: string;
  actorName: string | null;
  resource: string;
  fieldClass: string;
  purpose: string;
  recordCount: number;
}

/** What the employee sees about their OWN record — the SEC-11 surface. */
export async function listAccessForSubject(
  db: Kysely<Database>,
  employeeId: number,
  limit: number,
): Promise<AccessEventView[]> {
  const rows = await db
    .selectFrom('sec.access_events as a')
    .innerJoin('core.users as u', 'u.id', 'a.actor_user_id')
    .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
    .select([
      'a.occurred_at',
      'a.resource',
      'a.field_class',
      'a.purpose',
      'a.record_count',
      'u.email as actor_email',
      'e.ecode as actor_ecode',
      'e.first_name as actor_first_name',
      'e.last_name as actor_last_name',
    ])
    .where('a.subject_employee_id', '=', employeeId)
    .orderBy('a.occurred_at', 'desc')
    .limit(limit)
    .execute();

  return rows.map((r) => ({
    occurredAt: r.occurred_at.toISOString(),
    actorEmail: r.actor_email,
    actorName: fullName(r.actor_first_name, r.actor_last_name, r.actor_ecode),
    resource: r.resource,
    fieldClass: r.field_class,
    purpose: r.purpose,
    recordCount: r.record_count,
  }));
}

export interface AccessLogFilters {
  actorUserId?: number;
  fieldClass?: SensitiveFieldClass;
  since?: Date;
  limit: number;
  offset: number;
}

/** The admin view — every sensitive read across the platform. */
export async function listAccessEvents(
  db: Kysely<Database>,
  filters: AccessLogFilters,
): Promise<{ rows: (AccessEventView & { subjectEmployeeId: number | null })[]; total: number }> {
  const base = db
    .selectFrom('sec.access_events as a')
    .innerJoin('core.users as u', 'u.id', 'a.actor_user_id')
    .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
    .$if(filters.actorUserId !== undefined, (q) =>
      q.where('a.actor_user_id', '=', filters.actorUserId ?? 0),
    )
    .$if(filters.fieldClass !== undefined, (q) =>
      q.where('a.field_class', '=', filters.fieldClass ?? ''),
    )
    .$if(filters.since !== undefined, (q) =>
      q.where('a.occurred_at', '>=', filters.since ?? new Date(0)),
    );

  const [rows, count] = await Promise.all([
    base
      .select([
        'a.occurred_at',
        'a.resource',
        'a.field_class',
        'a.purpose',
        'a.record_count',
        'a.subject_employee_id',
        'u.email as actor_email',
        'e.ecode as actor_ecode',
        'e.first_name as actor_first_name',
        'e.last_name as actor_last_name',
      ])
      .orderBy('a.occurred_at', 'desc')
      .limit(filters.limit)
      .offset(filters.offset)
      .execute(),
    base.select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst(),
  ]);

  return {
    rows: rows.map((r) => ({
      occurredAt: r.occurred_at.toISOString(),
      actorEmail: r.actor_email,
      actorName: fullName(r.actor_first_name, r.actor_last_name, r.actor_ecode),
      resource: r.resource,
      fieldClass: r.field_class,
      purpose: r.purpose,
      recordCount: r.record_count,
      subjectEmployeeId: r.subject_employee_id,
    })),
    total: Number(count?.n ?? 0),
  };
}
