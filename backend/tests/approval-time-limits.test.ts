import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { approvalsService } from '#modules/approvals'
import { employeesService } from '#modules/employees'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as jobChangesService from '../src/modules/job-changes/job-changes.service.js'
import { createRole, fallbackRoleId, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The time limits of approval steps (the user, 2026-11-20 - the old HRMS's SLA, plus "wait"): when a step is not
// decided in time the hourly job waits (marks it late), escalates, approves, expires or rejects - as the chain says.
const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()

type Viewer = ReturnType<typeof userWith>
type ChainSteps = Parameters<typeof chainsService.saveChain>[1]['steps']

describe('approval time limits', () => {
  let companyId: number
  let plantId: number
  let designation: number
  let hr: Viewer
  let direct: Viewer
  let chainsAdmin: Viewer
  let role: { id: number }
  let roleHolder: Viewer
  let escalationRole: { id: number }
  let escalationHolder: Viewer
  let fallbackHolder: Viewer

  const viewerOf = (employee: { id: number; employeeCode: string }, access: Parameters<typeof userWith>[1][number]['access'] = {}): Viewer =>
    userWith(employee, [{ access, rows: [row(companyId, null, null)] }])

  async function holderOf(roleId: number) {
    const employee = await createEmployee({ companyId, plantId })
    await giveLogin(employee.id, [{ roleId, companyId }])
    return viewerOf(employee)
  }

  // a job change of a new employee (optionally with a reporting manager), following this chain; its request id
  async function raise(steps: ChainSteps, managerCode?: string) {
    await chainsService.saveChain(chainsAdmin, { kind: 'JOB_CHANGE', companyId, steps })
    const employee = await createEmployee({ companyId, plantId })
    if (managerCode) await employeesService.updateEmployee({ employeeCode: employee.employeeCode, reportingManagerCode: managerCode }, direct)
    const change = await jobChangesService.createJobChange(
      { employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Test', designationId: designation },
      hr,
    )
    return { employee, id: change.approvalRequestId }
  }

  // the open step's time ran out an hour ago - then the hourly job runs
  async function runLate(requestId: number) {
    await prisma.approvalRequestStep.updateMany({ where: { requestId, status: 'OPEN' }, data: { dueAt: new Date(Date.now() - 60 * 60 * 1000) } })
    return approvalsService.runTimeLimits({ requestIds: [requestId] })
  }

  const jobChangeOf = (approvalRequestId: number) =>
    prisma.jobChangeRequest.findFirst({ where: { approvalRequestId }, select: { status: true, cancelReason: true } })

  beforeAll(async () => {
    companyId = (await createCompany()).id
    plantId = (await createPlant(companyId)).id
    designation = (await designationsService.createDesignation({ name: `Time limit test ${tag}` }, SYSTEM_ACTOR)).id
    hr = viewerOf(await createEmployee({ companyId, plantId }), { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' })
    direct = viewerOf(await createEmployee({ companyId, plantId }), { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' })
    chainsAdmin = userWith({ id: 0, employeeCode: 'SLA' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyId, null, null)] }])
    role = await createRole()
    escalationRole = await createRole()
    roleHolder = await holderOf(role.id)
    escalationHolder = await holderOf(escalationRole.id)
    fallbackHolder = await holderOf(await fallbackRoleId())
  })
  afterAll(() => prisma.$disconnect())

  it('needs SLA hours for every action but "wait", and sets the due time when a step opens', async () => {
    await expect(
      chainsService.saveChain(chainsAdmin, { kind: 'JOB_CHANGE', companyId, steps: [{ approverType: 'ROLE', roleId: role.id, onBreach: 'AUTO_APPROVE' }] }),
    ).rejects.toThrow('set the SLA hours')

    const before = Date.now()
    const { id } = await raise([{ approverType: 'ROLE', roleId: role.id, slaHours: 24, onBreach: 'WAIT' }])
    const step = (await approvalsService.getRequest(hr, id)).steps[0]!
    expect(step.dueAt!.getTime() - before).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000)
    expect(step.late).toBe(false)
  })

  it('wait: reminds the approver every SLA hours - nothing moves, only they decide it, even late', async () => {
    const { id } = await raise([{ approverType: 'ROLE', roleId: role.id, slaHours: 24, onBreach: 'WAIT' }])
    const remindedAt = async () => (await prisma.approvalRequestStep.findFirst({ where: { requestId: id, status: 'OPEN' }, select: { remindedAt: true } }))?.remindedAt
    await runLate(id)
    const late = await approvalsService.getRequest(hr, id)
    expect([late.status, late.steps[0]!.status, late.steps[0]!.late]).toEqual(['PENDING', 'OPEN', true])
    const first = await remindedAt()
    expect(first).toBeTruthy()
    // within the next 24 hours: no second reminder
    await approvalsService.runTimeLimits({ requestIds: [id] })
    expect(await remindedAt()).toEqual(first)
    // 24 hours after the last one: reminded again
    await prisma.approvalRequestStep.updateMany({ where: { requestId: id, status: 'OPEN' }, data: { remindedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } })
    await approvalsService.runTimeLimits({ requestIds: [id] })
    expect((await remindedAt())!.getTime()).toBeGreaterThan(first!.getTime())
    expect((await approvalsService.decide(roleHolder, { id, approve: true })).status).toBe('APPROVED')
  })

  it('wait with no reminder: no SLA, never late, never reminded', async () => {
    const { id } = await raise([{ approverType: 'ROLE', roleId: role.id, slaHours: null, onBreach: 'WAIT' }])
    const step = (await approvalsService.getRequest(hr, id)).steps[0]!
    expect([step.dueAt, step.late]).toEqual([null, false])
    await approvalsService.runTimeLimits({ requestIds: [id] })
    expect((await prisma.approvalRequestStep.findFirst({ where: { requestId: id, status: 'OPEN' }, select: { remindedAt: true } }))?.remindedAt).toBeNull()
  })

  it('approve automatically: the step counts as approved and the change goes on', async () => {
    const { employee, id } = await raise([{ approverType: 'ROLE', roleId: role.id, slaHours: 4, onBreach: 'AUTO_APPROVE' }])
    await runLate(id)
    const request = await approvalsService.getRequest(hr, id)
    expect(request.status).toBe('APPROVED')
    expect(request.steps[0]).toMatchObject({ status: 'APPROVED', autoDecided: true, comment: expect.stringContaining('not decided within 4 hours') })
    expect((await employeesService.getByCode(employee.employeeCode)).designation?.id).toBe(designation)
  })

  it('reject automatically and expire: the request ends, and the job change with it', async () => {
    const rejected = await raise([{ approverType: 'ROLE', roleId: role.id, slaHours: 4, onBreach: 'AUTO_REJECT' }])
    await runLate(rejected.id)
    expect((await approvalsService.getRequest(hr, rejected.id)).status).toBe('REJECTED')
    expect((await jobChangeOf(rejected.id))?.status).toBe('REJECTED')

    const expired = await raise([{ approverType: 'ROLE', roleId: role.id, slaHours: 4, onBreach: 'EXPIRE' }, { approverType: 'ROLE', roleId: escalationRole.id }])
    await runLate(expired.id)
    const request = await approvalsService.getRequest(hr, expired.id)
    expect([request.status, request.steps.map((s) => s.status)]).toEqual(['EXPIRED', ['CANCELLED', 'CANCELLED']])
    expect(await jobChangeOf(expired.id)).toMatchObject({ status: 'CANCELLED', cancelReason: expect.stringContaining('Expired') })
    await expect(approvalsService.decide(roleHolder, { id: expired.id, approve: true })).rejects.toThrow()
  })

  it("escalates a manager's step up the reporting line, then to the fallback approver at the top", async () => {
    const top = await createEmployee({ companyId, plantId })
    const manager = await createEmployee({ companyId, plantId })
    await giveLogin(top.id, [])
    await giveLogin(manager.id, [])
    await employeesService.updateEmployee({ employeeCode: manager.employeeCode, reportingManagerCode: top.employeeCode }, direct)
    const { id } = await raise([{ approverType: 'REPORTING_MANAGER', slaHours: 2, onBreach: 'ESCALATE' }, { approverType: 'ROLE', roleId: role.id }], manager.employeeCode)

    await runLate(id)
    const once = await approvalsService.getRequest(hr, id)
    expect(once.steps.map((s) => [s.stepNo, s.approverType, s.status])).toEqual([
      [1, 'REPORTING_MANAGER', 'ESCALATED'],
      [2, 'ESCALATION', 'OPEN'],
      [3, 'ROLE', 'WAITING'],
    ])
    expect(once.steps[1]).toMatchObject({ approver: { employeeCode: top.employeeCode }, slaHours: 2 })
    expect(once.steps[1]!.dueAt).not.toBeNull()
    // the manager who was late cannot decide it any more; the one above can
    await expect(approvalsService.decide(viewerOf(manager), { id, approve: true })).rejects.toThrow('not yours to decide')
    expect((await approvalsService.listToDecide(viewerOf(top))).map((r) => r.id)).toContain(id)

    // the top manager is late too and has no manager: the fallback approver (waits, reminded every 3 days)
    await runLate(id)
    const twice = await approvalsService.getRequest(hr, id)
    expect(twice.steps.map((s) => [s.approverType, s.status])).toEqual([
      ['REPORTING_MANAGER', 'ESCALATED'],
      ['ESCALATION', 'ESCALATED'],
      ['FALLBACK', 'OPEN'],
      ['ROLE', 'WAITING'],
    ])
    expect(twice.steps[2]).toMatchObject({ slaHours: 72, onBreach: 'WAIT' })
    expect((await approvalsService.decide(fallbackHolder, { id, approve: true })).status).toBe('PENDING')
    expect((await approvalsService.decide(roleHolder, { id, approve: true })).status).toBe('APPROVED')
  })

  it('escalates to the role named on the step', async () => {
    const { id } = await raise([
      { approverType: 'ROLE', roleId: role.id, slaHours: 8, onBreach: 'ESCALATE', escalateRoleId: escalationRole.id },
      { approverType: 'ACCESS', accessArea: 'JOB_CHANGE_APPROVAL' },
    ])
    await runLate(id)
    const request = await approvalsService.getRequest(hr, id)
    expect(request.steps.map((s) => [s.approverType, s.status])).toEqual([
      ['ROLE', 'ESCALATED'],
      ['ROLE', 'OPEN'],
      ['ACCESS', 'WAITING'],
    ])
    expect(request.steps[1]!.who).toBe(request.steps[0]!.escalateRoleName)
    await expect(approvalsService.decide(roleHolder, { id, approve: true })).rejects.toThrow() // no longer theirs - not even shown to them
    expect((await approvalsService.decide(escalationHolder, { id, approve: true })).status).toBe('PENDING')
  })

  const signOut = (employeeId: number) => prisma.userAccount.updateMany({ where: { employeeId }, data: { disabledAt: new Date(), disabledById: SYSTEM_ACTOR } })

  it('gives an escalation to the fallback approver when the manager it went to can no longer sign in', async () => {
    const top = await createEmployee({ companyId, plantId })
    const manager = await createEmployee({ companyId, plantId })
    await giveLogin(top.id, [])
    await giveLogin(manager.id, [])
    await employeesService.updateEmployee({ employeeCode: manager.employeeCode, reportingManagerCode: top.employeeCode }, direct)
    const { id } = await raise([{ approverType: 'REPORTING_MANAGER', slaHours: 2, onBreach: 'ESCALATE' }], manager.employeeCode)
    await runLate(id)
    await signOut(top.id)
    await approvalsService.runDaily({ requestIds: [id] })
    const request = await approvalsService.getRequest(hr, id)
    expect(request.steps.map((s) => [s.approverType, s.status])).toEqual([
      ['REPORTING_MANAGER', 'ESCALATED'],
      ['FALLBACK', 'OPEN'],
    ])
    expect((await approvalsService.decide(fallbackHolder, { id, approve: true })).status).toBe('APPROVED')
  })

  it('holds it there when even the fallback approver has nobody - a retry never skips the step nor approves by itself', async () => {
    // a company of its own, where nobody holds the fallback role
    const companyN = (await createCompany()).id
    const plantN = (await createPlant(companyN)).id
    const adminN = userWith({ id: 0, employeeCode: 'SLAN' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyN, null, null)] }])
    const hrN = userWith(await createEmployee({ companyId: companyN, plantId: plantN }), [
      { access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(companyN, null, null)] },
    ])
    const holderN = await createEmployee({ companyId: companyN, plantId: plantN })
    await giveLogin(holderN.id, [{ roleId: role.id, companyId: companyN }])
    const top = await createEmployee({ companyId: companyN, plantId: plantN })
    const manager = await createEmployee({ companyId: companyN, plantId: plantN })
    const employee = await createEmployee({ companyId: companyN, plantId: plantN })
    await giveLogin(top.id, [])
    await giveLogin(manager.id, [])
    await employeesService.updateEmployee({ employeeCode: manager.employeeCode, reportingManagerCode: top.employeeCode }, hrN)
    await employeesService.updateEmployee({ employeeCode: employee.employeeCode, reportingManagerCode: manager.employeeCode }, hrN)
    // step 1 is approved by a person; step 2 (the manager) escalates
    await chainsService.saveChain(adminN, {
      kind: 'JOB_CHANGE',
      companyId: companyN,
      steps: [{ approverType: 'ROLE', roleId: role.id }, { approverType: 'REPORTING_MANAGER', slaHours: 2, onBreach: 'ESCALATE' }],
    })
    const change = await jobChangesService.createJobChange(
      { employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Test', designationId: designation },
      hrN,
    )
    const id = change.approvalRequestId
    await approvalsService.decide(userWith(holderN, [{ access: {}, rows: [row(companyN, null, null)] }]), { id, approve: true })
    await runLate(id)
    await signOut(top.id)
    await approvalsService.runDaily({ requestIds: [id] })
    const held = await approvalsService.getRequest(adminN, id)
    expect(held.status).toBe('PENDING')
    expect(held.held?.reason).toContain('not even the fallback approver')
    expect(held.steps.at(-1)).toMatchObject({ approverType: 'FALLBACK', status: 'WAITING' })
    // the nightly retry and a retry by hand: still held at that step, never approved
    await approvalsService.runDaily({ requestIds: [id] })
    expect((await approvalsService.getRequest(adminN, id)).status).toBe('PENDING')
    expect((await approvalsService.retryRouting(adminN, id)).held).not.toBeNull()
    expect((await jobChangeOf(id))?.status).toBe('PENDING')
  })

  it('refuses new requests of a kind whose chain is switched off - those already raised go on', async () => {
    const { id } = await raise([{ approverType: 'ROLE', roleId: role.id }])
    await chainsService.saveChain(chainsAdmin, { kind: 'JOB_CHANGE', companyId, isActive: false, steps: [{ approverType: 'ROLE', roleId: role.id }] })
    const employee = await createEmployee({ companyId, plantId })
    await expect(
      jobChangesService.createJobChange(
        { employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Test', designationId: designation },
        hr,
      ),
    ).rejects.toThrow('switched off')
    expect((await approvalsService.decide(roleHolder, { id, approve: true })).status).toBe('APPROVED')
  })
})
