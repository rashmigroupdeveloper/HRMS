import { ORPCError } from '@orpc/server'
import type { AccessArea, AccessLevel } from '../db/prisma.js'
import type { AccessMap } from './access.js'

// DATA ACCESS (agreed with the user 2026-11-18): a role says WHAT someone may do (a level per area); the data access of
// that role, given to that person, says WHOSE records - slices of the group (company -> plant -> department) at View or
// Edit. This file is the only place that works it out; repositories take the DataScope it makes, so no list can forget it.
//
// - A slice: a company (null = every company), a plant of it (null = every plant), a department (null = every
//   department). An employee without a department is covered only by slices for every department.
// - For an area, the level for a record = the best, over the person's roles that give the area, of the lower of the
//   role's level and the best of that role's rows covering the record. No rows = nothing.
// - A Super Admin has everything - decided here and nowhere else.
// - Own record, reporting tree and HOD department are worked out by the services on top of this - never stored as rows.

// A slice of the group - null = every company / plant / department
export type Slice = { companyId: number | null; plantId: number | null; departmentId: number | null }
// One data-access row of a role given to a person
export type ScopeRow = Slice & { level: AccessLevel }
// A role given to a person: the role's level per area, and its data-access rows
export type RoleGrant = { access: AccessMap; rows: ScopeRow[] }
// Whose access is checked (the logged-in user)
export type ScopedViewer = { isSuperAdmin: boolean; grants: RoleGrant[] }
// Where a record is: an employee's / candidate's company, plant and department
export type Placement = { companyId: number; plantId: number; departmentId: number | null }

// The whole group
export const ALL_OF_GROUP: Slice = { companyId: null, plantId: null, departmentId: null }

const RANK: Record<AccessLevel, number> = { READ: 1, WRITE: 2 }
const lower = (a: AccessLevel, b: AccessLevel) => (RANK[a] <= RANK[b] ? a : b)
const better = (a: AccessLevel | undefined, b: AccessLevel | undefined) => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b)
const atLeast = (have: AccessLevel | undefined, level: AccessLevel) => have !== undefined && RANK[have] >= RANK[level]

// Whether the slice covers a record at this placement
export function sliceCovers(slice: Slice, placement: Placement) {
  return (
    (slice.companyId === null || slice.companyId === placement.companyId) &&
    (slice.plantId === null || slice.plantId === placement.plantId) &&
    (slice.departmentId === null || slice.departmentId === placement.departmentId)
  )
}

// Whether slice `outer` covers every record slice `inner` covers ("every company" is inside only "every company")
export function sliceContains(outer: Slice, inner: Slice) {
  const within = (o: number | null, i: number | null) => o === null || o === i
  return within(outer.companyId, inner.companyId) && within(outer.plantId, inner.plantId) && within(outer.departmentId, inner.departmentId)
}

// The best level a role's rows give where `fits` holds
function rowLevel(rows: ScopeRow[], fits: (row: ScopeRow) => boolean) {
  return rows.reduce<AccessLevel | undefined>((best, row) => (fits(row) ? better(best, row.level) : best), undefined)
}

// The level of the viewer, in an area, over the records `fits` accepts (one record, or a whole slice)
function levelWhere(viewer: ScopedViewer, area: AccessArea, fits: (row: ScopeRow) => boolean) {
  if (viewer.isSuperAdmin) return 'WRITE' as const
  let best: AccessLevel | undefined
  for (const grant of viewer.grants) {
    const roleLevel = grant.access[area]
    const rows = roleLevel && rowLevel(grant.rows, fits)
    if (roleLevel && rows) best = better(best, lower(roleLevel, rows))
  }
  return best
}

// The level the viewer has in an area for a record at this placement (undefined = none)
export function levelAt(viewer: ScopedViewer, area: AccessArea, placement: Placement) {
  return levelWhere(viewer, area, (row) => sliceCovers(row, placement))
}

export function hasLevelAt(viewer: ScopedViewer, area: AccessArea, placement: Placement, level: AccessLevel) {
  return atLeast(levelAt(viewer, area, placement), level)
}

// The level the viewer has in an area over EVERY record of a slice (one row must cover it all) - for giving access and
// for things that belong to a company or to the whole group
export function levelOver(viewer: ScopedViewer, area: AccessArea, slice: Slice) {
  return levelWhere(viewer, area, (row) => sliceContains(row, slice))
}

// --- Filtering lists ---

declare const dataScopeBrand: unique symbol
// Which records a query may return. Made only by scopeOf (from the logged-in user) or SYSTEM_SCOPE (scripts, jobs);
// every repository read of employees or candidates requires one, so a list cannot leave it out.
export type DataScope = { readonly [dataScopeBrand]: true; readonly slices: readonly Slice[] | 'ALL' }

const makeScope = (slices: readonly Slice[] | 'ALL') => ({ slices }) as DataScope

// Everything - ONLY for scripts, background jobs and system steps with no logged-in person (never from a request)
export const SYSTEM_SCOPE: DataScope = makeScope('ALL')

// The records the viewer may see (READ) or change (WRITE) in an area
export function scopeOf(viewer: ScopedViewer, area: AccessArea, level: AccessLevel = 'READ'): DataScope {
  if (viewer.isSuperAdmin) return SYSTEM_SCOPE
  const slices: Slice[] = []
  for (const grant of viewer.grants) {
    if (!atLeast(grant.access[area], level)) continue
    for (const row of grant.rows) if (atLeast(row.level, level)) slices.push(row)
  }
  if (slices.some((slice) => sliceContains(slice, ALL_OF_GROUP))) return SYSTEM_SCOPE
  // (a slice inside another one adds nothing)
  const kept = slices.filter((slice, i) => !slices.some((other, j) => j !== i && sliceContains(other, slice) && (!sliceContains(slice, other) || j < i)))
  return makeScope(kept.map(({ companyId, plantId, departmentId }) => ({ companyId, plantId, departmentId })))
}

// Whether a record at this placement is inside the scope
export function scopeAllows(scope: DataScope, placement: Placement) {
  return scope.slices === 'ALL' || scope.slices.some((slice) => sliceCovers(slice, placement))
}

// The scope as a Prisma `where` on a model with id / companyId / plantId / departmentId (employees, candidates): {} =
// everything; nothing = `id in []` (Prisma treats an empty OR as no condition at all - tested in
// tests/data-access-employees.test.ts). Use it inside an AND list, never spread next to another OR.
export function scopeWhere(scope: DataScope): { OR?: { companyId?: number; plantId?: number; departmentId?: number }[]; id?: { in: number[] } } {
  if (scope.slices === 'ALL') return {}
  if (scope.slices.length === 0) return { id: { in: [] } }
  return {
    OR: scope.slices.map((slice) => ({
      ...(slice.companyId !== null && { companyId: slice.companyId }),
      ...(slice.plantId !== null && { plantId: slice.plantId }),
      ...(slice.departmentId !== null && { departmentId: slice.departmentId }),
    })),
  }
}

// --- Checks that throw ---

// Things shared by every company (shifts, master lists, roles, templates...) - changing them needs the area at Edit for
// the whole group (A4, 2026-11-18)
export function assertGroupWide(viewer: ScopedViewer, area: AccessArea, what: string) {
  if (levelOver(viewer, area, ALL_OF_GROUP) !== 'WRITE') {
    throw new ORPCError('FORBIDDEN', { message: `${what} is shared by every company - changing it needs Edit access for all companies` })
  }
}

// Things that belong to one company or plant (its details, its plants, a plant's departments, its holiday lists) - changing them
// needs the area at Edit for that whole company / plant (A4, 2026-11-18)
export function assertWholeSlice(viewer: ScopedViewer, area: AccessArea, slice: Slice, what: string) {
  if (levelOver(viewer, area, slice) !== 'WRITE') {
    throw new ORPCError('FORBIDDEN', { message: `${what} - changing it needs Edit access for the whole ${slice.plantId === null ? 'company' : 'plant'}` })
  }
}

// The areas of a role whose access over these rows goes beyond what the giver has (empty = the giver may give it)
export function beyondGiver(giver: ScopedViewer, access: AccessMap, rows: ScopeRow[]): AccessArea[] {
  if (giver.isSuperAdmin) return []
  const areas = Object.keys(access) as AccessArea[]
  return areas.filter((area) => {
    const roleLevel = access[area]
    return roleLevel !== undefined && rows.some((row) => !atLeast(levelOver(giver, area, row), lower(roleLevel, row.level)))
  })
}
