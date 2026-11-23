import { prisma } from '#core/db/prisma'
import { approvalsService } from '#modules/approvals'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as shiftChangesService from '../src/modules/attendance/shift-changes/shift-changes.service.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Shift changes through the approval service (the user, 2026-11-22 - was their own manager -> HR approval): the request
// raises an approval request of kind SHIFT_CHANGE; only the chain's approvers decide (data access too); approved, the
// roster day changes; the employee can take it back while it waits.

// a working day to come (not a Sunday - the default weekly off), the given number of days ahead
function workingDay(ahead: number) {
  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ahead))
  if (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1)
  return day
}

describe('shift changes through the approval service', () => {
  let employee: { id: number; employeeCode: string }
  let self: ReturnType<typeof userWith>
  let approver: ReturnType<typeof userWith>
  let approverOfB: ReturnType<typeof userWith>

  beforeAll(async () => {
    const companyA = (await createCompany()).id
    const companyB = (await createCompany()).id
    const plantA = (await createPlant(companyA)).id
    const plantB = (await createPlant(companyB)).id
    employee = await createEmployee({ companyId: companyA, plantId: plantA })
    self = userWith(employee, [{ access: {}, rows: [] }])
    // company A's own chain: one step - a role held in company A (and the same role in company B, by someone else)
    const role = await createRole()
    const a = await createEmployee({ companyId: companyA, plantId: plantA })
    const b = await createEmployee({ companyId: companyB, plantId: plantB })
    await giveLogin(a.id, [{ roleId: role.id, companyId: companyA }])
    await giveLogin(b.id, [{ roleId: role.id, companyId: companyB }])
    approver = { ...userWith(a, [{ access: {}, rows: [row(companyA, null, null)] }]), activeRoleId: role.id }
    approverOfB = { ...userWith(b, [{ access: {}, rows: [row(companyB, null, null)] }]), activeRoleId: role.id }
    const chainsAdmin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await chainsService.saveChain(chainsAdmin, { kind: 'SHIFT_CHANGE', companyId: companyA, steps: [{ approverType: 'ROLE', roleId: role.id, seesConfidential: false }] })
  })
  afterAll(() => prisma.$disconnect())

  it('raises an approval request; only the chain approver covering the employee decides; approved, the day changes', async () => {
    const date = workingDay(3)
    const asked = await shiftChangesService.createRequest(self, { date, kind: 'CHANGE', requestedShiftId: null, reason: 'Family function' })
    expect(asked.status).toBe('PENDING')
    expect(asked.approval?.step?.stepNo).toBe(1)
    const request = await approvalsService.getRequest(self, asked.approvalRequestId)
    expect(request.label).toBe('Shift change')
    expect(request.summary).toContain('off')
    // one open request per day
    await expect(shiftChangesService.createRequest(self, { date, kind: 'CHANGE', requestedShiftId: null, reason: 'Again' })).rejects.toThrow('already asked')
    // the employee never decides it; the role holder of another company neither
    await expect(approvalsService.decide(self, { id: asked.approvalRequestId, approve: true })).rejects.toThrow()
    await expect(approvalsService.decide(approverOfB, { id: asked.approvalRequestId, approve: true })).rejects.toThrow()
    await approvalsService.decide(approver, { id: asked.approvalRequestId, approve: true })
    const mine = await shiftChangesService.listMine(self)
    expect(mine.find((r) => r.id === asked.id)?.status).toBe('APPROVED')
    // the roster day is now "off", published
    const day = await prisma.rosterEntry.findFirst({ where: { employeeId: employee.id, date }, select: { shiftId: true, publishedAt: true } })
    expect(day).toMatchObject({ shiftId: null })
    expect(day?.publishedAt).not.toBeNull()
  })

  it('the employee takes back a request still waiting - its approval is cancelled too', async () => {
    const asked = await shiftChangesService.createRequest(self, { date: workingDay(5), kind: 'CHANGE', requestedShiftId: null, reason: 'Travel' })
    const cancelled = await shiftChangesService.cancelRequest(self, asked.id)
    expect(cancelled.status).toBe('CANCELLED')
    expect((await approvalsService.getRequest(self, asked.approvalRequestId)).status).toBe('CANCELLED')
    await expect(shiftChangesService.cancelRequest(self, asked.id)).rejects.toThrow('already decided')
  })
})
