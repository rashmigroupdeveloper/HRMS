import { prisma } from '#core/db/prisma'
import { writeWorkbook } from '#core/excel/workbook'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as applicationsService from '../src/modules/leave/applications/applications.service.js'
import * as balancesService from '../src/modules/leave/balances/balances.service.js'
import * as typesService from '../src/modules/leave/types/types.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The opening balances import (2026-11-22): every row checked (data access per row's employee), all rows or none, the
// balance set by an adjustment of the difference. The team coverage warning: teammates (the same manager) away on the
// days asked - name and days only.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 86_400_000
function monday(weeks: number) {
  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY + weeks * 7 * DAY)
}
async function file(rows: Record<string, string | number>[]) {
  const bytes = await writeWorkbook([
    {
      name: 'Balances',
      columns: ['Employee code', 'Leave type', 'Balance', 'Note'].map((header) => ({ header, key: header, width: 12 })),
      rows,
    },
  ])
  return new File([new Uint8Array(bytes)], 'balances.xlsx')
}

describe('leave - opening balances import and team coverage', () => {
  let a: { id: number; employeeCode: string }
  let a2: { id: number; employeeCode: string }
  let b: { id: number; employeeCode: string }
  let hrA: ReturnType<typeof userWith>
  let code: string
  let typeId: number

  beforeAll(async () => {
    const companyA = (await createCompany()).id
    const companyB = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    const manager = await createEmployee({ companyId: companyA, plantId: plantA })
    a = await createEmployee({ companyId: companyA, plantId: plantA })
    a2 = await createEmployee({ companyId: companyA, plantId: plantA })
    b = await createEmployee({ companyId: companyB, plantId: (await createPlant(companyB)).id })
    await prisma.employee.updateMany({ where: { id: { in: [a.id, a2.id] } }, data: { reportingManagerId: manager.id, updatedById: 0 } })
    hrA = userWith({ id: 0, employeeCode: 'HRA' }, [{ access: { LEAVE: 'WRITE' }, rows: [row(companyA, null, null)] }])
    const hrAll = userWith({ id: 0, employeeCode: 'HR' }, [{ access: { LEAVE: 'WRITE' }, rows: [row(null, null, null)] }])
    code = `I${tag}`
    typeId = (
      await typesService.createType(hrAll, {
        code,
        name: `Import leave ${tag}`,
        isPaid: true,
        creditPerMonth: 0,
        creditAfterMonths: 0,
        maxCarryForward: null,
        maxPerRequest: null,
        allowHalfDay: true,
        countsOffDays: false,
        genders: [],
        employmentTypes: [],
      })
    ).id
  })
  afterAll(() => prisma.$disconnect())

  it('checks every row - another company is "not found" - and saves nothing while a row is wrong', async () => {
    const wrong = await file([
      { 'Employee code': a.employeeCode, 'Leave type': code, Balance: 6 },
      { 'Employee code': b.employeeCode, 'Leave type': code, Balance: 4 },
      { 'Employee code': a2.employeeCode, 'Leave type': 'NOPE', Balance: 2 },
      { 'Employee code': a.employeeCode, 'Leave type': code, Balance: 3 },
    ])
    const checked = await balancesService.importBalances(hrA, { file: wrong, save: false })
    expect(checked.problems).toBe(3)
    expect(checked.rows[1]!.problem).toContain('No employee found')
    expect(checked.rows[1]!.name).toBeNull()
    expect(checked.rows[2]!.problem).toContain('No leave type')
    expect(checked.rows[3]!.problem).toContain('twice')
    await expect(balancesService.importBalances(hrA, { file: wrong, save: true })).rejects.toThrow('nothing was saved')
    expect(await prisma.leaveLedgerEntry.count({ where: { leaveTypeId: typeId } })).toBe(0)
  })

  it('sets each balance - the difference as an adjustment; the same file again changes nothing', async () => {
    const good = await file([
      { 'Employee code': a.employeeCode, 'Leave type': code, Balance: 6, Note: 'From the old system' },
      { 'Employee code': a2.employeeCode, 'Leave type': code, Balance: 2.5 },
    ])
    const saved = await balancesService.importBalances(hrA, { file: good, save: true })
    expect(saved).toMatchObject({ problems: 0, changes: 2, saved: 2 })
    const again = await balancesService.importBalances(hrA, { file: good, save: true })
    expect(again).toMatchObject({ changes: 0, saved: 0 })
    const lower = await balancesService.importBalances(hrA, { file: await file([{ 'Employee code': a.employeeCode, 'Leave type': code, Balance: 4 }]), save: true })
    expect(lower.rows[0]).toMatchObject({ current: 6, balance: 4, change: -2 })
    const entries = await prisma.leaveLedgerEntry.findMany({ where: { employeeId: a.id, leaveTypeId: typeId }, orderBy: { id: 'asc' }, select: { kind: true, days: true, note: true } })
    expect(entries.map((e) => [e.kind, e.days.toNumber(), e.note])).toEqual([
      ['ADJUSTMENT', 6, 'From the old system'],
      ['ADJUSTMENT', -2, 'Opening balance (Excel import)'],
    ])
  })

  it("the preview and the approver's panel name the teammates away on those days", async () => {
    const mon = monday(6)
    const away = await applicationsService.apply(userWith(a2, [{ access: {}, rows: [] }]), { leaveTypeId: typeId, fromDate: mon, toDate: mon, fromSecondHalf: false, toFirstHalf: false, reason: 'Travel' })
    const preview = await applicationsService.preview(userWith(a, [{ access: {}, rows: [] }]), { leaveTypeId: typeId, fromDate: mon, toDate: new Date(mon.getTime() + DAY), fromSecondHalf: false, toFirstHalf: false })
    expect(preview.teamOff).toEqual([expect.objectContaining({ employee: expect.objectContaining({ employeeCode: a2.employeeCode }), waiting: true })])
    // nobody else on another day; the teammate's own leave does not list themselves
    const other = await applicationsService.preview(userWith(a, [{ access: {}, rows: [] }]), { leaveTypeId: typeId, fromDate: monday(7), toDate: monday(7), fromSecondHalf: false, toFirstHalf: false })
    expect(other.teamOff).toEqual([])
    const forHr = await applicationsService.getForApproval(userWith({ id: 0, employeeCode: 'HRA' }, [{ access: { LEAVE: 'READ' }, rows: [row(null, null, null)] }]), away.approvalRequestId)
    expect(forHr.teamOff).toEqual([])
  })
})
