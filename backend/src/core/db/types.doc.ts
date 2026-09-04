/**
 * `doc` schema types — document vault catalog (Phase 5 Stage 5.4 · DOC-01).
 * Vault file bytes stay in `core.documents`; this catalog only describes kinds.
 */
import type { ColumnType, Generated } from 'kysely';

type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

/** doc.types — which document kinds exist, and whether they expire / are mandatory. */
export interface DocTypesTable {
  code: string;
  name: string;
  typically_expires: Generated<boolean>;
  retention_class: string | null;
  /** Comma-separated employment categories; empty = never mandatory by category. */
  mandatory_for: Generated<string>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}
