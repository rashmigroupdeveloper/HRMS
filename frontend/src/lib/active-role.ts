// Each browser tab chooses independently. The server validates the role against the current account on every call.
const KEY = 'hrms.activeRole'

export const readActiveRole = () => window.sessionStorage.getItem(KEY) ?? undefined
export function writeActiveRole(roleId: number | null) {
  if (roleId === null) window.sessionStorage.removeItem(KEY)
  else window.sessionStorage.setItem(KEY, String(roleId))
}
