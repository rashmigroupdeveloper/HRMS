/**
 * `ird` schema types — POSH, grievance & whistleblower skeleton
 * (Phase 5 Stage 5.5). Kept separate so IRD growth does not thrash `types.ts`.
 */
import type { ColumnType, Generated } from 'kysely';

/** A DB-defaulted timestamp that still SELECTs as a real `Date`. */
type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type DateOnly = ColumnType<Date, Date | string, Date | string>;

export type IcMemberRole = 'presiding_officer' | 'member' | 'external';

/** ird.ic_members — Internal Committee. Expect empty until sponsor appoints. */
export interface IrdIcMembersTable {
  id: Generated<number>;
  employee_id: number;
  role: IcMemberRole;
  active: Generated<boolean>;
  appointed_on: DateOnly;
  created_at: DefaultedTimestamp;
}

export type PoshCaseStatus = 'submitted' | 'under_inquiry' | 'closed' | 'withdrawn';

/**
 * ird.posh_cases — confidential POSH intake.
 * `summary_encrypted_or_text` is plain text for v1; encryption is a follow-up.
 */
export interface IrdPoshCasesTable {
  id: Generated<number>;
  case_ref: string;
  status: Generated<PoshCaseStatus>;
  filed_at: DefaultedTimestamp;
  filed_by_user_id: number | null;
  is_anonymous: Generated<boolean>;
  summary_encrypted_or_text: string;
  anonymous_token_hash: string | null;
  created_at: DefaultedTimestamp;
}

export type PoshAccessOutcome = 'opened' | 'refused';

/** ird.posh_case_access_log — append-only; every case open is recorded. */
export interface IrdPoshCaseAccessLogTable {
  id: Generated<number>;
  case_id: number;
  actor_user_id: number;
  opened_at: DefaultedTimestamp;
  ip: string | null;
  outcome: Generated<PoshAccessOutcome>;
}

export type GrievanceStatus =
  | 'submitted'
  | 'under_review'
  | 'escalated'
  | 'resolved'
  | 'closed';

/** ird.grievances — IR Code redressal cases (separate from POSH). */
export interface IrdGrievancesTable {
  id: Generated<number>;
  case_ref: string;
  status: Generated<GrievanceStatus>;
  filed_at: DefaultedTimestamp;
  filed_by_user_id: number;
  summary: string;
  created_at: DefaultedTimestamp;
}

export type WhistleStatus = 'submitted' | 'triaged' | 'investigating' | 'closed';

/**
 * ird.whistleblower_reports — no PII. Claim code is returned once; only the
 * SHA-256 hex hash is stored.
 */
export interface IrdWhistleblowerReportsTable {
  id: Generated<number>;
  anonymous_token_hash: string;
  status: Generated<WhistleStatus>;
  filed_at: DefaultedTimestamp;
  summary: string;
  created_at: DefaultedTimestamp;
}
