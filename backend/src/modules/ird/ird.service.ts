/**
 * Stage 5.5 — POSH / grievance / whistleblower service.
 *
 * Core architectural requirement: assigned-case isolation.
 * A user holding `ird.posh.handle` CANNOT browse or open a case unless they are
 * explicitly assigned to that case or serve as the active Presiding Officer.
 * Opening attempts by unassigned handlers record an append-only refusal in
 * `ird.posh_case_access_log` and throw FORBIDDEN.
 *
 * IC members are NEVER invented here — list returns empty until the sponsor
 * appoints them.
 */
import { createHash, randomBytes } from 'node:crypto';
import { ORPCError } from '@orpc/server';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { PoshCaseAssignmentRole } from '../../core/db/types.ird.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';

export function sha256Hex(value: string): string {
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

/**
 * Checks whether the user is linked to an active Presiding Officer on the IC.
 */
export async function isPresidingOfficer(db: Kysely<Database>, userId: number): Promise<boolean> {
  const user = await db
    .selectFrom('core.users')
    .select('employee_id')
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!user?.employee_id) return false;

  const po = await db
    .selectFrom('ird.ic_members')
    .select('id')
    .where('employee_id', '=', user.employee_id)
    .where('role', '=', 'presiding_officer')
    .where('active', '=', true)
    .executeTakeFirst();

  return Boolean(po);
}

/**
 * Checks whether the user is actively assigned to this specific POSH case.
 */
export async function isCaseAssigned(
  db: Kysely<Database>,
  caseId: number,
  userId: number,
): Promise<boolean> {
  const assignment = await db
    .selectFrom('ird.posh_case_assignments')
    .select('id')
    .where('case_id', '=', caseId)
    .where('user_id', '=', userId)
    .where('active', '=', true)
    .executeTakeFirst();

  return Boolean(assignment);
}

export interface PoshCaseListItem {
  id: number;
  caseRef: string;
  status: string;
  filedAt: string;
  isAnonymous: boolean;
}

/**
 * List POSH cases with assigned-case isolation:
 * - Active Presiding Officers see all cases in the queue.
 * - Assigned handlers see ONLY the cases explicitly assigned to them.
 * - Non-assigned handlers receive an empty list (preventing general HR visibility).
 */
export async function listPoshCases(
  db: Kysely<Database>,
  actorUserId: number,
): Promise<PoshCaseListItem[]> {
  const isPo = await isPresidingOfficer(db, actorUserId);

  if (isPo) {
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

  // Assigned handler view: only cases where actor is actively assigned
  const rows = await db
    .selectFrom('ird.posh_cases as c')
    .innerJoin('ird.posh_case_assignments as a', 'a.case_id', 'c.id')
    .select(['c.id', 'c.case_ref', 'c.status', 'c.filed_at', 'c.is_anonymous'])
    .where('a.user_id', '=', actorUserId)
    .where('a.active', '=', true)
    .orderBy('c.filed_at', 'desc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    caseRef: row.case_ref,
    status: row.status,
    filedAt: iso(row.filed_at),
    isAnonymous: row.is_anonymous,
  }));
}

/**
 * List cases filed by the authenticated employee themselves (ESS status view).
 */
export async function listMyPoshCases(
  db: Kysely<Database>,
  actorUserId: number,
): Promise<PoshCaseListItem[]> {
  const rows = await db
    .selectFrom('ird.posh_cases')
    .select(['id', 'case_ref', 'status', 'filed_at', 'is_anonymous'])
    .where('filed_by_user_id', '=', actorUserId)
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

/**
 * Anonymous POSH follow-up: returns status without disclosing summary or parties.
 */
export async function getPoshClaimStatus(
  db: Kysely<Database>,
  claimToken: string,
): Promise<{ caseRef: string; status: string; filedAt: string }> {
  const hash = sha256Hex(claimToken.trim());
  const row = await db
    .selectFrom('ird.posh_cases')
    .select(['case_ref', 'status', 'filed_at'])
    .where('anonymous_token_hash', '=', hash)
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError('NOT_FOUND', { message: 'No complaint found for this claim code' });
  }

  return {
    caseRef: row.case_ref,
    status: row.status,
    filedAt: iso(row.filed_at),
  };
}

/**
 * Assigns an investigator or inquiry officer to a POSH case.
 */
export async function assignPoshCase(
  db: Kysely<Database>,
  input: {
    caseId: number;
    targetUserId: number;
    role?: PoshCaseAssignmentRole | undefined;
    actorUserId: number;
    ip: string | null;
  },
): Promise<{ success: boolean; caseId: number; targetUserId: number }> {
  const role = input.role ?? 'investigator';

  const caseExists = await db
    .selectFrom('ird.posh_cases')
    .select('id')
    .where('id', '=', input.caseId)
    .executeTakeFirst();

  if (!caseExists) {
    throw new ORPCError('NOT_FOUND', { message: 'Case not found' });
  }

  await db
    .insertInto('ird.posh_case_assignments')
    .values({
      case_id: input.caseId,
      user_id: input.targetUserId,
      role,
      assigned_by_user_id: input.actorUserId,
      active: true,
    })
    .onConflict((oc) =>
      oc.columns(['case_id', 'user_id']).doUpdateSet({
        active: true,
        role,
        assigned_by_user_id: input.actorUserId,
        assigned_at: new Date(),
      }),
    )
    .execute();

  await writeAudit(db, {
    actorUserId: input.actorUserId,
    action: 'update',
    entity: 'ird.posh_case_assignments',
    entityId: input.caseId,
    newValue: `assigned:${String(input.targetUserId)}:${role}`,
    ip: input.ip,
  });

  return { success: true, caseId: input.caseId, targetUserId: input.targetUserId };
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
 * Open a POSH case with strict assigned-case isolation:
 * - Caller must be actively assigned to this case or be an active Presiding Officer.
 * - Non-assigned callers receive FORBIDDEN and an append-only refusal log is written.
 * - Authorized callers receive case detail and an 'opened' log is written.
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

  // Assigned-case isolation check
  const isPo = await isPresidingOfficer(db, input.actorUserId);
  const isAssigned = isPo || (await isCaseAssigned(db, input.caseId, input.actorUserId));

  if (!isAssigned) {
    // Record refusal in append-only log and audit trail
    await db
      .insertInto('ird.posh_case_access_log')
      .values({
        case_id: row.id,
        actor_user_id: input.actorUserId,
        ip: input.ip,
        outcome: 'refused',
      })
      .execute();

    await writeAudit(db, {
      actorUserId: input.actorUserId,
      action: 'read',
      entity: 'ird.posh_cases',
      entityId: row.id,
      field: 'summary_encrypted_or_text',
      newValue: 'refused',
      ip: input.ip,
    });

    throw new ORPCError('FORBIDDEN', {
      message: 'Case is restricted to assigned inquiry officers',
    });
  }

  // Permitted access
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

export async function listMyGrievances(
  db: Kysely<Database>,
  actorUserId: number,
): Promise<GrievanceListItem[]> {
  const rows = await db
    .selectFrom('ird.grievances')
    .select(['id', 'case_ref', 'status', 'filed_at', 'filed_by_user_id'])
    .where('filed_by_user_id', '=', actorUserId)
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

export async function getWhistleClaimStatus(
  db: Kysely<Database>,
  claimToken: string,
): Promise<{ status: string; filedAt: string }> {
  const hash = sha256Hex(claimToken.trim());
  const row = await db
    .selectFrom('ird.whistleblower_reports')
    .select(['status', 'filed_at'])
    .where('anonymous_token_hash', '=', hash)
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError('NOT_FOUND', { message: 'No report found for this claim code' });
  }

  return {
    status: row.status,
    filedAt: iso(row.filed_at),
  };
}

export async function listWhistleblowerReports(
  db: Kysely<Database>,
): Promise<{ id: number; status: string; filedAt: string; summary: string }[]> {
  const rows = await db
    .selectFrom('ird.whistleblower_reports')
    .select(['id', 'status', 'filed_at', 'summary'])
    .orderBy('filed_at', 'desc')
    .execute();

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    filedAt: iso(row.filed_at),
    summary: row.summary,
  }));
}
