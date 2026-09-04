/**
 * Employee directory / profile business rules (P0-T33).
 * Statutory ID masking: never return PAN/Aadhaar/UAN/PF/ESIC/bank unless the
 * caller may see them (docs/08 — permission-masked; never logged).
 */
import type { Kysely } from 'kysely';
import type { Selectable } from 'kysely';
import type { Database, EmploymentCategory, UsersTable } from '../../core/db/types.js';
import { formatDbDate } from '../../core/dates.js';
import {
  countDirectory,
  findByEcode,
  findById,
  listDirectory,
  type DirectoryFilters,
  type DirectoryRow,
  type EmployeeProfileRow,
} from './employees.repository.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';

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
/**
 * W0-T13 — `employee.compensation.read` is held by the `employee` role at scope
 * `own` (docs/08 §2), so asking only "does the caller hold it?" answered yes on
 * a COLLEAGUE's profile and the UI showed a Compensation tab there. The tab is
 * empty only because pay.* does not exist yet; it would fill the day Phase 2
 * lands. Visibility is therefore decided against the subject, not the caller.
 *
 * `all` (hr_head, payroll_admin) sees any subject; anyone else sees only their
 * own record. `subtree`/`org_unit` holders are deliberately NOT granted
 * compensation by docs/08, so they never reach the true branch.
 */
export function canViewCompensation(
  scope: EmployeeScope,
  permissions: ReadonlySet<string>,
  targetEmployeeId: number,
): boolean {
  if (!permissions.has('employee.compensation.read')) return false;
  if (scope.all) return true;
  return scope.actorEmployeeId === targetEmployeeId;
}

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
  // Local getters, not toISOString — a DATE column is local midnight
  // (core/dates.ts, the F6 bug).
  return formatDbDate(value);
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
    companyCodes?: string[] | undefined;
    statuses?: ('onboarding' | 'active' | 'on_notice' | 'exited')[] | undefined;
    departmentIds?: number[] | undefined;
    locationIds?: number[] | undefined;
    categories?: EmploymentCategory[] | undefined;
    reportingManagerId?: number | undefined;
    /** ORG-05 shared filter contract. */
    plantCode?: string[] | undefined;
    misCode?: string[] | undefined;
    costCenterCode?: string[] | undefined;
    activeOnly?: boolean | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  },
  scope: EmployeeScope,
): Promise<DirectoryResult> {
  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 50, 200);
  const filters: DirectoryFilters = {
    q: input.q,
    companyCode: input.companyCode,
    status: input.status,
    companyCodes: input.companyCodes,
    statuses: input.statuses,
    departmentIds: input.departmentIds,
    locationIds: input.locationIds,
    categories: input.categories,
    reportingManagerId: input.reportingManagerId,
    plantCode: input.plantCode,
    misCode: input.misCode,
    costCenterCode: input.costCenterCode,
    activeOnly: input.activeOnly ?? true,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };

  const [total, rows] = await Promise.all([
    countDirectory(db, filters, scope),
    listDirectory(db, filters, scope),
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

/**
 * Profile by e-code, narrowed to the caller's scope (CORE-10).
 *
 * Returns null both when the e-code does not exist and when it exists outside
 * the caller's scope, so the router's 404 cannot be used to prove that an
 * employee exists.
 */
export async function getEmployeeByEcode(
  db: Kysely<Database>,
  ecode: string,
  user: AuthedUser,
  permissions: ReadonlySet<string>,
  scope: EmployeeScope,
): Promise<EmployeeProfile | null> {
  const row = await findByEcode(db, ecode, scope);
  if (!row) return null;

  const unmask = canViewStatutoryIds(user, permissions, row.id);
  return toProfile(row, {
    statutoryMasked: !unmask,
    canViewCompensation: canViewCompensation(scope, permissions, row.id),
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
    // Own record: `own` scope is satisfied by construction here.
    canViewCompensation: permissions.has('employee.compensation.read'),
  });
}

/**
 * Directory filter facets (docs/05 §4.2: "filters: entity, plant, dept,
 * category, status, RM").
 *
 * Counts are DERIVED from the employee master, never authored. The drawer
 * previously shipped four hardcoded entity headcounts (667/174/96/57), which
 * both went stale the moment anyone joined and violated the never-fake-data
 * rule (docs/05 §4.8). Deriving them means the numbers are either right or
 * absent — there is no third state where they quietly lie.
 *
 * `activeOnly` mirrors the directory's own default so the facet counts always
 * describe the list the user is actually looking at.
 */
export interface DirectoryFacets {
  entities: { code: string; label: string; count: number }[];
  departments: { code: string; label: string; count: number }[];
  categories: { code: string; label: string; count: number }[];
  locations: { code: string; label: string; count: number }[];
  statuses: { code: string; label: string; count: number }[];
  total: number;
}

/** docs/03 employee status enum → the words HR actually uses. */
const STATUS_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  active: 'Active',
  on_notice: 'Notice period',
  exited: 'Exited',
};

export async function listDirectoryFacets(
  db: Kysely<Database>,
  input: { activeOnly?: boolean | undefined },
  scope: EmployeeScope,
): Promise<DirectoryFacets> {
  const activeOnly = input.activeOnly ?? true;

  // Facet counts are headcounts. An unscoped count tells a plant head how many
  // people the other plants employ, which is the same disclosure as the list.
  const base = db
    .selectFrom('core.employees as e')
    .where(employeeScopeSql(scope, 'e'))
    .$if(activeOnly, (qb) => qb.where('e.status', 'in', ['active', 'on_notice']));

  const [entities, departments, categories, locations, statuses, totalRow] = await Promise.all([
    base
      .innerJoin('core.companies as c', 'c.id', 'e.company_id')
      .select(['c.code as code', 'c.name as label'])
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .groupBy(['c.code', 'c.name'])
      .orderBy('c.code')
      .execute(),
    base
      .innerJoin('core.departments as d', 'd.id', 'e.department_id')
      // Departments carry no code column — the id IS the filter key.
      .select(['d.id as id', 'd.name as label'])
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .groupBy(['d.id', 'd.name'])
      .orderBy('d.name')
      .execute(),
    base
      .select('e.category as code')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('e.category', 'is not', null)
      .groupBy('e.category')
      .orderBy('e.category')
      .execute(),
    base
      .innerJoin('core.locations as l', 'l.id', 'e.location_id')
      .select(['l.id as id', 'l.name as label'])
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .groupBy(['l.id', 'l.name'])
      .orderBy('l.name')
      .execute(),
    // Status facets deliberately ignore activeOnly: otherwise "Exited" could
    // never be discovered from a directory that defaults to active-only.
    db
      .selectFrom('core.employees')
      .select('status as code')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .groupBy('status')
      .orderBy('status')
      .execute(),
    base.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirst(),
  ]);

  const titleCase = (value: string): string =>
    value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

  return {
    entities: entities.map((r) => ({ code: r.code, label: r.label, count: Number(r.count) })),
    departments: departments.map((r) => ({
      code: String(r.id),
      label: r.label,
      count: Number(r.count),
    })),
    categories: categories.map((r) => ({
      code: String(r.code),
      label: titleCase(String(r.code)),
      count: Number(r.count),
    })),
    locations: locations.map((r) => ({
      code: String(r.id),
      label: r.label,
      count: Number(r.count),
    })),
    statuses: statuses.map((r) => ({
      code: r.code,
      label: STATUS_LABELS[r.code] ?? titleCase(r.code),
      count: Number(r.count),
    })),
    total: Number(totalRow?.count ?? 0),
  };
}
