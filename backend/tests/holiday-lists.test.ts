import { prisma } from '#core/db/prisma'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as categoriesService from '../src/modules/attendance/holiday-categories/holiday-categories.service.js'
import * as listsService from '../src/modules/attendance/holiday-lists/holiday-lists.service.js'
import * as holidaysService from '../src/modules/attendance/holidays/holidays.service.js'
import { attendanceService } from '#modules/attendance'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Holiday lists and categories (the user, 2026-11-24): named lists of one company or every company, a default list per
// plant, and HR's categories with a colour.
describe('holiday lists and categories', () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let plantB: number
  const setupForAll = userWith({ id: 0, employeeCode: 'HLALL' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    plantB = (await createPlant(companyB)).id
  })
  afterAll(() => prisma.$disconnect())

  it("gives a plant a default list of its company or of every company - never another company's", async () => {
    const corporate = await listsService.createHolidayList({ name: `Corporate ${companyA}` }, setupForAll)
    const ofA = await listsService.createHolidayList({ name: `Plant list A ${companyA}`, companyId: companyA }, setupForAll)
    expect(ofA.company?.id).toBe(companyA)

    await expect(listsService.setPlantDefault({ plantId: plantB, holidayListId: ofA.id }, setupForAll)).rejects.toThrow('may use only')
    await listsService.setPlantDefault({ plantId: plantA, holidayListId: ofA.id }, setupForAll)
    await listsService.setPlantDefault({ plantId: plantB, holidayListId: corporate.id }, setupForAll)
    const lists = await listsService.listHolidayLists(setupForAll)
    expect(lists.find((l) => l.id === ofA.id)?.defaultPlants.map((p) => p.id)).toEqual([plantA])
    expect(lists.find((l) => l.id === corporate.id)?.defaultPlants.map((p) => p.id)).toEqual([plantB])

    // a plant's default cannot be retired, nor given to a company whose plant it is not
    await expect(listsService.updateHolidayList({ id: corporate.id, isActive: false }, setupForAll)).rejects.toThrow('another default before retiring')
    await expect(listsService.updateHolidayList({ id: corporate.id, companyId: companyA }, setupForAll)).rejects.toThrow("another company's plants")

    // no default any more: then it may be retired, and a retired list is no plant's default
    await listsService.setPlantDefault({ plantId: plantB, holidayListId: null }, setupForAll)
    await listsService.updateHolidayList({ id: corporate.id, isActive: false }, setupForAll)
    await expect(listsService.setPlantDefault({ plantId: plantB, holidayListId: corporate.id }, setupForAll)).rejects.toThrow('retired')
    expect((await listsService.listHolidayLists(setupForAll)).some((l) => l.id === corporate.id)).toBe(false)
    expect((await listsService.listHolidayLists(setupForAll, true)).some((l) => l.id === corporate.id)).toBe(true)
  })

  it('keeps categories with a colour, and retired ones out of the list', async () => {
    const election = await categoriesService.createHolidayCategory({ name: `Election ${companyA}`, tone: 'WARNING' }, setupForAll)
    expect(election).toMatchObject({ tone: 'WARNING', isActive: true })
    await categoriesService.updateHolidayCategory({ id: election.id, tone: 'INFO', isActive: false }, setupForAll)
    expect((await categoriesService.listHolidayCategories(setupForAll)).some((c) => c.id === election.id)).toBe(false)
    expect((await categoriesService.listHolidayCategories(setupForAll, true)).find((c) => c.id === election.id)?.tone).toBe('INFO')
  })
})

// The employee's holiday list from a date (the user, 2026-11-24): given one by one or to many, on the joining day, or by
// "fill in" from the plant's default; shown on Schedules; a list followed cannot be retired or given to another company.
describe("employees' holiday lists", () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let plantA2: number
  let inA: { id: number; employeeCode: string }
  let alsoInA: { id: number; employeeCode: string }
  let inB: { id: number; employeeCode: string }
  // Attendance setup Edit for company A only - fill in stays inside it (and other tests' employees out of it)
  let setupForA: ReturnType<typeof userWith>
  const setupForAll = userWith({ id: 0, employeeCode: 'HLALL2' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
  // far in the future: no locked attendance month of other tests lies after it
  const from = new Date(Date.UTC(2032, 0, 1))

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    plantA2 = (await createPlant(companyA)).id
    const plantB = (await createPlant(companyB)).id
    inA = await createEmployee({ companyId: companyA, plantId: plantA })
    alsoInA = await createEmployee({ companyId: companyA, plantId: plantA2 })
    inB = await createEmployee({ companyId: companyB, plantId: plantB })
    setupForA = userWith({ id: 0, employeeCode: 'HLA' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(companyA, null, null)] }])
  })

  it('gives lists from a date - a company list only to its own employees - and shows them on Schedules', async () => {
    const ofA = await listsService.createHolidayList({ name: `A works ${companyA}`, companyId: companyA }, setupForAll)
    const shared = await listsService.createHolidayList({ name: `Shared ${companyA}` }, setupForAll)
    await expect(listsService.assignHolidayList({ employeeCodes: [inA.employeeCode, inB.employeeCode], holidayListId: ofA.id, effectiveFrom: from }, setupForAll)).rejects.toThrow('another company')
    expect(await listsService.assignHolidayList({ employeeCodes: [inA.employeeCode, alsoInA.employeeCode], holidayListId: ofA.id, effectiveFrom: from }, setupForAll)).toEqual({ assigned: 2, unchanged: 0 })
    // the same again: nothing to change
    expect(await listsService.assignHolidayList({ employeeCodes: [inA.employeeCode], holidayListId: ofA.id, effectiveFrom: from }, setupForAll)).toEqual({ assigned: 0, unchanged: 1 })
    // a change later on: the days before keep the list they had
    const later = new Date(Date.UTC(2032, 5, 1))
    await listsService.assignHolidayList({ employeeCodes: [inA.employeeCode], holidayListId: shared.id, effectiveFrom: later }, setupForAll)
    const onDays = await listsService.listsOn([inA.id], new Date(Date.UTC(2032, 2, 1)))
    expect(onDays.get(inA.id)).toMatchObject({ holidayList: { id: ofA.id }, next: { holidayList: { id: shared.id } } })
    expect((await listsService.listsOn([inA.id], later)).get(inA.id)?.holidayList?.id).toBe(shared.id)

    // Schedules: who follows what today (before 2032: no list yet) - filtered on "no list"
    const none = await shiftsService.listSchedules(setupForAll, { search: inA.employeeCode, holidayListId: null })
    expect(none[0]?.holidayList).toMatchObject({ holidayList: null, next: { holidayList: { id: ofA.id } } })

    // followed (from a later date): neither retired nor given to company B
    await expect(listsService.updateHolidayList({ id: ofA.id, isActive: false }, setupForAll)).rejects.toThrow('follow this list')
    await expect(listsService.updateHolidayList({ id: shared.id, companyId: companyB }, setupForAll)).rejects.toThrow('of another company follow')
  })

  it("gives the plant's default to those without a list - inside the data access only", async () => {
    const def = await listsService.createHolidayList({ name: `A default ${companyA}`, companyId: companyA }, setupForAll)
    await listsService.setPlantDefault({ plantId: plantA, holidayListId: def.id }, setupForAll)
    const fresh = await createEmployee({ companyId: companyA, plantId: plantA })
    const noDefault = await createEmployee({ companyId: companyA, plantId: plantA2 })
    const count = await listsService.fillMissing({ dryRun: true }, setupForA)
    expect(count.given).toBe(0)
    expect(count.toGive).toBeGreaterThanOrEqual(1)
    expect(count.noDefault.some((p) => p.employees >= 1)).toBe(true)
    await listsService.fillMissing({}, setupForA)
    const lists = await listsService.listsOn([fresh.id, noDefault.id, inB.id], from)
    expect(lists.get(fresh.id)?.holidayList?.id).toBe(def.id)
    // a plant without a default: still none; company B (outside the data access): untouched
    expect(lists.get(noDefault.id)?.holidayList).toBeNull()
    expect(lists.get(inB.id)?.holidayList).toBeNull()
  })

  it('takes the list chosen on the joining day - in use and of the company', async () => {
    const ofA = await listsService.createHolidayList({ name: `Joining A ${companyA}`, companyId: companyA }, setupForAll)
    await expect(listsService.assertJoiningList(ofA.id, companyB)).rejects.toThrow('another company')
    await expect(listsService.assertJoiningList(ofA.id, companyA)).resolves.toBeUndefined()
    const joiner = await createEmployee({ companyId: companyA, plantId: plantA2 })
    await prisma.$transaction((tx) => listsService.giveOnJoining(joiner.id, ofA.id, new Date(Date.UTC(2026, 0, 1)), 0, tx))
    expect((await listsService.listsOn([joiner.id], from)).get(joiner.id)?.holidayList?.id).toBe(ofA.id)
  })

  it("never gives a list to someone outside the data access", async () => {
    const shared = await listsService.createHolidayList({ name: `Shared B ${companyA}` }, setupForAll)
    await expect(listsService.assignHolidayList({ employeeCodes: [inB.employeeCode], holidayListId: shared.id, effectiveFrom: from }, setupForA)).rejects.toThrow('No employee found')
  })
})

// Holidays in lists (the user, 2026-11-24): entered once, put in the lists that have it; a list has one holiday a day; a
// day's holiday comes from the list the employee follows; "copy from last year"; changing one needs Edit over every list.
describe('holidays in lists', () => {
  const setupForAll = userWith({ id: 0, employeeCode: 'HLALL3' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
  // a year far ahead: no locked month, no other test's holidays in these new lists
  const y = 2040
  const d = (month: number, day: number, year = y) => new Date(Date.UTC(year, month - 1, day))

  it('puts one holiday in several lists, one holiday a list a day, and plans the day from the employee\'s list', async () => {
    const companyA = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    const onA = await createEmployee({ companyId: companyA, plantId: plantA })
    const onShared = await createEmployee({ companyId: companyA, plantId: plantA })
    const onNone = await createEmployee({ companyId: companyA, plantId: plantA })
    const category = await categoriesService.createHolidayCategory({ name: `National ${companyA}`, tone: 'NEGATIVE' }, setupForAll)
    const ofA = await listsService.createHolidayList({ name: `Works ${companyA}`, companyId: companyA }, setupForAll)
    const shared = await listsService.createHolidayList({ name: `Corporate ${companyA}` }, setupForAll)
    await prisma.$transaction(async (tx) => {
      await listsService.giveOnJoining(onA.id, ofA.id, d(1, 1, 2026), 0, tx)
      await listsService.giveOnJoining(onShared.id, shared.id, d(1, 1, 2026), 0, tx)
    })

    const republic = await holidaysService.createHoliday({ date: d(1, 26), name: 'Republic Day', categoryId: category.id, holidayListIds: [ofA.id, shared.id] }, setupForAll)
    expect(republic.lists.map((l) => l.id).sort()).toEqual([ofA.id, shared.id].sort())
    // a list has one holiday a day
    await expect(holidaysService.createHoliday({ date: d(1, 26), name: 'Another', categoryId: category.id, holidayListIds: [ofA.id] }, setupForAll)).rejects.toThrow('already has Republic Day')
    // Durga Puja only in the works' list, its second half only
    await holidaysService.createHoliday({ date: d(10, 16), name: 'Durga Puja', categoryId: category.id, holidayListIds: [ofA.id], portion: 'SECOND_HALF' }, setupForAll)

    const plan = async (employeeId: number, date: Date) => (await attendanceService.planDays(employeeId, date, date))[0]!
    expect(await plan(onA.id, d(1, 26))).toMatchObject({ kind: 'HOLIDAY', holiday: 'Republic Day' })
    expect(await plan(onShared.id, d(1, 26))).toMatchObject({ kind: 'HOLIDAY', holiday: 'Republic Day' })
    // no list: no holidays
    expect((await plan(onNone.id, d(1, 26))).holiday).toBeNull()
    // the half-day holiday only for the works' list (16 Oct 2040 is a Tuesday - a working day)
    expect(await plan(onA.id, d(10, 16))).toMatchObject({ kind: 'WORK', holiday: 'Durga Puja', holidayHalf: 'SECOND' })
    expect((await plan(onShared.id, d(10, 16))).holiday).toBeNull()

    // taken off one list: that list's people work
    await holidaysService.updateHoliday({ id: republic.id, holidayListIds: [shared.id] }, setupForAll)
    expect((await plan(onA.id, d(1, 26))).holiday).toBeNull()

    // a list change from a date: the days before keep the old list's holidays, the days after follow the new one
    const mover = await createEmployee({ companyId: companyA, plantId: plantA })
    await prisma.$transaction(async (tx) => {
      await listsService.giveOnJoining(mover.id, ofA.id, d(1, 1, 2026), 0, tx)
      await listsService.giveOnJoining(mover.id, shared.id, d(6, 1), 0, tx)
    })
    await holidaysService.createHoliday({ date: d(3, 1), name: 'Old list, before', categoryId: category.id, holidayListIds: [ofA.id] }, setupForAll)
    await holidaysService.createHoliday({ date: d(7, 2), name: 'Old list, after', categoryId: category.id, holidayListIds: [ofA.id] }, setupForAll)
    await holidaysService.createHoliday({ date: d(7, 3), name: 'New list, after', categoryId: category.id, holidayListIds: [shared.id] }, setupForAll)
    expect((await plan(mover.id, d(3, 1))).holiday).toBe('Old list, before')
    expect((await plan(mover.id, d(7, 2))).holiday).toBeNull()
    expect((await plan(mover.id, d(7, 3))).holiday).toBe('New list, after')
    // "My holidays": their own - each part of the year from the list followed then; nobody else's
    const theirs = await holidaysService.myHolidays(userWith(mover, [{ access: {}, rows: [] }]), y)
    const names = theirs.holidays.map((h) => h.name)
    expect(names).toContain('Old list, before')
    expect(names).toContain('New list, after')
    expect(names).not.toContain('Old list, after')
    expect(theirs.holidays.find((h) => h.name === 'New list, after')?.list.id).toBe(shared.id)
    expect((await holidaysService.myHolidays(userWith(onNone, [{ access: {}, rows: [] }]), y)).holidays).toEqual([])
    // a retired list of a holiday does not lock the holiday: it can still be changed (taken off that list too)
    const old = await listsService.createHolidayList({ name: `Old ${companyA}`, companyId: companyA }, setupForAll)
    const dual = await holidaysService.createHoliday({ date: d(9, 4), name: 'In a list retired later', categoryId: category.id, holidayListIds: [ofA.id, old.id] }, setupForAll)
    await listsService.updateHolidayList({ id: old.id, isActive: false }, setupForAll)
    await expect(holidaysService.updateHoliday({ id: dual.id, name: 'Renamed', holidayListIds: [ofA.id, old.id] }, setupForAll)).resolves.toMatchObject({ name: 'Renamed' })
    await expect(holidaysService.updateHoliday({ id: dual.id, holidayListIds: [ofA.id] }, setupForAll)).resolves.toMatchObject({ lists: [{ id: ofA.id }] })
    // but a retired list is never added
    await expect(holidaysService.updateHoliday({ id: dual.id, holidayListIds: [ofA.id, old.id] }, setupForAll)).rejects.toThrow('retired')

    // copy into the next year: the same day and month, the same lists; a second copy finds them there
    const copied = await holidaysService.copyYear({ year: y + 1 }, setupForAll)
    expect(copied.copied).toBeGreaterThanOrEqual(2)
    const next = await holidaysService.listHolidays(y + 1, ofA.id)
    expect(next.map((h) => [h.name, h.portion])).toContainEqual(['Durga Puja', 'SECOND_HALF'])
    // Republic Day was taken off the works' list: copied only into the shared one
    expect(next.some((h) => h.name === 'Republic Day')).toBe(false)
    expect((await holidaysService.listHolidays(y + 1, shared.id)).find((h) => h.name === 'Republic Day')?.date).toEqual(d(1, 26, y + 1))
    const again = await holidaysService.copyYear({ year: y + 1 }, setupForAll)
    expect(again.copied).toBe(0)

    // company A's admin: their own list yes, the list of every company no
    const adminForA = userWith({ id: 0, employeeCode: 'HLA3' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await expect(holidaysService.createHoliday({ date: d(8, 15), name: 'Independence Day', categoryId: category.id, holidayListIds: [ofA.id, shared.id] }, adminForA)).rejects.toThrow('shared by every company')
    await expect(holidaysService.createHoliday({ date: d(8, 15), name: 'Independence Day', categoryId: category.id, holidayListIds: [ofA.id] }, adminForA)).resolves.toMatchObject({ name: 'Independence Day' })
    await expect(holidaysService.deleteHoliday(republic.id, adminForA)).rejects.toThrow('shared by every company')
  })
})
