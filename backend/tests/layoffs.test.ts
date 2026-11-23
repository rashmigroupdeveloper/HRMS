import { prisma } from '#core/db/prisma'
import { afterAll, describe, expect, it } from 'vitest'
import * as layoffsService from '../src/modules/employees/layoffs/layoffs.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Lay offs (2026-11-23, the review): one could be recorded for an employee who has left, and two changes at the same moment
// each checked the overlap rules before the other was saved - so both passed.
describe('lay offs', () => {
  afterAll(() => prisma.$disconnect())
  const day = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d))
  async function setUp() {
    const companyId = (await createCompany()).id
    const employee = await createEmployee({ companyId, plantId: (await createPlant(companyId)).id })
    const hr = userWith(employee, [{ access: { EMPLOYEES: 'WRITE' }, rows: [row(null, null, null)] }])
    return { employee, hr }
  }

  it('records none for an employee who has left, and never leaves one of theirs open', async () => {
    const { employee, hr } = await setUp()
    const open = await layoffsService.createLayoff({ employeeCode: employee.employeeCode, startDate: day(3, 1), reason: 'Plant shut' }, hr)
    // test data: they leave
    await prisma.employee.update({ where: { id: employee.id }, data: { status: 'EXITED', dateOfLeaving: day(5, 31), updatedById: 0 } })
    await expect(layoffsService.createLayoff({ employeeCode: employee.employeeCode, startDate: day(4, 1), rejoinDate: day(4, 10), reason: 'Again' }, hr)).rejects.toThrow('has left')
    await expect(layoffsService.updateLayoff({ id: open.id, reason: 'Corrected' }, hr)).rejects.toThrow('has left')
    // closing it is a correction - allowed
    await expect(layoffsService.updateLayoff({ id: open.id, rejoinDate: day(3, 20) }, hr)).resolves.toMatchObject({ rejoinDate: day(3, 20) })
  })

  it('lets only one of two overlapping changes made at the same moment through', async () => {
    const { employee, hr } = await setUp()
    // two lay offs apart; then both moved onto the same days at once
    const first = await layoffsService.createLayoff({ employeeCode: employee.employeeCode, startDate: day(2, 1), rejoinDate: day(2, 5), reason: 'One' }, hr)
    const second = await layoffsService.createLayoff({ employeeCode: employee.employeeCode, startDate: day(6, 1), rejoinDate: day(6, 5), reason: 'Two' }, hr)
    const moves = await Promise.allSettled([
      ...Array.from({ length: 3 }, () => layoffsService.updateLayoff({ id: first.id, startDate: day(9, 1), rejoinDate: day(9, 10) }, hr)),
      ...Array.from({ length: 3 }, () => layoffsService.updateLayoff({ id: second.id, startDate: day(9, 2), rejoinDate: day(9, 11) }, hr)),
    ])
    expect(moves.some((m) => m.status === 'rejected')).toBe(true)
    // and two new open ones at once: one
    const creates = await Promise.allSettled(
      Array.from({ length: 4 }, () => layoffsService.createLayoff({ employeeCode: employee.employeeCode, startDate: day(11, 1), reason: 'Open' }, hr)),
    )
    expect(creates.filter((c) => c.status === 'fulfilled')).toHaveLength(1)
    const saved = await prisma.employeeLayoff.findMany({ where: { employeeId: employee.id }, orderBy: { startDate: 'asc' }, select: { startDate: true, rejoinDate: true } })
    // never two that overlap
    for (let i = 1; i < saved.length; i++) expect(saved[i]!.startDate >= saved[i - 1]!.rejoinDate!).toBe(true)
  })
})
