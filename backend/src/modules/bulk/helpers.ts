/** Shared lookups for importers: employees by e-code (scope-aware), companies, money. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';
import type { BulkRow, Cell } from '../../core/bulk/index.js';

export interface ResolvedEmployee {
  id: number;
  ecode: string;
  companyId: number;
  orgUnitId: number | null;
  status: string;
  inScope: boolean;
}

export function str(value: Cell | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function num(value: Cell | undefined): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function opt(value: Cell | undefined): string | null {
  const s = str(value);
  return s === '' ? null : s;
}

export function hasRowError(row: BulkRow): boolean {
  return row.issues.some((i) => i.severity === 'error');
}

export function rowError(row: BulkRow, column: string | null, message: string): void {
  row.issues.push({ column, severity: 'error', message });
}

export function rowWarning(row: BulkRow, column: string | null, message: string): void {
  row.issues.push({ column, severity: 'warning', message });
}

async function resolveEmployees(db: Kysely<Database>, scope: EmployeeScope, ecodes: readonly string[]): Promise<Map<string, ResolvedEmployee>> {
  const codes = [...new Set(ecodes.map((c) => c.trim().toUpperCase()).filter((c) => c !== ''))];
  const out = new Map<string, ResolvedEmployee>();
  for (let i = 0; i < codes.length; i += 5000) {
    const chunk = codes.slice(i, i + 5000);
    const rows = await db.selectFrom('core.employees as e')
      .select(['e.id', 'e.ecode', 'e.company_id', 'e.org_unit_id', 'e.status', employeeScopeSql(scope, 'e').as('in_scope')])
      .where(sql<string>`upper(e.ecode)`, 'in', chunk)
      .execute();
    for (const r of rows) {
      out.set(r.ecode.toUpperCase(), { id: r.id, ecode: r.ecode, companyId: r.company_id, orgUnitId: r.org_unit_id, status: r.status, inScope: r.in_scope });
    }
  }
  return out;
}

/**
 * Resolves the e-code column of every row: unknown or out-of-scope codes are
 * row errors (same wording, so scope never leaks existence); optional company
 * pinning catches cross-entity rows. Stores the id in values.employee_id.
 */
export async function attachEmployees(
  db: Kysely<Database>,
  scope: EmployeeScope,
  rows: BulkRow[],
  opts: { column?: string; header?: string; companyId?: number | null; allowExited?: boolean } = {},
): Promise<Map<string, ResolvedEmployee>> {
  const column = opts.column ?? 'ecode';
  const header = opts.header ?? 'Employee code';
  const map = await resolveEmployees(db, scope, rows.map((r) => str(r.values[column])));
  for (const row of rows) {
    const code = str(row.values[column]).toUpperCase();
    if (code === '') continue;
    const emp = map.get(code);
    if (!emp?.inScope) { rowError(row, header, `No employee ${code} in your data scope`); continue; }
    if (opts.companyId !== undefined && opts.companyId !== null && emp.companyId !== opts.companyId) {
      rowError(row, header, `${code} belongs to another company`);
      continue;
    }
    if (!opts.allowExited && emp.status === 'exited') rowWarning(row, header, `${code} has exited`);
    row.values[column] = emp.ecode;
    row.values['employee_id'] = emp.id;
  }
  return map;
}

export async function companyCodes(db: Kysely<Database>): Promise<string[]> {
  return (await db.selectFrom('core.companies').select('code').orderBy('code').execute()).map((c) => c.code);
}
