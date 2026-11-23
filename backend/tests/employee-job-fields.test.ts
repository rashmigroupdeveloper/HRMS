import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { writeWorkbook } from '#core/excel/workbook'
import { costCentersService, departmentsService, plantsService, regionsService, workLocationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as importsService from '../src/modules/employees/imports/imports.service.js'
import * as jobHistoryService from '../src/modules/employees/job-history/job-history.service.js'
import * as layoffsService from '../src/modules/employees/layoffs/layoffs.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The "Employment & Job" fields (the user, 2026-11-19): cost centre, functional manager, position, region and the work
// location's address, lay offs, and the job timeline.
const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()

describe('employment & job fields', () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let hr: ReturnType<typeof userWith>
  let employee: { id: number; employeeCode: string }
  let colleague: { id: number; employeeCode: string }

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    employee = await createEmployee({ companyId: companyA, plantId: plantA })
    colleague = await createEmployee({ companyId: companyA, plantId: plantA })
    hr = userWith(colleague, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(companyA, null, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it("takes only a cost centre of the employee's own company, and an active one", async () => {
    const own = await costCentersService.createCostCenter({ companyId: companyA, code: `CA${tag}`, name: 'Own' }, SYSTEM_ACTOR)
    const other = await costCentersService.createCostCenter({ companyId: companyB, code: `CB${tag}`, name: 'Other' }, SYSTEM_ACTOR)
    const retired = await costCentersService.createCostCenter({ companyId: companyA, code: `CR${tag}`, name: 'Retired' }, SYSTEM_ACTOR)
    await costCentersService.updateCostCenter({ id: retired.id, isActive: false }, SYSTEM_ACTOR)
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, costCenterId: other.id }, hr)).rejects.toThrow('belongs to another company')
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, costCenterId: retired.id }, hr)).rejects.toThrow('no longer active')
    await employeesService.updateEmployee({ employeeCode: employee.employeeCode, costCenterId: own.id }, hr)
    expect((await employeesService.getByCode(employee.employeeCode)).costCenter?.id).toBe(own.id)
  })

  it('takes a functional manager who has not left and is not the employee', async () => {
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, functionalManagerCode: employee.employeeCode }, hr)).rejects.toThrow('own functional manager')
    await employeesService.updateEmployee({ employeeCode: employee.employeeCode, functionalManagerCode: colleague.employeeCode }, hr)
    const profile = await employeesService.getByCodeFor(hr, employee.employeeCode)
    expect(profile.functionalManager?.employeeCode).toBe(colleague.employeeCode)
    // shown only - the reporting manager is untouched
    expect(profile.reportingManager).toBeNull()
  })

  it('keeps an address and a region on a work location, with an Indian PIN of 6 digits, and clears them', async () => {
    const region = await regionsService.createRegion({ name: `East ${tag}` }, SYSTEM_ACTOR)
    await expect(workLocationsService.createWorkLocation({ name: `Bad ${tag}`, countryCode: 'IN', stateCode: 'WB', postalCode: '1234' }, SYSTEM_ACTOR)).rejects.toThrow('6 digits')
    const location = await workLocationsService.createWorkLocation(
      { name: `Kharagpur ${tag}`, countryCode: 'IN', stateCode: 'WB', address: 'Shyamraipur', postalCode: '721301', regionId: region.id },
      SYSTEM_ACTOR,
    )
    expect(location.region?.name).toBe(`East ${tag}`)
    const cleared = await workLocationsService.updateWorkLocation({ id: location.id, address: null, postalCode: null, regionId: null }, SYSTEM_ACTOR)
    expect([cleared.address, cleared.postalCode, cleared.region]).toEqual([null, null, null])
    // a retired region is not chosen anew
    await regionsService.updateRegion({ id: region.id, isActive: false }, SYSTEM_ACTOR)
    await expect(workLocationsService.updateWorkLocation({ id: location.id, regionId: region.id }, SYSTEM_ACTOR)).rejects.toThrow('no longer used')
  })

  it('keeps lay offs that never overlap, with only one still open', async () => {
    const code = employee.employeeCode
    await expect(layoffsService.createLayoff({ employeeCode: code, startDate: date(2025, 6, 1), reason: 'Plant shut' }, hr)).rejects.toThrow('before the date of joining')
    await expect(layoffsService.createLayoff({ employeeCode: code, startDate: date(2026, 3, 10), rejoinDate: date(2026, 3, 10), reason: 'Plant shut' }, hr)).rejects.toThrow('after the first day')
    const first = await layoffsService.createLayoff({ employeeCode: code, startDate: date(2026, 3, 1), rejoinDate: date(2026, 4, 1), reason: 'Plant shut' }, hr)
    await expect(layoffsService.createLayoff({ employeeCode: code, startDate: date(2026, 3, 15), rejoinDate: date(2026, 5, 1), reason: 'Again' }, hr)).rejects.toThrow('overlaps')
    // back at work on the 1st: a new one may start that very day
    await layoffsService.createLayoff({ employeeCode: code, startDate: date(2026, 4, 1), reason: 'Again' }, hr)
    await expect(layoffsService.createLayoff({ employeeCode: code, startDate: date(2026, 9, 1), reason: 'Third' }, hr)).rejects.toThrow('still open')
    await layoffsService.updateLayoff({ id: first.id, reason: 'Plant shut for repairs' }, hr)
    const list = await layoffsService.listLayoffs(hr, code)
    expect(list.map((l) => l.reason)).toEqual(['Again', 'Plant shut for repairs'])
  })

})

describe('employment & job fields: adding and importing', () => {
  let company: { id: number; code: string }
  let otherCompany: number
  let plant: { id: number; plantCode: string }
  let department: { id: number; name: string }
  let hr: ReturnType<typeof userWith>
  let colleague: { id: number; employeeCode: string }
  const base = { joiningType: 'OVERSEAS', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR', dateOfJoining: date(2026, 1, 1) } as const

  beforeAll(async () => {
    company = await createCompany()
    otherCompany = (await createCompany()).id
    plant = await createPlant(company.id)
    department = await departmentsService.createDepartment({ code: `JD${tag}`, name: `Job dept ${tag}` }, SYSTEM_ACTOR)
    await plantsService.addPlantDepartments(plant.id, [department.id], SYSTEM_ACTOR)
    colleague = await createEmployee({ companyId: company.id, plantId: plant.id, departmentId: department.id })
    hr = userWith(colleague, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(company.id, null, null)] }])
  })

  it('refuses a cost centre of another company and a functional manager who has left when adding', async () => {
    const other = await costCentersService.createCostCenter({ companyId: otherCompany, code: `OX${tag}`, name: 'Other' }, SYSTEM_ACTOR)
    const add = { companyId: company.id, plantId: plant.id, departmentId: department.id, firstName: 'New', ...base }
    await expect(employeesService.addEmployee({ ...add, costCenterId: other.id }, hr)).rejects.toThrow('belongs to another company')
    const left = await employeesService.createEmployee(
      { employeeCode: `LF${tag}`, companyId: company.id, plantId: plant.id, departmentId: department.id, firstName: 'Left', status: 'EXITED', ...base },
      SYSTEM_ACTOR,
    )
    await expect(employeesService.addEmployee({ ...add, functionalManagerCode: left.employeeCode }, hr)).rejects.toThrow('has left')
  })

  it("imports the cost centre (by code, in the row's company) and the functional manager", async () => {
    await costCentersService.createCostCenter({ companyId: company.id, code: `IC${tag}`, name: 'Imported' }, SYSTEM_ACTOR)
    await costCentersService.createCostCenter({ companyId: otherCompany, code: `IO${tag}`, name: 'Elsewhere' }, SYSTEM_ACTOR)
    const columns = [
      ['Employee code', 'employeeCode'],
      ['First name', 'firstName'],
      ['Company code', 'company'],
      ['Plant code', 'plant'],
      ['Department', 'department'],
      ['Date of joining', 'dateOfJoining'],
      ['Cost centre', 'costCenter'],
      ['Functional manager code', 'functionalManagerCode'],
    ].map(([header, key]) => ({ header: header!, key: key!, ...(key === 'dateOfJoining' && { date: true }) }))
    const file = async (rows: Record<string, unknown>[]) =>
      new File([new Uint8Array(await writeWorkbook([{ name: 'Employees', columns, rows: rows as never }]))], 'import.xlsx')
    const cells = { firstName: 'Imported', company: company.code, plant: plant.plantCode, department: department.name, dateOfJoining: date(2026, 1, 1) }
    const wrong = await importsService.uploadImport(
      { file: await file([{ ...cells, employeeCode: `IA${tag}`, costCenter: `IO${tag}`, functionalManagerCode: `NOBODY${tag}` }]) },
      hr,
    )
    expect(wrong.rows[0]!.errors.join(' | ')).toMatch(/not a cost centre of the company.*No employee found with code NOBODY/)
    const saved = await importsService.uploadImport(
      { file: await file([{ ...cells, employeeCode: `IB${tag}`, costCenter: `IC${tag}`, functionalManagerCode: colleague.employeeCode }]), save: true },
      hr,
    )
    expect(saved.saved).toBe(true)
    const imported = await employeesService.getByCodeFor(hr, `IB${tag}`)
    expect([imported.costCenter?.code, imported.functionalManager?.employeeCode]).toEqual([`IC${tag}`, colleague.employeeCode])
    // the timeline's joining entry has them too
    const [joining] = await jobHistoryService.listJobHistory(hr, `IB${tag}`)
    expect(joining!.details.functionalManagerId).toContain(colleague.employeeCode)
  })
})
