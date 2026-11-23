import { prisma } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as rolesService from '../src/modules/accounts/roles/roles.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Data access (2026-11-18): giving roles with data access stays within the giver's own access; employees outside the
// giver's range are "not found"; roles - shared by every company - need Edit for all companies.
describe('giving roles with data access', () => {
  let companyA: number
  let companyB: number
  let plantA2: number
  let plantB1: number
  let targetCode: string
  let outsiderCode: string
  let hrRoleId: number
  let superAdmin: ReturnType<typeof userWith>
  let rmlAdmin: ReturnType<typeof userWith>

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    const plantA1 = (await createPlant(companyA)).id
    plantA2 = (await createPlant(companyA)).id
    plantB1 = (await createPlant(companyB)).id
    const giver = await createEmployee({ companyId: companyA, plantId: plantA1 })
    const target = await createEmployee({ companyId: companyA, plantId: plantA2 })
    const outsider = await createEmployee({ companyId: companyB, plantId: plantB1 })
    targetCode = target.employeeCode
    outsiderCode = outsider.employeeCode

    superAdmin = userWith(giver, [], { isSuperAdmin: true })
    const role = await rolesService.createRole({ name: `HR ${targetCode}`, access: { EMPLOYEES: 'WRITE' } }, superAdmin)
    hrRoleId = role.id
    await accountsService.createLogin(superAdmin, { employeeCode: targetCode })
    await accountsService.createLogin(superAdmin, { employeeCode: outsiderCode })

    // "Roles & access" and "Employees" at Edit for company A only
    rmlAdmin = userWith(giver, [{ access: { ACCESS: 'WRITE', EMPLOYEES: 'WRITE' }, rows: [row(companyA, null, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it('gives a role inside the giver\'s data access and lists only employees in range', async () => {
    const saved = await accountsService.setAccountRoles({ employeeCode: targetCode, roles: [{ roleId: hrRoleId, dataAccess: [row(companyA, plantA2, null)] }] }, rmlAdmin)
    expect(saved.roles).toHaveLength(1)
    expect(saved.roles[0]?.dataAccess).toEqual([expect.objectContaining({ companyId: companyA, plantId: plantA2, departmentId: null, level: 'WRITE' })])

    const codes = (await accountsService.listAccounts(rmlAdmin)).map((a) => a.employeeCode)
    expect(codes).toContain(targetCode)
    expect(codes).not.toContain(outsiderCode)
  })

  it('refuses data access beyond the giver\'s own', async () => {
    await expect(
      accountsService.setAccountRoles({ employeeCode: targetCode, roles: [{ roleId: hrRoleId, dataAccess: [row(companyB, null, null)] }] }, rmlAdmin),
    ).rejects.toThrow('your data access does not cover')
    await expect(
      accountsService.setAccountRoles({ employeeCode: targetCode, roles: [{ roleId: hrRoleId, dataAccess: [row(null, null, null)] }] }, rmlAdmin),
    ).rejects.toThrow('your data access does not cover')
  })

  it('refuses a role with no access for rows beyond the giver\'s own - its rows decide whose approvals its holders decide (2026-11-20)', async () => {
    const admin = await prisma.role.findFirst({ where: { isApprovalFallback: true }, select: { id: true } })
    await expect(
      accountsService.setAccountRoles({ employeeCode: targetCode, roles: [{ roleId: admin!.id, dataAccess: [row(companyB, null, null)] }] }, rmlAdmin),
    ).rejects.toThrow('inside your own Roles & access data access')
    await expect(
      accountsService.setAccountRoles({ employeeCode: targetCode, roles: [{ roleId: admin!.id, dataAccess: [row(companyA, null, null)] }] }, rmlAdmin),
    ).resolves.toBeDefined()
  })

  it('treats an employee outside the giver\'s range as not found', async () => {
    await expect(accountsService.setAccountRoles({ employeeCode: outsiderCode, roles: [] }, rmlAdmin)).rejects.toThrow(`No employee found with code ${outsiderCode}`)
    await expect(accountsService.resetPassword(rmlAdmin, { employeeCode: outsiderCode })).rejects.toThrow('No employee found')
  })

  it('refuses a plant of another company in a row', async () => {
    await expect(
      accountsService.setAccountRoles({ employeeCode: targetCode, roles: [{ roleId: hrRoleId, dataAccess: [row(companyA, plantB1, null)] }] }, superAdmin),
    ).rejects.toThrow('is not a plant of the company')
  })

  it('needs Edit for all companies to change a role', async () => {
    await expect(rolesService.createRole({ name: `Clerk ${targetCode}`, access: { EMPLOYEES: 'READ' } }, rmlAdmin)).rejects.toThrow('shared by every company')
    // a super admin may give any data access
    const saved = await accountsService.setAccountRoles({ employeeCode: outsiderCode, roles: [{ roleId: hrRoleId, dataAccess: [row(companyB, null, null, 'READ')] }] }, superAdmin)
    expect(saved.roles[0]?.dataAccess[0]?.level).toBe('READ')
  })
})

describe('saved data access comes back the way requests read it', () => {
  it('reads the rows saved on a role given to someone through the login records', async () => {
    const companyA = (await createCompany()).id
    const companyB = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    const plantB = (await createPlant(companyB)).id
    const person = await createEmployee({ companyId: companyA, plantId: plantA })
    const admin = userWith(person, [], { isSuperAdmin: true })
    const role = await rolesService.createRole({ name: `Editor ${person.employeeCode}`, access: { EMPLOYEES: 'WRITE' } }, admin)
    await accountsService.createLogin(admin, { employeeCode: person.employeeCode })
    await accountsService.setAccountRoles({ employeeCode: person.employeeCode, roles: [{ roleId: role.id, dataAccess: [row(companyA, plantA, null)] }] }, admin)
    // the same path a request takes: the login's roles with their rows -> the rule engine
    const atA = { companyId: companyA, plantId: plantA, departmentId: null }
    const atB = { companyId: companyB, plantId: plantB, departmentId: null }
    const holders = async (at: typeof atA) =>
      ((await accountsService.listRolesWithAccess('EMPLOYEES', 'WRITE', at)).find((r) => r.id === role.id)?.people ?? []).map((p) => p.employeeCode)
    const withA = await holders(atA)
    const withB = await holders(atB)
    expect(withA).toContain(person.employeeCode)
    expect(withB).not.toContain(person.employeeCode)
    // what accounts.me tells the frontend
    const me = await accountsService.me(userWith(person, [{ access: { EMPLOYEES: 'WRITE' }, rows: [row(companyA, plantA, null)] }]))
    expect(me.dataAccess.EMPLOYEES).toEqual({ READ: [{ companyId: companyA, plantId: plantA, departmentId: null }], WRITE: [{ companyId: companyA, plantId: plantA, departmentId: null }] })
  })
})
