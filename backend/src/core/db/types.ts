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

/** att.devices — door health board (ATT-02). */
export interface AttDevicesTable {
  id: Generated<number>;
  source: Generated<string>;
  door_code: string;
  location_id: number | null;
  last_seen_at: Timestamp | null;
  expected_hourly_swipes: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface AttIngestWatermarksTable {
  source: string;
  watermark_ts: Timestamp;
  updated_at: Generated<Timestamp>;
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
  'wf.notifications': NotificationsTable;
  'wf.event_subscriptions': EventSubscriptionsTable;
  'att.devices': AttDevicesTable;
  'att.ingest_watermarks': AttIngestWatermarksTable;
  'att.swipe_events': AttSwipeEventsTable;
}
