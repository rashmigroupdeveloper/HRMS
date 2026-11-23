import { outsideTransaction } from '#core/audit/capture'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { writeWorkbook } from '#core/excel/workbook'
import { approvalsService } from '#modules/approvals'
import { employeesService } from '#modules/employees'
import { costCentersService, designationsService, positionsService, salaryComponentsService } from '#modules/organization'
import { readStoredFile } from '#core/storage/file-storage'
import { changeHistoryService } from '#modules/change-history'
import { employeeDocumentsService } from '#modules/employees'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as chainsService from '../src/modules/approvals/chains/chains.service.js'
import * as importsService from '../src/modules/employees/imports/imports.service.js'
import * as jobHistoryService from '../src/modules/employees/job-history/job-history.service.js'
import * as jobChangesRepository from '../src/modules/job-changes/job-changes.repository.js'
import * as jobChangesService from '../src/modules/job-changes/job-changes.service.js'
import { createRole, giveLogin } from './helpers/approvals.js'
import { createCompany, createEmployee, createPlant } from './helpers/organization.js'
import { row, userWith } from './helpers/users.js'

// Job changes through approval (the user, 2026-11-20): asked by HR with a reason, approved through the chain, applied on
// their day (at once when it has come, later by the daily job), checked again when applied, one open change per employee,
// job details changed directly only with "Approve job & salary changes", and data access.
const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const tag = Math.random().toString(36).slice(2, 8).toUpperCase()

describe('job changes', () => {
  let companyA: number
  let companyB: number
  let plantA: number
  let plantB: number
  let hr: ReturnType<typeof userWith>
  let hrB: ReturnType<typeof userWith>
  let approver: ReturnType<typeof userWith>
  let engineer: number
  let senior: number
  let hrEmployee: { id: number; employeeCode: string }
  let roleId: number

  // approves the change's request (one step: the test role)
  const approve = async (changeId: number) => {
    const change = await jobChangesService.getJobChange(hr, changeId)
    await approvalsService.decide(approver, { id: change.approvalRequestId, approve: true })
    return jobChangesService.getJobChange(hr, changeId)
  }
  const ask = (employeeCode: string, effectiveFrom: Date, fields: Partial<Parameters<typeof jobChangesService.createJobChange>[0]> = {}) =>
    jobChangesService.createJobChange({ employeeCode, effectiveFrom, kind: 'PROMOTION', reason: 'Good work', designationId: senior, ...fields }, hr)

  beforeAll(async () => {
    companyA = (await createCompany()).id
    companyB = (await createCompany()).id
    plantA = (await createPlant(companyA)).id
    plantB = (await createPlant(companyB)).id
    engineer = (await designationsService.createDesignation({ name: `Engineer ${tag}` }, SYSTEM_ACTOR)).id
    senior = (await designationsService.createDesignation({ name: `Senior Engineer ${tag}` }, SYSTEM_ACTOR)).id
    const role = await createRole()
    roleId = role.id
    hrEmployee = await createEmployee({ companyId: companyA, plantId: plantA })
    hr = userWith(hrEmployee, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyA, null, null)] }])
    hrB = userWith(await createEmployee({ companyId: companyB, plantId: plantB }), [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyB, null, null)] }])
    const approverEmployee = await createEmployee({ companyId: companyA, plantId: plantA })
    await giveLogin(approverEmployee.id, [{ roleId: role.id, companyId: companyA }])
    approver = { ...userWith(approverEmployee, [{ access: {}, rows: [row(companyA, null, null)] }]), activeRoleId: role.id }
    const admin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await chainsService.saveChain(admin, { kind: 'JOB_CHANGE', companyId: companyA, steps: [{ approverType: 'ROLE', roleId: role.id, seesConfidential: false }] })
  })
  afterAll(() => prisma.$disconnect())

  it('asks after the latest timeline entry, for something that changes, one open change at a time', async () => {
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    await expect(ask(employee.employeeCode, date(2026, 1, 1))).rejects.toThrow('after the latest entry of the job timeline')
    await expect(ask(employee.employeeCode, date(2026, 2, 1), { designationId: undefined })).rejects.toThrow('Nothing changes')
    const first = await ask(employee.employeeCode, date(2026, 2, 1))
    expect(first).toMatchObject({ status: 'PENDING', changes: [{ field: 'designationId', from: null, to: `Senior Engineer ${tag}` }] })
    await expect(ask(employee.employeeCode, date(2026, 3, 1), { designationId: engineer })).rejects.toThrow('already has a job change waiting for approval')
    // nothing changes before it applies
    expect((await employeesService.getByCode(employee.employeeCode)).designation).toBeNull()
  })

  // Found in the 2026-11-23 review: a cancel read "waiting" (or "approved"), then wrote CANCELLED over an approval or an
  // apply that finished a moment before - a cancelled request whose change was applied. Played out step by step: the
  // row is held (as a decision landing at the same moment holds it), the cancel runs into it, the row moves on, then
  // the cancel goes ahead - and must see that it moved on.
  const racing = async (table: string, id: number, newStatus: string, cancel: () => Promise<unknown>) => {
    let outcome!: Promise<unknown>
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(`SELECT id FROM ${table} WHERE id = ${id} FOR UPDATE`)
        outcome = outsideTransaction(cancel).then(
          () => 'done',
          (error: Error) => error.message,
        )
        // until the cancel waits for the row
        for (let tries = 0; tries < 100; tries++) {
          const [waiting] = await outsideTransaction(() =>
            prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`),
          )
          if (waiting!.n > 0) break
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        await tx.$executeRawUnsafe(`UPDATE ${table} SET status = '${newStatus}' WHERE id = ${id}`)
      },
      { timeout: 20_000 },
    )
    return outcome
  }

  it('refuses a cancel when the approval closed the request a moment before', async () => {
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const change = await ask(employee.employeeCode, date(2026, 2, 1))
    const outcome = await racing('approval_requests', change.approvalRequestId, 'APPROVED', () =>
      jobChangesService.cancelJobChange(hr, { id: change.id, reason: 'Changed our mind' }),
    )
    expect(outcome).toContain('decided a moment ago')
    expect((await approvalsService.statusOf([change.approvalRequestId])).get(change.approvalRequestId)?.status).toBe('APPROVED')
    expect((await jobChangesService.getJobChange(hr, change.id)).status).toBe('PENDING')
  })

  it('refuses cancelling an approved change that was applied a moment before', async () => {
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const change = await ask(employee.employeeCode, date(2099, 1, 1))
    expect((await approve(change.id)).status).toBe('APPROVED')
    const outcome = await racing('job_change_requests', change.id, 'APPLIED', () => jobChangesService.cancelJobChange(hr, { id: change.id }))
    expect(outcome).toContain('applied a moment ago')
    expect((await jobChangesService.getJobChange(hr, change.id)).status).toBe('APPLIED')
  })

  it('needs "Request job changes" to ask - Employees Edit alone no longer does (2026-11-21)', async () => {
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const asker = (access: Parameters<typeof userWith>[1][number]['access']) => userWith(hrEmployee, [{ access, rows: [row(companyA, null, null)] }])
    const askBy = (viewer: ReturnType<typeof asker>) =>
      jobChangesService.createJobChange({ employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'PROMOTION', reason: 'Test', designationId: senior }, viewer)
    await expect(askBy(asker({ EMPLOYEES: 'WRITE' }))).rejects.toThrow()
    // the area alone (with Employees View to find the employee) asks
    await expect(askBy(asker({ EMPLOYEES: 'READ', JOB_CHANGE_REQUEST: 'WRITE' }))).resolves.toMatchObject({ status: 'PENDING' })
  })

  it('applies an approved change at once when its day has come, and a later one on its day', async () => {
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const now = await approve((await ask(employee.employeeCode, date(2026, 2, 1), { designationId: engineer })).id)
    expect(now.status).toBe('APPLIED')
    const timeline = await jobHistoryService.listJobHistory(hr, employee.employeeCode)
    expect(timeline.map((e) => [e.kind, e.jobChangeRequestId])).toEqual([
      ['PROMOTION', now.id],
      ['JOINING', null],
    ])

    const later = await approve((await ask(employee.employeeCode, date(2099, 1, 1))).id)
    expect(later.status).toBe('APPROVED')
    expect((await employeesService.getByCode(employee.employeeCode)).designation?.id).toBe(engineer)
    // its day comes (moved into the past here): the daily job applies it
    await jobChangesRepository.update(later.id, { effectiveFrom: date(2026, 3, 1) }, SYSTEM_ACTOR)
    await jobChangesService.applyDue()
    expect((await jobChangesService.getJobChange(hr, later.id)).status).toBe('APPLIED')
    expect((await employeesService.getByCode(employee.employeeCode)).designation?.id).toBe(senior)
    // as of a date: the details in force that day
    expect((await jobHistoryService.jobAsOf(hr, { employeeCode: employee.employeeCode, date: date(2026, 2, 15) }))?.details.designationId).toBe(`Engineer ${tag}`)
    // the change shows what it was before
    expect((await jobChangesService.getJobChange(hr, later.id)).changes).toEqual([{ field: 'designationId', label: 'Designation', from: `Engineer ${tag}`, to: `Senior Engineer ${tag}` }])
  })

  it('keeps an approved change it cannot apply on its day, with the reason, until it is cancelled', async () => {
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const manager = await createEmployee({ companyId: companyA, plantId: plantA })
    const change = await approve((await ask(employee.employeeCode, date(2099, 1, 1), { kind: 'MANAGER_CHANGE', designationId: undefined, functionalManagerCode: manager.employeeCode })).id)
    await prisma.employee.update({ where: { id: manager.id }, data: { status: 'EXITED', updatedById: SYSTEM_ACTOR } })
    await jobChangesRepository.update(change.id, { effectiveFrom: date(2026, 3, 1) }, SYSTEM_ACTOR)
    await jobChangesService.applyDue()
    const stuck = await jobChangesService.getJobChange(hr, change.id)
    expect([stuck.status, stuck.applyError]).toEqual(['APPROVED', expect.stringContaining('has left')])
    const cancelled = await jobChangesService.cancelJobChange(hr, { id: change.id, reason: 'Manager left' })
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'Manager left' })
    // the slot is free again
    await expect(ask(employee.employeeCode, date(2099, 2, 1))).resolves.toMatchObject({ status: 'PENDING' })
  })

  it('clears the contract end date when someone is made permanent', async () => {
    const contract = await employeesService.createEmployee(
      {
        employeeCode: `JC${tag}`,
        companyId: companyA,
        plantId: plantA,
        departmentId: (await employeesService.getByCode((await createEmployee({ companyId: companyA, plantId: plantA })).employeeCode)).department.id,
        firstName: 'Contract',
        joiningType: 'OVERSEAS',
        employmentType: 'CONTRACT',
        workforceCategory: 'WHITE_COLLAR',
        dateOfJoining: date(2026, 1, 1),
        contractEndDate: date(2027, 1, 1),
      },
      SYSTEM_ACTOR,
    )
    await approve((await ask(contract.employeeCode, date(2026, 2, 1), { kind: 'OTHER', designationId: undefined, employmentType: 'PERMANENT' })).id)
    const now = await employeesService.getByCode(contract.employeeCode)
    expect([now.employmentType, now.contractEndDate]).toEqual(['PERMANENT', null])
  })

  it('needs "Approve job & salary changes" to change job details directly, and keeps the date of joining before the first change', async () => {
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, designationId: engineer }, hr)).rejects.toThrow('Approve job & salary changes')
    // names and dates do not need it
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, firstName: 'Renamed' }, hr)).resolves.toBeDefined()
    const direct = userWith({ id: 0, employeeCode: 'DIRECT' }, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', JOB_CHANGE_APPROVAL: 'WRITE' }, rows: [row(companyA, null, null)] }])
    const position = await positionsService.createPosition({ name: `Plant Maintenance ${tag}` }, SYSTEM_ACTOR)
    await employeesService.updateEmployee({ employeeCode: employee.employeeCode, positionId: position.id }, direct)
    // a correction fixes the entry in force - no new entry
    expect((await jobHistoryService.listJobHistory(hr, employee.employeeCode)).map((e) => [e.kind, e.details.positionId])).toEqual([['JOINING', `Plant Maintenance ${tag}`]])
    // the Excel import too
    const file = new File(
      [new Uint8Array(await writeWorkbook([
          {
            name: 'Employees',
            // the required columns must be there; an employee being updated keeps what an empty cell leaves out
            columns: ['Employee code', 'First name', 'Company code', 'Plant code', 'Department', 'Date of joining', 'Designation'].map((header) => ({ header, key: header })),
            rows: [{ 'Employee code': employee.employeeCode, Designation: `Engineer ${tag}` }],
          },
        ]))],
      'import.xlsx',
    )
    const checked = await importsService.uploadImport({ file }, hr)
    expect(checked.rows[0]!.errors.join(' ')).toContain('change through approval')

    await approve((await ask(employee.employeeCode, date(2026, 2, 1))).id)
    await expect(employeesService.updateEmployee({ employeeCode: employee.employeeCode, dateOfJoining: date(2026, 3, 1) }, direct)).rejects.toThrow('before the first job change')
    await employeesService.updateEmployee({ employeeCode: employee.employeeCode, dateOfJoining: date(2025, 12, 1) }, direct)
    expect((await jobHistoryService.listJobHistory(hr, employee.employeeCode)).at(-1)!.effectiveFrom).toEqual(date(2025, 12, 1))
  })

  it('lists and shows job changes only inside the data access; the employee sees theirs, the requester the ones they asked', async () => {
    const inA = await createEmployee({ companyId: companyA, plantId: plantA })
    const inB = await createEmployee({ companyId: companyB, plantId: plantB })
    const pending = await ask(inA.employeeCode, date(2026, 2, 1))
    await expect(jobChangesService.createJobChange({ employeeCode: inB.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'OTHER', reason: 'x', designationId: senior }, hr)).rejects.toThrow('No employee found')
    const inBChange = await jobChangesService.createJobChange({ employeeCode: inB.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'OTHER', reason: 'x', designationId: senior }, hrB)
    const listed = (await jobChangesService.listJobChanges(hr, { pageSize: 200, page: 1 })).items.map((c) => c.id)
    expect(listed).toContain(pending.id)
    expect(listed).not.toContain(inBChange.id)
    await expect(jobChangesService.getJobChange(hr, inBChange.id)).rejects.toThrow('No job change found')
    // never for oneself (2026-11-21)
    await expect(jobChangesService.createJobChange({ employeeCode: hr.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'OTHER', reason: 'x', designationId: senior }, hr)).rejects.toThrow('your own job')
    // the employee themselves: whatever its status (their "My jobs & salary", 2026-11-21) - only their own
    const self = userWith(inA, [{ access: {}, rows: [] }])
    await expect(jobChangesService.getJobChange(self, pending.id)).resolves.toMatchObject({ status: 'PENDING' })
    await expect(jobChangesService.getJobChange(self, inBChange.id)).rejects.toThrow('No job change found')
    const aboutMe = (await jobChangesService.listJobChanges(self, { mine: 'ABOUT_ME', page: 1, pageSize: 200 })).items.map((c) => c.id)
    expect(aboutMe).toEqual([pending.id])
    // without Employees View: no list of others, and no employee code with "mine"
    await expect(jobChangesService.listJobChanges(self, { page: 1, pageSize: 200 })).rejects.toThrow('You do not have access')
    await expect(jobChangesService.listJobChanges(self, { mine: 'ABOUT_ME', employeeCode: inB.employeeCode, page: 1, pageSize: 200 })).rejects.toThrow('not both')
    // the requester: the ones they asked, not another requester's (even of an employee they see)
    const askedByHr = (await jobChangesService.listJobChanges(hr, { mine: 'ASKED_BY_ME', page: 1, pageSize: 200 })).items.map((c) => c.id)
    expect(askedByHr).toContain(pending.id)
    expect(askedByHr).not.toContain(inBChange.id)
    const askedByHrB = (await jobChangesService.listJobChanges(hrB, { mine: 'ASKED_BY_ME', page: 1, pageSize: 200 })).items.map((c) => c.id)
    expect(askedByHrB).toContain(inBChange.id)
    expect(askedByHrB).not.toContain(pending.id)
    await approve(pending.id)
    await expect(jobChangesService.getJobChange(self, pending.id)).resolves.toMatchObject({ status: 'APPLIED' })
  })

  it('revises the salary alone or with a promotion - both chains merged - shows the figures only to those who may see them, and keeps the history', async () => {
    // the salary chain: the job chain's role, then a second role - both seeing the figures
    const role2 = await createRole()
    const approver2Employee = await createEmployee({ companyId: companyA, plantId: plantA })
    await giveLogin(approver2Employee.id, [{ roleId: role2.id, companyId: companyA }])
    const approver2 = { ...userWith(approver2Employee, [{ access: {}, rows: [row(companyA, null, null)] }]), activeRoleId: role2.id }
    const admin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    await chainsService.saveChain(admin, {
      kind: 'SALARY_REVISION',
      companyId: companyA,
      steps: [
        { approverType: 'ROLE', roleId, seesConfidential: true },
        { approverType: 'ROLE', roleId: role2.id, seesConfidential: true },
      ],
    })
    const approveBoth = async (changeId: number) => {
      const change = await jobChangesService.getJobChange(hr, changeId)
      await approvalsService.decide(approver, { id: change.approvalRequestId, approve: true })
      await approvalsService.decide(approver2, { id: change.approvalRequestId, approve: true })
      return jobChangesService.getJobChange(hr, changeId)
    }
    const component = (await salaryComponentsService.listSalaryComponents()).find((c) => c.kind === 'EARNING')!.id
    const salary = (monthly: number) => ({ annualCtc: monthly * 12, lines: [{ salaryComponentId: component, monthlyAmount: monthly }] })
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const code = employee.employeeCode
    const withSalary = userWith(hrEmployee, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE', SALARY: 'WRITE', SALARY_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyA, null, null)] }])

    // the salary is confidential: "Request salary changes" Edit + Employee · Salary View to ask (2026-11-21)
    await expect(ask(code, date(2026, 2, 1), { kind: 'SALARY_REVISION', designationId: undefined, salary: salary(50_000) })).rejects.toThrow('Request salary changes')
    // Employee · Salary Edit alone no longer asks; the request area without seeing the salary neither
    const salaryEditOnly = userWith(hrEmployee, [{ access: { EMPLOYEES: 'WRITE', SALARY: 'WRITE' }, rows: [row(companyA, null, null)] }])
    const requestNoSalaryView = userWith(hrEmployee, [{ access: { EMPLOYEES: 'READ', SALARY_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyA, null, null)] }])
    for (const viewer of [salaryEditOnly, requestNoSalaryView]) {
      await expect(
        jobChangesService.createJobChange({ employeeCode: code, effectiveFrom: date(2026, 2, 1), kind: 'SALARY_REVISION', reason: 'Yearly increment', salary: salary(50_000) }, viewer),
      ).rejects.toThrow('Request salary changes')
    }
    const askAs = (fields: Partial<Parameters<typeof jobChangesService.createJobChange>[0]>) =>
      jobChangesService.createJobChange({ employeeCode: code, effectiveFrom: date(2026, 2, 1), kind: 'SALARY_REVISION', reason: 'Yearly increment', ...fields }, withSalary)
    await expect(askAs({ salary: { annualCtc: 600_000, lines: [{ salaryComponentId: component, monthlyAmount: 40_000 }] } })).rejects.toThrow('adds up to 480000')
    await expect(askAs({ salary: salary(50_000), designationId: senior })).rejects.toThrow('changes the salary only')
    // an employee added directly has no salary yet: the first one is a revision
    const first = await approveBoth((await askAs({ salary: salary(50_000) })).id)
    expect(first.status).toBe('APPLIED')

    // a promotion with a hike: one request, the job and salary chains merged - the shared role asked once
    const promotion = await askAs({ kind: 'PROMOTION', effectiveFrom: date(2026, 3, 1), designationId: senior, salary: salary(60_000) })
    const steps = (await approvalsService.getRequest(withSalary, promotion.approvalRequestId)).steps
    expect(steps.map((s) => [s.who, s.seesConfidential])).toEqual([
      [expect.stringContaining('Test role'), true],
      [role2.name, true],
    ])
    // the figures: the approver of a step that sees them, yes; someone with Employees View only, no
    expect((await jobChangesService.getJobChange(approver, promotion.id)).salary).toMatchObject({ annualCtc: 720_000, changePercent: 20 })
    const viewOnly = userWith(approver2Employee, [{ access: { EMPLOYEES: 'READ' }, rows: [row(companyA, null, null)] }])
    expect(await jobChangesService.getJobChange(viewOnly, promotion.id)).toMatchObject({ salary: null, salaryHidden: true })
    const applied = await approveBoth(promotion.id)
    expect(applied.status).toBe('APPLIED')
    // only while approving (2026-11-21): once decided, the approver without salary access no longer sees the figures
    expect(await jobChangesService.getJobChange(approver, promotion.id)).toMatchObject({ salary: null, salaryHidden: true })
    expect((await employeesService.getByCode(code)).designation?.id).toBe(senior)

    // a correction of the promotion's salary, for its day: the row takes the new figures - no new row
    const fix = await approveBoth((await askAs({ kind: 'SALARY_CORRECTION', effectiveFrom: date(2026, 3, 1), salary: salary(61_000) })).id)
    expect(fix.status).toBe('APPLIED')
    await expect(askAs({ kind: 'SALARY_CORRECTION', effectiveFrom: date(2026, 4, 1), salary: salary(62_000) })).rejects.toThrow('there is none from 2026-04-01')
    const history = await employeesService.salaryHistory(withSalary, code)
    expect(history.map((h) => [h.annualCtc, h.reason, h.changePercent])).toEqual([
      [732_000, 'CORRECTION', 22],
      [600_000, 'INCREMENT', null],
    ])
    expect(history[0]!.approvedBy?.employeeCode).toBe(approver2Employee.employeeCode)
    // the history is confidential too
    await expect(employeesService.salaryHistory(hr, code)).rejects.toThrow()
    // and in the change history: the proposed figures only with the salary access
    const historyOf = async (access: Parameters<typeof userWith>[1][number]['access']) =>
      (await changeHistoryService.listChangeHistory(userWith({ id: 0, employeeCode: 'AUDIT' }, [{ access, rows: [row(null, null, null)] }]), { model: 'JobChangeSalary', pageSize: 50 })).items
    const noSalary = (await historyOf({ CHANGE_HISTORY: 'READ' })).flatMap((i) => i.changes.filter((c) => c.field === 'annualCtc'))
    expect(noSalary.length).toBeGreaterThan(0)
    expect(noSalary.every((c) => c.after === '(hidden)')).toBe(true)
    const withSalaryAccess = (await historyOf({ CHANGE_HISTORY: 'READ', SALARY: 'READ' })).flatMap((i) => i.changes.filter((c) => c.field === 'annualCtc'))
    expect(withSalaryAccess.some((c) => typeof c.after === 'number')).toBe(true)
  })

  it('moves someone to another company with a new code from its series - the old code still finds them - only with access on both sides', async () => {
    const companyC = await createCompany()
    const plantC = await createPlant(companyC.id)
    const role = await createRole()
    const both = await createEmployee({ companyId: companyA, plantId: plantA })
    await giveLogin(both.id, [{ roleId: role.id, companyId: [companyA, companyC.id] }])
    const admin = userWith({ id: 0, employeeCode: 'CHAINS' }, [{ access: { APPROVAL_CHAINS: 'WRITE' }, rows: [row(companyA, null, null)] }])
    const employee = await createEmployee({ companyId: companyA, plantId: plantA })
    const departmentC = (await createEmployee({ companyId: companyC.id, plantId: plantC.id })).employeeCode
    const department = (await employeesService.getByCode(departmentC)).department.id
    const transfer = { employeeCode: employee.employeeCode, effectiveFrom: date(2026, 2, 1), kind: 'COMPANY_TRANSFER' as const, reason: 'Group move', companyId: companyC.id, plantId: plantC.id, departmentId: department }
    // a document of theirs: its file moves to the folder of the new code
    const docsHr = userWith(hrEmployee, [{ access: { EMPLOYEES: 'READ', EMPLOYEE_DOCUMENTS: 'WRITE' }, rows: [row(companyA, null, null), row(companyC.id, null, null)] }])
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46])], 'aadhaar.pdf', { type: 'application/pdf' })
    await employeeDocumentsService.uploadDocument({ employeeCode: employee.employeeCode, type: 'PHOTO', file: pdf }, docsHr)
    const keyBefore = (await prisma.employeeDocument.findFirst({ where: { employeeId: employee.id }, select: { storageKey: true } }))!.storageKey

    // the requester needs Edit where they are and where they go
    await expect(jobChangesService.createJobChange(transfer, hr)).rejects.toThrow('only move an employee')
    const hrBoth = userWith(hrEmployee, [{ access: { EMPLOYEES: 'WRITE', JOB_CHANGE_REQUEST: 'WRITE' }, rows: [row(companyA, null, null), row(companyC.id, null, null)] }])
    await expect(jobChangesService.createJobChange({ ...transfer, kind: 'TRANSFER' }, hrBoth)).rejects.toThrow('is a company transfer')
    await expect(jobChangesService.createJobChange({ ...transfer, plantId: undefined }, hrBoth)).rejects.toThrow('plant and department of the new company')
    // found in the 2026-11-23 review: the old company's cost centre, kept selected, passed as "unchanged"
    const oldCostCenter = await costCentersService.createCostCenter({ companyId: companyA, code: `CC${tag}`, name: 'Old company' }, SYSTEM_ACTOR)
    await prisma.employee.update({ where: { id: employee.id }, data: { costCenterId: oldCostCenter.id } })
    await expect(jobChangesService.createJobChange({ ...transfer, costCenterId: oldCostCenter.id }, hrBoth)).rejects.toThrow(/cost cent/i)

    await chainsService.saveChain(admin, { kind: 'JOB_CHANGE', companyId: companyA, steps: [{ approverType: 'ROLE', roleId: role.id, seesConfidential: false }] })
    try {
      const asked = await jobChangesService.createJobChange(transfer, hrBoth)
      expect(asked.changes[0]).toMatchObject({ field: 'companyId', label: 'Company', to: expect.stringContaining(companyC.code) })
      // its approvers must cover both companies: the role holder for A only cannot decide it
      await expect(approvalsService.decide(approver, { id: asked.approvalRequestId, approve: true })).rejects.toThrow()
      await approvalsService.decide({ ...userWith(both, [{ access: {}, rows: [] }]), activeRoleId: role.id }, { id: asked.approvalRequestId, approve: true })
      expect((await jobChangesService.getJobChange(hrBoth, asked.id)).status).toBe('APPLIED')
    } finally {
      // the other tests of this file use company A's one-role chain
      await chainsService.saveChain(admin, { kind: 'JOB_CHANGE', companyId: companyA, steps: [{ approverType: 'ROLE', roleId, seesConfidential: false }] })
    }

    const oldCode = employee.employeeCode
    const moved = await employeesService.getByCode(oldCode)
    expect(moved.company.id).toBe(companyC.id)
    expect(moved.employeeCode).toBe(`${companyC.ecodePrefix}000001`)
    expect(moved.costCenter).toBeNull()
    // the document's file moved to the new code's folder; the old file is gone
    const keyAfter = (await prisma.employeeDocument.findFirst({ where: { employeeId: employee.id }, select: { storageKey: true } }))!.storageKey
    expect(keyAfter).toContain(`employees/${moved.employeeCode}/`)
    expect((await readStoredFile(keyAfter)).subarray(0, 4).toString()).toBe('%PDF')
    await expect(readStoredFile(keyBefore)).rejects.toThrow()
    // the old code: signs them in, finds them, matches their punches
    expect((await employeesService.findSummaryByLogin(oldCode))?.employeeCode).toBe(moved.employeeCode)
    expect((await employeesService.mapCodesToIds([oldCode])).get(oldCode)).toBe(employee.id)
    // the timeline: the entry from the move carries the new company and code, the joining the old ones
    const timeline = await jobHistoryService.listJobHistory(hrBoth, moved.employeeCode)
    expect(timeline.map((e) => [e.kind, e.employeeCode])).toEqual([
      ['COMPANY_TRANSFER', moved.employeeCode],
      ['JOINING', oldCode],
    ])
  })
})
