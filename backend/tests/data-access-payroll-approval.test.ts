import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import * as mailer from '#core/mail/mailer'
import { approvalsService } from '#modules/approvals'
import { attendanceService } from '#modules/attendance'
import { employeesService } from '#modules/employees'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { payrollService } from '#modules/payroll'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as calculationService from '../src/modules/payroll/calculation/calculation.service.js'
import * as checksService from '../src/modules/payroll/checks/checks.service.js'
import * as inputsService from '../src/modules/payroll/inputs/inputs.service.js'
import * as peopleService from '../src/modules/payroll/people/people.service.js'
import { daysIn } from '../src/modules/payroll/people/people.service.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { madeUpSettings, placeAt, workLocationIn } from './helpers/payroll.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 5 (approved by the user 2026-11-27): a run is sent for approval through the one approval service as a
// request about its whole company - the pay-run chain (roles with Payroll View and Salary View only), nobody held, every
// warning acknowledged; the sender never approves; nothing changes while it waits; approved = finalised, rejected or
// withdrawn = a draft again. Made-up rates from 2099 (helpers/payroll.ts) for the March 2100 run. Made-up data only.

const by = { createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }
const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2100, 2, 1))
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
type Level = 'READ' | 'WRITE'

describe('Payroll stage 5: approval and finalising', () => {
  let a: number, b: number, plantA: number, other: number, otherPlant: number
  let e1: number, e2: number, preparer: number, approver: number, plantApprover: number
  let preparerCode: string, approverCode: string
  let role: { id: number; name: string }
  let runA: number, runB: number
  let p1: number
  let from: Date, to: Date, days: number
  let basic: number, canteen: number

  const payroll = (companyId: number | null, level: Level = 'WRITE', id = preparer, code = preparerCode) =>
    userWith({ id, employeeCode: code }, [{ access: { PAYROLL: level, SALARY: 'READ' }, rows: [row(companyId, null, null, level)] }])
  // the approver in the role portal with the pay-run role active
  const approverViewer = () => ({ ...userWith({ id: approver, employeeCode: approverCode }, [{ access: { PAYROLL: 'READ', SALARY: 'READ' }, rows: [row(a, null, null, 'WRITE')] }]), activeRoleId: role.id })
  const locked = () => vi.spyOn(attendanceService, 'payrollLockOf').mockResolvedValue({ locked: true, lockedAt: new Date(Date.UTC(2000, 0, 1)) })
  const run = (id = runA) => payrollService.getRun(admin, { id })
  async function giveSalary(employeeId: number) {
    await prisma.$transaction((tx) =>
      employeesService.saveSalary(
        employeeId,
        { effectiveFrom: new Date(Date.UTC(2026, 0, 1)), annualCtc: 336000, performancePayAnnual: null, currency: 'INR', reason: 'JOINING', jobChangeRequestId: null, approvedAt: null, approvedById: null, lines: [{ salaryComponentId: basic, monthlyAmount: 28000 }] },
        false,
        SYSTEM_ACTOR,
        tx,
      ),
    )
  }
  async function attend(employeeId: number) {
    await prisma.attendanceDay.createMany({
      data: Array.from({ length: days }, (_, i) => ({ employeeId, date: addDays(from, i), status: 'PRESENT' as const, firstHalf: 'PRESENT' as const, secondHalf: 'PRESENT' as const, autoStatus: 'PRESENT' as const, punchCount: 0, workedMinutes: 0, lateMinutes: 0, earlyMinutes: 0, ...by })),
    })
  }

  beforeAll(async () => {
    await madeUpSettings(2099, 'ZS')
    const setup = await payrollService.getSetup(admin, { payMonth })
    from = setup.attendanceFrom
    to = setup.attendanceTo
    days = daysIn(from, to)
    const [ca, cb, cc] = await Promise.all([createCompany(), createCompany(), createCompany()])
    a = ca.id; b = cb.id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    plantA = (await createPlant(a)).id
    const [plantB, plantC] = [(await createPlant(b)).id, (await createPlant(cc.id)).id]
    other = cc.id; otherPlant = plantC
    basic = (await salaryComponentsService.createSalaryComponent({ name: `Basic ${tag}`, kind: 'EARNING', displayOrder: 10 }, SYSTEM_ACTOR)).id
    canteen = (await salaryComponentsService.createSalaryComponent({ name: `Canteen ${tag}`, kind: 'DEDUCTION', displayOrder: 230, enteredMonthly: true }, SYSTEM_ACTOR)).id
    e1 = (await createEmployee({ companyId: a, plantId: plantA })).id
    e2 = (await createEmployee({ companyId: a, plantId: plantA })).id
    const e3 = (await createEmployee({ companyId: b, plantId: plantB })).id
    // the preparer and the approvers work for another company: they are not in run A (the approval rules are tested apart
    // from the "approvers are paid in the run" exception)
    const [prep, appr, plantAppr] = await Promise.all([createEmployee({ companyId: cc.id, plantId: plantC }), createEmployee({ companyId: cc.id, plantId: plantC }), createEmployee({ companyId: cc.id, plantId: plantC })])
    preparer = prep.id; approver = appr.id; plantApprover = plantAppr.id
    preparerCode = prep.employeeCode; approverCode = appr.employeeCode
    await giveSalary(e1)
    await giveSalary(e3)
    const location = await workLocationIn('ZS')
    for (const id of [e1, e2, e3]) {
      await placeAt(id, location.id)
      await attend(id)
    }
    // the pay-run role: Payroll View and Salary View; its holder covers the whole of company A, another only one plant of it
    role = await createRole({ PAYROLL: 'READ', SALARY: 'READ' })
    await giveLogin(approver, [{ roleId: role.id, companyId: a }])
    await prisma.userAccount.create({
      data: { employeeId: plantApprover, passwordHash: 'not-a-real-password', ...by, roles: { create: [{ roleId: role.id, ...by, scopes: { create: [{ companyId: a, plantId: plantA, level: 'WRITE', ...by }] } }] } },
    })
    const input = (companyId: number) => ({ companyId, payMonth, expectedAttendanceFrom: from, expectedAttendanceTo: to })
    runA = (await payrollService.createRun(payroll(a), input(a))).id
    runB = (await payrollService.createRun(payroll(b), input(b))).id
    p1 = (await prisma.payrollRunEmployee.findFirstOrThrow({ where: { payrollRunId: runA, employeeId: e1 }, select: { id: true } })).id
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('a pay-run chain: roles only, each with Payroll View and Salary View; never approved by a timer, never to a manager', async () => {
    const save = (step: Record<string, unknown>) => chainsService.saveChain(admin, { kind: 'PAY_RUN', companyId: a, steps: [step as never] })
    await expect(save({ approverType: 'REPORTING_MANAGER' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const payrollOnly = await createRole({ PAYROLL: 'READ' })
    await expect(save({ approverType: 'ROLE', roleId: payrollOnly.id })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(save({ approverType: 'ROLE', roleId: role.id, slaHours: 24, onBreach: 'AUTO_APPROVE' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(save({ approverType: 'ROLE', roleId: role.id, slaHours: 24, onBreach: 'ESCALATE' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await save({ approverType: 'ROLE', roleId: role.id })
  })

  it('sending is refused with nobody to approve (no chain), while someone is held, or while warnings are open', async () => {
    locked()
    await expect(payrollService.sendRun(payroll(b), { runId: runB })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await run(runB)).status).toBe('DRAFT')
    // e2 has no salary: held
    await expect(payrollService.sendRun(payroll(a), { runId: runA })).rejects.toMatchObject({ code: 'CONFLICT' })
    await giveSalary(e2)
    await peopleService.refresh(payroll(a), { runId: runA, expectedRefreshedAt: (await run()).peopleRefreshedAt })
    // now the warnings stop it: no bank account, no PAN - for both
    await expect(payrollService.sendRun(payroll(a), { runId: runA })).rejects.toMatchObject({ code: 'CONFLICT' })
    const checks = await checksService.listChecks(payroll(a, 'READ'), { runId: runA })
    expect(checks).toMatchObject({ total: 4, open: 4, frozen: false, canAcknowledge: false })
    expect(checks.items.map((i) => i.warning).sort()).toEqual(['NO_BANK_ACCOUNT', 'NO_BANK_ACCOUNT', 'NO_PAN', 'NO_PAN'])
    // (a refused send is undone - its fresh working out too: worked out here to read the page's blockers)
    await calculationService.compute(payroll(a), { runId: runA, expectedComputedAt: (await run()).computedAt })
    expect((await run()).blockers).toEqual(['4 warnings are not acknowledged'])
  })

  it('acknowledging: whole-company Payroll Edit, never one\'s own pay, only warnings that apply', async () => {
    const items = (await checksService.listChecks(payroll(a, 'READ'), { runId: runA })).items.map((i) => ({ personId: i.personId, warning: i.warning }))
    await expect(checksService.acknowledge(payroll(b), { runId: runA, items, comment: 'Made-up check' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(checksService.acknowledge(payroll(a, 'READ'), { runId: runA, items, comment: 'Made-up check' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(checksService.acknowledge(payroll(a, 'WRITE', e1, 'OWN'), { runId: runA, items, comment: 'Made-up check' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // the list marks one's own warnings, so the page never offers them for picking
    const own = (await checksService.listChecks(payroll(a, 'WRITE', e1, 'OWN'), { runId: runA })).items
    expect(own.filter((i) => i.own).map((i) => i.personId)).toEqual([p1, p1])
    await expect(checksService.acknowledge(payroll(a), { runId: runA, items: [{ personId: p1, warning: 'NET_ZERO' }], comment: 'Made-up check' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await checksService.acknowledge(payroll(a), { runId: runA, items, comment: 'Bank and PAN collected - made up' })).toEqual({ acknowledged: 4 })
    expect(await checksService.listChecks(payroll(a), { runId: runA })).toMatchObject({ open: 0, canAcknowledge: true })
    expect(await prisma.auditLog.count({ where: { model: 'PayrollRunAcknowledgement' } })).toBeGreaterThan(0)
  })

  it('sent: in approval, frozen, the sender and a plant-level holder cannot decide; withdrawn: a draft again', async () => {
    locked()
    const sent = await payrollService.sendRun(payroll(a), { runId: runA })
    expect(sent).toMatchObject({ status: 'IN_APPROVAL', canChange: false, canSend: false, approval: { status: 'PENDING', sentBy: { employeeCode: preparerCode }, step: { who: role.name } } })
    const requestId = sent.approval!.requestId
    // nothing changes while it waits
    await expect(inputsService.createInput(payroll(a), { runId: runA, personId: p1, salaryComponentId: canteen, amount: 10, note: 'Made up' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(peopleService.refresh(payroll(a), { runId: runA, expectedRefreshedAt: sent.peopleRefreshedAt })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(calculationService.compute(payroll(a), { runId: runA, expectedComputedAt: sent.computedAt })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(checksService.acknowledge(payroll(a), { runId: runA, items: [{ personId: p1, warning: 'NO_PAN' }], comment: 'Again' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(payrollService.sendRun(payroll(a), { runId: runA })).rejects.toMatchObject({ code: 'CONFLICT' })
    // once sent the checks are the acknowledgements made before (nothing is worked out again)
    expect(await checksService.listChecks(payroll(a, 'READ'), { runId: runA })).toMatchObject({ frozen: true, total: 4, open: 0 })
    // the request is about the company, waits for the role's holders over the whole company - not the sender
    const asRequest = await approvalsService.getRequest(approverViewer(), requestId)
    expect(asRequest).toMatchObject({ employee: null, company: { code: expect.any(String) }, canDecide: true, link: `/manage/payroll/${runA}` })
    expect((await approvalsService.listToDecide(approverViewer())).map((r) => r.id)).toContain(requestId)
    const plantLevel = { ...userWith({ id: plantApprover, employeeCode: 'PLANT' }, [{ access: { PAYROLL: 'READ', SALARY: 'READ' }, rows: [row(a, plantA, null, 'WRITE')] }]), activeRoleId: role.id }
    await expect(approvalsService.decide(plantLevel, { id: requestId, approve: true })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(approvalsService.decide({ ...payroll(a), activeRoleId: role.id }, { id: requestId, approve: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // withdrawn by the sender: a draft again, its acknowledgements kept
    await approvalsService.cancel(payroll(a), { id: requestId, reason: 'Made-up withdrawal' })
    expect(await run()).toMatchObject({ status: 'DRAFT', approval: { status: 'CANCELLED' } })
    expect((await checksService.listChecks(payroll(a), { runId: runA })).open).toBe(0)
  })

  it('late: the pay-run step escalates to the role its chain names, which is then reminded - over the whole company', async () => {
    // a second pay-run role to pass it to; its holder covers the whole of company A and has an e-mail (to see the reminder)
    const upper = await createRole({ PAYROLL: 'READ', SALARY: 'READ' })
    const holder = await createEmployee({ companyId: other, plantId: otherPlant })
    await giveLogin(holder.id, [{ roleId: upper.id, companyId: a }])
    const email = `pay-run-${tag.toLowerCase()}@example.com`
    await prisma.employee.update({ where: { id: holder.id }, data: { workEmail: email, updatedById: SYSTEM_ACTOR } })
    const upperViewer = { ...userWith(holder, [{ access: { PAYROLL: 'READ', SALARY: 'READ' }, rows: [row(a, null, null, 'WRITE')] }]), activeRoleId: upper.id }
    await chainsService.saveChain(admin, { kind: 'PAY_RUN', companyId: a, steps: [{ approverType: 'ROLE', roleId: role.id, slaHours: 8, onBreach: 'ESCALATE', escalateRoleId: upper.id }] })
    locked()
    const id = (await payrollService.sendRun(payroll(a), { runId: runA })).approval!.requestId
    const runLate = async () => {
      await prisma.approvalRequestStep.updateMany({ where: { requestId: id, status: 'OPEN' }, data: { dueAt: new Date(Date.now() - 60 * 60 * 1000) } })
      return approvalsService.runTimeLimits({ requestIds: [id] })
    }
    // the time runs out: passed to the named role - never to a manager or the fallback approver
    await runLate()
    const escalated = await approvalsService.getRequest(admin, id)
    expect(escalated.steps.map((s) => [s.approverType, s.status, s.who])).toEqual([['ROLE', 'ESCALATED', role.name], ['ROLE', 'OPEN', upper.name]])
    expect((await approvalsService.listToDecide(approverViewer())).map((r) => r.id)).not.toContain(id)
    expect((await approvalsService.listToDecide(upperViewer)).map((r) => r.id)).toContain(id)
    expect((await run()).status).toBe('IN_APPROVAL')
    // late again: that role waits and is reminded - the e-mail names the company, not an employee
    const sendMail = vi.spyOn(mailer, 'sendMail').mockResolvedValue('SENT')
    expect(await runLate()).toContain('1 reminded')
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: email, subject: expect.stringContaining('Reminder - to approve: pay run of '), text: expect.stringContaining('/manage/approvals') }))
    // withdrawn, and the plain chain again for the next case
    await approvalsService.cancel(payroll(a), { id, reason: 'Made-up withdrawal' })
    expect((await run()).status).toBe('DRAFT')
    await chainsService.saveChain(admin, { kind: 'PAY_RUN', companyId: a, steps: [{ approverType: 'ROLE', roleId: role.id }] })
  })

  it('rejected: a draft again; sent again and approved: finalised, never to change', async () => {
    locked()
    const first = (await payrollService.sendRun(payroll(a), { runId: runA })).approval!.requestId
    await approvalsService.decide(approverViewer(), { id: first, approve: false, comment: 'Made-up: check the canteen' })
    expect((await run()).status).toBe('DRAFT')
    locked()
    const second = (await payrollService.sendRun(payroll(a), { runId: runA })).approval!.requestId
    expect(second).not.toBe(first)
    // the old request no longer belongs to the run: its link opens the runs list, and deciding it changes nothing here
    expect((await approvalsService.getRequest(admin, first)).link).toBe('/manage/payroll')
    await approvalsService.decide(approverViewer(), { id: second, approve: true })
    const finalised = await run()
    expect(finalised).toMatchObject({ status: 'FINALISED', finalisedBy: { employeeCode: approverCode }, canChange: false, canSend: false, daysOutdated: false })
    expect(finalised.finalisedAt).toBeInstanceOf(Date)
    await expect(inputsService.createInput(payroll(a), { runId: runA, personId: p1, salaryComponentId: canteen, amount: 10, note: 'Made up' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(payrollService.sendRun(payroll(a), { runId: runA })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
