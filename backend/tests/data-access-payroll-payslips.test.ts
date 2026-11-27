import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { encrypt, fingerprint } from '#core/crypto/encryption'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { readFirstSheet } from '#core/excel/workbook'
import * as mailer from '#core/mail/mailer'
import { deleteFile } from '#core/storage/file-storage'
import { attendanceService } from '#modules/attendance'
import { employeesService } from '#modules/employees'
import { letterTemplatesService } from '#modules/letter-templates'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { payrollService } from '#modules/payroll'
import * as typesService from '../src/modules/leave/types/types.service.js'
import * as calculationService from '../src/modules/payroll/calculation/calculation.service.js'
import * as payslipsService from '../src/modules/payroll/payslips/payslips.service.js'
import * as registerService from '../src/modules/payroll/register/register.service.js'
import { daysIn } from '../src/modules/payroll/people/people.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { madeUpSettings, placeAt, workLocationIn } from './helpers/payroll.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 6 (approved by the user 2026-11-27): the salary register and payslips. The register is Excel with every
// person's days and amounts - for a run not final yet marked DRAFT; payslips are released on a final run with a payslip
// template and made by the background job, each e-mailed as a link (the PDF shows the full bank account number and PAN);
// the employee sees their own, Payroll + Salary View over the whole company anyone's. Made-up rates from 2101 for the
// March 2102 run (helpers/payroll.ts). Made-up data only.

const by = { createdById: SYSTEM_ACTOR, updatedById: SYSTEM_ACTOR }
const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2102, 2, 1))
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const digits = String(Math.floor(Math.random() * 9000) + 1000)
const addDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000)
const pdfBytes = async (file: File) => Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString()
type Level = 'READ' | 'WRITE'

describe('Payroll stage 6: register and payslips', () => {
  let a: number, b: number
  let e1: number, e2: number, preparer: number
  let e1Code: string, e2Code: string, preparerCode: string
  let runA: number, runB: number, p1: number
  let from: Date, to: Date, days: number
  let basic: number
  let template: number, offerTemplate: number
  const email = `payslip-${tag.toLowerCase()}@example.com`
  const account = `9876543${digits}`
  const pan = `ABCDE${digits}F`

  const payroll = (companyId: number, level: Level = 'WRITE', salary = true) =>
    userWith({ id: preparer, employeeCode: preparerCode }, [{ access: { PAYROLL: level, ...(salary && { SALARY: 'READ' as const }) }, rows: [row(companyId, null, null, level)] }])
  // an employee in self-service: no role at all
  const self = (id: number, code: string) => userWith({ id, employeeCode: code }, [])
  const locked = () => vi.spyOn(attendanceService, 'payrollLockOf').mockResolvedValue({ locked: true, lockedAt: new Date(Date.UTC(2000, 0, 1)) })
  const run = () => payrollService.getRun(admin, { id: runA })
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
  const body = (blocks: string[]) => ({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Payslip for ' }, { type: 'field', attrs: { name: 'pay_month' } }] },
      ...blocks.map((name) => ({ type: 'letterBlock', attrs: { name } })),
      { type: 'paragraph', content: [{ type: 'text', text: 'Net pay: ' }, { type: 'field', attrs: { name: 'net_pay' } }, { type: 'hardBreak' }, { type: 'text', text: 'Bank account: ' }, { type: 'field', attrs: { name: 'bank_account' } }] },
    ],
  })

  beforeAll(async () => {
    await madeUpSettings(2101, 'ZY')
    const setup = await payrollService.getSetup(admin, { payMonth })
    from = setup.attendanceFrom
    to = setup.attendanceTo
    days = daysIn(from, to)
    const [ca, cb, cc] = await Promise.all([createCompany(), createCompany(), createCompany()])
    a = ca.id; b = cb.id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    const [plantA, plantB, plantC] = [(await createPlant(a)).id, (await createPlant(b)).id, (await createPlant(cc.id)).id]
    basic = (await salaryComponentsService.createSalaryComponent({ name: `Basic ${tag}`, kind: 'EARNING', displayOrder: 10 }, SYSTEM_ACTOR)).id
    const [one, two, three, prep] = await Promise.all([
      createEmployee({ companyId: a, plantId: plantA }),
      createEmployee({ companyId: a, plantId: plantA }),
      createEmployee({ companyId: b, plantId: plantB }),
      createEmployee({ companyId: cc.id, plantId: plantC }),
    ])
    e1 = one.id; e2 = two.id; preparer = prep.id
    e1Code = one.employeeCode; e2Code = two.employeeCode; preparerCode = prep.employeeCode
    const location = await workLocationIn('ZY')
    for (const id of [e1, e2, three.id]) {
      await giveSalary(id)
      await placeAt(id, location.id)
      await attend(id)
    }
    // e1's e-mail, salary account and PAN (stored encrypted, as the profile stores them)
    await prisma.employee.update({ where: { id: e1 }, data: { workEmail: email, ...by } })
    await prisma.employeeBankAccount.create({ data: { employeeId: e1, bankName: 'Example Bank', accountHolderName: 'Made Up', accountNumberEncrypted: encrypt(account), accountNumberLast4: account.slice(-4), ifsc: 'EXMP0000001', accountType: 'SAVINGS', isSalaryAccount: true, ...by } })
    await prisma.employeeIdentityDocument.create({ data: { employeeId: e1, type: 'PAN', numberEncrypted: encrypt(pan), numberLast4: pan.slice(-4), numberHash: fingerprint(pan), ...by } })
    // e1's leave: 5 days before the period; in it 1.5 credited, 1 taken, 0.5 taken off by HR (a retired made-up type)
    const leaveType = await typesService.createType(admin, { code: `P${tag}`, name: `Made-up leave ${tag}`, isPaid: true, creditPerMonth: 0, creditAfterMonths: 0, maxCarryForward: null, maxPerRequest: null, allowHalfDay: true, countsOffDays: false, genders: [], employmentTypes: [], isActive: false })
    await prisma.leaveLedgerEntry.createMany({
      data: [
        { employeeId: e1, leaveTypeId: leaveType.id, kind: 'ADJUSTMENT', days: 5, effectiveDate: addDays(from, -10), note: 'Made-up opening', ...by },
        { employeeId: e1, leaveTypeId: leaveType.id, kind: 'CREDIT', days: 1.5, effectiveDate: addDays(from, 1), period: `t-${tag}`, ...by },
        { employeeId: e1, leaveTypeId: leaveType.id, kind: 'TAKEN', days: -1, effectiveDate: addDays(from, 3), ...by },
        { employeeId: e1, leaveTypeId: leaveType.id, kind: 'ADJUSTMENT', days: -0.5, effectiveDate: addDays(from, 4), note: 'Made-up correction', ...by },
        // after the period: not on this payslip
        { employeeId: e1, leaveTypeId: leaveType.id, kind: 'CREDIT', days: 1.5, effectiveDate: addDays(to, 2), period: `u-${tag}`, ...by },
      ],
    })
    const input = (companyId: number) => ({ companyId, payMonth, expectedAttendanceFrom: from, expectedAttendanceTo: to })
    runA = (await payrollService.createRun(payroll(a), input(a))).id
    runB = (await payrollService.createRun(payroll(b), input(b))).id
    p1 = (await prisma.payrollRunEmployee.findFirstOrThrow({ where: { payrollRunId: runA, employeeId: e1 }, select: { id: true } })).id
    template = (await letterTemplatesService.createTemplate({ kind: 'PAYSLIP', name: `Payslip ${tag}`, body: body(['employee_details', 'pay_table', 'leave_table']) }, SYSTEM_ACTOR)).id
    offerTemplate = (await letterTemplatesService.createTemplate({ kind: 'CONFIRMATION_LETTER', name: `Not a payslip ${tag}`, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Made up' }] }] } }, SYSTEM_ACTOR)).id
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('the register: Payroll and Salary View over the whole company; a run not final is marked DRAFT', async () => {
    await expect(registerService.exportRegister(payroll(a, 'READ'), { runId: runA })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    locked()
    await calculationService.compute(payroll(a), { runId: runA, expectedComputedAt: null })
    await expect(registerService.exportRegister(payroll(b, 'READ'), { runId: runA })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(registerService.exportRegister(payroll(a, 'READ', false), { runId: runA })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const file = await registerService.exportRegister(payroll(a, 'READ'), { runId: runA })
    expect(file.name).toMatch(/-DRAFT\.xlsx$/)
    const sheet = await readFirstSheet(new Uint8Array(await file.arrayBuffer()))
    expect(sheet.headers).toEqual(expect.arrayContaining(['Employee code', 'Days paid', `Basic ${tag}`, 'Earned gross', 'Total deductions', 'Net pay', 'Pay status']))
    expect(sheet.rows.map((r) => r.values['Employee code']).sort()).toEqual([e1Code, e2Code].sort())
    expect(sheet.rows.find((r) => r.values['Employee code'] === e1Code)?.values).toMatchObject({ 'Days paid': days, [`Basic ${tag}`]: 28000, 'Earned gross': 28000, 'Net pay': 28000, 'Pay status': 'Worked out' })
  })

  it('payslips wait for a final run; preview needs Salary View and a payslip template; release needs Payroll Edit', async () => {
    await expect(payslipsService.preview(payroll(a, 'READ'), { runId: runA, personId: p1, templateId: template })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(payslipsService.release(payroll(a), { runId: runA, templateId: template })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await run()).payslips).toBeNull()
    // (finalised directly - the approval is tested in data-access-payroll-approval)
    await prisma.payrollRun.update({ where: { id: runA }, data: { status: 'FINALISED', finalisedAt: new Date(), finalisedById: SYSTEM_ACTOR } })
    await expect(payslipsService.preview(payroll(b, 'READ'), { runId: runA, personId: p1, templateId: template })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(payslipsService.preview(payroll(a, 'READ', false), { runId: runA, personId: p1, templateId: template })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(payslipsService.preview(payroll(a, 'READ'), { runId: runA, personId: p1, templateId: offerTemplate })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await pdfBytes(await payslipsService.preview(payroll(a, 'READ'), { runId: runA, personId: p1, templateId: template }))).toBe('%PDF-')
    // what the payslip shows: the full account number and PAN, the earnings with their monthly amount, the period's leave
    const data = (await payslipsService.payslipsOf({ id: runA, companyId: a, payMonth, attendanceFrom: from, attendanceTo: to }, [p1])).get(p1)!.data
    expect(data).toMatchObject({ employeeCode: e1Code, bankName: 'Example Bank', bankAccount: account, pan, periodDays: days, paidDays: days, unpaidDays: 0, leavingDate: null })
    expect(data.earnings).toEqual([{ name: `Basic ${tag}`, monthly: 28000, amount: 28000 }])
    expect(data.deductions).toEqual([])
    expect(data.leave).toEqual([{ name: `Made-up leave ${tag}`, opening: 5, earned: 1.5, taken: 1, other: -0.5, closing: 5 }])

    // before the release: the templates to preview with for anyone who sees the salaries (approvers too); releasing needs Edit
    expect((await payrollService.getRun(payroll(a, 'READ'), { id: runA })).payslips).toMatchObject({ canRelease: false, templates: expect.arrayContaining([{ id: template, name: `Payslip ${tag}` }]) })
    expect((await payrollService.getRun(payroll(a, 'READ', false), { id: runA })).payslips).toMatchObject({ canRelease: false, templates: [] })
    expect((await payrollService.getRun(payroll(a), { id: runA })).payslips).toMatchObject({ canRelease: true })
    await expect(payslipsService.release(payroll(a, 'READ'), { runId: runA, templateId: template })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(payslipsService.release(payroll(a), { runId: runA, templateId: offerTemplate })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await payslipsService.release(payroll(a), { runId: runA, templateId: template })).toEqual({ released: true })
    await expect(payslipsService.release(payroll(a), { runId: runA, templateId: template })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await run()).payslips).toMatchObject({ made: 0, total: 2, canRelease: false, template: { id: template }, releasedBy: { employeeCode: preparerCode } })
    // released, not made yet: the employee sees the month coming; HR's download says so
    expect(await payslipsService.listMine(self(e1, e1Code))).toMatchObject([{ id: null, personId: p1, employeeCode: e1Code }])
    await expect(payslipsService.download(payroll(a, 'READ'), { runId: runA, personId: p1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('the job makes and stores each payslip and e-mails a link, never the PDF; each sees only their own', async () => {
    const sendMail = vi.spyOn(mailer, 'sendMail').mockResolvedValue('SENT')
    expect(await payslipsService.makeDue({ runIds: [runA] })).toBe('2 payslips made')
    expect((await run()).payslips).toMatchObject({ made: 2, total: 2 })
    const mail = sendMail.mock.calls.map(([m]) => m).find((m) => m.to === email)
    expect(mail).toMatchObject({ subject: 'Your payslip for Mar 2102', text: expect.stringContaining('/ess/pay-career?view=payslips') })
    expect(mail?.text).not.toContain(account)
    // made once: the next run of the job leaves them
    expect(await payslipsService.makeDue({ runIds: [runA] })).toBe('0 payslips made')
    expect(await prisma.payslip.count({ where: { runEmployee: { payrollRunId: runA } } })).toBe(2)
    const stored = await prisma.payslip.findUniqueOrThrow({ where: { payrollRunEmployeeId: p1 }, select: { id: true, storageKey: true } })
    expect(stored.storageKey).toMatch(new RegExp(`^employees/${e1Code}/PAYSLIP-2102-03/`))

    const [mine] = await payslipsService.listMine(self(e1, e1Code))
    expect(mine).toMatchObject({ id: stored.id, payMonth })
    expect(await pdfBytes(await payslipsService.downloadMine(self(e1, e1Code), { id: stored.id }))).toBe('%PDF-')
    await expect(payslipsService.downloadMine(self(e2, e2Code), { id: stored.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await payslipsService.listMine(self(preparer, preparerCode))).toEqual([])
    expect(await pdfBytes(await payslipsService.download(payroll(a, 'READ'), { runId: runA, personId: p1 }))).toBe('%PDF-')
    await expect(payslipsService.download(payroll(a, 'READ', false), { runId: runA, personId: p1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(payslipsService.download(payroll(b, 'READ'), { runId: runA, personId: p1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // a final register is not marked DRAFT; the other company's run, never released, has no payslips
    expect((await registerService.exportRegister(payroll(a, 'READ'), { runId: runA })).name).not.toContain('DRAFT')
    expect(await prisma.payslip.count({ where: { runEmployee: { payrollRunId: runB } } })).toBe(0)
  })

  it('a company transfer moves the payslips to the folder of the new code', async () => {
    const newCode = `NC${tag}`
    const moved = await prisma.$transaction((tx) => payrollService.movePayslipsToCode(e1, newCode, SYSTEM_ACTOR, tx))
    for (const key of moved.oldKeys) await deleteFile(key)
    const stored = await prisma.payslip.findUniqueOrThrow({ where: { payrollRunEmployeeId: p1 }, select: { id: true, storageKey: true } })
    expect(stored.storageKey).toMatch(new RegExp(`^employees/${newCode}/PAYSLIP-2102-03/`))
    expect(await pdfBytes(await payslipsService.downloadMine(self(e1, e1Code), { id: stored.id }))).toBe('%PDF-')
  })
})
