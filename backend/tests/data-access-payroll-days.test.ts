import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma, type DayStatus } from '#core/db/prisma'
import { attendanceService } from '#modules/attendance'
import { payrollService } from '#modules/payroll'
import { companiesService } from '#modules/organization'
import * as locksRepository from '../src/modules/attendance/locks/locks.repository.js'
import * as daysService from '../src/modules/payroll/days/days.service.js'
import * as peopleService from '../src/modules/payroll/people/people.service.js'
import { daysIn } from '../src/modules/payroll/people/people.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { asAsync } from './helpers/spies.js'
import { row, userWith } from './helpers/users.js'

// Payroll stage 3, the days (approved 2026-11-27): a run takes its days from the locked attendance - whose runs, and
// what each half becomes. Every date is worked out from the run's period, so the test holds whatever start day the
// test database has. The attendance month of a far-off year cannot be locked for real (it is not over), so the lock's
// answer is put in its place where a locked period is needed. Made-up data only.

const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2093, 2, 1))
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
// two leave types of this run of the tests: one paid, one without pay
const PAID_LEAVE = `PD${tag}`
const UNPAID_LEAVE = `UP${tag}`
type Level = 'READ' | 'WRITE'
const payroll = (companyId: number | null, level: Level = 'WRITE', plantId: number | null = null) =>
  userWith({ id: 0, employeeCode: 'PAYTEST' }, [{ access: { PAYROLL: level }, rows: [row(companyId, plantId, null, level)] }])

describe('Payroll stage 3: the days of a run', () => {
  let a: number, b: number, plantA: number
  let e1: number, e2: number, e3: number, e4: number
  let runA: number, runB: number
  let from: Date, to: Date, days: number
  let person: Map<number, number>

  const locked = (lockedAt = new Date(Date.UTC(2000, 0, 1))) => vi.spyOn(attendanceService, 'payrollLockOf').mockResolvedValue({ locked: true, lockedAt })
  const computedAt = async (id: number) => (await payrollService.getRun(admin, { id })).computedAt
  const list = async (viewer = payroll(a, 'READ')) => peopleService.listPeople(viewer, { runId: runA, page: 1, pageSize: 50 })

  // an approved leave of e1 on day `i` of the period (`firstHalfOnly`: only its first half), written directly - the
  // leave module's own rules are tested with the leave module
  async function leave(leaveTypeId: number, i: number, firstHalfOnly = false) {
    const by = { createdById: 0, updatedById: 0 }
    const request = await prisma.approvalRequest.create({ data: { ...by, employeeId: e1, requestedById: e1, feature: 'LEAVE', kinds: ['LEAVE'], status: 'APPROVED', summary: 'Leave' }, select: { id: true } })
    const date = addDays(from, i)
    await prisma.leaveApplication.create({ data: { ...by, employeeId: e1, leaveTypeId, fromDate: date, toDate: date, toFirstHalf: firstHalfOnly, days: firstHalfOnly ? 0.5 : 1, reason: 'Made-up leave', status: 'APPROVED', approvalRequestId: request.id } })
  }

  // every day of the period for one employee: `halves(i)` gives the two halves of day i (0 = the first day)
  async function attend(employeeId: number, halves: (i: number) => [DayStatus, DayStatus]) {
    await prisma.attendanceDay.createMany({
      data: Array.from({ length: days }, (_, i) => {
        const [firstHalf, secondHalf] = halves(i)
        return { employeeId, date: addDays(from, i), status: firstHalf, firstHalf, secondHalf, autoStatus: firstHalf, punchCount: 0, workedMinutes: 0, lateMinutes: 0, earlyMinutes: 0, createdById: 0, updatedById: 0 }
      }),
    })
  }

  beforeAll(async () => {
    const setup = await payrollService.getSetup(admin, { payMonth })
    from = setup.attendanceFrom; to = setup.attendanceTo; days = daysIn(from, to)
    const companies = await Promise.all([createCompany(), createCompany()])
    a = companies[0].id; b = companies[1].id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
    plantA = (await createPlant(a)).id
    const plantB = (await createPlant(b)).id
    e1 = (await createEmployee({ companyId: a, plantId: plantA })).id
    e2 = (await createEmployee({ companyId: a, plantId: plantA })).id
    e3 = (await createEmployee({ companyId: b, plantId: plantB })).id
    e4 = (await createEmployee({ companyId: a, plantId: plantA })).id
    // e1: present, but for a whole absent day, an absent half-working day (the other half off), a half "on leave"
    // that no approved leave covers, a day of paid leave, a day of leave without pay and a first half without pay
    await attend(e1, (i) => (i === 2 ? ['ABSENT', 'ABSENT'] : i === 3 ? ['ABSENT', 'WEEKLY_OFF'] : i === 4 ? ['LEAVE', 'PRESENT'] : i === 5 ? ['HOLIDAY', 'HOLIDAY'] : i === 7 || i === 8 ? ['LEAVE', 'LEAVE'] : i === 9 ? ['LEAVE', 'PRESENT'] : ['PRESENT', 'PRESENT']))
    const type = (code: string, isPaid: boolean) => prisma.leaveType.create({ data: { code, name: `Leave ${code}`, isPaid, creditsFrom: new Date(Date.UTC(2026, 0, 1)), createdById: 0, updatedById: 0 }, select: { id: true } })
    const [paidType, unpaidType] = await Promise.all([type(PAID_LEAVE, true), type(UNPAID_LEAVE, false)])
    await leave(paidType.id, 7)
    await leave(unpaidType.id, 8)
    await leave(unpaidType.id, 9, true)
    // e2: attendance has no days at all; e4: never a punch - absent every working day; e3 (company B): present
    await attend(e4, (i) => (i % 7 === 6 ? ['WEEKLY_OFF', 'WEEKLY_OFF'] : ['ABSENT', 'ABSENT']))
    await attend(e3, () => ['PRESENT', 'PRESENT'])
    const input = (companyId: number) => ({ companyId, payMonth, expectedAttendanceFrom: from, expectedAttendanceTo: to })
    runA = (await payrollService.createRun(payroll(a), input(a))).id
    runB = (await payrollService.createRun(payroll(b), input(b))).id
    const members = await prisma.payrollRunEmployee.findMany({ where: { payrollRunId: { in: [runA, runB] } }, select: { id: true, employeeId: true } })
    person = new Map(members.map((m) => [m.employeeId, m.id]))
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('a new run has no days yet; they are taken only from a locked attendance period', async () => {
    const run = await payrollService.getRun(admin, { id: runA })
    expect(run).toMatchObject({ computedAt: null, computedBy: null, attendanceLocked: false, daysOutdated: false, peopleWithUnpaidDays: null, peopleToCheck: null })
    const before = await list()
    expect(before.daysWorkedOut).toBe(false)
    expect(before.items.every((p) => p.paidDays === null && p.unpaidDays === null && p.unclearDays === null)).toBe(true)
    await expect(daysService.compute(payroll(a), { runId: runA, expectedComputedAt: null })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await prisma.payrollRunDay.count({ where: { runEmployee: { payrollRunId: runA } } })).toBe(0)
  })

  it('company A never works out company B; plant-level and View-only cannot; a stale screen is refused', async () => {
    locked()
    await expect(daysService.compute(payroll(a), { runId: runB, expectedComputedAt: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(daysService.compute(payroll(a, 'WRITE', plantA), { runId: runA, expectedComputedAt: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(daysService.compute(payroll(a, 'READ'), { runId: runA, expectedComputedAt: null })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(daysService.compute(payroll(a), { runId: runA, expectedComputedAt: new Date(Date.UTC(2000, 0, 1)) })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await computedAt(runA)).toBeNull()
  })

  it('takes each person\'s days from attendance, half by half - and never guesses', async () => {
    locked()
    const result = await daysService.compute(payroll(a), { runId: runA, expectedComputedAt: null })
    expect(result).toEqual({ people: 3, days: days * 3, peopleWithUnpaidDays: 2, peopleWithUnclearDays: 2 })
    const people = await list()
    expect(people.daysWorkedOut).toBe(true)
    const of = (employeeId: number) => people.items.find((p) => p.id === person.get(employeeId))!
    // unpaid: 1 absent day + half of the half-working day + 1 day and 1 half of leave without pay; the leave half with
    // no leave found is unclear; the day of paid leave is paid
    expect(of(e1)).toMatchObject({ days, paidDays: days - 3.5, unpaidDays: 3, unclearDays: 0.5, flags: { unpaidDays: true, unclearDays: true, allAbsent: false } })
    // attendance has no days: all unclear, nothing unpaid
    expect(of(e2)).toMatchObject({ paidDays: 0, unpaidDays: 0, unclearDays: days, flags: { unpaidDays: false, unclearDays: true, allAbsent: false } })
    // never a punch: listed as absent throughout, to be checked
    expect(of(e4).flags).toMatchObject({ unpaidDays: true, unclearDays: false, allAbsent: true })
    expect(of(e4).paidDays! + of(e4).unpaidDays!).toBe(days)
    expect(people.counts).toMatchObject({ all: 3, unpaidDays: 2, unclearDays: 2, allAbsent: 1 })
    expect((await peopleService.listPeople(payroll(a, 'READ'), { runId: runA, flag: 'ALL_ABSENT', page: 1, pageSize: 50 })).items.map((p) => p.id)).toEqual([person.get(e4)])
    expect((await peopleService.listPeople(payroll(a, 'READ'), { runId: runA, flag: 'UNCLEAR_DAYS', page: 1, pageSize: 50 })).total).toBe(2)

    const run = await payrollService.getRun(admin, { id: runA })
    expect(run).toMatchObject({ attendanceLocked: true, daysOutdated: false, peopleWithUnpaidDays: 2, peopleToCheck: 3, computedBy: { name: 'System' } })
    expect(run.computedAt).toBeInstanceOf(Date)

    const detail = await peopleService.getPerson(payroll(a, 'READ'), { runId: runA, personId: person.get(e1)! })
    expect(detail.days).toHaveLength(days)
    expect(detail.dayTotals).toEqual({ paidDays: days - 3.5, unpaidDays: 3, unclearDays: 0.5, allAbsent: false })
    // leave: paid or not by its type, with the type's code, half by half
    expect(detail.days!.slice(7, 10)).toMatchObject([
      { date: addDays(from, 7), firstHalf: 'PAID', secondHalf: 'PAID', firstStatus: 'LEAVE', secondStatus: 'LEAVE', firstLeaveCode: PAID_LEAVE, secondLeaveCode: PAID_LEAVE },
      { date: addDays(from, 8), firstHalf: 'UNPAID', secondHalf: 'UNPAID', firstStatus: 'LEAVE', secondStatus: 'LEAVE', firstLeaveCode: UNPAID_LEAVE, secondLeaveCode: UNPAID_LEAVE },
      { date: addDays(from, 9), firstHalf: 'UNPAID', secondHalf: 'PAID', firstStatus: 'LEAVE', secondStatus: 'PRESENT', firstLeaveCode: UNPAID_LEAVE, secondLeaveCode: null },
    ])
    expect(detail.days!.slice(2, 6)).toMatchObject([
      { date: addDays(from, 2), firstHalf: 'UNPAID', secondHalf: 'UNPAID', firstStatus: 'ABSENT', secondStatus: 'ABSENT' },
      { date: addDays(from, 3), firstHalf: 'UNPAID', secondHalf: 'PAID', firstStatus: 'ABSENT', secondStatus: 'WEEKLY_OFF' },
      { date: addDays(from, 4), firstHalf: 'UNCLEAR', secondHalf: 'PAID', firstStatus: 'LEAVE', firstLeaveCode: null, secondStatus: 'PRESENT' },
      { date: addDays(from, 5), firstHalf: 'PAID', secondHalf: 'PAID', firstStatus: 'HOLIDAY' },
    ])
    // the days of company B's run are not reachable from company A, and a person of run A not through run B
    await expect(peopleService.getPerson(payroll(a, 'READ'), { runId: runB, personId: person.get(e3)! })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(peopleService.getPerson(payroll(b, 'READ'), { runId: runB, personId: person.get(e1)! })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('working out again replaces the days; the day rows stay out of the change history, the run records each time', async () => {
    locked()
    const first = await computedAt(runA)
    // attendance was corrected under an opened lock: the absent day became present
    await prisma.attendanceDay.updateMany({ where: { employeeId: e1, date: addDays(from, 2) }, data: { status: 'PRESENT', firstHalf: 'PRESENT', secondHalf: 'PRESENT' } })
    await daysService.compute(payroll(a), { runId: runA, expectedComputedAt: first })
    const again = (await list()).items.find((p) => p.id === person.get(e1))!
    expect(again).toMatchObject({ paidDays: days - 2.5, unpaidDays: 2, unclearDays: 0.5 })
    expect(await prisma.payrollRunDay.count({ where: { runEmployee: { payrollRunId: runA } } })).toBe(days * 3)
    expect(await prisma.auditLog.count({ where: { model: 'PayrollRunDay' } })).toBe(0)
    expect(await prisma.auditLog.count({ where: { model: 'PayrollRun', recordId: runA } })).toBeGreaterThanOrEqual(3)
  })

  it('says when attendance was opened or locked again after the days were taken', async () => {
    locked(new Date(Date.now() + 60_000))
    expect(await payrollService.getRun(admin, { id: runA })).toMatchObject({ attendanceLocked: true, daysOutdated: true })
    vi.restoreAllMocks()
    // the real answer for a far-off year: not locked
    expect(await payrollService.getRun(admin, { id: runA })).toMatchObject({ attendanceLocked: false, daysOutdated: true })
  })

  it('a period is locked only when every one of its days lies in a locked attendance month', async () => {
    // the months start on the 26th now, but this period was captured as a calendar month: its days fall in two
    // attendance months - "March" (to the 25th) and "April" (from the 26th)
    const marchFrom = new Date(Date.UTC(2093, 2, 1))
    const marchTo = new Date(Date.UTC(2093, 2, 31))
    const first = new Date(Date.UTC(2093, 3, 2))
    const second = new Date(Date.UTC(2093, 4, 3))
    vi.spyOn(asAsync(locksRepository), 'findCycleStartDay').mockResolvedValue(26)
    const locks = vi.spyOn(asAsync(locksRepository), 'listOpenLocks')
    locks.mockResolvedValue([{ year: 2093, month: 3, lockedAt: first }])
    expect(await attendanceService.payrollLockOf(marchFrom, marchTo)).toEqual({ locked: false, lockedAt: null })
    // the days up to the 25th alone are locked
    expect(await attendanceService.payrollLockOf(marchFrom, new Date(Date.UTC(2093, 2, 25)))).toEqual({ locked: true, lockedAt: first })
    locks.mockResolvedValue([{ year: 2093, month: 3, lockedAt: first }, { year: 2093, month: 4, lockedAt: second }])
    // both months locked: locked since the later of the two
    expect(await attendanceService.payrollLockOf(marchFrom, marchTo)).toEqual({ locked: true, lockedAt: second })
  })

  it('refreshing the people removes the days - they are worked out again', async () => {
    const before = await payrollService.getRun(admin, { id: runA })
    await peopleService.refresh(payroll(a), { runId: runA, expectedRefreshedAt: before.peopleRefreshedAt })
    expect(await payrollService.getRun(admin, { id: runA })).toMatchObject({ computedAt: null, computedBy: null, daysOutdated: false, peopleWithUnpaidDays: null, peopleToCheck: null })
    expect(await prisma.payrollRunDay.count({ where: { runEmployee: { payrollRunId: runA } } })).toBe(0)
    expect((await list()).items.every((p) => p.paidDays === null)).toBe(true)
    expect((await peopleService.getPerson(payroll(a, 'READ'), { runId: runA, personId: person.get(e1)! })).days).toBeNull()
  })
})
