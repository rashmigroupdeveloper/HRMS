import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '#core/db/prisma'
import { SYSTEM_SCOPE } from '#core/auth/scope'
import { attendanceService } from '#modules/attendance'
import { employeesService } from '#modules/employees'
import { zonedInstant } from '#shared/utils/time'
import * as daysRepository from '../src/modules/attendance/days/days.repository.js'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as exemptionsService from '../src/modules/attendance/exemptions/exemptions.service.js'
import * as policiesService from '../src/modules/attendance/policies/policies.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { asAsync } from './helpers/spies.js'
import { row, userWith } from './helpers/users.js'

// "Attendance not tracked" (approved 2026-11-27): someone who does not punch counts present on their working days -
// what a marked day becomes, what still wins over it, who may set it for whom, and that a locked month never changes.
// Made-up data only.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 24 * 60 * 60 * 1000
const hr = userWith({ id: 0, employeeCode: 'HRNT' }, [{ access: { ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
const NOTE = daysService.NOT_TRACKED_NOTE

// the Monday to Sunday of the full week before last (every day has passed)
function lastWeek() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const monday = new Date(today.getTime() - (((today.getUTCDay() + 6) % 7) + 14) * DAY)
  return [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(monday.getTime() + i * DAY))
}

describe('attendance not tracked', () => {
  type Person = { id: number; employeeCode: string }
  let a: number, b: number
  let employee: Person, other: Person
  let timezone: string
  let markerId: number
  const [mon, tue, wed, thu, fri, sat, sun] = lastWeek() as [Date, Date, Date, Date, Date, Date, Date]

  async function punch(person: Person, day: Date, ...clocks: string[]) {
    await prisma.punch.createMany({
      data: clocks.map((c) => {
        const [h, m] = c.split(':').map(Number) as [number, number]
        return { employeeId: person.id, employeeCode: person.employeeCode, punchedAt: zonedInstant(day, h * 60 + m, timezone), source: 'UPLOAD' as const, createdById: 0, updatedById: 0 }
      }),
    })
  }
  const dayOf = (person: Person, date: Date) =>
    prisma.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId: person.id, date } }, select: { status: true, firstHalf: true, secondHalf: true, note: true, lateMinutes: true } })
  const markerOf = async (person: Person) => (await shiftsService.listSchedules(hr, { search: person.employeeCode })).find((r) => r.employee.employeeCode === person.employeeCode)!.notTracked
  const mark = (person: Person, fromDate: Date, toDate: Date | null = null, viewer = hr) => exemptionsService.markNotTracked({ employeeCodes: [person.employeeCode], fromDate, toDate, reason: 'Does not punch - field staff' }, viewer)

  beforeAll(async () => {
    a = (await createCompany()).id
    b = (await createCompany()).id
    employee = await createEmployee({ companyId: a, plantId: (await createPlant(a)).id })
    other = await createEmployee({ companyId: b, plantId: (await createPlant(b)).id })
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: mon, to: sun })
    timezone = person!.timezone
    // 09:00-18:00, Monday to Saturday (Saturday its first half only), Sunday off; every late day loses its first half
    const shift = await shiftsService.createShift({ code: `N${tag}`, name: `Not tracked ${tag}`, start: 540, end: 1080, breakMinutes: 30, halfSplit: 780 }, hr)
    const policy = await policiesService.createPolicy({ name: `Not tracked ${tag}`, graceMinutes: 10, fullDayMinutes: 480, halfDayMinutes: 240, latesPerHalfDayCut: 1, veryLateMinutes: null, veryEarlyMinutes: null }, hr)
    const pattern = await shiftsService.createPattern({ name: `Not tracked ${tag}`, days: [shift.id, shift.id, shift.id, shift.id, shift.id, shift.id, 0], halfDays: [6] }, hr)
    await shiftsService.assignShift({ employeeCodes: [employee.employeeCode, other.employeeCode], patternId: pattern.id, startWeek: 1, policyId: policy.id, effectiveFrom: new Date(mon.getTime() - 7 * DAY) }, hr)
    // the week as the punches give it: late on Wednesday, one punch only on Thursday, nothing else
    await punch(employee, wed, '10:30', '19:00')
    await punch(employee, thu, '09:00')
    // approved leave on Tuesday (written directly - the leave module's rules are tested with it)
    const type = await prisma.leaveType.create({ data: { code: `NT${tag}`, name: `Leave NT${tag}`, isPaid: true, creditsFrom: new Date(Date.UTC(2026, 0, 1)), createdById: 0, updatedById: 0 }, select: { id: true } })
    const request = await prisma.approvalRequest.create({ data: { createdById: 0, updatedById: 0, employeeId: employee.id, requestedById: employee.id, feature: 'LEAVE', kinds: ['LEAVE'], status: 'APPROVED', summary: 'Leave' }, select: { id: true } })
    await prisma.leaveApplication.create({ data: { createdById: 0, updatedById: 0, employeeId: employee.id, leaveTypeId: type.id, fromDate: tue, toDate: tue, days: 1, reason: 'Made-up leave', status: 'APPROVED', approvalRequestId: request.id } })
    // HR corrected Friday's first half to absent
    await prisma.attendanceCorrection.create({ data: { employeeId: employee.id, date: fri, firstHalf: 'ABSENT', secondHalf: null, reason: 'Left the site in the morning', createdById: 0, updatedById: 0 } })
    await daysService.recompute([employee.id, other.id], mon, sun)
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('without the marker, no punch is absent and the rules apply', async () => {
    expect(await dayOf(employee, mon)).toMatchObject({ status: 'ABSENT', note: null })
    expect(await dayOf(employee, tue)).toMatchObject({ status: 'LEAVE' })
    // late: the first half is cut by the late rule
    expect(await dayOf(employee, wed)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT' })
    expect((await dayOf(employee, wed)).lateMinutes).toBeGreaterThan(0)
    expect(await dayOf(employee, thu)).toMatchObject({ status: 'MISSED_PUNCH' })
    expect(await dayOf(employee, sat)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'WEEKLY_OFF' })
    expect(await markerOf(employee)).toBeNull()
  })

  it('only someone whose Attendance setup Edit covers the employee marks them (data access)', async () => {
    const onlyA = userWith({ id: 0, employeeCode: 'HRA' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(a, null, null)] }])
    const viewA = userWith({ id: 0, employeeCode: 'HRV' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(a, null, null, 'READ')] }])
    // company B's employee: outside the View range - not found, and nothing is saved for the one who was allowed
    await expect(exemptionsService.markNotTracked({ employeeCodes: [employee.employeeCode, other.employeeCode], fromDate: mon, reason: 'Does not punch' }, onlyA)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(mark(employee, mon, null, viewA)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(exemptionsService.markNotTracked({ employeeCodes: ['NOSUCH999'], fromDate: mon, reason: 'Does not punch' }, hr)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await prisma.attendanceExemption.count({ where: { employeeId: { in: [employee.id, other.id] } } })).toBe(0)
    // company B's marker is not changed or removed from company A, and company A's list does not show its employee
    await mark(other, mon, fri)
    const otherMarker = (await markerOf(other)) ?? (await prisma.attendanceExemption.findFirstOrThrow({ where: { employeeId: other.id }, select: { id: true } }))
    await expect(exemptionsService.updateMarker({ id: otherMarker.id, toDate: null }, onlyA)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(exemptionsService.removeMarker({ id: otherMarker.id }, onlyA)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await shiftsService.listSchedules(onlyA, {})).map((r) => r.employee.employeeCode)).not.toContain(other.employeeCode)
  })

  it('a marker with a last day counts only up to it', async () => {
    // (marked Monday to Friday above; the days were worked out again at once)
    expect(await dayOf(other, mon)).toMatchObject({ status: 'PRESENT', note: NOTE })
    expect(await dayOf(other, fri)).toMatchObject({ status: 'PRESENT' })
    expect(await dayOf(other, sat)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'WEEKLY_OFF', note: null })
    // over: the Schedules list shows nothing for them today
    expect(await markerOf(other)).toBeNull()
  })

  it('a marked person counts present on working days; leave, HR\'s correction and off days stay', async () => {
    expect(await mark(employee, mon)).toEqual({ marked: 1, unchanged: 0 })
    expect(await dayOf(employee, mon)).toMatchObject({ status: 'PRESENT', firstHalf: 'PRESENT', secondHalf: 'PRESENT', note: NOTE })
    // approved leave still shows
    expect(await dayOf(employee, tue)).toMatchObject({ status: 'LEAVE' })
    // punched late: present, not late, not cut by the late rule
    expect(await dayOf(employee, wed)).toMatchObject({ status: 'PRESENT', lateMinutes: 0, note: NOTE })
    // one punch only: present, not a missed punch
    expect(await dayOf(employee, thu)).toMatchObject({ status: 'PRESENT' })
    // HR's correction of a half still wins
    expect(await dayOf(employee, fri)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT' })
    // a half-working Saturday: the worked half present, the off half off; Sunday off
    expect(await dayOf(employee, sat)).toMatchObject({ firstHalf: 'PRESENT', secondHalf: 'WEEKLY_OFF' })
    expect(await dayOf(employee, sun)).toMatchObject({ status: 'WEEKLY_OFF', note: null })
    const marker = await markerOf(employee)
    expect(marker).toMatchObject({ fromDate: mon, toDate: null, current: true, reason: 'Does not punch - field staff' })
    markerId = marker!.id
    expect((await shiftsService.listSchedules(hr, { search: employee.employeeCode, notTracked: true })).length).toBe(1)
    expect((await shiftsService.listSchedules(hr, { search: employee.employeeCode, notTracked: false })).length).toBe(0)
    // payroll reads these days as present - paid, and no longer "absent throughout"
    const paid = await attendanceService.listPayrollDays([employee.id], mon, mon)
    expect(paid).toMatchObject([{ first: { status: 'PRESENT' }, second: { status: 'PRESENT' } }])
    // the marker is a person's decision: in the change history
    expect(await prisma.auditLog.count({ where: { model: 'AttendanceExemption' } })).toBeGreaterThan(0)
  })

  it('marking again changes nothing; a marker over only some of the days is refused', async () => {
    expect(await mark(employee, mon)).toEqual({ marked: 0, unchanged: 1 })
    expect(await mark(employee, wed, fri)).toEqual({ marked: 0, unchanged: 1 })
    await expect(mark(employee, new Date(mon.getTime() - 7 * DAY))).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await prisma.attendanceExemption.count({ where: { employeeId: employee.id } })).toBe(1)
  })

  it('ending the marker tracks the later days again', async () => {
    await expect(exemptionsService.updateMarker({ id: markerId, toDate: new Date(mon.getTime() - DAY) }, hr)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await exemptionsService.updateMarker({ id: markerId, toDate: tue, reason: 'Punches from Wednesday' }, hr)
    expect(await dayOf(employee, mon)).toMatchObject({ status: 'PRESENT', note: NOTE })
    expect(await dayOf(employee, wed)).toMatchObject({ firstHalf: 'ABSENT', secondHalf: 'PRESENT' })
    expect(await dayOf(employee, thu)).toMatchObject({ status: 'MISSED_PUNCH' })
    expect(await prisma.attendanceExemption.findUniqueOrThrow({ where: { id: markerId }, select: { toDate: true, reason: true } })).toEqual({ toDate: tue, reason: 'Punches from Wednesday' })
  })

  it('nothing changes under a locked attendance month', async () => {
    // the attendance months of that week, locked
    const startDay = await daysRepository.findCycleStartDay()
    const months = [mon, sun].map((day) => daysService.cycleOf(day, startDay))
    vi.spyOn(asAsync(daysRepository), 'listOpenLocks').mockResolvedValue(months)
    await expect(exemptionsService.updateMarker({ id: markerId, toDate: null }, hr)).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(exemptionsService.removeMarker({ id: markerId }, hr)).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(mark(employee, thu)).rejects.toMatchObject({ code: 'CONFLICT' })
    // only its reason may still be corrected - no day changes
    await exemptionsService.updateMarker({ id: markerId, toDate: tue, reason: 'Punches from Wednesday on' }, hr)
    expect(await prisma.attendanceExemption.findUniqueOrThrow({ where: { id: markerId }, select: { toDate: true } })).toEqual({ toDate: tue })
  })

  it('removing the marker tracks all its days again', async () => {
    await exemptionsService.removeMarker({ id: markerId }, hr)
    expect(await dayOf(employee, mon)).toMatchObject({ status: 'ABSENT', note: null })
    expect(await dayOf(employee, tue)).toMatchObject({ status: 'LEAVE' })
    expect(await markerOf(employee)).toBeNull()
    await expect(exemptionsService.removeMarker({ id: markerId }, hr)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
