/**
 * Stage 5.3 DPDP types (PRV-01..10) + Stage 5.8 identity-daily.
 */
import type { ColumnType, Generated } from 'kysely';

type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type DateOnly = ColumnType<Date, Date | string, Date | string>;

export type PrincipalClass = 'employee' | 'candidate' | 'contractor_worker' | 'dependant';
export type LawfulBasis = 'employment' | 'consent' | 'legal_obligation';
export type ConsentPurpose = 'photograph' | 'wellness' | 'bgv' | 'family' | 'alumni';
export type RightsKind = 'access' | 'correction' | 'erasure';
export type RightsStatus = 'open' | 'in_progress' | 'fulfilled' | 'refused';

export interface PrvNoticesTable {
  id: Generated<number>;
  version: number;
  principal_class: PrincipalClass;
  title: string;
  body: string;
  effective_from: DefaultedTimestamp;
  is_current: Generated<boolean>;
  created_at: DefaultedTimestamp;
}

export interface PrvNoticeAcksTable {
  id: Generated<number>;
  notice_id: number;
  user_id: number;
  acknowledged_at: DefaultedTimestamp;
  ip: string | null;
}

export interface PrvProcessingRegisterTable {
  id: Generated<number>;
  data_class: string;
  purpose: string;
  lawful_basis: LawfulBasis;
  retention_days: number;
  recipients: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PrvConsentsTable {
  id: Generated<number>;
  employee_id: number;
  purpose: ConsentPurpose;
  granted: boolean;
  updated_at: DefaultedTimestamp;
}

export interface PrvConsentEventsTable {
  id: Generated<number>;
  employee_id: number;
  purpose: string;
  action: 'grant' | 'withdraw';
  actor_user_id: number;
  occurred_at: DefaultedTimestamp;
}

export interface PrvRightsRequestsTable {
  id: Generated<number>;
  employee_id: number;
  kind: RightsKind;
  status: Generated<RightsStatus>;
  reason: string | null;
  refusal_reason: string | null;
  workflow_request_id: number | null;
  due_at: Timestamp;
  closed_at: Timestamp | null;
  created_at: DefaultedTimestamp;
}

export interface PrvRetentionRulesTable {
  id: Generated<number>;
  data_class: string;
  retention_days: number;
  created_at: DefaultedTimestamp;
}

export interface PrvLegalHoldsTable {
  id: Generated<number>;
  employee_id: number;
  data_class: string | null;
  reason: string;
  placed_by: number;
  released_at: Timestamp | null;
  created_at: DefaultedTimestamp;
}

export interface PrvPurgeProposalsTable {
  id: Generated<number>;
  data_class: string;
  row_count: number;
  excluded_holds: Generated<number>;
  proposed_by: number;
  proposed_at: DefaultedTimestamp;
  confirmed_by: number | null;
  confirmed_at: Timestamp | null;
}

export interface PrvPurgeLogTable {
  id: Generated<number>;
  proposal_id: number;
  data_class: string;
  row_count: number;
  rule: string;
  executed_at: DefaultedTimestamp;
}

export interface PrvProcessorsTable {
  id: Generated<number>;
  name: string;
  purpose: string;
  dpa_status: 'active' | 'expired' | 'missing';
  dpa_expires_on: DateOnly | null;
  owner_email: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PrvBreachRegisterTable {
  id: Generated<number>;
  discovered_at: DefaultedTimestamp;
  summary: string;
  notified_board_at: Timestamp | null;
  notified_principals_at: Timestamp | null;
  recorded_by: number;
}

export interface CorePasswordResetTokensTable {
  id: Generated<number>;
  user_id: number;
  token_hash: string;
  expires_at: Timestamp;
  used_at: Timestamp | null;
  created_at: DefaultedTimestamp;
}

export interface CoreProfileChangeRequestsTable {
  id: Generated<number>;
  employee_id: number;
  field: string;
  old_value: string | null;
  new_value: string;
  status: Generated<'pending' | 'approved' | 'rejected'>;
  workflow_request_id: number | null;
  decided_by: number | null;
  decided_at: Timestamp | null;
  created_at: DefaultedTimestamp;
}
