/**
 * Bulk import contracts (CSV + Excel). Every bulk upload in the product —
 * payroll inputs, salaries, employees, punches, leave, loans, statutory
 * tables, holidays, assets, F&F — is an importer behind ONE engine, so the
 * template, preview report, all-or-nothing commit, duplicate detection,
 * idempotent re-upload, limits, background progress and audit behave the
 * same everywhere.
 */
import type { Kysely, Transaction } from 'kysely';
import type { z } from 'zod';
import type { Database } from '../db/types.js';
import type { EmployeeScope } from '../rbac/employee-scope.js';

export type Cell = string | number | boolean | null;

export type BulkColumnType = 'string' | 'integer' | 'number' | 'money' | 'date' | 'datetime' | 'enum' | 'boolean';

export interface BulkColumn {
  key: string;
  header: string;
  /** Other header spellings accepted on upload (case/space/punctuation-insensitive). */
  aliases?: readonly string[];
  type: BulkColumnType;
  required?: boolean;
  /** enum: allowed values (become an in-cell dropdown in the template). */
  options?: readonly string[];
  min?: number;
  max?: number;
  maxLength?: number;
  help: string;
}

export interface RowIssue {
  column: string | null;
  severity: 'error' | 'warning';
  message: string;
}

/** A data row after header mapping and type coercion. */
export interface BulkRow {
  rowNumber: number;
  values: Record<string, Cell>;
  issues: RowIssue[];
}

export interface ImportActor {
  userId: number;
  scope: EmployeeScope;
  ip: string | null;
}

export interface ImportRun<C> {
  db: Kysely<Database>;
  context: C;
  actor: ImportActor;
}

export interface CommitResult {
  created: number;
  updated: number;
  skipped: number;
  notes?: string[];
}

/** Maps an alternative sheet layout (e.g. the client's Report 4) onto importer rows. */
export interface AlternateLayout {
  name: string;
  /** Normalised headers of the candidate header row → true when this layout applies. */
  detect(headers: readonly string[]): boolean;
  /** One raw source row (by normalised header) → zero or more importer rows (by column key). */
  map(row: Readonly<Record<string, Cell>>): Record<string, Cell>[];
}

export interface BulkImporter<C = Record<string, unknown>> {
  key: string;
  title: string;
  description: string;
  /** Permission (write) required to template/preview/commit. */
  permission: string;
  contextSchema: z.ZodType<C>;
  /** Context fields the UI must collect before upload (labels only; validated by contextSchema). */
  contextFields: readonly { key: string; label: string; type: 'company' | 'run' | 'text' | 'date' | 'month' }[];
  columns: readonly BulkColumn[];
  instructions: readonly string[];
  samples: readonly Record<string, Cell>[];
  layouts?: readonly AlternateLayout[];
  /** Live dropdown values (component codes, leave types, companies) for template + validation. */
  dynamicOptions?(db: Kysely<Database>): Promise<Record<string, readonly string[]>>;
  /** Duplicate key within one file; later duplicates are errors. */
  rowKey?(values: Readonly<Record<string, Cell>>): string;
  /** Idempotency partition: the same file under the same key is applied once. */
  contextKey(context: C): string;
  /** Entity check for the context (throws Forbidden when outside scope). Returns the company, if any. */
  authorize(run: ImportRun<C>): Promise<number | null>;
  /** Domain validation; push issues onto rows and may enrich values (resolved ids). */
  validate(run: ImportRun<C>, rows: BulkRow[]): Promise<void>;
  /** Applies every row inside the caller's transaction. Throw to roll everything back. */
  commit(
    run: ImportRun<C> & { trx: Transaction<Database> },
    rows: readonly BulkRow[],
    progress: (processed: number) => Promise<void>,
  ): Promise<CommitResult>;
}
