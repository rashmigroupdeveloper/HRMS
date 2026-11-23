import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { readFirstSheet } from '#core/excel/workbook'
import { employeesService } from '#modules/employees'
import ExcelJS from 'exceljs'
import { afterAll, describe, expect, it } from 'vitest'
import * as importsService from '../src/modules/employees/imports/imports.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// The Excel reader and the employee import (2026-11-23, the review): a code typed as a number lost its leading zeros (007
// read as 7), a link whose text is rich text read as "[object Object]", and two rows naming one employee by a former code
// and by the code now were each taken as their own.
const tag = Math.random().toString(36).slice(2, 7).toUpperCase()

// an .xlsx file with a header row and one row of cells, each set as Excel would hold it
async function sheetWith(cells: { header: string; value: ExcelJS.CellValue; numFmt?: string }[], more: { header: string; value: ExcelJS.CellValue; numFmt?: string }[][] = []) {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('Employees')
  cells.forEach((cell, i) => (ws.getCell(1, i + 1).value = cell.header))
  ;[cells, ...more].forEach((rowCells, r) =>
    rowCells.forEach((cell, i) => {
      const target = ws.getCell(r + 2, i + 1)
      target.value = cell.value
      if (cell.numFmt) target.numFmt = cell.numFmt
    }),
  )
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

describe('reading Excel cells', () => {
  it('reads a padded number as the text shown, and links and formulas without "[object Object]"', async () => {
    const bytes = await sheetWith([
      { header: 'Padded', value: 7, numFmt: '000' },
      { header: 'Prefixed', value: 35384, numFmt: '"RML"000000' },
      { header: 'Plain', value: 7 },
      { header: 'Decimal', value: 1.5, numFmt: '0.00' },
      { header: 'Whole', value: 12, numFmt: '0' },
      { header: 'Link', value: { text: { richText: [{ text: 'neha' }, { font: { bold: true }, text: '@example.com' }] }, hyperlink: 'mailto:neha@example.com' } as unknown as ExcelJS.CellHyperlinkValue },
      { header: 'Plain link', value: { text: 'a@example.com', hyperlink: 'mailto:a@example.com' } },
      { header: 'Formula', value: { formula: 'A2+1' } as ExcelJS.CellFormulaValue },
    ])
    const { rows } = await readFirstSheet(bytes)
    expect(rows[0]!.values).toEqual({
      Padded: '007',
      Prefixed: 'RML035384',
      Plain: 7,
      Decimal: 1.5,
      Whole: 12,
      Link: 'neha@example.com',
      'Plain link': 'a@example.com',
      Formula: null,
    })
  })
})

// the import's required columns, left empty (an employee being updated keeps what is saved)
const required = ['Company code', 'Plant code', 'Department', 'Date of joining'].map((header) => ({ header, value: null }))

describe('employee codes in the import', () => {
  afterAll(() => prisma.$disconnect())
  async function setUp() {
    const companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    const colleague = await createEmployee({ companyId, plantId })
    const hr = userWith(colleague, [{ access: { EMPLOYEES: 'WRITE' }, rows: [row(null, null, null)] }])
    return { companyId, plantId, colleague, hr }
  }

  it('keeps the leading zeros of a code Excel holds as a number', async () => {
    const { companyId, plantId, colleague, hr } = await setUp()
    const departmentId = (await employeesService.getByCode(colleague.employeeCode)).department.id
    const code = `00${String(Math.floor(Math.random() * 1e8)).padStart(8, '1')}`
    await employeesService.createEmployee(
      { employeeCode: code, firstName: 'Zero', companyId, plantId, departmentId, joiningType: 'OVERSEAS', employmentType: 'PERMANENT', workforceCategory: 'WHITE_COLLAR', dateOfJoining: new Date(Date.UTC(2026, 0, 1)), status: 'ACTIVE' },
      SYSTEM_ACTOR,
    )
    const file = new File([await sheetWith([{ header: 'Employee code', value: Number(code), numFmt: '0'.repeat(code.length) }, { header: 'First name', value: 'Renamed' }, ...required])], 'import.xlsx')
    const checked = await importsService.uploadImport({ file }, hr)
    expect(checked.rows[0]).toMatchObject({ employeeCode: code, action: 'UPDATE', errors: [] })
  })

  it('refuses two rows naming one employee by a former code and by the code now', async () => {
    const { companyId, hr } = await setUp()
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    const former = `OLD${tag}${employee.id}`
    // test data: the code they had before a company transfer
    await prisma.employeeFormerCode.create({ data: { employeeId: employee.id, employeeCode: former, companyId, usedUntil: new Date(Date.UTC(2025, 11, 31)), createdById: 0, updatedById: 0 } })
    const file = new File(
      [await sheetWith([{ header: 'Employee code', value: employee.employeeCode }, { header: 'First name', value: 'Now' }, ...required], [[{ header: 'Employee code', value: former }, { header: 'First name', value: 'Before' }]])],
      'import.xlsx',
    )
    const checked = await importsService.uploadImport({ file, save: true }, hr)
    expect(checked.saved).toBe(false)
    for (const r of checked.rows) expect(r.errors.join(' | ')).toContain('name the same employee')
    // a former code alone updates them, under their code now
    const alone = new File([await sheetWith([{ header: 'Employee code', value: former }, { header: 'First name', value: 'Before' }, ...required])], 'import.xlsx')
    expect((await importsService.uploadImport({ file: alone }, hr)).rows[0]).toMatchObject({ action: 'UPDATE', errors: [] })
  })
})
