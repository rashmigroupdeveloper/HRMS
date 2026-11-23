import { fullAccess, type AccessMap } from '#core/auth/access'
import type { RoleGrant, ScopeRow } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'

// A logged-in user for calling services directly - its access and data access are given here, not read from a login.
// The password counts as re-entered (changing roles needs it).
export function userWith(employee: { id: number; employeeCode: string }, grants: RoleGrant[], options: { isSuperAdmin?: boolean } = {}): CurrentUser {
  const access: AccessMap = options.isSuperAdmin ? fullAccess() : {}
  for (const grant of grants) {
    for (const [area, level] of Object.entries(grant.access) as [keyof AccessMap, NonNullable<AccessMap[keyof AccessMap]>][]) {
      if (access[area] !== 'WRITE') access[area] = level
    }
  }
  return {
    sessionId: -1,
    // not a real login: never the same as the account being changed
    accountId: -1,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.employeeCode,
    roles: [],
    isSuperAdmin: options.isSuperAdmin ?? false,
    access,
    grants,
    mustChangePassword: false,
    passwordConfirmedUntil: new Date(Date.now() + 10 * 60_000),
  }
}

// A data-access row (null = every company / plant / department)
export const row = (companyId: number | null, plantId: number | null, departmentId: number | null, level: ScopeRow['level'] = 'WRITE'): ScopeRow => ({
  companyId,
  plantId,
  departmentId,
  level,
})
