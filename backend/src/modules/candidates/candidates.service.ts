import type { CurrentUser } from '#core/rpc/procedures'
import type { AccessLevel } from '#core/db/prisma'
import { writeWorkbook } from '#core/excel/workbook'
import { sendMail } from '#core/mail/mailer'
import { env } from '#core/config/env'
import { accountsService } from '#modules/accounts'
import { hasLevelAt, type Placement, scopeAllows, scopeOf } from '#core/auth/scope'
import { prisma, SYSTEM_ACTOR, type ActorId, type CandidateStatus, type DbClient, type EmploymentType, type JoiningType } from '#core/db/prisma'
import { employeesService } from '#modules/employees'
import { plantsService, salaryComponentsService, workLocationsService } from '#modules/organization'
import { formatDate, today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as candidatesRepository from './candidates.repository.js'
import type {
  closeCandidateInput,
  createCandidateInput,
  listCandidatesInput,
  recordMedicalInput,
  updateCandidateInput,
} from './candidates.schema.js'

// Business rules for candidates: the offer and its response, up to the joining day.
//   DRAFT -> OFFERED -> ACCEPTED -> JOINED (joining/ sub-folder), or closed as DECLINED / EXPIRED / WITHDRAWN /
//   BACKED_OUT / NO_SHOW.
// Unknown company / master ids -> 409 (mapped centrally).

type CloseOutcome = z.infer<typeof closeCandidateInput>['outcome']

// A closed candidate is history - nothing can change any more
const CLOSED: readonly CandidateStatus[] = ['DECLINED', 'EXPIRED', 'WITHDRAWN', 'BACKED_OUT', 'NO_SHOW']
// Nothing changes once the candidate has joined either - the employee record takes over
const FINAL: readonly CandidateStatus[] = [...CLOSED, 'JOINED']

// The statuses each outcome can be reached from
const CAN_CLOSE_FROM: Record<CloseOutcome, readonly CandidateStatus[]> = {
  DECLINED: ['OFFERED'],
  EXPIRED: ['OFFERED'],
  WITHDRAWN: ['DRAFT', 'OFFERED', 'LOI_ACCEPTED', 'ACCEPTED'],
  BACKED_OUT: ['LOI_ACCEPTED', 'ACCEPTED'],
  NO_SHOW: ['ACCEPTED'],
}

// About the person, not the offer: changing them never means the offer has to be sent again
const PERSON_FIELDS: ReadonlySet<string> = new Set(['salutation', 'firstName', 'middleName', 'lastName', 'mobile', 'personalEmail', 'address'])
// Offer settings that are not printed on the letter (changing them while OFFERED keeps the sent letter)
const OFF_LETTER_FIELDS: ReadonlySet<string> = new Set(['joiningFormOnAcceptance', 'extraRequiredDocuments'])

type SalaryLineInput = { salaryComponentId: number; monthlyAmount: number }

function badRequest(message: string): never {
  throw new ORPCError('BAD_REQUEST', { message })
}

function conflict(message: string): never {
  throw new ORPCError('CONFLICT', { message })
}

type Terms = {
  workLocationId?: number | null | undefined
  proposedJoiningDate: Date
  contractEndDate?: Date | null | undefined
  offerValidUntil?: Date | null | undefined
  joiningType: JoiningType
  employmentType: EmploymentType
}

// Which employment types go with which joining pack (decided 2026-11-14):
// - Regular (India, on payroll with PF / ESIC): permanent or contract staff
// - Consultant & Intern (India, no PF / ESIC): consultants, trainees / interns, and apprentices (the Apprentices Act
//   keeps them out of PF and ESIC)
// - Overseas (works outside India): anything but apprentice (an Indian scheme)
const EMPLOYMENT_TYPES_FOR: Record<JoiningType, EmploymentType[]> = {
  REGULAR: ['PERMANENT', 'CONTRACT'],
  CONSULTANT_INTERN: ['CONSULTANT', 'TRAINEE', 'APPRENTICE'],
  OVERSEAS: ['PERMANENT', 'CONTRACT', 'CONSULTANT', 'TRAINEE'],
}
// Engagements for a fixed period - the offer must say when it ends (a consultant's may be open-ended)
const FIXED_PERIOD: EmploymentType[] = ['CONTRACT', 'TRAINEE', 'APPRENTICE']
// "a Regular ..." / "an Overseas ..."
const withArticle = (name: string) => `${/^[AEIOU]/i.test(name) ? 'An' : 'A'} ${name}`
const JOINING_TYPE_NAME: Record<JoiningType, string> = { REGULAR: 'Regular', CONSULTANT_INTERN: 'Consultant & Intern', OVERSEAS: 'Overseas' }
const EMPLOYMENT_TYPE_NAME: Record<EmploymentType, string> = {
  PERMANENT: 'Permanent',
  CONTRACT: 'Contract',
  TRAINEE: 'Trainee / Intern',
  CONSULTANT: 'Consultant',
  APPRENTICE: 'Apprentice',
}

// Rules every set of offer terms must follow.
async function checkTerms(terms: Terms, options: { checkLocation: boolean; accepted: boolean }) {
  // Work locations are group-wide: any active one can be offered, whatever the company
  if (options.checkLocation && terms.workLocationId != null) {
    const locations = await workLocationsService.listWorkLocations({})
    if (!locations.some((location) => location.id === terms.workLocationId)) {
      badRequest('workLocationId is not an active work location')
    }
  }
  // (a permanent offer has no contract period - see updateCandidate for an old date left on one)
  if (terms.employmentType !== 'PERMANENT' && terms.contractEndDate && terms.contractEndDate <= terms.proposedJoiningDate) {
    badRequest('contractEndDate must be after proposedJoiningDate')
  }
  // While the offer can still change (an accepted one keeps the terms it was accepted with)
  if (!options.accepted) {
    const allowed = EMPLOYMENT_TYPES_FOR[terms.joiningType]
    if (!allowed.includes(terms.employmentType)) {
      badRequest(
        `${withArticle(JOINING_TYPE_NAME[terms.joiningType])} joining cannot be ${EMPLOYMENT_TYPE_NAME[terms.employmentType]} - choose ` +
          allowed.map((t) => EMPLOYMENT_TYPE_NAME[t]).join(', '),
      )
    }
    if (terms.employmentType === 'PERMANENT' && terms.contractEndDate) badRequest('A permanent offer has no contract end date')
    if (FIXED_PERIOD.includes(terms.employmentType) && !terms.contractEndDate) {
      badRequest(`${withArticle(EMPLOYMENT_TYPE_NAME[terms.employmentType])} offer needs a contract end date`)
    }
  }
  // Once accepted, the joining date may move past the old validity date - that is fine
  if (!options.accepted && terms.offerValidUntil && terms.offerValidUntil > terms.proposedJoiningDate) {
    badRequest('offerValidUntil must be on or before proposedJoiningDate')
  }
}

// The breakup must use active salary components and add up to the fixed CTC: monthly lines x 12 = annualCtc - the same
// rule as a salary revision (salary components' checkBreakup, 2026-11-20)
function checkSalaryLines(lines: SalaryLineInput[], annualCtc: number) {
  return salaryComponentsService.checkBreakup(lines, annualCtc)
}

// Same lines (in any order) as the offer has now
function sameLines(current: { monthlyAmount: number; salaryComponent: { id: number } }[], next: SalaryLineInput[]) {
  const key = (lines: SalaryLineInput[]) => lines.map((l) => `${l.salaryComponentId}:${l.monthlyAmount}`).sort().join(',')
  return key(current.map((l) => ({ salaryComponentId: l.salaryComponent.id, monthlyAmount: l.monthlyAmount }))) === key(next)
}

// --- Data access (2026-11-18): Onboarding covering where the candidate is placed (company / plant / department) ---

const placementOf = (c: { company: { id: number }; plant: { id: number }; department: { id: number } | null }): Placement => ({
  companyId: c.company.id,
  plantId: c.plant.id,
  departmentId: c.department?.id ?? null,
})

// The candidate, if the viewer's Onboarding access at this level covers where they are placed - outside the View range
// "not found" (A3), View only for a change "no access"
export async function getCandidateFor(viewer: CurrentUser, id: number, level: AccessLevel = 'READ', db?: DbClient) {
  const candidate = await getCandidate(id, db)
  const at = placementOf(candidate)
  if (!hasLevelAt(viewer, 'ONBOARDING', at, 'READ')) throw new ORPCError('NOT_FOUND', { message: `No candidate found with id ${id}` })
  if (level === 'WRITE' && !hasLevelAt(viewer, 'ONBOARDING', at, 'WRITE')) throw new ORPCError('FORBIDDEN', { message: 'You do not have access to change this candidate' })
  return candidate
}

// A new or moved offer must be placed inside the viewer's Onboarding Edit data access
function assertCanPlace(viewer: CurrentUser, placement: Placement) {
  if (!hasLevelAt(viewer, 'ONBOARDING', placement, 'WRITE')) {
    throw new ORPCError('FORBIDDEN', { message: 'You can only place offers in a company / plant / department inside your data access' })
  }
}

// Whether the viewer's access in an area covers the candidate (e.g. the medical part of the joining form)
export function viewerHasAt(viewer: CurrentUser, candidate: Parameters<typeof placementOf>[0], area: 'MEDICAL' | 'EMPLOYEE_IDS_BANK' | 'SALARY', level: AccessLevel) {
  return hasLevelAt(viewer, area, placementOf(candidate), level)
}

// Only the candidates inside the viewer's Onboarding View data access
export function listCandidates(input: z.infer<typeof listCandidatesInput>, viewer: CurrentUser) {
  return candidatesRepository.list({ scope: scopeOf(viewer, 'ONBOARDING', 'READ'), status: input?.status, companyId: input?.companyId })
}

const STATUS_NAME: Record<CandidateStatus, string> = {
  DRAFT: 'Draft',
  OFFERED: 'Offer sent',
  LOI_ACCEPTED: 'LOI accepted - offer to send',
  ACCEPTED: 'Accepted - pre-joining',
  JOINED: 'Joined',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  WITHDRAWN: 'Withdrawn',
  BACKED_OUT: 'Backed out',
  NO_SHOW: 'No-show',
}
// Where the Letter of Intent stands (old HRMS report R21: accepted / rejected / yet to accept)
function loiStatus(c: { loiNumber: string | null; loiAcceptedAt: Date | null; offerNumber: string | null; status: CandidateStatus }) {
  if (!c.loiNumber) return ''
  if (c.loiAcceptedAt) return 'Accepted'
  if (c.status === 'OFFERED' && !c.offerNumber) return 'Yet to accept'
  if (c.status === 'DECLINED' || c.status === 'EXPIRED' || c.status === 'WITHDRAWN') return 'Not accepted'
  return 'Replaced by the offer'
}

// The "Offers & candidates" report (2026-11-16, inspired by the old HRMS's R21): every candidate matching the filters,
// with the Letter of Intent and offer steps, as an Excel file
export async function exportCandidates(input: z.infer<typeof listCandidatesInput>, viewer: CurrentUser) {
  const rows = await candidatesRepository.list({ scope: scopeOf(viewer, 'ONBOARDING', 'READ'), status: input?.status, companyId: input?.companyId })
  const name = (c: { firstName: string; middleName: string | null; lastName: string | null }) => [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')
  const bytes = await writeWorkbook([
    {
      name: 'Offers & candidates',
      columns: [
        { header: 'Candidate #', key: 'id', width: 12 },
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Mobile', key: 'mobile', width: 14 },
        { header: 'Company', key: 'company', width: 12 },
        { header: 'Designation', key: 'designation', width: 22 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Joining type', key: 'joiningType', width: 18 },
        { header: 'Status', key: 'status', width: 24 },
        { header: 'Letter of Intent', key: 'loiNumber', width: 20 },
        { header: 'LOI status', key: 'loiStatus', width: 18 },
        { header: 'Offer number', key: 'offerNumber', width: 22 },
        { header: 'Sent', key: 'sentAt', width: 18, dateTime: true },
        { header: 'Accepted', key: 'acceptedAt', width: 18, dateTime: true },
        { header: 'Valid until', key: 'validUntil', width: 13, date: true },
        { header: 'Joining date', key: 'joiningDate', width: 13, date: true },
        { header: 'Fixed CTC / year', key: 'ctc', width: 16 },
        { header: 'Currency', key: 'currency', width: 9 },
        { header: 'Joined as', key: 'employeeCode', width: 14 },
        { header: 'Closed - reason', key: 'closeReason', width: 30 },
      ],
      rows: rows.map((c) => ({
        id: c.id,
        name: name(c),
        mobile: c.mobile,
        company: c.company.code,
        designation: c.designation.name,
        department: c.department?.name,
        joiningType: JOINING_TYPE_NAME[c.joiningType],
        status: STATUS_NAME[c.status],
        loiNumber: c.loiNumber,
        loiStatus: loiStatus(c),
        offerNumber: c.offerNumber,
        sentAt: c.offerSentAt,
        acceptedAt: c.acceptedAt,
        validUntil: c.offerValidUntil,
        joiningDate: c.proposedJoiningDate,
        ctc: c.annualCtc,
        currency: c.ctcCurrency,
        employeeCode: c.employee?.employeeCode,
        closeReason: c.closeReason,
      })),
    },
  ])
  return new File([new Uint8Array(bytes)], `offers-and-candidates-${today().toISOString().slice(0, 10)}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// The candidate with this id; throws NOT_FOUND if there is none. (For other services - the API returns
// getCandidateDetails, which also names the people.)
export async function getCandidate(id: number, db?: DbClient) {
  const candidate = await candidatesRepository.findById(id, db)
  if (!candidate) throw new ORPCError('NOT_FOUND', { message: `No candidate found with id ${id}` })
  return candidate
}

type CandidateRow = Awaited<ReturnType<typeof getCandidate>>

// The candidate answering on their offer page (no login, so the step is recorded by SYSTEM_ACTOR)
const CANDIDATE_ONLINE = { employeeCode: null, name: 'Candidate (online)' }

// For the API: who created / last changed the candidate and who did each step, as { employeeCode, name }.
// Accepting with no employee behind it, or declining online, was the candidate on the offer page - shown as such,
// not as "System".
async function withPeople(candidate: CandidateRow) {
  const {
    createdById,
    updatedById,
    offerSentById,
    acceptedById,
    loiAcceptedById,
    closedById,
    joiningConfirmedById,
    joiningFormSubmittedById,
    joiningFormReturnedById,
    joiningFormOpenedById,
    ...rest
  } = candidate
  const person = await employeesService.lookupPeople([
    createdById,
    updatedById,
    offerSentById,
    acceptedById,
    loiAcceptedById,
    closedById,
    joiningConfirmedById,
    joiningFormReturnedById,
    joiningFormOpenedById,
  ])
  return {
    ...rest,
    createdBy: person(createdById),
    updatedBy: person(updatedById),
    offerSentBy: person(offerSentById),
    acceptedBy: acceptedById === SYSTEM_ACTOR ? CANDIDATE_ONLINE : person(acceptedById),
    loiAcceptedBy: loiAcceptedById === SYSTEM_ACTOR ? CANDIDATE_ONLINE : person(loiAcceptedById),
    closedBy: closedById === SYSTEM_ACTOR && rest.status === 'DECLINED' ? CANDIDATE_ONLINE : person(closedById),
    joiningConfirmedBy: person(joiningConfirmedById),
    joiningFormSubmittedBy: joiningFormSubmittedById === SYSTEM_ACTOR ? CANDIDATE_ONLINE : person(joiningFormSubmittedById),
    joiningFormReturnedBy: person(joiningFormReturnedById),
    // opened by the online acceptance itself (System) = "Candidate (online)"
    joiningFormOpenedBy: joiningFormOpenedById === SYSTEM_ACTOR ? CANDIDATE_ONLINE : person(joiningFormOpenedById),
  }
}

export async function getCandidateDetails(id: number, viewer: CurrentUser) {
  const candidate = await getCandidateFor(viewer, id)
  // employees with the same mobile or e-mail (a rehire, or an offer made twice) - shown to HR, never blocking; not after
  // joining (the employee is then the candidate's own). One outside the viewer's data access shows as code + name only
  // (A5, 2026-11-18)
  const found =
    candidate.status === 'JOINED' ? [] : await employeesService.findPossibleDuplicates({ mobile: candidate.mobile, email: candidate.personalEmail })
  const visible = scopeOf(viewer, 'EMPLOYEES', 'READ')
  const possibleDuplicates = found.map(({ placement, ...match }) => (scopeAllows(visible, placement) ? match : { ...match, status: null }))
  return { ...(await withPeople(candidate)), possibleDuplicates }
}

// A new offer, as a DRAFT.
export async function createCandidate({ salaryLines = [], ...input }: z.infer<typeof createCandidateInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  assertCanPlace(viewer, { companyId: input.companyId, plantId: input.plantId, departmentId: input.departmentId ?? null })
  await checkTerms(input, { checkLocation: true, accepted: false })
  await plantsService.assertPlacement(input, { plant: true, department: true })
  await checkSalaryLines(salaryLines, input.annualCtc)
  if (input.extraRequiredDocuments) input.extraRequiredDocuments = [...new Set(input.extraRequiredDocuments)]
  const created = await prisma.$transaction(async (tx) => {
    const candidate = await candidatesRepository.create(input, actorId, tx)
    if (salaryLines.length === 0) return candidate
    await candidatesRepository.replaceSalaryLines(candidate.id, salaryLines, actorId, tx)
    return getCandidate(candidate.id, tx)
  })
  return withPeople(created)
}

// DRAFT: anything can change. OFFERED: changing any offer term moves it back to DRAFT (it must be sent again).
// ACCEPTED: only the joining date and the person's details can change. Closed: nothing.
export async function updateCandidate({ id, salaryLines, ...changes }: z.infer<typeof updateCandidateInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const current = await getCandidateFor(viewer, id, 'WRITE')
  // a move (company / plant / department) needs Edit where the offer goes as well
  if (changes.companyId !== undefined || changes.plantId !== undefined || changes.departmentId !== undefined) {
    assertCanPlace(viewer, {
      companyId: changes.companyId ?? current.company.id,
      plantId: changes.plantId ?? current.plant.id,
      departmentId: changes.departmentId === undefined ? (current.department?.id ?? null) : changes.departmentId,
    })
  }
  if (changes.extraRequiredDocuments) changes.extraRequiredDocuments = [...new Set(changes.extraRequiredDocuments)]
  const linesChanged = salaryLines !== undefined && !sameLines(current.salaryLines, salaryLines)
  const changed = [
    ...Object.entries(changes)
      .filter(([, value]) => value !== undefined)
      .map(([field]) => field),
    ...(linesChanged ? ['salaryLines'] : []),
  ]
  const changedTerms = changed.filter((field) => !PERSON_FIELDS.has(field))

  if (FINAL.includes(current.status)) conflict(`This candidate is ${current.status} - nothing can be changed`)
  const accepted = current.status === 'ACCEPTED'
  if (accepted) {
    // a missing department can still be filled in: joining needs one (every employee has a department, 2026-11-19)
    const fillsDepartment = (field: string) => field === 'departmentId' && !current.department && changes.departmentId != null
    // the documents asked for can still change until joining (2026-11-20)
    const locked = changedTerms.filter((field) => field !== 'proposedJoiningDate' && field !== 'extraRequiredDocuments' && !fillsDepartment(field))
    if (locked.length) {
      conflict(
        `The offer is accepted, so ${locked.join(', ')} cannot change - only the joining date and the person's ` +
          'details can. To change the terms, withdraw this offer and make a new one.',
      )
    }
    if (changes.proposedJoiningDate && changes.proposedJoiningDate < today()) {
      badRequest('proposedJoiningDate cannot be in the past')
    }
  }

  // A permanent offer has no contract end date: one left on it from before that rule (2026-11-14) is dropped when the
  // offer is saved, so it neither blocks the save nor stays on the record
  const employmentTypeAfter = changes.employmentType ?? current.employmentType
  const staleContractEnd = employmentTypeAfter === 'PERMANENT' && changes.contractEndDate === undefined && current.contractEndDate !== null

  await checkTerms(
    {
      workLocationId: changes.workLocationId === undefined ? current.workLocation?.id : changes.workLocationId,
      proposedJoiningDate: changes.proposedJoiningDate ?? current.proposedJoiningDate,
      contractEndDate: changes.contractEndDate === undefined ? (staleContractEnd ? null : current.contractEndDate) : changes.contractEndDate,
      offerValidUntil: changes.offerValidUntil === undefined ? current.offerValidUntil : changes.offerValidUntil,
      joiningType: changes.joiningType ?? current.joiningType,
      employmentType: changes.employmentType ?? current.employmentType,
    },
    { checkLocation: changes.workLocationId !== undefined, accepted },
  )
  // Company, plant and department as they will be - a new company needs a plant of its own, a new plant keeps the
  // department only if it runs there
  await plantsService.assertPlacement(
    {
      companyId: changes.companyId ?? current.company.id,
      plantId: changes.plantId ?? current.plant.id,
      departmentId: changes.departmentId === undefined ? current.department?.id : changes.departmentId,
    },
    {
      plant: changes.plantId !== undefined && changes.plantId !== current.plant.id,
      department: changes.departmentId != null && changes.departmentId !== current.department?.id,
    },
  )

  await checkSalaryLines(
    linesChanged ? salaryLines : current.salaryLines.map((l) => ({ salaryComponentId: l.salaryComponent.id, monthlyAmount: l.monthlyAmount })),
    changes.annualCtc ?? current.annualCtc,
  )

  // A sent letter no longer matches - the offer must be sent again (as a new revision of the letter). The joining-form
  // choice is not on the letter, so it alone never does.
  const backToDraft = current.status === 'OFFERED' && changedTerms.some((field) => !OFF_LETTER_FIELDS.has(field))
  // A new joining date has not been confirmed by the candidate yet
  const dateMoved =
    changes.proposedJoiningDate !== undefined &&
    changes.proposedJoiningDate.getTime() !== current.proposedJoiningDate.getTime()
  const updated = await prisma.$transaction(async (tx) => {
    if (linesChanged) await candidatesRepository.replaceSalaryLines(id, salaryLines, actorId, tx)
    return candidatesRepository.update(
      id,
      {
        ...changes,
        ...(staleContractEnd && { contractEndDate: null }),
        // after an accepted Letter of Intent, back to LOI_ACCEPTED (the full offer is sent again)
        ...(backToDraft && { status: current.loiAcceptedAt ? 'LOI_ACCEPTED' : 'DRAFT', offerSentAt: null, offerSentById: null }),
        ...(dateMoved && { joiningConfirmedAt: null, joiningConfirmedById: null }),
      },
      actorId,
      tx,
    )
  })
  return withPeople(updated)
}

// The rules for sending (the offer letters service writes and sends the letter): a DRAFT, valid until a date that
// has not passed, and a joining date that has not passed.
// The Letter of Intent (2026-11-16) goes first, from a draft that has not had an LOI accepted; the full offer from a draft
// or once the LOI is accepted.
export function assertCanSend(candidate: CandidateRow, kind: 'OFFER_LETTER' | 'LETTER_OF_INTENT' = 'OFFER_LETTER') {
  if (kind === 'LETTER_OF_INTENT') {
    if (candidate.status !== 'DRAFT') conflict(`A Letter of Intent can only be sent from a draft; this candidate is ${candidate.status}`)
    if (candidate.loiAcceptedAt) conflict('The Letter of Intent was already accepted - send the full offer')
    if (candidate.offerNumber) conflict('The full offer was already sent - a Letter of Intent comes before it')
  } else if (candidate.status !== 'DRAFT' && candidate.status !== 'LOI_ACCEPTED') {
    conflict(`Only a draft offer (or one whose Letter of Intent was accepted) can be sent; this candidate is ${candidate.status}`)
  }
  if (!candidate.offerValidUntil) badRequest('Set offerValidUntil before sending the offer')
  if (candidate.offerValidUntil < today()) {
    badRequest(`offerValidUntil (${formatDate(candidate.offerValidUntil)}) is in the past`)
  }
  if (candidate.proposedJoiningDate < today()) {
    badRequest(`proposedJoiningDate (${formatDate(candidate.proposedJoiningDate)}) is in the past`)
  }
}

// The offer can still be answered: OFFERED and not past its valid-until date
export function assertCanAnswer(candidate: CandidateRow) {
  if (candidate.status !== 'OFFERED') {
    conflict(`Only a sent offer can be answered; this candidate is ${candidate.status}`)
  }
  if (candidate.offerValidUntil && candidate.offerValidUntil < today()) {
    conflict(
      `The offer expired on ${formatDate(candidate.offerValidUntil)}. ` +
        'Extend offerValidUntil and send it again, or close it as EXPIRED.',
    )
  }
}

// DRAFT -> OFFERED, once the letter is written (assertCanSend was checked). Keeps the offer number.
export async function recordOfferSent(id: number, offerNumber: string, actorId: ActorId, db?: DbClient) {
  return candidatesRepository.update(id, { status: 'OFFERED', offerNumber, offerSentAt: new Date(), offerSentById: actorId }, actorId, db)
}

// DRAFT -> OFFERED with the Letter of Intent (2026-11-16); its number is given the first time
export async function recordLoiSent(id: number, loiNumber: string, actorId: ActorId, db?: DbClient) {
  return candidatesRepository.update(id, { status: 'OFFERED', loiNumber, offerSentAt: new Date(), offerSentById: actorId }, actorId, db)
}

// OFFERED (Letter of Intent) -> LOI_ACCEPTED (online by the candidate = System, or by HR with the signed copy); the
// full offer is sent next
export async function recordLoiAccepted(id: number, actorId: ActorId, db?: DbClient) {
  assertCanAnswer(await getCandidate(id, db))
  return candidatesRepository.update(id, { status: 'LOI_ACCEPTED', loiAcceptedAt: new Date(), loiAcceptedById: actorId }, actorId, db)
}

// OFFERED -> ACCEPTED (by HR with the signed copy, or online by the candidate = System). The joining form opens with it
// when the offer says so (joiningFormOnAcceptance); otherwise HR opens it later by sending its link.
export async function recordOfferAccepted(id: number, actorId: ActorId, db?: DbClient) {
  const candidate = await getCandidate(id, db)
  assertCanAnswer(candidate)
  const now = new Date()
  return candidatesRepository.update(
    id,
    {
      status: 'ACCEPTED',
      acceptedAt: now,
      acceptedById: actorId,
      ...(candidate.joiningFormOnAcceptance && { joiningFormOpenedAt: now, joiningFormOpenedById: actorId }),
    },
    actorId,
    db,
  )
}

// HR sent the joining-form link (offer-letters.sendPortalLink): the joining form is open from now on - the first time
// only, so the record keeps when it was first opened
export async function recordJoiningFormOpened(id: number, actorId: ActorId, db?: DbClient) {
  const candidate = await getCandidate(id, db)
  if (candidate.joiningFormOpenedAt) return candidate
  return candidatesRepository.update(id, { joiningFormOpenedAt: new Date(), joiningFormOpenedById: actorId }, actorId, db)
}

// Signs the candidate out of their joining-form page everywhere (a new link was sent: the old one's sessions end)
export async function endPortalSessions(candidateId: number, db?: DbClient) {
  await candidatesRepository.deletePortalSessions(candidateId, db)
}

// OFFERED -> DECLINED, answered online by the candidate (System)
export async function recordOfferDeclined(id: number, reason: string | null, actorId: ActorId, db?: DbClient) {
  assertCanAnswer(await getCandidate(id, db))
  return candidatesRepository.update(id, { status: 'DECLINED', closedAt: new Date(), closedById: actorId, closeReason: reason }, actorId, db)
}

// For the API after an offer letter step: the candidate with the people named
export async function toCandidateDetails(candidate: CandidateRow) {
  return withPeople(candidate)
}

// Ends the process without joining. Each outcome has its own allowed starting status (CAN_CLOSE_FROM).
// HR closes the offer (data access: Onboarding Edit covering the candidate)
export async function closeCandidateFor(input: z.infer<typeof closeCandidateInput>, viewer: CurrentUser) {
  await getCandidateFor(viewer, input.id, 'WRITE')
  return closeCandidate(input, viewer.employeeId)
}

// (also the job that expires unanswered offers, by System)
export async function closeCandidate({ id, outcome, reason }: z.infer<typeof closeCandidateInput>, actorId: ActorId) {
  const candidate = await getCandidate(id)
  const allowed = CAN_CLOSE_FROM[outcome]
  if (!allowed.includes(candidate.status)) {
    conflict(`A candidate can be closed as ${outcome} only when ${allowed.join(' or ')}; this one is ${candidate.status}`)
  }
  if (outcome === 'EXPIRED' && !(candidate.offerValidUntil && candidate.offerValidUntil < today())) {
    conflict('The offer has not expired yet')
  }
  if (outcome === 'NO_SHOW' && candidate.proposedJoiningDate > today()) {
    conflict(`The joining date (${formatDate(candidate.proposedJoiningDate)}) has not come yet`)
  }
  if (outcome === 'WITHDRAWN' && !reason) badRequest('Give the reason for withdrawing the offer')
  const updated = await candidatesRepository.update(
    id,
    { status: outcome, closedAt: new Date(), closedById: actorId, closeReason: reason ?? null },
    actorId,
  )
  return withPeople(updated)
}

// The pre-employment medical result (a re-examination replaces it). Only while ACCEPTED.
// UNFIT does not withdraw the offer by itself - HR decides (close as WITHDRAWN).
export async function recordMedical(
  { id, result, examDate, examiner, restrictions }: z.infer<typeof recordMedicalInput>,
  viewer: CurrentUser,
) {
  const actorId = viewer.employeeId
  const candidate = await getCandidateFor(viewer, id, 'WRITE')
  if (candidate.status !== 'ACCEPTED') {
    conflict(`The medical can be recorded only after the offer is accepted; this candidate is ${candidate.status}`)
  }
  if (examDate > today()) badRequest('examDate cannot be in the future')
  if (result === 'FIT_WITH_RESTRICTIONS' && !restrictions) badRequest('Describe the restrictions')
  const updated = await candidatesRepository.update(
    id,
    {
      medicalResult: result,
      medicalExamDate: examDate,
      medicalExaminer: examiner,
      medicalRestrictions: result === 'FIT_WITH_RESTRICTIONS' ? restrictions : null,
    },
    actorId,
  )
  return withPeople(updated)
}

// HR called the candidate before the joining date and they confirmed they are joining.
export async function confirmJoining(id: number, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const candidate = await getCandidateFor(viewer, id, 'WRITE')
  if (candidate.status !== 'ACCEPTED') {
    conflict(`Only an accepted candidate can confirm joining; this one is ${candidate.status}`)
  }
  if (candidate.proposedJoiningDate <= today()) {
    conflict(`The joining date (${formatDate(candidate.proposedJoiningDate)}) has already come`)
  }
  const updated = await candidatesRepository.update(id, { joiningConfirmedAt: new Date(), joiningConfirmedById: actorId }, actorId)
  return withPeople(updated)
}

// --- for the background worker (candidates.jobs.ts) ---

// Offers whose "valid until" date has passed without an answer become EXPIRED (as "close as expired" would)
export async function expireUnansweredOffers() {
  const offers = await candidatesRepository.listUnansweredExpired(today())
  for (const { id } of offers) await closeCandidate({ id, outcome: 'EXPIRED' }, SYSTEM_ACTOR)
  return offers.length
}

// E-mails HR (Onboarding: Edit) the candidates joining in the next DAYS days whose joining is not confirmed yet
export async function remindUnconfirmedJoining(days: number) {
  const from = today()
  const candidates = await candidatesRepository.listUnconfirmedJoining(from, new Date(from.getTime() + days * 86_400_000))
  if (!candidates.length) return 'nothing to remind'
  // each person only about the candidates inside their data access
  const recipients = await accountsService.mailRecipientsFor('ONBOARDING', 'WRITE', candidates.map((c) => ({ ...c, placement: placementOf(c) })))
  for (const { person, items } of recipients) {
    const lines = items.map(
      (c) => `- ${[c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')} (${c.company.code}) - joining ${formatDate(c.proposedJoiningDate)}: ${env.APP_URL}/onboarding/${c.id}`,
    )
    await sendMail({
      to: person.email,
      subject: `Joining not confirmed yet: ${items.length} candidate(s) joining soon`,
      text: [
        `Dear ${person.name},`,
        '',
        `These candidates join in the next ${days} days and their joining is not confirmed yet - please call them:`,
        '',
        ...lines,
        '',
        'This reminder is sent every morning while a joining is unconfirmed.',
      ].join('\n'),
    }).catch((error: unknown) => console.error(`[mail] joining reminder to ${person.employeeCode} failed:`, error))
  }
  return `${candidates.length} candidate(s), reminded ${recipients.length} person(s)`
}
