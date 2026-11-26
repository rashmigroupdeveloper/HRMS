import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '#core/db/prisma'
import { payrollService } from '#modules/payroll'
import { companiesService } from '#modules/organization'
import { createCompany } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'
import { createInput, month } from '../src/modules/payroll/payroll.schema.js'
import { toApiError } from '#core/rpc/errors'

const admin = userWith({ id: 0, employeeCode: 'SYSTEM' }, [], { isSuperAdmin: true })
const payMonth = new Date(Date.UTC(2090, 10, 1))
const list = { year: 2090, page: 1, pageSize: 25 }
const viewer = (companyId: number | null, level: 'READ' | 'WRITE' = 'WRITE', plantId: number | null = null) => userWith({ id: 0, employeeCode: 'PAYTEST' }, [{ access: { PAYROLL: 'WRITE' }, rows: [row(companyId, plantId, null, level)] }])

describe('Payroll Stage 1: whole-company drafts', () => {
  let a: number, b: number, overseas: number
  let runA: number, runB: number
  beforeAll(async () => {
    const companies = await Promise.all([createCompany(), createCompany(), createCompany()])
    a = companies[0].id; b = companies[1].id; overseas = companies[2].id
    for (const id of [a, b]) await companiesService.updateCompany({ id, isIndiaPayroll: true, pfEstablishmentCode: 'WBCAL0012345', esicEmployerCode: '12345678901234567' }, 0)
  })
  afterAll(() => prisma.$disconnect())
  async function input(companyId: number, date = payMonth) {
    const setup = await payrollService.getSetup(admin, { payMonth: date })
    return { companyId, payMonth: date, expectedAttendanceFrom: setup.attendanceFrom, expectedAttendanceTo: setup.attendanceTo }
  }

  it('creates only drafts, attributes the actor and captures attendance dates', async () => {
    const data = await input(a)
    runA = (await payrollService.createRun(viewer(a), data)).id
    runB = (await payrollService.createRun(viewer(b), await input(b))).id
    const run = await payrollService.getRun(viewer(a), { id: runA })
    expect(run).toMatchObject({ company: { id: a }, payMonth, attendanceFrom: data.expectedAttendanceFrom, attendanceTo: data.expectedAttendanceTo, status: 'DRAFT' })
    expect(run).not.toHaveProperty('createdById')
    expect((await prisma.payrollRun.findUnique({ where: { id: runA }, select: { createdById: true, updatedById: true } }))).toEqual({ createdById: 0, updatedById: 0 })
  })

  it('company A never lists, counts, picks or opens company B; full-company View cannot create', async () => {
    const reader = viewer(a, 'READ')
    const result = await payrollService.listRuns(reader, { ...list, companyId: b })
    expect(result).toEqual({ items: [], total: 0 })
    expect((await payrollService.listRuns(reader, { ...list, companyId: a })).items.map(r => r.id)).toEqual([runA])
    expect((await payrollService.getSetup(reader, { payMonth })).companies.map(c => c.id)).toEqual([a])
    expect((await payrollService.getSetup(reader, { payMonth })).companies[0]?.canCreate).toBe(false)
    await expect(payrollService.getRun(reader, { id: runB })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(payrollService.createRun(reader, await input(a))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(payrollService.createRun(reader, await input(b))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('plant/department grants and several partial rows do not authorize a company run', async () => {
    const partial = [viewer(a, 'WRITE', 1), userWith({ id: 0, employeeCode: 'PARTIAL' }, [{ access: { PAYROLL: 'WRITE' }, rows: [row(a, 1, null), row(a, 2, null)] }]), userWith({ id: 0, employeeCode: 'DEPT' }, [{ access: { PAYROLL: 'WRITE' }, rows: [row(a, null, 1)] }])]
    for (const person of partial) {
      expect(await payrollService.listRuns(person, list)).toEqual({ items: [], total: 0 })
      expect((await payrollService.getSetup(person, { payMonth })).companies).toEqual([])
      await expect(payrollService.getRun(person, { id: runA })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(payrollService.createRun(person, await input(a))).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
  })

  it('SALARY access, self-service and merely assigned roles do not confer Payroll access', async () => {
    const salary = userWith({ id: 0, employeeCode: 'SALARY' }, [{ access: { SALARY: 'WRITE' }, rows: [row(null, null, null)] }])
    for (const person of [salary, { ...salary, availableRoles: [{ id: 1, name: 'Inactive payroll role' }] }, userWith({ id: 0, employeeCode: 'SELF' }, [])]) {
      await expect(payrollService.listRuns(person, list)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(payrollService.createRun(person, await input(a))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
    expect((await payrollService.listRuns(viewer(null), { ...list, companyId: b })).total).toBe(1)
  })

  it('rejects overseas/inactive companies, changed date previews and unsupported input', async () => {
    await expect(payrollService.createRun(admin, await input(overseas))).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await companiesService.updateCompany({ id: overseas, isActive: false }, 0)
    expect((await payrollService.getSetup(admin, { payMonth })).companies.some(c => c.id === overseas)).toBe(false)
    const data = await input(a, new Date(Date.UTC(2090, 11, 1)))
    await expect(payrollService.createRun(admin, { ...data, expectedAttendanceFrom: new Date(Date.UTC(2000, 0, 1)) })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(month.safeParse(new Date('2090-11-02T00:00:00Z')).success).toBe(false)
    expect(month.safeParse(new Date('2090-11-01T00:01:00Z')).success).toBe(false)
    expect(month.safeParse(new Date('1999-11-01T00:00:00Z')).success).toBe(false)
    for (const unknown of [{ status: 'PAID' }, { createdById: 999 }, { attendanceFrom: new Date() }]) expect(createInput.safeParse({ ...data, ...unknown }).success).toBe(false)
  })

  it('database uniqueness wins concurrent creates; paging totals share the scope', async () => {
    const data = await input(a, new Date(Date.UTC(2090, 9, 1)))
    const results = await Promise.allSettled([payrollService.createRun(viewer(a), data), payrollService.createRun(viewer(a), data)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const failed = results.find(r => r.status === 'rejected') as PromiseRejectedResult
    expect(toApiError(failed.reason)).toMatchObject({ code: 'CONFLICT' })
    const first = await payrollService.listRuns(viewer(a), { ...list, pageSize: 1 })
    const second = await payrollService.listRuns(viewer(a), { ...list, page: 2, pageSize: 1 })
    expect(first.total).toBe(2)
    expect(second.total).toBe(2)
    expect(first.items).toHaveLength(1)
    expect(second.items).toHaveLength(1)
    expect(first.items[0]!.id).not.toBe(second.items[0]!.id)
    expect(first.items[0]).not.toHaveProperty('createdById')
  })

  it('keeps captured dates after a cycle change and rejects a stale preview', async () => {
    const original = await prisma.attendanceSetting.findUnique({ where: { id: 1 } })
    const before = await payrollService.getRun(admin, { id: runA })
    const data = await input(a, new Date(Date.UTC(2091, 0, 1)))
    try {
      const cycleStartDay = original?.cycleStartDay === 1 ? 26 : 1
      await prisma.attendanceSetting.upsert({ where: { id: 1 }, create: { id: 1, cycleStartDay, createdById: 0, updatedById: 0 }, update: { cycleStartDay, updatedById: 0 } })
      expect((await payrollService.getSetup(admin, { payMonth: data.payMonth })).attendanceFrom).not.toEqual(data.expectedAttendanceFrom)
      expect((await payrollService.getRun(admin, { id: runA })).attendanceFrom).toEqual(before.attendanceFrom)
      await expect(payrollService.createRun(admin, data)).rejects.toMatchObject({ code: 'CONFLICT' })
    } finally {
      if (original) await prisma.attendanceSetting.update({ where: { id: 1 }, data: { cycleStartDay: original.cycleStartDay, updatedById: original.updatedById } })
      else await prisma.attendanceSetting.delete({ where: { id: 1 } })
    }
  })

  it('preserves history for retired companies but prevents new drafts', async () => {
    const data = await input(a, new Date(Date.UTC(2091, 1, 1)))
    await companiesService.updateCompany({ id: a, isActive: false }, 0)
    try {
      expect((await payrollService.getSetup(viewer(a), { payMonth })).companies).toEqual([])
      expect((await payrollService.getRun(viewer(a), { id: runA })).id).toBe(runA)
      await expect(payrollService.createRun(viewer(a), data)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    } finally {
      await companiesService.updateCompany({ id: a, isActive: true }, 0)
    }
  })

  it('database enforces month identity and ordered dates', async () => {
    const data = { companyId: a, createdById: 0, updatedById: 0, attendanceFrom: new Date('2091-01-01'), attendanceTo: new Date('2091-01-31') }
    await expect(prisma.payrollRun.create({ data: { ...data, payMonth: new Date('2091-01-02') } })).rejects.toThrow()
    await expect(prisma.payrollRun.create({ data: { ...data, payMonth: new Date('2091-01-01'), attendanceTo: new Date('2090-12-01') } })).rejects.toThrow()
  })
})
