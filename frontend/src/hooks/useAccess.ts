import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { client } from '@/lib/orpc'

// What the logged-in employee may do, from accounts.me. The backend checks the same thing on every API call;
// here it only decides which pages, menus and buttons to show. Never compare role names - roles are data.
type Me = Awaited<ReturnType<typeof client.accounts.me>>
export type AccessArea = keyof Me['access']
export type AccessLevel = NonNullable<Me['access'][AccessArea]>

// READ = view only; WRITE = view + change (WRITE includes READ)
export function hasAccess(me: Pick<Me, 'access'> | undefined, area: AccessArea, level: AccessLevel = 'READ') {
  const have = me?.access[area]
  return have === 'WRITE' || (have === 'READ' && level === 'READ')
}

// Where a record is, as far as it is known: a company, a plant, a department (null = none) - a key left out is not checked
export type Where = { companyId?: number; plantId?: number; departmentId?: number | null }

// Whether the user's data access (accounts.me dataAccess, 2026-11-18) covers a record there in an area - e.g. which
// companies / plants / departments a form may offer. A department of null (none) is covered only by "all departments".
export function coversWhere(me: Pick<Me, 'dataAccess'> | undefined, area: AccessArea, level: AccessLevel, where: Where) {
  const slices = me?.dataAccess[area]?.[level]
  if (!slices) return false
  if (slices === 'ALL') return true
  return slices.some(
    (s) =>
      (where.companyId === undefined || s.companyId === null || s.companyId === where.companyId) &&
      (where.plantId === undefined || s.plantId === null || s.plantId === where.plantId) &&
      (where.departmentId === undefined || s.departmentId === null || s.departmentId === where.departmentId),
  )
}

// Whether the user's data access covers EVERY record of a company - or of one plant of it: one row with all its plants
// (or that plant) and all departments. coversWhere answers "some of it" (e.g. a company with one plant allowed); this
// answers "all of it" - before a screen says "the whole company" about what the user sees (the Department heads tab).
export function coversWhole(me: Pick<Me, 'dataAccess'> | undefined, area: AccessArea, level: AccessLevel, where: { companyId: number; plantId?: number }) {
  const slices = me?.dataAccess[area]?.[level]
  if (!slices) return false
  if (slices === 'ALL') return true
  return slices.some(
    (s) =>
      (s.companyId === null || s.companyId === where.companyId) &&
      (s.plantId === null || (where.plantId !== undefined && s.plantId === where.plantId)) &&
      s.departmentId === null,
  )
}

// Whether the user has Edit in an area for EVERY company (one row: all companies, plants and departments) - what changing
// a list shared by every company needs (shifts, designations, joining task types, letter templates, roles...; the backend's
// assertGroupWide). Without it those pages are view only (B13, 2026-11-21: they offered buttons the backend refused).
export function coversGroup(me: Pick<Me, 'dataAccess'> | undefined, area: AccessArea) {
  const slices = me?.dataAccess[area]?.WRITE
  if (!slices) return false
  return slices === 'ALL' || slices.some((s) => s.companyId === null && s.plantId === null && s.departmentId === null)
}

export function useAccess() {
  const me = useCurrentUser()
  return {
    me: me.data,
    // false while accounts.me loads (pages already show then - RequireLogin): every `can` is false until then, so a
    // redirect or a choice that depends on the access must wait for `ready`
    ready: me.data !== undefined,
    can: (area: AccessArea, level: AccessLevel = 'READ') => hasAccess(me.data, area, level),
    // whose records: see coversWhere
    covers: (area: AccessArea, level: AccessLevel, where: Where) => coversWhere(me.data, area, level, where),
    // all the records of a company / plant: see coversWhole
    coversWhole: (area: AccessArea, level: AccessLevel, where: { companyId: number; plantId?: number }) => coversWhole(me.data, area, level, where),
    // Edit for every company - changing a list shared by every company: see coversGroup
    coversGroup: (area: AccessArea) => coversGroup(me.data, area),
  }
}
