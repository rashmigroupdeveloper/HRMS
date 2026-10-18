export interface BulkIssue { rowNumber: number; column: string | null; severity: 'error' | 'warning'; message: string }
export interface BulkJob {
  jobId: number; importer: string; filename: string; status: string; sheet: string | null; layout: string | null;
  totalRows: number; validRows: number; errorRows: number; warningRows: number; processedRows: number;
  fileIssues: string[]; duplicateOfJobId: number | null; issues: BulkIssue[];
  preview: { rowNumber: number; values: Record<string, unknown>; status: 'ok' | 'warning' | 'error' }[];
  result: { created: number; updated: number; skipped: number; notes?: string[] } | null;
  error: string | null; createdAt: string; committedAt: string | null;
}
export interface BulkImporterInfo {
  key: string; title: string; description: string; permission: string;
  contextFields: { key: string; label: string; type: string }[];
  instructions: string[];
  columns: { key: string; header: string; required: boolean; type: string; help: string; options?: string[] }[];
}
