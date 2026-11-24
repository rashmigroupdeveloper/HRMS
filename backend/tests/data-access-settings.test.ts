import { prisma } from '#core/db/prisma'
import { changeHistoryService } from '#modules/change-history'
import { companiesService, departmentsService, plantsService, positionsService, regionsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as holidayCategoriesService from '../src/modules/attendance/holiday-categories/holiday-categories.service.js'
import * as holidayListsService from '../src/modules/attendance/holiday-lists/holiday-lists.service.js'
import * as holidaysService from '../src/modules/attendance/holidays/holidays.service.js'
import * as rostersService from '../src/modules/attendance/rosters/rosters.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { holidaySetup } from './helpers/holidays.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Data access (A4, 2026-11-18): what belongs to one company needs Edit for that whole company; what every company shares
// needs Edit for all companies; attendance and the change history follow the data access too.
describe('shared settings, attendance and the change history', () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let plantB: number
  let inB: { id: number; employeeCode: string }
  let adminForA: ReturnType<typeof userWith>
  let adminForPlantA: ReturnType<typeof userWith>
  // a list of company B's and one of every company (2026-11-24 - holidays are put in lists)
  let listOfB: { categoryId: number; holidayListId: number }
  let listOfAll: { categoryId: number; holidayListId: number }

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    plantB = (await createPlant(companyB)).id
    inB = await createEmployee({ companyId: companyB, plantId: plantB })
    listOfB = await holidaySetup(companyB)
    listOfAll = await holidaySetup(null)
    const everything = { ORGANIZATION: 'WRITE', ATTENDANCE: 'WRITE', ATTENDANCE_SETUP: 'WRITE', CHANGE_HISTORY: 'READ', EMPLOYEES: 'READ' } as const
    adminForA = userWith({ id: 0, employeeCode: 'ADMINA' }, [{ access: everything, rows: [row(companyA, null, null)] }])
    adminForPlantA = userWith({ id: 0, employeeCode: 'ADMINP' }, [{ access: everything, rows: [row(companyA, plantA, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it("changes a company's own things only with Edit for the whole company", async () => {
    await expect(companiesService.updateCompanyFor(adminForA, { id: companyA, address: 'New street 2' })).resolves.toBeDefined()
    await expect(companiesService.updateCompanyFor(adminForA, { id: companyB, address: 'New street 2' })).rejects.toThrow('whole company')
    await expect(companiesService.updateCompanyFor(adminForPlantA, { id: companyA, address: 'New street 3' })).rejects.toThrow('whole company')
    // a plant's departments: Edit for that plant is enough
    await expect(plantsService.setPlantDepartmentsFor(adminForPlantA, { id: plantA, departmentIds: [] })).resolves.toBeDefined()
    await expect(
      holidaysService.createHoliday({ date: new Date(Date.UTC(2027, 0, 26)), name: 'Company B day', categoryId: listOfB.categoryId, holidayListIds: [listOfB.holidayListId] }, adminForA),
    ).rejects.toThrow('whole company')
  })

  it('changes what every company shares only with Edit for all companies', async () => {
    await expect(departmentsService.createDepartmentFor(adminForA, { code: `X${companyA}`, name: `Shared ${companyA}` })).rejects.toThrow('shared by every company')
    // the positions and regions (2026-11-19) are one list for every company too
    await expect(positionsService.createPositionFor(adminForA, { name: `Position ${companyA}` })).rejects.toThrow('shared by every company')
    await expect(regionsService.createRegionFor(adminForA, { name: `Region ${companyA}` })).rejects.toThrow('shared by every company')
    await expect(
      holidaysService.createHoliday({ date: new Date(Date.UTC(2027, 0, 26)), name: 'Everyone day', categoryId: listOfAll.categoryId, holidayListIds: [listOfAll.holidayListId] }, adminForA),
    ).rejects.toThrow('shared by every company')
    await expect(
      shiftsService.createShift({ code: 'ZZ', name: `Shift ${companyA}`, start: 540, end: 1080, breakMinutes: 30 }, adminForA),
    ).rejects.toThrow('shared by every company')
  })

  // the attendance setup is an area of its own (the user, 2026-11-22): Attendance Edit for every company is not enough
  it('changes the attendance setup only with Attendance setup Edit', async () => {
    const attendanceOnly = userWith({ id: 0, employeeCode: 'ATTONLY' }, [{ access: { ATTENDANCE: 'WRITE' }, rows: [row(null, null, null)] }])
    await expect(
      shiftsService.createShift({ code: 'ZY', name: `Shift ${companyB}`, start: 540, end: 1080, breakMinutes: 30 }, attendanceOnly),
    ).rejects.toThrow('shared by every company')
    await expect(
      holidaysService.createHoliday({ date: new Date(Date.UTC(2027, 0, 27)), name: 'Setup day', categoryId: listOfB.categoryId, holidayListIds: [listOfB.holidayListId] }, attendanceOnly),
    ).rejects.toThrow('whole company')
    // a default shift for someone: "not found" without Attendance setup covering them
    const setupForAll = userWith({ id: 0, employeeCode: 'SETUPALL' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
    const shift = await shiftsService.createShift({ code: `S${companyB}`.slice(0, 10), name: `Setup shift ${companyB}`, start: 540, end: 1080, breakMinutes: 30 }, setupForAll)
    const pattern = await shiftsService.createPattern({ name: `Setup week ${companyB}`, days: [shift.id, shift.id, shift.id, shift.id, shift.id, shift.id, 0], halfDays: [] }, setupForAll)
    const assign = { employeeCodes: [inB.employeeCode], patternId: pattern.id, startWeek: 1, effectiveFrom: new Date(Date.UTC(2030, 0, 1)) }
    await expect(shiftsService.assignShift(assign, attendanceOnly)).rejects.toThrow('No employee found')
    // and Attendance setup for company A only does not reach an employee of company B
    const setupForA = userWith({ id: 0, employeeCode: 'SETUPA' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await expect(shiftsService.assignShift(assign, setupForA)).rejects.toThrow('No employee found')
    // who follows what (2026-11-23): only the employees inside the Attendance setup View data access
    await shiftsService.assignShift(assign, setupForAll)
    expect(await shiftsService.listSchedules(setupForA, { search: inB.employeeCode })).toHaveLength(0)
    expect((await shiftsService.listSchedules(setupForAll, { search: inB.employeeCode }))[0]).toMatchObject({ patternIsDefault: true, next: { pattern: { id: pattern.id } } })
    // the roster (part of the setup since 2026-11-22): company A's setup neither sees nor changes company B's employee
    const cell = { employeeCode: inB.employeeCode, date: new Date(Date.UTC(2031, 1, 3)), shiftId: shift.id }
    await expect(rostersService.saveCells(setupForA, { cells: [cell] })).rejects.toThrow('No employee found')
    await expect(rostersService.saveCells(attendanceOnly, { cells: [cell] })).rejects.toThrow('No employee found')
    const grid = await rostersService.getGrid(setupForA, { from: cell.date, to: cell.date, search: inB.employeeCode })
    expect(grid.rows).toEqual([])
  })

  // holiday lists (2026-11-24): a company's list needs Edit for that whole company, one for every company - all companies; a
  // plant's default - Edit for that whole plant; the categories are shared by every company
  it('changes holiday lists, plant defaults and categories only within the data access', async () => {
    // names unique per run: the new company's id (the test database is never wiped)
    const n = companyA
    await expect(holidayListsService.createHolidayList({ name: `B list ${n}`, companyId: companyB }, adminForA)).rejects.toThrow('whole company')
    await expect(holidayListsService.createHolidayList({ name: `Shared list ${n}` }, adminForA)).rejects.toThrow('shared by every company')
    await expect(holidayListsService.createHolidayList({ name: `A list ${n}`, companyId: companyA }, adminForPlantA)).rejects.toThrow('whole company')
    const ofA = await holidayListsService.createHolidayList({ name: `A list ${n}`, companyId: companyA }, adminForA)
    await expect(holidayListsService.updateHolidayList({ id: ofA.id, companyId: companyB }, adminForA)).rejects.toThrow('whole company')
    // a plant's default: Edit for that plant is enough - and never for another company's plant
    await expect(holidayListsService.setPlantDefault({ plantId: plantA, holidayListId: ofA.id }, adminForPlantA)).resolves.toMatchObject({ holidayList: { id: ofA.id } })
    await expect(holidayListsService.setPlantDefault({ plantId: plantB, holidayListId: null }, adminForA)).rejects.toThrow('whole plant')
    await expect(holidayCategoriesService.createHolidayCategory({ name: `Category ${n}`, tone: 'GOLD' }, adminForA)).rejects.toThrow('shared by every company')
    // someone's list: Attendance setup Edit covering them - company A's admin never reaches company B's employee
    await expect(
      holidayListsService.assignHolidayList({ employeeCodes: [inB.employeeCode], holidayListId: ofA.id, effectiveFrom: new Date(Date.UTC(2033, 0, 1)) }, adminForA),
    ).rejects.toThrow('No employee found')
    // "fill in" counts only the employees inside the data access: company B's plant (no default, inB waiting) is not there
    const plantBCode = (await plantsService.getPlant(plantB)).plantCode
    const filled = await holidayListsService.fillMissing({ dryRun: true }, adminForA)
    expect(filled.noDefault.some((p) => p.plant.startsWith(`${plantBCode} `))).toBe(false)
    const forAll = await holidayListsService.fillMissing({ dryRun: true }, userWith({ id: 0, employeeCode: 'SETUPALL2' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }]))
    expect(forAll.noDefault.some((p) => p.plant.startsWith(`${plantBCode} `))).toBe(true)
    // "copy from last year": company A's admin copies only into the lists they may change - nothing lands in company B's
    // list nor in the list of every company
    const setupForAll = userWith({ id: 0, employeeCode: 'SETUPALL3' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])
    const year = 2050 + (companyA % 40)
    for (const lists of [listOfB, listOfAll]) {
      await holidaysService.createHoliday({ date: new Date(Date.UTC(year - 1, 4, 1)), name: `Copied ${companyA}`, categoryId: lists.categoryId, holidayListIds: [lists.holidayListId] }, setupForAll)
    }
    await holidaysService.copyYear({ year }, adminForA)
    expect(await holidaysService.listHolidays(year, listOfB.holidayListId)).toEqual([])
    expect(await holidaysService.listHolidays(year, listOfAll.holidayListId)).toEqual([])
  })

  it("limits someone's attendance and the change history by the data access", async () => {
    await expect(daysService.getVisiblePerson(adminForA, inB.employeeCode)).rejects.toThrow('No employee found')
    await expect(changeHistoryService.listChangeHistory(adminForA, undefined)).rejects.toThrow('all companies')
    const history = await changeHistoryService.listChangeHistory(adminForA, { employeeCode: inB.employeeCode })
    expect(history.items).toEqual([])
    // one employee's history needs Change history View - Employees View alone no longer shows it (2026-11-21)
    const directoryOnly = userWith({ id: 0, employeeCode: 'DIRONLY' }, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] }])
    await expect(changeHistoryService.listChangeHistory(directoryOnly, { employeeCode: inB.employeeCode })).rejects.toThrow('You do not have access')
  })
})
