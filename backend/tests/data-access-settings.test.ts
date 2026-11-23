import { prisma } from '#core/db/prisma'
import { changeHistoryService } from '#modules/change-history'
import { companiesService, departmentsService, plantsService, positionsService, regionsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as holidaysService from '../src/modules/attendance/holidays/holidays.service.js'
import * as rostersService from '../src/modules/attendance/rosters/rosters.service.js'
import * as shiftsService from '../src/modules/attendance/shifts/shifts.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Data access (A4, 2026-11-18): what belongs to one company needs Edit for that whole company; what every company shares
// needs Edit for all companies; attendance and the change history follow the data access too.
describe('shared settings, attendance and the change history', () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let inB: { id: number; employeeCode: string }
  let adminForA: ReturnType<typeof userWith>
  let adminForPlantA: ReturnType<typeof userWith>

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    const plantB = (await createPlant(companyB)).id
    inB = await createEmployee({ companyId: companyB, plantId: plantB })
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
      holidaysService.createHoliday({ date: new Date(Date.UTC(2027, 0, 26)), name: 'Company B day', companyId: companyB }, adminForA),
    ).rejects.toThrow('whole company')
  })

  it('changes what every company shares only with Edit for all companies', async () => {
    await expect(departmentsService.createDepartmentFor(adminForA, { code: `X${companyA}`, name: `Shared ${companyA}` })).rejects.toThrow('shared by every company')
    // the positions and regions (2026-11-19) are one list for every company too
    await expect(positionsService.createPositionFor(adminForA, { name: `Position ${companyA}` })).rejects.toThrow('shared by every company')
    await expect(regionsService.createRegionFor(adminForA, { name: `Region ${companyA}` })).rejects.toThrow('shared by every company')
    await expect(holidaysService.createHoliday({ date: new Date(Date.UTC(2027, 0, 26)), name: 'Everyone day' }, adminForA)).rejects.toThrow('shared by every company')
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
    await expect(holidaysService.createHoliday({ date: new Date(Date.UTC(2027, 0, 27)), name: 'Setup day', companyId: companyB }, attendanceOnly)).rejects.toThrow('whole company')
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
