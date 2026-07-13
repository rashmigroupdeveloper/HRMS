/**
 * Kysely database interface — the single source of table types for queries.
 * Grows in lock-step with migrations; a column here without a migration (or
 * vice versa) is a bug.
 */
import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

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
  status: Generated<'queued' | 'sent' | 'failed' | 'dead'>;
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
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface DepartmentsTable {
  id: Generated<number>;
  name: string;
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

export interface DocumentsTable {
  id: Generated<number>;
  owner_employee_id: number | null;
  kind: string;
  path: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  uploaded_by: number | null;
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
  document_id: number;
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
  document_id: number;
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

/** lv.leave_types — the LV-01 catalog; every rate/cap is runtime-editable data. */
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
  sandwich_rule: Generated<'include' | 'exclude'>;
  applicable_categories: EmploymentCategory[] | null;
  applicable_gender: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** lv.ledger — APPEND-ONLY leave transactions; balance = SUM(delta) (LV-05). */
export interface LvLedgerTable {
  id: Generated<number>;
  employee_id: number;
  leave_type_id: number;
  txn_type: 'accrual' | 'grant' | 'application' | 'cancel' | 'lapse' | 'encash' | 'comp_off_earn' | 'adjustment';
  delta: string;
  effective_date: Timestamp;
  expiry_date: Timestamp | null;
  reference_id: number | null;
  note: string | null;
  created_by: number | null;
  created_at: Generated<Timestamp>;
}

/** lv.applications — LV-03; ledger debit/reversal linked, never inlined. */
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
  status: Generated<'pending' | 'approved' | 'rejected' | 'cancelled'>;
  workflow_request_id: number;
  cancel_workflow_request_id: number | null;
  ledger_txn_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** lv.restricted_holidays + selections — LV-09 optional/floating holidays. */
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

export interface Database {
  'core.users': UsersTable;
  'core.roles': RolesTable;
  'core.permissions': PermissionsTable;
  'core.role_permissions': RolePermissionsTable;
  'core.user_roles': UserRolesTable;
  'core.audit_log': AuditLogTable;
  'core.settings': SettingsTable;
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
  'wf.definitions': WfDefinitionsTable;
  'wf.requests': WfRequestsTable;
  'wf.request_steps': WfRequestStepsTable;
  'wf.delegations': WfDelegationsTable;
  'wf.notifications': NotificationsTable;
  'wf.event_subscriptions': EventSubscriptionsTable;
  'att.devices': AttDevicesTable;
  'att.ingest_watermarks': AttIngestWatermarksTable;
  'att.swipe_events': AttSwipeEventsTable;
  'att.quarantined_swipes': AttQuarantinedSwipesTable;
  'att.shifts': AttShiftsTable;
  'att.employee_shifts': AttEmployeeShiftsTable;
  'att.rosters': AttRostersTable;
  'att.holidays': AttHolidaysTable;
  'att.day_records': AttDayRecordsTable;
  'att.recompute_queue': AttRecomputeQueueTable;
  'att.regularizations': AttRegularizationsTable;
  'att.overtime_entries': AttOvertimeEntriesTable;
  'lv.leave_types': LvLeaveTypesTable;
  'lv.ledger': LvLedgerTable;
  'lv.applications': LvApplicationsTable;
  'lv.restricted_holidays': LvRestrictedHolidaysTable;
  'lv.rh_selections': LvRhSelectionsTable;
  'core.letter_templates': LetterTemplatesTable;
  'core.letters': LettersTable;
  'core.policies': PoliciesTable;
  'core.policy_acknowledgments': PolicyAcknowledgmentsTable;
  'att.absence_cases': AttAbsenceCasesTable;
}
