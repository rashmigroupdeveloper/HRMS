import { assertAccess, hasAccess } from '#core/auth/access'
import { hasLevelAt, type Placement, scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService, hodsService } from '#modules/employees'
import { ORPCError } from '@orpc/server'

// Leave as a whole (2026-11-22): whose leave the viewer may see - the same rules as attendance: one's own; a manager's
// reporting tree and an HOD's department (relationships, not data-access rows - view only); everyone else with Leave View
// covering where they are (data access).

const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }

export type Person = employeesService.LeavePerson
export const placementOf = (p: { companyId: number; plantId: number; departmentId: number | null }): Placement => ({ companyId: p.companyId, plantId: p.plantId, departmentId: p.departmentId })

// One employee by id, employed or not (null: none)
export async function findPerson(id: number) {
  const [person] = await employeesService.listLeavePeople({ scope: SYSTEM_SCOPE, ids: [id], ...EVER })
  return person ?? null
}

// The employee, if the viewer may see their leave: their own, someone in their reporting tree or whose HOD they are, or
// Leave View covering where they are - else "not found" (never reveal they exist)
export async function getVisiblePerson(viewer: CurrentUser, employeeCode: string) {
  const notFound = new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const id = (await employeesService.mapCodesToIds([employeeCode])).get(employeeCode.trim().toUpperCase())
  const person = id ? await findPerson(id) : null
  if (!person) throw notFound
  if (person.id !== viewer.employeeId && !hasLevelAt(viewer, 'LEAVE', placementOf(person), 'READ')) {
    const [tree, department] = await Promise.all([employeesService.listReportingTreeIds(viewer.employeeId), hodsService.listDepartmentIds(viewer.employeeId)])
    if (!tree.includes(person.id) && !department.includes(person.id)) throw notFound
  }
  return person
}

// HR's change of someone's leave (a balance adjustment): Leave Edit covering where they are - "not found" outside the
// View range, "forbidden" with View only
export async function getChangeablePerson(viewer: CurrentUser, employeeCode: string) {
  const notFound = new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const id = (await employeesService.mapCodesToIds([employeeCode])).get(employeeCode.trim().toUpperCase())
  const person = id ? await findPerson(id) : null
  if (!person || !hasLevelAt(viewer, 'LEAVE', placementOf(person), 'READ')) throw notFound
  if (!hasLevelAt(viewer, 'LEAVE', placementOf(person), 'WRITE')) throw new ORPCError('FORBIDDEN', { message: "You do not have access to change this employee's leave" })
  return person
}

export type PeopleFilter = { scope: 'TEAM' | 'DEPARTMENT' | 'ALL'; companyIds?: number[]; departmentIds?: number[]; search?: string }

// The employees a list shows, employed at some point from..to: the viewer's reporting tree (TEAM), the employees whose HOD
// they are (DEPARTMENT), or everyone in their Leave View data access (ALL)
export async function peopleInScope(viewer: CurrentUser, filter: PeopleFilter, from: Date, to: Date) {
  if (filter.scope === 'ALL') assertAccess(viewer.access, 'LEAVE', 'READ')
  const ids =
    filter.scope === 'ALL'
      ? undefined
      : filter.scope === 'TEAM'
        ? await employeesService.listReportingTreeIds(viewer.employeeId)
        : await hodsService.listDepartmentIds(viewer.employeeId)
  if (ids && !ids.length) return []
  return employeesService.listLeavePeople({
    // everyone: the viewer's Leave View data access; the team / department: the relationship, with the ids
    scope: filter.scope === 'ALL' ? scopeOf(viewer, 'LEAVE', 'READ') : SYSTEM_SCOPE,
    ids,
    companyIds: filter.companyIds,
    departmentIds: filter.departmentIds,
    search: filter.search,
    from,
    to,
  })
}

// Whether a leave type applies to an employee (old HRMS: gender and employment category)
export function typeAppliesTo(type: { genders: string[]; employmentTypes: string[] }, person: { gender: string | null; employmentType: string }) {
  if (type.genders.length && (!person.gender || !type.genders.includes(person.gender))) return false
  if (type.employmentTypes.length && !type.employmentTypes.includes(person.employmentType)) return false
  return true
}

// What the viewer's leave pages show first: whether they have a team / department to see, and what they may do
export async function getOverview(viewer: CurrentUser) {
  const [team, department] = await Promise.all([employeesService.listReportingTreeIds(viewer.employeeId), hodsService.listDepartmentIds(viewer.employeeId)])
  return {
    teamSize: team.length,
    departmentSize: department.length,
    canSeeAll: hasAccess(viewer.access, 'LEAVE', 'READ'),
    canEdit: hasAccess(viewer.access, 'LEAVE', 'WRITE'),
  }
}
