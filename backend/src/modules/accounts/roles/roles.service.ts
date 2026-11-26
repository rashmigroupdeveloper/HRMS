import { ACCESS_AREAS, fullAccess, hasAccess, higherLevel, type AccessMap } from '#core/auth/access'
import { assertGroupWide, beyondGiver } from '#core/auth/scope'
import { assertPasswordConfirmed } from '#core/auth/confirm'
import { prisma, type AccessArea, type AccessLevel, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as rolesRepository from './roles.repository.js'
import type { createRoleInput, updateRoleInput } from './roles.schema.js'

// Business rules for roles. A role gives a level (READ / WRITE) per area; the areas are the AccessArea enum
// (access.prisma). A new module adds its area there and its text here.

// What each area means - shown on the "Roles & access" page next to the View / Edit choice.
export const AREA_INFO: Record<AccessArea, { label: string; read: string; write: string }> = {
  PAYROLL: { label: 'Payroll', read: 'View draft payroll runs for companies covered in full', write: 'Also create regular monthly draft runs for companies covered in full; calculation and payment follow later' },
  ONBOARDING: {
    label: 'Onboarding',
    read: 'See candidates, offers, joining forms, documents, background checks and medical results',
    write:
      'Also create and send offers, fill joining forms, upload and review documents, run background checks, ' +
      'record medical results and confirm joining',
  },
  EMPLOYEES: {
    label: 'Employee · Directory & job',
    read: "Find employees and open their profile - the Job tab (job, placement, managers, the job timeline and lay offs, work contacts) and the Record tab. The way into anyone else's profile: the employee areas below add tabs on top of it (everyone can always see their own)",
    write:
      'Also add employees, edit their details (job details only with "Approve job & salary changes"; job changes are asked for with "Request job changes"), import and export them in Excel, and tick the office checklist after joining',
  },
  EMPLOYEE_PERSONAL_DETAILS: {
    label: 'Employee · Personal',
    read: 'The Personal tabs: personal details, addresses & emergency contacts, education & work history, family & nominees (with Employee · Directory & job: View)',
    write: 'Also change them',
  },
  EMPLOYEE_IDS_BANK: {
    label: 'Employee · IDs, bank & statutory',
    read: 'The IDs & bank and PF & ESIC tabs: identity documents (last 4 digits), the salary bank account and the PF / ESIC details and numbers (with Employee · Directory & job: View)',
    write: 'Also change them, and record the UAN, PF and ESIC numbers given after joining',
  },
  EMPLOYEE_DOCUMENTS: {
    label: 'Employee · Documents & letters',
    read: "The Documents and Letters tabs: see and download employees' documents and letters (with Employee · Directory & job: View)",
    write: 'Also add documents, verify or reject them, delete and restore them, and issue letters',
  },
  ORGANIZATION: {
    label: 'Organization',
    read: 'Also see inactive companies, work locations, regions, plants, cost centres, departments, designations, grades and positions (active ones are visible to everyone)',
    write: 'Also add and change companies, work locations, regions, plants, cost centres, departments, designations, grades and positions',
  },
  LETTER_TEMPLATES: {
    label: 'Letter templates',
    read: 'See the wording of the letters (offer letter) - creating and sending letters needs no access of its own',
    write: 'Also change the wording of the letters. Letters already sent never change.',
  },
  MEDICAL: {
    label: 'Employee · Medical',
    read: "See the medical information of candidates' joining forms and of employees (health data)",
    write: 'Also fill in or correct it',
  },
  SALARY: {
    label: 'Employee · Salary',
    read: "The Salary tab: employees' salaries - the fixed CTC, performance pay, monthly breakup and history (everyone always sees their own)",
    write: 'Nothing more for now - salary changes are asked for with "Request salary changes" and go for approval',
  },
  ATTENDANCE: {
    label: 'Attendance',
    read: "See everyone's attendance and the monthly muster (one's own attendance needs no access)",
    write: 'Also correct days and approve shift changes as HR',
  },
  ATTENDANCE_SETUP: {
    label: 'Attendance setup',
    read: 'See the attendance setup: punch uploads and unmatched codes, shifts and policies (retired ones too), roster changes, holidays (with the holiday lists and categories) and roster patterns',
    write: 'Also change them: shifts, policies, default shifts (and rotations), roster changes, holidays, holiday lists (and plants\' default lists), holiday categories and roster patterns, upload and link punches, lock and unlock the attendance month',
  },
  LEAVE: {
    label: 'Leave',
    read: "See everyone's leave applications and balances (the leave register) and the leave types (one's own leave needs no access; a manager sees their team's)",
    write: 'Also adjust leave balances (opening balances, days given) and change the leave types',
  },
  HOD_APPOINTMENTS: {
    label: 'HOD appointments',
    read: 'See the HODs and the places each heads (a department at a plant), since when and before, and the gap list - an HOD sees their own department without this',
    write: 'Also appoint HODs to places, hand places over and end appointments - only for places inside your data access',
  },
  JOINING_TASKS: {
    label: 'Joining tasks',
    read: 'See the joining tasks given to you (e-mail ID, laptop, ID card...) - the My tasks page',
    write: 'Also mark them done (and undo); only people with this can be given a joining task',
  },
  JOINING_TASK_TYPES: {
    label: 'Joining task types',
    read: 'See the list of joining tasks every new employee gets - each with its team, due day and default person (the Task types tab)',
    write: 'Also add, change and retire them - with Edit for all companies, as the list is the same for every company',
  },
  CHANGE_HISTORY: {
    label: 'Change history',
    read: "See who changed what and when - every record of the app, sign-ins - and check that the history was not altered (salary and medical values only with that access). Also the History tab of an employee's profile (not their own)",
    write: 'Nothing more - the history is never changed',
  },
  APPROVAL_CHAINS: {
    label: 'Approval chains',
    read: 'See the steps each kind of request goes through (job changes, salary revisions...) and who decides them',
    write:
      "Also set the steps and their time limits - the shared chains with Edit for all companies, a company's own chain with Edit for that whole company - and repair the requests held because nobody can decide them",
  },
  JOB_CHANGE_REQUEST: {
    label: 'Request job changes',
    read: 'Nothing on its own - View and Edit are the same here',
    write:
      'Ask for promotions, transfers, company transfers, redesignations and manager changes of the employees in your data access (a move: also where they go) - each goes through approval',
  },
  SALARY_CHANGE_REQUEST: {
    label: 'Request salary changes',
    read: 'Nothing on its own - View and Edit are the same here',
    write:
      'Ask for salary revisions and corrections, and the salary part of a promotion, of the employees in your data access - each goes through approval; needs Employee · Salary: View too (to start from the salary in force)',
  },
  JOB_CHANGE_APPROVAL: {
    label: 'Approve job & salary changes',
    read: 'Nothing on its own - View and Edit are the same here',
    write:
      "Change an employee's job details directly in Edit details and the Excel import (otherwise a promotion, transfer or other job change goes through approval); and decide approval steps that ask for this access",
  },
  ACCESS: {
    label: 'Roles & access',
    read: 'See the roles and who has which role',
    write: 'Also create, change and delete roles and give roles to employees - only up to the access they have themselves',
  },
}

type RoleRow = NonNullable<Awaited<ReturnType<typeof rolesRepository.findById>>>

// The level per area of one role (the super admin has WRITE everywhere)
export function accessOf(role: { isSuperAdmin: boolean; permissions: { area: AccessArea; level: AccessLevel }[] }) {
  if (role.isSuperAdmin) return fullAccess()
  return Object.fromEntries(role.permissions.map((p) => [p.area, p.level])) as AccessMap
}

function toRole(row: RoleRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSuperAdmin: row.isSuperAdmin,
    // the fallback approver: decides approval requests nobody else can (modules/approvals, 2026-11-20)
    isApprovalFallback: row.isApprovalFallback,
    access: accessOf(row),
    // approval-chain steps that name this role (it cannot be deleted while any does)
    chainStepCount: row._count.approvalChainSteps + row._count.approvalEscalations,
    // logins that have this role
    employeeCount: row._count.accounts,
  }
}

// For the API: also when the role was last changed and by whom ({ employeeCode, name })
async function withPeople(rows: RoleRow[]) {
  const person = await employeesService.lookupPeople(rows.map((r) => r.updatedById))
  return rows.map((row) => ({ ...toRole(row), updatedAt: row.updatedAt, updatedBy: person(row.updatedById) }))
}

async function withPeopleOne(row: RoleRow) {
  const [role] = await withPeople([row])
  return role!
}

function toPermissions(access: AccessMap) {
  return ACCESS_AREAS.flatMap((area) => {
    const level = access[area]
    return level ? [{ area, level }] : []
  })
}

// Someone who is not a super admin can only give - or take away - access they have themselves.
// Stops e.g. an "Access manager" with no payroll access from creating a payroll role and giving it to themself.
export function assertWithinOwnAccess(user: CurrentUser, access: AccessMap) {
  if (user.isSuperAdmin) return
  const beyond = ACCESS_AREAS.filter((area) => {
    const level = access[area]
    return level !== undefined && !hasAccess(user.access, area, level)
  })
  if (beyond.length) {
    throw new ORPCError('FORBIDDEN', {
      message: `You can only give access you have yourself - you do not have enough access to: ${beyond.map((a) => AREA_INFO[a].label).join(', ')}`,
    })
  }
}

function assertNotSuperAdminRole(role: RoleRow) {
  if (role.isSuperAdmin) throw new ORPCError('FORBIDDEN', { message: 'The Super Admin role is built in and cannot be changed' })
}

async function assertNameFree(name: string, exceptId?: number) {
  const existing = await rolesRepository.findByName(name)
  if (existing && existing.id !== exceptId) {
    throw new ORPCError('CONFLICT', { message: `A role named "${existing.name}" already exists` })
  }
}

// The order the Roles page shows the areas in: the employee areas together (2026-11-16), then the rest
const AREA_ORDER: AccessArea[] = [
  'ONBOARDING',
  'EMPLOYEES',
  'EMPLOYEE_PERSONAL_DETAILS',
  'EMPLOYEE_IDS_BANK',
  'EMPLOYEE_DOCUMENTS',
  'SALARY',
  'PAYROLL',
  'MEDICAL',
  'ORGANIZATION',
  'HOD_APPOINTMENTS',
  'LETTER_TEMPLATES',
  'ATTENDANCE',
  'ATTENDANCE_SETUP',
  'LEAVE',
  'JOINING_TASKS',
  'JOINING_TASK_TYPES',
  'JOB_CHANGE_REQUEST',
  'SALARY_CHANGE_REQUEST',
  'JOB_CHANGE_APPROVAL',
  'APPROVAL_CHAINS',
  'ACCESS',
  'CHANGE_HISTORY',
]
const orderOf = (area: AccessArea) => (AREA_ORDER.includes(area) ? AREA_ORDER.indexOf(area) : AREA_ORDER.length)

// The areas, in the page's order, with what View / Edit mean
export function listAreas() {
  return [...ACCESS_AREAS].sort((a, b) => orderOf(a) - orderOf(b)).map((area) => ({ area, ...AREA_INFO[area] }))
}

// The areas (with what View / Edit mean) and every role
export async function listRoles() {
  const roles = await rolesRepository.list()
  return { areas: listAreas(), roles: await withPeople(roles) }
}

export async function getRole(id: number, db?: DbClient) {
  const role = await rolesRepository.findById(id, db)
  if (!role) throw new ORPCError('NOT_FOUND', { message: 'Role not found' })
  return role
}

// Roles by id - throws NOT_FOUND if any id does not exist
export async function getRolesByIds(ids: number[], db?: DbClient) {
  const unique = [...new Set(ids)]
  const roles = await rolesRepository.findManyByIds(unique, db)
  if (roles.length !== unique.length) throw new ORPCError('NOT_FOUND', { message: 'Role not found' })
  return roles.map(toRole)
}

// Holds these roles until the transaction ends - giving roles takes it too, so a role's change and its giving never pass
// their checks on what the other has not saved yet (2026-11-23, the review)
export function lockRoles(roleIds: number[], tx: DbClient) {
  return rolesRepository.lockRoles(roleIds, tx)
}

// The role with this name (any upper / lower case); throws NOT_FOUND. Used by scripts/set-password.ts.
export async function getRoleByName(name: string) {
  const role = await rolesRepository.findByName(name.trim())
  if (!role) throw new ORPCError('NOT_FOUND', { message: `No role named "${name}"` })
  return toRole(role)
}

// A role is the same for every company it is given in, so creating, changing or deleting one needs Roles & access Edit for
// all companies (A4, 2026-11-18)
export async function createRole(input: z.infer<typeof createRoleInput>, user: CurrentUser) {
  assertPasswordConfirmed(user)
  assertGroupWide(user, 'ACCESS', 'A role')
  assertWithinOwnAccess(user, input.access)
  await assertNameFree(input.name)
  const role = await rolesRepository.create(
    { name: input.name, description: input.description, permissions: toPermissions(input.access) },
    user.employeeId,
  )
  return withPeopleOne(role)
}

export async function updateRole(input: z.infer<typeof updateRoleInput>, user: CurrentUser) {
  assertPasswordConfirmed(user)
  assertGroupWide(user, 'ACCESS', 'A role')
  const role = await getRole(input.id)
  assertNotSuperAdminRole(role)
  // the role as it is now, and as it will be
  assertWithinOwnAccess(user, accessOf(role))
  if (input.access) assertWithinOwnAccess(user, input.access)
  await assertChangeWithinHolders(user, role, input)
  if (input.name !== undefined) await assertNameFree(input.name, role.id)
  // Access is read fresh on every request, so the change applies to everyone with this role straight away
  const updated = await prisma.$transaction(async (tx) => {
    // one change or giving of this role at a time, its areas and holders checked again now that the one before is saved
    // (2026-11-23, the review: giving the role with wide data access while its areas were added passed both checks)
    await rolesRepository.lockRoles([role.id], tx)
    const fresh = await getRole(role.id, tx)
    assertWithinOwnAccess(user, accessOf(fresh))
    await assertChangeWithinHolders(user, fresh, input, tx)
    // one fallback approver role at most: marking this one takes the mark from the other
    if (input.isApprovalFallback === true) await rolesRepository.clearApprovalFallback(role.id, user.employeeId, tx)
    return rolesRepository.update(
      role.id,
      { name: input.name, description: input.description, permissions: input.access && toPermissions(input.access), isApprovalFallback: input.isApprovalFallback },
      user.employeeId,
      tx,
    )
  })
  return withPeopleOne(updated)
}

// A role's change reaches everyone who has it, over their own data-access rows (2026-11-23 - before, only the areas were
// compared, so an editor could widen a role they or someone else held over every company):
// - nobody changes a role they have themselves (as nobody changes their own roles);
// - each area whose level changes (added, raised, lowered or taken away) must be within the editor's access over every
//   holder's rows - the same rule as giving the role to them.
// (The fallback-approver mark needs no check of its own: changing a role already needs Roles & access Edit for all
// companies, which covers every holder's rows - the rule for giving rows in setAccountRoles.)
async function assertChangeWithinHolders(user: CurrentUser, role: RoleRow, input: z.infer<typeof updateRoleInput>, db?: DbClient) {
  if (user.isSuperAdmin) return
  if (user.roles.some((r) => r.id === role.id)) {
    throw new ORPCError('FORBIDDEN', { message: 'You cannot change a role you have yourself - ask someone else with Roles & access' })
  }
  const before = accessOf(role)
  const after = input.access ?? before
  const changed: AccessMap = {}
  for (const area of ACCESS_AREAS) {
    if (before[area] !== after[area]) changed[area] = higherLevel(before[area], after[area])
  }
  if (Object.keys(changed).length) {
    const beyond = beyondGiver(user, changed, await rolesRepository.listHolderRows(role.id, db))
    if (beyond.length) {
      throw new ORPCError('FORBIDDEN', {
        message: `People who have this role have data access beyond yours for: ${beyond.map((a) => AREA_INFO[a].label).join(', ')} - you can only change what your own data access covers`,
      })
    }
  }
}

// Only a role nobody has can be deleted
export async function deleteRole(id: number, user: CurrentUser) {
  assertPasswordConfirmed(user)
  assertGroupWide(user, 'ACCESS', 'A role')
  const role = await getRole(id)
  assertNotSuperAdminRole(role)
  assertWithinOwnAccess(user, accessOf(role))
  if (role._count.accounts > 0) {
    throw new ORPCError('CONFLICT', {
      message: `${role._count.accounts} employee(s) have this role - take it away from them first`,
    })
  }
  if (role._count.approvalChainSteps + role._count.approvalEscalations > 0) {
    throw new ORPCError('CONFLICT', { message: 'This role is used in an approval chain (as a step, or where late steps escalate) - take it out first on the Approval rules page' })
  }
  if (role._count.joiningTaskTypes > 0) {
    throw new ORPCError('CONFLICT', { message: 'This role is the team of a joining task - give that task another team first (Joining tasks > Task types)' })
  }
  await rolesRepository.deleteById(role.id)
  return { id: role.id, deleted: true }
}

// Configuration pickers need role metadata only, not a directory of their holders.
export async function listRoleChoicesForAccess(area: AccessArea, level: AccessLevel) {
  return (await rolesRepository.list()).filter(role => hasAccess(accessOf(role), area, level)).map(({ id, name }) => ({ id, name }))
}
