import { prisma } from '#core/db/prisma'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as applicationsService from '../src/modules/leave/applications/applications.service.js'
import * as balancesService from '../src/modules/leave/balances/balances.service.js'
import * as typesService from '../src/modules/leave/types/types.service.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Data access in the leave module (CLAUDE.md section 8, 2026-11-22): HR limited to company A sees and changes only company
// A's leave - company B's employees are "not found" and missing from every list; the leave types are shared, so changing
// them needs Leave Edit for every company.

describe('data access - leave', () => {
  let a: { id: number; employeeCode: string }
  let b: { id: number; employeeCode: string }
  let hrA: ReturnType<typeof userWith>
  let typeId: number

  beforeAll(async () => {
    const companyA = (await createCompany()).id
    const companyB = (await createCompany()).id
    a = await createEmployee({ companyId: companyA, plantId: (await createPlant(companyA)).id })
    b = await createEmployee({ companyId: companyB, plantId: (await createPlant(companyB)).id })
    hrA = userWith({ id: 0, employeeCode: 'HRA' }, [{ access: { LEAVE: 'WRITE' }, rows: [row(companyA, null, null)] }])
    typeId = (await typesService.allTypes()).find((t) => t.isPaid && t.isActive)!.id
  })
  afterAll(() => prisma.$disconnect())

  it("another company's employee is not found - their balances, an adjustment", async () => {
    await expect(balancesService.getBalances(hrA, { employeeCode: b.employeeCode })).rejects.toThrow('No employee found')
    await expect(balancesService.adjust(hrA, { employeeCode: b.employeeCode, leaveTypeId: typeId, days: 1, note: 'Opening balance' })).rejects.toThrow('No employee found')
    expect((await balancesService.getBalances(hrA, { employeeCode: a.employeeCode })).employee.employeeCode).toBe(a.employeeCode)
  })

  it("the register and the leave list hold only the company's own employees", async () => {
    const register = await balancesService.getRegister(hrA, { scope: 'ALL', search: '' })
    const codes = register.rows.map((r) => r.employeeCode)
    expect(codes).toContain(a.employeeCode)
    expect(codes).not.toContain(b.employeeCode)
    const now = new Date()
    const list = await applicationsService.list(hrA, { scope: 'ALL', from: new Date(now.getTime() - 400 * 86_400_000), to: now })
    expect(list.every((l) => l.employee.employeeCode !== b.employeeCode)).toBe(true)
  })

  it('a team list without a team is empty; the shared leave types need Edit for every company', async () => {
    const self = userWith(a, [{ access: {}, rows: [] }])
    expect((await balancesService.getRegister(self, { scope: 'TEAM' })).rows).toEqual([])
    await expect(balancesService.getRegister(self, { scope: 'ALL' })).rejects.toThrow()
    await expect(typesService.updateType(hrA, { ...(await typesService.getType(typeId)), id: typeId })).rejects.toThrow('shared by every company')
    await expect(balancesService.runCredits(hrA)).rejects.toThrow('shared by every company')
  })
})
