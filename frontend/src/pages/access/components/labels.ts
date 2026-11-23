import type { Tone } from '@/components/Pill'
import type { AccessLevel } from '@/hooks/useAccess'
import type { client } from '@/lib/orpc'

// Types of the roles page, taken from the API (never written by hand).
type RolesList = Awaited<ReturnType<typeof client.accounts.roles.list>>
export type Role = RolesList['roles'][number]
export type AreaInfo = RolesList['areas'][number]
export type RoleAccess = Role['access']
export type Account = Awaited<ReturnType<typeof client.accounts.list>>[number]

// What the three choices per area are called on screen
export const LEVEL_LABEL: Record<AccessLevel | 'NONE', string> = { NONE: 'No access', READ: 'View', WRITE: 'Edit' }
export const LEVEL_TONE: Record<AccessLevel | 'NONE', Tone> = { NONE: 'neutral', READ: 'info', WRITE: 'positive' }

// A role's data access in a few words: "RML · 1104 RML 6 (Edit)", "All companies", "3 slices"
export function describeDataAccess(rows: Account['roles'][number]['dataAccess'], isSuperAdmin: boolean) {
  if (isSuperAdmin) return 'Everything'
  if (rows.length === 0) return 'No data access'
  if (rows.length > 1) return `${rows.length} slices`
  const row = rows[0]!
  const where = [row.company ?? 'All companies', row.plant, row.department].filter(Boolean).join(' · ')
  return `${where} (${LEVEL_LABEL[row.level]})`
}

export const ACCOUNT_STATUS: Record<Account['status'], { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'positive' },
  ON_NOTICE: { label: 'On notice', tone: 'warning' },
  EXITED: { label: 'Exited - cannot log in', tone: 'negative' },
}
