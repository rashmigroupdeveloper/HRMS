import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { writeWorkbook } from '#core/excel/workbook'
import { employeesService } from '#modules/employees'
import { companiesService, designationsService, gradesService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as importsService from '../src/modules/employees/imports/imports.service.js'
import * as jobHistoryService from '../src/modules/employees/job-history/job-history.service.js'
import { jobDetailsOf } from '../src/modules/employees/job-history/job-history.repository.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Retired masters (2026-11-23, the review): a retired company, department, designation, grade, position or work location
// could still be set on an employee through the API, a job change or the import - only the plant, the department at the
// plant and the cost centre were checked. Now refused when chosen anew; one the employee already has stays.
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()
let next = 0
const unique = () => `${tag}${++next}`

describe('retired masters on employees', () => {
  let companyId: number
  let plant: { id: number; plantCode: string }
  let departmentId: number
  let departmentName: string
  let hr: ReturnType<typeof userWith>
  const designation = async (retired: boolean) => {
    const made = await designationsService.createDesignation({ name: `Designation ${unique()}` }, SYSTEM_ACTOR)
    if (retired) await designationsService.updateDesignation({ id: made.id, isActive: false }, SYSTEM_ACTOR)
    return made
  }

  beforeAll(async () => {
    const company = await createCompany()
    companyId = company.id
    plant = await createPlant(companyId)
    const colleague = await createEmployee({ companyId, plantId: plant.id })
    departmentId = (await employeesService.getByCode(colleague.employeeCode)).department.id
    departmentName = (await employeesService.getByCode(colleague.employeeCode)).department.name
    hr = userWith(colleague, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(null, null, null)] }])
  })
  afterAll(() => prisma.$disconnect())

  it('refuses a retired master on "Add employee" and "Edit details", and keeps one the employee already has', async () => {
    const retired = await designation(true)
    const inUse = await designation(false)
    const add = { companyId, plantId: plant.id, departmentId, firstName: 'New', dateOfJoining: new Date(Date.UTC(2026, 0, 1)), joiningType: 'OVERSEAS', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR' } as const
    await expect(employeesService.addEmployee({ ...add, designationId: retired.id }, hr)).rejects.toThrow('no longer in use')
    // a retired company
    const closed = await createCompany()
    const closedPlant = await createPlant(closed.id)
    const closedDepartment = (await employeesService.getByCode((await createEmployee({ companyId: closed.id, plantId: closedPlant.id })).employeeCode)).department.id
    await companiesService.updateCompany({ id: closed.id, isActive: false }, SYSTEM_ACTOR)
    await expect(employeesService.addEmployee({ ...add, companyId: closed.id, plantId: closedPlant.id, departmentId: closedDepartment }, hr)).rejects.toThrow('no longer in use')

    const { employeeCode } = await employeesService.addEmployee({ ...add, designationId: inUse.id }, hr)
    await expect(employeesService.updateEmployee({ employeeCode, designationId: retired.id }, hr)).rejects.toThrow(`Designation ${retired.name} is no longer in use`)
    // retired after it was given: it stays, also when sent again unchanged
    await designationsService.updateDesignation({ id: inUse.id, isActive: false }, SYSTEM_ACTOR)
    await expect(employeesService.updateEmployee({ employeeCode, firstName: 'Renamed', designationId: inUse.id }, hr)).resolves.toBeDefined()
  })

  it('refuses a retired grade in a job change, and keeps one the employee already has', async () => {
    const employee = await createEmployee({ companyId, plantId: plant.id })
    const grade = await gradesService.createGrade({ code: `G${unique()}`.slice(0, 10), name: `Grade ${unique()}`, rank: 100 + Math.floor(Math.random() * 800) }, SYSTEM_ACTOR)
    await gradesService.updateGrade({ id: grade.id, isActive: false }, SYSTEM_ACTOR)
    const saved = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })
    const base = jobDetailsOf(saved)
    await expect(jobHistoryService.checkJobChange(employee.id, companyId, base, { ...base, gradeId: grade.id })).rejects.toThrow('no longer in use')
    await expect(jobHistoryService.checkJobChange(employee.id, companyId, { ...base, gradeId: grade.id }, { ...base, gradeId: grade.id })).resolves.toBeUndefined()
  })

  it('refuses a retired master the import chooses anew, and keeps one the employee already has', async () => {
    const retired = await designation(true)
    const employee = await createEmployee({ companyId, plantId: plant.id })
    // test data: the employee has the retired designation already
    await prisma.employee.update({ where: { id: employee.id }, data: { designationId: retired.id, updatedById: 0 } })
    const columns = ['Employee code', 'First name', 'Company code', 'Plant code', 'Department', 'Date of joining', 'Designation'].map((header) => ({ header, key: header }))
    const company = await companiesService.getCompany(companyId)
    const cells = { 'First name': 'Imported', 'Company code': company.code, 'Plant code': plant.plantCode, Department: departmentName, 'Date of joining': '01-01-2026', Designation: retired.name }
    const file = async (rows: Record<string, string>[]) => new File([new Uint8Array(await writeWorkbook([{ name: 'Employees', columns, rows }]))], 'import.xlsx')
    const checked = await importsService.uploadImport({ file: await file([{ ...cells, 'Employee code': employee.employeeCode }, { ...cells, 'Employee code': `NEW${unique()}` }]) }, hr)
    expect(checked.rows[0]!.errors).toEqual([])
    expect(checked.rows[1]!.errors.join(' | ')).toContain('is retired')
  })
})

// The import's master names (2026-11-23, the review): they were matched with every space and dash taken out, and the first
// of several matches taken - "Sales-East" could land on "Sales East". Now the same name or code but for case and spaces.
describe('master names in the import', () => {
  afterAll(() => prisma.$disconnect())
  it('matches a name exactly (case and spaces aside), and reports one it does not know', async () => {
    const company = await createCompany()
    const plant = await createPlant(company.id)
    const colleague = await createEmployee({ companyId: company.id, plantId: plant.id })
    const department = (await employeesService.getByCode(colleague.employeeCode)).department
    const hr = userWith(colleague, [{ access: { EMPLOYEES: 'WRITE' }, rows: [row(null, null, null)] }])
    const name = `Sales East ${unique()}`
    await designationsService.createDesignation({ name }, SYSTEM_ACTOR)
    const columns = ['First name', 'Company code', 'Plant code', 'Department', 'Date of joining', 'Designation'].map((header) => ({ header, key: header }))
    const cells = { 'First name': 'Imported', 'Company code': company.code, 'Plant code': plant.plantCode, Department: department.name, 'Date of joining': '01-01-2026' }
    const rows = [{ ...cells, Designation: `  ${name.toUpperCase().replace(' ', '   ')} ` }, { ...cells, Designation: name.replace(' ', '-') }]
    const file = new File([new Uint8Array(await writeWorkbook([{ name: 'Employees', columns, rows }]))], 'import.xlsx')
    const checked = await importsService.uploadImport({ file }, hr)
    expect(checked.rows[0]!.errors).toEqual([])
    expect(checked.rows[1]!.errors.join(' | ')).toContain('is not in the list')
  })
})
