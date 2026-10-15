/**
 * Stage 2.0 org spine types (ORG-01..08).
 */
import type { ColumnType, Generated } from 'kysely';

type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface CorePlantsTable {
  id: Generated<number>;
  company_id: number;
  plant_code: string;
  name: string;
  location_id: number | null;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface CoreMisCodesTable {
  id: Generated<number>;
  company_id: number;
  code: string;
  name: string;
  parent_id: number | null;
  is_active: Generated<boolean>;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface PayGlAccountsTable {
  id: Generated<number>;
  company_code: string;
  plant_code: string;
  cost_center_code: string;
  component_code: string;
  gl_code: string;
  created_at: DefaultedTimestamp;
}
