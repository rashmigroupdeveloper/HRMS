import ExcelJS from 'exceljs'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '#core/db/prisma'
import { hodsService } from '#modules/employees'
import { addDays, zonedInstant } from '#shared/utils/time'
import * as reports from '../src/modules/attendance/reports/reports.service.js'
import * as repository from '../src/modules/attendance/reports/reports.repository.js'
import { reportFilter, reportInput } from '../src/modules/attendance/reports/reports.schema.js'
import * as days from '../src/modules/attendance/days/days.service.js'
import * as shifts from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { asAsync } from './helpers/spies.js'
import { row, userWith } from './helpers/users.js'

const by = { createdById: 0, updatedById: 0 }
const date = new Date('2026-10-12T00:00:00Z')
async function fixtures() {
  const a = await createCompany(), b = await createCompany()
  const ap = await createPlant(a.id), ap2 = await createPlant(a.id), bp = await createPlant(b.id)
  const manager = await createEmployee({ companyId: a.id, plantId: ap.id })
  const employee = await createEmployee({ companyId: a.id, plantId: ap.id })
  const otherPlant = await createEmployee({ companyId: a.id, plantId: ap2.id })
  const outside = await createEmployee({ companyId: b.id, plantId: bp.id })
  await prisma.employee.update({ where: { id: employee.id }, data: { reportingManagerId: manager.id } })
  const values = [
    { status: 'PRESENT', firstHalf: 'PRESENT', secondHalf: 'PRESENT', lateMinutes: 15, earlyMinutes: 0, workedMinutes: 480, punchCount: 2 },
    { status: 'HALF_DAY', firstHalf: 'PRESENT', secondHalf: 'ABSENT', lateMinutes: 0, earlyMinutes: 25, workedMinutes: 240, punchCount: 2 },
    { status: 'MISSED_PUNCH', firstHalf: 'MISSED_PUNCH', secondHalf: 'MISSED_PUNCH', lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0, punchCount: 1 },
    { status: 'PRESENT', firstHalf: 'PRESENT', secondHalf: 'PRESENT', lateMinutes: 0, earlyMinutes: 0, workedMinutes: 510, punchCount: 2 },
  ] as const
  for (const person of [employee, otherPlant, outside]) for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    await prisma.attendanceDay.create({ data: { ...by, employeeId: person.id, date: addDays(date, i), autoStatus: v.status, ...v } })
  }
  const limited = userWith(manager, [{ access: { ATTENDANCE: 'READ' }, rows: [row(a.id, ap.id, null, 'READ')] }])
  return { a, b, ap, ap2, bp, manager, employee, otherPlant, outside, limited }
}
async function workbook(file: File) { const book = new ExcelJS.Workbook(); await book.xlsx.load(await file.arrayBuffer()); return book }

describe('attendance detail and exceptions reports', () => {
  let f: Awaited<ReturnType<typeof fixtures>>
  const input = () => reportInput.parse({ scope: 'ALL', from: date, to: addDays(date, 3), pageSize: 2 })
  beforeAll(async () => { f = await fixtures() })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => prisma.$disconnect())

  it('scopes every row, summary, facet and employee total; pagination does not truncate totals', async () => {
    const first = await reports.getReport(f.limited, input())
    expect(first.total).toBe(4)
    expect(first.items).toHaveLength(2)
    expect(first.items.every(r => r.employeeCode === f.employee.employeeCode)).toBe(true)
    expect(first.summary).toMatchObject({ days: 4, people: 1, workedMinutes: 1230, punches: 7, late: 1, early: 1, absent: 1, missedPunch: 1 })
    expect(first.options.companies.map(c => c.id)).toEqual([f.a.id])
    expect(first.options.plants.map(p => p.id)).toEqual([f.ap.id])
    expect(first.items[0]).toMatchObject({ employeePeriodRows: 4, employeeLateMinutes: 15, employeeEarlyMinutes: 25 })
    const next = await reports.getReport(f.limited, { ...input(), page: 2 })
    expect(next.items.every(r => !first.items.some(a => a.id === r.id))).toBe(true)
    expect(next.summary).toEqual(first.summary)
    expect((await reports.getReport(f.limited, { ...input(), page: 99 })).page).toBe(2)
    for (const filter of [{ companyIds: [f.b.id] }, { plantIds: [f.ap2.id] }, { search: f.outside.employeeCode }]) {
      const data = await reports.getReport(f.limited, { ...input(), ...filter })
      expect(data.total).toBe(0); expect(data.summary.people).toBe(0); expect(data.summary.workedMinutes).toBe(0)
    }
  })
  it('supports company and group access, combined filters, statuses and inclusive calendar endpoints', async () => {
    const company = userWith(f.manager, [{ access: { ATTENDANCE: 'READ' }, rows: [row(f.a.id, null, null)] }])
    expect((await reports.getReport(company, input())).total).toBe(8)
    const group = userWith(f.manager, [{ access: { ATTENDANCE: 'READ' }, rows: [row(null, null, null)] }])
    expect((await reports.getReport(group, { ...input(), companyIds: [f.a.id, f.b.id] })).total).toBe(12)
    const companyBook = await workbook(await reports.exportReport(company, input()))
    expect(companyBook.getWorksheet('Attendance detail')?.rowCount).toBe(9)
    const groupBook = await workbook(await reports.exportReport(group, { ...input(), companyIds: [f.a.id, f.b.id] }))
    expect(groupBook.getWorksheet('Attendance detail')?.rowCount).toBe(13)
    const selected = await reports.getReport(group, { ...input(), companyIds: [f.b.id], plantIds: [f.bp.id], search: f.outside.employeeCode })
    expect(selected.total).toBe(4)
    expect(selected.items.every(r => r.employeeCode === f.outside.employeeCode)).toBe(true)
    const one = await reports.getReport(company, { ...input(), from: addDays(date, 3), to: addDays(date, 3), plantIds: [f.ap.id], status: 'PRESENT' })
    expect(one.total).toBe(1)
    expect(one.items[0]?.date).toEqual(addDays(date, 3))
    const dept = (await prisma.employee.findUniqueOrThrow({ where: { id: f.employee.id }, select: { departmentId: true } })).departmentId
    const department = userWith(f.manager, [{ access: { ATTENDANCE: 'READ' }, rows: [row(f.a.id, null, dept)] }])
    expect((await reports.getReport(department, input())).total).toBe(4)
    expect((await reports.getReport(company, { ...input(), departmentIds: [dept] })).total).toBe(4)
  })
  it('uses actual team/HOD relationships; unrelated roles do not grant ALL', async () => {
    const manager = userWith(f.manager, [])
    expect((await reports.getReport(manager, { ...input(), scope: 'TEAM' })).total).toBe(4)
    await expect(reports.getReport(manager, input())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const leaveOnly = userWith(f.manager, [{ access: { LEAVE: 'READ' }, rows: [row(null, null, null)] }])
    await expect(reports.getReport(leaveOnly, input())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await reports.getReport(userWith(f.outside, []), { ...input(), scope: 'TEAM' })).total).toBe(0)
    const person = await prisma.employee.findUniqueOrThrow({ where: { id: f.employee.id }, select: { hodPostId: true } })
    await hodsService.appointHod({ employeeCode: f.manager.employeeCode, postIds: [person.hodPostId!] }, userWith(f.manager, [], { isSuperAdmin: true }))
    const hod = await reports.getReport(manager, { ...input(), scope: 'DEPARTMENT' })
    expect(hod.total).toBe(4)
    expect(hod.items.every(r => r.employeeCode === f.employee.employeeCode)).toBe(true)
  })
  it('counts each exceptional day once, recognizes absent halves and never invents missing days', async () => {
    const all = await reports.getReport(f.limited, { ...input(), mode: 'EXCEPTIONS' })
    expect(all.total).toBe(3)
    for (const exception of ['LATE', 'EARLY', 'ABSENT', 'MISSED_PUNCH'] as const) {
      expect((await reports.getReport(f.limited, { ...input(), mode: 'EXCEPTIONS', exception })).total).toBe(1)
    }
    expect((await reports.getReport(f.limited, { ...input(), from: addDays(date, -10), to: addDays(date, 10) })).total).toBe(4)
    expect((await reports.getReport(f.limited, { ...input(), mode: 'EXCEPTIONS', status: 'HALF_DAY', exception: 'ABSENT' })).items[0]?.secondHalf).toBe('ABSENT')
  })
  it('exports all matching pages with numeric summaries, exact filters and review notes', async () => {
    const book = await workbook(await reports.exportReport(f.limited, input()))
    const sheet = book.getWorksheet('Attendance detail')!
    expect(sheet.rowCount - 1).toBe(4)
    expect(sheet.getSheetValues().flat(2).join(' ')).not.toContain(f.outside.employeeCode)
    expect(book.getWorksheet('Summary')?.rowCount).toBe(11)
    const notes = book.getWorksheet('Review notes')!.getSheetValues().flat(2).join(' ')
    expect(notes).toContain('2026-10-12 to 2026-10-15')
    expect(notes).toContain('Current placement')
    const zero = await workbook(await reports.exportReport(f.limited, { ...input(), search: f.outside.employeeCode }))
    expect(zero.getWorksheet('Attendance detail')?.rowCount).toBe(1)
    const exceptions = await workbook(await reports.exportReport(f.limited, { ...input(), mode: 'EXCEPTIONS', exception: 'EARLY' }))
    expect(exceptions.getWorksheet('Attendance exceptions')?.rowCount).toBe(2)
  })
  it('rejects oversized exports and malformed ranges at the input boundary', async () => {
    vi.spyOn(asAsync(repository), 'count').mockResolvedValue(20_001)
    await expect(reports.exportReport(f.limited, input())).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    for (const value of [{ to: addDays(date, -1) }, { to: addDays(date, 366) }, { from: new Date('invalid') }, { from: new Date('2026-10-12T01:00:00Z') }, { companyIds: [-1] }]) {
      expect(reportFilter.safeParse({ ...input(), ...value }).success).toBe(false)
    }
    expect(reportInput.safeParse({ ...input(), pageSize: 101 }).success).toBe(false)
    expect(reportInput.safeParse({ ...input(), to: addDays(date, 365) }).success).toBe(true)
  })
  it('keeps night-shift raw source details attached to their work date and denies outside people', async () => {
    const hr = userWith(f.manager, [], { isSuperAdmin: true })
    const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
    const shift = await shifts.createShift({ code: `R${tag}`, name: `Report night ${tag}`, start: 1320, end: 360, breakMinutes: 0 }, hr)
    const pattern = await shifts.createPattern({ name: `Report pattern ${tag}`, days: Array(7).fill(shift.id), halfDays: [] }, hr)
    await shifts.assignShift({ employeeCodes: [f.employee.employeeCode], patternId: pattern.id, startWeek: 1, effectiveFrom: date }, hr)
    const upload = await prisma.punchUpload.create({ data: { ...by, fileName: '=review.csv', rowCount: 2, addedCount: 2, duplicateCount: 0, unmatchedCount: 0 } })
    const at = [zonedInstant(date, 1320, 'Asia/Kolkata'), zonedInstant(addDays(date, 1), 360, 'Asia/Kolkata')]
    await prisma.punch.createMany({ data: at.map(punchedAt => ({ ...by, employeeId: f.employee.id, employeeCode: f.employee.employeeCode, punchedAt, device: 'Gate 1', source: 'UPLOAD', uploadId: upload.id })) })
    const input = { employeeCode: f.employee.employeeCode, date }
    const raw = await days.getDayPunches(f.limited, input)
    expect(raw.map(p => p.at)).toEqual(at)
    expect(raw[0]).toMatchObject({ source: 'UPLOAD', uploadFile: '=review.csv', uploadId: upload.id, timezone: 'Asia/Kolkata' })
    const book = await workbook(await reports.exportPunches(f.limited, input))
    expect(book.getWorksheet('Raw punches')?.rowCount).toBe(3)
    expect(book.getWorksheet('Raw punches')?.getCell('B3').value).toBe(at[1]!.toISOString())
    expect(book.getWorksheet('Raw punches')?.getCell('H2').type).toBe(ExcelJS.ValueType.String)
    await expect(reports.exportPunches(f.limited, { employeeCode: f.outside.employeeCode, date })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await days.getDayPunches(f.limited, { ...input, date: addDays(date, 1) })).toEqual([])
  })
})
