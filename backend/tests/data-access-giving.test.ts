import { prisma } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as rolesRepository from '../src/modules/accounts/roles/roles.repository.js'
import * as rolesService from '../src/modules/accounts/roles/roles.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'
import { asAsync } from './helpers/spies.js'

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

// Found in the 2026-11-23 review: changing a role reaches everyone who has it, over their own rows - before, only the
// areas were compared with the editor's best level anywhere, so an editor with Salary for one company could add Salary
// to a role held over every company (by themselves or by someone they gave an empty role to).
describe('changing a role stays within the editor\'s data access over its holders', () => {
  let editor: ReturnType<typeof userWith>
  let wideRoleId: number
  let narrowRoleId: number

  beforeAll(async () => {
    const companyA = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    const editorEmployee = await createEmployee({ companyId: companyA, plantId: plantA })
    const wideHolder = await createEmployee({ companyId: companyA, plantId: plantA })
    const narrowHolder = await createEmployee({ companyId: companyA, plantId: plantA })
    const superAdmin = userWith(editorEmployee, [], { isSuperAdmin: true })
    wideRoleId = (await rolesService.createRole({ name: `Wide ${wideHolder.employeeCode}`, access: { EMPLOYEES: 'READ' } }, superAdmin)).id
    narrowRoleId = (await rolesService.createRole({ name: `Narrow ${narrowHolder.employeeCode}`, access: { EMPLOYEES: 'READ' } }, superAdmin)).id
    for (const [code, roleId, rows] of [
      [wideHolder.employeeCode, wideRoleId, [row(null, null, null)]],
      [narrowHolder.employeeCode, narrowRoleId, [row(companyA, null, null)]],
    ] as const) {
      await accountsService.createLogin(superAdmin, { employeeCode: code })
      await accountsService.setAccountRoles({ employeeCode: code, roles: [{ roleId, dataAccess: [...rows] }] }, superAdmin)
    }
    // Roles & access Edit for every company; Salary View only for company A
    editor = userWith(editorEmployee, [
      { access: { ACCESS: 'WRITE', EMPLOYEES: 'READ' }, rows: [row(null, null, null)] },
      { access: { SALARY: 'READ' }, rows: [row(companyA, null, null)] },
    ])
  })

  it('refuses adding an area the editor has only for some companies to a role held over every company', async () => {
    await expect(rolesService.updateRole({ id: wideRoleId, access: { EMPLOYEES: 'READ', SALARY: 'READ' } }, editor)).rejects.toThrow('data access beyond yours for: Employee · Salary')
  })

  it('allows it when every holder is inside the editor\'s data access', async () => {
    const saved = await rolesService.updateRole({ id: narrowRoleId, access: { EMPLOYEES: 'READ', SALARY: 'READ' } }, editor)
    expect(saved.access).toEqual({ EMPLOYEES: 'READ', SALARY: 'READ' })
  })

  it('still allows changes that touch no area (a new description)', async () => {
    await expect(rolesService.updateRole({ id: wideRoleId, description: 'Read-only directory' }, editor)).resolves.toBeDefined()
  })

  it('refuses changing a role the editor has themselves', async () => {
    const holder = { ...editor, roles: [{ id: narrowRoleId, name: 'Narrow' }] }
    await expect(rolesService.updateRole({ id: narrowRoleId, description: 'mine' }, holder)).rejects.toThrow('a role you have yourself')
  })
})

// Found in the 2026-11-23 review: giving a role with no areas but wide data-access rows while another editor added areas
// to it - each check passed on what the other had not saved yet. Both now hold the role and check it again inside.
describe('a role changed while it is given', () => {
  let companyA: number
  let editor: ReturnType<typeof userWith>
  let superAdmin: ReturnType<typeof userWith>
  const salary = { SALARY: 'READ' } as const

  const setup = async () => {
    const plantA = (await createPlant(companyA)).id
    const holder = await createEmployee({ companyId: companyA, plantId: plantA })
    await accountsService.createLogin(superAdmin, { employeeCode: holder.employeeCode })
    const roleId = (await rolesService.createRole({ name: `Empty ${holder.employeeCode}`, access: {} }, superAdmin)).id
    return { holderCode: holder.employeeCode, roleId }
  }

  beforeAll(async () => {
    companyA = (await createCompany()).id
    const someone = await createEmployee({ companyId: companyA, plantId: (await createPlant(companyA)).id })
    superAdmin = userWith(someone, [], { isSuperAdmin: true })
    // Roles & access Edit for every company; Salary View only for company A
    editor = userWith(someone, [
      { access: { ACCESS: 'WRITE', EMPLOYEES: 'READ' }, rows: [row(null, null, null)] },
      { access: salary, rows: [row(companyA, null, null)] },
    ])
  })

  it('refuses giving it over every company when Salary was added after the giver read it', async () => {
    const { holderCode, roleId } = await setup()
    const read = rolesService.getRolesByIds
    const spy = vi.spyOn(rolesService, 'getRolesByIds').mockImplementationOnce(async (...args) => {
      const roles = await read(...args)
      await rolesService.updateRole({ id: roleId, access: salary }, superAdmin)
      return roles
    })
    try {
      await expect(accountsService.setAccountRoles({ employeeCode: holderCode, roles: [{ roleId, dataAccess: [row(null, null, null)] }] }, editor)).rejects.toThrow(
        'your data access does not cover',
      )
    } finally {
      spy.mockRestore()
    }
  })

  it('refuses adding Salary when it was given over every company after the editor read its holders', async () => {
    const { holderCode, roleId } = await setup()
    const read = rolesRepository.listHolderRows
    const spy = vi.spyOn(asAsync(rolesRepository), 'listHolderRows').mockImplementationOnce(async (...args) => {
      const rows = await read(...args)
      await accountsService.setAccountRoles({ employeeCode: holderCode, roles: [{ roleId, dataAccess: [row(null, null, null)] }] }, superAdmin)
      return rows
    })
    try {
      await expect(rolesService.updateRole({ id: roleId, access: salary }, editor)).rejects.toThrow('data access beyond yours')
    } finally {
      spy.mockRestore()
    }
  })
})
