import { prisma } from '#core/db/prisma'
import { writeWorkbook } from '#core/excel/workbook'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as punchesService from '../src/modules/attendance/punches/punches.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Punch files from the machines (found in the 2026-11-23 review): a "Date" column with a "Punch Time" column - the usual
// export - was read as one date-time column, so time-only cells became punches of 1899 and text times were refused; a
// month 13 rolled over into January; a CSV without a .csv name starting with "P" was taken for Excel.
const hr = userWith({ id: 0, employeeCode: 'HRUPLOAD' }, [{ access: { ATTENDANCE_SETUP: 'WRITE' }, rows: [row(null, null, null)] }])

describe('punch files', () => {
  let employee: { id: number; employeeCode: string }

  beforeAll(async () => {
    const companyId = (await createCompany()).id
    employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
  })
  afterAll(() => prisma.$disconnect())

  // the employee's punches as Indian wall-clock text, e.g. "2026-01-06 09:04"
  const punchesOf = async () =>
    (await prisma.punch.findMany({ where: { employeeId: employee.id }, select: { punchedAt: true }, orderBy: { punchedAt: 'asc' } })).map((p) =>
      new Date(p.punchedAt.getTime() + 330 * 60_000).toISOString().slice(0, 16).replace('T', ' '),
    )
  const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' })

  it('reads "Date" + "Punch Time" as text', async () => {
    const result = await punchesService.uploadPunches(
      { file: csv('punches.csv', `Emp Code,Date,Punch Time\n${employee.employeeCode},06-01-2026,09:04\n${employee.employeeCode},06-01-2026,18:10\n`) },
      hr,
    )
    expect(result).toMatchObject({ added: 2, skipped: 0 })
    expect(await punchesOf()).toEqual(['2026-01-06 09:04', '2026-01-06 18:10'])
  })

  it('reads "Date" + "Punch Time" as Excel date and time cells', async () => {
    const bytes = await writeWorkbook([
      {
        name: 'Punches',
        columns: [
          { header: 'Emp Code', key: 'code' },
          { header: 'Date', key: 'date' },
          { header: 'Punch Time', key: 'time' },
        ],
        // a time-only Excel cell is a moment on 30-12-1899
        rows: [{ code: employee.employeeCode, date: new Date(Date.UTC(2026, 0, 7)), time: new Date(Date.UTC(1899, 11, 30, 9, 15)) }],
      },
    ])
    const result = await punchesService.uploadPunches({ file: new File([new Uint8Array(bytes)], 'punches.xlsx') }, hr)
    expect(result).toMatchObject({ added: 1, skipped: 0 })
    expect(await punchesOf()).toContain('2026-01-07 09:15')
    expect((await punchesOf()).some((p) => p.startsWith('1899'))).toBe(false)
  })

  it('still reads a single "Punch time" date-time column, also from a CSV without a .csv name', async () => {
    const result = await punchesService.uploadPunches({ file: csv('export', `Punch time,Emp Code\n08-01-2026 09:30,${employee.employeeCode}\n`) }, hr)
    expect(result).toMatchObject({ added: 1, skipped: 0 })
    expect(await punchesOf()).toContain('2026-01-08 09:30')
  })

  it('keeps a full date and time in "Punch Time" even when the "Date" column says the day before (a night shift)', async () => {
    const result = await punchesService.uploadPunches(
      { file: csv('night.csv', `Emp Code,Date,Punch Time\n${employee.employeeCode},09-01-2026,10-01-2026 06:05\n`) },
      hr,
    )
    expect(result).toMatchObject({ added: 1, skipped: 0 })
    expect(await punchesOf()).toContain('2026-01-10 06:05')
  })

  it('refuses a month that does not exist instead of rolling it over', async () => {
    const result = await punchesService.uploadPunches({ file: csv('us.csv', `Emp Code,Punch time\n${employee.employeeCode},12/13/2025 09:00\n`) }, hr)
    expect(result).toMatchObject({ added: 0, skipped: 1 })
    expect(await punchesOf()).not.toContain('2026-01-12 09:00')
  })
})
