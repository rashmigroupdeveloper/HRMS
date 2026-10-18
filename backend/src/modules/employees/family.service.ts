/**
 * Family & nominee details (RQ-CORE-025, SOW 165, PAY-10 ESIC family).
 * An employee's own change is routed to HR (wf `family_update`, step role:hr_ops)
 * and only touches the master when approved; HR with `employee.write` in scope
 * edits directly. Both paths validate the same way and are audited.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate, istDateString } from '../../core/dates.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';
import { ageOn, normalizeIdentity, validateIdentity } from '../../core/validation/identity.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';

type Db = Kysely<Database> | Transaction<Database>;

export const RELATIONS = ['spouse', 'son', 'daughter', 'father', 'mother', 'father_in_law', 'mother_in_law', 'brother', 'sister', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];
const ESIC_DEPENDENT_RELATIONS: readonly Relation[] = ['spouse', 'son', 'daughter', 'father', 'mother'];

export interface FamilyMemberInput {
  name: string;
  relation: Relation;
  dob?: string | null | undefined;
  aadhaar?: string | null | undefined;
  isEsicDependent?: boolean | undefined;
  isNominee?: boolean | undefined;
  nomineeSharePct?: number | null | undefined;
}

export interface FamilyChange {
  action: 'add' | 'update' | 'remove';
  memberId?: number | undefined;
  member?: FamilyMemberInput | undefined;
}

export interface FamilyMember {
  id: number; name: string; relation: string; dob: string | null; aadhaarMasked: string | null;
  isEsicDependent: boolean; isNominee: boolean; nomineeSharePct: number | null;
}

function mask(a: string | null): string | null {
  return a === null ? null : `XXXX-XXXX-${a.slice(-4)}`;
}

export async function listFamily(db: Db, employeeId: number): Promise<FamilyMember[]> {
  const rows = await db.selectFrom('core.employee_family').selectAll().where('employee_id', '=', employeeId).orderBy('id').execute();
  return rows.map((r) => ({
    id: r.id, name: r.name, relation: r.relation, dob: r.dob ? formatDbDate(r.dob) : null,
    aadhaarMasked: mask(r.aadhaar), isEsicDependent: r.is_esic_dependent, isNominee: r.is_nominee,
    nomineeSharePct: r.nominee_share_pct === null ? null : Number(r.nominee_share_pct),
  }));
}

export async function listPendingFamilyChanges(db: Db, employeeId: number) {
  const rows = await db.selectFrom('core.profile_change_requests').select(['id', 'new_value', 'status', 'created_at', 'workflow_request_id'])
    .where('employee_id', '=', employeeId).where('field', '=', 'family').where('status', '=', 'pending').orderBy('id', 'desc').execute();
  return rows.map((r) => ({ id: r.id, change: JSON.parse(r.new_value) as FamilyChange, status: r.status, createdAt: new Date(r.created_at as unknown as string).toISOString(), workflowRequestId: r.workflow_request_id }));
}

/** Validates a change against the current family; returns the normalized member values. */
async function validateFamilyChange(db: Db, employeeId: number, change: FamilyChange): Promise<FamilyMemberInput | null> {
  const existing = await db.selectFrom('core.employee_family').selectAll().where('employee_id', '=', employeeId).execute();
  if (change.action !== 'add') {
    if (change.memberId === undefined || !existing.some((e) => e.id === change.memberId)) throw new NotFoundError('Family member not found');
  }
  if (change.action === 'remove') return null;
  const m = change.member;
  if (!m) throw new DomainError('Family member details are required');
  const name = m.name.trim();
  if (name.length < 2) throw new DomainError('Name must be at least 2 characters');
  const today = istDateString();
  if (m.dob) {
    if (m.dob > today) throw new DomainError('Date of birth cannot be in the future');
    if (m.relation === 'spouse' && ageOn(m.dob, today) < 18) throw new DomainError('A spouse must be 18 or older (minor marriage cannot be recorded)');
  }
  let aadhaar: string | null = null;
  if (m.aadhaar) {
    const problem = validateIdentity('IN', 'aadhaar', m.aadhaar);
    if (problem) throw new DomainError(problem);
    aadhaar = normalizeIdentity('aadhaar', m.aadhaar);
    if (existing.some((e) => e.aadhaar === aadhaar && e.id !== change.memberId)) throw new DomainError('Another family member already has this Aadhaar');
  } else if (change.action === 'update') {
    // Blank on edit keeps the stored number (the UI only ever sees it masked).
    aadhaar = existing.find((e) => e.id === change.memberId)?.aadhaar ?? null;
  }
  if (m.isEsicDependent && !ESIC_DEPENDENT_RELATIONS.includes(m.relation)) throw new DomainError('Only spouse, children and parents can be ESIC dependents');
  if (m.relation === 'spouse' && existing.some((e) => e.relation === 'spouse' && e.id !== change.memberId)) throw new DomainError('A spouse is already recorded; update that entry instead');
  let share: number | null = null;
  if (m.isNominee) {
    share = m.nomineeSharePct ?? null;
    if (share === null || !(share > 0 && share <= 100)) throw new DomainError('Nominee share must be more than 0% and at most 100%');
    const others = existing.filter((e) => e.is_nominee && e.id !== change.memberId).reduce((s, e) => s + Number(e.nominee_share_pct ?? 0), 0);
    if (others + share > 100) throw new DomainError(`Nominee shares would total ${String(others + share)}% — they cannot exceed 100%`);
  }
  return { name, relation: m.relation, dob: m.dob ?? null, aadhaar, isEsicDependent: m.isEsicDependent ?? false, isNominee: m.isNominee ?? false, nomineeSharePct: share };
}

export async function applyFamilyChange(db: Db, employeeId: number, change: FamilyChange, actorUserId: number, ip: string | null): Promise<{ memberId: number | null }> {
  const v = await validateFamilyChange(db, employeeId, change);
  if (change.action === 'remove') {
    const before = await db.deleteFrom('core.employee_family').where('id', '=', change.memberId ?? 0).where('employee_id', '=', employeeId).returningAll().executeTakeFirst();
    await writeAudit(db, { actorUserId, action: 'delete', entity: 'core.employee_family', entityId: change.memberId ?? 0, oldValue: JSON.stringify({ ...before, aadhaar: mask(before?.aadhaar ?? null) }), ip });
    return { memberId: null };
  }
  if (!v) throw new DomainError('Family member details are required');
  const values = {
    name: v.name, relation: v.relation, dob: (v.dob ?? null) as unknown as Date | null, aadhaar: v.aadhaar ?? null,
    is_esic_dependent: v.isEsicDependent ?? false, is_nominee: v.isNominee ?? false,
    nominee_share_pct: v.nomineeSharePct === null || v.nomineeSharePct === undefined ? null : String(v.nomineeSharePct),
  };
  let id: number;
  if (change.action === 'add') {
    id = (await db.insertInto('core.employee_family').values({ employee_id: employeeId, ...values }).returning('id').executeTakeFirstOrThrow()).id;
  } else {
    id = change.memberId ?? 0;
    await db.updateTable('core.employee_family').set(values).where('id', '=', id).where('employee_id', '=', employeeId).execute();
  }
  await writeAudit(db, { actorUserId, action: change.action === 'add' ? 'create' : 'update', entity: 'core.employee_family', entityId: id, newValue: JSON.stringify({ ...values, aadhaar: mask(values.aadhaar) }), ip });
  return { memberId: id };
}

/** ESS: validate now, park the change, route it to HR. */
export async function requestFamilyChange(db: Kysely<Database>, employeeId: number, change: FamilyChange, actorUserId: number): Promise<{ requestId: number; workflowRequestId: number }> {
  await validateFamilyChange(db, employeeId, change);
  const pending = await db.selectFrom('core.profile_change_requests').select('id').where('employee_id', '=', employeeId).where('field', '=', 'family').where('status', '=', 'pending').execute();
  if (pending.length >= 10) throw new DomainError('You already have 10 family changes awaiting HR; wait for them to be decided');
  let pcrId = 0;
  const wfId = await createRequest(db, { definitionCode: 'family_update', subjectEmployeeId: employeeId, requestedByUserId: actorUserId, payload: { change } }, async (trx, requestId) => {
    pcrId = (await trx.insertInto('core.profile_change_requests').values({ employee_id: employeeId, field: 'family', old_value: null, new_value: JSON.stringify(change), workflow_request_id: requestId }).returning('id').executeTakeFirstOrThrow()).id;
  });
  return { requestId: pcrId, workflowRequestId: wfId };
}

/** Workflow final: approved → apply (re-validated against the family as it is now); otherwise close. */
export async function applyFamilyOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const pcr = await db.selectFrom('core.profile_change_requests').selectAll().where('workflow_request_id', '=', request.id).executeTakeFirst();
  if (pcr?.status !== 'pending') return;
  const approver = await db.selectFrom('wf.request_steps').select('approver_user_id')
    .where('request_id', '=', request.id).where('acted_at', 'is not', null).orderBy('acted_at', 'desc').limit(1).executeTakeFirst();
  const actor = approver?.approver_user_id ?? request.requested_by;
  if (status === 'approved') await applyFamilyChange(db, pcr.employee_id, JSON.parse(pcr.new_value) as FamilyChange, actor, null);
  await db.updateTable('core.profile_change_requests').set({ status: status === 'approved' ? 'approved' : 'rejected', decided_by: actor, decided_at: sql`now()` }).where('id', '=', pcr.id).execute();
}
