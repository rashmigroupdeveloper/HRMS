/** CORE-10/11: Super Admin delegates configuration domains through runtime RBAC. */
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { getUserPermissionAccess } from '../../core/rbac/permissions.service.js';

const TECHNICAL = [/^auth\./, /^sec\./, /^att\.device_/, /^att\.quarantine_/];
const PAYROLL = [/^pay\./, /^loans\./, /^tax\./];
const HR = [/^att\./, /^lv\./, /^lifecycle\./, /^probation\./, /^wf\./, /^reporting\./];
const CONFIG_PERMISSIONS = ['payroll.config.manage', 'hr.config.manage', 'system.config.manage'] as const;

/** Configuration keys are group-wide; an entity-bound or read-only grant cannot edit them. */
export async function settingWritePermissions(db: Kysely<Database>, userId: number): Promise<ReadonlySet<string>> {
  const access = await Promise.all(CONFIG_PERMISSIONS.map(async permission => ({
    permission, access: await getUserPermissionAccess(db, userId, permission, 'write'),
  })));
  return new Set(access.filter(entry => entry.access?.all).map(entry => entry.permission));
}

export function settingOwners(key: string): readonly string[] {
  if (TECHNICAL.some(pattern => pattern.test(key))) return ['system.config.manage'];
  if (PAYROLL.some(pattern => pattern.test(key))) return ['payroll.config.manage'];
  if (HR.some(pattern => pattern.test(key))) return ['hr.config.manage'];
  return ['system.config.manage'];
}

export function canEditSetting(permissions: ReadonlySet<string>, key: string): boolean {
  return settingOwners(key).some(permission => permissions.has(permission));
}
