import { ORPCError } from '@orpc/server'
import { AccessArea, type AccessLevel } from '../db/prisma.js'

// What a logged-in employee may do: the level they have per area (missing = no access).
// On authenticated requests, built from the active role; an active super admin has WRITE on every area.
export type AccessMap = Partial<Record<AccessArea, AccessLevel>>

export const ACCESS_AREAS = Object.values(AccessArea)

// WRITE includes READ
const RANK: Record<AccessLevel, number> = { READ: 1, WRITE: 2 }

export function hasAccess(access: AccessMap, area: AccessArea, level: AccessLevel): boolean {
  const have = access[area]
  return have !== undefined && RANK[have] >= RANK[level]
}

// The higher of two levels (undefined = none)
export function higherLevel(a: AccessLevel | undefined, b: AccessLevel | undefined): AccessLevel | undefined {
  if (!a) return b
  if (!b) return a
  return RANK[a] >= RANK[b] ? a : b
}

// Every area at WRITE - the super admin's access, including areas added later
export function fullAccess(): AccessMap {
  return Object.fromEntries(ACCESS_AREAS.map((area) => [area, 'WRITE'])) as AccessMap
}

// Throws 403 unless `access` has at least this level in this area (for checks inside services that depend on input)
export function assertAccess(access: AccessMap, area: AccessArea, level: AccessLevel) {
  if (!hasAccess(access, area, level)) throw new ORPCError('FORBIDDEN', { message: 'You do not have access to this' })
}
