/**
 * Kysely database interface — the single source of table types for queries.
 * Grows in lock-step with migrations; a column here without a migration (or
 * vice versa) is a bug.
 */
import type { ColumnType, Generated } from 'kysely';
import type { CoreBulkJobsTable, CoreDepartmentHeadsTable } from './types.bulk.js';
import type {
  CmpCalendarItemsTable,
  CmpFilingEvidenceTable,
  CmpRegistrationsTable,
} from './types.cmp.js';
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
import type {
  PayBudgetCategoriesTable,
  PayBudgetsTable,
  PayClaimLinesTable,
  PayClaimReservationsTable,
} from './types.pay-claims.js';
import type { CoreMisCodesTable, CorePlantsTable } from './types.org.js';
import type {
  IrdGrievancesTable,
  IrdIcMembersTable,
  IrdPoshCaseAccessLogTable,
  IrdPoshCasesTable,
  IrdWhistleblowerReportsTable,
} from './types.ird.js';
import type { DocTypesTable } from './types.doc.js';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>;

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
  must_change_password: Generated<boolean>;
  password_changed_at: Timestamp | null;
  deactivated_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** core.roles — role catalog (docs/08 §1). */
export interface RolesTable {
  id: Generated<number>;
  code: string;
  name: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** core.permissions — module.action grid (CORE-10). */
export interface PermissionsTable {
  id: Generated<number>;
  code: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface RolePermissionsTable {
  id: Generated<number>;
  role_id: number;
  permission_id: number;
  scope: Generated<'all' | 'subtree' | 'own' | 'org_unit' | 'readonly' | 'department'>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface UserRolesTable {
  id: Generated<number>;
  user_id: number;
  role_id: number;
  scope_org_unit_id: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  at: DefaultedTimestamp;
  /** Historical data scope captured when the event is written (CORE-10). */
  scope_org_unit_id: number | null;
  /** V1 predates scoped audit rows; V2 commits scope_org_unit_id into row_hash. */
  hash_version: Generated<1 | 2>;
  /** Set by the DB trigger — never write from the app. */
  prev_hash: Generated<string>;
  /** Set by the DB trigger — never write from the app. */
  row_hash: Generated<string>;


  /**
   * Hashing order, assigned INSIDE the chain trigger's advisory lock. `id`
   * comes from a sequence evaluated before that lock, so under concurrency the
   * two disagree — the chain is ordered by this, never by id.
   */
  chain_seq: Generated<number>;
}

/** core.settings — typed policy store; nothing policy-like is hardcoded (docs/04 §8). */
export interface SettingsTable {
  key: string;
  value: unknown;
  value_type: 'number' | 'string' | 'boolean' | 'json';
  description: string;
  updated_by: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** wf.definitions — approval chains as runtime-editable data (WF-01). */
export interface WfDefinitionsTable {
  code: string;
  name: string;
  steps: unknown; // WorkflowStepSpec[] — validated by the workflows module
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
}

export interface WfDelegationsTable {
  id: Generated<number>;
  from_user_id: number;
  to_user_id: number;
  from_date: Timestamp;
  to_date: Timestamp;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** wf.notifications — queue with retry + dead-letter (WF-02, docs/03 §8). */
export interface NotificationsTable {
  id: Generated<number>;
  recipient_user_id: number | null;
  recipient_email: string | null;
  channel: 'in_app' | 'email';
  template_code: string;
  payload: unknown;
  status: Generated<'queued' | 'sent' | 'failed' | 'dead'>;
  attempts: Generated<number>;
  last_error: string | null;
  sent_at: Timestamp | null;
  read_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** wf.event_subscriptions — per-event recipient matrix as data (PP-26). */
export interface EventSubscriptionsTable {
  id: Generated<number>;
  event_code: string;
  recipient_kind: 'role' | 'user' | 'email';
  recipient_ref: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** core.companies — canonical entity master (doc 11 §0.2; 13 canonical of 14 raw). */
export interface CompaniesTable {
  id: Generated<number>;
  code: string;
  name: string;
  ecode_prefix: string;
  ecode_next_seq: Generated<number>;
  is_india_payroll: Generated<boolean>;
  pf_wage_basis: PfWageBasisColumn | null;
  gstin: string | null;
  pan: string | null;
  pf_establishment_code: string | null;
  esic_code: string | null;
  pt_registration_no: string | null;
  tan: string | null;
  address: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;


  sap_company_code: string | null;
  country_code: Generated<string>;
  currency_code: Generated<string>;
  timezone: Generated<string>;
  locale: Generated<string>;
}

export interface LocationsTable {
  id: Generated<number>;
  company_id: number;
  name: string;
  state_code: string;
  timezone: Generated<string>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface CostCentersTable {
  id: Generated<number>;
  company_id: number;
  code: string;
  name: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;


  plant_id: number | null;
}

export interface DepartmentsTable {
  id: Generated<number>;
  name: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;


  mis_code_id: number | null;
}

export interface OrgUnitsTable {
  id: Generated<number>;
  company_id: number;
  parent_id: number | null;
  name: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface DesignationsTable {
  id: Generated<number>;
  name: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface GradesTable {
  id: Generated<number>;
  code: string;
  name: string;
  rank: number;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export type EmploymentCategory = 'white_collar' | 'blue_collar' | 'trainee' | 'consultant' | 'contract';
export type EmployeeStatus = 'onboarding' | 'active' | 'on_notice' | 'exited';
export type ContractType = 'permanent' | 'temporary' | 'probationary' | 'consultant' | 'fixed_term' | 'apprentice';
export type PfWageBasisColumn = 'ACTUAL' | 'CEILING_15000';

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
  grade_id: number | null;
  reporting_manager_id: number | null;
  functional_manager_id: number | null;
  probation_months: number | null;
  probation_salary_pct: number | null;
  probation_due_date: Timestamp | null;
  confirmation_date: Timestamp | null;
  pan: string | null;
  aadhaar: string | null;
  uan: string | null;
  pf_number: string | null;
  esic_ip_number: string | null;
  pf_wage_basis: PfWageBasisColumn | null;
  /** REQ-003 EPF Form 11 facts (EPS membership). */
  epf_member_before_sep2014: boolean | null;
  epf_first_enrolled_on: Timestamp | null;
  epf_first_wages: string | null;
  international_worker: Generated<boolean>;
  eps_eligible: boolean | null;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;


  plant_id: number | null;

  /** Head of Department — the SECOND approver on claims, budgets and advances. */
  hod_employee_id: number | null;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export type TransferType = 'department' | 'location' | 'inter_entity' | 'promotion';
export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface TransfersTable {
  id: Generated<number>;
  employee_id: number;
  transfer_type: TransferType;
  effective_date: Timestamp;
  status: Generated<TransferStatus>;
  workflow_request_id: number | null;
  current_company_id: number;
  current_department_id: number | null;
  current_location_id: number | null;
  current_designation_id: number | null;
  current_grade_id: number | null;
  current_reporting_manager_id: number | null;
  current_ecode: string;
  target_company_id: number | null;
  target_department_id: number | null;
  target_location_id: number | null;
  target_designation_id: number | null;
  target_grade_id: number | null;
  target_reporting_manager_id: number | null;
  target_ecode: string | null;
  salary_revision_amount: string | null;
  leave_treatment: Generated<'transfer' | 'encash'>;
  reason: string;
  remarks: string | null;
  approved_by: number | null;
  approved_at: Timestamp | null;
  notified_at: Timestamp | null;
  created_by: number;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface DocumentsTable {
  id: Generated<number>;
  owner_employee_id: number | null;
  kind: string;
  path: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  uploaded_by: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;


  /** NULL = no expiry (PAN / appointment letter). DOC-03 colour language. */
  expires_on: Date | null;

  status: Generated<DocumentVaultStatus>;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** core.onboarding_candidates — LC-01 candidate intake bridge. */
export interface OnboardingCandidatesTable {
  id: Generated<number>;
  ats_candidate_id: number | null;
  loi_reference: string | null;
  full_name: string;
  personal_email: string;
  mobile: string;
  dob: Timestamp | null;
  address: string | null;
  total_experience_years: string | null;
  previous_company: string | null;
  current_salary: string | null;
  expected_salary: string | null;
  position_title: string;
  department: string | null;
  org_unit: string | null;
  designation: string | null;
  company_id: number | null;
  category: EmploymentCategory;
  replacement_of_ecode: string | null;
  offered_ctc: string;
  probation_months: number | null;
  probation_salary_pct: number | null;
  proposed_doj: Timestamp;
  offer_date: Timestamp;
  work_location: string | null;
  prejoin_link_token: string | null;
  prejoin_token_hash: string | null;
  prejoin_token_expires_at: Timestamp | null;
  prejoin_link_sent_at: Timestamp | null;
  prejoin_completed_at: Timestamp | null;
  prejoin_submitted_data: unknown;
  status: Generated<'awaiting_prejoin' | 'link_sent' | 'prejoin_done' | 'converted' | 'no_show'>;
  employee_id: number | null;
  created_at: DefaultedTimestamp;
  updated_at: Timestamp;
}

/** core.onboarding_tasks — LC-02 post-conversion task checklist. */
export interface OnboardingTasksTable {
  id: Generated<number>;
  employee_id: number;
  candidate_id: number | null;
  task_code: string;
  task_name: string;
  department: 'IT' | 'Admin' | 'HR' | 'Payroll';
  owner_role: string;
  due_date: Timestamp;
  sla_hours: number;
  status: Generated<'open' | 'completed' | 'escalated'>;
  escalated_at: Timestamp | null;
  done_by: number | null;
  done_at: Timestamp | null;
  notes: string | null;
  created_at: DefaultedTimestamp;
  updated_at: Timestamp;
}

/** core.probation_reviews — LC-04 probation review and confirmation. */
export interface ProbationReviewsTable {
  id: Generated<number>;
  employee_id: number;
  due_date: Timestamp;
  manager_recommendation: 'confirm' | 'extend' | 'separate' | null;
  extension_months: number | null;
  review_notes: string | null;
  ratings: unknown;
  status: Generated<'pending' | 'under_review' | 'completed'>;
  outcome: 'confirmed' | 'extended' | 'separated' | null;
  decided_by: number | null;
  decided_at: Timestamp | null;
  confirmation_date: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: Timestamp;
}

/** core.separations — LC-06 resignation and separation records. */
export interface SeparationsTable {
  id: Generated<number>;
  employee_id: number;
  initiated_at: DefaultedTimestamp;
  initiated_by: 'employee' | 'hr';
  reason: string;
  resignation_date: Timestamp;
  notice_period_days: number;
  requested_lwd: Timestamp;
  approved_lwd: Timestamp | null;
  shortfall_days: Generated<string>;
  workflow_request_id: number | null;
  status: Generated<'pending' | 'approved' | 'withdrawn' | 'rejected' | 'completed'>;
  fnf_id: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** core.clearances — LC-06 / AST-04 departmental clearance checklist. */
export interface ClearancesTable {
  id: Generated<number>;
  separation_id: number;
  department: 'IT' | 'Admin' | 'Finance' | 'HR';
  status: Generated<'pending' | 'cleared' | 'flagged'>;
  remarks: string | null;
  unreturned_assets: unknown;
  recovery_amount: Generated<string>;
  cleared_by: number | null;
  cleared_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PolicyAcknowledgmentsTable {
  id: Generated<number>;
  policy_id: number;
  employee_id: number;
  acknowledged_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface AttIngestWatermarksTable {
  source: string;
  watermark_ts: Timestamp;
  updated_at: DefaultedTimestamp;
}

/** att.device_watermarks — per-door completeness cursor (doc 14 §8.5). */
export interface AttDeviceWatermarksTable {
  device_id: number;
  watermark_ts: Timestamp;
  updated_at: DefaultedTimestamp;
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
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;


  break_paid: Generated<boolean>;

  ot_start_offset_minutes: Generated<number>;

  late_slabs: Generated<unknown>;

  early_exit_slabs: Generated<unknown>;

  allowance_component_code: string | null;

  session2_start: string | null;

  session2_end: string | null;
}

/** att.employee_shifts — weekday vs Saturday scheme per employee (09 §4). */
export interface AttEmployeeShiftsTable {
  employee_id: number;
  weekday_shift_id: number;
  saturday_shift_id: number | null;
  updated_by: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface AttRostersTable {
  id: Generated<number>;
  employee_id: number;
  work_date: Timestamp;
  shift_id: number | null;
  is_week_off: Generated<boolean>;
  set_by: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface AttHolidaysTable {
  id: Generated<number>;
  /** C-35 scope: NULL company = whole group; plant/location narrow it further (all non-null columns must match). */
  company_id: number | null;
  plant_id: number | null;
  location_id: number | null;
  holiday_date: Timestamp;
  name: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  session_statuses: unknown; // JSONB: ordered sessions 1/2 with P, A, O or OD; boundary-validated (ATT-05).
  scheme_code: string | null;
  penalty_flag: Generated<boolean>;
  source: Generated<'auto' | 'regularized' | 'manual'>;
  override_reason: string | null;
  is_locked: Generated<boolean>;
  computed_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface AttRecomputeQueueTable {
  employee_id: number;
  work_date: Timestamp;
  queued_at: DefaultedTimestamp;
}

/** att.regularizations — AR (past-only) / OD (future ok) / PERMISSION (time-bound) (ATT-06/07). */
export interface AttRegularizationsTable {
  id: Generated<number>;
  employee_id: number;
  kind: 'AR' | 'OD' | 'PERMISSION';
  day_portion: Generated<'full_day' | 'first_half' | 'second_half'>;
  from_date: Timestamp;
  to_date: Timestamp;
  from_time: string | null;
  to_time: string | null;
  reason: string;
  requested_status: DayStatus;
  workflow_request_id: number;
  applied: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** att.month_locks — ATT-15 payroll precondition. */
export interface AttMonthLocksTable {
  id: Generated<number>;
  company_id: number;
  month: Timestamp;
  locked_by: number;
  locked_at: DefaultedTimestamp;
  checklist: unknown;
  created_at: DefaultedTimestamp;
  /** C-17: attendance window [period_from, period_until) frozen by this lock (NULL on pre-cycle locks = calendar month). */
  period_from: Timestamp | null;
  period_until: Timestamp | null;
}

/** att.manager_month_approvals — ATT-12 manager attendance sign-off ledger. */
export interface AttManagerMonthApprovalsTable {
  id: Generated<number>;
  company_id: number;
  month: Timestamp;
  manager_employee_id: number;
  approved_by_user_id: number | null;
  approved_at: DefaultedTimestamp;
  event_type: Generated<'approve' | 'invalidate'>;
  note: string | null;
  created_at: DefaultedTimestamp;
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
  built_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** lv.restricted_holidays — optional/floating holiday list (LV-09). */
export interface LvRestrictedHolidaysTable {
  id: Generated<number>;
  holiday_date: Timestamp;
  name: string;
  location_id: number | null;
  created_at: DefaultedTimestamp;
}

export interface LvRhSelectionsTable {
  id: Generated<number>;
  employee_id: number;
  restricted_holiday_id: number;
  workflow_request_id: number;
  applied: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
}

/** att.kent_webhook_batches — raw Kent webhook POSTs (KENT_RESEARCH §5.1). */
export interface AttKentWebhookBatchesTable {
  id: Generated<number>;
  received_at: DefaultedTimestamp;
  remote_ip: string | null;
  raw_body: string;
  records: Generated<number>;
  accepted: Generated<number>;
  inserted: Generated<number>;
  unknown_faces: Generated<number>;
  rejected: Generated<number>;
  processed_at: Timestamp | null;
  error: string | null;
}

/** att.kent_unknown_faces — webhook type:0 events, never swipes. */
export interface AttKentUnknownFacesTable {
  id: Generated<number>;
  batch_id: number;
  event_ts: Timestamp | null;
  device_id: string | null;
  device_name: string | null;
  location_name: string | null;
  image_url: string | null;
  raw: unknown;
  created_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** ast.assignments — who holds it (AST-03); an open row means still out (AST-04/05). */
export interface AssetAssignmentsTable {
  id: Generated<number>;
  asset_id: number;
  holder_kind: HolderKind;
  employee_id: number | null;
  third_party_name: string | null;
  third_party_org: string | null;
  assigned_at: DefaultedTimestamp;
  returned_at: Timestamp | null;
  return_condition: ReturnCondition | null;
  notes: string | null;
  assigned_by: number;
  returned_by: number | null;
  created_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
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
  escalate_to_role_code: string | null;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  escalated_to_user_id: number | null;
  first_response_at: Timestamp | null;
  reopen_count: Generated<number>;
  acknowledged_at: Timestamp | null;
  resolved_at: Timestamp | null;
  resolution: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** hd.ticket_messages — append-only audit thread (SOW-9.4). INSERT only. */
export interface HdTicketMessagesTable {
  id: Generated<number>;
  ticket_id: number;
  author_user_id: number;
  body: string;
  is_internal: Generated<boolean>;
  created_at: DefaultedTimestamp;
}

/* ── M10 Engagement (eng) — EN-01..03 ─────────────────────────────────────── */

/** eng.announcements — audience-filtered broadcast (EN-01). */
export interface EngAnnouncementsTable {
  id: Generated<number>;
  title: string;
  body: string;
  audience: unknown;
  attachment_document_id: number | null;
  published_by: number;
  published_at: DefaultedTimestamp;
  expires_at: Timestamp | null;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
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
  opens_at: DefaultedTimestamp;
  closes_at: Timestamp | null;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
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
  created_at: DefaultedTimestamp;
}

/** eng.surveys — EN-03 structured multi-question surveys (C34, docs/03 §9). */
export interface EngSurveysTable {
  id: Generated<number>;
  title: string;
  description: string | null;
  questions: unknown;
  audience: unknown;
  created_by: number;
  open_from: DefaultedTimestamp;
  open_till: Timestamp | null;
  is_anonymous: Generated<boolean>;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** eng.survey_responses — responses to structured multi-question surveys. */
export interface EngSurveyResponsesTable {
  id: Generated<number>;
  survey_id: number;
  respondent_user_id: number | null;
  respondent_hash: string | null;
  answers: unknown;
  created_at: DefaultedTimestamp;
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
  computed_at: DefaultedTimestamp;
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
  'eng.surveys': EngSurveysTable;
  'eng.survey_responses': EngSurveyResponsesTable;
  'ast.assets': AssetsTable;
  'ast.assignments': AssetAssignmentsTable;
  'ast.maintenance': AssetMaintenanceTable;
  'core.settings': SettingsTable;
  'core.bulk_jobs': CoreBulkJobsTable;
  'core.department_heads': CoreDepartmentHeadsTable;
  'core.companies': CompaniesTable;
  'core.locations': LocationsTable;
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
  'core.onboarding_candidates': OnboardingCandidatesTable;
  'core.onboarding_tasks': OnboardingTasksTable;
  'core.probation_reviews': ProbationReviewsTable;
  'core.separations': SeparationsTable;
  'core.clearances': ClearancesTable;
  'core.transfers': TransfersTable;
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
  'att.kent_webhook_batches': AttKentWebhookBatchesTable;
  'att.kent_unknown_faces': AttKentUnknownFacesTable;
  'att.shifts': AttShiftsTable;
  'att.employee_shifts': AttEmployeeShiftsTable;
  'att.rosters': AttRostersTable;
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
  'pay.salary_components': SalaryComponentsTable;
  'pay.salary_structures': SalaryStructuresTable;
  'pay.employee_salaries': EmployeeSalariesTable;
  'pay.payroll_runs': PayrollRunsTable;
  'pay.payroll_items': PayrollItemsTable;
  'pay.payroll_item_lines': PayrollItemLinesTable;
  'pay.inputs': PayrollInputsTable;
  'pay.salary_holds': SalaryHoldsTable;
  'pay.arrears': ArrearsTable;
  'pay.statutory_rates': StatutoryRatesTable;
  'pay.pt_slabs': PtSlabsTable;
  'pay.it_slabs': ItSlabsTable;
  'pay.investment_declarations': InvestmentDeclarationsTable;
  'pay.tds_challans': TdsChallansTable;
  'pay.gl_accounts': GlAccountsTable;
  'pay.bank_batches': BankBatchesTable;
  'pay.fnf_settlements': FnfSettlementsTable;
  'pay.loans': LoansTable;
  'pay.loan_postings': LoanPostingsTable;
  'pay.recovery_carry_forwards': RecoveryCarryForwardsTable;
  'pay.claim_types': ClaimTypesTable;
  'pay.claim_entitlements': ClaimEntitlementsTable;
  'pay.claims': ClaimsTable;
  'pay.claim_bills': ClaimBillsTable;


  'core.plants': CorePlantsTable;

  'core.mis_codes': CoreMisCodesTable;

  'att.shift_patterns': AttShiftPatternsTable;

  'att.roster_publications': AttRosterPublicationsTable;

  'att.roster_revisions': AttRosterRevisionsTable;

  'att.coverage_targets': AttCoverageTargetsTable;

  'att.leave_blackouts': AttLeaveBlackoutsTable;

  'att.shift_swaps': AttShiftSwapsTable;

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

  'pay.budgets': PayBudgetsTable;

  'pay.budget_categories': PayBudgetCategoriesTable;

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

  'te.trips': TeTripsTable;
  'te.trip_itineraries': TeTripItinerariesTable;
  'te.budgets': TeBudgetsTable;
  'te.advances': TeAdvancesTable;
  'te.wallets': TeWalletsTable;
  'te.wallet_transactions': TeWalletTransactionsTable;
  'te.claims': TeClaimsTable;
  'te.claim_items': TeClaimItemsTable;
  'te.settlements': TeSettlementsTable;
}

/* ── M6 Payroll & Statutory (pay) — PAY-01..18, docs/03 §6 ────────────────── */

export type SalaryComponentKind = 'earning' | 'deduction' | 'employer_contribution';
export type SalaryRoundingMode = 'round' | 'floor' | 'ceil' | 'nearest_10';
export type SalaryPhase = 'probation' | 'confirmed';
export type SalaryRevisionReason =
  | 'joining'
  | 'annual_increment'
  | 'promotion'
  | 'confirmation'
  | 'correction'
  | 'probation_start';
export type PayrollRunType = 'regular' | 'off_cycle' | 'fnf' | 'bonus' | 'arrears';
export type PayrollRunStatus =
  | 'draft'
  | 'inputs_locked'
  | 'computed'
  | 'under_review'
  | 'approved'
  | 'finalized'
  | 'reopened'
  | 'paid';
export type PayrollPaymentStatus = 'payable' | 'hold_payment' | 'hold_process';
export type SalaryHoldType = 'payment' | 'process';
export type LoanType =
  | 'loan_diminishing'
  | 'loan_flat'
  | 'emi_no_interest'
  | 'salary_advance'
  | 'travel_advance';
export type LoanStatus = 'pending' | 'active' | 'closed' | 'written_off' | 'rejected' | 'cancelled';
export type ClaimBasis = 'annual' | 'monthly' | 'per_event';
export type ClaimStatus = 'pending' | 'verified' | 'approved' | 'rejected' | 'paid';

export interface SalaryComponentItem {
  component_code: string;
  formula_override?: string | null | undefined;
  amount_rule?: string | null | undefined;
}

export interface SalaryComponentsTable {
  code: string;
  name: string;
  kind: SalaryComponentKind;
  formula: string | null;
  rounding: Generated<SalaryRoundingMode>;
  taxable: Generated<boolean>;
  part_of_gross: Generated<boolean>;
  part_of_pf_wages: Generated<boolean>;
  prorate_on_lop: Generated<boolean>;
  display_order: number;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
}

export interface SalaryStructuresTable {
  id: Generated<number>;
  name: string;
  company_id: number;
  description: string | null;
  components: SalaryComponentItem[];
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface EmployeeSalariesTable {
  id: Generated<number>;
  employee_id: number;
  structure_id: number;
  effective_from: Date;
  effective_to: Generated<Date>;
  annual_ctc: string;
  phase: Generated<SalaryPhase>;
  /** Monthly integer paise snapshot written by salary assignment (PAY-02). */
  component_amounts: Record<string, number>;
  probation_percent: string | null;
  revision_reason: SalaryRevisionReason | null;
  approved_by: number | null;
  approved_at: Timestamp | null;
  created_at: DefaultedTimestamp;
}

export interface PayrollRunsTable {
  id: Generated<number>;
  company_id: number;
  month: Timestamp;
  run_type: Generated<PayrollRunType>;
  status: Generated<PayrollRunStatus>;
  attendance_lock_id: number | null;
  computed_at: NullableTimestamp;
  approved_at: NullableTimestamp;
  approved_by: number | null;
  finalized_at: NullableTimestamp;
  finalized_by: number | null;
  notes: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PayrollItemsTable {
  id: Generated<number>;
  run_id: number;
  employee_id: number;
  days_in_month: string;
  payable_days: string;
  lop_days: Generated<string>;
  lop_reversal_days: Generated<string>;
  ot_minutes: Generated<number>;
  gross: string;
  total_deductions: string;
  net_pay: string;
  payment_status: Generated<PayrollPaymentStatus>;
  payslip_document_id: number | null;
  employer_cost: Generated<string>;
  created_at: DefaultedTimestamp;
}

export interface PayrollItemLinesTable {
  id: Generated<number>;
  item_id: number;
  component_code: string;
  amount: string;
  calc_note: string | null;
  loan_id: number | null;
  carry_forward_id: number | null;
  created_at: DefaultedTimestamp;
}

export interface PayrollInputsTable {
  id: Generated<number>;
  run_id: number;
  employee_id: number;
  component_code: string;
  amount: string;
  note: string;
  entered_by: number;
  created_at: DefaultedTimestamp;
}

export interface SalaryHoldsTable {
  id: Generated<number>;
  employee_id: number;
  hold_type: SalaryHoldType;
  reason: string;
  start_month: Timestamp;
  released_month: Timestamp | null;
  created_by: number;
  created_at: DefaultedTimestamp;
}

export interface ArrearsTable {
  id: Generated<number>;
  employee_id: number;
  source_salary_id: number;
  for_month: Timestamp;
  paid_in_run_id: number | null;
  component_code: string;
  amount: string;
  created_at: DefaultedTimestamp;
}

export interface StatutoryRatesTable {
  id: Generated<number>;
  scheme: string;
  param: string;
  value: string;
  effective_from: Timestamp;
  source_note: string;
  created_at: DefaultedTimestamp;
}

export interface PtSlabsTable {
  id: Generated<number>;
  state_code: string;
  min_monthly: string;
  max_monthly: string | null;
  amount: string;
  effective_from: Timestamp;
  basis: Generated<'earned_monthly' | 'contracted_monthly'>;
}

export interface RecoveryCarryForwardsTable {
  id: Generated<number>;
  employee_id: number;
  component_code: string;
  amount: string;
  from_run_id: number;
  consumed_run_id: number | null;
  note: string;
  created_at: DefaultedTimestamp;
}

export interface ItSlabsTable {
  id: Generated<number>;
  fy: string;
  regime: 'old' | 'new';
  slab_from: string;
  slab_to: string | null;
  rate: string;
  surcharge_rules: unknown;
  cess_rate: Generated<string>;
  standard_deduction: string;
  rebate_87a: unknown;
  created_at: DefaultedTimestamp;
}

export interface InvestmentDeclarationsTable {
  id: Generated<number>;
  employee_id: number;
  fy: string;
  section: string;
  declared_amount: string;
  proof_document_id: number | null;
  verified_amount: string | null;
  verified_by: number | null;
  verified_at: Timestamp | null;
  created_at: DefaultedTimestamp;
}

export interface TdsChallansTable {
  id: Generated<number>;
  company_id: number;
  month: Timestamp;
  amount: string;
  challan_no: string;
  bsr_code: string | null;
  paid_on: Timestamp;
  created_at: DefaultedTimestamp;
}

export interface GlAccountsTable {
  id: Generated<number>;
  component_code: string;
  gl_code: string;
  created_at: DefaultedTimestamp;

  company_code: string;
  plant_code: string;
  cost_center_code: string;
}

export interface BankBatchesTable {
  id: Generated<number>;
  run_id: number;
  file_document_id: number;
  total_amount: string;
  record_count: number;
  generated_by: number;
  created_at: DefaultedTimestamp;
}

export interface FnfSettlementsTable {
  id: Generated<number>;
  employee_id: number;
  separation_id: number;
  run_id: number | null;
  last_working_day: Timestamp;
  days_payable: string;
  leave_encash_days: Generated<string>;
  leave_encash_amount: Generated<string>;
  notice_recovery_days: Generated<string>;
  notice_recovery_amount: Generated<string>;
  gratuity_amount: Generated<string>;
  other_payments: Generated<string>;
  other_deductions: Generated<string>;
  held_salary_released: Generated<string>;
  gross_payable: Generated<string>;
  total_deductions: Generated<string>;
  net_payable: Generated<string>;
  status: Generated<string>;
  tat_due_date: Timestamp | null;
  paid_at: Timestamp | null;
  relieving_letter_id: number | null;
  service_certificate_id: number | null;
  calc_breakdown: unknown;
  created_at: DefaultedTimestamp;
}

export interface LoansTable {
  id: Generated<number>;
  employee_id: number;
  loan_type: LoanType;
  principal: string;
  interest_rate: Generated<string>;
  emi: string;
  start_month: Timestamp;
  tenure_months: number;
  outstanding: string;
  perquisite_applicable: Generated<boolean>;
  source: Generated<string>;
  source_reference: string | null;
  workflow_request_id: number | null;
  status: Generated<LoanStatus>;
  created_at: DefaultedTimestamp;
}

export interface LoanPostingsTable {
  id: Generated<number>;
  loan_id: number;
  run_id: number;
  principal_part: string;
  interest_part: string;
  perquisite_value: Generated<string>;
  created_at: DefaultedTimestamp;
}

export interface ClaimTypesTable {
  id: Generated<number>;
  code: string;
  name: string;
  entitlement_basis: ClaimBasis;
  bill_required: Generated<boolean>;
  taxable_if_unsubstantiated: Generated<boolean>;
  payout_component_code: string;
  requires_bill: Generated<boolean>;
  is_taxable: Generated<boolean>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface ClaimEntitlementsTable {
  id: Generated<number>;
  claim_type_id: number;
  grade_id: number | null;
  amount: string;
  effective_from: Timestamp;
  created_at: DefaultedTimestamp;
}

export interface ClaimsTable {
  id: Generated<number>;
  employee_id: number;
  claim_type_id: number | null;
  funding_kind: Generated<'budget' | 'entitlement'>;
  budget_id: number | null;
  reference: string | null;
  period_from: Timestamp;
  period_to: Timestamp;
  claimed_amount: string;
  approved_amount: string | null;
  status: Generated<ClaimStatus>;
  workflow_request_id: number | null;
  rejection_reason: string | null;
  advance_loan_id: number | null;
  paid_in_run_id: number | null;
  paid_in_batch_id: number | null;
  reserved_budget_id: number | null;
  display_currency: Generated<string>;
  fx_rates_to_inr: Record<string, number> | null;
  fx_rate_date: Timestamp | null;
  settlement_status: Generated<'unsettled' | 'settled'>;
  settlement_mode: 'AUTO' | 'MANUAL' | null;
  settlement_amount: string | null;
  net_payable: string | null;
  settled_by_user_id: number | null;
  settled_at: Timestamp | null;
  submitted_at: Timestamp | null;
  decided_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface ClaimBillsTable {
  id: Generated<number>;
  claim_id: number;
  document_id: number;
  bill_no: string | null;
  bill_date: Timestamp | null;
  amount: string;
  verified: Generated<boolean>;
  verified_by: number | null;
  created_at: DefaultedTimestamp;
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



/** sec.password_history — hashes only, so reuse is refusable (SEC-01). */
export interface SecPasswordHistoryTable {
  id: Generated<number>;
  user_id: number;
  password_hash: string;
  changed_at: DefaultedTimestamp;
  changed_by_user_id: number | null;
}



/** sec.mfa_recovery_codes — hashed, single-use. */
export interface SecMfaRecoveryCodesTable {
  id: Generated<number>;
  enrolment_id: number;
  code_hash: string;
  used_at: Timestamp | null;
  created_at: DefaultedTimestamp;
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



/* ── sec — identity hardening (Phase 5 Stage 5.2, SEC-01..11) ───────────── */

/** sec.sessions — a session is a ROW, so revoke takes effect next request. */
export interface SecSessionsTable {
  refresh_token_hash: string | null;
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
  created_at: DefaultedTimestamp;
}



export interface AttLeaveBlackoutsTable {
  id: Generated<number>;
  blackout_date: Timestamp;
  location_id: number | null;
  name: string;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}



export interface AttCoverageTargetsTable {
  id: Generated<number>;
  location_id: number;
  department_id: number | null;
  shift_id: number;
  weekday: number;
  sanctioned: number;
  updated_by: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
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
  changed_at: DefaultedTimestamp;
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



export interface AttShiftPatternsTable {
  id: Generated<number>;
  code: string;
  name: string;
  cycle: unknown;
  created_by: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}



/** Vault lifecycle on the shared file registry (DOC-02). Letters/policies stay `active`. */
export type DocumentVaultStatus = 'active' | 'superseded' | 'withdrawn';



/** DB-defaulted timestamp: select Date; optional insert; no nested ColumnType. */
type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

/* ── M13 Travel & Expense (te) — TE-01..12, docs/11 ───────────────────────── */

export interface TeTripsTable {
  id: Generated<number>;
  reference_no: string;
  employee_id: number;
  company_id: number;
  trip_name: string;
  travel_type: 'domestic' | 'international';
  purpose: string;
  destination_country: ColumnType<string, string | undefined, string>;
  destination_city: string;
  start_date: ColumnType<Date, Date | string, Date | string>;
  end_date: ColumnType<Date, Date | string, Date | string>;
  visa_required: ColumnType<boolean, boolean | undefined, boolean>;
  visa_status: ColumnType<'not_applicable' | 'applied' | 'approved' | 'rejected', string | undefined, string>;
  status: ColumnType<'draft' | 'submitted' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled', string | undefined, string>;
  estimated_budget_paise: ColumnType<number, number | undefined, number>;
  approved_budget_paise: ColumnType<number, number | undefined, number>;
  cancellation_reason: string | null;
  cancellation_cost_paise: ColumnType<number, number | undefined, number>;
  workflow_request_id: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface TeTripItinerariesTable {
  id: Generated<number>;
  trip_id: number;
  segment_type: 'flight' | 'train' | 'bus' | 'hotel' | 'car' | 'other';
  origin: string;
  destination: string;
  departure_date: ColumnType<Date, Date | string, Date | string>;
  arrival_date: ColumnType<Date, Date | string | null | undefined, Date | string | null>;
  provider: string | null;
  booking_reference: string | null;
  estimated_cost_paise: ColumnType<number, number | undefined, number>;
  actual_cost_paise: ColumnType<number, number | undefined, number>;
  created_at: DefaultedTimestamp;
}

export interface TeBudgetsTable {
  id: Generated<number>;
  grade_level: string;
  travel_type: 'domestic' | 'international';
  flight_class: ColumnType<string, string | undefined, string>;
  hotel_per_night_paise: ColumnType<number, number | undefined, number>;
  daily_allowance_paise: ColumnType<number, number | undefined, number>;
  local_conveyance_paise: ColumnType<number, number | undefined, number>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
}

export interface TeAdvancesTable {
  id: Generated<number>;
  trip_id: number;
  employee_id: number;
  amount_paise: number;
  purpose: string;
  status: ColumnType<'requested' | 'approved' | 'rejected' | 'sent_back' | 'disbursed' | 'cancelled', string | undefined, string>;
  workflow_request_id: number | null;
  disbursed_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface TeWalletsTable {
  id: Generated<number>;
  employee_id: number;
  balance_paise: ColumnType<number, number | undefined, number>;
  updated_at: DefaultedTimestamp;
}

export interface TeWalletTransactionsTable {
  id: Generated<number>;
  wallet_id: number;
  employee_id: number;
  trip_id: number | null;
  source: 'ADVANCE' | 'CLAIM_SETTLEMENT' | 'RECOVERY' | 'ADJUSTMENT';
  type: 'credit' | 'debit';
  amount_paise: number;
  balance_after_paise: number;
  transaction_reference: string;
  notes: string | null;
  created_at: DefaultedTimestamp;
}

export interface TeClaimsTable {
  id: Generated<number>;
  reference_no: string;
  trip_id: number;
  employee_id: number;
  total_claimed_paise: ColumnType<number, number | undefined, number>;
  approved_amount_paise: ColumnType<number, number | undefined, number>;
  advance_adjusted_paise: ColumnType<number, number | undefined, number>;
  net_payable_paise: ColumnType<number, number | undefined, number>;
  net_recoverable_paise: ColumnType<number, number | undefined, number>;
  status: ColumnType<'draft' | 'submitted' | 'approved' | 'rejected' | 'sent_back' | 'settled', string | undefined, string>;
  settlement_status: ColumnType<'unsettled' | 'settled', string | undefined, string>;
  workflow_request_id: number | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface TeClaimItemsTable {
  id: Generated<number>;
  claim_id: number;
  category: 'flight' | 'train' | 'bus' | 'hotel' | 'daily_allowance' | 'local_travel' | 'visa' | 'food' | 'misc';
  item_date: ColumnType<Date, Date | string, Date | string>;
  amount_paise: number;
  currency: ColumnType<string, string | undefined, string>;
  fx_rate_to_inr: ColumnType<string | number, string | number | undefined, string | number>;
  inr_amount_paise: number;
  receipt_document_id: number | null;
  receipt_url: string | null;
  description: string | null;
  created_at: DefaultedTimestamp;
}

export interface TeSettlementsTable {
  id: Generated<number>;
  claim_id: number;
  trip_id: number;
  employee_id: number;
  settlement_mode: ColumnType<'AUTO' | 'MANUAL', string | undefined, string>;
  claimed_amount_paise: number;
  advance_amount_paise: number;
  net_payable_paise: ColumnType<number, number | undefined, number>;
  net_recoverable_paise: ColumnType<number, number | undefined, number>;
  recovery_channel: ColumnType<'payroll_deduction' | 'wallet_carry_forward' | 'direct_refund', string | undefined, string>;
  settled_by: number | null;
  settled_at: DefaultedTimestamp;
  status: ColumnType<'pending' | 'settled' | 'payroll_posted', string | undefined, string>;
}
