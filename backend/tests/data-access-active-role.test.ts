import { hashSessionToken, newSessionToken } from '#core/auth/session'
import { hasLevelAt } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'

describe('active role authorization on an authenticated request', () => {
  let cookie: string
  let accountId: number
  let readerId: number
  let editorId: number
  let adminId: number
  let companyA: number
  let companyB: number
  let plantA: number
  let plantB: number

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    plantB = (await createPlant(companyB)).id
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    readerId = (await createRole({ EMPLOYEES: 'READ' })).id
    editorId = (await createRole({ EMPLOYEES: 'WRITE', ATTENDANCE: 'WRITE' })).id
    adminId = (await prisma.role.findFirstOrThrow({ where: { isSuperAdmin: true }, select: { id: true } })).id
    accountId = (await giveLogin(employee.id, [
      { roleId: readerId, companyId: companyA },
      { roleId: editorId, companyId: companyB },
      { roleId: adminId, companyId: null },
    ])).id
    const token = newSessionToken()
    cookie = `hrms_session=${token}`
    await prisma.session.create({ data: {
      accountId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3600_000),
      createdById: 0, updatedById: 0,
    } })
  })
  afterAll(() => prisma.$disconnect())

  const resolve = (id?: number) => accountsService.resolveUser({ cookie, ...(id === undefined ? {} : { 'x-hrms-role': String(id) }) })
  const atA = () => ({ companyId: companyA, plantId: plantA, departmentId: null })
  const atB = () => ({ companyId: companyB, plantId: plantB, departmentId: null })

  it('does not blend permissions or company scopes from inactive roles', async () => {
    const reader = (await resolve(readerId))!
    expect(reader.activeRoleId).toBe(readerId)
    expect(reader.availableRoles?.map((r) => r.id)).toEqual(expect.arrayContaining([readerId, editorId, adminId]))
    expect(reader.access.EMPLOYEES).toBe('READ')
    expect(reader.access.ATTENDANCE).toBeUndefined()
    expect(reader.isSuperAdmin).toBe(false)
    expect(hasLevelAt(reader, 'EMPLOYEES', atA(), 'READ')).toBe(true)
    expect(hasLevelAt(reader, 'EMPLOYEES', atA(), 'WRITE')).toBe(false)
    expect(hasLevelAt(reader, 'EMPLOYEES', atB(), 'READ')).toBe(false)
    const editor = (await resolve(editorId))!
    expect(hasLevelAt(editor, 'EMPLOYEES', atB(), 'WRITE')).toBe(true)
    expect(hasLevelAt(editor, 'EMPLOYEES', atA(), 'READ')).toBe(false)
  })

  it('activates Super Admin only when selected; no header = Employee self-service with no role (2026-11-25)', async () => {
    expect((await resolve(adminId))?.isSuperAdmin).toBe(true)
    expect((await resolve(readerId))?.isSuperAdmin).toBe(false)
    const employee = (await resolve())!
    expect(employee).toMatchObject({ activeRoleId: null, roles: [], access: {}, grants: [], isSuperAdmin: false })
    expect(employee.availableRoles?.map((r) => r.id)).toEqual(expect.arrayContaining([readerId, editorId, adminId]))
  })

  it('fails closed for an unassigned or revoked selection, while retaining other switch choices', async () => {
    const unassigned = (await createRole({ ACCESS: 'WRITE' })).id
    expect(await resolve(unassigned)).toMatchObject({ activeRoleId: null, access: {}, grants: [], isSuperAdmin: false })
    await prisma.userAccountRole.deleteMany({ where: { accountId, roleId: readerId } })
    const stale = (await resolve(readerId))!
    expect(stale).toMatchObject({ activeRoleId: null, access: {}, grants: [], isSuperAdmin: false })
    expect(stale.availableRoles?.map((r) => r.id)).toContain(editorId)
    expect(stale.availableRoles?.map((r) => r.id)).not.toContain(readerId)
  })
})
