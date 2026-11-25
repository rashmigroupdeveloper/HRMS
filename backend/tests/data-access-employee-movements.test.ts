import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '#core/db/prisma'
import { scopeOf } from '#core/auth/scope'
import * as movements from '../src/modules/employees/movements/movements.service.js'
import * as repository from '../src/modules/employees/movements/movements.repository.js'
import { movementFilter, movementInput } from '../src/modules/employees/movements/movements.schema.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

const date = (d: number) => new Date(Date.UTC(2026, 0, d))
const input = (extra = {}) => movementInput.parse({ from: date(1), to: date(31), ...extra })

describe('recorded employee movement report', () => {
  let companyA: number, companyB: number, plantA: number, plantA2: number
  let employee: Awaited<ReturnType<typeof createEmployee>>, samePlant: typeof employee, outside: typeof employee
  let viewer: ReturnType<typeof userWith>, group: ReturnType<typeof userWith>
  beforeAll(async () => {
    companyA = (await createCompany()).id; companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id; plantA2 = (await createPlant(companyA)).id
    const pb = (await createPlant(companyB)).id
    employee = await createEmployee({ companyId: companyA, plantId: plantA, leavesOn: date(5) })
    samePlant = await createEmployee({ companyId: companyA, plantId: plantA, departmentId: employee.department!.id })
    await createEmployee({ companyId: companyA, plantId: plantA2 })
    outside = await createEmployee({ companyId: companyB, plantId: pb, leavesOn: date(31) })
    await prisma.employee.update({ where: { id: employee.id }, data: { firstName: 'Movement', lastName: 'Review' } })
    viewer = userWith(samePlant, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, plantA, employee.department!.id)] }])
    group = userWith(samePlant, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null), row(companyB, null, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it('returns both event dates inclusively, counts people once and keeps totals across pages', async () => {
    const first = await movements.listMovements(viewer, input({ pageSize: 1 }))
    expect(first.total).toBe(3)
    expect(first.items).toHaveLength(1)
    expect(first.summary).toMatchObject({ joiners: 2, leavers: 1, people: 2, future: 0 })
    const second = await movements.listMovements(viewer, input({ pageSize: 1, page: 3 }))
    expect(second.summary).toEqual(first.summary)
    expect(second.items[0]).toMatchObject({ kind: 'LEAVER', employeeCode: employee.employeeCode, date: date(5) })
    expect((await movements.listMovements(viewer, input({ from: date(5), to: date(5) }))).total).toBe(1)
    expect((await movements.listMovements(viewer, input({ kind: 'JOINER' }))).total).toBe(2)
  })

  it('uses the same company/plant/department scope for rows, options, summaries and exports', async () => {
    const result = await movements.listMovements(viewer, input({ companyIds: [companyB] }))
    expect(result).toMatchObject({ items: [], total: 0, summary: { joiners: 0, leavers: 0, people: 0 } })
    expect(result.options.companies).toEqual([])
    expect((await movements.listMovements(viewer, input({ plantIds: [plantA2] }))).total).toBe(0)
    expect((await movements.listMovements(viewer, input({ departmentIds: [outside.department!.id] }))).total).toBe(0)
    const file = await movements.exportMovements(viewer, movementFilter.parse(input({ companyIds: [companyB] })))
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer())
    expect(workbook.getWorksheet('Joiners and leavers')!.rowCount).toBe(1)
    expect((await movements.listMovements(userWith(samePlant, [{ access: { EMPLOYEES: 'READ' }, rows: [] }]), input())).total).toBe(0)
    await expect(movements.listMovements(userWith(samePlant, [{ access: { ATTENDANCE: 'READ' }, rows: [row(null, null, null)] }]), input())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('supports company/group exports across all pages and curates non-sensitive columns', async () => {
    expect((await movements.listMovements(group, input({ companyIds: [companyA] }))).total).toBe(4)
    const result = await movements.listMovements(group, input({ pageSize: 1 }))
    expect(result).toMatchObject({ total: 6, summary: { joiners: 4, leavers: 2, people: 4 } })
    const file = await movements.exportMovements(group, movementFilter.parse(input()))
    const book = new ExcelJS.Workbook(); await book.xlsx.load(await file.arrayBuffer())
    const sheet = book.getWorksheet('Joiners and leavers')!
    expect(sheet.rowCount).toBe(7)
    expect(sheet.getRow(1).values).not.toContain('Annual CTC')
    expect(sheet.getColumn(4).values).toContain(outside.employeeCode)
    expect(book.getWorksheet('Summary')!.getCell('B2').value).toBe(4)
    expect(book.getWorksheet('Review notes')).toBeTruthy()
    const rows = await movements.listMovements(group, input({ search: 'Movement Review', kind: 'LEAVER' }))
    expect(rows.items.map(r => r.employeeCode)).toContain(employee.employeeCode)
    expect(rows.items[0]).not.toHaveProperty('salary')
  })

  it('marks future recorded dates without pretending they are completed exits', async () => {
    const future = await createEmployee({ companyId: companyA, plantId: plantA, departmentId: employee.department!.id, leavesOn: new Date('2099-01-01T00:00:00Z') })
    const result = await movements.listMovements(viewer, movementInput.parse({ from: new Date('2099-01-01T00:00:00Z'), to: new Date('2099-01-01T00:00:00Z') }))
    expect(result.summary.future).toBe(1)
    expect(result.items[0]).toMatchObject({ employeeCode: future.employeeCode, kind: 'LEAVER', future: true, status: 'ON_NOTICE' })
  })

  it('rejects bad date/paging values and refuses truncation beyond the bounded report limit', async () => {
    for (const extra of [{ to: date(0) }, { from: new Date('2026-01-01T01:00:00Z') }, { to: new Date('2027-01-02T00:00:00Z') }, { page: 0 }, { pageSize: 101 }]) expect(movementInput.safeParse({ ...input(), ...extra }).success).toBe(false)
    expect(movementInput.safeParse({ from: new Date('1999-01-01T00:00:00Z'), to: new Date('1999-01-31T00:00:00Z') }).success).toBe(true)
    const rows = await repository.listRecorded({ scope: scopeOf(viewer, 'EMPLOYEES', 'READ'), filter: input() })
    const spy = vi.spyOn(repository, 'listRecorded').mockResolvedValue(Array.from({ length: 20_001 }, () => rows[0]!))
    try { await expect(movements.listMovements(viewer, input())).rejects.toMatchObject({ code: 'BAD_REQUEST' }); await expect(movements.exportMovements(viewer, movementFilter.parse(input()))).rejects.toMatchObject({ code: 'BAD_REQUEST' }); spy.mockResolvedValue(Array.from({ length: 10_001 }, () => rows.find(r => r.employeeCode === employee.employeeCode)!)); await expect(movements.exportMovements(viewer, movementFilter.parse(input()))).rejects.toMatchObject({ code: 'BAD_REQUEST' }) } finally { spy.mockRestore() }
  })
})
