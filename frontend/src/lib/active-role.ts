// Each browser tab chooses independently. The server validates the role against the current account on every call.
// No role stored = Employee self-service, where everyone starts (2026-11-25); picking a role opens the role portal.
const KEY = 'hrms.activeRole'

// The switcher's choice for Employee self-service (role ids start at 1), and its name
export const SELF_SERVICE = 0
export const SELF_SERVICE_NAME = 'Employee self-service'

export const readActiveRole = () => window.sessionStorage.getItem(KEY) ?? undefined
export function writeActiveRole(roleId: number | null) {
  if (roleId === null) window.sessionStorage.removeItem(KEY)
  else window.sessionStorage.setItem(KEY, String(roleId))
}

// The two portals and their addresses (the user, 2026-11-25): /ess/... is Employee self-service, /manage/... the role
// portal - named after neither a role nor "admin", as a role can be called anything
export type Portal = 'ess' | 'manage'
export const portalOf = (activeRoleId: number | null | undefined): Portal => (activeRoleId == null ? 'ess' : 'manage')
// the portal of this tab before accounts.me answers - from the stored choice (the server may still refuse a stale role)
export const storedPortal = (): Portal => (readActiveRole() === undefined ? 'ess' : 'manage')
