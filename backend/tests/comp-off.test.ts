import { SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import { approvalsService } from '#modules/approvals'
import { employeesService } from '#modules/employees'
import { zonedInstant } from '#shared/utils/time'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as balancesService from '../src/modules/leave/balances/balances.service.js'
import * as compOffService from '../src/modules/leave/comp-off/comp-off.service.js'
import * as typesService from '../src/modules/leave/types/types.service.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Comp-off claims (the user, 2026-11-22): work on a weekly off (here a Sunday - the default weekly off) is claimed; the
// punches decide (8 h = a day, 4 h = half a day); approved, the days are credited to the comp-off type and expire 90 days
// after the day worked.

const DAY = 86_400_000
const utcToday = () => {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}
// the Sunday `weeks` weeks back (at least a day ago)
function sunday(weeks: number) {
  const t = utcToday()
  const back = t.getUTCDay() === 0 ? 7 : t.getUTCDay()
  return new Date(t.getTime() - (back + 7 * (weeks - 1)) * DAY)
}

describe('comp-off claims', () => {
  let employee: { id: number; employeeCode: string }
  let self: ReturnType<typeof userWith>
  let approver: ReturnType<typeof userWith>
  let timezone: string
  let typeId: number

  async function punch(day: Date, ...clocks: string[]) {
    await prisma.punch.createMany({
      data: clocks.map((c) => {
        const [h, m] = c.split(':').map(Number) as [number, number]
        return { employeeId: employee.id, employeeCode: employee.employeeCode, punchedAt: zonedInstant(day, h * 60 + m, timezone), source: 'UPLOAD' as const, createdById: 0, updatedById: 0 }
      }),
    })
    await daysService.recompute([employee.id], day, day)
  }

  beforeAll(async () => {
    const companyA = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    employee = await createEmployee({ companyId: companyA, plantId: plantA })
    self = userWith(employee, [{ access: {}, rows: [] }])
    const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [employee.id], from: utcToday(), to: utcToday() })
    timezone = person!.timezone
    const role = await createRole()
    const a = await createEmployee({ companyId: companyA, plantId: plantA })
    await giveLogin(a.id, [{ roleId: role.id, companyId: companyA }])
    approver = { ...userWith(a, [{ access: {}, rows: [row(companyA, null, null)] }]), activeRoleId: role.id }
    const chainsAdmin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await chainsService.saveChain(chainsAdmin, { kind: 'COMP_OFF', companyId: companyA, steps: [{ approverType: 'ROLE', roleId: role.id, seesConfidential: false }] })
    typeId = (await typesService.compOffType())!.id
  })
  afterAll(() => prisma.$disconnect())

  it('a Sunday worked 09:00-18:30 earns a day once approved, expiring 90 days later; claimed once', async () => {
    const sun = sunday(1)
    await punch(sun, '09:00', '18:30')
    const claim = await compOffService.claim(self, { workDate: sun, reason: 'Month-end stock count' })
    expect(claim).toMatchObject({ status: 'PENDING', days: 1 })
    await expect(compOffService.claim(self, { workDate: sun, reason: 'Again' })).rejects.toThrow('already claimed')
    await approvalsService.decide(approver, { id: claim.approvalRequestId, approve: true })
    const [approved] = await compOffService.listMine(self)
    expect(approved).toMatchObject({ status: 'APPROVED', days: 1 })
    expect(approved!.expiresOn?.getTime()).toBe(sun.getTime() + 90 * DAY)
    const balance = (await balancesService.getBalances(self, {})).balances.find((b) => b.leaveType.id === typeId)
    expect(balance?.balance).toBe(1)

    // unused 90 days later, it lapses (once)
    const after = new Date(sun.getTime() + 91 * DAY)
    expect((await balancesService.creditDue(after, { employeeIds: [employee.id] })).expired).toBe(1)
    expect((await balancesService.creditDue(after, { employeeIds: [employee.id] })).expired).toBe(0)
    const left = await prisma.leaveLedgerEntry.aggregate({ where: { employeeId: employee.id, leaveTypeId: typeId }, _sum: { days: true } })
    expect(left._sum.days?.toNumber()).toBe(0)
  })

  it('half a day for 4 hours; nothing for less; never for a working day or too long ago', async () => {
    const sun = sunday(2)
    await punch(sun, '09:00', '13:45')
    expect((await compOffService.claim(self, { workDate: sun, reason: 'Urgent dispatch' })).days).toBe(0.5)
    const short = sunday(3)
    await punch(short, '10:00', '12:00')
    await expect(compOffService.claim(self, { workDate: short, reason: 'Short visit' })).rejects.toThrow('at least 4 hours')
    // a Monday already over (the Monday after two Sundays back - never today)
    await expect(compOffService.claim(self, { workDate: new Date(sunday(2).getTime() + DAY), reason: 'A Monday' })).rejects.toThrow('working day')
    await expect(compOffService.claim(self, { workDate: sunday(6), reason: 'Long ago' })).rejects.toThrow('within 30 days')
  })
})

// Which days a leave uses (the user, 2026-11-23 - as Workday and Odoo do it): only the days there on the leave's date, the
// closest to expiry first; HR's days (never expiring) last
describe('comp-off expiry', () => {
  const d = (m: number, day: number) => new Date(Date.UTC(2026, m - 1, day))
  const given = (on: Date, days: number) => ({ kind: 'ADJUSTMENT', days, effectiveDate: on, expiresOn: null, applicationId: null })
  const earned = (on: Date, days: number) => ({ kind: 'COMP_OFF', days, effectiveDate: on, expiresOn: new Date(on.getTime() + 90 * DAY), applicationId: null })
  const taken = (on: Date, days: number, applicationId: number) => ({ kind: 'TAKEN', days: -days, effectiveDate: on, expiresOn: null, applicationId })

  it("lets a comp-off earned after a leave expire - the leave used HR's days", () => {
    // HR gives 2 days in January, 2 taken in February, a Sunday worked on 1 March (expires 30 May), never used
    const rows = [given(d(1, 5), 2), taken(d(2, 10), 2, 1), earned(d(3, 1), 1)]
    expect(balancesService.compOffToExpire(rows, d(5, 30))).toBe(0)
    expect(balancesService.compOffToExpire(rows, d(5, 31))).toBe(1)
    // once expired, nothing more
    expect(balancesService.compOffToExpire([...rows, { kind: 'EXPIRED', days: -1, effectiveDate: d(5, 31), expiresOn: null, applicationId: null }], d(6, 1))).toBe(0)
  })

  it('uses the comp-off closest to expiry before HR days when both are there', () => {
    // a comp-off from 1 March, HR's day on 1 April, a day taken on 10 April: the comp-off is used, HR's day stays
    expect(balancesService.compOffToExpire([earned(d(3, 1), 1), given(d(4, 1), 1), taken(d(4, 10), 1, 2)], d(6, 30))).toBe(0)
    // a leave cancelled gives its day back: the comp-off then lapses
    const cancelled = { kind: 'RETURNED', days: 1, effectiveDate: d(4, 10), expiresOn: null, applicationId: 2 }
    expect(balancesService.compOffToExpire([earned(d(3, 1), 1), given(d(4, 1), 1), taken(d(4, 10), 1, 2), cancelled], d(6, 30))).toBe(1)
  })
})
