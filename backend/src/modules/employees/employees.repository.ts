/**
 * Employee directory / profile reads (P0-T33, docs/05 §4.2).
 * All DB access for the employees read API lives here.
 */
import { sql, type Kysely, type ExpressionBuilder } from 'kysely';
import type { Database, EmployeeStatus, EmploymentCategory } from '../../core/db/types.js';
import { emptyOrgScope } from '../../core/org/scope.js';
import { orgScopeWhere } from '../org/index.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';

export interface DirectoryFilters {
  q?: string | undefined;
  companyCode?: string | undefined;
  status?: EmployeeStatus | undefined;
  /**
   * docs/05 §4.2 filter set: entity · plant · dept · category · status · RM.
   * These are LISTS because the filter drawer offers multi-select checkboxes —
   * a single-valued filter would silently ignore a second selection.
   */
  companyCodes?: string[] | undefined;
  statuses?: EmployeeStatus[] | undefined;
  departmentIds?: number[] | undefined;
  locationIds?: number[] | undefined;
  categories?: EmploymentCategory[] | undefined;
  reportingManagerId?: number | undefined;
  /** ORG-05 — plant / MIS / cost-centre slices (empty = no extra predicate). */
  plantCode?: string[] | undefined;
  misCode?: string[] | undefined;
  costCenterCode?: string[] | undefined;
  activeOnly: boolean;
  limit: number;
  offset: number;
}

function directoryOrgScope(filters: DirectoryFilters) {
  const scope = emptyOrgScope();
  scope.plantCode = filters.plantCode ?? [];
  scope.misCode = filters.misCode ?? [];
  scope.costCenterCode = filters.costCenterCode ?? [];
  return scope;
}

export interface DirectoryRow {
  id: number;
  ecode: string;
  first_name: string;
  last_name: string | null;
  status: EmployeeStatus;
  confirmation_date: Date | null;
  company_code: string;
  company_name: string;
  designation: string | null;
  department: string | null;
}

export interface EmployeeProfileRow {
  id: number;
  ecode: string;
  first_name: string;
  last_name: string | null;
  photo_path: string | null;
  gender: string | null;
  dob: Date | null;
  marital_status: string | null;
  blood_group: string | null;
  personal_email: string | null;
  work_email: string | null;
  mobile: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  present_address: string | null;
  permanent_address: string | null;
  category: string | null;
  contract_type: string | null;
  doj: Date | null;
  dol: Date | null;
  status: EmployeeStatus;
  exit_reason: string | null;
  confirmation_date: Date | null;
  probation_due_date: Date | null;
  pan: string | null;
  aadhaar: string | null;
  uan: string | null;
  pf_number: string | null;
  esic_ip_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  payment_mode: string;
  company_code: string;
  company_name: string;
  designation: string | null;
  department: string | null;
  location_name: string | null;
  grade_name: string | null;
  reporting_manager_ecode: string | null;
  reporting_manager_name: string | null;
}

type DirEB = ExpressionBuilder<
  Database & {
    e: Database['core.employees'];
    c: Database['core.companies'];
    d: Database['core.designations'];
    dep: Database['core.departments'];
  },
  'e' | 'c' | 'd' | 'dep'
>;

function applyFilters(eb: DirEB, filters: DirectoryFilters) {
  const parts = [];
  if (filters.activeOnly) {
    parts.push(eb('e.status', 'in', ['onboarding', 'active', 'on_notice']));
  }
  if (filters.status !== undefined) {
    parts.push(eb('e.status', '=', filters.status));
  }
  if (filters.companyCode !== undefined && filters.companyCode !== '') {
    parts.push(eb('c.code', '=', filters.companyCode));
  }
  if (filters.companyCodes !== undefined && filters.companyCodes.length > 0) {
    parts.push(eb('c.code', 'in', filters.companyCodes));
  }
  if (filters.statuses !== undefined && filters.statuses.length > 0) {
    parts.push(eb('e.status', 'in', filters.statuses));
  }
  if (filters.departmentIds !== undefined && filters.departmentIds.length > 0) {
    parts.push(eb('e.department_id', 'in', filters.departmentIds));
  }
  if (filters.locationIds !== undefined && filters.locationIds.length > 0) {
    parts.push(eb('e.location_id', 'in', filters.locationIds));
  }
  if (filters.categories !== undefined && filters.categories.length > 0) {
    parts.push(eb('e.category', 'in', filters.categories));
  }
  if (filters.reportingManagerId !== undefined) {
    parts.push(eb('e.reporting_manager_id', '=', filters.reportingManagerId));
  }
  if (filters.q !== undefined && filters.q.trim() !== '') {
    const term = `%${filters.q.trim()}%`;
    parts.push(
      eb.or([
        eb('e.ecode', 'ilike', term),
        eb('e.first_name', 'ilike', term),
        eb('e.last_name', 'ilike', term),
        eb('e.work_email', 'ilike', term),
      ]),
    );
  }
  return parts.length === 0 ? eb.val(true) : eb.and(parts);
}

export async function countDirectory(
  db: Kysely<Database>,
  filters: DirectoryFilters,
  scope: EmployeeScope,
): Promise<number> {
  const row = await db
    .selectFrom('core.employees as e')
    .innerJoin('core.companies as c', 'c.id', 'e.company_id')
    .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where((eb) => applyFilters(eb as unknown as DirEB, filters))
    .where(orgScopeWhere(directoryOrgScope(filters), 'e'))
    // The caller's RBAC scope, applied to the COUNT as well as the page — a
    // total that includes rows the caller may not see is itself a disclosure.
    .where(employeeScopeSql(scope, 'e'))
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

export async function listDirectory(
  db: Kysely<Database>,
  filters: DirectoryFilters,
  scope: EmployeeScope,
): Promise<DirectoryRow[]> {
  return db
    .selectFrom('core.employees as e')
    .innerJoin('core.companies as c', 'c.id', 'e.company_id')
    .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .select([
      'e.id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'e.status',
      'e.confirmation_date',
      'c.code as company_code',
      'c.name as company_name',
      'd.name as designation',
      'dep.name as department',
    ])
    .where((eb) => applyFilters(eb as unknown as DirEB, filters))
    .where(orgScopeWhere(directoryOrgScope(filters), 'e'))
    .where(employeeScopeSql(scope, 'e'))
    .orderBy('e.ecode', 'asc')
    .limit(filters.limit)
    .offset(filters.offset)
    .execute();
}

/**
 * Shared profile SELECT — the full identity/job/statutory projection used by
 * both the by-ecode lookup (directory) and the by-id lookup (self-service).
 * Callers append the `where` that scopes it to one employee.
 */
function selectProfile(db: Kysely<Database>) {
  return db
    .selectFrom('core.employees as e')
    .innerJoin('core.companies as c', 'c.id', 'e.company_id')
    .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .leftJoin('core.locations as loc', 'loc.id', 'e.location_id')
    .leftJoin('core.grades as g', 'g.id', 'e.grade_id')
    .leftJoin('core.employees as rm', 'rm.id', 'e.reporting_manager_id')
    .select([
      'e.id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'e.photo_path',
      'e.gender',
      'e.dob',
      'e.marital_status',
      'e.blood_group',
      'e.personal_email',
      'e.work_email',
      'e.mobile',
      'e.emergency_contact_name',
      'e.emergency_contact_phone',
      'e.present_address',
      'e.permanent_address',
      'e.category',
      'e.contract_type',
      'e.doj',
      'e.dol',
      'e.status',
      'e.exit_reason',
      'e.confirmation_date',
      'e.probation_due_date',
      'e.pan',
      'e.aadhaar',
      'e.uan',
      'e.pf_number',
      'e.esic_ip_number',
      'e.bank_name',
      'e.bank_account',
      'e.bank_ifsc',
      'e.payment_mode',
      'c.code as company_code',
      'c.name as company_name',
      'd.name as designation',
      'dep.name as department',
      'loc.name as location_name',
      'g.name as grade_name',
      'rm.ecode as reporting_manager_ecode',
    ])
    .select(
      sql<string | null>`nullif(trim(concat_ws(' ', rm.first_name, rm.last_name)), '')`.as(
        'reporting_manager_name',
      ),
    );
}

/**
 * Profile by e-code, narrowed to the caller's scope. Out of scope resolves to
 * `undefined` and the router answers 404 — not 403, which would confirm that
 * the e-code exists and turn this endpoint into an existence oracle.
 */
export async function findByEcode(
  db: Kysely<Database>,
  ecode: string,
  scope: EmployeeScope,
): Promise<EmployeeProfileRow | undefined> {
  return selectProfile(db)
    .where('e.ecode', '=', ecode)
    .where(employeeScopeSql(scope, 'e'))
    .executeTakeFirst();
}

/**
 * Profile by internal id — the self-service (`/employees/me`) path ONLY.
 * Deliberately unscoped because the id is the caller's own `user.employee_id`,
 * never client input. Do not call it with anything else.
 */
export async function findById(
  db: Kysely<Database>,
  id: number,
): Promise<EmployeeProfileRow | undefined> {
  return selectProfile(db).where('e.id', '=', id).executeTakeFirst();
}
