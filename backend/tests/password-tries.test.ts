import { prisma } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as securityService from '../src/modules/accounts/security/security.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'

// Wrong passwords sent at the same moment (found in the 2026-11-23 review): each read the count of wrong passwords and
// wrote count + 1, so a burst counted once and the lockout after 5 never came. Now each is counted in the database.
describe('wrong passwords at the same moment', () => {
  let employeeCode: string
  let accountId: number

  beforeAll(async () => {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    employeeCode = employee.employeeCode
    await accountsService.setPassword(employeeCode, 'A-good-long-password-1')
    accountId = (await prisma.userAccount.findUniqueOrThrow({ where: { employeeId: employee.id }, select: { id: true } })).id
  })
  afterAll(() => prisma.$disconnect())

  it('locks the login after the allowed number of wrong passwords, also when they all come at once', async () => {
    const { maxFailedLogins } = await securityService.getRules()
    // the per-login limit of 5 tries a minute stops a bigger burst before it is counted
    const burst = Math.min(maxFailedLogins, 5)
    const tries = await Promise.allSettled(
      Array.from({ length: burst }, () => accountsService.login({ login: employeeCode, password: 'not-the-password' }, undefined, { ip: '198.51.100.7', userAgent: 'test' })),
    )
    expect(tries.every((t) => t.status === 'rejected')).toBe(true)
    const account = await prisma.userAccount.findUniqueOrThrow({ where: { id: accountId }, select: { failedLoginCount: true, lockedUntil: true } })
    if (burst === maxFailedLogins) expect(account.lockedUntil).not.toBeNull()
    else expect(account.failedLoginCount).toBe(burst)
  })
})
