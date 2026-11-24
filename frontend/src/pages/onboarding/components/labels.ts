import type { Tone } from '@/components/Pill'
import type { client } from '@/lib/orpc'
import { formatDate, toDateInput, todayDay } from '@/lib/utils'

// Display labels for every backend enum used on the onboarding page. The keys are typed from the API, so a
// renamed or added value in the backend shows up here as a TypeScript error.

export type Candidate = Awaited<ReturnType<typeof client.candidates.get>>

// Where a candidate is placed - for useAccess().covers('ONBOARDING', 'WRITE', ...): the backend lets Onboarding Edit change
// only candidates its data access covers, so the buttons follow the same (not only can('ONBOARDING', 'WRITE'))
export const candidatePlace = (c: { company: { id: number }; plant: { id: number }; department: { id: number } | null }) => ({
  companyId: c.company.id,
  plantId: c.plant.id,
  departmentId: c.department?.id ?? null,
})
export type CandidateRow = Awaited<ReturnType<typeof client.candidates.list>>[number]
export type CandidateStatus = Candidate['status']
export type JoiningForm = Awaited<ReturnType<typeof client.candidates.joiningForm.get>>
export type CandidateDocument = Awaited<ReturnType<typeof client.candidates.documents.list>>[number]
export type BackgroundCheck = Awaited<ReturnType<typeof client.candidates.backgroundChecks.list>>[number]
export type OfferLetter = Awaited<ReturnType<typeof client.candidates.offerLetters.list>>[number]
export type SalaryComponent = Awaited<ReturnType<typeof client.organization.salaryComponents.list>>[number]

export { type Option, toOptions } from '@/lib/form-values'

export const STATUS_LABEL: Record<CandidateStatus, string> = {
  DRAFT: 'Draft',
  OFFERED: 'Offer sent',
  LOI_ACCEPTED: 'LOI accepted · offer to send',
  ACCEPTED: 'Accepted · pre-joining',
  JOINED: 'Joined',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  WITHDRAWN: 'Withdrawn',
  BACKED_OUT: 'Backed out',
  NO_SHOW: 'No-show',
}
export const CLOSED_STATUSES: CandidateStatus[] = ['DECLINED', 'EXPIRED', 'WITHDRAWN', 'BACKED_OUT', 'NO_SHOW']

// A letter was sent and no full offer yet: it is the Letter of Intent (2026-11-16 - the full offer gets its number when
// sent, and no Letter of Intent can follow it)
export const loiOut = (c: { status: CandidateStatus; offerNumber: string | null }) => c.status === 'OFFERED' && !c.offerNumber
// The status as shown: "Letter of Intent sent" while the LOI is out
export const statusLabel = (c: { status: CandidateStatus; offerNumber: string | null }) => (loiOut(c) ? 'Letter of Intent sent' : STATUS_LABEL[c.status])

// The two letters sent to a candidate
export type SentKind = 'LETTER_OF_INTENT' | 'OFFER_LETTER'
// A candidate's way from the offer to the joining day - the progress bar of each row on the onboarding page (and its
// skeleton)
export const PROGRESS_STEPS = ['Offer sent', 'Accepted', 'Joining form signed', 'Joining confirmed', 'Joined'] as const

// How far a candidate is on PROGRESS_STEPS, and what comes next in words (the onboarding list and the candidate's page)
type ProgressOf = Pick<
  CandidateRow,
  'status' | 'offerNumber' | 'offerSentAt' | 'acceptedAt' | 'joiningFormSubmittedAt' | 'joiningFormReturnedAt' | 'joiningConfirmedAt' | 'closedAt' | 'employee'
>
export function progressOf(r: ProgressOf): { done: number; next: string } {
  if (r.status === 'JOINED') return { done: PROGRESS_STEPS.length, next: r.employee ? `Employee ${r.employee.employeeCode}` : 'Joined' }
  const reached = [!!r.offerSentAt, !!r.acceptedAt, !!r.joiningFormSubmittedAt, !!r.joiningConfirmedAt]
  const done = reached.indexOf(false) === -1 ? reached.length : reached.indexOf(false)
  if (CLOSED_STATUSES.includes(r.status)) return { done, next: `Closed ${r.closedAt ? formatDate(r.closedAt) : ''}`.trim() }
  if (r.status === 'DRAFT') return { done, next: 'Next: send the offer' }
  if (r.status === 'OFFERED') return { done, next: loiOut(r) ? 'Waiting for the LOI answer' : 'Waiting for the answer' }
  if (r.status === 'LOI_ACCEPTED') return { done, next: 'Next: send the full offer' }
  if (!r.joiningFormSubmittedAt) return { done, next: r.joiningFormReturnedAt ? 'Joining form sent back' : 'Next: joining form' }
  if (!r.joiningConfirmedAt) return { done, next: 'Next: confirm the joining' }
  return { done, next: 'Ready to join' }
}

export const SENT_KIND: Record<SentKind, string> = { LETTER_OF_INTENT: 'Letter of Intent', OFFER_LETTER: 'Offer letter' }

export const SALUTATION: Record<NonNullable<Candidate['salutation']>, string> = { MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.' }

export const JOINING_TYPE: Record<Candidate['joiningType'], string> = {
  REGULAR: 'Regular',
  CONSULTANT_INTERN: 'Consultant & Intern',
  OVERSEAS: 'Overseas',
}
export const EMPLOYMENT_TYPE: Record<Candidate['employmentType'], string> = {
  PERMANENT: 'Permanent',
  CONTRACT: 'Contract',
  TRAINEE: 'Trainee / Intern',
  CONSULTANT: 'Consultant',
  APPRENTICE: 'Apprentice',
}
// Which employment types go with which joining type - the server checks the same (candidates.service EMPLOYMENT_TYPES_FOR)
export const EMPLOYMENT_TYPES_FOR: Record<Candidate['joiningType'], Candidate['employmentType'][]> = {
  REGULAR: ['PERMANENT', 'CONTRACT'],
  CONSULTANT_INTERN: ['CONSULTANT', 'TRAINEE', 'APPRENTICE'],
  OVERSEAS: ['PERMANENT', 'CONTRACT', 'CONSULTANT', 'TRAINEE'],
}
// Fixed-period engagements: the offer needs a contract end date (a consultant's is optional, a permanent one has none)
export const FIXED_PERIOD: Candidate['employmentType'][] = ['CONTRACT', 'TRAINEE', 'APPRENTICE']
export const WORKFORCE: Record<Candidate['workforceCategory'], string> = {
  WHITE_COLLAR: 'White collar (staff)',
  BLUE_COLLAR: 'Blue collar (plant)',
}
export const MEDICAL_RESULT: Record<NonNullable<Candidate['medicalResult']>, string> = {
  FIT: 'Fit',
  FIT_WITH_RESTRICTIONS: 'Fit with restrictions',
  UNFIT: 'Unfit',
}
export const DOCUMENT_TYPE: Record<CandidateDocument['type'], string> = {
  PHOTO: 'Photograph',
  SIGNED_JOINING_FORM: 'Signed joining form',
  SIGNED_FORMS_PACK: 'Signed forms pack (all pages)',
  MEDICAL_FORM: 'Medical form',
  MEDICAL_FITNESS_CERTIFICATE: 'Medical fitness certificate',
  EPF_FORM_11: 'EPF Form 11',
  ESIC_FORM_1: 'ESIC Form 1',
  GRATUITY_FORM_F: 'Gratuity Form F',
  AADHAAR_COPY: 'Aadhaar copy',
  PAN_COPY: 'PAN copy',
  PASSPORT_COPY: 'Passport copy',
  BANK_PROOF: 'Bank proof (cheque / passbook)',
  BGV_CONSENT_FORM: 'BGV consent form (signed)',
  SIGNED_OFFER_LETTER: 'Signed offer letter',
  EDUCATION_CERTIFICATE: 'Other education certificate',
  CLASS_X_MARKSHEET: 'Class X marksheet',
  CLASS_XII_MARKSHEET: 'Class XII marksheet',
  GRADUATION_CERTIFICATE: 'Graduation certificate',
  POST_GRADUATION_CERTIFICATE: 'Post-graduation certificate',
  EXPERIENCE_LETTER: 'Experience / relieving letter',
  DRIVING_LICENCE_COPY: 'Driving licence copy',
  VISA_COPY: 'Visa / residence permit',
  WORK_PERMIT_COPY: 'Work permit / labour card',
  TRADE_LICENCE_COPY: 'Trade / safety licence',
  POLICE_VERIFICATION: 'Police verification certificate',
}
export const VERIFICATION: Record<CandidateDocument['verificationStatus'], string> = {
  PENDING: 'To verify',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
}
export const BGV_TYPE: Record<BackgroundCheck['type'], string> = {
  IDENTITY: 'Identity',
  ADDRESS: 'Address',
  EDUCATION: 'Education',
  EMPLOYMENT: 'Previous employment',
  CRIMINAL: 'Criminal record',
  REFERENCE: 'Reference',
}
export const BGV_STATUS: Record<BackgroundCheck['status'], string> = {
  IN_PROGRESS: 'In progress',
  CLEAR: 'Clear',
  DISCREPANCY: 'Discrepancy',
  FAILED: 'Failed',
}


// The joining day is today or gone - a confirmation call is no longer possible (the API refuses it)
export function joiningDayCome(c: { proposedJoiningDate: Date }) {
  return toDateInput(c.proposedJoiningDate) <= toDateInput(todayDay())
}

// Accepted but not joined, and the joining day is gone (the date has probably moved)
export function joiningDatePassed(c: { status: string; proposedJoiningDate: Date }) {
  return c.status === 'ACCEPTED' && toDateInput(c.proposedJoiningDate) < toDateInput(todayDay())
}

export function fullName(c: { firstName: string; middleName: string | null; lastName: string | null }) {
  return [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')
}

// Colour of each status pill (see Pill.tsx)

export const STATUS_TONE: Record<CandidateStatus, Tone> = {
  DRAFT: 'neutral',
  OFFERED: 'info',
  LOI_ACCEPTED: 'info',
  ACCEPTED: 'gold',
  JOINED: 'positive',
  DECLINED: 'negative',
  EXPIRED: 'neutral',
  WITHDRAWN: 'negative',
  BACKED_OUT: 'negative',
  NO_SHOW: 'negative',
}

export const VERIFICATION_TONE: Record<CandidateDocument['verificationStatus'], Tone> = {
  PENDING: 'warning',
  VERIFIED: 'positive',
  REJECTED: 'negative',
}

export const BGV_TONE: Record<BackgroundCheck['status'], Tone> = {
  IN_PROGRESS: 'warning',
  CLEAR: 'positive',
  DISCREPANCY: 'warning',
  FAILED: 'negative',
}
