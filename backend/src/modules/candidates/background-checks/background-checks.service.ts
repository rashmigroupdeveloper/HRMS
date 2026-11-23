import type { CurrentUser } from '#core/rpc/procedures'
import type { AccessLevel } from '#core/db/prisma'
import { hasLevelAt } from '#core/auth/scope'
import { sendMail } from '#core/mail/mailer'
import { accountsService } from '#modules/accounts'
import { formatDate } from '#shared/utils/dates'
import type { ActorId, CandidateStatus, DbClient } from '#core/db/prisma'
import { employeeDocumentsService, employeesService } from '#modules/employees'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as candidatesService from '../candidates.service.js'
import * as documentsService from '../documents/documents.service.js'
import * as backgroundChecksRepository from './background-checks.repository.js'
import type { createBackgroundCheckInput, updateBackgroundCheckInput } from './background-checks.schema.js'

// Business rules for background checks (BGV).
// - A check starts only after the candidate's signed consent (a BGV_CONSENT_FORM document, not rejected).
// - People may join while checks are running, so checks stay changeable after the joining day (JOINED).
//   A closed candidate's checks are history.
// - A check belongs to the employee directly (employeeId, 2026-11-15): set on the joining day for the candidate's
//   checks (linkToEmployee) and on checks started after it; a check of an employee created without onboarding has
//   no candidate.
// - A FAILED result does not act by itself: HR decides (withdraw the offer, or the exit process after joining).

// Statuses in which checks can be started / changed
const OPEN_STATUSES: readonly CandidateStatus[] = ['ACCEPTED', 'JOINED']

function requireOpen(status: CandidateStatus) {
  if (!OPEN_STATUSES.includes(status)) {
    throw new ORPCError('CONFLICT', {
      message: `Background checks can be changed only after the offer is accepted; this candidate is ${status}`,
    })
  }
}

type CheckRow = Awaited<ReturnType<typeof backgroundChecksRepository.list>>[number]

// For the API: who started, last changed and recorded the result of each check, as { employeeCode, name }
async function withPeople(rows: CheckRow[]) {
  const person = await employeesService.lookupPeople(rows.flatMap((c) => [c.createdById, c.updatedById, c.completedById]))
  return rows.map(({ createdById, updatedById, completedById, ...c }) => ({
    ...c,
    createdBy: person(createdById),
    updatedBy: person(updatedById),
    completedBy: person(completedById),
  }))
}

async function withPeopleOne(row: CheckRow) {
  const [check] = await withPeople([row])
  return check!
}

// A check can change while its candidate is accepted or joined; one with no candidate (an employee created directly)
// always can
async function requireCheckOpen(check: { candidateId: number | null }) {
  if (check.candidateId !== null) requireOpen((await candidatesService.getCandidate(check.candidateId)).status)
}

// The check, if the viewer's Onboarding access at this level covers its candidate - or, for a check started for an
// employee directly, the employee (data access, 2026-11-18)
async function getCheck(id: number, viewer: CurrentUser, level: AccessLevel) {
  const check = await backgroundChecksRepository.findById(id)
  if (!check) throw new ORPCError('NOT_FOUND', { message: `No background check found with id ${id}` })
  if (check.candidateId !== null) {
    await candidatesService.getCandidateFor(viewer, check.candidateId, level)
  } else {
    const employee = check.employeeId === null ? null : await employeesService.findSummaryById(check.employeeId)
    const at = employee && { companyId: employee.companyId, plantId: employee.plantId, departmentId: employee.departmentId }
    if (!at || !hasLevelAt(viewer, 'ONBOARDING', at, 'READ')) throw new ORPCError('NOT_FOUND', { message: `No background check found with id ${id}` })
    if (level === 'WRITE' && !hasLevelAt(viewer, 'ONBOARDING', at, 'WRITE')) throw new ORPCError('FORBIDDEN', { message: 'You do not have access to change this check' })
  }
  return check
}

export async function listBackgroundChecks(candidateId: number, viewer: CurrentUser) {
  await candidatesService.getCandidateFor(viewer, candidateId)
  return withPeople(await backgroundChecksRepository.list(candidateId))
}

export async function createBackgroundCheck(input: z.infer<typeof createBackgroundCheckInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const candidate = await candidatesService.getCandidateFor(viewer, input.candidateId, 'WRITE')
  requireOpen(candidate.status)
  // After joining, the candidate's documents (with the consent form) belong to the employee
  const hasConsent = candidate.employeeId
    ? await employeeDocumentsService.hasDocument(candidate.employeeId, 'BGV_CONSENT_FORM')
    : await documentsService.hasDocument(input.candidateId, 'BGV_CONSENT_FORM')
  if (!hasConsent) {
    throw new ORPCError('CONFLICT', {
      message: 'Upload the candidate\'s signed BGV consent form (BGV_CONSENT_FORM) before starting a background check',
    })
  }
  // started after joining: it belongs to the employee too
  return withPeopleOne(await backgroundChecksRepository.create({ ...input, employeeId: candidate.employeeId }, actorId))
}

// The joining day (inside its transaction): the candidate's checks belong to the new employee from now on
export function linkToEmployee(candidateId: number, employeeId: number, actorId: ActorId, db?: DbClient) {
  return backgroundChecksRepository.linkToEmployee(candidateId, employeeId, actorId, db)
}

// Records progress or the result. A result (CLEAR / DISCREPANCY / FAILED) sets completedAt; going back to
// IN_PROGRESS clears it (with completedById - who recorded the result). DISCREPANCY and FAILED need remarks saying what was wrong.
export async function updateBackgroundCheck({ id, ...changes }: z.infer<typeof updateBackgroundCheckInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const check = await getCheck(id, viewer, 'WRITE')
  await requireCheckOpen(check)

  const status = changes.status ?? check.status
  const remarks = changes.remarks === undefined ? check.remarks : changes.remarks
  if ((status === 'DISCREPANCY' || status === 'FAILED') && !remarks) {
    throw new ORPCError('BAD_REQUEST', { message: `Give remarks saying what was found (${status})` })
  }

  const statusChanged = changes.status !== undefined && changes.status !== check.status
  const completed = status !== 'IN_PROGRESS'
  const updated = await backgroundChecksRepository.update(
    id,
    {
      ...changes,
      ...(statusChanged && { completedAt: completed ? new Date() : null, completedById: completed ? actorId : null }),
    },
    actorId,
  )
  return withPeopleOne(updated)
}

// Removes a check started by mistake. A check with a result is evidence and stays.
export async function deleteBackgroundCheck(id: number, viewer: CurrentUser) {
  const check = await getCheck(id, viewer, 'WRITE')
  await requireCheckOpen(check)
  if (check.status !== 'IN_PROGRESS') {
    throw new ORPCError('CONFLICT', { message: `A check with a result (${check.status}) cannot be deleted` })
  }
  return backgroundChecksRepository.deleteById(id)
}

// --- for the background worker (candidates.jobs.ts) ---

// E-mails HR (Onboarding: Edit) the background checks still open after the person joined (people may join while a
// check runs - backlog item 6)
export async function remindOpenChecks() {
  const checks = await backgroundChecksRepository.listOpenAfterJoining()
  if (!checks.length) return 'nothing to remind'
  // each person only about the checks of people inside their data access (a check always has its employee here)
  const placed = checks.flatMap((c) => (c.employee ? [{ ...c, employee: c.employee, placement: { companyId: c.employee.companyId, plantId: c.employee.plantId, departmentId: c.employee.departmentId } }] : []))
  const recipients = await accountsService.mailRecipientsFor('ONBOARDING', 'WRITE', placed)
  for (const { person, items } of recipients) {
    const lines = items.map((c) => {
      const who = `${[c.employee.firstName, c.employee.middleName, c.employee.lastName].filter(Boolean).join(' ')} (${c.employee.employeeCode})`
      return `- ${who}: ${c.type} check, ${c.status}${c.vendorName ? ` with ${c.vendorName}` : ''}, started ${formatDate(c.createdAt)}`
    })
    await sendMail({
      to: person.email,
      subject: `Background checks still open: ${items.length}`,
      text: [`Dear ${person.name},`, '', 'These background checks of people who have already joined have no result yet:', '', ...lines, '', 'Sent every Monday while checks are open.'].join('\n'),
    }).catch((error: unknown) => console.error(`[mail] background-check reminder to ${person.employeeCode} failed:`, error))
  }
  return `${checks.length} open check(s), reminded ${recipients.length} person(s)`
}
