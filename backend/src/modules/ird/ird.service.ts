/**
 * Stage 5.5 — POSH / grievance / whistleblower service (skeleton).
 *
 * The load-bearing property is negative: a caller without `ird.posh.handle`
 * cannot open a case. IC members are NEVER invented here — list returns empty
 * until the sponsor appoints.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** One-time claim token — 32 random bytes as hex (64 chars). */
export function mintClaimToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, hash: sha256Hex(token) };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function caseRef(prefix: string, id: number, filedAt: Date): string {
  const year = filedAt.getUTCFullYear();
  return `${prefix}-${String(year)}-${String(id).padStart(5, '0')}`;
}

export interface IcMemberView {
  id: number;
  employeeId: number;
  role: 'presiding_officer' | 'member' | 'external';
  active: boolean;
  appointedOn: string;
}

/**
 * List IC members. Empty is the honest default — do not seed placeholder people.
 */
export async function listIcMembers(db: Kysely<Database>): Promise<{
  members: IcMemberView[];
  constituted: boolean;
  banner: string;
}> {
  const rows = await db
    .selectFrom('ird.ic_members')
    .select(['id', 'employee_id', 'role', 'active', 'appointed_on'])
    .where('active', '=', true)
    .orderBy('appointed_on')
    .execute();

  const members: IcMemberView[] = rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    role: row.role,
    active: row.active,
    appointedOn:
      row.appointed_on instanceof Date
        ? formatDbDate(row.appointed_on)
        : String(row.appointed_on).slice(0, 10),
  }));

  const constituted = members.length > 0;
  return {
    members,
    constituted,
    banner: constituted
      ? 'Internal Committee is constituted.'
      : 'IC not constituted — awaiting sponsor appointment',
  };
}

export interface PoshCaseListItem {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
  isAnonymous: boolean;
}

export async function listPoshCases(db: Kysely<Database>): Promise<PoshCaseListItem[]> {
  const rows = await db
    .selectFrom('ird.posh_cases')
    .select(['id', 'case_ref', 'status', 'filed_at', 'is_anonymous'])
    .orderBy('filed_at', 'desc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    caseRef: row.case_ref,
    status: row.status,
    filedAt: iso(row.filed_at),
    isAnonymous: row.is_anonymous,
  }));
}

export async function filePoshAuthenticated(
  db: Kysely<Database>,
  input: { userId: number; summary: string; ip: string | null },
): Promise<{ id: number; caseRef: string }> {
  const inserted = await db
    .insertInto('ird.posh_cases')
    .values({
      case_ref: `POSH-TMP-${randomBytes(8).toString('hex')}`,
      filed_by_user_id: input.userId,
      is_anonymous: false,
      summary_encrypted_or_text: input.summary.trim(),
      anonymous_token_hash: null,
    })
    .returning(['id', 'filed_at'])
    .executeTakeFirstOrThrow();

  const ref = caseRef('POSH', inserted.id, inserted.filed_at);
  await db
    .updateTable('ird.posh_cases')
    .set({ case_ref: ref })
    .where('id', '=', inserted.id)
    .execute();

  await writeAudit(db, {
    actorUserId: input.userId,
    action: 'create',
    entity: 'ird.posh_cases',
    entityId: inserted.id,
    newValue: ref,
    ip: input.ip,
  });

  return { id: inserted.id, caseRef: ref };
}

/**
 * Anonymous POSH intake — returns the claim token ONCE. Only the hash is stored.
 */
export async function filePoshAnonymous(
  db: Kysely<Database>,
  input: { summary: string; ip: string | null },
): Promise<{ id: number; caseRef: string; claimToken: string }> {
  const { token, hash } = mintClaimToken();
  const inserted = await db
    .insertInto('ird.posh_cases')
    .values({
      case_ref: `POSH-TMP-${randomBytes(8).toString('hex')}`,
      filed_by_user_id: null,
      is_anonymous: true,
      summary_encrypted_or_text: input.summary.trim(),
      anonymous_token_hash: hash,
    })
    .returning(['id', 'filed_at'])
    .executeTakeFirstOrThrow();

  const ref = caseRef('POSH', inserted.id, inserted.filed_at);
  await db
    .updateTable('ird.posh_cases')
    .set({ case_ref: ref })
    .where('id', '=', inserted.id)
    .execute();

  await writeAudit(db, {
    action: 'create',
    entity: 'ird.posh_cases',
    entityId: inserted.id,
    newValue: `${ref}:anonymous`,
    ip: input.ip,
  });

  return { id: inserted.id, caseRef: ref, claimToken: token };
}

export interface PoshCaseDetail {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
  isAnonymous: boolean;
  summary: string;
}

/**
 * Open a POSH case for a permitted, stepped-up handler. Writes the append-only
 * access log AND a hash-chained audit row.
 */
export async function openPoshCase(
  db: Kysely<Database>,
  input: { caseId: number; actorUserId: number; ip: string | null },
): Promise<PoshCaseDetail | null> {
  const row = await db
    .selectFrom('ird.posh_cases')
    .selectAll()
    .where('id', '=', input.caseId)
    .executeTakeFirst();

  if (!row) return null;

  await db
    .insertInto('ird.posh_case_access_log')
    .values({
      case_id: row.id,
      actor_user_id: input.actorUserId,
      ip: input.ip,
      outcome: 'opened',
    })
    .execute();

  await writeAudit(db, {
    actorUserId: input.actorUserId,
    action: 'read',
    entity: 'ird.posh_cases',
    entityId: row.id,
    field: 'summary_encrypted_or_text',
    newValue: 'opened',
    ip: input.ip,
  });

  return {
    id: row.id,
    caseRef: row.case_ref,
    status: row.status,
    filedAt: iso(row.filed_at),
    isAnonymous: row.is_anonymous,
    summary: row.summary_encrypted_or_text,
  };
}

export interface GrievanceListItem {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
  filedByUserId: number;
}

export async function listGrievances(db: Kysely<Database>): Promise<GrievanceListItem[]> {
  const rows = await db
    .selectFrom('ird.grievances')
    .select(['id', 'case_ref', 'status', 'filed_at', 'filed_by_user_id'])
    .orderBy('filed_at', 'desc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    caseRef: row.case_ref,
    status: row.status,
    filedAt: iso(row.filed_at),
    filedByUserId: row.filed_by_user_id,
  }));
}

export async function fileGrievance(
  db: Kysely<Database>,
  input: { userId: number; summary: string; ip: string | null },
): Promise<{ id: number; caseRef: string }> {
  const inserted = await db
    .insertInto('ird.grievances')
    .values({
      case_ref: `GRV-TMP-${randomBytes(8).toString('hex')}`,
      filed_by_user_id: input.userId,
      summary: input.summary.trim(),
    })
    .returning(['id', 'filed_at'])
    .executeTakeFirstOrThrow();

  const ref = caseRef('GRV', inserted.id, inserted.filed_at);
  await db
    .updateTable('ird.grievances')
    .set({ case_ref: ref })
    .where('id', '=', inserted.id)
    .execute();

  await writeAudit(db, {
    actorUserId: input.userId,
    action: 'create',
    entity: 'ird.grievances',
    entityId: inserted.id,
    newValue: ref,
    ip: input.ip,
  });

  return { id: inserted.id, caseRef: ref };
}

/**
 * Rate-limit stub for public whistleblower intake. Real limits land with the
 * full Stage 5.5 build; this always allows so the channel is exercisable now.
 */
/**
 * REMOVED 5 Sep 2026 (audit W0-T38, finding [B4]).
 *
 * This was `void ip; return true;` — a stub whose route summary said
 * "(rate-limit stub)" and whose unit test asserted that it returned `true`,
 * i.e. a green test for an unimplemented control. Anonymous POSH and
 * whistleblower intake were therefore unthrottled, and abuse there does not
 * merely waste CPU: it poisons a statutory register an IC must then triage.
 *
 * Throttling now happens where throttling belongs — as HTTP middleware in
 * `src/app.ts` (`intakeLimiter`, 10 per hour per address), in front of the
 * route, rather than as a domain function the domain cannot enforce.
 */

export async function fileWhistleblower(
  db: Kysely<Database>,
  input: { summary: string; ip: string | null },
): Promise<{ id: number; claimToken: string }> {
  const { token, hash } = mintClaimToken();
  const inserted = await db
    .insertInto('ird.whistleblower_reports')
    .values({
      anonymous_token_hash: hash,
      summary: input.summary.trim(),
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    action: 'create',
    entity: 'ird.whistleblower_reports',
    entityId: inserted.id,
    newValue: 'anonymous',
    ip: input.ip,
  });

  return { id: inserted.id, claimToken: token };
}
