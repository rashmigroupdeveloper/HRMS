import { prisma } from '#core/db/prisma'
import { approvalsService } from '#modules/approvals'
import { attendanceService } from '#modules/attendance'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as listsService from '../src/modules/attendance/holiday-lists/holiday-lists.service.js'
import * as holidaysService from '../src/modules/attendance/holidays/holidays.service.js'
import * as applicationsService from '../src/modules/leave/applications/applications.service.js'
import * as balancesService from '../src/modules/leave/balances/balances.service.js'
import * as typesService from '../src/modules/leave/types/types.service.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { followList, holidaySetup } from './helpers/holidays.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// On-application holidays (the user, 2026-11-24 - the election example): two election dates, one day of election leave given
// to everyone on the West Bengal list; each takes one date, approved like leave; the day is then a holiday for them. A
// holiday removed, or someone moved to another list, cancels the leave taking it and gives the day back.

const tag = Math.random().toString(36).slice(2, 7).toUpperCase()
const DAY = 24 * 60 * 60 * 1000
const utcToday = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
// the Monday `weeks` weeks from this week's Monday
function monday(weeks: number) {
  const day = utcToday()
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY + weeks * 7 * DAY)
}

describe('on-application holidays', () => {
  let voter: { id: number; employeeCode: string }
  let elsewhere: { id: number; employeeCode: string }
  let self: ReturnType<typeof userWith>
  let approver: ReturnType<typeof userWith>
  let electionType: number
  let list: { categoryId: number; holidayListId: number }
  let companyA: number
  const hr = userWith({ id: 0, employeeCode: 'HRHL' }, [{ access: { LEAVE: 'WRITE', ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
  const tuesday = new Date(monday(3).getTime() + DAY)
  const wednesday = new Date(monday(3).getTime() + 2 * DAY)
  const thursday = new Date(monday(3).getTime() + 3 * DAY)
  const asked = (date: Date, halves: { fromSecondHalf?: boolean; toFirstHalf?: boolean } = {}) => ({
    leaveTypeId: electionType,
    fromDate: date,
    toDate: date,
    fromSecondHalf: halves.fromSecondHalf ?? false,
    toFirstHalf: halves.toFirstHalf ?? false,
  })
  const balance = async () => (await balancesService.getBalances(self, {})).balances.find((b) => b.leaveType.id === electionType)?.balance

  beforeAll(async () => {
    companyA = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    voter = await createEmployee({ companyId: companyA, plantId: plantA })
    elsewhere = await createEmployee({ companyId: companyA, plantId: plantA })
    self = userWith(voter, [{ access: {}, rows: [] }])
    // company A's own leave chains: one step - a role held in company A
    const role = await createRole()
    const a = await createEmployee({ companyId: companyA, plantId: plantA })
    await giveLogin(a.id, [{ roleId: role.id, companyId: companyA }])
    approver = { ...userWith(a, [{ access: {}, rows: [row(companyA, null, null)] }]), activeRoleId: role.id }
    const chainsAdmin = userWith({ id: 0, employeeCode: 'CHAINSHL' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    for (const kind of ['LEAVE', 'LEAVE_CANCEL'] as const) {
      await chainsService.saveChain(chainsAdmin, { kind, companyId: companyA, steps: [{ approverType: 'ROLE', roleId: role.id, seesConfidential: false }] })
    }
    const type = await typesService.createType(hr, {
      code: `E${tag}`,
      name: `Election leave ${tag}`,
      isPaid: true,
      creditPerMonth: 0,
      creditAfterMonths: 0,
      maxCarryForward: 5,
      maxPerRequest: null,
      allowHalfDay: true,
      countsOffDays: false,
      genders: [],
      employmentTypes: [],
      holidaysOnly: true,
    })
    electionType = type.id
    // (taken only on its holiday dates: it lapses at the year end, whatever was typed)
    expect(type).toMatchObject({ holidaysOnly: true, maxCarryForward: 0 })
    list = await holidaySetup(companyA)
    await followList([voter.id], list.holidayListId)
    // the two election dates: on application, from the election leave; the first may be taken as a half day
    for (const [date, allowHalfDay] of [[tuesday, true], [wednesday, false]] as const) {
      await holidaysService.createHoliday(
        { date, name: `Election ${tag} ${date.getUTCDate()}`, categoryId: list.categoryId, holidayListIds: [list.holidayListId], mode: 'ON_APPLICATION', leaveTypeId: electionType, allowHalfDay },
        hr,
      )
    }
  })
  // the run's own leave types retired at the end: the test database is never wiped, and active types crediting everyone
  // slow down every later credit run (2026-11-24 - the comp-off test timed out)
  afterAll(async () => {
    await prisma.leaveType.updateMany({ where: { name: { endsWith: ` ${tag}` } }, data: { isActive: false, updatedById: 0 } })
    await prisma.$disconnect()
  })

  it('names a leave type taken only on its holiday dates, and keeps the day a working day', async () => {
    const ordinary = await typesService.createType(hr, { code: `O${tag}`, name: `Ordinary ${tag}`, isPaid: true, creditPerMonth: 0, creditAfterMonths: 0, maxCarryForward: null, maxPerRequest: null, allowHalfDay: true, countsOffDays: false, genders: [], employmentTypes: [] })
    await expect(
      holidaysService.createHoliday({ date: thursday, name: 'Wrong type', categoryId: list.categoryId, holidayListIds: [list.holidayListId], mode: 'ON_APPLICATION', leaveTypeId: ordinary.id }, hr),
    ).rejects.toThrow('not taken only on its holiday dates')
    await expect(
      holidaysService.createHoliday({ date: thursday, name: 'No type', categoryId: list.categoryId, holidayListIds: [list.holidayListId], mode: 'ON_APPLICATION' }, hr),
    ).rejects.toThrow('needs the leave type')
    // nobody is off on an on-application holiday until they take it
    const [day] = await attendanceService.planDays(voter.id, tuesday, tuesday)
    expect(day).toMatchObject({ kind: 'WORK', holiday: null })
  })

  it('gives one day to everyone on the list, then each takes one of the dates', async () => {
    const counted = await balancesService.giveMany(hr, { leaveTypeId: electionType, days: 1, note: 'West Bengal election - one day', holidayListIds: [list.holidayListId], dryRun: true })
    expect(counted).toMatchObject({ toGive: 1, given: 0 })
    await balancesService.giveMany(hr, { leaveTypeId: electionType, days: 1, note: 'West Bengal election - one day', holidayListIds: [list.holidayListId] })
    expect(await balance()).toBe(1)

    // only on its dates - the refusal says which; a whole-day one never by halves
    const problems = async (input: ReturnType<typeof asked>, who = self) => (await applicationsService.preview(who, input)).problems.join(' | ')
    expect(await problems(asked(thursday))).toContain('taken only on its holiday dates - yours:')
    expect(await problems(asked(wednesday, { toFirstHalf: true }))).toContain('is taken as a whole day')
    expect(await problems(asked(tuesday, { toFirstHalf: true }))).not.toContain('whole day')
    // someone not on the list: none open to them
    expect(await problems(asked(tuesday), userWith(elsewhere, [{ access: {}, rows: [] }]))).toContain('none is open to you')

    // taken and approved: the day is a holiday for them; the one day is used up
    const leave = await applicationsService.apply(self, { ...asked(tuesday), reason: 'Voting' })
    await approvalsService.decide(approver, { id: leave.approvalRequestId, approve: true })
    expect(await balance()).toBe(0)
    const covers = await attendanceService.loadCovers([voter.id], tuesday, tuesday)
    expect(covers.get(`${voter.id}:${tuesday.toISOString().slice(0, 10)}`)?.map((c) => c.status)).toEqual(['HOLIDAY', 'HOLIDAY'])
    expect(await problems(asked(wednesday))).toContain('Not enough')
  })

  it('cancels the leave and gives the day back when the holiday is removed or the employee moves list', async () => {
    const [tuesdayHoliday] = (await holidaysService.listHolidays(tuesday.getUTCFullYear(), list.holidayListId)).filter((h) => h.date.getTime() === tuesday.getTime())
    await holidaysService.deleteHoliday(tuesdayHoliday!.id, hr)
    const mine = await applicationsService.listMine(self)
    expect(mine.find((l) => l.fromDate.getTime() === tuesday.getTime())).toMatchObject({ status: 'CANCELLED' })
    expect(await balance()).toBe(1)

    // the other date, asked for; then they follow another list - the leave still waiting is cancelled
    const waiting = await applicationsService.apply(self, { ...asked(wednesday), reason: 'Voting' })
    const other = await holidaySetup(companyA)
    await listsService.assignHolidayList({ employeeCodes: [voter.employeeCode], holidayListId: other.holidayListId, effectiveFrom: monday(1) }, hr)
    expect((await applicationsService.listMine(self)).find((l) => l.id === waiting.id)).toMatchObject({ status: 'CANCELLED' })
    expect(await balance()).toBe(1)
  })

  // the user, 2026-11-25: once its day has passed and someone took it, an on-application holiday stays as it is
  it('never moves or removes an on-application holiday already passed and taken', async () => {
    const lastTuesday = new Date(monday(-1).getTime() + DAY)
    const past = await holidaysService.createHoliday(
      { date: lastTuesday, name: `Past election ${tag}`, categoryId: list.categoryId, holidayListIds: [list.holidayListId], mode: 'ON_APPLICATION', leaveTypeId: electionType },
      hr,
    )
    const leave = await applicationsService.apply(self, { ...asked(lastTuesday), reason: 'Voted' })
    await approvalsService.decide(approver, { id: leave.approvalRequestId, approve: true })
    await expect(holidaysService.deleteHoliday(past.id, hr)).rejects.toThrow('has passed and 1 employee took it')
    await expect(holidaysService.updateHoliday({ id: past.id, date: new Date(lastTuesday.getTime() + DAY) }, hr)).rejects.toThrow('can no longer be moved')
    // a new name is still fine; the leave stays approved
    await expect(holidaysService.updateHoliday({ id: past.id, name: `Past election (renamed) ${tag}` }, hr)).resolves.toMatchObject({ name: `Past election (renamed) ${tag}` })
    expect((await applicationsService.listMine(self)).find((l) => l.id === leave.id)).toMatchObject({ status: 'APPROVED' })
  })

  it('gives days only to employees inside the Leave Edit data access', async () => {
    const otherCompany = (await createCompany()).id
    const outside = await createEmployee({ companyId: otherCompany, plantId: (await createPlant(otherCompany)).id })
    const hrForA = userWith({ id: 0, employeeCode: 'HRHLA' }, [{ access: { LEAVE: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await expect(balancesService.giveMany(hrForA, { leaveTypeId: electionType, days: 1, note: 'Not theirs to give', employeeCodes: [outside.employeeCode] })).rejects.toThrow('No employee found')
    // everyone they may give to: company A's people only
    const all = await balancesService.giveMany(hrForA, { leaveTypeId: electionType, days: 1, note: 'Everyone of mine', dryRun: true })
    const allA = await balancesService.giveMany(hrForA, { leaveTypeId: electionType, days: 1, note: 'Everyone of mine', companyIds: [companyA], dryRun: true })
    expect(all.people).toBe(allA.people)
  })
})
