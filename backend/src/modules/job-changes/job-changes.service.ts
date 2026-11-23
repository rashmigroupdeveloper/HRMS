import { assertAccess } from '#core/auth/access'
import { hasLevelAt, type Placement, SYSTEM_SCOPE, scopeOf } from '#core/auth/scope'
import { env } from '#core/config/env'
import { prisma, SYSTEM_ACTOR, type ActorId, type ApprovalKind, type DbClient, type JobChangeKind, type Prisma } from '#core/db/prisma'
import { writeWorkbook } from '#core/excel/workbook'
import { deleteFile } from '#core/storage/file-storage'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { approvalsService } from '#modules/approvals'
import { employeesSchemas, employeesService, jobHistoryService } from '#modules/employees'
import { employeeLettersService } from '#modules/employee-letters'
import { companiesService, salaryComponentsService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as jobChangesRepository from './job-changes.repository.js'
import type { ChangeRow } from './job-changes.repository.js'
import type { cancelJobChangeInput, createJobChangeInput, exportJobChangesInput, listJobChangesInput } from './job-changes.schema.js'

// Job changes through approval (the user, 2026-11-20): HR asks for a promotion, transfer, redesignation, change of
// manager... from a day on, with a reason. It goes through the approval chain(s) (modules/approvals - registered below),
// and once approved it applies on its day: today or earlier at once, a later day by the daily job. Until it applies it is
// only a request here; applying changes the employee and writes the timeline entry (employees' jobHistoryService).
// One open request per employee at a time. Asked with Employees Edit covering the employee (a move: also where they go);
// seen with Employees View covering them.

type JobDetails = jobHistoryService.JobDetails
type JobField = jobHistoryService.JobField
const { JOB_FIELDS } = jobHistoryService
const fullName = employeesService.fullName

export const FIELD_LABEL: Record<JobField, string> = {
  plantId: 'Plant',
  departmentId: 'Department',
  workLocationId: 'Work location',
  designationId: 'Designation',
  gradeId: 'Grade',
  positionId: 'Position',
  costCenterId: 'Cost centre',
  reportingManagerId: 'Reporting manager',
  functionalManagerId: 'Functional manager',
  employmentType: 'Employment type',
  workforceCategory: 'Workforce',
}
export const KIND_LABEL: Record<JobChangeKind, string> = {
  JOINING: 'Joining',
  PROMOTION: 'Promotion',
  TRANSFER: 'Transfer',
  COMPANY_TRANSFER: 'Company transfer',
  REDESIGNATION: 'Redesignation',
  MANAGER_CHANGE: 'Change of manager',
  SALARY_REVISION: 'Salary revision',
  SALARY_CORRECTION: 'Salary correction',
  OTHER: 'Other',
}
const STATUS_LABEL = { PENDING: 'Waiting for approval', APPROVED: 'Approved', APPLIED: 'In force', REJECTED: 'Rejected', CANCELLED: 'Cancelled' } as const

const day = (date: Date) => date.toISOString().slice(0, 10)
const placementOf = (r: Pick<ChangeRow, 'employee'>): Placement => ({ companyId: r.employee.companyId, plantId: r.employee.plantId, departmentId: r.employee.departmentId })
const refOf = (r: Pick<ChangeRow, 'employee'>) => ({ employeeCode: r.employee.employeeCode, ...placementOf(r) })
const SALARY_KINDS: JobChangeKind[] = ['SALARY_REVISION', 'SALARY_CORRECTION']
// why the salary changed, from the kind of change
const SALARY_REASON = { PROMOTION: 'PROMOTION', SALARY_REVISION: 'INCREMENT', SALARY_CORRECTION: 'CORRECTION' } as const
const salaryReasonOf = (kind: JobChangeKind) => (kind in SALARY_REASON ? SALARY_REASON[kind as keyof typeof SALARY_REASON] : 'OTHER')

type SalaryInput = NonNullable<z.infer<typeof createJobChangeInput>['salary']>

// The rules of a new salary from a day (asked, and again when it applies): a correction replaces the salary of exactly
// that day; any other starts after the latest salary and not before joining; the breakup is complete and active
async function checkSalary(employeeId: number, kind: JobChangeKind, effectiveFrom: Date, dateOfJoining: Date, salary: { annualCtc: number; lines: { salaryComponentId: number; monthlyAmount: number }[] }, ownRowAllowed = false) {
  const salaries = await employeesService.listSalaries(employeeId)
  if (kind === 'SALARY_CORRECTION') {
    if (!salaries.some((row) => row.effectiveFrom.getTime() === effectiveFrom.getTime())) {
      throw new ORPCError('BAD_REQUEST', { message: `A correction is for a salary already saved - there is none from ${day(effectiveFrom)}` })
    }
  } else {
    const latest = salaries[0]
    if (effectiveFrom < dateOfJoining) throw new ORPCError('BAD_REQUEST', { message: `The salary cannot start before the date of joining (${day(dateOfJoining)})` })
    if (latest && effectiveFrom <= latest.effectiveFrom && !(ownRowAllowed && effectiveFrom.getTime() === latest.effectiveFrom.getTime())) {
      throw new ORPCError('BAD_REQUEST', { message: `The new salary must start after the latest one (${day(latest.effectiveFrom)}) - to fix that one, ask for a salary correction` })
    }
  }
  await salaryComponentsService.checkBreakup(salary.lines, salary.annualCtc)
}

// A shown value: the two kinds are codes - in words
function shown(field: JobField, value: string | null) {
  if (value === null) return null
  if (field === 'employmentType') return employeesSchemas.EMPLOYMENT_TYPE_LABEL[value as keyof typeof employeesSchemas.EMPLOYMENT_TYPE_LABEL] ?? value
  if (field === 'workforceCategory') return employeesSchemas.WORKFORCE_LABEL[value as keyof typeof employeesSchemas.WORKFORCE_LABEL] ?? value
  return value
}

// The details as they will be: the base with the request's changed fields
function merged(base: JobDetails, r: Pick<ChangeRow, 'changedFields'> & Partial<Record<JobField, unknown>>): JobDetails {
  const next = { ...base }
  for (const field of r.changedFields as JobField[]) Object.assign(next, { [field]: r[field] ?? null })
  return next
}

// --- Ask ---

export async function createJobChange(input: z.infer<typeof createJobChangeInput>, viewer: CurrentUser) {
  const employee = await employeesService.getEmployeeFor(viewer, input.employeeCode)
  // for others only (the user, 2026-11-21): a change of one's own job or salary is asked for by someone who looks after them
  if (employee.id === viewer.employeeId) throw new ORPCError('FORBIDDEN', { message: 'You cannot ask for a change of your own job or salary - someone who looks after you asks for it' })
  if (employee.status === 'EXITED') throw new ORPCError('BAD_REQUEST', { message: `${employee.employeeCode} has left` })

  const open = await jobChangesRepository.findOpen(employee.id)
  if (open) {
    throw new ORPCError('CONFLICT', {
      message: `${employee.employeeCode} already has a job change ${open.status === 'PENDING' ? 'waiting for approval' : `approved for ${day(open.effectiveFrom)}`} - it must be decided, applied or cancelled first`,
    })
  }
  const now = (await jobHistoryService.currentJob(employee.id))!
  const base = now.details
  // a company transfer: same record, the next code of the new company's series when it applies (2026-11-20)
  const toCompany = input.companyId !== undefined && input.companyId !== now.companyId ? input.companyId : null
  if (input.kind === 'COMPANY_TRANSFER' && toCompany === null) throw new ORPCError('BAD_REQUEST', { message: 'Pick the company they move to' })
  if (toCompany !== null && input.kind !== 'COMPANY_TRANSFER') throw new ORPCError('BAD_REQUEST', { message: 'A move to another company is a company transfer' })
  if (toCompany !== null) {
    if (input.plantId === undefined || input.departmentId === undefined) throw new ORPCError('BAD_REQUEST', { message: 'Pick the plant and department of the new company' })
    const company = await companiesService.getCompany(toCompany)
    if (!company.isActive) throw new ORPCError('BAD_REQUEST', { message: `${company.name} is no longer active` })
    if (company.nextEmployeeNumber === null) {
      throw new ORPCError('BAD_REQUEST', { message: `${company.name} has no employee code series yet - set its next employee number on the Organization page first` })
    }
  }
  const companyAfter = toCompany ?? now.companyId
  const next: JobDetails = { ...base }
  for (const field of ['plantId', 'departmentId', 'workLocationId', 'designationId', 'gradeId', 'positionId', 'costCenterId', 'employmentType', 'workforceCategory'] as const) {
    if (input[field] !== undefined) Object.assign(next, { [field]: input[field] })
  }
  if (input.reportingManagerCode !== undefined) {
    next.reportingManagerId = input.reportingManagerCode === null ? null : await employeesService.resolveReportingManager(input.reportingManagerCode, employee.id)
  }
  if (input.functionalManagerCode !== undefined) {
    next.functionalManagerId = input.functionalManagerCode === null ? null : await employeesService.resolveFunctionalManager(input.functionalManagerCode, employee.id)
  }
  // a cost centre belongs to one company: kept across a company transfer only if a new one is picked
  if (toCompany !== null && input.costCenterId === undefined) next.costCenterId = null
  const changedFields = JOB_FIELDS.filter((f) => next[f] !== base[f])
  const salaryKind = SALARY_KINDS.includes(input.kind)
  if (!changedFields.length && !input.salary && toCompany === null) throw new ORPCError('BAD_REQUEST', { message: 'Nothing changes - pick at least one new detail' })
  if (salaryKind && changedFields.length) throw new ORPCError('BAD_REQUEST', { message: `A ${KIND_LABEL[input.kind].toLowerCase()} changes the salary only - ask for job details as a promotion or another kind` })
  if (salaryKind && !input.salary) throw new ORPCError('BAD_REQUEST', { message: 'Give the new salary' })
  if (!changedFields.length && !salaryKind) throw new ORPCError('BAD_REQUEST', { message: 'A salary change alone is a salary revision (or a salary correction)' })
  if (changedFields.length) {
    // a job change follows the latest timeline entry (every employee has the joining entry)
    const after = now.latestEntryFrom ?? now.dateOfJoining
    if (input.effectiveFrom <= after) {
      throw new ORPCError('BAD_REQUEST', {
        message: now.latestEntryFrom ? `The change must apply after the latest entry of the job timeline (${day(after)})` : `The change must apply after the date of joining (${day(after)})`,
      })
    }
    await jobHistoryService.checkJobChange(employee.id, companyAfter, toCompany !== null ? { ...base, plantId: 0, departmentId: 0 } : base, next)
  }
  let salary: (SalaryInput & { currency: string }) | null = null
  if (input.salary) {
    // the salary is confidential: "Request salary changes" Edit, and Employee · Salary View to start from the salary in force,
    // covering the employee (their own area since 2026-11-21)
    const at = employeesService.placementOf(employee)
    if (!hasLevelAt(viewer, 'SALARY_CHANGE_REQUEST', at, 'WRITE') || !hasLevelAt(viewer, 'SALARY', at, 'READ')) {
      throw new ORPCError('FORBIDDEN', { message: 'Asking for a salary change needs "Request salary changes": Edit and Employee · Salary: View for the employee' })
    }
    await checkSalary(employee.id, input.kind, input.effectiveFrom, now.dateOfJoining, input.salary)
    salary = { ...input.salary, currency: input.salary.currency ?? (await employeesService.listSalaries(employee.id))[0]?.currency ?? 'INR' }
  }
  // the job part: "Request job changes" Edit where they are - and, for a move, where they go (its approvers must cover both
  // too); its own area since 2026-11-21, apart from Employees Edit
  const moves = toCompany !== null || next.plantId !== base.plantId || next.departmentId !== base.departmentId
  const target: Placement = { companyId: companyAfter, plantId: next.plantId, departmentId: next.departmentId }
  if (changedFields.length || toCompany !== null) employeesService.assertCanChange(viewer, employee, 'JOB_CHANGE_REQUEST', moves ? target : undefined)

  const kinds: ApprovalKind[] = [...(changedFields.length ? (['JOB_CHANGE'] as const) : []), ...(salary ? (['SALARY_REVISION'] as const) : [])]
  // never the figures - the summary shows in lists and e-mails
  const what = [...(toCompany !== null ? ['Company'] : []), ...changedFields.map((f) => FIELD_LABEL[f]), ...(salary ? ['Salary'] : [])].join(', ')
  const summary = `${KIND_LABEL[input.kind]} from ${day(input.effectiveFrom)}: ${what}`
  const created = await prisma.$transaction(async (tx) => {
    const approval = await approvalsService.raiseRequest(
      { feature: 'JOB_CHANGE', kinds, employeeId: employee.id, requestedById: viewer.employeeId, summary, target: moves ? target : null },
      tx,
    )
    const record = await jobChangesRepository.create(
      {
        employeeId: employee.id,
        approvalRequestId: approval.id,
        effectiveFrom: input.effectiveFrom,
        kind: input.kind,
        reason: input.reason,
        companyId: toCompany,
        changedFields,
        ...Object.fromEntries(changedFields.map((f) => [f, next[f]])),
      },
      viewer.employeeId,
      tx,
    )
    if (salary) {
      await jobChangesRepository.createSalary(
        record.id,
        { annualCtc: salary.annualCtc, performancePayAnnual: salary.performancePayAnnual ?? null, currency: salary.currency, lines: salary.lines },
        viewer.employeeId,
        tx,
      )
    }
    return { approval, id: record.id }
  })
  await approvalsService.finishAndNotify(created.approval.id, created.approval.outcome)
  return getJobChange(viewer, created.id)
}

// --- The approval's decision (approvals calls these) ---

async function recordOf(requestId: number, db: DbClient) {
  const record = await jobChangesRepository.findByApprovalRequestId(requestId, db)
  if (!record) throw new Error(`No job change for approval request ${requestId}`)
  return record
}

approvalsService.registerFeature('JOB_CHANGE', {
  label: 'Job change',
  // approved: it waits for its day - applied right after the decision is saved when the day has come (afterClosed), else
  // by the daily job
  onApproved: async (requestId, actorId, tx) => {
    const record = await recordOf(requestId, tx)
    await jobChangesRepository.update(record.id, { status: 'APPROVED' }, actorId, tx)
  },
  onRejected: async (requestId, actorId, tx) => {
    const record = await recordOf(requestId, tx)
    await jobChangesRepository.update(record.id, { status: 'REJECTED' }, actorId, tx)
  },
  onCancelled: async (requestId, actorId, tx, reason) => {
    const record = await recordOf(requestId, tx)
    await jobChangesRepository.update(record.id, { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: actorId, cancelReason: reason }, actorId, tx)
  },
  afterClosed: async (requestId, status) => {
    if (status !== 'APPROVED') return
    const record = await jobChangesRepository.findByApprovalRequestId(requestId)
    if (record && record.effectiveFrom <= today()) await applyNow(record.id, SYSTEM_ACTOR)
  },
  canView: (viewer, placement) => hasLevelAt(viewer, 'EMPLOYEES', placement, 'READ'),
  canCancel: (viewer, placement) => hasLevelAt(viewer, 'EMPLOYEES', placement, 'WRITE'),
  link: (employeeCode) => `/employees/${employeeCode}?tab=job`,
})

// --- Apply (on its day) ---

// The change was applied or cancelled by someone else while this apply ran - everything it wrote is undone, quietly
class AlreadyHandled extends Error {}

// Applies an approved change whose day has come, in a transaction of its own - everything checked again first. One that
// cannot be applied stays approved with the reason (applyError); the daily job tries it again.
export async function applyNow(id: number, actorId: ActorId) {
  // a company transfer moves the employee's files: the old ones are deleted once the change is saved, the copies if it fails
  const files = { oldKeys: [] as string[], newKeys: [] as string[] }
  let applied: boolean
  try {
    applied = await prisma.$transaction(async (tx) => {
      const record = await jobChangesRepository.findById(id, tx)
      if (!record || record.status !== 'APPROVED') return false
      if (record.employee.status === 'EXITED') throw new ORPCError('BAD_REQUEST', { message: 'The employee has left' })
      const now = (await jobHistoryService.currentJob(record.employeeId, tx))!
      let before: Prisma.InputJsonValue | undefined
      if (record.changedFields.length || record.companyId !== null) {
        const next = merged(now.details, record)
        const toCompany = record.companyId !== null && record.companyId !== now.companyId ? record.companyId : null
        await jobHistoryService.checkJobChange(record.employeeId, toCompany ?? now.companyId, toCompany !== null ? { ...now.details, plantId: 0, departmentId: 0 } : now.details, next, tx)
        const result = await jobHistoryService.applyJobChange(
          record.employeeId,
          { details: next, companyId: toCompany, effectiveFrom: record.effectiveFrom, kind: record.kind, note: record.reason, jobChangeRequestId: record.id },
          actorId,
          tx,
        )
        files.oldKeys.push(...result.files.oldKeys)
        files.newKeys.push(...result.files.newKeys)
        if (result.codeChanged) {
          const letters = await employeeLettersService.moveFilesToCode(record.employeeId, result.employeeCode, actorId, tx)
          files.oldKeys.push(...letters.oldKeys)
          files.newKeys.push(...letters.newKeys)
        }
        before = result.before
      }
      if (record.salary) {
        const salary = { annualCtc: record.salary.annualCtc, lines: record.salary.lines.map((l) => ({ salaryComponentId: l.salaryComponent.id, monthlyAmount: l.monthlyAmount })) }
        await checkSalary(record.employeeId, record.kind, record.effectiveFrom, now.dateOfJoining, salary)
        const approval = (await approvalsService.statusOf([record.approvalRequestId])).get(record.approvalRequestId)
        await employeesService.saveSalary(
          record.employeeId,
          {
            effectiveFrom: record.effectiveFrom,
            annualCtc: record.salary.annualCtc,
            performancePayAnnual: record.salary.performancePayAnnual,
            currency: record.salary.currency,
            reason: salaryReasonOf(record.kind),
            jobChangeRequestId: record.id,
            approvedAt: approval?.closedAt ?? null,
            approvedById: approval?.closedById ?? null,
            lines: salary.lines,
          },
          record.kind === 'SALARY_CORRECTION',
          actorId,
          tx,
        )
      }
      // still approved now that everything above is written (cancelled or applied by someone else in the meantime: undo it all)
      const marked = await jobChangesRepository.updateIfStatus(record.id, 'APPROVED', { status: 'APPLIED', appliedAt: new Date(), appliedById: actorId, applyError: null, before }, actorId, tx)
      if (!marked) throw new AlreadyHandled()
      return true
    })
  } catch (error) {
    // nothing was saved: the copies go, the reason is kept
    for (const key of files.newKeys) await deleteFile(key).catch(() => undefined)
    if (error instanceof AlreadyHandled) return false
    const message = error instanceof Error ? error.message : String(error)
    // only on a change still waiting to be applied (never "not applied because" on one applied or cancelled meanwhile)
    await jobChangesRepository.updateIfStatus(id, 'APPROVED', { applyError: message }, actorId).catch(() => undefined)
    return false
  }
  // saved - what follows never undoes it (the rows point at the copies now)
  for (const key of files.oldKeys) await deleteFile(key).catch((error: unknown) => console.error('[job-changes] old file not deleted:', key, error))
  if (applied) await notifyEmployee(id).catch((error: unknown) => console.error('[job-changes] the employee was not told:', error))
  return applied
}

// The daily job (jobChanges.applyDue): every approved change whose day has come; the employee left: cancelled
export async function applyDue() {
  let applied = 0
  let cancelled = 0
  const failed: string[] = []
  for (const record of await jobChangesRepository.listDue(today())) {
    if (record.employee.status === 'EXITED') {
      // only while still approved (not over one applied or cancelled a moment before)
      if (await jobChangesRepository.updateIfStatus(record.id, 'APPROVED', { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: SYSTEM_ACTOR, cancelReason: 'The employee has left' }, SYSTEM_ACTOR)) cancelled++
      continue
    }
    if (await applyNow(record.id, SYSTEM_ACTOR)) applied++
    else failed.push(`#${record.id}`)
  }
  const done = `${applied} applied, ${cancelled} cancelled (employee left)`
  return failed.length ? `${done}; ${failed.length} could not be applied (${failed.join(', ')}) - see their reason` : done
}

// Tells the employee what changed and from when (work e-mail, else personal)
async function notifyEmployee(id: number) {
  const record = await jobChangesRepository.findById(id)
  const to = record && (record.employee.workEmail ?? record.employee.personalEmail)
  if (!record || !to) return
  const changes = await changesOf(record)
  const lines = [
    ...changes.map((c) => `${c.label}: ${c.from ?? '-'} -> ${c.to ?? '-'}`),
    // never the figures by e-mail
    ...(record.salary ? [`Your salary is revised from ${day(record.effectiveFrom)} - see the Salary tab of your profile.`] : []),
  ]
  await sendMail({
    to,
    subject: record.changedFields.length ? `Your job details change from ${day(record.effectiveFrom)}` : `Your salary is revised from ${day(record.effectiveFrom)}`,
    text: [`Dear ${fullName(record.employee)},`, '', `${KIND_LABEL[record.kind]} from ${day(record.effectiveFrom)}:`, ...lines, '', `Your profile: ${env.APP_URL}/me`].join('\n'),
  }).catch((error: unknown) => console.error('[mail] job change e-mail failed:', error))
  await jobChangesRepository.update(id, { notifiedAt: new Date(), notifiedById: SYSTEM_ACTOR }, SYSTEM_ACTOR)
}

// --- Read ---

// What changes, as shown: from (in force just before it applied; now, while not applied) -> to
async function changesOf(record: ChangeRow) {
  const now = (await jobHistoryService.currentJob(record.employeeId))!
  const to = await jobHistoryService.describeJob(merged(now.details, record))
  const before = record.before as (Record<JobField, string | null> & { company?: string; employeeCode?: string }) | null
  const from = before ?? (await jobHistoryService.describeJob(now.details))
  const rows: { field: JobField | 'companyId'; label: string; from: string | null; to: string | null }[] = (record.changedFields as JobField[]).map((field) => ({
    field,
    label: FIELD_LABEL[field],
    from: shown(field, from[field] ?? null),
    to: shown(field, to[field] ?? null),
  }))
  if (record.companyId !== null) {
    const company = (id: number) => companiesService.getCompany(id).then((c) => `${c.name} (${c.code})`)
    rows.unshift({ field: 'companyId', label: 'Company', from: before?.company ?? (await company(now.companyId)), to: await company(record.companyId) })
  }
  return rows
}

// The viewer sees the change: Employees View covering the employee, or they raised / decide / decided its approval; the
// employee themselves whatever its status (the user, 2026-11-21: their "Overview" shows the changes asked for them)
async function canSee(viewer: CurrentUser, record: ChangeRow) {
  if (hasLevelAt(viewer, 'EMPLOYEES', placementOf(record), 'READ')) return true
  if (record.employeeId === viewer.employeeId) return true
  return approvalsService.canSeeRequest(viewer, record.approvalRequestId)
}

async function getVisible(viewer: CurrentUser, id: number) {
  const record = await jobChangesRepository.findById(id)
  if (!record || !(await canSee(viewer, record))) throw new ORPCError('NOT_FOUND', { message: `No job change found with id ${id}` })
  return record
}

// The proposed salary, for those who may see it: approvers on a step set to see it, or Employee · Salary View covering the
// employee (the employee themselves once in force) - with the salary it replaces, and the change in %
async function salaryOf(viewer: CurrentUser, record: ChangeRow) {
  if (!record.salary) return { salary: null, salaryHidden: false }
  const sees = (await approvalsService.seesConfidential(viewer, record.approvalRequestId)) || employeesService.seesPart(viewer, refOf(record), 'SALARY')
  if (!sees) return { salary: null, salaryHidden: true }
  const salaries = await employeesService.listSalaries(record.employeeId)
  // the one it replaces: a correction's own day (before it applied), else the latest before its day
  const replaced =
    record.kind === 'SALARY_CORRECTION'
      ? record.status === 'APPLIED'
        ? null
        : salaries.find((row) => row.effectiveFrom.getTime() === record.effectiveFrom.getTime())
      : salaries.find((row) => row.effectiveFrom < record.effectiveFrom)
  const proposed = record.salary
  return {
    salary: {
      annualCtc: proposed.annualCtc,
      performancePayAnnual: proposed.performancePayAnnual,
      currency: proposed.currency,
      lines: proposed.lines,
      replaced: replaced ? { effectiveFrom: replaced.effectiveFrom, annualCtc: replaced.annualCtc, performancePayAnnual: replaced.performancePayAnnual, currency: replaced.currency, lines: replaced.lines } : null,
      changePercent: replaced && replaced.annualCtc > 0 ? Math.round(((proposed.annualCtc - replaced.annualCtc) / replaced.annualCtc) * 1000) / 10 : null,
    },
    salaryHidden: false,
  }
}

export async function getJobChange(viewer: CurrentUser, id: number) {
  const record = await getVisible(viewer, id)
  const person = await employeesService.lookupPeople([record.createdById, record.appliedById, record.cancelledById])
  const approval = (await approvalsService.statusOf([record.approvalRequestId])).get(record.approvalRequestId) ?? null
  const mayChange = hasLevelAt(viewer, 'EMPLOYEES', placementOf(record), 'WRITE')
  return {
    id: record.id,
    employee: { employeeCode: record.employee.employeeCode, name: fullName(record.employee) },
    effectiveFrom: record.effectiveFrom,
    kind: record.kind,
    kindLabel: KIND_LABEL[record.kind],
    reason: record.reason,
    status: record.status,
    statusLabel: STATUS_LABEL[record.status],
    changes: await changesOf(record),
    ...(await salaryOf(viewer, record)),
    applyError: record.applyError,
    appliedAt: record.appliedAt,
    appliedBy: person(record.appliedById),
    cancelledAt: record.cancelledAt,
    cancelledBy: person(record.cancelledById),
    cancelReason: record.cancelReason,
    raisedAt: record.createdAt,
    requestedBy: person(record.createdById),
    approvalRequestId: record.approvalRequestId,
    approval,
    canCancel: (record.status === 'PENDING' && (mayChange || record.createdById === viewer.employeeId)) || (record.status === 'APPROVED' && mayChange),
  }
}

// One change by its id or by its approval request's id
export async function getJobChangeBy(viewer: CurrentUser, input: { id?: number | undefined; approvalRequestId?: number | undefined }) {
  if (input.id !== undefined) return getJobChange(viewer, input.id)
  const record = await jobChangesRepository.findByApprovalRequestId(input.approvalRequestId!)
  if (!record) throw new ORPCError('NOT_FOUND', { message: 'No job change found for that approval request' })
  return getJobChange(viewer, record.id)
}

async function toRows(rows: ChangeRow[]) {
  const person = await employeesService.lookupPeople(rows.map((r) => r.createdById))
  const approvals = await approvalsService.statusOf(rows.map((r) => r.approvalRequestId))
  return rows.map((r) => ({
    id: r.id,
    employee: { employeeCode: r.employee.employeeCode, name: fullName(r.employee) },
    effectiveFrom: r.effectiveFrom,
    kind: r.kind,
    kindLabel: KIND_LABEL[r.kind],
    reason: r.reason,
    status: r.status,
    statusLabel: STATUS_LABEL[r.status],
    changed: [...(r.companyId !== null ? ['Company'] : []), ...(r.changedFields as JobField[]).map((f) => FIELD_LABEL[f])],
    // a salary change is part of it (the figures only on the change itself, for those who may see them)
    hasSalary: r.salary !== null,
    applyError: r.applyError,
    raisedAt: r.createdAt,
    requestedBy: person(r.createdById),
    approval: approvals.get(r.approvalRequestId) ?? null,
  }))
}

// The job changes of the employees inside the viewer's Employees View data access - all, or one employee's; or the
// viewer's own: asked for them (ABOUT_ME) or asked by them (ASKED_BY_ME) - relationships, not rows (SYSTEM_SCOPE with the
// viewer's own id, never an id from the request)
export async function listJobChanges(viewer: CurrentUser, input: z.infer<typeof listJobChangesInput>) {
  const filter = input?.mine ? ownFilter(viewer, input.mine, input) : await filterOf(viewer, input)
  const page = input?.page ?? 1
  const pageSize = input?.pageSize ?? 50
  const { rows, total } = await jobChangesRepository.list(filter, { skip: (page - 1) * pageSize, take: pageSize })
  return { items: await toRows(rows), total, page, pageSize }
}

function ownFilter(viewer: CurrentUser, mine: 'ABOUT_ME' | 'ASKED_BY_ME', input: z.infer<typeof exportJobChangesInput>): jobChangesRepository.ChangeFilter {
  if (input?.employeeCode) throw new ORPCError('BAD_REQUEST', { message: 'Give either mine or employeeCode, not both' })
  return {
    scope: SYSTEM_SCOPE,
    ...(mine === 'ABOUT_ME' ? { employeeId: viewer.employeeId } : { requestedById: viewer.employeeId }),
    statuses: input?.statuses,
    kinds: input?.kinds,
    companyIds: input?.companyIds,
    from: input?.from,
    to: input?.to,
  }
}

async function filterOf(viewer: CurrentUser, input: z.infer<typeof exportJobChangesInput>): Promise<jobChangesRepository.ChangeFilter> {
  assertAccess(viewer.access, 'EMPLOYEES', 'READ')
  const employee = input?.employeeCode ? await employeesService.getEmployeeFor(viewer, input.employeeCode) : null
  return {
    scope: scopeOf(viewer, 'EMPLOYEES', 'READ'),
    employeeId: employee?.id,
    statuses: input?.statuses,
    kinds: input?.kinds,
    companyIds: input?.companyIds,
    from: input?.from,
    to: input?.to,
  }
}

// The same list as an Excel file
export async function exportJobChanges(viewer: CurrentUser, input: z.infer<typeof exportJobChangesInput>) {
  const { rows } = await jobChangesRepository.list(await filterOf(viewer, input), { skip: 0, take: 20_000 })
  const items = await toRows(rows)
  const bytes = await writeWorkbook([
    {
      name: 'Job changes',
      columns: [
        { header: 'Employee code', key: 'code', width: 14 },
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Kind', key: 'kind', width: 18 },
        { header: 'From', key: 'from', date: true, width: 13 },
        { header: 'What changes', key: 'changed', width: 36 },
        { header: 'Reason', key: 'reason', width: 36 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Waiting for', key: 'waiting', width: 26 },
        { header: 'Not applied because', key: 'error', width: 30 },
        { header: 'Asked by', key: 'by', width: 22 },
        { header: 'Asked on', key: 'on', dateTime: true, width: 17 },
      ],
      rows: items.map((r) => ({
        code: r.employee.employeeCode,
        name: r.employee.name,
        kind: r.kindLabel,
        from: r.effectiveFrom,
        changed: [...r.changed, ...(r.hasSalary ? ['Salary'] : [])].join(', '),
        reason: r.reason,
        status: r.statusLabel,
        waiting: r.approval?.step ? `Step ${r.approval.step.stepNo} of ${r.approval.step.of}: ${r.approval.step.approver?.name ?? r.approval.step.who}` : (r.approval?.held ?? ''),
        error: r.applyError ?? '',
        by: r.requestedBy?.name ?? '',
        on: r.raisedAt,
      })),
    },
  ])
  return new File([new Uint8Array(bytes)], `job-changes-${day(today())}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// --- Cancel ---

// Waiting for approval: its approval is cancelled (the requester, or Employees Edit covering the employee). Approved and
// waiting for its day (or not applied): Employees Edit covering the employee.
export async function cancelJobChange(viewer: CurrentUser, { id, reason }: z.infer<typeof cancelJobChangeInput>) {
  const record = await getVisible(viewer, id)
  if (record.status === 'PENDING') {
    await approvalsService.cancel(viewer, { id: record.approvalRequestId, reason })
    return getJobChange(viewer, id)
  }
  if (record.status !== 'APPROVED') throw new ORPCError('CONFLICT', { message: `This change is ${STATUS_LABEL[record.status].toLowerCase()} - it cannot be cancelled` })
  if (!hasLevelAt(viewer, 'EMPLOYEES', placementOf(record), 'WRITE')) throw new ORPCError('FORBIDDEN', { message: 'Cancelling an approved change needs Employees: Edit for the employee' })
  const cancelled = await jobChangesRepository.updateIfStatus(
    id,
    'APPROVED',
    { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: viewer.employeeId, cancelReason: reason ?? null },
    viewer.employeeId,
  )
  if (!cancelled) throw new ORPCError('CONFLICT', { message: 'This change was applied a moment ago - it cannot be cancelled now' })
  return getJobChange(viewer, id)
}
