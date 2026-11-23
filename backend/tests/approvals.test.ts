import { prisma } from '#core/db/prisma'
import { approvalsService } from '#modules/approvals'
import { designationsService } from '#modules/organization'
import { SYSTEM_ACTOR } from '#core/db/prisma'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as jobChangesService from '../src/modules/job-changes/job-changes.service.js'
import { employeesService } from '#modules/employees'
import { createRole, fallbackRoleId, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The approval service (the user, 2026-11-20): chains of steps, skipped vacant steps, the fallback approver, held
// requests, nobody deciding their own, one decision per step, and data access.
const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()

type Viewer = ReturnType<typeof userWith>
const viewerOf = (employee: { id: number; employeeCode: string }, companyId: number, access: Parameters<typeof userWith>[1][number]['access'] = {}): Viewer =>
  userWith(employee, [{ access, rows: [row(companyId, null, null)] }])

describe('the approval service', () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let plantB: number
  let role: { id: number }
  let hr: Viewer
  let hrEmployee: { id: number; employeeCode: string }
  let approver: Viewer
  let approverB: Viewer
  let designation: number
  // an admin of company A's chains (Roles & access Edit for the whole company)
  let chainsAdmin: Viewer

  // a job change of a new employee of the company (the designation changes from 01-02-2026); its approval request's id
  async function raise(companyId: number, plantId: number) {
    const employee = await createEmployee({ companyId, plantId })
    const change = await jobChangesService.createJobChange(
      { employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Test', designationId: designation },
      companyId === companyA ? hr : viewerOf(hrEmployee, companyId, { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }),
    )
    return { employee, change, approvalId: change.approvalRequestId }
  }

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    plantB = (await createPlant(companyB)).id
    designation = (await designationsService.createDesignation({ name: `Approval test ${tag}` }, SYSTEM_ACTOR)).id
    role = await createRole()
    hrEmployee = await createEmployee({ companyId: companyA, plantId: plantA })
    hr = viewerOf(hrEmployee, companyA, { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' })
    // the role's holders: one for company A, one for company B
    const a = await createEmployee({ companyId: companyA, plantId: plantA })
    const b = await createEmployee({ companyId: companyB, plantId: plantB })
    await giveLogin(a.id, [{ roleId: role.id, companyId: companyA }])
    await giveLogin(b.id, [{ roleId: role.id, companyId: companyB }])
    approver = { ...viewerOf(a, companyA), activeRoleId: role.id }
    approverB = { ...viewerOf(b, companyB), activeRoleId: role.id }
    chainsAdmin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null), row(companyB, null, null)] }])
    for (const companyId of [companyA, companyB]) {
      await chainsService.saveChain(chainsAdmin, { kind: 'JOB_CHANGE', companyId, steps: [{ approverType: 'REPORTING_MANAGER', seesConfidential: false }, { approverType: 'ROLE', roleId: role.id, seesConfidential: false }] })
    }
  })
  afterAll(() => prisma.$disconnect())

  it("skips a vacant manager step, opens the role step for its holders, and never lets the requester decide", async () => {
    const { employee, approvalId } = await raise(companyA, plantA)
    const request = await approvalsService.getRequest(hr, approvalId)
    expect(request.steps.map((s) => [s.who, s.status])).toEqual([
      ['Reporting manager', 'SKIPPED'],
      [expect.stringContaining('Test role'), 'OPEN'],
    ])
    expect(request.steps[0]!.note).toBe('No reporting manager')
    expect((await approvalsService.listToDecide(approver)).map((r) => r.id)).toContain(approvalId)
    expect((await approvalsService.listToDecide(hr)).map((r) => r.id)).not.toContain(approvalId)
    await expect(approvalsService.decide(hr, { id: approvalId, approve: true })).rejects.toThrow('not yours to decide')
    const decided = await approvalsService.decide(approver, { id: approvalId, approve: true })
    expect(decided.status).toBe('APPROVED')
    // the day has come: applied at once
    expect((await employeesService.getByCode(employee.employeeCode)).designation?.id).toBe(designation)
  })

  it('names the step to the reporting manager - who must be able to sign in', async () => {
    const manager = await createEmployee({ companyId: companyA, plantId: plantA })
    const direct = viewerOf(hrEmployee, companyA, { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' })
    const withManager = async () => {
      const employee = await createEmployee({ companyId: companyA, plantId: plantA })
      await employeesService.updateEmployee({ employeeCode: employee.employeeCode, reportingManagerCode: manager.employeeCode }, direct)
      const change = await jobChangesService.createJobChange(
        { employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Test', designationId: designation },
        hr,
      )
      return approvalsService.getRequest(hr, change.approvalRequestId)
    }
    // no login: skipped
    expect((await withManager()).steps[0]).toMatchObject({ status: 'SKIPPED', note: expect.stringContaining('cannot sign in') })
    await giveLogin(manager.id, [])
    const named = await withManager()
    expect(named.steps[0]).toMatchObject({ status: 'OPEN', approver: { employeeCode: manager.employeeCode } })
    expect((await approvalsService.listToDecide(viewerOf(manager, companyA))).map((r) => r.id)).toContain(named.id)
  })

  it('goes to the fallback approver when every step is skipped or nobody holds a role - and holds it when even that has nobody', async () => {
    const companyF = (await createCompany()).id
    const plantF = (await createPlant(companyF)).id
    const fAdmin = userWith({ id: 0, employeeCode: 'FADMIN' }, [{ access: { APPROVAL_CHAINS: 'WRITE', EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyF, null, null)] }])
    await chainsService.saveChain(fAdmin, { kind: 'JOB_CHANGE', companyId: companyF, steps: [{ approverType: 'REPORTING_MANAGER', seesConfidential: false }] })
    const { approvalId } = await raise(companyF, plantF)
    const held = await approvalsService.getRequest(fAdmin, approvalId)
    expect(held.steps.map((s) => [s.approverType, s.status])).toEqual([
      ['REPORTING_MANAGER', 'SKIPPED'],
      ['FALLBACK', 'WAITING'],
    ])
    expect(held.held?.reason).toContain('not even the fallback approver')
    expect((await approvalsService.listHeld(fAdmin)).map((r) => r.id)).toContain(approvalId)
    // the fallback role is given for company F: sent through again, it reaches them - never approved by itself
    const admin = await createEmployee({ companyId: companyF, plantId: plantF })
    await giveLogin(admin.id, [{ roleId: await fallbackRoleId(), companyId: companyF }])
    const retried = await approvalsService.retryRouting(fAdmin, approvalId)
    expect([retried.status, retried.held, retried.steps.at(-1)!.status]).toEqual(['PENDING', null, 'OPEN'])
    const adminViewer = { ...viewerOf(admin, companyF), activeRoleId: await fallbackRoleId(), activeRoleIsFallback: true }
    expect((await approvalsService.listToDecide(adminViewer)).map((r) => r.id)).toContain(approvalId)
    expect((await approvalsService.decide(adminViewer, { id: approvalId, approve: true })).status).toBe('APPROVED')

    // a role step nobody holds for the employee: the fallback approver decides it in its place
    const nobodysRole = await createRole()
    await chainsService.saveChain(fAdmin, { kind: 'JOB_CHANGE', companyId: companyF, steps: [{ approverType: 'ROLE', roleId: nobodysRole.id, seesConfidential: false }] })
    const second = await raise(companyF, plantF)
    const byFallback = await approvalsService.getRequest(fAdmin, second.approvalId)
    expect(byFallback.steps[0]).toMatchObject({ status: 'OPEN', byFallback: true, note: expect.stringContaining('the fallback approver decides it') })
    expect((await approvalsService.listToDecide(adminViewer)).map((r) => r.id)).toContain(second.approvalId)
  })

  // found in the 2026-11-23 review: a role step whose only holder lost the role after it opened waited for nobody, unseen
  it('holds a role step whose approvers are all gone, and sends it to the fallback approver once there is one', async () => {
    const companyG = (await createCompany()).id
    const plantG = (await createPlant(companyG)).id
    const gAdmin = userWith({ id: 0, employeeCode: 'GADMIN' }, [{ access: { APPROVAL_CHAINS: 'WRITE', EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyG, null, null)] }])
    const onlyRole = await createRole()
    const holder = await createEmployee({ companyId: companyG, plantId: plantG })
    const login = await giveLogin(holder.id, [{ roleId: onlyRole.id, companyId: companyG }])
    await chainsService.saveChain(gAdmin, { kind: 'JOB_CHANGE', companyId: companyG, steps: [{ approverType: 'ROLE', roleId: onlyRole.id, seesConfidential: false }] })
    const { approvalId } = await raise(companyG, plantG)
    expect((await approvalsService.getRequest(gAdmin, approvalId)).steps[0]).toMatchObject({ status: 'OPEN', byFallback: false })
    // the only holder loses the role
    await prisma.userAccountRole.deleteMany({ where: { accountId: login.id } })
    await approvalsService.runDaily({ requestIds: [approvalId] })
    const held = await approvalsService.getRequest(gAdmin, approvalId)
    expect(held.held?.reason).toContain('not even the fallback approver')
    expect(held.steps[0]).toMatchObject({ status: 'WAITING' })
    expect((await approvalsService.listHeld(gAdmin)).map((r) => r.id)).toContain(approvalId)
    // a fallback approver for company G: sent through again, it is theirs - never approved by itself
    const admin = await createEmployee({ companyId: companyG, plantId: plantG })
    await giveLogin(admin.id, [{ roleId: await fallbackRoleId(), companyId: companyG }])
    const retried = await approvalsService.retryRouting(gAdmin, approvalId)
    expect([retried.status, retried.held, retried.steps[0]!.status, retried.steps[0]!.byFallback]).toEqual(['PENDING', null, 'OPEN', true])
  })

  it('rejects only with a reason, lets the requester cancel, and takes one decision per step', async () => {
    const first = await raise(companyA, plantA)
    await expect(approvalsService.decide(approver, { id: first.approvalId, approve: false })).rejects.toThrow('reason')
    const rejected = await approvalsService.decide(approver, { id: first.approvalId, approve: false, comment: 'Not this year' })
    expect(rejected.status).toBe('REJECTED')
    expect((await jobChangesService.getJobChange(hr, first.change.id)).status).toBe('REJECTED')
    await expect(approvalsService.decide(approver, { id: first.approvalId, approve: true })).rejects.toThrow('already decided')
    // "Decided by me": the approver's rejection with its reason - not the requester's list
    expect((await approvalsService.listDecided(approver)).find((r) => r.id === first.approvalId)).toMatchObject({
      status: 'REJECTED',
      decision: { status: 'REJECTED', comment: 'Not this year' },
    })
    expect((await approvalsService.listDecided(hr)).map((r) => r.id)).not.toContain(first.approvalId)

    const second = await raise(companyA, plantA)
    const cancelled = await approvalsService.cancel(hr, { id: second.approvalId, reason: 'Asked by mistake' })
    expect(cancelled.status).toBe('CANCELLED')
    expect((await jobChangesService.getJobChange(hr, second.change.id))).toMatchObject({ status: 'CANCELLED', cancelReason: 'Asked by mistake' })
  })

  it('shows and decides requests only inside the approver\'s data access', async () => {
    const inB = await raise(companyB, plantB)
    expect((await approvalsService.listToDecide(approver)).map((r) => r.id)).not.toContain(inB.approvalId)
    expect((await approvalsService.listToDecide(approverB)).map((r) => r.id)).toContain(inB.approvalId)
    await expect(approvalsService.getRequest(approver, inB.approvalId)).rejects.toThrow('No approval request found')
    await expect(approvalsService.decide(approver, { id: inB.approvalId, approve: true })).rejects.toThrow('No approval request found')
  })

  it('requires the assigned approval role to be active for both the inbox and the decision', async () => {
    const { approvalId } = await raise(companyA, plantA)
    const inactive = { ...approver, activeRoleId: -999, activeRoleIsFallback: false }
    expect((await approvalsService.listToDecide(inactive)).map((r) => r.id)).not.toContain(approvalId)
    await expect(approvalsService.decide(inactive, { id: approvalId, approve: true })).rejects.toThrow()
    const active = { ...approver, activeRoleId: role.id, activeRoleIsFallback: false }
    expect((await approvalsService.listToDecide(active)).map((r) => r.id)).toContain(approvalId)
    expect((await approvalsService.decide(active, { id: approvalId, approve: true })).status).toBe('APPROVED')
  })

  it('merges two chains keeping each one\'s order, asking the same approver once', () => {
    const step = (approverType: 'REPORTING_MANAGER' | 'HOD' | 'ROLE', roleId: number | null = null, seesConfidential = false) => ({ approverType, roleId, roleName: null, accessArea: null, approverId: null, seesConfidential, slaHours: null, onBreach: 'WAIT' as const, escalateRoleId: null, escalateRoleName: null })
    const job = [step('REPORTING_MANAGER'), step('ROLE', 1), step('ROLE', 2)]
    const salary = [step('REPORTING_MANAGER', null, true), step('HOD', null, true), step('ROLE', 1, true), step('ROLE', 2, true)]
    expect(chainsService.mergeChains([job, salary]).map((s) => [s.approverType, s.roleId, s.seesConfidential])).toEqual([
      ['REPORTING_MANAGER', null, true],
      ['HOD', null, true],
      ['ROLE', 1, true],
      ['ROLE', 2, true],
    ])
  })

  it('names a role step to one holder covering the whole chain - only they decide it, else the fallback approver', async () => {
    const companyN = (await createCompany()).id
    const plantN = (await createPlant(companyN)).id
    const other = (await createCompany()).id
    const nRole = await createRole()
    const [p1, p2, p3, admin] = await Promise.all([1, 2, 3, 4].map(() => createEmployee({ companyId: companyN, plantId: plantN })))
    await giveLogin(p1!.id, [{ roleId: nRole.id, companyId: companyN }])
    await giveLogin(p2!.id, [{ roleId: nRole.id, companyId: companyN }])
    await giveLogin(p3!.id, [{ roleId: nRole.id, companyId: other }])
    await giveLogin(admin!.id, [{ roleId: await fallbackRoleId(), companyId: companyN }])
    const nAdmin = userWith({ id: 0, employeeCode: 'NADMIN' }, [{ access: { APPROVAL_CHAINS: 'WRITE', EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyN, null, null)] }])
    const groupAdmin = userWith({ id: 0, employeeCode: 'GADMIN' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(null, null, null)] }])
    // the picker offers the holders with how far they hold it; only one holding it for the whole chain may be saved
    const holders = (await chainsService.listChains()).roles.find((r) => r.id === nRole.id)!.holders
    expect(holders.find((h) => h.employeeId === p1!.id)).toMatchObject({ everyCompany: false, companyIds: [companyN] })
    const named = (approverId: number) => [{ approverType: 'ROLE' as const, roleId: nRole.id, approverId, seesConfidential: false }]
    await expect(chainsService.saveChain(nAdmin, { kind: 'JOB_CHANGE', companyId: companyN, steps: named(p3!.id) })).rejects.toThrow('for the whole company')
    await expect(chainsService.saveChain(groupAdmin, { kind: 'JOB_CHANGE', companyId: null, steps: named(p1!.id) })).rejects.toThrow('for every company')
    await chainsService.saveChain(nAdmin, { kind: 'JOB_CHANGE', companyId: companyN, steps: named(p1!.id) })
    const first = await raise(companyN, plantN)
    const request = await approvalsService.getRequest(nAdmin, first.approvalId)
    expect(request.steps[0]).toMatchObject({ status: 'OPEN', byFallback: false, approver: { employeeCode: p1!.employeeCode } })
    expect((await approvalsService.listToDecide({ ...viewerOf(p1!, companyN), activeRoleId: nRole.id })).map((r) => r.id)).toContain(first.approvalId)
    expect((await approvalsService.listToDecide({ ...viewerOf(p2!, companyN), activeRoleId: nRole.id })).map((r) => r.id)).not.toContain(first.approvalId)
    // the role's other holder does not even see it
    await expect(approvalsService.decide({ ...viewerOf(p2!, companyN), activeRoleId: nRole.id }, { id: first.approvalId, approve: true })).rejects.toThrow('No approval request found')
    // their login is switched off: a new request goes to the fallback approver, not to the role's other holder
    await prisma.userAccount.updateMany({ where: { employeeId: p1!.id }, data: { disabledAt: new Date() } })
    const second = await raise(companyN, plantN)
    const fallen = await approvalsService.getRequest(nAdmin, second.approvalId)
    expect(fallen.steps[0]).toMatchObject({ status: 'OPEN', byFallback: true, note: expect.stringContaining('the fallback approver decides it') })
    expect((await approvalsService.listToDecide({ ...viewerOf(admin!, companyN), activeRoleId: await fallbackRoleId(), activeRoleIsFallback: true })).map((r) => r.id)).toContain(second.approvalId)
    expect((await approvalsService.listToDecide({ ...viewerOf(p2!, companyN), activeRoleId: nRole.id })).map((r) => r.id)).not.toContain(second.approvalId)
  })

  it('changes chains and repairs held requests only inside the data access', async () => {
    // the shared chain needs every company; another company's own chain its whole company
    const adminOfA = userWith({ id: 0, employeeCode: 'ADMA' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await expect(chainsService.saveChain(adminOfA, { kind: 'JOB_CHANGE', companyId: null, steps: [{ approverType: 'HOD', seesConfidential: false }] })).rejects.toThrow('shared by every company')
    await expect(chainsService.saveChain(adminOfA, { kind: 'JOB_CHANGE', companyId: companyB, steps: [{ approverType: 'HOD', seesConfidential: false }] })).rejects.toThrow('whole company')
    // Roles & access is not enough: the chains are their own area (2026-11-20)
    const rolesAdmin = userWith({ id: 0, employeeCode: 'ROLES' }, [{ access: { ACCESS: 'WRITE' }, rows: [row(null, null, null)] }])
    await expect(chainsService.saveChain(rolesAdmin, { kind: 'JOB_CHANGE', companyId: companyA, steps: [{ approverType: 'HOD', seesConfidential: false }] })).rejects.toThrow('whole company')
    expect((await approvalsService.listHeld(rolesAdmin)).length).toBe(0)
    // a held request of company H: not in A's repairer's list, not theirs to send through again
    const companyH = (await createCompany()).id
    const plantH = (await createPlant(companyH)).id
    const adminOfH = userWith({ id: 0, employeeCode: 'ADMH' }, [{ access: { APPROVAL_CHAINS: 'WRITE', EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyH, null, null)] }])
    await chainsService.saveChain(adminOfH, { kind: 'JOB_CHANGE', companyId: companyH, steps: [{ approverType: 'REPORTING_MANAGER', seesConfidential: false }] })
    const held = await raise(companyH, plantH)
    expect((await approvalsService.listHeld(adminOfH)).map((r) => r.id)).toContain(held.approvalId)
    expect((await approvalsService.listHeld(adminOfA)).map((r) => r.id)).not.toContain(held.approvalId)
    await expect(approvalsService.retryRouting(adminOfA, held.approvalId)).rejects.toThrow('No approval request found')
  })
})

describe('the daily job of approvals', () => {
  const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
  let company: number
  let plant: number
  let hr: Viewer
  let direct: Viewer
  let role: { id: number }
  let designation: number

  const raiseFor = async (employeeCode: string) => {
    const change = await jobChangesService.createJobChange({ employeeCode, effectiveFrom: day(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Test', designationId: designation }, hr)
    return change.approvalRequestId
  }
  const withLogin = async () => {
    const person = await createEmployee({ companyId: company, plantId: plant })
    await giveLogin(person.id, [])
    return person
  }
  const stepsOf = async (id: number) => (await approvalsService.getRequest(direct, id)).steps

  beforeAll(async () => {
    company = (await createCompany()).id
    plant = (await createPlant(company)).id
    designation = (await designationsService.createDesignation({ name: `Daily ${tag}` }, SYSTEM_ACTOR)).id
    role = await createRole()
    const roleHolder = await createEmployee({ companyId: company, plantId: plant })
    await giveLogin(roleHolder.id, [{ roleId: role.id, companyId: company }])
    const hrEmployee = await createEmployee({ companyId: company, plantId: plant })
    hr = viewerOf(hrEmployee, company, { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' })
    direct = userWith({ id: 0, employeeCode: 'DIRECT' }, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE', APPROVAL_CHAINS: 'WRITE' }, rows: [row(company, null, null)] }])
    await chainsService.saveChain(direct, {
      kind: 'JOB_CHANGE',
      companyId: company,
      steps: [
        { approverType: 'REPORTING_MANAGER', seesConfidential: false },
        { approverType: 'ROLE', roleId: role.id, seesConfidential: false },
      ],
    })
  })

  it('cancels the requests of an employee who left, follows a change of manager, skips a manager who is gone', async () => {
    // left
    const leaver = await createEmployee({ companyId: company, plantId: plant })
    const leaverRequest = await raiseFor(leaver.employeeCode)
    await prisma.employee.update({ where: { id: leaver.id }, data: { status: 'EXITED', updatedById: SYSTEM_ACTOR } })
    // a new manager
    const [m1, m2, m3] = [await withLogin(), await withLogin(), await withLogin()]
    const moved = await createEmployee({ companyId: company, plantId: plant })
    await employeesService.updateEmployee({ employeeCode: moved.employeeCode, reportingManagerCode: m1.employeeCode }, direct)
    const movedRequest = await raiseFor(moved.employeeCode)
    expect((await stepsOf(movedRequest))[0]).toMatchObject({ status: 'OPEN', approver: { employeeCode: m1.employeeCode } })
    await employeesService.updateEmployee({ employeeCode: moved.employeeCode, reportingManagerCode: m2.employeeCode }, direct)
    // no manager any more
    const orphan = await createEmployee({ companyId: company, plantId: plant })
    await employeesService.updateEmployee({ employeeCode: orphan.employeeCode, reportingManagerCode: m3.employeeCode }, direct)
    const orphanRequest = await raiseFor(orphan.employeeCode)
    await employeesService.updateEmployee({ employeeCode: orphan.employeeCode, reportingManagerCode: null }, direct)

    await approvalsService.runDaily({ requestIds: [leaverRequest, movedRequest, orphanRequest] })

    expect((await approvalsService.getRequest(direct, leaverRequest))).toMatchObject({ status: 'CANCELLED', cancelReason: 'The employee has left' })
    expect((await stepsOf(movedRequest))[0]).toMatchObject({ status: 'OPEN', approver: { employeeCode: m2.employeeCode } })
    expect((await stepsOf(orphanRequest)).map((s) => s.status)).toEqual(['SKIPPED', 'OPEN'])
  })

  it('leaves a held request untouched while nobody can decide it, and sends it on once someone can', async () => {
    const companyH = (await createCompany()).id
    const plantH = (await createPlant(companyH)).id
    const adminOfH = userWith({ id: 0, employeeCode: 'ADMH' }, [{ access: { APPROVAL_CHAINS: 'WRITE', EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyH, null, null)] }])
    await chainsService.saveChain(adminOfH, { kind: 'JOB_CHANGE', companyId: companyH, steps: [{ approverType: 'REPORTING_MANAGER', seesConfidential: false }] })
    const employee = await createEmployee({ companyId: companyH, plantId: plantH })
    const change = await jobChangesService.createJobChange(
      { employeeCode: employee.employeeCode, effectiveFrom: day(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Test', designationId: designation },
      adminOfH,
    )
    const before = await prisma.approvalRequest.findUnique({ where: { id: change.approvalRequestId }, select: { heldAt: true, updatedAt: true } })
    expect(before?.heldAt).not.toBeNull()
    await approvalsService.runDaily({ requestIds: [change.approvalRequestId] })
    const after = await prisma.approvalRequest.findUnique({ where: { id: change.approvalRequestId }, select: { heldAt: true, updatedAt: true } })
    expect(after).toEqual(before)
    const admin = await createEmployee({ companyId: companyH, plantId: plantH })
    await giveLogin(admin.id, [{ roleId: await fallbackRoleId(), companyId: companyH }])
    await approvalsService.runDaily({ requestIds: [change.approvalRequestId] })
    const sentOn = await approvalsService.getRequest(adminOfH, change.approvalRequestId)
    expect([sentOn.held, sentOn.steps.at(-1)?.status]).toEqual([null, 'OPEN'])
  })
})
