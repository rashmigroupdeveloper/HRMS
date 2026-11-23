import { prisma } from '#core/db/prisma'
import { approvalsService } from '#modules/approvals'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as regularizationsService from '../src/modules/attendance/regularizations/regularizations.service.js'
import * as applicationsService from '../src/modules/leave/applications/applications.service.js'
import * as balancesService from '../src/modules/leave/balances/balances.service.js'
import * as typesService from '../src/modules/leave/types/types.service.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Leave and regularization / on duty (2026-11-22, the old HRMS's rules): balances as a ledger (monthly credits once per
// month, HR's adjustments), applications counted by the attendance plan and approved through the approval service, the
// cancelling of approved leave through its own approval, and the leave / requests on the attendance days.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 24 * 60 * 60 * 1000
const utcToday = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
// the Monday `weeks` weeks from this week's Monday (negative: weeks back)
function monday(weeks: number) {
  const day = utcToday()
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY + weeks * 7 * DAY)
}
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY)

describe('leave', () => {
  let employee: { id: number; employeeCode: string }
  let self: ReturnType<typeof userWith>
  let approver: ReturnType<typeof userWith>
  let hr: ReturnType<typeof userWith>
  let typeId: number
  let typeCode: string

  beforeAll(async () => {
    const companyA = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    employee = await createEmployee({ companyId: companyA, plantId: plantA })
    self = userWith(employee, [{ access: {}, rows: [] }])
    // company A's own chains: one step - a role held in company A
    const role = await createRole()
    const a = await createEmployee({ companyId: companyA, plantId: plantA })
    await giveLogin(a.id, [{ roleId: role.id, companyId: companyA }])
    approver = userWith(a, [{ access: {}, rows: [row(companyA, null, null)] }])
    const chainsAdmin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    for (const kind of ['LEAVE', 'LEAVE_CANCEL', 'REGULARIZATION', 'ON_DUTY'] as const) {
      await chainsService.saveChain(chainsAdmin, { kind, companyId: companyA, steps: [{ approverType: 'ROLE', roleId: role.id, seesConfidential: false }] })
    }
    // HR for every company (leave types are shared)
    hr = userWith({ id: 0, employeeCode: 'HR' }, [{ access: { LEAVE: 'WRITE' }, rows: [row(null, null, null)] }])
    typeCode = `T${tag}`
    const type = await typesService.createType(hr, {
      code: typeCode,
      name: `Test leave ${tag}`,
      isPaid: true,
      creditPerMonth: 1.5,
      creditAfterMonths: 0,
      maxCarryForward: null,
      maxPerRequest: 10,
      allowHalfDay: true,
      countsOffDays: false,
      genders: [],
      employmentTypes: [],
    })
    typeId = type.id
  })
  afterAll(() => prisma.$disconnect())

  const balanceOf = async () => (await balancesService.getBalances(self, {})).balances.find((b) => b.leaveType.id === typeId)!

  it('credits each month once, from the month after the type was added', async () => {
    const next = new Date(Date.UTC(utcToday().getUTCFullYear(), utcToday().getUTCMonth() + 1, 1))
    const asOf = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1))
    await balancesService.creditDue(asOf, { employeeIds: [employee.id] })
    await balancesService.creditDue(asOf, { employeeIds: [employee.id] })
    const credits = await prisma.leaveLedgerEntry.findMany({ where: { employeeId: employee.id, leaveTypeId: typeId, kind: 'CREDIT' }, select: { days: true } })
    expect(credits.map((c) => c.days.toNumber())).toEqual([1.5, 1.5])
  })

  it('HR adjusts the balance with a reason, never below zero', async () => {
    await expect(balancesService.adjust(hr, { employeeCode: employee.employeeCode, leaveTypeId: typeId, days: -100, note: 'Too much taken away' })).rejects.toThrow('below zero')
    await balancesService.adjust(hr, { employeeCode: employee.employeeCode, leaveTypeId: typeId, days: 2, note: 'Opening balance' })
    expect((await balanceOf()).balance).toBe(5)
  })

  it('counts working days only (a weekly off inside does not count), halves as 0.5', async () => {
    const fri = plus(monday(3), 4)
    // Friday, Saturday, (Sunday off), Monday
    const span = await applicationsService.preview(self, { leaveTypeId: typeId, fromDate: fri, toDate: plus(fri, 3), fromSecondHalf: false, toFirstHalf: false })
    expect(span.days).toBe(3)
    const half = await applicationsService.preview(self, { leaveTypeId: typeId, fromDate: fri, toDate: fri, fromSecondHalf: true, toFirstHalf: false })
    expect(half.days).toBe(0.5)
    const tooMuch = await applicationsService.preview(self, { leaveTypeId: typeId, fromDate: monday(4), toDate: plus(monday(4), 5), fromSecondHalf: false, toFirstHalf: false })
    expect(tooMuch.problems.join(' ')).toContain('Not enough')
  })

  it('applies, holds the days back, refuses the same days twice; approved, the days are taken', async () => {
    const mon = monday(2)
    const asked = await applicationsService.apply(self, { leaveTypeId: typeId, fromDate: mon, toDate: plus(mon, 1), fromSecondHalf: false, toFirstHalf: false, reason: 'Family function' })
    expect(asked).toMatchObject({ status: 'PENDING', days: 2 })
    expect(await balanceOf()).toMatchObject({ balance: 5, pending: 2, available: 3 })
    await expect(applicationsService.apply(self, { leaveTypeId: typeId, fromDate: plus(mon, 1), toDate: plus(mon, 1), fromSecondHalf: false, toFirstHalf: false, reason: 'Again' })).rejects.toThrow('already has leave')
    // the employee never decides their own
    await expect(approvalsService.decide(self, { id: asked.approvalRequestId, approve: true })).rejects.toThrow()
    await approvalsService.decide(approver, { id: asked.approvalRequestId, approve: true })
    expect(await balanceOf()).toMatchObject({ balance: 3, pending: 0, available: 3, taken: 2 })
    // the days to come show the leave
    const month = await daysService.getMyMonth(self, daysService.cycleOf(mon, (await daysService.loadLockState()).startDay))
    expect(month.days.find((d) => d.date.getTime() === mon.getTime())?.covers).toEqual([
      expect.objectContaining({ half: 'FIRST', status: 'LEAVE', code: typeCode }),
      expect.objectContaining({ half: 'SECOND', status: 'LEAVE', code: typeCode }),
    ])

    // cancelling the approved leave goes for approval; approved, the days come back
    await expect(applicationsService.cancel(self, { id: asked.id })).rejects.toThrow('Say why')
    const cancelling = await applicationsService.cancel(self, { id: asked.id, reason: 'Plans changed' })
    expect(cancelling.status).toBe('APPROVED')
    expect(cancelling.cancelRequest?.status).toBe('PENDING')
    await approvalsService.decide(approver, { id: cancelling.cancelRequest!.approvalRequestId, approve: true })
    expect((await applicationsService.listMine(self)).find((a) => a.id === asked.id)?.status).toBe('CANCELLED')
    expect(await balanceOf()).toMatchObject({ balance: 5, taken: 0 })
  })

  it('an approved leave on a past day shows on the attendance day; a missed punch regularized is present', async () => {
    const lastMonday = monday(-1)
    const leave = await applicationsService.apply(self, { leaveTypeId: typeId, fromDate: lastMonday, toDate: lastMonday, fromSecondHalf: false, toFirstHalf: false, reason: 'Unwell' })
    await approvalsService.decide(approver, { id: leave.approvalRequestId, approve: true })
    const leaveDay = await prisma.attendanceDay.findFirst({ where: { employeeId: employee.id, date: lastMonday }, select: { status: true, firstHalf: true } })
    expect(leaveDay).toMatchObject({ status: 'LEAVE', firstHalf: 'LEAVE' })

    // the Tuesday: no punches = absent; a missed-punch request for its first half - approved, that half is present
    const tuesday = plus(lastMonday, 1)
    await daysService.recompute([employee.id], tuesday, tuesday)
    expect((await prisma.attendanceDay.findFirst({ where: { employeeId: employee.id, date: tuesday }, select: { status: true } }))?.status).toBe('ABSENT')
    // the leave day cannot be regularized too
    await expect(regularizationsService.createRequest(self, { kind: 'MISSED_PUNCH', fromDate: lastMonday, toDate: lastMonday, portion: 'FULL_DAY', reason: 'Forgot my card' })).rejects.toThrow('already has leave')
    const request = await regularizationsService.createRequest(self, { kind: 'MISSED_PUNCH', fromDate: tuesday, toDate: tuesday, portion: 'FIRST_HALF', reason: 'Forgot my card' })
    expect(request.status).toBe('PENDING')
    await approvalsService.decide(approver, { id: request.approvalRequestId, approve: true })
    const fixed = await prisma.attendanceDay.findFirst({ where: { employeeId: employee.id, date: tuesday }, select: { status: true, firstHalf: true, secondHalf: true } })
    expect(fixed).toMatchObject({ status: 'HALF_DAY', firstHalf: 'PRESENT', secondHalf: 'ABSENT' })
  })

  it('on duty for days to come; a missed punch only for days come; withdrawn while waiting', async () => {
    await expect(regularizationsService.createRequest(self, { kind: 'MISSED_PUNCH', fromDate: monday(5), toDate: monday(5), portion: 'FULL_DAY', reason: 'Forgot my card' })).rejects.toThrow('already come')
    await expect(regularizationsService.createRequest(self, { kind: 'MISSED_PUNCH', fromDate: plus(utcToday(), -40), toDate: plus(utcToday(), -40), portion: 'FULL_DAY', reason: 'Long ago' })).rejects.toThrow('30 days')
    const duty = await regularizationsService.createRequest(self, { kind: 'ON_DUTY', fromDate: monday(5), toDate: plus(monday(5), 1), portion: 'FULL_DAY', reason: 'Client visit in Pune' })
    const withdrawn = await regularizationsService.cancelRequest(self, duty.id)
    expect(withdrawn.status).toBe('CANCELLED')
    const again = await regularizationsService.createRequest(self, { kind: 'ON_DUTY', fromDate: monday(5), toDate: monday(5), portion: 'FULL_DAY', reason: 'Client visit in Pune' })
    await approvalsService.decide(approver, { id: again.approvalRequestId, approve: true })
    const month = await daysService.getMyMonth(self, daysService.cycleOf(monday(5), (await daysService.loadLockState()).startDay))
    expect(month.days.find((d) => d.date.getTime() === monday(5).getTime())?.covers.map((c) => c.status)).toEqual(['ON_DUTY', 'ON_DUTY'])
  })

  it('the day overall from its halves with leave and on duty', () => {
    expect(daysService.dayStatusOf('LEAVE', 'PRESENT')).toBe('HALF_DAY')
    expect(daysService.dayStatusOf('LEAVE', 'ABSENT')).toBe('ABSENT')
    expect(daysService.dayStatusOf('LEAVE', 'WEEKLY_OFF')).toBe('LEAVE')
    expect(daysService.dayStatusOf('ON_DUTY', 'PRESENT')).toBe('PRESENT')
    expect(daysService.dayStatusOf('ON_DUTY', 'ABSENT')).toBe('HALF_DAY')
    expect(daysService.dayStatusOf('PRESENT', 'ABSENT')).toBe('HALF_DAY')
  })
})
