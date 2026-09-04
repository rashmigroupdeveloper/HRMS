/**
 * Kysely database interface — the single source of table types for queries.
 * Grows in lock-step with migrations; a column here without a migration (or
 * vice versa) is a bug.
 */
import type { ColumnType, Generated } from 'kysely';
import type {
  CmpCalendarItemsTable,
  CmpFilingEvidenceTable,
  CmpRegistrationsTable,
} from './types.cmp.js';
import type { DocTypesTable } from './types.doc.js';
import type {
  IrdGrievancesTable,
  IrdIcMembersTable,
  IrdPoshCaseAccessLogTable,
  IrdPoshCasesTable,
  IrdWhistleblowerReportsTable,
} from './types.ird.js';
import type { CoreMisCodesTable, CorePlantsTable, PayGlAccountsTable } from './types.org.js';
import type {
  PayBudgetCategoriesTable,
  PayBudgetsTable,
  PayClaimLinesTable,
  PayClaimReservationsTable,
  PayClaimTypesTable,
  PayClaimsTable,
} from './types.pay-claims.js';
import type {
  CorePasswordResetTokensTable,
  CoreProfileChangeRequestsTable,
  PrvBreachRegisterTable,
  PrvConsentEventsTable,
  PrvConsentsTable,
  PrvLegalHoldsTable,
  PrvNoticeAcksTable,
  PrvNoticesTable,
  PrvProcessorsTable,
  PrvProcessingRegisterTable,
  PrvPurgeLogTable,
  PrvPurgeProposalsTable,
  PrvRetentionRulesTable,
  PrvRightsRequestsTable,
} from './types.prv.js';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

/**
 * A DB-defaulted timestamp. `Generated<Timestamp>` nests two ColumnTypes, so
 * its select type stays a ColumnType wrapper rather than a real `Date` — which
 * is why older tables need a local `iso(value: unknown)` helper to read them.
 * This alias selects as `Date`, stays optional on insert, and is what new
 * tables use.
 */
type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

/** core.users — auth accounts (docs/03 §1). */
export interface UsersTable {
  id: Generated<number>;
  employee_id: number | null;
  email: string;
  password_hash: string;
  is_active: Generated<boolean>;
  last_login_at: Timestamp | null;
  failed_attempts: Generated<number>;
  locked_until: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.roles — role catalog (docs/08 §1). */
export interface RolesTable {
  id: Generated<number>;
  code: string;
  name: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.permissions — module.action grid (CORE-10). */
export interface PermissionsTable {
  id: Generated<number>;
  code: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface RolePermissionsTable {
  id: Generated<number>;
  role_id: number;
  permission_id: number;
  scope: Generated<'all' | 'subtree' | 'own' | 'org_unit' | 'readonly'>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface UserRolesTable {
  id: Generated<number>;
  user_id: number;
  role_id: number;
  scope_org_unit_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.audit_log — append-only, hash-chained (CORE-11, doc 14 §7.4). INSERT only. */
export interface AuditLogTable {
  id: Generated<number>;
  actor_user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  ip: string | null;
  at: Generated<Timestamp>;
  /** Historical data scope captured when the event is written (CORE-10). */
  scope_org_unit_id: number | null;
  /** V1 predates scoped audit rows; V2 commits scope_org_unit_id into row_hash. */
  hash_version: Generated<1 | 2>;
  /**
   * Hashing order, assigned INSIDE the chain trigger's advisory lock. `id`
   * comes from a sequence evaluated before that lock, so under concurrency the
   * two disagree — the chain is ordered by this, never by id.
   */
  chain_seq: Generated<number>;
  /** Set by the DB trigger — never write from the app. */
  prev_hash: Generated<string>;
  /** Set by the DB trigger — never write from the app. */
  row_hash: Generated<string>;
}

/** core.settings — typed policy store; nothing policy-like is hardcoded (docs/04 §8). */
export interface SettingsTable {
  key: string;
  value: unknown;
  value_type: 'number' | 'string' | 'boolean' | 'json';
  description: string;
  updated_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** wf.definitions — approval chains as runtime-editable data (WF-01). */
export interface WfDefinitionsTable {
  code: string;
  name: string;
  steps: unknown; // WorkflowStepSpec[] — validated by the workflows module
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export type WfRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'lapsed' | 'sent_back';

export interface WfRequestsTable {
  id: Generated<number>;
  definition_code: string;
  subject_employee_id: number;
  requested_by: number;
  payload: unknown;
  current_step: Generated<number>;
  status: Generated<WfRequestStatus>;
  decided_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export type WfStepAction = 'approved' | 'rejected' | 'sent_back' | 'escalated' | 'skipped';

/** wf.request_steps — the timeline; notified_at NOT NULL is the PP-14 receipt. */
export interface WfRequestStepsTable {
  id: Generated<number>;
  request_id: number;
  step_no: number;
  approver_user_id: number;
  approver_spec: string | null;
  delegated_from: number | null;
  action: WfStepAction | null;
  comment: string | null;
  notified_at: Timestamp;
  acted_at: Timestamp | null;
  sla_due_at: Timestamp;
  created_at: Generated<Timestamp>;
}

export interface WfDelegationsTable {
  id: Generated<number>;
  from_user_id: number;
  to_user_id: number;
  from_date: Timestamp;
  to_date: Timestamp;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** wf.notifications — queue with retry + dead-letter (WF-02, docs/03 §8). */
export interface NotificationsTable {
  id: Generated<number>;
  recipient_user_id: number | null;
  recipient_email: string | null;
  channel: 'in_app' | 'email';
  template_code: string;
  payload: unknown;
  /** `sending` = claimed by a drain worker, not yet delivered (migration 1752210000000). */
  status: Generated<'queued' | 'sending' | 'sent' | 'failed' | 'dead'>;
  attempts: Generated<number>;
  last_error: string | null;
  sent_at: Timestamp | null;
  read_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** wf.event_subscriptions — per-event recipient matrix as data (PP-26). */
export interface EventSubscriptionsTable {
  id: Generated<number>;
  event_code: string;
  recipient_kind: 'role' | 'user' | 'email';
  recipient_ref: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.companies — canonical entity master (doc 11 §0.2; 13 canonical of 14 raw). */
export interface CompaniesTable {
  id: Generated<number>;
  code: string;
  name: string;
  ecode_prefix: string;
  ecode_next_seq: Generated<number>;
  is_india_payroll: Generated<boolean>;
  gstin: string | null;
  pan: string | null;
  pf_establishment_code: string | null;
  esic_code: string | null;
  pt_registration_no: string | null;
  tan: string | null;
  address: string | null;
  sap_company_code: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface LocationsTable {
  id: Generated<number>;
  company_id: number;
  name: string;
  state_code: string;
  timezone: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface CostCentersTable {
  id: Generated<number>;
  company_id: number;
  code: string;
  name: string;
  plant_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface DepartmentsTable {
  id: Generated<number>;
  name: string;
  mis_code_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface OrgUnitsTable {
  id: Generated<number>;
  company_id: number;
  parent_id: number | null;
  name: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface DesignationsTable {
  id: Generated<number>;
  name: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface GradesTable {
  id: Generated<number>;
  code: string;
  name: string;
  rank: number;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export type EmploymentCategory = 'white_collar' | 'blue_collar' | 'trainee' | 'consultant' | 'contract';
export type EmployeeStatus = 'onboarding' | 'active' | 'on_notice' | 'exited';
export type ContractType = 'permanent' | 'temporary' | 'probationary' | 'consultant' | 'fixed_term';

/** core.employees — THE master record (docs/03 §3). */
export interface EmployeesTable {
  id: Generated<number>;
  ecode: string;
  company_id: number;
  first_name: string;
  last_name: string | null;
  photo_path: string | null;
  gender: string | null;
  dob: Timestamp | null;
  marital_status: string | null;
  blood_group: string | null;
  personal_email: string | null;
  work_email: string | null;
  mobile: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  present_address: string | null;
  permanent_address: string | null;
  category: EmploymentCategory | null;
  contract_type: ContractType | null;
  contract_end_date: Timestamp | null;
  doj: Timestamp | null;
  dol: Timestamp | null;
  status: Generated<EmployeeStatus>;
  exit_reason: string | null;
  designation_id: number | null;
  department_id: number | null;
  org_unit_id: number | null;
  location_id: number | null;
  cost_center_id: number | null;
  plant_id: number | null;
  grade_id: number | null;
  reporting_manager_id: number | null;
  functional_manager_id: number | null;
  /** Head of Department — the SECOND approver on claims, budgets and advances. */
  hod_employee_id: number | null;
  probation_months: number | null;
  probation_salary_pct: number | null;
  probation_due_date: Timestamp | null;
  confirmation_date: Timestamp | null;
  pan: string | null;
  aadhaar: string | null;
  uan: string | null;
  pf_number: string | null;
  esic_ip_number: string | null;
  pf_applicable: Generated<boolean>;
  esic_applicable: Generated<boolean>;
  pt_applicable: Generated<boolean>;
  lwf_applicable: Generated<boolean>;
  tax_regime: Generated<'old' | 'new'>;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  payment_mode: Generated<'bank' | 'cheque' | 'hold'>;
  access_card_no: string | null;
  biometric_registered: Generated<boolean>;
  attendance_mode: Generated<'biometric' | 'mobile' | 'manual'>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.reporting_tree — closure table, rebuilt by trigger (CORE-10). */
export interface ReportingTreeTable {
  manager_id: number;
  employee_id: number;
  depth: number;
}

export interface EmployeeHistoryTable {
  id: Generated<number>;
  employee_id: number;
  effective_date: Timestamp;
  change_type: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  reference_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface EmployeeFamilyTable {
  id: Generated<number>;
  employee_id: number;
  name: string;
  relation: string;
  dob: Timestamp | null;
  aadhaar: string | null;
  is_esic_dependent: Generated<boolean>;
  is_nominee: Generated<boolean>;
  nominee_share_pct: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** Vault lifecycle on the shared file registry (DOC-02). Letters/policies stay `active`. */
export type DocumentVaultStatus = 'active' | 'superseded' | 'withdrawn';

export interface DocumentsTable {
  id: Generated<number>;
  owner_employee_id: number | null;
  /** Document type code — vault kinds match `doc.types.code`; letters use their own. */
  kind: string;
  path: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  uploaded_by: number | null;
  /** NULL = no expiry (PAN / appointment letter). DOC-03 colour language. */
  expires_on: Date | null;
  status: Generated<DocumentVaultStatus>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.letter_templates — CORE-09; body is runtime-editable data. */
export interface LetterTemplatesTable {
  id: Generated<number>;
  code: string;
  name: string;
  body_template: string;
  body_docx_document_id: number | null;
  merge_fields: unknown;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.letters — issued letters; NULL issued_at = awaiting signature (PP-14). */
export interface LettersTable {
  id: Generated<number>;
  employee_id: number;
  template_code: string;
  document_id: number | null;
  body_rendered: string;
  status: Generated<'draft' | 'pending_signature' | 'issued'>;
  issued_by: number | null;
  issued_at: Timestamp | null;
  workflow_request_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.policies + acknowledgments — CORE-13 repository and live ack tracking. */
export interface PoliciesTable {
  id: Generated<number>;
  title: string;
  document_id: number | null;
  body_summary: string | null;
  effective_date: Timestamp;
  requires_acknowledgment: Generated<boolean>;
  audience: unknown;
  is_active: Generated<boolean>;
  created_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface PolicyAcknowledgmentsTable {
  id: Generated<number>;
  policy_id: number;
  employee_id: number;
  acknowledged_at: Generated<Timestamp>;
}

/** att.absence_cases — ATT-10 continuous-absence engine; one open case per employee. */
export interface AttAbsenceCasesTable {
  id: Generated<number>;
  employee_id: number;
  start_date: Timestamp;
  days_absent: number;
  stage: Generated<'watch' | 'show_cause' | 'warning' | 'termination_review'>;
  letter_id: number | null;
  hr_owner_id: number | null;
  resolution: 'returned' | 'regularized' | 'exited' | null;
  closed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** att.devices — door health board (ATT-02). */
export interface AttDevicesTable {
  id: Generated<number>;
  source: Generated<string>;
  door_code: string;
  location_id: number | null;
  last_seen_at: Timestamp | null;
  expected_hourly_swipes: string | null;
  is_active: Generated<boolean>;
  alerted_silent_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttIngestWatermarksTable {
  source: string;
  watermark_ts: Timestamp;
  updated_at: Generated<Timestamp>;
}

/** att.device_watermarks — per-door completeness cursor (doc 14 §8.5). */
export interface AttDeviceWatermarksTable {
  device_id: number;
  watermark_ts: Timestamp;
  updated_at: Generated<Timestamp>;
}

/** att.shifts — shift catalog; every time/threshold is a row, never code (ATT-04). */
export interface AttShiftsTable {
  id: Generated<number>;
  code: string;
  name: string;
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  crosses_midnight: Generated<boolean>;
  session_split: string | null;
  grace_in_minutes: Generated<number>;
  grace_out_minutes: Generated<number>;
  min_half_day_hours: string; // NUMERIC comes back as string
  min_full_day_hours: string;
  break_minutes: Generated<number>;
  break_paid: Generated<boolean>;
  ot_start_offset_minutes: Generated<number>;
  late_slabs: Generated<unknown>;
  early_exit_slabs: Generated<unknown>;
  allowance_component_code: string | null;
  session2_start: string | null;
  session2_end: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** att.employee_shifts — weekday vs Saturday scheme per employee (09 §4). */
export interface AttEmployeeShiftsTable {
  employee_id: number;
  weekday_shift_id: number;
  saturday_shift_id: number | null;
  updated_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttRostersTable {
  id: Generated<number>;
  employee_id: number;
  work_date: Timestamp;
  shift_id: number | null;
  is_week_off: Generated<boolean>;
  set_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttShiftPatternsTable {
  id: Generated<number>;
  code: string;
  name: string;
  cycle: unknown;
  created_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttRosterPublicationsTable {
  id: Generated<number>;
  manager_employee_id: number;
  period_from: Timestamp;
  period_to: Timestamp;
  published_at: Timestamp;
  published_by: number;
  revision: Generated<number>;
  reason: string | null;
}

export interface AttRosterRevisionsTable {
  id: Generated<number>;
  employee_id: number;
  work_date: Timestamp;
  old_shift_id: number | null;
  new_shift_id: number | null;
  old_week_off: boolean;
  new_week_off: boolean;
  reason: string;
  changed_by: number;
  changed_at: Generated<Timestamp>;
}

export interface AttCoverageTargetsTable {
  id: Generated<number>;
  location_id: number;
  department_id: number | null;
  shift_id: number;
  weekday: number;
  sanctioned: number;
  updated_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttLeaveBlackoutsTable {
  id: Generated<number>;
  blackout_date: Timestamp;
  location_id: number | null;
  name: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttShiftSwapsTable {
  id: Generated<number>;
  requester_employee_id: number;
  counterpart_employee_id: number | null;
  work_date: Timestamp;
  requester_shift_id: number | null;
  counterpart_shift_id: number | null;
  kind: 'swap' | 'bid';
  workflow_request_id: number;
  applied: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

export interface AttHolidaysTable {
  id: Generated<number>;
  location_id: number | null;
  holiday_date: Timestamp;
  name: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export type DayStatus = 'P' | 'A' | 'HD' | 'WO' | 'H' | 'L' | 'OD' | 'CO' | 'UAB';

/** att.day_records — PROCESSED attendance; recomputable until locked (ATT-03/05/15). */
export interface AttDayRecordsTable {
  id: Generated<number>;
  employee_id: number;
  work_date: Timestamp;
  shift_id: number | null;
  status: DayStatus;
  leave_type_id: number | null;
  first_in: Timestamp | null;
  last_out: Timestamp | null;
  worked_minutes: number | null;
  late_minutes: Generated<number>;
  early_exit_minutes: Generated<number>;
  ot_minutes: Generated<number>;
  weekoff_paid: boolean | null;
  session_statuses: unknown;
  scheme_code: string | null;
  penalty_flag: Generated<boolean>;
  source: Generated<'auto' | 'regularized' | 'manual'>;
  override_reason: string | null;
  is_locked: Generated<boolean>;
  computed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttRecomputeQueueTable {
  employee_id: number;
  work_date: Timestamp;
  queued_at: Generated<Timestamp>;
}

/** att.regularizations — AR (past-only) / OD (future ok) / PERMISSION (time-bound) (ATT-06/07). */
export interface AttRegularizationsTable {
  id: Generated<number>;
  employee_id: number;
  kind: 'AR' | 'OD' | 'PERMISSION';
  from_date: Timestamp;
  to_date: Timestamp;
  from_time: string | null;
  to_time: string | null;
  reason: string;
  requested_status: DayStatus;
  workflow_request_id: number;
  applied: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** att.overtime_entries — the 48-hour rule (ATT-08). */
export interface AttOvertimeEntriesTable {
  id: Generated<number>;
  employee_id: number;
  work_date: Timestamp;
  detected_minutes: number;
  claimed_minutes: number;
  approved_minutes: number | null;
  status: Generated<'pending' | 'approved' | 'rejected' | 'lapsed' | 'converted_comp_off'>;
  manager_id: number | null;
  decided_at: Timestamp | null;
  deadline_at: Timestamp;
  workflow_request_id: number | null;
  comp_off_credit_id: number | null;
  payroll_item_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** att.month_locks — ATT-15 payroll precondition. */
export interface AttMonthLocksTable {
  id: Generated<number>;
  company_id: number;
  month: Timestamp;
  locked_by: number;
  locked_at: Generated<Timestamp>;
  checklist: unknown;
  created_at: Generated<Timestamp>;
}

/** att.manager_month_approvals — ATT-12 manager attendance sign-off ledger. */
export interface AttManagerMonthApprovalsTable {
  id: Generated<number>;
  company_id: number;
  month: Timestamp;
  manager_employee_id: number;
  approved_by_user_id: number | null;
  approved_at: Generated<Timestamp>;
  event_type: Generated<'approve' | 'invalidate'>;
  note: string | null;
  created_at: Generated<Timestamp>;
}

/** reporting.muster_month — precomputed R1 muster (RPT-01). */
export interface ReportingMusterMonthTable {
  id: Generated<number>;
  company_id: number;
  month: Timestamp;
  employee_id: number;
  ecode: string;
  employee_name: string;
  reporting_manager: string | null;
  functional_manager: string | null;
  department: string | null;
  designation: string | null;
  org_unit: string | null;
  cost_center: string | null;
  contact: string | null;
  category: string | null;
  day_statuses: unknown;
  present: Generated<number>;
  absent: Generated<number>;
  half_days: Generated<number>;
  weekoffs: Generated<number>;
  weekoffs_unpaid: Generated<number>;
  holidays: Generated<number>;
  leave_days: Generated<string>;
  od_days: Generated<number>;
  co_days: Generated<number>;
  uab_days: Generated<number>;
  lop_days: Generated<string>;
  ot_hours: Generated<string>;
  built_at: Generated<Timestamp>;
}

// (letters / policies / absence-case table types are declared once above —
//  the merged parallel Stage-16 variants were removed with their migration.)

// ── Leave (lv) — docs/03 §5, LV-01..09 ──────────────────────────────────────

export type LeaveTxnType =
  | 'accrual'
  | 'grant'
  | 'application'
  | 'cancel'
  | 'lapse'
  | 'encash'
  | 'comp_off_earn'
  | 'adjustment';

export type LeaveApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type SandwichRule = 'include' | 'exclude';

/** lv.leave_types — LV-01 (live greytHR six + ML + RH). */
export interface LvLeaveTypesTable {
  id: Generated<number>;
  code: string;
  name: string;
  is_paid: Generated<boolean>;
  accrual_per_month: Generated<string>;
  accrual_requires_service_months: Generated<number>;
  max_carry_forward: string | null;
  encashable: Generated<boolean>;
  max_per_request: string | null;
  allow_half_day: Generated<boolean>;
  sandwich_rule: Generated<SandwichRule>;
  applicable_categories: EmploymentCategory[] | null;
  applicable_gender: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** lv.ledger — immutable; balance = SUM(delta) (LV-05). */
export interface LvLedgerTable {
  id: Generated<number>;
  employee_id: number;
  leave_type_id: number;
  txn_type: LeaveTxnType;
  delta: string;
  effective_date: Timestamp;
  expiry_date: Timestamp | null;
  reference_id: number | null;
  note: string | null;
  created_by: number | null;
  created_at: Generated<Timestamp>;
}

/** lv.applications — LV-03 / LV-06 / LV-08 / LV-09. */
export interface LvApplicationsTable {
  id: Generated<number>;
  employee_id: number;
  leave_type_id: number;
  from_date: Timestamp;
  to_date: Timestamp;
  from_half: Generated<boolean>;
  to_half: Generated<boolean>;
  days: string;
  reason: string | null;
  status: Generated<LeaveApplicationStatus>;
  workflow_request_id: number;
  cancel_workflow_request_id: number | null;
  ledger_txn_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** lv.restricted_holidays — optional/floating holiday list (LV-09). */
export interface LvRestrictedHolidaysTable {
  id: Generated<number>;
  holiday_date: Timestamp;
  name: string;
  location_id: number | null;
  created_at: Generated<Timestamp>;
}

export interface LvRhSelectionsTable {
  id: Generated<number>;
  employee_id: number;
  restricted_holiday_id: number;
  workflow_request_id: number;
  applied: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** att.quarantined_swipes — implausible timestamps parked for review (doc 14 §8.4). */
export interface AttQuarantinedSwipesTable {
  id: Generated<number>;
  employee_no: string;
  swipe_ts: Timestamp;
  door_code: string | null;
  direction: string | null;
  swipe_type: string | null;
  received_at: Timestamp;
  source: string;
  reason: string;
  reviewed: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

/** att.swipe_events — RAW immutable swipes, monthly-partitioned (ATT-01). */
export interface AttSwipeEventsTable {
  id: Generated<number>;
  employee_id: number | null;
  employee_no: string;
  access_card: string | null;
  shift_label: string | null;
  swipe_ts: Timestamp;
  door_code: string | null;
  longitude: string | null;
  latitude: string | null;
  location_type: string | null;
  mobile_device_name: string | null;
  mobile_device_id: string | null;
  swipe_type: string | null;
  direction: string | null;
  remarks: string | null;
  permission_reason: string | null;
  signed_by: string | null;
  received_at: Timestamp;
  source: Generated<string>;
  created_at: Generated<Timestamp>;
}

/* ── M8 Assets (ast) — AST-01..06, docs/03 §9 ─────────────────────────────── */

export type AssetStatus = 'in_stock' | 'assigned' | 'maintenance' | 'lost' | 'scrapped';
export type HolderKind = 'employee' | 'third_party';
export type ReturnCondition = 'ok' | 'damaged' | 'not_returned';
export type MaintenanceKind = 'scheduled' | 'incident' | 'damage' | 'lost';

/** ast.assets — the registry (AST-01). `warranty_till` accepts PAST dates (AST-02). */
export interface AssetsTable {
  id: Generated<number>;
  asset_no: string;
  category: string;
  description: string | null;
  serial_no: string | null;
  purchase_date: Timestamp | null;
  warranty_till: Timestamp | null;
  status: Generated<AssetStatus>;
  location_id: number | null;
  company_id: number;
  created_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** ast.assignments — who holds it (AST-03); an open row means still out (AST-04/05). */
export interface AssetAssignmentsTable {
  id: Generated<number>;
  asset_id: number;
  holder_kind: HolderKind;
  employee_id: number | null;
  third_party_name: string | null;
  third_party_org: string | null;
  assigned_at: Generated<Timestamp>;
  returned_at: Timestamp | null;
  return_condition: ReturnCondition | null;
  notes: string | null;
  assigned_by: number;
  returned_by: number | null;
  created_at: Generated<Timestamp>;
}

/** ast.maintenance — scheduled service, incidents, damage and loss (AST-06). */
export interface AssetMaintenanceTable {
  id: Generated<number>;
  asset_id: number;
  kind: MaintenanceKind;
  scheduled_for: Timestamp | null;
  reported_by: number | null;
  description: string;
  resolved_at: Timestamp | null;
  resolution: string | null;
  cost: string | null;
  created_at: Generated<Timestamp>;
}


/* ── M9 Helpdesk (hd) — HD-01, docs/03 §9 ─────────────────────────────────── */

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

/** hd.categories — routing + SLA as runtime data, never a switch statement. */
export interface HdCategoriesTable {
  id: Generated<number>;
  code: string;
  name: string;
  assignee_role_code: string | null;
  sla_hours: Generated<number>;
  escalate_after_hours: number | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** hd.tickets — every ticket carries a clock (sla_due_at NOT NULL). */
export interface HdTicketsTable {
  id: Generated<number>;
  ticket_no: string;
  raised_by: number;
  category_id: number;
  subject: string;
  body: string;
  assignee_user_id: number | null;
  status: Generated<TicketStatus>;
  priority: Generated<TicketPriority>;
  sla_due_at: Timestamp;
  escalated_level: Generated<number>;
  escalated_at: Timestamp | null;
  acknowledged_at: Timestamp | null;
  resolved_at: Timestamp | null;
  resolution: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** hd.ticket_messages — append-only audit thread (SOW-9.4). INSERT only. */
export interface HdTicketMessagesTable {
  id: Generated<number>;
  ticket_id: number;
  author_user_id: number;
  body: string;
  is_internal: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

/* ── M10 Engagement (eng) — EN-01..03 ─────────────────────────────────────── */

/** eng.announcements — audience-filtered broadcast (EN-01). */
export interface EngAnnouncementsTable {
  id: Generated<number>;
  title: string;
  body: string;
  audience: unknown;
  published_by: number;
  published_at: Generated<Timestamp>;
  expires_at: Timestamp | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

/** eng.polls — polls and pulse surveys; anonymity is fixed at creation. */
export interface EngPollsTable {
  id: Generated<number>;
  question: string;
  options: unknown;
  kind: Generated<'poll' | 'pulse'>;
  is_anonymous: Generated<boolean>;
  audience: unknown;
  created_by: number;
  opens_at: Generated<Timestamp>;
  closes_at: Timestamp | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

/** eng.poll_responses — respondent is NULL when the poll is anonymous. */
export interface EngPollResponsesTable {
  id: Generated<number>;
  poll_id: number;
  respondent_user_id: number | null;
  /** Salted HMAC of (poll, user) — set instead of `respondent_user_id` on an
   *  anonymous poll so responses dedupe without storing identity (docs/03 §9).
   *  A DB CHECK enforces exactly one of the two. */
  respondent_hash: string | null;
  option_index: number;
  comment: string | null;
  created_at: Generated<Timestamp>;
}

/** reporting.kpi_daily — RPT-03 nightly snapshot (docs/06 §4). */
export interface KpiDailyTable {
  id: Generated<number>;
  snapshot_date: Timestamp;
  company_id: number | null;
  category: Generated<string>;
  metric: string;
  /** NULL means NOT COMPUTABLE — never conflate with zero. */
  value: string | null;
  unavailable_reason: string | null;
  computed_at: Generated<Timestamp>;
}

/* ── sec — identity hardening (Phase 5 Stage 5.2, SEC-01..11) ───────────── */

/** sec.sessions — a session is a ROW, so revoke takes effect next request. */
export interface SecSessionsTable {
  id: Generated<number>;
  sid: Generated<string>;
  user_id: number;
  created_at: DefaultedTimestamp;
  last_seen_at: DefaultedTimestamp;
  expires_at: Timestamp;
  revoked_at: Timestamp | null;
  revoked_by_user_id: number | null;
  revoke_reason: string | null;
  ip: string | null;
  user_agent: string | null;
  device_label: string | null;
  stepped_up_at: Timestamp | null;
  stepped_up_until: Timestamp | null;
}

/** sec.mfa_enrolments — one active TOTP enrolment per user (SEC-02/03). */
export interface SecMfaEnrolmentsTable {
  id: Generated<number>;
  user_id: number;
  secret: string;
  confirmed_at: Timestamp | null;
  disabled_at: Timestamp | null;
  disabled_by_user_id: number | null;
  /** Replay guard — a TOTP step may be spent exactly once. */
  last_used_step: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** sec.mfa_recovery_codes — hashed, single-use. */
export interface SecMfaRecoveryCodesTable {
  id: Generated<number>;
  enrolment_id: number;
  code_hash: string;
  used_at: Timestamp | null;
  created_at: DefaultedTimestamp;
}

/** sec.password_history — hashes only, so reuse is refusable (SEC-01). */
export interface SecPasswordHistoryTable {
  id: Generated<number>;
  user_id: number;
  password_hash: string;
  changed_at: DefaultedTimestamp;
  changed_by_user_id: number | null;
}

/** sec.access_events — who read whose sensitive data and WHY (SEC-10/11). */
export interface SecAccessEventsTable {
  id: Generated<number>;
  occurred_at: DefaultedTimestamp;
  actor_user_id: number;
  session_sid: string | null;
  subject_employee_id: number | null;
  resource: string;
  field_class: string;
  purpose: string;
  record_count: Generated<number>;
  ip: string | null;
}

export interface Database {
  'core.users': UsersTable;
  'core.roles': RolesTable;
  'core.permissions': PermissionsTable;
  'core.role_permissions': RolePermissionsTable;
  'core.user_roles': UserRolesTable;
  'core.audit_log': AuditLogTable;
  'reporting.kpi_daily': KpiDailyTable;
  'hd.categories': HdCategoriesTable;
  'hd.tickets': HdTicketsTable;
  'hd.ticket_messages': HdTicketMessagesTable;
  'eng.announcements': EngAnnouncementsTable;
  'eng.polls': EngPollsTable;
  'eng.poll_responses': EngPollResponsesTable;
  'ast.assets': AssetsTable;
  'ast.assignments': AssetAssignmentsTable;
  'ast.maintenance': AssetMaintenanceTable;
  'core.settings': SettingsTable;
  'core.companies': CompaniesTable;
  'core.locations': LocationsTable;
  'core.plants': CorePlantsTable;
  'core.mis_codes': CoreMisCodesTable;
  'core.cost_centers': CostCentersTable;
  'core.departments': DepartmentsTable;
  'core.org_units': OrgUnitsTable;
  'core.designations': DesignationsTable;
  'core.grades': GradesTable;
  'core.employees': EmployeesTable;
  'core.reporting_tree': ReportingTreeTable;
  'core.employee_history': EmployeeHistoryTable;
  'core.employee_family': EmployeeFamilyTable;
  'core.documents': DocumentsTable;
  'wf.definitions': WfDefinitionsTable;
  'wf.requests': WfRequestsTable;
  'wf.request_steps': WfRequestStepsTable;
  'wf.delegations': WfDelegationsTable;
  'wf.notifications': NotificationsTable;
  'wf.event_subscriptions': EventSubscriptionsTable;
  'att.devices': AttDevicesTable;
  'att.ingest_watermarks': AttIngestWatermarksTable;
  'att.device_watermarks': AttDeviceWatermarksTable;
  'att.swipe_events': AttSwipeEventsTable;
  'att.quarantined_swipes': AttQuarantinedSwipesTable;
  'att.shifts': AttShiftsTable;
  'att.employee_shifts': AttEmployeeShiftsTable;
  'att.rosters': AttRostersTable;
  'att.shift_patterns': AttShiftPatternsTable;
  'att.roster_publications': AttRosterPublicationsTable;
  'att.roster_revisions': AttRosterRevisionsTable;
  'att.coverage_targets': AttCoverageTargetsTable;
  'att.leave_blackouts': AttLeaveBlackoutsTable;
  'att.shift_swaps': AttShiftSwapsTable;
  'att.holidays': AttHolidaysTable;
  'att.day_records': AttDayRecordsTable;
  'att.recompute_queue': AttRecomputeQueueTable;
  'att.regularizations': AttRegularizationsTable;
  'att.overtime_entries': AttOvertimeEntriesTable;
  'att.absence_cases': AttAbsenceCasesTable;
  'att.month_locks': AttMonthLocksTable;
  'att.manager_month_approvals': AttManagerMonthApprovalsTable;
  'reporting.muster_month': ReportingMusterMonthTable;
  'lv.leave_types': LvLeaveTypesTable;
  'lv.ledger': LvLedgerTable;
  'lv.applications': LvApplicationsTable;
  'lv.restricted_holidays': LvRestrictedHolidaysTable;
  'lv.rh_selections': LvRhSelectionsTable;
  'core.letter_templates': LetterTemplatesTable;
  'core.letters': LettersTable;
  'core.policies': PoliciesTable;
  'core.policy_acknowledgments': PolicyAcknowledgmentsTable;
  'sec.sessions': SecSessionsTable;
  'sec.mfa_enrolments': SecMfaEnrolmentsTable;
  'sec.mfa_recovery_codes': SecMfaRecoveryCodesTable;
  'sec.password_history': SecPasswordHistoryTable;
  'sec.access_events': SecAccessEventsTable;
  'cmp.registrations': CmpRegistrationsTable;
  'cmp.calendar_items': CmpCalendarItemsTable;
  'cmp.filing_evidence': CmpFilingEvidenceTable;
  'ird.ic_members': IrdIcMembersTable;
  'ird.posh_cases': IrdPoshCasesTable;
  'ird.posh_case_access_log': IrdPoshCaseAccessLogTable;
  'ird.grievances': IrdGrievancesTable;
  'ird.whistleblower_reports': IrdWhistleblowerReportsTable;
  'doc.types': DocTypesTable;
  'pay.gl_accounts': PayGlAccountsTable;
  'pay.claim_types': PayClaimTypesTable;
  'pay.budgets': PayBudgetsTable;
  'pay.budget_categories': PayBudgetCategoriesTable;
  'pay.claims': PayClaimsTable;
  'pay.claim_lines': PayClaimLinesTable;
  'pay.claim_reservations': PayClaimReservationsTable;
  'prv.notices': PrvNoticesTable;
  'prv.notice_acks': PrvNoticeAcksTable;
  'prv.processing_register': PrvProcessingRegisterTable;
  'prv.consents': PrvConsentsTable;
  'prv.consent_events': PrvConsentEventsTable;
  'prv.rights_requests': PrvRightsRequestsTable;
  'prv.retention_rules': PrvRetentionRulesTable;
  'prv.legal_holds': PrvLegalHoldsTable;
  'prv.purge_proposals': PrvPurgeProposalsTable;
  'prv.purge_log': PrvPurgeLogTable;
  'prv.processors': PrvProcessorsTable;
  'prv.breach_register': PrvBreachRegisterTable;
  'core.password_reset_tokens': CorePasswordResetTokensTable;
  'core.profile_change_requests': CoreProfileChangeRequestsTable;
}
