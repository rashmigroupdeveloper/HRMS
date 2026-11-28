import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma, SYSTEM_ACTOR, type StatutoryScheme } from '#core/db/prisma'
import { readFirstSheet } from '#core/excel/workbook'
import * as mailer from '#core/mail/mailer'
import { attendanceService } from '#modules/attendance'
import { employeesService } from '#modules/employees'
import { letterTemplatesService } from '#modules/letter-templates'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { payrollService } from '#modules/payroll'
import * as calculationService from '../src/modules/payroll/calculation/calculation.service.js'
import * as depositsService from '../src/modules/payroll/deposits/deposits.service.js'
import * as statutoryService from '../src/modules/payroll/statutory/statutory.service.js'
import { daysIn } from '../src/modules/payroll/people/people.service.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { madeUpSettings, placeAt, roleComponents, workLocationIn } from './helpers/payroll.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 6 slice 3 (approved by the user 2026-11-28): statutory deposits - the "Statutory deposits" area over the
// whole company; what an approved run must deposit (worked out, never stored), the returns / challans recorded, the people
// left out of a PF / ESIC return; each person's amounts only with Salary View too; one's own months once the payslips are
// released. Made-up rates from 2105 for the March 2106 run, made-up States ZK and ZL. Made-up data only.

const by = { createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }
const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2106, 2, 1))
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const digits = String(Math.floor(Math.random() * 90000000) + 10000000)
const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
const yesterday = addDays(new Date(new Date().setUTCHours(0, 0, 0, 0)), -1)
const settingsFrom = new Date(Date.UTC(2105, 0, 1))
type Level = 'READ' | 'WRITE'
const ROLES = {
  PF: ['PF_EMPLOYEE', 'PF_EMPLOYER', 'EPS', 'EDLI'],
  ESIC: ['ESIC_EMPLOYEE', 'ESIC_EMPLOYER'],
  PROFESSIONAL_TAX: ['PROFESSIONAL_TAX'],
  LWF: ['LWF_EMPLOYEE', 'LWF_EMPLOYER'],
} as const

describe('Payroll stage 6: statutory deposits', () => {
  let a: number, b: number, plantA: number
  let m1: number, m2: number, m3: number, clerk: number
  let m1Code: string, m2Code: string, clerkCode: string
  let runA: number, p2: number, p3: number

  // the deposits area over a whole company (or one plant of it); with Salary View too when asked
  const deposits = (companyId: number, level: Level = 'WRITE', extra: { SALARY?: Level } = {}, id = clerk, code = clerkCode, plantId: number | null = null) =>
    userWith({ id, employeeCode: code }, [{ access: { STATUTORY_DEPOSITS: level, ...extra }, rows: [row(companyId, plantId, null, level)] }])
  const payroll = (companyId: number) => userWith({ id: clerk, employeeCode: clerkCode }, [{ access: { PAYROLL: 'WRITE', SALARY: 'READ' }, rows: [row(companyId, null, null, 'WRITE')] }])
  const locked = () => vi.spyOn(attendanceService, 'payrollLockOf').mockResolvedValue({ locked: true, lockedAt: new Date(Date.UTC(2000, 0, 1)) })
  const month = { companyId: 0, payMonth }
  const lineOf = async (scheme: StatutoryScheme, stateCode: string | null = null, viewer = deposits(a, 'READ')) =>
    (await depositsService.getMonth(viewer, { ...month, companyId: a })).lines.find((l) => l.scheme === scheme && l.stateCode === stateCode)
  // what the run worked out for the scheme, added up here on its own (in paise)
  const dueOf = async (scheme: keyof typeof ROLES, personIds?: number[]) => {
    const lines = await prisma.payrollRunLine.findMany({
      where: { runEmployee: { payrollRunId: runA, ...(personIds && { id: { in: personIds } }) }, salaryComponent: { statutoryRole: { in: [...ROLES[scheme]] } } },
      select: { amount: true },
    })
    return lines.reduce((total, l) => total + Math.round(l.amount.toNumber() * 100), 0) / 100
  }
  async function dueDate(scheme: StatutoryScheme, stateCode: string | null, day: number) {
    await prisma.statutoryDueDate.deleteMany({ where: { scheme, stateCode, effectiveFrom: settingsFrom } })
    await prisma.statutoryDueDate.create({ data: { scheme, stateCode, effectiveFrom: settingsFrom, day, reference: 'made up for tests', ...by } })
  }

  beforeAll(async () => {
    // made-up settings from 2105: professional tax 200 in ZK and 150 in ZL from a gross of 0; LWF 10 / 30 every month in ZK
    await madeUpSettings(2105, 'ZK')
    await madeUpSettings(2105, 'ZL')
    for (const [state, amount] of [['ZK', 200], ['ZL', 150]] as const) {
      await prisma.professionalTaxSlab.deleteMany({ where: { stateCode: state, effectiveFrom: settingsFrom } })
      await prisma.professionalTaxSlab.create({ data: { stateCode: state, effectiveFrom: settingsFrom, wagesFrom: 0, amount, reference: 'made up', ...by } })
    }
    await prisma.labourWelfareRate.update({ where: { stateCode_effectiveFrom: { stateCode: 'ZK', effectiveFrom: settingsFrom } }, data: { employeeAmount: 10, employerAmount: 30, months: [] } })
    // due on the 15th (PF, ESIC, LWF in ZK) and the 21st (professional tax in ZK); ZL's professional tax has no due date
    await dueDate('PF', null, 15)
    await dueDate('ESIC', null, 15)
    await dueDate('PROFESSIONAL_TAX', 'ZK', 21)
    await dueDate('LWF', 'ZK', 15)
    await prisma.statutoryDueDate.deleteMany({ where: { stateCode: 'ZL' } })
    await roleComponents()

    const setup = await payrollService.getSetup(admin, { payMonth })
    const [from, to] = [setup.attendanceFrom, setup.attendanceTo]
    const days = daysIn(from, to)
    const [ca, cb, cc] = await Promise.all([createCompany(), createCompany(), createCompany()])
    a = ca.id; b = cb.id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    plantA = (await createPlant(a)).id
    const plantC = (await createPlant(cc.id)).id
    const basic = (await salaryComponentsService.createSalaryComponent({ name: `Basic ${tag}`, kind: 'EARNING', displayOrder: 10, pfWage: true }, SYSTEM_ACTOR)).id
    const make = async (monthly: number) => {
      const { id, employeeCode } = await createEmployee({ companyId: a, plantId: plantA })
      await prisma.employee.update({ where: { id }, data: { dateOfBirth: new Date(Date.UTC(2075, 0, 1)), gender: 'MALE' } })
      await prisma.$transaction((tx) =>
        employeesService.saveSalary(
          id,
          { effectiveFrom: new Date(Date.UTC(2026, 0, 1)), annualCtc: monthly * 12, performancePayAnnual: null, currency: 'INR', reason: 'JOINING', jobChangeRequestId: null, approvedAt: null, approvedById: null, lines: [{ salaryComponentId: basic, monthlyAmount: monthly }] },
          false,
          SYSTEM_ACTOR,
          tx,
        ),
      )
      await prisma.attendanceDay.createMany({
        data: Array.from({ length: days }, (_, i) => ({ employeeId: id, date: addDays(from, i), status: 'PRESENT' as const, firstHalf: 'PRESENT' as const, secondHalf: 'PRESENT' as const, autoStatus: 'PRESENT' as const, punchCount: 0, workedMinutes: 0, lateMinutes: 0, earlyMinutes: 0, ...by })),
      })
      return { id, employeeCode }
    }
    // m1 and m2: PF members (above the made-up ESIC ceiling of 20,000), m1 with a UAN, m2 without; m3: ESIC only, no number
    const [one, two, three] = [await make(28000), await make(28000), await make(15000)]
    m1 = one.id; m2 = two.id; m3 = three.id
    m1Code = one.employeeCode; m2Code = two.employeeCode
    await prisma.employeeStatutory.create({ data: { employeeId: m1, pfApplicable: true, uan: `9${digits}123`, ...by } })
    await prisma.employeeStatutory.create({ data: { employeeId: m2, pfApplicable: true, ...by } })
    const [zk, zl] = [await workLocationIn('ZK'), await workLocationIn('ZL')]
    await placeAt(m1, zk.id)
    await placeAt(m2, zk.id)
    await placeAt(m3, zl.id)
    const me = await createEmployee({ companyId: cc.id, plantId: plantC })
    clerk = me.id; clerkCode = me.employeeCode

    runA = (await payrollService.createRun(payroll(a), { companyId: a, payMonth, expectedAttendanceFrom: from, expectedAttendanceTo: to })).id
    const person = async (employeeId: number) => (await prisma.payrollRunEmployee.findFirstOrThrow({ where: { payrollRunId: runA, employeeId }, select: { id: true } })).id
    ;[p2, p3] = [await person(m2), await person(m3)]
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('what is due: worked out from approved runs only, over the whole company; company totals, no one\'s amounts', async () => {
    locked()
    await calculationService.compute(payroll(a), { runId: runA, expectedComputedAt: null })
    // a draft deposits nothing
    expect((await depositsService.listDeposits(deposits(a, 'READ'), { companyId: a, show: 'ALL', page: 1, pageSize: 50 })).items).toEqual([])
    await expect(depositsService.getMonth(deposits(a, 'READ'), { companyId: a, payMonth })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // (finalised directly - the approval is tested in data-access-payroll-approval)
    await prisma.payrollRun.update({ where: { id: runA }, data: { status: 'FINALISED', finalisedAt: new Date(), finalisedById: SYSTEM_ACTOR } })

    const list = await depositsService.listDeposits(deposits(a, 'READ'), { companyId: a, show: 'OPEN', page: 1, pageSize: 50 })
    expect(list.items.map((l) => [l.scheme, l.stateCode, l.state]).sort()).toEqual(
      [['ESIC', null, 'NOT_DEPOSITED'], ['LWF', 'ZK', 'NOT_DEPOSITED'], ['PF', null, 'NOT_DEPOSITED'], ['PROFESSIONAL_TAX', 'ZK', 'NOT_DEPOSITED'], ['PROFESSIONAL_TAX', 'ZL', 'NOT_DEPOSITED']].sort(),
    )
    const pf = list.items.find((l) => l.scheme === 'PF')!
    expect(pf).toMatchObject({ people: 2, due: await dueOf('PF'), dueOn: new Date(Date.UTC(2106, 3, 15)), deposited: 0 })
    expect(list.items.find((l) => l.scheme === 'PROFESSIONAL_TAX' && l.stateCode === 'ZK')).toMatchObject({ people: 2, due: 400, dueOn: new Date(Date.UTC(2106, 3, 21)) })
    // no due date set for ZL: never guessed
    expect(list.items.find((l) => l.scheme === 'PROFESSIONAL_TAX' && l.stateCode === 'ZL')).toMatchObject({ due: 150, dueOn: null })
    expect(list.counts).toMatchObject({ open: 5, noDueDate: 1 })
    expect(list.companies.find((c) => c.id === a)).toMatchObject({ canRecord: false })

    // another company's viewer, or one holding a single plant of it, sees none of it
    expect((await depositsService.listDeposits(deposits(b, 'READ'), { companyId: a, show: 'ALL', page: 1, pageSize: 50 })).items).toEqual([])
    expect((await depositsService.listDeposits(deposits(a, 'READ', {}, clerk, clerkCode, plantA), { companyId: a, show: 'ALL', page: 1, pageSize: 50 })).items).toEqual([])
    await expect(depositsService.getMonth(deposits(b, 'READ'), { companyId: a, payMonth })).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // the month: who has no UAN / ESIC number yet; the people without their amounts unless Salary View covers the company too
    const view = await depositsService.getMonth(deposits(a, 'READ'), { companyId: a, payMonth })
    expect(view).toMatchObject({ canRecord: false, seesAmounts: false })
    expect(view.lines.find((l) => l.scheme === 'PF')).toMatchObject({ noNumber: 1 })
    expect(view.lines.find((l) => l.scheme === 'ESIC')).toMatchObject({ noNumber: 1, people: 1 })
    const people = await depositsService.listPeople(deposits(a, 'READ'), { companyId: a, payMonth, scheme: 'PF', show: 'ALL', page: 1, pageSize: 50 })
    expect(people.items.map((p) => [p.employeeCode, p.number, p.amounts]).sort()).toEqual([[m1Code, `9${digits}123`, null], [m2Code, null, null]].sort())
    const withSalary = await depositsService.listPeople(deposits(a, 'READ', { SALARY: 'READ' }), { companyId: a, payMonth, scheme: 'PF', show: 'NO_NUMBER', page: 1, pageSize: 50 })
    expect(withSalary.items.map((p) => p.employeeCode)).toEqual([m2Code])
    expect(withSalary.items[0]!.amounts?.employee).toBeGreaterThan(0)
    await expect(depositsService.listPeople(deposits(b, 'READ'), { companyId: a, payMonth, scheme: 'PF', show: 'ALL', page: 1, pageSize: 50 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('people left out of the PF return: Edit over the whole company, never oneself; a later deposit takes them in', async () => {
    const leave = (viewer = deposits(a), personIds = [p2]) => depositsService.leaveOut(viewer, { companyId: a, payMonth, scheme: 'PF', personIds, reason: 'NO_UAN' })
    await expect(leave(deposits(a, 'READ'))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(leave(deposits(b))).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(leave(deposits(a, 'WRITE', {}, m2, m2Code))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // no PF this month: cannot be left out of it
    await expect(leave(deposits(a), [p3])).rejects.toThrow('no PF')
    expect(await leave()).toEqual({ marked: 1 })
    await expect(leave()).rejects.toMatchObject({ code: 'CONFLICT' })

    // the return filed without m2, then paid: deposited, but for the person left out
    const m2Pf = await dueOf('PF', [p2])
    const record = (contributions: number, paid?: { paidOn: Date; paymentReference: string }, viewer = deposits(a)) =>
      depositsService.record(viewer, { companyId: a, payMonth, scheme: 'PF', stateCode: null, reference: `TRRN-${tag}`, filedOn: yesterday, contributions, otherCharges: 500, ...(paid && { paid }) })
    await expect(record(1, undefined, deposits(a, 'READ'))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(record(1, undefined, deposits(b))).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(depositsService.record(deposits(a), { companyId: a, payMonth, scheme: 'PROFESSIONAL_TAX', stateCode: 'ZZ', reference: 'GRN-1', filedOn: yesterday, contributions: 1, otherCharges: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(record(1, { paidOn: addDays(yesterday, -1), paymentReference: 'CRN-1' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    // nothing deposited at all: refused before the database's own rule
    await expect(depositsService.record(deposits(a), { companyId: a, payMonth, scheme: 'PF', stateCode: null, reference: 'TRRN-0', filedOn: yesterday, contributions: 0, otherCharges: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const regular = await record((await dueOf('PF')) - m2Pf)
    expect(await lineOf('PF')).toMatchObject({ state: 'FILED_NOT_PAID', leftOut: { count: 1, amount: m2Pf }, otherCharges: 500 })
    // corrections and paying: Edit over the whole company (another company: not found; View only: forbidden)
    for (const [viewer, code] of [[deposits(b), 'NOT_FOUND'], [deposits(a, 'READ'), 'FORBIDDEN']] as const) {
      await expect(depositsService.update(viewer, { id: regular.id, reference: 'x', filedOn: yesterday, contributions: 1, otherCharges: 0 })).rejects.toMatchObject({ code })
      await expect(depositsService.markPaid(viewer, { id: regular.id, paidOn: yesterday, paymentReference: 'x' })).rejects.toMatchObject({ code })
      await expect(depositsService.remove(viewer, { id: regular.id })).rejects.toMatchObject({ code })
    }
    const contributions = (await dueOf('PF')) - m2Pf
    // the paid details only for one already paid
    await expect(depositsService.update(deposits(a), { id: regular.id, reference: `TRRN-${tag}`, filedOn: yesterday, contributions, otherCharges: 500, paid: { paidOn: yesterday, paymentReference: 'x' } })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await depositsService.update(deposits(a), { id: regular.id, reference: `TRRN-${tag}`, filedOn: yesterday, contributions, otherCharges: 520, note: 'Admin charges corrected - made up' })).toEqual({ id: regular.id })
    await depositsService.markPaid(deposits(a), { id: regular.id, paidOn: yesterday, paymentReference: `CRN-${tag}` })
    await expect(depositsService.markPaid(deposits(a), { id: regular.id, paidOn: yesterday, paymentReference: 'again' })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await lineOf('PF')).toMatchObject({ state: 'PEOPLE_LEFT_OUT', difference: 0, otherCharges: 520 })

    // a supplementary return for m2 takes them in in the same step: deposited in full, never "more than due" in between
    const gap = (await depositsService.listPeople(deposits(a, 'READ'), { companyId: a, payMonth, scheme: 'PF', show: 'LEFT_OUT', page: 1, pageSize: 50 })).items[0]!.gap!
    for (const [viewer, code] of [[deposits(b), 'NOT_FOUND'], [deposits(a, 'READ'), 'FORBIDDEN']] as const) {
      await expect(depositsService.removeGaps(viewer, { gapIds: [gap.id] })).rejects.toMatchObject({ code })
    }
    const supplementaryOf = (viewer = deposits(a)) =>
      depositsService.record(viewer, { companyId: a, payMonth, scheme: 'PF', stateCode: null, reference: `TRRN-S-${tag}`, filedOn: yesterday, contributions: m2Pf, otherCharges: 0, paid: { paidOn: yesterday, paymentReference: `CRN-S-${tag}` }, takeIn: [gap.id] })
    await expect(supplementaryOf(deposits(a, 'WRITE', {}, m2, m2Code))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const supplementary = await supplementaryOf()
    expect(await lineOf('PF')).toMatchObject({ state: 'DEPOSITED', leftOut: { count: 0 }, takenIn: 1 })
    // a deposit that took people in stays; the mark stays while taken in
    await expect(depositsService.remove(deposits(a), { id: supplementary.id })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(depositsService.removeGaps(deposits(a), { gapIds: [gap.id] })).rejects.toMatchObject({ code: 'CONFLICT' })
    // not taken in after all, then taken in again (never by the person themselves, never from another company)
    await expect(depositsService.takeIn(deposits(a, 'WRITE', {}, m2, m2Code), { gapIds: [gap.id], depositId: null })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(depositsService.takeIn(deposits(b), { gapIds: [gap.id], depositId: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await depositsService.takeIn(deposits(a), { gapIds: [gap.id], depositId: null })).toEqual({ changed: 1 })
    expect(await lineOf('PF')).toMatchObject({ state: 'MORE_THAN_DUE', leftOut: { count: 1 } })
    await expect(depositsService.takeIn(deposits(a), { gapIds: [gap.id], depositId: null })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await depositsService.takeIn(deposits(a), { gapIds: [gap.id], depositId: supplementary.id })).toEqual({ changed: 1 })
    expect(await lineOf('PF')).toMatchObject({ state: 'DEPOSITED' })
    expect(await prisma.auditLog.count({ where: { model: 'StatutoryDepositGap' } })).toBeGreaterThan(0)
  })

  it('due dates are one list: only Payroll Edit for every company changes them; one per scheme, State and day', async () => {
    const companyLevel = userWith({ id: clerk, employeeCode: clerkCode }, [{ access: { PAYROLL: 'WRITE' }, rows: [row(a, null, null, 'WRITE')] }])
    const due = { scheme: 'ESIC' as const, stateCode: null, effectiveFrom: new Date(Date.UTC(2105, 6, 1)), day: 20, reference: 'made up for tests' }
    await expect(statutoryService.saveDueDate(companyLevel, due)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // the same scheme (no State) from the same day twice: refused by the unique index though the State is empty (P2002 -
    // CONFLICT for the API, mapped centrally in core/rpc/errors.ts)
    await expect(statutoryService.saveDueDate(admin, { ...due, effectiveFrom: settingsFrom, day: 16 })).rejects.toMatchObject({ code: 'P2002' })
    await prisma.statutoryDueDate.deleteMany({ where: { scheme: 'ESIC', stateCode: null, effectiveFrom: due.effectiveFrom } })
    const { id } = await statutoryService.saveDueDate(admin, due)
    const reader = userWith({ id: clerk, employeeCode: clerkCode }, [{ access: { PAYROLL: 'READ' }, rows: [row(a, null, null, 'READ')] }])
    expect((await statutoryService.listSettings(reader)).dueDates.find((d) => d.id === id)).toMatchObject({ day: 20 })
    await expect(statutoryService.deleteDueDate(companyLevel, { id })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await statutoryService.deleteDueDate(admin, { id })
  })

  it('the figures sheet needs Salary View too; one\'s own months once the payslips are released', async () => {
    await expect(depositsService.figures(deposits(a, 'READ'), { companyId: a, payMonth })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(depositsService.figures(deposits(b, 'READ', { SALARY: 'READ' }), { companyId: a, payMonth })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const sheet = await readFirstSheet(new Uint8Array(await (await depositsService.figures(deposits(a, 'READ', { SALARY: 'READ' }), { companyId: a, payMonth })).arrayBuffer()))
    expect(sheet.rows.find((r) => r.values['Employee code'] === m1Code)?.values).toMatchObject({ UAN: `9${digits}123`, 'Unpaid days': 0 })
    expect(sheet.rows.find((r) => r.values['Employee code'] === m2Code)?.values['Left out']).toContain('No UAN')

    const m1Self = userWith({ id: m1, employeeCode: m1Code }, [])
    // not released yet: nothing
    expect(await depositsService.listMine(m1Self)).toEqual([])
    const template = (await letterTemplatesService.createTemplate({ kind: 'PAYSLIP', name: `Payslip ${tag}`, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Made up' }] }] } }, SYSTEM_ACTOR)).id
    await prisma.payrollRun.update({ where: { id: runA }, data: { payslipTemplateId: template, payslipsReleasedAt: new Date(), payslipsReleasedById: SYSTEM_ACTOR } })
    const mine = await depositsService.listMine(m1Self)
    expect(mine).toHaveLength(1)
    // PF fully deposited; professional tax in ZK and LWF not yet
    expect(mine[0]!.schemes.find((s) => s.scheme === 'PF')).toMatchObject({ deposited: true, depositedOn: yesterday, leftOut: null })
    expect(mine[0]!.schemes.find((s) => s.scheme === 'PROFESSIONAL_TAX')).toMatchObject({ stateCode: 'ZK', amount: 200, deposited: false, dueOn: new Date(Date.UTC(2106, 3, 21)) })
    // m2 was taken in by the supplementary return, paid
    expect((await depositsService.listMine(userWith({ id: m2, employeeCode: m2Code }, [])))[0]!.schemes.find((s) => s.scheme === 'PF')).toMatchObject({ deposited: true })
  })

  it('the reminder: to the people with Edit over the whole company, about what is due or overdue until the challan is paid', async () => {
    // PF: the supplementary return given up - its challans are paid, m2 is left out again: on the page, but not e-mailed
    const gap = (await depositsService.listPeople(deposits(a, 'READ'), { companyId: a, payMonth, scheme: 'PF', show: 'LEFT_OUT', page: 1, pageSize: 50 })).items[0]!.gap!
    await depositsService.takeIn(deposits(a), { gapIds: [gap.id], depositId: null })
    const supplementary = (await lineOf('PF'))!.deposits.find((d) => d.reference === `TRRN-S-${tag}`)!
    await depositsService.remove(deposits(a), { id: supplementary.id })
    expect(await lineOf('PF')).toMatchObject({ state: 'PEOPLE_LEFT_OUT', leftOut: { count: 1 } })
    const recorder = await createEmployee({ companyId: b, plantId: (await createPlant(b)).id })
    await prisma.employee.update({ where: { id: recorder.id }, data: { workEmail: `deposits-${tag.toLowerCase()}@example.com`, updatedById: SYSTEM_ACTOR } })
    await giveLogin(recorder.id, [{ roleId: (await createRole({ STATUTORY_DEPOSITS: 'WRITE' })).id, companyId: a }])
    const sendMail = vi.spyOn(mailer, 'sendMail').mockResolvedValue('SENT')
    // long before the due dates: nothing
    expect(await depositsService.remindDue({ companyIds: [a] }, new Date(Date.UTC(2106, 2, 1)))).toBe('nothing to remind')
    // after them: ESIC and LWF overdue, professional tax in ZK too; ZL has no due date; PF is deposited
    await depositsService.remindDue({ companyIds: [a] }, new Date(Date.UTC(2106, 3, 25)))
    const mail = sendMail.mock.calls.map((c) => c[0]).find((m) => m.to === `deposits-${tag.toLowerCase()}@example.com`)
    expect(mail?.text).toContain('ESIC · Mar 2106: overdue 10 days')
    expect(mail?.text).toContain('Professional tax (ZK)')
    expect(mail?.text).not.toContain('Professional tax (ZL)')
    expect(mail?.text).not.toContain('· PF ·')

    // a run with a line saved before the classification snapshots: never added up from today's masters - left out of the
    // list (and said so), its month's pages refused
    const line = await prisma.payrollRunLine.findFirstOrThrow({ where: { runEmployee: { payrollRunId: runA } }, select: { id: true } })
    await prisma.payrollRunLine.update({ where: { id: line.id }, data: { kind: null } })
    const list = await depositsService.listDeposits(deposits(a, 'READ'), { companyId: a, show: 'ALL', page: 1, pageSize: 50 })
    expect(list.items).toEqual([])
    expect(list.unverifiedMonths).toEqual([{ company: expect.objectContaining({ id: a }), payMonth }])
    await expect(depositsService.getMonth(deposits(a, 'READ'), { companyId: a, payMonth })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(depositsService.record(deposits(a), { companyId: a, payMonth, scheme: 'ESIC', stateCode: null, reference: 'x', filedOn: yesterday, contributions: 1, otherCharges: 0 })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
