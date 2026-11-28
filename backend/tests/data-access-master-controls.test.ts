import { call } from '@orpc/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { env } from '#core/config/env'
import { prisma } from '#core/db/prisma'
import type { Context, CurrentUser } from '#core/rpc/procedures'
import { accountsService } from '#modules/accounts'
import { masterControlsRouter, masterControlsService } from '#modules/master-controls'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { giveLogin } from './helpers/approvals.js'
import { userWith } from './helpers/users.js'

const by = { createdById: 0, updatedById: 0 }
const ownerMail = 'core_developers@rashmigroup.com'
const contextOf = (user: CurrentUser | null): Context => ({ headers: {}, clientIp: null, getCurrentUser: async () => user, getCurrentCandidate: async () => null })
const input = { hours: 24 as const, status: 'ALL' as const, search: '', page: 1 }

describe('Master Control: pinned account boundary and honest operational data', () => {
  let owner: CurrentUser, other: CurrentUser
  let runId: number, mailId: number
  const previousPin = env.MASTER_CONTROL_ACCOUNT_ID
  const tag = `master-test-${Math.random().toString(36).slice(2)}`
  beforeAll(async () => {
    // No retained owner fixture is overwritten. Test data is isolated to TEST_DATABASE_URL.
    const reserved = await prisma.employee.findUnique({ where: { workEmail: ownerMail }, select: { id: true } })
    if (reserved) throw new Error('The test database already has the reserved owner email; remove only the old synthetic fixture before running this test.')
    const c = await createCompany(), p = await createPlant(c.id)
    const a = await createEmployee({ companyId: c.id, plantId: p.id })
    const b = await createEmployee({ companyId: c.id, plantId: p.id })
    const aa = await giveLogin(a.id, []), bb = await giveLogin(b.id, [])
    await prisma.employee.update({ where: { id: a.id }, data: { workEmail: ownerMail, ...by } })
    owner = { ...userWith(a, []), accountId: aa.id }
    other = { ...userWith(b, [], { isSuperAdmin: true }), accountId: bb.id }
    env.MASTER_CONTROL_ACCOUNT_ID = aa.id
    const run = await prisma.jobRun.create({ data: { job: tag, status: 'FAILED', startedAt: new Date(), finishedAt: new Date(), error: 'ETIMEDOUT secret@example.com password=do-not-return bank=123456789012', ...by } })
    runId = run.id
    mailId = (await prisma.mailRetry.create({ data: { recipient: 'synthetic@example.invalid', subject: 'Private one-time code', messageEncrypted: 'not-selected', status: 'PENDING', attempts: 2, nextAttemptAt: new Date(Date.now() + 60_000), ...by } })).id
  })
  afterAll(async () => {
    env.MASTER_CONTROL_ACCOUNT_ID = previousPin
    if (owner) await prisma.employee.update({ where: { id: owner.employeeId }, data: { workEmail: null, ...by } })
    if (runId) await prisma.jobRun.delete({ where: { id: runId } })
    if (mailId) await prisma.mailRetry.delete({ where: { id: mailId } })
    await prisma.$disconnect()
  })

  it('allows only the pinned account, including self-service without granting HR access', async () => {
    expect(await accountsService.canUseMasterControl(owner)).toBe(true)
    expect((await accountsService.me(owner)).canMasterControl).toBe(true)
    expect((await accountsService.me(owner)).access).toEqual({})
    const overview = await call(masterControlsRouter.overview, undefined, { context: contextOf(owner) })
    expect(overview.jobs.failed).toBeGreaterThan(0)
    expect(overview.jobs.total).toBe(overview.jobs.ok + overview.jobs.failed + overview.jobs.running)
    expect(overview.jobs.timeline.reduce((n, bin) => n + bin.count, 0)).toBe(overview.jobs.total)
    expect(JSON.stringify(overview)).not.toMatch(/synthetic@example|Private one-time|not-selected|DATABASE_URL|DATA_ENCRYPTION_KEY/)
  })

  it('refuses unauthenticated, temporary-password and other Super Admin callers on both APIs', async () => {
    for (const proc of [masterControlsRouter.overview, masterControlsRouter.runs]) {
      await expect(call(proc as never, input as never, { context: contextOf(null) })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      await expect(call(proc as never, input as never, { context: contextOf(other) })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(call(proc as never, input as never, { context: contextOf({ ...owner, mustChangePassword: true }) })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
    expect((await accountsService.me(other)).canMasterControl).toBe(false)
  })

  it('email alone, missing pin, another employee identity, disabled and exited owners fail closed', async () => {
    env.MASTER_CONTROL_ACCOUNT_ID = undefined
    expect(await accountsService.canUseMasterControl(owner)).toBe(false)
    env.MASTER_CONTROL_ACCOUNT_ID = other.accountId
    expect(await accountsService.canUseMasterControl(owner)).toBe(false)
    env.MASTER_CONTROL_ACCOUNT_ID = owner.accountId
    expect(await accountsService.canUseMasterControl({ ...owner, employeeId: other.employeeId })).toBe(false)
    await prisma.userAccount.update({ where: { id: owner.accountId }, data: { disabledAt: new Date(), disabledById: 0, ...by } })
    expect(await accountsService.canUseMasterControl(owner)).toBe(false)
    await prisma.userAccount.update({ where: { id: owner.accountId }, data: { disabledAt: null, disabledById: null, ...by } })
    await prisma.employee.update({ where: { id: owner.employeeId }, data: { status: 'EXITED', ...by } })
    expect(await accountsService.canUseMasterControl(owner)).toBe(false)
    await prisma.employee.update({ where: { id: owner.employeeId }, data: { status: 'ACTIVE', ...by } })
  })

  it('revokes immediately when the owner email changes; moving email never transfers the capability', async () => {
    await prisma.employee.update({ where: { id: owner.employeeId }, data: { workEmail: null, ...by } })
    await prisma.employee.update({ where: { id: other.employeeId }, data: { workEmail: ownerMail, ...by } })
    try {
      expect(await accountsService.canUseMasterControl(other)).toBe(false)
      await expect(masterControlsService.getOverview(owner)).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(masterControlsService.listRuns(owner, input)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await prisma.employee.update({ where: { id: other.employeeId }, data: { workEmail: null, ...by } })
      await prisma.employee.update({ where: { id: owner.employeeId }, data: { workEmail: ownerMail, ...by } })
    }
  })

  it('filters and pages real runs and excludes raw failure text', async () => {
    const result = await call(masterControlsRouter.runs, { ...input, search: tag, status: 'FAILED' }, { context: contextOf(owner) })
    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({ id: runId, status: 'FAILED', failure: { category: 'Timed out' } })
    expect(result.items[0]).not.toHaveProperty('error')
    expect(JSON.stringify(result)).not.toMatch(/secret@example|password=|123456789012/)
    expect((await masterControlsService.listRuns(owner, { ...input, search: tag, status: 'OK' })).total).toBe(0)
    expect((await masterControlsService.listRuns(owner, { ...input, search: tag, page: 2 })).items).toEqual([])
    await expect(call(masterControlsRouter.runs, { ...input, page: 0 }, { context: contextOf(owner) })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(call(masterControlsRouter.runs, { ...input, hours: 999 } as never, { context: contextOf(owner) })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
