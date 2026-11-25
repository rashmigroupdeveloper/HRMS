import { call } from '@orpc/server'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import type { Context, CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { designationsService } from '#modules/organization'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import { regularizationsRouter } from '../src/modules/attendance/regularizations/regularizations.router.js'
import { shiftChangesRouter } from '../src/modules/attendance/shift-changes/shift-changes.router.js'
import * as documentsService from '../src/modules/employees/documents/documents.service.js'
import * as jobChangesService from '../src/modules/job-changes/job-changes.service.js'
import { applicationsRouter } from '../src/modules/leave/applications/applications.router.js'
import { compOffRouter } from '../src/modules/leave/comp-off/comp-off.router.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Employee self-service vs the role portal (the user, 2026-11-25): no active role = the employee portal, where one's own
// actions and the manager / HOD approval steps are; a role active = the role portal, where role / access / fallback steps
// are and one's own actions are refused - even for a Super Admin.
const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()
const contextOf = (user: CurrentUser): Context => ({ headers: {}, clientIp: null, getCurrentUser: async () => user, getCurrentCandidate: async () => null })
const pdf = () => new File(['%PDF-1.4\nSynthetic portal test\n%%EOF'], 'synthetic.pdf', { type: 'application/pdf' })

describe('employee portal and role portal', () => {
  let company: number
  let roleId: number
  let employee: { id: number; employeeCode: string }
  // the employee's reporting manager - in self-service, and the same person with the role active
  let managerSelf: CurrentUser
  let managerInRole: CurrentUser
  // HR raising the job change, with the role active (the role portal) and with none (self-service)
  let hrInRole: CurrentUser
  let hrSelf: CurrentUser
  // the role step's holder
  let holderInRole: CurrentUser
  let holderSelf: CurrentUser
  let approvalId: number

  beforeAll(async () => {
    company = (await createCompany()).id
    const plant = (await createPlant(company)).id
    const designation = (await designationsService.createDesignation({ name: `Portal test ${tag}` }, SYSTEM_ACTOR)).id
    roleId = (await createRole()).id
    employee = await createEmployee({ companyId: company, plantId: plant })
    const manager = await createEmployee({ companyId: company, plantId: plant })
    const hr = await createEmployee({ companyId: company, plantId: plant })
    const holder = await createEmployee({ companyId: company, plantId: plant })
    await prisma.employee.update({ where: { id: employee.id }, data: { reportingManagerId: manager.id } })
    await giveLogin(manager.id, [{ roleId, companyId: company }])
    await giveLogin(holder.id, [{ roleId, companyId: company }])
    const roleRows = [row(company, null, null)]
    managerSelf = userWith(manager, [])
    managerInRole = { ...userWith(manager, [{ access: {}, rows: roleRows }]), activeRoleId: roleId }
    hrInRole = { ...userWith(hr, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: roleRows }]), activeRoleId: roleId }
    hrSelf = userWith(hr, [])
    holderInRole = { ...userWith(holder, [{ access: {}, rows: roleRows }]), activeRoleId: roleId }
    holderSelf = userWith(holder, [])
    const chainsAdmin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: roleRows }])
    await chainsService.saveChain(chainsAdmin, {
      kind: 'JOB_CHANGE',
      companyId: company,
      steps: [{ approverType: 'REPORTING_MANAGER', seesConfidential: false }, { approverType: 'ROLE', roleId, seesConfidential: false }],
    })
    const change = await jobChangesService.createJobChange(
      { employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'REDESIGNATION', reason: 'Portal test', designationId: designation },
      hrInRole,
    )
    approvalId = change.approvalRequestId!
  })
  afterAll(() => prisma.$disconnect())

  const ids = (rows: { id: number }[]) => rows.map((r) => r.id)

  it("a manager's step is decided in self-service only, a role's step in the role portal only", async () => {
    expect(ids(await approvalsService.listToDecide(managerSelf))).toContain(approvalId)
    expect(ids(await approvalsService.listToDecide(managerInRole))).not.toContain(approvalId)
    await expect(approvalsService.decide(managerInRole, { id: approvalId, approve: true })).rejects.toMatchObject({ code: 'FORBIDDEN', data: { selfServiceOnly: true } })
    await approvalsService.decide(managerSelf, { id: approvalId, approve: true })
    // the role step is open now
    expect(ids(await approvalsService.listToDecide(holderInRole))).toContain(approvalId)
    expect(await approvalsService.countToDecide(holderSelf)).toBe(0)
    // without the role the request is not even theirs to see
    await expect(approvalsService.decide(holderSelf, { id: approvalId, approve: true })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // each portal lists the decisions made there
    expect(ids(await approvalsService.listDecided(managerSelf))).toContain(approvalId)
    expect(ids(await approvalsService.listDecided(managerInRole))).not.toContain(approvalId)
  })

  it('requests raised for others are listed in the role portal, one’s own in self-service', async () => {
    expect(ids(await approvalsService.listMine(hrInRole))).toContain(approvalId)
    expect(ids(await approvalsService.listMine(hrSelf))).not.toContain(approvalId)
  })

  it('refuses one’s own actions while a role is active - before reading the input', async () => {
    const refused = { code: 'FORBIDDEN', data: { selfServiceOnly: true } }
    const procedures = [
      applicationsRouter.preview,
      applicationsRouter.apply,
      applicationsRouter.cancel,
      compOffRouter.claim,
      compOffRouter.cancel,
      regularizationsRouter.create,
      regularizationsRouter.cancel,
      shiftChangesRouter.create,
      shiftChangesRouter.cancel,
    ]
    for (const procedure of procedures) {
      await expect(call(procedure as never, {} as never, { context: contextOf(managerInRole) })).rejects.toMatchObject(refused)
      // a Super Admin too
      await expect(call(procedure as never, {} as never, { context: contextOf({ ...userWith(employee, [], { isSuperAdmin: true }), activeRoleId: roleId }) })).rejects.toMatchObject(refused)
      // in self-service the request goes on (here to the input check)
      await expect(call(procedure as never, {} as never, { context: contextOf(managerSelf) })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
  })

  it('refuses uploading one’s own document and withdrawing one’s own request in the role portal', async () => {
    const own = { ...userWith(employee, [{ access: { EMPLOYEES: 'READ', EMPLOYEE_DOCUMENTS: 'WRITE' }, rows: [row(company, null, null)] }]), activeRoleId: roleId }
    await expect(documentsService.uploadDocument({ employeeCode: employee.employeeCode, type: 'PHOTO', file: pdf() }, own)).rejects.toMatchObject({ code: 'FORBIDDEN', data: { selfServiceOnly: true } })
    expect(await documentsService.uploadDocument({ employeeCode: employee.employeeCode, type: 'PHOTO', file: pdf() }, userWith(employee, []))).toMatchObject({ verificationStatus: 'PENDING' })
    const ownRequest = await prisma.$transaction((tx) =>
      approvalsService.raiseRequest({ feature: 'JOB_CHANGE', kinds: ['JOB_CHANGE'], employeeId: employee.id, requestedById: employee.id, summary: 'Portal test' }, tx),
    )
    await expect(approvalsService.cancel(own, { id: ownRequest.id })).rejects.toMatchObject({ code: 'FORBIDDEN', data: { selfServiceOnly: true } })
  })
})
