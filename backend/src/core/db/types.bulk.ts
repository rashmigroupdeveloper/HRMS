/** core.bulk_jobs — CSV/Excel bulk import jobs (migration 1752500000000). */
import type { ColumnType, Generated } from 'kysely';

type Stamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface CoreBulkJobsTable {
  id: Generated<number>;
  importer: string;
  context: ColumnType<unknown, string | undefined, string>;
  context_key: string;
  company_id: number | null;
  filename: string;
  file_sha256: string;
  status: Generated<'previewed' | 'committing' | 'committed' | 'failed' | 'discarded'>;
  total_rows: Generated<number>;
  error_rows: Generated<number>;
  warning_rows: Generated<number>;
  processed_rows: Generated<number>;
  rows: ColumnType<unknown, string | undefined, string>;
  report: ColumnType<unknown, string | undefined, string>;
  result: ColumnType<unknown, string | null | undefined, string | null>;
  error: string | null;
  created_by: number;
  created_at: Generated<Date>;
  committed_by: number | null;
  committed_at: Stamp | null;
  updated_at: Generated<Date>;
}

/** core.department_heads — designated HODs per department (migration 1752500000300). */
export interface CoreDepartmentHeadsTable {
  id: Generated<number>;
  department_id: number;
  company_id: number | null;
  employee_id: number;
  created_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}
