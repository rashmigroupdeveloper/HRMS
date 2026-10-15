/**
 * `cmp` schema types — statutory registrations, licences, compliance calendar
 * (Phase 5 Stage 5.7). Kept in its own file so the schema can grow without
 * every contributor editing the same 900-line `types.ts`.
 */
import type { ColumnType, Generated } from 'kysely';

/** A DB-defaulted timestamp that still SELECTs as a real `Date`. */
type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type DateOnly = ColumnType<Date, Date | string, Date | string>;

export type RegistrationKind =
  | 'pf'
  | 'esic'
  | 'pt'
  | 'lwf'
  | 'factory_licence'
  | 'clra_licence'
  | 'shops'
  | 'single_registration'
  | 'other';

/** cmp.registrations — what we are registered/licensed for, and until when. */
export interface CmpRegistrationsTable {
  id: Generated<number>;
  company_id: number;
  /** NULL = held at entity level (a PF code); set = belongs to one plant. */
  location_id: number | null;
  kind: RegistrationKind;
  registration_no: string;
  issuing_authority: string | null;
  valid_from: DateOnly;
  /** NULL = perpetual. Never measure a perpetual registration against a threshold. */
  valid_to: DateOnly | null;
  renewal_owner_user_id: number | null;
  document_path: string | null;
  notes: string | null;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export type CalendarFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'one_off';
/** Stored status only. `overdue` is derived from `due_on`, never persisted. */
export type CalendarStatus = 'due' | 'filed' | 'waived';

/** cmp.calendar_items — every recurring statutory obligation, with an owner. */
export interface CmpCalendarItemsTable {
  id: Generated<number>;
  company_id: number;
  obligation_code: string;
  title: string;
  frequency: CalendarFrequency;
  period_label: string;
  due_on: DateOnly;
  owner_user_id: number | null;
  status: Generated<CalendarStatus>;
  registration_id: number | null;
  filed_at: Timestamp | null;
  filed_by_user_id: number | null;
  waived_reason: string | null;
  waived_by_user_id: number | null;
  waived_at: Timestamp | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

/** cmp.filing_evidence — append-only proof that a filing actually happened. */
export interface CmpFilingEvidenceTable {
  id: Generated<number>;
  calendar_item_id: number;
  reference: string;
  document_path: string | null;
  remark: string | null;
  filed_by_user_id: number;
  recorded_at: DefaultedTimestamp;
}
