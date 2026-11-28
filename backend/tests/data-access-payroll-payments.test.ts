import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { encrypt } from '#core/crypto/encryption'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { readFirstSheet } from '#core/excel/workbook'
import { attendanceService } from '#modules/attendance'
import { employeesService } from '#modules/employees'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { payrollService } from '#modules/payroll'
import * as calculationService from '../src/modules/payroll/calculation/calculation.service.js'
import * as paymentsService from '../src/modules/payroll/payments/payments.service.js'
import { daysIn } from '../src/modules/payroll/people/people.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { madeUpSettings, placeAt, workLocationIn } from './helpers/payroll.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 6 slice 2 (approved by the user 2026-11-28): paying approved runs - the "Payroll payments" area over the
// whole company; batches (bank / cheque / cash) made up, sent, paid with the bank's reference or returned with its reason;
// holds; what is owed. Nobody acts on their own payment. Made-up rates from 2103 for the March 2104 run. Made-up data only.

const by = { createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }
const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2104, 2, 1))
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const digits = String(Math.floor(Math.random() * 9000) + 1000)
const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
type Level = 'READ' | 'WRITE'

describe('Payroll stage 6: salary payments', () => {
  let a: number, b: number, plantA: number
  let e1: number, e2: number, e3: number, payer: number
  let e1Code: string, e2Code: string, e3Code: string, payerCode: string
  let runA: number, p1: number, p2: number, p3: number
  let from: Date, to: Date, days: number
  let basic: number
  const account = `5550001${digits}`

  // the payments area over a whole company (or one plant of it)
  const pay = (companyId: number, level: Level = 'WRITE', id = payer, code = payerCode, plantId: number | null = null) =>
    userWith({ id, employeeCode: code }, [{ access: { PAYROLL_PAYMENTS: level }, rows: [row(companyId, plantId, null, level)] }])
  const payroll = (companyId: number) => userWith({ id: payer, employeeCode: payerCode }, [{ access: { PAYROLL: 'WRITE', SALARY: 'READ' }, rows: [row(companyId, null, null, 'WRITE')] }])
  const locked = () => vi.spyOn(attendanceService, 'payrollLockOf').mockResolvedValue({ locked: true, lockedAt: new Date(Date.UTC(2000, 0, 1)) })
  const owedOf = async (viewer = pay(a, 'READ')) => (await paymentsService.listOwed(viewer, { companyId: a, page: 1, pageSize: 50 })).items
  const stateOf = async (personId: number) => (await owedOf()).find((i) => i.personId === personId)?.state ?? 'NOT_OWED'
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
  const bankAccount = (employeeId: number, number: string) =>
    prisma.employeeBankAccount.create({ data: { employeeId, bankName: 'Example Bank', accountHolderName: 'Made Up', accountNumberEncrypted: encrypt(number), accountNumberLast4: number.slice(-4), ifsc: 'EXMP0000001', accountType: 'SAVINGS', isSalaryAccount: true, ...by } })

  beforeAll(async () => {
    await madeUpSettings(2103, 'ZQ')
    const setup = await payrollService.getSetup(admin, { payMonth })
    from = setup.attendanceFrom
    to = setup.attendanceTo
    days = daysIn(from, to)
    const [ca, cb, cc] = await Promise.all([createCompany(), createCompany(), createCompany()])
    a = ca.id; b = cb.id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    plantA = (await createPlant(a)).id
    const plantC = (await createPlant(cc.id)).id
    basic = (await salaryComponentsService.createSalaryComponent({ name: `Basic ${tag}`, kind: 'EARNING', displayOrder: 10 }, SYSTEM_ACTOR)).id
    const [one, two, three, me] = await Promise.all([
      createEmployee({ companyId: a, plantId: plantA }),
      createEmployee({ companyId: a, plantId: plantA }),
      createEmployee({ companyId: a, plantId: plantA }),
      createEmployee({ companyId: cc.id, plantId: plantC }),
    ])
    e1 = one.id; e2 = two.id; e3 = three.id; payer = me.id
    e1Code = one.employeeCode; e2Code = two.employeeCode; e3Code = three.employeeCode; payerCode = me.employeeCode
    const location = await workLocationIn('ZQ')
    for (const id of [e1, e2, e3]) {
      await giveSalary(id)
      await placeAt(id, location.id)
      await attend(id)
    }
    // e1 and e2 have a salary account, e3 none
    await bankAccount(e1, account)
    await bankAccount(e2, `5550002${digits}`)
    runA = (await payrollService.createRun(payroll(a), { companyId: a, payMonth, expectedAttendanceFrom: from, expectedAttendanceTo: to })).id
    const person = async (employeeId: number) => (await prisma.payrollRunEmployee.findFirstOrThrow({ where: { payrollRunId: runA, employeeId }, select: { id: true } })).id
    ;[p1, p2, p3] = [await person(e1), await person(e2), await person(e3)]
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('what is owed: only approved runs, only over the whole company - to pay, or no salary account', async () => {
    locked()
    await calculationService.compute(payroll(a), { runId: runA, expectedComputedAt: null })
    // a draft is not paid
    expect(await owedOf()).toEqual([])
    // (finalised directly - the approval is tested in data-access-payroll-approval)
    await prisma.payrollRun.update({ where: { id: runA }, data: { status: 'FINALISED', finalisedAt: new Date(), finalisedById: SYSTEM_ACTOR } })
    const owed = await paymentsService.listOwed(pay(a, 'READ'), { companyId: a, page: 1, pageSize: 50 })
    expect(owed.items.map((i) => [i.employeeCode, i.state, i.amount]).sort()).toEqual([[e1Code, 'TO_PAY', 28000], [e2Code, 'TO_PAY', 28000], [e3Code, 'NO_ACCOUNT', 28000]].sort())
    expect(owed.owed).toEqual({ count: 3, amount: 84000 })
    expect(owed.items[0]!.dueOn).toEqual(addDays(to, owed.paymentDueDays))
    expect(owed.companies.find((c) => c.id === a)).toMatchObject({ canPay: false })
    // another company's viewer, or one holding a single plant of it, sees none of it
    expect((await paymentsService.listOwed(pay(b, 'READ'), { companyId: a, page: 1, pageSize: 50 })).items).toEqual([])
    expect(await owedOf(pay(a, 'READ', payer, payerCode, plantA))).toEqual([])
    expect((await payrollService.getRun(admin, { id: runA })).payments).toMatchObject({ toPay: 3, paid: 0, total: 3 })
  })

  it('holding: Edit over the whole company, never one\'s own; held pay stays out of batches until released', async () => {
    await expect(paymentsService.hold(pay(a, 'READ'), { personId: p1, reason: 'Made-up dispute' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(paymentsService.hold(pay(b), { personId: p1, reason: 'Made-up dispute' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(paymentsService.hold(pay(a, 'WRITE', e1, e1Code), { personId: p1, reason: 'Made-up dispute' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await paymentsService.hold(pay(a), { personId: p1, reason: 'Made-up dispute' })).toEqual({ held: true })
    await expect(paymentsService.hold(pay(a), { personId: p1, reason: 'Again' })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await stateOf(p1)).toBe('HELD')
    await expect(paymentsService.createBatch(pay(a), { companyId: a, method: 'BANK', personIds: [p1] })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await paymentsService.releaseHold(pay(a), { personId: p1, note: 'Settled - made up' })).toEqual({ released: true })
    expect(await stateOf(p1)).toBe('TO_PAY')
    expect(await prisma.auditLog.count({ where: { model: 'PayrollPaymentHold' } })).toBeGreaterThan(0)
  })

  it('a bank batch: checked person by person, the account copied, the plain list with the full number; paid, then returned', async () => {
    await expect(paymentsService.createBatch(pay(b), { companyId: a, method: 'BANK', personIds: [p1] })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(paymentsService.createBatch(pay(a, 'WRITE', e2, e2Code), { companyId: a, method: 'BANK', personIds: [p1, p2] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(paymentsService.createBatch(pay(a), { companyId: a, method: 'BANK', personIds: [p1, p3] })).rejects.toThrow(e3Code)
    const { id } = await paymentsService.createBatch(pay(a), { companyId: a, method: 'BANK', personIds: [p1, p2], note: 'Made-up batch' })
    // nobody is in two batches at once
    await expect(paymentsService.createBatch(pay(a), { companyId: a, method: 'BANK', personIds: [p1] })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(paymentsService.hold(pay(a), { personId: p1, reason: 'Made-up dispute' })).rejects.toMatchObject({ code: 'CONFLICT' })
    const batch = await paymentsService.getBatch(pay(a, 'READ'), { id })
    expect(batch).toMatchObject({ status: 'OPEN', method: 'BANK', canChange: false, totals: { payments: 2, amount: 56000 } })
    expect(batch.payments.find((p) => p.personId === p1)).toMatchObject({ status: 'IN_BATCH', amount: 28000, account: { bankName: 'Example Bank', last4: account.slice(-4) } })
    expect(JSON.stringify(batch)).not.toContain(account)
    await expect(paymentsService.getBatch(pay(b, 'READ'), { id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await stateOf(p1)).toBe('IN_BATCH')

    // the plain payment list: Edit only, with the full account number
    await expect(paymentsService.paymentList(pay(a, 'READ'), { id })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const sheet = await readFirstSheet(new Uint8Array(await (await paymentsService.paymentList(pay(a), { id })).arrayBuffer()))
    expect(sheet.rows.find((r) => r.values['Employee code'] === e1Code)?.values).toMatchObject({ 'Account number': account, IFSC: 'EXMP0000001', Amount: 28000, Narration: 'Salary Mar 2104' })

    // taken out while it is open: to pay again; not paid before it is sent
    const payment2 = batch.payments.find((p) => p.personId === p2)!.id
    const payment1 = batch.payments.find((p) => p.personId === p1)!.id
    expect(await paymentsService.removePayment(pay(a), { paymentId: payment2 })).toEqual({ removed: true })
    expect(await stateOf(p2)).toBe('TO_PAY')
    await expect(paymentsService.markPaid(pay(a), { batchId: id, paidOn: new Date() })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await paymentsService.sendBatch(pay(a), { id })).toEqual({ sent: true })
    await expect(paymentsService.removePayment(pay(a), { paymentId: payment1 })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(paymentsService.markPaid(pay(a), { batchId: id, paidOn: addDays(new Date(), 3) })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await paymentsService.markPaid(pay(a), { batchId: id, paidOn: new Date(), reference: 'UTR-MADE-UP-1' })).toEqual({ paid: 1 })
    // nothing waits: closed
    expect(await paymentsService.getBatch(pay(a, 'READ'), { id })).toMatchObject({ status: 'CLOSED', totals: { paidCount: 1, paid: 28000 } })
    expect(await stateOf(p1)).toBe('NOT_OWED')
    expect((await payrollService.getRun(admin, { id: runA })).payments).toMatchObject({ paid: 1, toPay: 2 })

    // the bank took it back: owed again, with the reason; paid again in a later batch
    await expect(paymentsService.markReturned(pay(a, 'WRITE', e1, e1Code), { paymentId: payment1, reason: 'Made-up' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await paymentsService.markReturned(pay(a), { paymentId: payment1, reason: 'Account frozen - made up' })).toEqual({ returned: true })
    expect((await owedOf()).find((i) => i.personId === p1)).toMatchObject({ state: 'RETURNED', returned: { reason: 'Account frozen - made up' } })
    const again = await paymentsService.createBatch(pay(a), { companyId: a, method: 'BANK', personIds: [p1, p2] })
    // given up before it is sent: both owed again
    expect(await paymentsService.cancelBatch(pay(a), { id: again.id })).toEqual({ cancelled: true })
    expect(await paymentsService.getBatch(pay(a, 'READ'), { id: again.id })).toMatchObject({ status: 'CLOSED', totals: { payments: 0 } })
    expect([await stateOf(p1), await stateOf(p2)]).toEqual(['RETURNED', 'TO_PAY'])
    expect(await prisma.auditLog.count({ where: { model: 'PayrollPayment' } })).toBeGreaterThan(0)
  })

  it('a cheque batch: no account needed; each cheque marked paid with its number', async () => {
    const { id } = await paymentsService.createBatch(pay(a), { companyId: a, method: 'CHEQUE', personIds: [p3] })
    await expect(paymentsService.paymentList(pay(a), { id })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await paymentsService.sendBatch(pay(a), { id })
    const paymentId = (await paymentsService.getBatch(pay(a, 'READ'), { id })).payments[0]!.id
    await expect(paymentsService.markPaid(pay(a), { batchId: id, paidOn: new Date() })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await paymentsService.markPaid(pay(a), { batchId: id, paidOn: new Date(), paymentIds: [paymentId], chequeNumber: '000123' })).toEqual({ paid: 1 })
    expect((await paymentsService.getBatch(pay(a, 'READ'), { id })).payments[0]).toMatchObject({ status: 'PAID', chequeNumber: '000123' })
    expect(await stateOf(p3)).toBe('NOT_OWED')
    // the batches list: only the companies covered in full
    expect((await paymentsService.listBatches(pay(a, 'READ'), { companyId: a, page: 1, pageSize: 50 })).items.map((b) => b.id)).toContain(id)
    expect((await paymentsService.listBatches(pay(b, 'READ'), { companyId: a, page: 1, pageSize: 50 })).items).toEqual([])
  })
  it('a later component-kind change cannot change the owed amount or a new batch amount', async () => {
    try {
      await salaryComponentsService.updateSalaryComponent({ id: basic, kind: 'EMPLOYER_CONTRIBUTION' }, SYSTEM_ACTOR)
      expect((await owedOf()).find((p) => p.personId === p2)).toMatchObject({ amount: 28000 })
      const batch = await paymentsService.createBatch(pay(a), { companyId: a, method: 'CASH', personIds: [p2] })
      expect((await paymentsService.getBatch(pay(a, 'READ'), batch)).payments[0]).toMatchObject({ amount: 28000 })
      await paymentsService.cancelBatch(pay(a), batch)
    } finally {
      await salaryComponentsService.updateSalaryComponent({ id: basic, kind: 'EARNING' }, SYSTEM_ACTOR)
    }
  })

  it('an approved run without saved classifications stays unchanged and cannot produce a new inferred payment', async () => {
    const line = await prisma.payrollRunLine.findFirstOrThrow({ where: { payrollRunEmployeeId: p2, salaryComponentId: basic } })
    try {
      await prisma.payrollRunLine.update({ where: { id: line.id }, data: { kind: null, statutoryRole: null, stateCode: null } })
      expect(await payrollService.getRun(admin, { id: runA })).toMatchObject({ status: 'FINALISED', classificationsVerified: false, netPay: null, payments: null })
      expect(await owedOf(pay(b, 'READ'))).toEqual([])
      await expect(owedOf()).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(paymentsService.createBatch(pay(b), { companyId: b, method: 'CASH', personIds: [p2] })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(paymentsService.createBatch(pay(a), { companyId: a, method: 'CASH', personIds: [p2] })).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(calculationService.compute(payroll(a), { runId: runA, expectedComputedAt: null })).rejects.toMatchObject({ code: 'CONFLICT' })
      expect((await prisma.payrollRunLine.findUniqueOrThrow({ where: { id: line.id } })).kind).toBeNull()
    } finally {
      await prisma.payrollRunLine.update({ where: { id: line.id }, data: { kind: line.kind, statutoryRole: line.statutoryRole, stateCode: line.stateCode } })
    }
  })

})
