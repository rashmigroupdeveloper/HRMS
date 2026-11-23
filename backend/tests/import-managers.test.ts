import { prisma } from '#core/db/prisma'
import { writeWorkbook } from '#core/excel/workbook'
import { afterAll, describe, expect, it } from 'vitest'
import * as importsService from '../src/modules/employees/imports/imports.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Found in the 2026-11-23 review: a manager who is another row of the file was checked only against the file - a loop
// through someone's saved manager (A -> B in the file, B -> A already saved) was imported.
describe('reporting managers in the Excel import', () => {
  afterAll(() => prisma.$disconnect())

  it('refuses a loop through a manager already saved, and saves nothing', async () => {
    const companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    const a = await createEmployee({ companyId, plantId })
    const b = await createEmployee({ companyId, plantId })
    // test data: B already reports to A
    await prisma.employee.update({ where: { id: b.id }, data: { reportingManagerId: a.id } })
    const hr = userWith({ id: 0, employeeCode: 'HRIMPORT' }, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(null, null, null)] }])
    const columns = ['Employee code', 'First name', 'Company code', 'Plant code', 'Department', 'Date of joining', 'Designation', 'Reporting manager code']
    const file = new File(
      [new Uint8Array(await writeWorkbook([{ name: 'Employees', columns: columns.map((header) => ({ header, key: header })), rows: [{ 'Employee code': a.employeeCode, 'Reporting manager code': b.employeeCode }, { 'Employee code': b.employeeCode }] }]))],
      'import.xlsx',
    )
    await expect(importsService.uploadImport({ file, save: true }, hr)).rejects.toThrow('loop')
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: a.id }, select: { reportingManagerId: true } })).reportingManagerId).toBeNull()
  })
})
