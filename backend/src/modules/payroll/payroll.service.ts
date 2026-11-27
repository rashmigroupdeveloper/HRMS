import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { assertWholeSlice, levelOver, wholeCompanyScopeOf } from '#core/auth/scope'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { attendanceService } from '#modules/attendance'
import { companiesService } from '#modules/organization'
import { employeesService } from '#modules/employees'
import * as payrollRepository from './payroll.repository.js'
import * as calculationService from './calculation/calculation.service.js'
import * as checksService from './checks/checks.service.js'
import * as daysService from './days/days.service.js'
import * as inputsService from './inputs/inputs.service.js'
import * as peopleService from './people/people.service.js'
import * as peopleRepository from './people/people.repository.js'
import type { CreateInput, ListInput, SendInput } from './payroll.schema.js'

const companySlice = (companyId: number) => ({ companyId, plantId: null, departmentId: null })
const monthName = (date: Date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)

// --- Stage 5 (approved by the user 2026-11-27): approval through the one approval service ---
// A run is sent as a request about its whole company (kind PAY_RUN); the approval service routes it along the pay-run
// chain (roles with Payroll View and Salary View over the whole company - no fallback approver) and calls back here on
// the final decision. A request that is no longer the run's current one changes nothing (the run was sent again).
approvalsService.registerFeature('PAYROLL', {
  label: 'Pay run',
  onApproved: async (requestId, actorId, tx) => void (await payrollRepository.finalise(requestId, actorId, tx)),
  onRejected: async (requestId, actorId, tx) => void (await payrollRepository.backToDraft(requestId, actorId, tx)),
  onCancelled: async (requestId, actorId, tx) => void (await payrollRepository.backToDraft(requestId, actorId, tx)),
  // (never about one employee)
  canView: () => false,
  canCancel: () => false,
  link: () => '/manage/payroll',
  company: {
    // Payroll View over the whole company sees the request; Payroll Edit over it may withdraw it
    canView: (viewer, companyId) => levelOver(viewer, 'PAYROLL', companySlice(companyId)) !== undefined,
    canCancel: (viewer, companyId) => levelOver(viewer, 'PAYROLL', companySlice(companyId)) === 'WRITE',
    // the run while this is its current request; an older request (the run was sent again since) opens the runs list
    link: async (requestId) => {
      const run = await payrollRepository.findByRequest(requestId)
      return run ? `/manage/payroll/${run.id}` : '/manage/payroll'
    },
  },
})

export async function getSetup(viewer: CurrentUser, { payMonth }: { payMonth: Date }) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const [companies, period] = await Promise.all([companiesService.listCompanies(), attendanceService.getPayrollPeriod(payMonth.getUTCFullYear(), payMonth.getUTCMonth() + 1)])
  return { companies: companies.filter(c => c.isIndiaPayroll && levelOver(viewer, 'PAYROLL', { companyId: c.id, plantId: null, departmentId: null })).map(c => ({ id: c.id, code: c.code, name: c.name, canCreate: levelOver(viewer, 'PAYROLL', { companyId: c.id, plantId: null, departmentId: null }) === 'WRITE' })), attendanceFrom: period.from, attendanceTo: period.to }
}

export async function listRuns(viewer: CurrentUser, input: ListInput) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const result = await prisma.$transaction(tx => payrollRepository.list(wholeCompanyScopeOf(viewer, 'PAYROLL'), input, tx), { isolationLevel: 'RepeatableRead' })
  return { ...result, items: result.items.map(({ createdById: _created, updatedById: _updated, peopleRefreshedById: _refreshed, computedById: _computed, finalisedById: _finalised, _count, ...item }) => ({ ...item, people: _count.employees })) }
}

export async function getRun(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const run = await payrollRepository.find(id, wholeCompanyScopeOf(viewer, 'PAYROLL'))
  if (!run) throw new ORPCError('NOT_FOUND', { message: 'No payroll run found' })
  const showSalary = peopleService.seesSalaries(viewer, run.company.id)
  const draft = run.status === 'DRAFT'
  const [counts, inputs, lock, pay, approval, openWarnings] = await Promise.all([
    peopleRepository.countPeople(run.id),
    inputsService.countInputs(run.id),
    daysService.lockStateOf(run),
    // stage 3: unpaid days, people to look at, pay held or to work out again, the earned gross - null until worked out
    peopleService.runCountsOf(run, showSalary),
    // stage 5: where its approval request stands
    run.approvalRequestId ? approvalsService.statusOf([run.approvalRequestId]).then((m) => m.get(run.approvalRequestId!) ?? null) : null,
    // stage 5: warnings not acknowledged yet - worked out while it is a draft only
    draft && run.computedAt ? checksService.openWarningsCount({ id: run.id, companyId: run.company.id, payMonth: run.payMonth, attendanceFrom: run.attendanceFrom, attendanceTo: run.attendanceTo }) : 0,
  ])
  const person = await employeesService.lookupPeople([run.createdById, run.updatedById, run.peopleRefreshedById, run.computedById, run.finalisedById, approval?.requestedById])
  const { createdById, updatedById, peopleRefreshedById, computedById, finalisedById, ...safe } = run
  const period = peopleService.payPeriodOf(run)
  const canChange = draft && levelOver(viewer, 'PAYROLL', companySlice(run.company.id)) === 'WRITE'
  // what stops it from being sent (stage 5): in words, for the page
  const blockers = draft
    ? [
        !run.computedAt ? 'Work out the pay first' : '',
        !lock.attendanceLocked ? 'The attendance month is not locked' : '',
        pay && pay.held ? `${pay.held} ${pay.held === 1 ? 'person is' : 'people are'} held` : '',
        pay && pay.again ? `${pay.again} to work out again` : '',
        openWarnings ? `${openWarnings} ${openWarnings === 1 ? 'warning is' : 'warnings are'} not acknowledged` : '',
      ].filter(Boolean)
    : []
  return {
    ...safe,
    payFrom: period.from,
    payTo: period.to,
    createdBy: person(createdById),
    updatedBy: person(updatedById),
    peopleRefreshedBy: person(peopleRefreshedById),
    computedBy: person(computedById),
    attendanceLocked: lock.attendanceLocked,
    // (a sent or finalised run keeps what it took: attendance reopened later does not make it outdated)
    daysOutdated: draft && lock.daysOutdated,
    peopleWithUnpaidDays: pay?.unpaidDays ?? null,
    peopleToCheck: pay?.toCheck ?? null,
    peopleHeld: pay?.held ?? null,
    peopleToWorkOutAgain: pay?.again ?? null,
    earnedGross: pay?.earnedGross ?? null,
    // stage 4: the deductions, the net pay and what the company pays on top (salary figures), and how many worked-out
    // people have no PF
    deductions: pay?.deductions ?? null,
    netPay: pay?.netPay ?? null,
    employerContributions: pay?.employerContributions ?? null,
    peopleWithoutPf: pay?.withoutPf ?? null,
    people: counts.people,
    peopleWithoutSalary: counts.withoutSalary,
    inputs,
    canChange,
    salaryHidden: !showSalary,
    // stage 5: the approval - its request, who sent it and when, where it stands; who finalised it; what stops sending
    approval: approval
      ? { requestId: run.approvalRequestId!, status: approval.status, held: approval.held, sentAt: approval.raisedAt, sentBy: person(approval.requestedById), step: approval.step ? { stepNo: approval.step.stepNo, of: approval.step.of, who: approval.step.who, late: approval.step.late } : null }
      : null,
    finalisedBy: person(finalisedById),
    openWarnings,
    blockers,
    canSend: canChange && blockers.length === 0,
  }
}

// "Send for approval" (stage 5): in one transaction, while the run is a draft - by someone with Payroll Edit over the whole
// company - its pay is worked out once more from the records as they are now; then nobody may be held or to work out
// again and every warning must be acknowledged (the user, 2026-11-27); then it goes to the approval service as a request
// about the whole company, and nothing in it changes until it is decided. The sender never approves it.
export async function sendRun(viewer: CurrentUser, { runId }: SendInput) {
  const sent = await prisma.$transaction(
    async (tx) => {
      const run = await peopleService.draftRunFor(viewer, runId, 'Sending a payroll run for approval', tx)
      await calculationService.workOutRun(run, viewer.employeeId, tx)
      const pay = await peopleService.runCountsOf({ id: run.id, computedAt: new Date() }, false, tx)
      if (pay && (pay.held || pay.again)) {
        throw new ORPCError('CONFLICT', { message: `${pay.held + pay.again} ${pay.held + pay.again === 1 ? 'person' : 'people'} with pay not worked out - fix them first (Show: Pay not worked out)` })
      }
      const open = await checksService.openWarningsCount({ id: run.id, companyId: run.company.id, payMonth: run.payMonth, attendanceFrom: run.attendanceFrom, attendanceTo: run.attendanceTo }, tx)
      if (open) throw new ORPCError('CONFLICT', { message: `${open} ${open === 1 ? 'warning is' : 'warnings are'} not acknowledged yet (Checks) - the pay was worked out again just now` })
      const counts = await peopleRepository.countPeople(run.id, tx)
      const { id, outcome } = await approvalsService.raiseRequest(
        { feature: 'PAYROLL', kinds: ['PAY_RUN'], companyId: run.company.id, requestedById: viewer.employeeId, summary: `Pay run ${monthName(run.payMonth)} · ${run.company.code} · ${counts.people} people` },
        tx,
      )
      if (!(await payrollRepository.markSent(run.id, id, viewer.employeeId, tx))) throw new ORPCError('CONFLICT', { message: 'This run was sent a moment ago - reload it' })
      return { id, outcome }
    },
    { timeout: 120_000 },
  )
  await approvalsService.finishAndNotify(sent.id, sent.outcome)
  return getRun(viewer, { id: runId })
}

export async function createRun(viewer: CurrentUser, input: CreateInput) {
  assertAccess(viewer.access, 'PAYROLL', 'WRITE')
  // Check scope before looking up the company, so outside-range IDs reveal nothing.
  if (!levelOver(viewer, 'PAYROLL', { companyId: input.companyId, plantId: null, departmentId: null })) throw new ORPCError('NOT_FOUND', { message: 'No payroll company found' })
  assertWholeSlice(viewer, 'PAYROLL', { companyId: input.companyId, plantId: null, departmentId: null }, 'Creating payroll')
  const run = await prisma.$transaction(async tx => {
    const company = await companiesService.getCompany(input.companyId, tx)
    if (!company.isActive || !company.isIndiaPayroll) throw new ORPCError('BAD_REQUEST', { message: 'Choose an active company enabled for India payroll' })
    const period = await attendanceService.getPayrollPeriod(input.payMonth.getUTCFullYear(), input.payMonth.getUTCMonth() + 1, tx)
    if (period.from.getTime() !== input.expectedAttendanceFrom.getTime() || period.to.getTime() !== input.expectedAttendanceTo.getTime()) throw new ORPCError('CONFLICT', { message: 'The attendance cycle changed. Close and reopen New payroll run to review its dates.' })
    if (await payrollRepository.findMonth(input.companyId, input.payMonth, tx)) throw new ORPCError('CONFLICT', { message: 'A payroll run already exists for this company and month. Open it from Payroll runs.' })
    const created = await payrollRepository.create({ companyId: input.companyId, payMonth: input.payMonth, attendanceFrom: period.from, attendanceTo: period.to }, viewer.employeeId, tx)
    // stage 2: the people and their salary copy, in the same transaction
    await peopleService.rebuildCopy({ id: created.id, companyId: input.companyId, attendanceFrom: created.attendanceFrom, attendanceTo: created.attendanceTo }, viewer.employeeId, tx)
    return created
  }, { timeout: 120_000 })
  return { id: run.id }
}
