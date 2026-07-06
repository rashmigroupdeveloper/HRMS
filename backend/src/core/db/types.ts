/**
 * Kysely database interface — the single source of table types for queries.
 * Grows in lock-step with migrations; a column here without a migration (or
 * vice versa) is a bug.
 */
import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

/** core.users — auth accounts (docs/03 §1). */
export interface UsersTable {
  id: Generated<number>;
  employee_id: number | null;
  email: string;
  password_hash: string;
  is_active: Generated<boolean>;
  last_login_at: Timestamp | null;
  failed_attempts: Generated<number>;
  locked_until: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.roles — role catalog (docs/08 §1). */
export interface RolesTable {
  id: Generated<number>;
  code: string;
  name: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.permissions — module.action grid (CORE-10). */
export interface PermissionsTable {
  id: Generated<number>;
  code: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface RolePermissionsTable {
  id: Generated<number>;
  role_id: number;
  permission_id: number;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface UserRolesTable {
  id: Generated<number>;
  user_id: number;
  role_id: number;
  scope_org_unit_id: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

/** core.audit_log — append-only, hash-chained (CORE-11, doc 14 §7.4). INSERT only. */
export interface AuditLogTable {
  id: Generated<number>;
  actor_user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  ip: string | null;
  at: Generated<Timestamp>;
  /** Set by the DB trigger — never write from the app. */
  prev_hash: Generated<string>;
  /** Set by the DB trigger — never write from the app. */
  row_hash: Generated<string>;
}

/** core.settings — typed policy store; nothing policy-like is hardcoded (docs/04 §8). */
export interface SettingsTable {
  key: string;
  value: unknown;
  value_type: 'number' | 'string' | 'boolean' | 'json';
  description: string;
  updated_by: number | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface Database {
  'core.users': UsersTable;
  'core.roles': RolesTable;
  'core.permissions': PermissionsTable;
  'core.role_permissions': RolePermissionsTable;
  'core.user_roles': UserRolesTable;
  'core.audit_log': AuditLogTable;
  'core.settings': SettingsTable;
}
