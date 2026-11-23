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

// Forgot-password codes (2026-11-23, the review): only the minute's gap held them back - 1,440 codes a day, 5 guesses each.
// Now at most 5 a day per login, and two asks at the same moment send one code.
describe('forgot-password codes', () => {
  async function loginWithEmail() {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    await accountsService.setPassword(employee.employeeCode, 'A-good-long-password-1')
    // test data: the personal e-mail the code goes to (no mail server in the tests - only the outbox)
    await prisma.employee.update({ where: { id: employee.id }, data: { personalEmail: `reset.${employee.employeeCode.toLowerCase()}@example.com` } })
    return { employeeCode: employee.employeeCode, employeeId: employee.id }
  }
  const stateOf = (employeeId: number) => prisma.userAccount.findUniqueOrThrow({ where: { employeeId }, select: { resetCodeHash: true, resetCodeSentAt: true, resetCodesSentToday: true } })
  // test data: the last code sent `ago` milliseconds back, `count` sent that day
  const sentBefore = (employeeId: number, ago: number, count: number) =>
    prisma.userAccount.update({ where: { employeeId }, data: { resetCodeSentAt: new Date(Date.now() - ago), resetCodesSentToday: count, resetCodeHash: 'x'.repeat(64) } })

  it('sends at most 5 a day per login', async () => {
    const { employeeCode, employeeId } = await loginWithEmail()
    // 5 sent today, the last over a minute ago: the 6th is not sent (the same answer)
    await sentBefore(employeeId, 61_000, 5)
    await accountsService.requestPasswordReset({ employeeCode }, '198.51.100.20')
    expect(await stateOf(employeeId)).toMatchObject({ resetCodeHash: 'x'.repeat(64), resetCodesSentToday: 5 })
    // 4 sent today: the 5th is
    await sentBefore(employeeId, 61_000, 4)
    await accountsService.requestPasswordReset({ employeeCode }, '198.51.100.20')
    const fifth = await stateOf(employeeId)
    expect(fifth.resetCodesSentToday).toBe(5)
    expect(fifth.resetCodeHash).not.toBe('x'.repeat(64))
    // a new day starts again at 1
    await sentBefore(employeeId, 25 * 60 * 60_000, 5)
    await accountsService.requestPasswordReset({ employeeCode }, '198.51.100.20')
    expect((await stateOf(employeeId)).resetCodesSentToday).toBe(1)
  })

  it('sends one code when asked several times at once', async () => {
    const { employeeCode, employeeId } = await loginWithEmail()
    const { id: accountId } = await prisma.userAccount.findUniqueOrThrow({ where: { employeeId }, select: { id: true } })
    const start = new Date()
    await Promise.all([1, 2, 3].map((n) => accountsService.requestPasswordReset({ employeeCode }, `198.51.100.${30 + n}`)))
    expect((await stateOf(employeeId)).resetCodesSentToday).toBe(1)
    // each code stored is one e-mail: the change history shows how many were stored
    const stored = await prisma.auditLog.findMany({ where: { model: 'UserAccount', recordId: accountId, createdAt: { gte: start } }, select: { changes: true } })
    expect(stored.filter((r) => r.changes && typeof r.changes === 'object' && 'resetCodeHash' in r.changes)).toHaveLength(1)
  })
})
