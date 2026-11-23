import type { ActorId, DbClient, JobChangeKind } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { companiesService, plantsService } from '#modules/organization'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as employeesRepository from '../employees.repository.js'
import * as documentsService from '../documents/documents.service.js'
import { assertCostCenter, assertMastersInUse, assertNoReportingLoop, ensureFirstJobRecord, fullName, getEmployeeFor, hodPostOf, lookupPeople, takeEmployeeCode } from '../employees.service.js'
import * as jobHistoryRepository from './job-history.repository.js'
import { JOB_FIELDS, type JobDetails, type JobField, jobDetailsOf } from './job-history.repository.js'
import type { jobAsOfInput } from './job-history.schema.js'

// The job timeline (the user, 2026-11-19): an employee's job details from a day on. The first entry is the joining; the
// others are job changes approved and applied (modules/job-changes, 2026-11-20 - a change not yet in force is a request
// there, not an entry here). The employee row always holds the details in force today. Seen by the employee themselves
// and by "Employee · Directory & job" View covering them. The salary is not part of it (its own history).

export type { JobDetails, JobField }
export { JOB_FIELDS, jobDetailsOf }

const day = (date: Date) => date.toISOString().slice(0, 10)

// --- Read ---

type NamedRecord = Awaited<ReturnType<typeof jobHistoryRepository.listNamed>>[number]
const DISPLAY: Record<JobField, (r: NamedRecord) => string | null> = {
  plantId: (r) => `${r.plant.plantCode} · ${r.plant.name}`,
  departmentId: (r) => r.department.name,
  workLocationId: (r) => r.workLocation?.name ?? null,
  designationId: (r) => r.designation?.name ?? null,
  gradeId: (r) => r.grade?.name ?? null,
  positionId: (r) => r.position?.name ?? null,
  costCenterId: (r) => (r.costCenter ? `${r.costCenter.code} · ${r.costCenter.name}` : null),
  reportingManagerId: (r) => (r.reportingManager ? `${fullName(r.reportingManager)} (${r.reportingManager.employeeCode})` : null),
  functionalManagerId: (r) => (r.functionalManager ? `${fullName(r.functionalManager)} (${r.functionalManager.employeeCode})` : null),
  employmentType: (r) => r.employmentType,
  workforceCategory: (r) => r.workforceCategory,
}
const shown = (r: NamedRecord) => Object.fromEntries(JOB_FIELDS.map((f) => [f, DISPLAY[f](r)])) as Record<JobField, string | null>

// The employee's timeline, latest first: each entry's details as shown (names, not ids) and which of them changed from
// the entry before. Own record, or Employees View covering them - else NOT_FOUND.
export async function listJobHistory(viewer: CurrentUser, employeeCode: string) {
  const employee = await getEmployeeFor(viewer, employeeCode)
  const rows = await jobHistoryRepository.listNamed(employee.id)
  const person = await lookupPeople(rows.map((r) => r.createdById))
  return rows.map((r, index) => {
    const before = rows[index + 1]
    return {
      id: r.id,
      effectiveFrom: r.effectiveFrom,
      kind: r.kind,
      note: r.note,
      jobChangeRequestId: r.jobChangeRequestId,
      // the company and employee code from that day (a company transfer changes both - 2026-11-20)
      company: r.company,
      employeeCode: r.employeeCode,
      enteredAt: r.createdAt,
      enteredBy: person(r.createdById),
      details: shown(r),
      changed: before ? JOB_FIELDS.filter((f) => r[f] !== before[f]) : [],
    }
  })
}

// The job details in force on a day (2026-11-20 - "as of a date"): the latest entry from that day or before; null before
// the employee joined. Own record, or Employees View covering them.
export async function jobAsOf(viewer: CurrentUser, { employeeCode, date }: z.infer<typeof jobAsOfInput>) {
  const employee = await getEmployeeFor(viewer, employeeCode)
  const row = await jobHistoryRepository.findNamedOn(employee.id, date)
  return row ? { date, entryFrom: row.effectiveFrom, kind: row.kind, company: row.company, employeeCode: row.employeeCode, details: shown(row) } : null
}

// The details as shown, for any set of job details (names, not ids) - a job change shows old -> new with these
export async function describeJob(details: JobDetails, db?: DbClient) {
  const n = await jobHistoryRepository.findNames(details, db)
  const person = (p: { employeeCode: string; firstName: string; middleName: string | null; lastName: string | null } | null) => (p ? `${fullName(p)} (${p.employeeCode})` : null)
  return {
    plantId: n.plant ? `${n.plant.plantCode} · ${n.plant.name}` : null,
    departmentId: n.department?.name ?? null,
    workLocationId: n.workLocation?.name ?? null,
    designationId: n.designation?.name ?? null,
    gradeId: n.grade?.name ?? null,
    positionId: n.position?.name ?? null,
    costCenterId: n.costCenter ? `${n.costCenter.code} · ${n.costCenter.name}` : null,
    reportingManagerId: person(n.reportingManager),
    functionalManagerId: person(n.functionalManager),
    employmentType: details.employmentType,
    workforceCategory: details.workforceCategory,
  } satisfies Record<JobField, string | null>
}

// --- For modules/job-changes (a change goes through approval there, and is applied here) ---

// The employee's job details now, their company, date of joining and the day of the latest timeline entry (a change
// must apply after it), or null
export async function currentJob(employeeId: number, db?: DbClient) {
  const employee = await jobHistoryRepository.findEmployeeJob(employeeId, db)
  if (!employee) return null
  const latest = (await jobHistoryRepository.list(employeeId, db)).at(-1)
  return { companyId: employee.companyId, dateOfJoining: employee.dateOfJoining, details: jobDetailsOf(employee), latestEntryFrom: latest?.effectiveFrom ?? null }
}

// The rules a change of job details must keep - when asked and again on the day it applies: the department runs at the
// plant (a newly chosen plant / department active), the cost centre is the company's (and active when newly chosen), a
// new manager has not left and is not the employee, and the reporting line makes no loop; a newly chosen company,
// department, work location, designation, grade or position is still in use (2026-11-23). Throws BAD_REQUEST.
export async function checkJobChange(employeeId: number, companyId: number, base: JobDetails, next: JobDetails, db?: DbClient) {
  await plantsService.assertPlacement(
    { companyId, plantId: next.plantId, departmentId: next.departmentId },
    { plant: next.plantId !== base.plantId, department: next.departmentId !== base.departmentId },
    db,
  )
  if (next.costCenterId !== null && next.costCenterId !== base.costCenterId) await assertCostCenter(next.costCenterId, companyId, db)
  const anew = (field: 'departmentId' | 'workLocationId' | 'designationId' | 'gradeId' | 'positionId') => (next[field] !== base[field] ? next[field] : null)
  const saved = await jobHistoryRepository.findEmployeeJob(employeeId, db)
  await assertMastersInUse(
    {
      // a company transfer: the new company
      companyId: saved && saved.companyId !== companyId ? companyId : null,
      departmentId: anew('departmentId'),
      workLocationId: anew('workLocationId'),
      designationId: anew('designationId'),
      gradeId: anew('gradeId'),
      positionId: anew('positionId'),
    },
    db,
  )
  for (const [field, what] of [
    ['reportingManagerId', 'reporting manager'],
    ['functionalManagerId', 'functional manager'],
  ] as const) {
    const id = next[field]
    if (id === null || id === base[field]) continue
    if (id === employeeId) throw new ORPCError('BAD_REQUEST', { message: `An employee cannot be their own ${what}` })
    const manager = await employeesRepository.findManagerLinkById(id, db)
    if (!manager) throw new ORPCError('BAD_REQUEST', { message: `The ${what} is no longer an employee` })
    if (manager.status === 'EXITED') throw new ORPCError('BAD_REQUEST', { message: `The ${what} ${manager.employeeCode} has left` })
  }
  if (next.reportingManagerId !== null && next.reportingManagerId !== base.reportingManagerId) await assertNoReportingLoop(next.reportingManagerId, employeeId, db)
}

// Applies an approved change of job details: the employee row takes them (the HOD post follows the placement; made
// permanent, the contract end date is cleared - a permanent employee has none) and the timeline gets its entry, linked
// to the request. A company transfer (`companyId`, 2026-11-20): the next code of the new company's series, the old code
// kept as a former code (it still signs them in and finds them), and their document files moved to the new code's
// folder. Returns the details as shown just before, the code now, and the files moved (the caller deletes the old ones
// once its transaction is saved). Inside the caller's transaction.
export async function applyJobChange(
  employeeId: number,
  change: { details: JobDetails; companyId?: number | null; effectiveFrom: Date; kind: JobChangeKind; note: string; jobChangeRequestId: number },
  actorId: ActorId,
  tx: DbClient,
) {
  const records = await ensureFirstJobRecord(employeeId, actorId, tx)
  const latest = records.at(-1)!
  if (change.effectiveFrom <= latest.effectiveFrom) {
    throw new ORPCError('BAD_REQUEST', { message: `The timeline already has an entry from ${day(latest.effectiveFrom)} - the change must apply after it` })
  }
  const current = (await jobHistoryRepository.findEmployeeJob(employeeId, tx))!
  const company = await companiesService.getCompany(current.companyId, tx)
  const before = { ...(await describeJob(jobDetailsOf(current), tx)), company: `${company.name} (${company.code})`, employeeCode: current.employeeCode }
  const moved = current.plantId !== change.details.plantId || current.departmentId !== change.details.departmentId
  let companyId = current.companyId
  let employeeCode = current.employeeCode
  let files = { oldKeys: [] as string[], newKeys: [] as string[] }
  if (change.companyId != null && change.companyId !== current.companyId) {
    companyId = change.companyId
    employeeCode = await takeEmployeeCode(companyId, actorId, tx)
    const lastDay = new Date(change.effectiveFrom.getTime() - 24 * 60 * 60 * 1000)
    await employeesRepository.createFormerCode(
      { employeeId, employeeCode: current.employeeCode, companyId: current.companyId, usedUntil: lastDay, jobChangeRequestId: change.jobChangeRequestId },
      actorId,
      tx,
    )
    files = await documentsService.moveFilesToCode(employeeId, employeeCode, actorId, tx)
  }
  await employeesRepository.update(
    employeeId,
    {
      ...change.details,
      companyId,
      employeeCode,
      ...(moved && { hodPostId: await hodPostOf(change.details, tx) }),
      ...(change.details.employmentType === 'PERMANENT' && { contractEndDate: null }),
    },
    actorId,
    tx,
  )
  await jobHistoryRepository.create(
    { ...change.details, employeeId, companyId, employeeCode, effectiveFrom: change.effectiveFrom, kind: change.kind, note: change.note, jobChangeRequestId: change.jobChangeRequestId },
    actorId,
    tx,
  )
  return { before, employeeCode, codeChanged: employeeCode !== current.employeeCode, files }
}
