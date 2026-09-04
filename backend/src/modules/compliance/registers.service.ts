/**
 * Stage 5.6 stub — statutory register catalog + honest header-only / blocked
 * previews (CMP-08..14). No invented wages, PF/ESIC rates, or attendance days.
 *
 * Header-only forms can list ecode / name / doj from the employee master.
 * Anything that needs payable days, rates or deductions stays blocked until
 * Stage 2 payroll compute (P0-T06 / Stage 2.2).
 */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate } from '../../core/dates.js';

export const REGISTER_CODES = ['form_12', 'form_15', 'form_22', 'muster', 'wage'] as const;
export type RegisterCode = (typeof REGISTER_CODES)[number];

export type RegisterAvailability = 'available' | 'pending_payroll';

export interface RegisterCatalogEntry {
  code: RegisterCode;
  name: string;
  requirementId: string;
  status: RegisterAvailability;
  /** Named dependency when status is pending_payroll; null when available. */
  dependency: string | null;
}

/** Exact blocked reason for wage-dependent previews — do not paraphrase. */
export const PAYROLL_BLOCK_REASON =
  'Needs Stage 2 payroll compute (P0-T06 / Stage 2.2)' as const;

/**
 * form_12 / muster: header columns exist on the employee master today.
 * form_15 / form_22 / wage: need leave-with-wages, attendance payable days,
 * or wage columns that Stage 2 has not produced yet.
 */
export const REGISTER_CATALOG: readonly RegisterCatalogEntry[] = [
  {
    code: 'form_12',
    name: 'Form 12 — Register of Adult Workers',
    requirementId: 'CMP-09',
    status: 'available',
    dependency: null,
  },
  {
    code: 'form_15',
    name: 'Form 15 — Register of Leave with Wages',
    requirementId: 'CMP-10',
    status: 'pending_payroll',
    dependency: PAYROLL_BLOCK_REASON,
  },
  {
    code: 'form_22',
    name: 'Form 22 — Muster Roll cum Register of Wages',
    requirementId: 'CMP-11',
    status: 'pending_payroll',
    dependency: PAYROLL_BLOCK_REASON,
  },
  {
    code: 'muster',
    name: 'Muster roll (header)',
    requirementId: 'CMP-08',
    status: 'available',
    dependency: null,
  },
  {
    code: 'wage',
    name: 'Wage register',
    requirementId: 'CMP-11',
    status: 'pending_payroll',
    dependency: PAYROLL_BLOCK_REASON,
  },
] as const;

export interface HeaderRow {
  ecode: string;
  name: string;
  doj: string | null;
}

export type RegisterPreview =
  | {
      status: 'ok';
      code: RegisterCode;
      mode: 'header_only';
      columns: ['ecode', 'name', 'doj'];
      rows: HeaderRow[];
    }
  | {
      status: 'blocked';
      code: RegisterCode;
      reason: typeof PAYROLL_BLOCK_REASON;
    };

const HEADER_COLUMNS: ['ecode', 'name', 'doj'] = ['ecode', 'name', 'doj'];

function isRegisterCode(value: string): value is RegisterCode {
  return (REGISTER_CODES as readonly string[]).includes(value);
}

function catalogEntry(code: string): RegisterCatalogEntry | null {
  if (!isRegisterCode(code)) return null;
  return REGISTER_CATALOG.find((row) => row.code === code) ?? null;
}

export function listRegisterCatalog(): RegisterCatalogEntry[] {
  return [...REGISTER_CATALOG];
}

function displayName(first: string, last: string | null): string {
  return last !== null && last !== '' ? `${first} ${last}` : first;
}

function isoDate(value: Date | null): string | null {
  if (value === null) return null;
  // Local getters, not toISOString — a DATE column is local midnight.
  return formatDbDate(value);
}

/** Header-only rows from employee master — never invents wages or days. */
async function headerRowsForCompany(
  db: Kysely<Database>,
  companyId: number,
): Promise<HeaderRow[]> {
  const rows = await db
    .selectFrom('core.employees')
    .select(['ecode', 'first_name', 'last_name', 'doj'])
    .where('company_id', '=', companyId)
    .where('status', 'in', ['active', 'on_notice', 'onboarding'])
    .orderBy('ecode')
    .execute();

  return rows.map((row) => ({
    ecode: row.ecode,
    name: displayName(row.first_name, row.last_name),
    doj: isoDate(row.doj),
  }));
}

export async function previewRegister(
  db: Kysely<Database>,
  input: { code: string; companyId: number },
): Promise<RegisterPreview | { status: 'unknown_code' }> {
  const entry = catalogEntry(input.code);
  if (entry === null) return { status: 'unknown_code' };

  if (entry.status === 'pending_payroll') {
    return {
      status: 'blocked',
      code: entry.code,
      reason: PAYROLL_BLOCK_REASON,
    };
  }

  const rows = await headerRowsForCompany(db, input.companyId);
  return {
    status: 'ok',
    code: entry.code,
    mode: 'header_only',
    columns: HEADER_COLUMNS,
    rows,
  };
}
