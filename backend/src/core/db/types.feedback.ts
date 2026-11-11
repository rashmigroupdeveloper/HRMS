import type { ColumnType, Generated } from 'kysely';
export interface BetaFeedbackTable {
  id: Generated<number>;
  request_id: string;
  user_id: number;
  employee_code: string | null;
  user_name: string;
  role_codes: ColumnType<string[], string, string>;
  page_path: string;
  page_title: string;
  body: string;
  screenshot_document_id: number | null;
  status: Generated<'new' | 'resolved'>;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Generated<Date>;
}
