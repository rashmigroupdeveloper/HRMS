import type { CurrentUser } from '#core/rpc/procedures'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { accountsService } from '#modules/accounts'
import { attendanceService } from '#modules/attendance'
import { employeeDocumentsService, employeesService } from '#modules/employees'
import { employeeLettersService } from '#modules/employee-letters'
import { joiningTasksService } from '#modules/joining-tasks'
import { companiesService } from '#modules/organization'
import { formatDate, today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as backgroundChecksService from '../background-checks/background-checks.service.js'
import * as candidatesService from '../candidates.service.js'
import * as documentsService from '../documents/documents.service.js'
import * as joiningFormService from '../joining-form/joining-form.service.js'
import * as joiningRepository from './joining.repository.js'
import type { completeJoiningInput } from './joining.schema.js'

// The joining day: an ACCEPTED candidate becomes an employee (status JOINED).
// - The checklist must be complete: joining form, medical result, required documents verified (decided
//   2026-11-12), and - when the candidate has an e-mail address - the form submitted and signed online by the
//   candidate (2026-11-13; the paper signature on the joining day is the signed joining form document).
//   Background checks are NOT required - people may join while they are running.
// - In one transaction: the employee is created from the offer + joining-form draft (with addresses, emergency
//   contacts, identity documents, bank account, PF / ESIC details, education, certifications, previous jobs,
//   family, nominees and the joining record with the signed declaration), the documents move to
//   the employee, the background checks are linked to the employee (employeeId - some may still be running), the
//   offer's salary and breakup become the employee's first salary (payroll.prisma, from the date of joining), the
//   employee gets a login with a temporary password, the holiday list HR chose is followed from the date of joining
//   (2026-11-24), and the candidate becomes JOINED and is linked to the employee.
//   After it is saved the login is e-mailed to the employee's personal e-mail (else HR is shown the password once).

// the Indian calendar day of a moment
const dateOnly = (at: Date) => today(at)

// `who` does it: the CANDIDATE (the joining form, their own document copies - HR may help) or HR on the joining day
// (the medical result, the printed forms signed on paper). `required`: joining waits for it - as the old HRMS
// (2026-11-16), only the accepted offer, the joining form (filled in and signed) and the code series; the medical result
// and the verified documents are shown to HR but do not stop the joining.
export type ChecklistItem = { key: string; label: string; ok: boolean; detail: string | null; who: 'CANDIDATE' | 'HR'; required: boolean }

const item = (
  key: string,
  label: string,
  ok: boolean,
  detail: string | null = null,
  who: ChecklistItem['who'] = 'CANDIDATE',
  required = true,
): ChecklistItem => ({ key, label, ok, detail, who, required })

// What must be in place before joining can be completed, each item with whether it is done.
// HR opens the joining-day checklist (Onboarding View covering the candidate - data access)
export async function getChecklistFor(viewer: CurrentUser, candidateId: number) {
  await candidatesService.getCandidateFor(viewer, candidateId)
  return getChecklist(candidateId)
}

export async function getChecklist(candidateId: number) {
  const candidate = await candidatesService.getCandidate(candidateId)
  const draft = await joiningFormService.getJoiningForm(candidateId)
  const documents = await documentsService.listForJoining(candidateId)
  const pack = candidate.joiningType
  const items: ChecklistItem[] = []

  items.push(
    item(
      'status',
      'Offer accepted',
      candidate.status === 'ACCEPTED',
      candidate.status === 'JOINED' ? `Already joined as ${candidate.employee?.employeeCode}` : candidate.status === 'ACCEPTED' ? null : `The candidate is ${candidate.status}`,
    ),
  )

  // every employee has a department (2026-11-19) - the offer may still be without one until the joining day
  items.push(
    item(
      'department',
      'Department chosen',
      !!candidate.department,
      candidate.department ? null : 'Choose the department with Edit on this page - every employee has one',
      'HR',
    ),
  )

  // --- joining form ---
  items.push(...joiningFormService.checkForm(pack, draft).map((c) => ({ ...c, who: 'CANDIDATE' as const, required: true })))
  // signed online by the candidate (needs their e-mail for the one-time code; without one only the paper signature)
  if (candidate.personalEmail) {
    items.push(
      item(
        'signed',
        'Joining form: submitted and signed online by the candidate',
        !!candidate.joiningFormSubmittedAt,
        candidate.joiningFormSubmittedAt ? null : candidate.joiningFormReturnedAt ? 'Sent back to the candidate for changes' : 'Not submitted yet',
      ),
    )
  }

  // --- medical (not for the Overseas pack) ---
  if (pack !== 'OVERSEAS') {
    const fit = candidate.medicalResult === 'FIT' || candidate.medicalResult === 'FIT_WITH_RESTRICTIONS'
    items.push(
      item(
        'medical',
        'Medical: fit to join',
        fit,
        candidate.medicalResult === 'UNFIT' ? 'The medical result is Unfit' : fit ? null : 'Record the medical result on the "Medical & confirmation" tab',
        'HR',
        false,
      ),
    )
  }

  // --- documents: uploaded and verified ---
  // the whole signed pack, scanned once, counts for every paper form in it (2026-11-15)
  const signedPack = documents.filter((d) => d.type === 'SIGNED_FORMS_PACK' && !d.isDeleted)
  for (const type of documentsService.requiredDocuments(pack, draft.statutory?.esicApplicable === true, candidate.extraRequiredDocuments)) {
    // the candidate uploads their own copies; the forms signed on paper (joining form, EPF / ESIC / Form F, medical
    // pages) HR prints filled in, has signed on the joining day and uploads - one scan of the pack, or each on its own
    const byCandidate = documentsService.isCandidateDocument(type)
    const ofType = documents.filter((d) => d.type === type && !d.isDeleted) // deleted ones do not count
    const own = ofType.some((d) => d.verificationStatus === 'VERIFIED')
    const inPack = !byCandidate && signedPack.some((d) => d.verificationStatus === 'VERIFIED')
    const candidates = byCandidate ? ofType : [...ofType, ...signedPack]
    const detail =
      own ? null
      : inPack ? 'In the signed forms pack'
      : candidates.some((d) => d.verificationStatus === 'PENDING') ? 'Uploaded - not verified yet'
      : candidates.length ? 'Rejected - upload it again'
      : byCandidate ? 'The candidate has not uploaded it yet'
      : 'Print the forms, have the candidate sign them, then upload the scan of the whole signed pack (or this form on its own) on the Documents tab'
    items.push(item(`document:${type}`, `${documentsService.DOCUMENT_LABEL[type]} verified`, own || inPack, detail, byCandidate ? 'CANDIDATE' : 'HR', false))
  }

  // the employee code comes from the company's series (2026-11-16) - it must be set before anyone can join
  const company = await companiesService.getCompany(candidate.company.id)
  const nextEmployeeCode = companiesService.nextEmployeeCodeOf(company)
  items.push(
    item(
      'employeeCodeSeries',
      `Employee code series of ${company.name}`,
      nextEmployeeCode !== null,
      nextEmployeeCode === null ? 'Set the next employee number of the company on the Organization page' : null,
      'HR',
    ),
  )

  // ready: everything joining waits for is done (the rest is still shown, as a reminder)
  return { ready: items.every((i) => i.ok || !i.required), items, nextEmployeeCode }
}

// Completes joining: creates the employee and turns the candidate into JOINED (see the top of this file).
export async function completeJoining(input: z.infer<typeof completeJoiningInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const candidate = await candidatesService.getCandidateFor(viewer, input.candidateId, 'WRITE')
  if (candidate.status !== 'ACCEPTED') {
    throw new ORPCError('CONFLICT', { message: `Only an accepted candidate can join; this candidate is ${candidate.status}` })
  }
  const checklist = await getChecklist(input.candidateId)
  const missing = checklist.items.filter((i) => !i.ok && i.required)
  if (missing.length) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Joining cannot be completed yet: ${missing.map((i) => (i.detail ? `${i.label} (${i.detail})` : i.label)).join('; ')}`,
    })
  }
  // (on the checklist too - this also tells the code the department is there)
  const department = candidate.department
  if (!department) throw new ORPCError('BAD_REQUEST', { message: 'Joining cannot be completed yet: choose the department - every employee has one' })
  if (input.dateOfJoining > today()) throw new ORPCError('BAD_REQUEST', { message: 'dateOfJoining cannot be in the future' })
  if (candidate.contractEndDate && candidate.contractEndDate <= input.dateOfJoining) {
    throw new ORPCError('BAD_REQUEST', { message: `The contract ends on ${formatDate(candidate.contractEndDate)}, before the joining date` })
  }
  if (input.probationEndDate && input.probationEndDate <= input.dateOfJoining) {
    throw new ORPCError('BAD_REQUEST', { message: 'probationEndDate must be after dateOfJoining' })
  }
  // the holiday list chosen: in use, of the company or of every company (2026-11-24)
  if (input.holidayListId) await attendanceService.assertJoiningHolidayList(input.holidayListId, candidate.company.id)

  // the joining tasks and who does each - checked before anything is saved (every task needs a person, 2026-11-20)
  const taskPlan = await joiningTasksService.planJoiningTasks(
    {
      dateOfJoining: input.dateOfJoining,
      joiningType: candidate.joiningType,
      companyId: candidate.company.id,
      plantId: candidate.plant.id,
      departmentId: department.id,
    },
    input.taskAssignees ?? [],
    input.noJoiningTasks ?? false,
    input.skipTaskTypeIds ?? [],
  )

  const draft = await joiningFormService.getJoiningForm(input.candidateId)
  const name = joiningFormService.nameOnForm(candidate, draft)
  const medicalConsent = await joiningFormService.getMedicalConsent(input.candidateId)
  const documents = await documentsService.listForJoining(input.candidateId)

  // The documents' files are copied to the employee's folder inside the transaction; the candidate's originals are
  // deleted once it is saved, the copies if it fails - so a file is never missing.
  let copies: string[] = []
  let employee
  // the employee's login: created with the employee, its temporary password e-mailed after (2026-11-15)
  let temporaryPassword = ''
  let joiningTasks = 0
  try {
    employee = await prisma.$transaction(async (tx) => {
      const reportingManagerId = input.reportingManagerCode ? await employeesService.resolveReportingManager(input.reportingManagerCode, null, tx) : undefined
      const created = await employeesService.createFromJoining(
        {
          employee: {
            // (no code: the next of the company's series)
            reportingManagerId,
            joiningType: candidate.joiningType,
            employmentType: candidate.employmentType,
            workforceCategory: candidate.workforceCategory,
            dateOfJoining: input.dateOfJoining,
            // a permanent employee has no end date (an offer made before that rule may still carry one)
            contractEndDate: candidate.employmentType === 'PERMANENT' ? undefined : (candidate.contractEndDate ?? undefined),
            probationEndDate: input.probationEndDate,
            // from the offer: notice periods (used when the employee leaves) and the salutation (letters)
            noticeMonthsProbation: candidate.noticeMonthsProbation ?? undefined,
            noticeMonthsConfirmed: candidate.noticeMonthsConfirmed ?? undefined,
            salutation: candidate.salutation ?? undefined,
            status: 'ACTIVE',
            companyId: candidate.company.id,
            plantId: candidate.plant.id,
            workLocationId: candidate.workLocation?.id,
            departmentId: department.id,
            designationId: candidate.designation.id,
            gradeId: candidate.grade?.id,
            ...draft.personal,
            // the name as in the joining form (corrected by the candidate or HR), else the offer's
            firstName: name.firstName,
            middleName: name.middleName ?? undefined,
            lastName: name.lastName ?? undefined,
            workEmail: input.workEmail,
            personalEmail: candidate.personalEmail ?? undefined,
            // the mobile as in the joining form (corrected by the candidate or HR), else the offer's
            mobile: draft.personal?.mobile ?? candidate.mobile,
            alternateMobile: draft.personal?.alternateMobile,
          },
          addresses: draft.addresses ?? [],
          emergencyContacts: draft.emergencyContacts ?? [],
          identityDocuments: draft.identityDocuments ?? [],
          bankAccount: draft.bankAccount,
          // the PF / ESIC answers with the Form F declarations (asked next to the nominees); "I have no family" worked
          // out from the family details
          statutory:
            draft.statutory || draft.gratuity
              ? { ...draft.statutory, ...draft.gratuity, gratuityNoFamily: joiningFormService.gratuityNoFamilyOf(draft) }
              : undefined,
          qualifications: draft.qualifications ?? [],
          certifications: draft.certifications ?? [],
          previousJobs: draft.previousJobs ?? [],
          familyMembers: draft.familyMembers ?? [],
          nominees: draft.nominees ?? [],
          // the medical information with its consent (when and by whom it was given - the candidate online or HR)
          medical:
            draft.medical && medicalConsent
              ? { ...draft.medical, consentAt: medicalConsent.at, consentById: medicalConsent.by, consentText: medicalConsent.text }
              : undefined,
          completedAt: new Date(),
          // the declaration (JF §10) the candidate signed online; the form's date is the day they signed it
          declaration: candidate.joiningFormSubmittedAt
            ? { acceptedAt: candidate.joiningFormSubmittedAt, acceptedById: SYSTEM_ACTOR, formDate: dateOnly(candidate.joiningFormSubmittedAt) }
            : null,
          // the salary agreed in the offer, with its breakup - the employee's first salary (from the date of joining)
          salary: {
            annualCtc: candidate.annualCtc,
            performancePayAnnual: candidate.performancePayAnnual,
            currency: candidate.ctcCurrency,
            lines: candidate.salaryLines.map((line) => ({ salaryComponentId: line.salaryComponent.id, monthlyAmount: line.monthlyAmount })),
          },
          // the pre-employment medical stays with the employee (its restrictions matter for placement)
          preEmploymentMedical: candidate.medicalResult
            ? {
                result: candidate.medicalResult,
                examDate: candidate.medicalExamDate,
                examiner: candidate.medicalExaminer,
                restrictions: candidate.medicalRestrictions,
              }
            : null,
        },
        actorId,
        tx,
      )
      copies = await employeeDocumentsService.addMovedDocuments(created, documents, actorId, tx)
      await documentsService.removeAfterJoining(input.candidateId, tx)
      // still ACCEPTED (a withdrawal at the same moment wins - nothing of the joining is saved)
      if (!(await joiningRepository.markJoined(input.candidateId, created.id, actorId, tx))) {
        throw new ORPCError('CONFLICT', { message: 'This candidate was changed a moment ago. Please reload the page and try again.' })
      }
      // the holiday list followed from the date of joining (2026-11-24)
      if (input.holidayListId) await attendanceService.giveHolidayListOnJoining(created.id, input.holidayListId, input.dateOfJoining, actorId, tx)
      // the background checks (some may still be running) belong to the employee from now on
      await backgroundChecksService.linkToEmployee(input.candidateId, created.id, actorId, tx)
      temporaryPassword = await accountsService.createJoinerLogin(created.id, actorId, tx)
      // the tasks other teams do for the new employee (e-mail ID, laptop, ID card...), due from the date of joining
      joiningTasks = await joiningTasksService.createPlannedTasks(created.id, input.dateOfJoining, taskPlan, actorId, tx)
      return created
    })
  } catch (error) {
    await employeeDocumentsService.deleteFiles(copies)
    throw error
  }
  await documentsService.deleteFilesAfterJoining(documents)

  // the login goes to the employee's personal e-mail; without one (or if the e-mail fails) HR sees the temporary
  // password once and hands it over
  const { emailedTo } = await accountsService.emailNewLogin(employee.employeeCode, temporaryPassword)
  // the appointment letter (2026-11-16) - never stops the joining; without a ready template HR issues it later
  const appointmentLetter = await employeeLettersService.issueAppointmentOnJoining(employee.employeeCode, actorId)
  return {
    employeeCode: employee.employeeCode,
    appointmentLetter,
    // how many joining tasks were made
    joiningTasks,
    candidate: await candidatesService.getCandidateDetails(input.candidateId, viewer),
    login: { emailedTo, temporaryPassword: emailedTo ? null : temporaryPassword },
  }
}
