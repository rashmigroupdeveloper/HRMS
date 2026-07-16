/**
 * Employee directory / profile business rules (P0-T33).
 * Statutory ID masking: never return PAN/Aadhaar/UAN/PF/ESIC/bank unless the
 * caller may see them (docs/08 — permission-masked; never logged).
 */
import type { Kysely } from 'kysely';
import type { Selectable } from 'kysely';
import type { Database, UsersTable } from '../../core/db/types.js';
import {
  countDirectory,
  findByEcode,
  findById,
  listDirectory,
  type DirectoryFilters,
  type DirectoryRow,
  type EmployeeProfileRow,
} from './employees.repository.js';

export type AuthedUser = Selectable<UsersTable>;

export interface DirectoryItem {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  entity: string;
  entityName: string;
  status: string;
  statusLabel: string;
}

export interface DirectoryResult {
  items: DirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmployeeProfile {
  ecode: string;
  name: string;
  photoPath: string | null;
  gender: string | null;
  dob: string | null;
  maritalStatus: string | null;
  bloodGroup: string | null;
  personalEmail: string | null;
  workEmail: string | null;
  mobile: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  category: string | null;
  contractType: string | null;
  doj: string | null;
  dol: string | null;
  status: string;
  statusLabel: string;
  exitReason: string | null;
  confirmationDate: string | null;
  probationDueDate: string | null;
  entity: string;
  entityName: string;
  designation: string | null;
  department: string | null;
  locationName: string | null;
  gradeName: string | null;
  reportingManagerEcode: string | null;
  reportingManagerName: string | null;
  /** True when statutory/bank fields were stripped for this caller. */
  statutoryMasked: boolean;
  pan: string | null;
  aadhaar: string | null;
  uan: string | null;
  pfNumber: string | null;
  esicIpNumber: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  paymentMode: string;
  /** Frontend shows Compensation tab only when this is true. */
  canViewCompensation: boolean;
}

/**
 * Unmask statutory IDs when the caller holds `employee.statutory_ids.read` and
 * either views their own linked employee, or holds a payroll-admin-class power
 * (`payroll.run.manage` / `payroll.run.reopen`) that implies all-scope unmask
 * (docs/08 §2 — payroll_admin + super_admin). Scope engine lands later; this
 * keeps employee-role holders from reading peers' PAN/Aadhaar.
 */
export function canViewStatutoryIds(
  user: AuthedUser,
  permissions: ReadonlySet<string>,
  targetEmployeeId: number,
): boolean {
  if (!permissions.has('employee.statutory_ids.read')) return false;
  if (user.employee_id === targetEmployeeId) return true;
  return permissions.has('payroll.run.manage') || permissions.has('payroll.run.reopen');
}

export function statusLabel(status: string, confirmationDate: Date | null): string {
  if (status === 'onboarding') return 'Onboarding';
  if (status === 'on_notice') return 'Notice period';
  if (status === 'exited') return 'Exited';
  if (status === 'active' && confirmationDate === null) return 'Probation';
  return 'Confirmed';
}

function displayName(first: string, last: string | null): string {
  return last !== null && last !== '' ? `${first} ${last}` : first;
}

function isoDate(value: Date | null): string | null {
  if (value === null) return null;
  return value.toISOString().slice(0, 10);
}

function toDirectoryItem(row: DirectoryRow): DirectoryItem {
  return {
    ecode: row.ecode,
    name: displayName(row.first_name, row.last_name),
    designation: row.designation,
    department: row.department,
    entity: row.company_code,
    entityName: row.company_name,
    status: row.status,
    statusLabel: statusLabel(row.status, row.confirmation_date),
  };
}

export async function listEmployees(
  db: Kysely<Database>,
  input: {
    q?: string | undefined;
    companyCode?: string | undefined;
    status?: 'onboarding' | 'active' | 'on_notice' | 'exited' | undefined;
    activeOnly?: boolean | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  },
): Promise<DirectoryResult> {
  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 50, 200);
  const filters: DirectoryFilters = {
    q: input.q,
    companyCode: input.companyCode,
    status: input.status,
    activeOnly: input.activeOnly ?? true,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };

  const [total, rows] = await Promise.all([
    countDirectory(db, filters),
    listDirectory(db, filters),
  ]);

  return {
    items: rows.map(toDirectoryItem),
    total,
    page,
    pageSize,
  };
}

function toProfile(
  row: EmployeeProfileRow,
  opts: { statutoryMasked: boolean; canViewCompensation: boolean },
): EmployeeProfile {
  const masked = opts.statutoryMasked;
  return {
    ecode: row.ecode,
    name: displayName(row.first_name, row.last_name),
    photoPath: row.photo_path,
    gender: row.gender,
    dob: isoDate(row.dob),
    maritalStatus: row.marital_status,
    bloodGroup: row.blood_group,
    personalEmail: row.personal_email,
    workEmail: row.work_email,
    mobile: row.mobile,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    presentAddress: row.present_address,
    permanentAddress: row.permanent_address,
    category: row.category,
    contractType: row.contract_type,
    doj: isoDate(row.doj),
    dol: isoDate(row.dol),
    status: row.status,
    statusLabel: statusLabel(row.status, row.confirmation_date),
    exitReason: row.exit_reason,
    confirmationDate: isoDate(row.confirmation_date),
    probationDueDate: isoDate(row.probation_due_date),
    entity: row.company_code,
    entityName: row.company_name,
    designation: row.designation,
    department: row.department,
    locationName: row.location_name,
    gradeName: row.grade_name,
    reportingManagerEcode: row.reporting_manager_ecode,
    reportingManagerName: row.reporting_manager_name,
    statutoryMasked: masked,
    pan: masked ? null : row.pan,
    aadhaar: masked ? null : row.aadhaar,
    uan: masked ? null : row.uan,
    pfNumber: masked ? null : row.pf_number,
    esicIpNumber: masked ? null : row.esic_ip_number,
    bankName: masked ? null : row.bank_name,
    bankAccount: masked ? null : row.bank_account,
    bankIfsc: masked ? null : row.bank_ifsc,
    paymentMode: row.payment_mode,
    canViewCompensation: opts.canViewCompensation,
  };
}

export async function getEmployeeByEcode(
  db: Kysely<Database>,
  ecode: string,
  user: AuthedUser,
  permissions: ReadonlySet<string>,
): Promise<EmployeeProfile | null> {
  const row = await findByEcode(db, ecode);
  if (!row) return null;

  const unmask = canViewStatutoryIds(user, permissions, row.id);
  return toProfile(row, {
    statutoryMasked: !unmask,
    canViewCompensation: permissions.has('employee.compensation.read'),
  });
}

/**
 * The signed-in user's OWN profile (self-service `/employees/me`). Resolved from
 * the account's employee link — it can only ever return the caller's own record,
 * so no directory scope is involved. Masking follows the same rule as any
 * profile: the owner sees their statutory IDs unmasked only when they hold
 * `employee.statutory_ids.read` (docs/08 — employee role has it at 'own' scope).
 * Returns null when the account isn't linked to an employee.
 */
export async function getOwnProfile(
  db: Kysely<Database>,
  user: AuthedUser,
  permissions: ReadonlySet<string>,
): Promise<EmployeeProfile | null> {
  if (user.employee_id === null) return null;

  const row = await findById(db, user.employee_id);
  if (!row) return null;

  const unmask = canViewStatutoryIds(user, permissions, row.id);
  return toProfile(row, {
    statutoryMasked: !unmask,
    canViewCompensation: permissions.has('employee.compensation.read'),
  });
}
