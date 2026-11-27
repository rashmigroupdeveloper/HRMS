import { prisma } from '#core/db/prisma'
import { afterAll, describe, expect, it } from 'vitest'
import * as daysService from '../src/modules/attendance/days/days.service.js'
import * as leaveService from '../src/modules/leave/leave.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { userWith } from './helpers/users.js'

// The DIRECT scope (the user, 2026-11-27 - the self-service home shows only those who report to one directly): a
// manager sees their direct report, never the report's own reports (TEAM still covers the whole tree), and someone
// without reports sees nobody - in attendance and in leave.

describe('direct reports only', () => {
  afterAll(() => prisma.$disconnect())

  it('covers the people who report to the viewer directly, not their reports', async () => {
    const companyId = (await createCompany()).id
    const plantId = (await createPlant(companyId)).id
    const manager = await createEmployee({ companyId, plantId })
    const direct = await createEmployee({ companyId, plantId })
    const below = await createEmployee({ companyId, plantId })
    await prisma.employee.update({ where: { id: direct.id }, data: { reportingManagerId: manager.id } })
    await prisma.employee.update({ where: { id: below.id }, data: { reportingManagerId: direct.id } })
    const viewer = userWith(manager, [{ access: {}, rows: [] }])
    const now = new Date()
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const codes = (people: { employeeCode: string }[]) => people.map((p) => p.employeeCode).sort()

    expect(codes(await daysService.peopleInScope(viewer, { scope: 'DIRECT' }, day, day))).toEqual([direct.employeeCode])
    expect(codes(await daysService.peopleInScope(viewer, { scope: 'TEAM' }, day, day))).toEqual([direct.employeeCode, below.employeeCode].sort())
    expect(codes(await leaveService.peopleInScope(viewer, { scope: 'DIRECT' }, day, day))).toEqual([direct.employeeCode])
    // the direct report sees their own report; the one at the bottom sees nobody
    expect(codes(await daysService.peopleInScope(userWith(direct, [{ access: {}, rows: [] }]), { scope: 'DIRECT' }, day, day))).toEqual([below.employeeCode])
    expect(await leaveService.peopleInScope(userWith(below, [{ access: {}, rows: [] }]), { scope: 'DIRECT' }, day, day)).toEqual([])
  })
})
