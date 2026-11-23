import type { CurrentUser } from '#core/rpc/procedures'
import { decrypt, encrypt } from '#core/crypto/encryption'
import { SYSTEM_ACTOR, type ActorId, type IdentityDocumentType, type JoiningType, type NominationScheme } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import { employeesSchemas, employeesService } from '#modules/employees'
import { parseWithDates, stringifyWithDates } from '#shared/utils/json'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as candidatesService from '../candidates.service.js'
import * as offerLettersService from '../offer-letters/offer-letters.service.js'
import * as joiningFormRepository from './joining-form.repository.js'
import type { JoiningForm, JoiningFormSection, saveJoiningFormInput, sendBackJoiningFormInput } from './joining-form.schema.js'

// Business rules for the joining form collected between acceptance and the joining day.
// - One draft, filled by the candidate on their page and / or by HR. The whole draft is stored encrypted (it holds
//   Aadhaar, PAN and bank numbers), with who changed each section last and when.
// - The candidate submits it with an online signature (typed name + the declaration + a one-time code); it is then
//   locked for them until HR sends it back with a reason. HR can still correct it. The printed form is also signed on
//   paper on the joining day (SIGNED_JOINING_FORM) - HR wants both.

// The candidate is the actor on their own page (no login): SYSTEM_ACTOR, shown as "Candidate (online)"
// `medical`: what an HR person may do with the medical information (MEDICAL area); the candidate always works on theirs
export type FormActor = { actorId: ActorId; isCandidate: boolean; medical?: { read: boolean; write: boolean } }
const CANDIDATE_ONLINE = { employeeCode: null, name: 'Candidate (online)' }

// The declaration of the joining form (JF §10) the candidate signs online - stored word for word with the signature
export const JOINING_DECLARATION =
  'I declare that the information given in this joining form and the documents I have uploaded are true, complete ' +
  'and correct to the best of my knowledge. I understand that false or missing information may lead to the ' +
  'withdrawal of my offer or the end of my employment. I authorise the company to verify this information and these ' +
  'documents, including through background checks. I understand that typing my name here is my signature.'

const IDENTITY_LABEL: Record<IdentityDocumentType, string> = {
  AADHAAR: 'Aadhaar number',
  PAN: 'PAN',
  FOREIGN_TAX_ID: 'tax id',
  PASSPORT: 'passport number',
  DRIVING_LICENCE: 'driving licence number',
}

// What is stored (encrypted): the sections + when / by whom each was last changed (the medical information also with
// the consent text it was given with - 2026-11-16)
type Changes = Partial<Record<JoiningFormSection, { at: Date; by: ActorId; text?: string }>>
type Stored = JoiningForm & { changes?: Changes }

async function readStored(candidateId: number): Promise<{ form: JoiningForm; changes: Changes }> {
  const encrypted = await joiningFormRepository.find(candidateId)
  const { changes = {}, ...form } = encrypted ? (parseWithDates(decrypt(encrypted)) as Stored) : {}
  return { form, changes }
}

// The draft (empty object if nothing was saved yet). Throws NOT_FOUND for an unknown candidate.
// HR opens the joining form (Onboarding View covering the candidate - data access); the medical part only with
// "Employee · Medical" View covering the candidate too
export async function getJoiningFormFor(viewer: CurrentUser, candidateId: number) {
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId)
  return getJoiningFormWithChanges(candidateId, { medical: candidatesService.viewerHasAt(viewer, candidate, 'MEDICAL', 'READ') })
}

// HR saves sections (Onboarding Edit covering the candidate; the medical part needs medical access covering them too)
export async function saveJoiningFormFor(viewer: CurrentUser, input: z.infer<typeof saveJoiningFormInput>) {
  const candidate = await candidatesService.getCandidateFor(viewer, input.candidateId, 'WRITE')
  return saveJoiningForm(input, {
    actorId: viewer.employeeId,
    isCandidate: false,
    medical: { read: candidatesService.viewerHasAt(viewer, candidate, 'MEDICAL', 'READ'), write: candidatesService.viewerHasAt(viewer, candidate, 'MEDICAL', 'WRITE') },
  })
}

export async function getJoiningForm(candidateId: number): Promise<JoiningForm> {
  await candidatesService.getCandidate(candidateId)
  return (await readStored(candidateId)).form
}

// The draft with who changed each section last ({ at, by: person }) - for HR and the candidate's page - and when it
// was read (`loadedAt`, sent back with a save so a section changed meanwhile is not overwritten).
// `medical: false` leaves the medical information out (an HR person without MEDICAL READ).
export async function getJoiningFormWithChanges(candidateId: number, { medical = true }: { medical?: boolean } = {}) {
  await candidatesService.getCandidate(candidateId)
  const stored = await readStored(candidateId)
  const { medical: _medical, ...withoutMedical } = stored.form
  const { medical: _medicalChange, ...changesWithoutMedical } = stored.changes
  const form: JoiningForm = medical ? stored.form : withoutMedical
  const changes: Changes = medical ? stored.changes : changesWithoutMedical
  const person = await employeesService.lookupPeople(Object.values(changes).map((c) => c.by))
  const named = Object.fromEntries(
    Object.entries(changes).map(([section, c]) => [section, { at: c.at, by: c.by === SYSTEM_ACTOR ? CANDIDATE_ONLINE : person(c.by) }]),
  ) as Partial<Record<JoiningFormSection, { at: Date; by: { employeeCode: string | null; name: string } | null }>>
  return { loadedAt: new Date(), form, changes: named }
}

// Saves the sections sent (each replaces the stored section) while the candidate is ACCEPTED.
// - The candidate cannot change a submitted form (HR sends it back first); HR always can.
// - Refused when someone else changed a sent section after `loadedAt` (the editor reloads instead of overwriting).
// - An identity number that already belongs to an employee is refused (duplicate, or a rehire - see BACKLOG.md); the
//   candidate is not told whose it is.
export async function saveJoiningForm(
  { candidateId, loadedAt, ...sections }: z.infer<typeof saveJoiningFormInput>,
  actor: FormActor,
) {
  const { actorId, isCandidate } = actor
  const candidate = await candidatesService.getCandidate(candidateId)
  if (candidate.status !== 'ACCEPTED') {
    throw new ORPCError('CONFLICT', {
      message: `The joining form can be filled only after the offer is accepted; this candidate is ${candidate.status}`,
    })
  }
  if (isCandidate && candidate.joiningFormSubmittedAt) {
    throw new ORPCError('CONFLICT', { message: 'You have already submitted your joining form. If something must change, please contact HR.' })
  }

  // EPS (the pension) is part of EPF: an earlier EPS member was an EPF member too
  if (sections.statutory?.wasEpsMember && !sections.statutory.wasEpfMember) {
    throw new ORPCError('BAD_REQUEST', { message: 'An earlier EPS (pension) member was also an EPF member - answer "Earlier EPF member" with Yes' })
  }

  // PF / ESIC, and the gratuity and ESIC nominations, are for the Regular pack only (Indian payroll schemes);
  // Consultant & Intern and Overseas give only the general nominee
  if (candidate.joiningType !== 'REGULAR') {
    if (sections.statutory) {
      throw new ORPCError('BAD_REQUEST', { message: 'PF and ESIC answers are only for regular employees' })
    }
    if (sections.gratuity) {
      throw new ORPCError('BAD_REQUEST', { message: 'The gratuity nomination (Form F) is only for regular employees' })
    }
    if (sections.nominees?.some((n) => n.scheme !== 'GENERAL')) {
      throw new ORPCError('BAD_REQUEST', { message: 'Gratuity and ESIC nominees are only for regular employees - give a general nominee' })
    }
  }

  // the medical information: not part of the Overseas form, and for HR only with MEDICAL WRITE
  const medicalAccess = isCandidate ? { read: true, write: true } : (actor.medical ?? { read: false, write: false })
  if (sections.medical) {
    if (candidate.joiningType === 'OVERSEAS') throw new ORPCError('BAD_REQUEST', { message: 'The medical information is not part of the overseas joining form' })
    if (!medicalAccess.write) throw new ORPCError('FORBIDDEN', { message: 'Changing the medical information needs the "Employee · Medical" access' })
  }

  for (const document of sections.identityDocuments ?? []) {
    const owner = await employeesService.findByIdentityNumber(document.type, document.number)
    if (owner) {
      throw new ORPCError('CONFLICT', {
        message: isCandidate
          ? `This ${IDENTITY_LABEL[document.type]} is already registered with us. Please check it - if it is right, HR will contact you.`
          : `This ${IDENTITY_LABEL[document.type]} already belongs to employee ${owner.employeeCode} (${owner.status})`,
      })
    }
  }

  const sent = Object.fromEntries(Object.entries(sections).filter(([, value]) => value !== undefined)) as JoiningForm
  const { form, changes } = await readStored(candidateId)
  if (loadedAt) {
    const changedMeanwhile = (Object.keys(sent) as JoiningFormSection[]).filter((s) => {
      const change = changes[s]
      return change && change.by !== actorId && change.at > loadedAt
    })
    if (changedMeanwhile.length) {
      throw new ORPCError('CONFLICT', {
        message: `${isCandidate ? 'HR' : 'Someone else'} changed this part of the form after you opened it. Reload the page to see the latest version.`,
      })
    }
  }
  // "No family members to list": adding a person unticks it; it cannot be ticked while people are listed
  if (sent.familyMembers?.length && form.noFamilyMembers) sent.noFamilyMembers = false
  if (sent.noFamilyMembers && (sent.familyMembers ?? form.familyMembers ?? []).length) {
    throw new ORPCError('BAD_REQUEST', { message: 'Remove the family members first - "no family members to list" is only for someone with nobody to list' })
  }
  const now = new Date()
  const stored: Stored = {
    ...form,
    ...sent,
    changes: {
      ...changes,
      ...Object.fromEntries(Object.keys(sent).map((s) => [s, s === 'medical' ? { at: now, by: actorId, text: employeesSchemas.MEDICAL_CONSENT_TEXT } : { at: now, by: actorId }])),
    },
  }
  await joiningFormRepository.update(candidateId, encrypt(stringifyWithDates(stored)), actorId)
  return getJoiningFormWithChanges(candidateId, { medical: medicalAccess.read })
}

// When and by whom the medical information was last saved - its consent (with the text agreed to), carried to the
// employee on the joining day
export async function getMedicalConsent(candidateId: number): Promise<{ at: Date; by: ActorId; text: string | null } | null> {
  const { changes } = await readStored(candidateId)
  return changes.medical ? { at: changes.medical.at, by: changes.medical.by, text: changes.medical.text ?? null } : null
}

// --- Completeness: what the form must contain before it can be submitted and before joining ---

// Identity numbers the joining form must contain, per pack
const REQUIRED_IDENTITY: Record<JoiningType, ('AADHAAR' | 'PAN' | 'PASSPORT')[]> = {
  REGULAR: ['AADHAAR', 'PAN'],
  CONSULTANT_INTERN: ['AADHAAR', 'PAN'],
  OVERSEAS: ['PASSPORT'],
}
const SHORT_IDENTITY_LABEL = { AADHAAR: 'Aadhaar', PAN: 'PAN', PASSPORT: 'passport' } as const
const NOMINEE_LABEL: Record<NominationScheme, string> = { GENERAL: 'joining-form', GRATUITY: 'gratuity', ESIC: 'ESIC' }
// The family details' people who are "family" under the Payment of Gratuity Act s.2(h): husband / wife, children,
// dependent parents, and for a woman her husband's dependent parents. `certain`: surely family; `counting`: also "Other"
// relatives (the widow and children of a son who died are family too), so they may be gratuity nominees
function gratuityFamilyOf(form: JoiningForm) {
  const parentsDependent = form.gratuity?.gratuityParentsNotDependent !== true
  const inLawsDependent = isMarriedWoman(form) && form.gratuity?.gratuityHusbandsParentsNotDependent !== true
  const certain = (form.familyMembers ?? []).filter(
    (m) =>
      ['SPOUSE', 'SON', 'DAUGHTER'].includes(m.relationship) ||
      (parentsDependent && ['FATHER', 'MOTHER'].includes(m.relationship)) ||
      (inLawsDependent && ['FATHER_IN_LAW', 'MOTHER_IN_LAW'].includes(m.relationship)),
  )
  return { certain, counting: [...certain, ...(form.familyMembers ?? []).filter((m) => m.relationship === 'OTHER')] }
}

// Form F "I have no family within the meaning of the Gratuity Act" - worked out, not asked (a candidate cannot be
// expected to know the Act): there is a family when there is a husband / wife (married or separated), a child in the
// family details, dependent parents, or - for a married woman - her husband's dependent parents. Undefined until the
// parents questions are answered
export function gratuityNoFamilyOf(form: JoiningForm): boolean | undefined {
  const gratuity = form.gratuity
  if (gratuity?.gratuityParentsNotDependent == null) return undefined
  if (isMarriedWoman(form) && gratuity.gratuityHusbandsParentsNotDependent == null) return undefined
  const hasFamily =
    hasSpouse(form) ||
    (form.familyMembers ?? []).some((m) => ['SPOUSE', 'SON', 'DAUGHTER'].includes(m.relationship)) ||
    gratuity.gratuityParentsNotDependent === false ||
    (isMarriedWoman(form) && gratuity.gratuityHusbandsParentsNotDependent === false)
  return !hasFamily
}

const hasSpouse = (form: JoiningForm) => form.personal?.maritalStatus === 'MARRIED' || form.personal?.maritalStatus === 'SEPARATED'
const isMarriedWoman = (form: JoiningForm) => form.personal?.gender === 'FEMALE' && form.personal?.maritalStatus === 'MARRIED'

const RELATION_WORD: Record<string, string> = {
  FATHER: 'father',
  MOTHER: 'mother',
  FATHER_IN_LAW: 'father-in-law',
  MOTHER_IN_LAW: 'mother-in-law',
  BROTHER: 'brother',
  SISTER: 'sister',
}

// Why a gratuity nominee is not allowed (someone with a family may nominate only them), in plain words - with the
// answer to change when that is the reason
function notFamilyReason(name: string, form: JoiningForm): string {
  const member = (form.familyMembers ?? []).find((m) => personKey(m.name) === personKey(name))
  const anyOf = 'your husband / wife, children, or parents who depend on you'
  if (!member) return `${name} is not in your family details. Pick your gratuity nominee from there - ${anyOf}.`
  const word = RELATION_WORD[member.relationship] ?? 'relative'
  if (member.relationship === 'FATHER' || member.relationship === 'MOTHER') {
    return `${name} is your ${word}, but you said your parents do not depend on you, so they cannot get your gratuity. If they depend on you, answer "Do your parents depend on your salary?" with Yes.`
  }
  if ((member.relationship === 'FATHER_IN_LAW' || member.relationship === 'MOTHER_IN_LAW') && isMarriedWoman(form)) {
    return `${name} is your ${word}, but you said your husband's parents do not depend on him, so they cannot get your gratuity. If they do, answer "Do your husband's parents depend on his salary?" with Yes.`
  }
  return `${name} is your ${word} - gratuity can go only to ${anyOf}.`
}

// A name compared loosely (case and extra spaces ignored)
const personKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

// "a, b and c"
const andList = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? ''))

export type FormCheck = { key: string; label: string; ok: boolean; detail: string | null }
const check = (key: string, label: string, ok: boolean, detail: string | null = null): FormCheck => ({ key, label, ok, detail })

// Each required part of the form for this joining-form pack, with whether it is filled
export function checkForm(pack: JoiningType, form: JoiningForm): FormCheck[] {
  const checks: FormCheck[] = []
  const personalMissing = [!form.personal?.gender && 'gender', !form.personal?.dateOfBirth && 'date of birth'].filter(Boolean)
  checks.push(check('personal', 'Joining form: personal details', personalMissing.length === 0, personalMissing.length ? `Missing ${personalMissing.join(' and ')}` : null))

  const addressTypes = new Set((form.addresses ?? []).map((a) => a.type))
  // every joining type gives both (decided 2026-11-14); other addresses are optional
  const neededAddresses = ['PERMANENT', 'PRESENT'] as const
  const missingAddresses = neededAddresses.filter((t) => !addressTypes.has(t)).map((t) => t.toLowerCase())
  checks.push(
    check(
      'addresses',
      `Joining form: ${neededAddresses.map((t) => t.toLowerCase()).join(' and ')} address`,
      missingAddresses.length === 0,
      missingAddresses.length ? `Missing ${missingAddresses.join(' and ')} address` : null,
    ),
  )

  checks.push(check('emergency', 'Joining form: an emergency contact', (form.emergencyContacts ?? []).length > 0))
  // JF §6 - at least one qualification, every joining type (decided 2026-11-15); certifications and previous jobs stay
  // optional (no courses, a first job)
  checks.push(check('education', 'Joining form: education (at least one qualification)', (form.qualifications ?? []).length > 0))
  // JF §6 family details and the nominees - compulsory (decided 2026-11-15)
  const family = form.familyMembers ?? []
  const married = form.personal?.maritalStatus === 'MARRIED'
  const noFamilyTicked = form.noFamilyMembers === true && family.length === 0
  checks.push(
    check(
      'family',
      'Joining form: family details (at least one person)',
      family.length > 0 || (noFamilyTicked && !married),
      noFamilyTicked && married ? '"No family members to list" is ticked, but the personal details say married - add the husband / wife' : null,
    ),
  )
  const gratuityFamily = gratuityFamilyOf(form)
  // the JF §4 nominee for everyone; Regular also the Gratuity Form F nominees and, when ESIC applies, the ESIC Form 1
  // nominee
  const nomineeSchemes = new Set((form.nominees ?? []).map((n) => n.scheme))
  const neededNominees: NominationScheme[] = ['GENERAL']
  if (pack === 'REGULAR') neededNominees.push('GRATUITY')
  if (pack === 'REGULAR' && form.statutory?.esicApplicable) neededNominees.push('ESIC')
  const missingNominees = neededNominees.filter((s) => !nomineeSchemes.has(s)).map((s) => NOMINEE_LABEL[s])
  // Gratuity Act s.6(4): someone with a family nominates only members of it
  const familyNames = new Set(gratuityFamily.counting.map((m) => personKey(m.name)))
  const outsiders =
    pack === 'REGULAR' && gratuityNoFamilyOf(form) === false
      ? (form.nominees ?? []).filter((n) => n.scheme === 'GRATUITY' && !familyNames.has(personKey(n.name))).map((n) => n.name)
      : []
  const nomineeProblems = [
    missingNominees.length ? `Missing ${andList(missingNominees)} nominee.` : null,
    ...outsiders.map((name) => notFamilyReason(name, form)),
  ].filter(Boolean)
  checks.push(
    check(
      'nominees',
      `Joining form: ${andList(neededNominees.map((s) => NOMINEE_LABEL[s]))} ${neededNominees.length > 1 ? 'nominees' : 'nominee'}`,
      nomineeProblems.length === 0,
      nomineeProblems.length ? nomineeProblems.join(' ') : null,
    ),
  )

  const identityTypes = new Set((form.identityDocuments ?? []).map((d) => d.type))
  const missingIds = REQUIRED_IDENTITY[pack].filter((t) => !identityTypes.has(t))
  checks.push(
    check(
      'identity',
      `Joining form: ${REQUIRED_IDENTITY[pack].map((t) => SHORT_IDENTITY_LABEL[t]).join(' and ')} number`,
      missingIds.length === 0,
      missingIds.length ? `Missing ${missingIds.map((t) => SHORT_IDENTITY_LABEL[t]).join(' and ')}` : null,
    ),
  )

  checks.push(check('bank', 'Joining form: salary bank account', !!form.bankAccount))
  // the medical pages are part of the Regular and Consultant & Intern forms
  if (pack !== 'OVERSEAS') checks.push(check('medicalInfo', 'Joining form: medical information', !!form.medical))
  if (pack === 'REGULAR') {
    // Gratuity Form F: whether the parents (and a married woman's husband's parents) depend on them - "I have no family"
    // is worked out from these and the family details (gratuityNoFamilyOf)
    const gratuity = form.gratuity
    const unanswered = [
      gratuity?.gratuityParentsNotDependent == null && 'whether your parents depend on you',
      isMarriedWoman(form) && gratuity?.gratuityHusbandsParentsNotDependent == null && "whether your husband's parents depend on him",
    ].filter(Boolean)
    checks.push(
      check('gratuity', 'Joining form: gratuity nomination (Form F)', unanswered.length === 0, unanswered.length ? `Answer ${unanswered.join(' and ')}` : null),
    )
    // EPF Form 11 prints the father's or the spouse's name - the spouse's needs one in the personal details
    // (only someone married, separated or widowed is asked for it)
    const spouseMissing = form.statutory?.epfRelative === 'SPOUSE' && !form.personal?.spouseName
    // dates EPF Form 11 prints that cannot be in the future (saved before the rule existed, 2026-11-15)
    const now = new Date()
    const futureDates = [
      form.statutory?.previousExitDate && form.statutory.previousExitDate > now && 'date of exit from the previous job',
      form.statutory?.firstEpfEnrolledOn && form.statutory.firstEpfEnrolledOn > now && 'first EPF enrolment date',
    ].filter(Boolean)
    const enrolledAfterExit =
      !!form.statutory?.firstEpfEnrolledOn && !!form.statutory.previousExitDate && form.statutory.firstEpfEnrolledOn > form.statutory.previousExitDate
    // "EPF member before 1 Sep 2014" must agree with the first enrolment date
    const enrolled = form.statutory?.firstEpfEnrolledOn
    const before2014 = form.statutory?.isEpfMemberBeforeSep2014
    const sep2014 = new Date(Date.UTC(2014, 8, 1))
    const before2014Wrong = !!enrolled && ((before2014 === true && enrolled >= sep2014) || (before2014 === false && enrolled < sep2014))
    const statutoryProblems = [
      spouseMissing && "Form 11 shows the spouse's name, but no spouse's name is given in the personal details",
      futureDates.length && `The ${futureDates.join(' and the ')} cannot be in the future - correct it in PF and ESIC`,
      enrolledAfterExit && 'The first EPF enrolment date is after the date of exit from the previous job',
      before2014Wrong && `"EPF member before 1 Sep 2014" is ${before2014 ? 'Yes' : 'No'}, but the first EPF enrolment date says otherwise`,
    ].filter(Boolean)
    checks.push(
      check(
        'statutory',
        'Joining form: PF and ESIC answers',
        !!form.statutory && statutoryProblems.length === 0,
        statutoryProblems.length ? statutoryProblems.join('. ') : null,
      ),
    )
  }
  return checks
}

export type PersonName = { firstName: string; middleName: string | null; lastName: string | null }

export const fullName = (c: PersonName) => [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')

// The candidate's name as in the joining form: the corrected name when the form has one, else the offer's. The
// candidate signs with it and the employee is created with it.
export function nameOnForm(candidate: PersonName, form: JoiningForm): PersonName {
  const personal = form.personal
  if (!personal?.firstName) return { firstName: candidate.firstName, middleName: candidate.middleName, lastName: candidate.lastName }
  return { firstName: personal.firstName, middleName: personal.middleName ?? null, lastName: personal.lastName ?? null }
}
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

export type Signature = { name: string; ip: string | null; userAgent: string | null }

// The candidate submits the form and signs it online (the one-time code was checked by the caller). Needs every
// required part filled and their full name typed as in the form (nameOnForm). Locks the form for the candidate and e-mails the
// HR person who sent the offer.
export async function submitJoiningForm(candidateId: number, signature: Signature, documentProblems: string[]) {
  const candidate = await candidatesService.getCandidate(candidateId)
  if (candidate.status !== 'ACCEPTED') throw new ORPCError('CONFLICT', { message: 'This joining form can no longer be submitted. Please contact HR.' })
  if (candidate.joiningFormSubmittedAt) throw new ORPCError('CONFLICT', { message: 'You have already submitted your joining form.' })
  const { form } = await readStored(candidateId)
  const missing = [
    ...checkForm(candidate.joiningType, form)
      .filter((c) => !c.ok)
      .map((c) => (c.detail ? `${c.label.replace('Joining form: ', '')} (${c.detail})` : c.label.replace('Joining form: ', ''))),
    ...documentProblems,
  ]
  if (missing.length) throw new ORPCError('BAD_REQUEST', { message: `Please complete these first: ${missing.join('; ')}` })
  const signName = fullName(nameOnForm(candidate, form))
  if (!sameName(signature.name, signName)) {
    throw new ORPCError('BAD_REQUEST', { message: `Type your full name exactly as it is in your joining form: ${signName}` })
  }
  const submittedAt = new Date()
  await joiningFormRepository.updateSubmission(
    candidateId,
    {
      joiningFormSubmittedAt: submittedAt,
      joiningFormSubmittedById: SYSTEM_ACTOR,
      joiningFormSignedName: signature.name.trim(),
      joiningFormDeclaration: JOINING_DECLARATION,
      joiningFormSignIp: signature.ip,
      joiningFormSignUserAgent: signature.userAgent?.slice(0, 500) ?? null,
      joiningFormReturnedAt: null,
      joiningFormReturnedById: null,
      joiningFormReturnReason: null,
    },
    SYSTEM_ACTOR,
  )
  void emailOfferSender(candidate, submittedAt).catch((error: unknown) =>
    console.error(`[mail] the joining-form e-mail to HR for candidate ${candidateId} failed:`, error),
  )
  return { submittedAt }
}

// "Joining form submitted" to the HR person who sent the offer (their work e-mail). In the background - a failure
// is only logged; HR also sees it on the candidate.
async function emailOfferSender(candidate: Awaited<ReturnType<typeof candidatesService.getCandidate>>, submittedAt: Date) {
  const sender = candidate.offerSentById ? await employeesService.findMailContact(candidate.offerSentById) : null
  if (!sender?.email) {
    console.warn(`[mail] candidate ${candidate.id} submitted the joining form, but the offer sender has no work e-mail`)
    return
  }
  await sendMail({
    to: sender.email,
    subject: `Joining form submitted: ${fullName(candidate)} (${candidate.offerNumber ?? 'offer'})`,
    text: [
      `Dear ${sender.name},`,
      '',
      `${fullName(candidate)} (${candidate.designation.name}, ${candidate.company.name}) submitted and signed the joining form online on ` +
        `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(submittedAt)} IST.`,
      '',
      'Please review the form and the uploaded documents on the candidate page in HRMS (Onboarding). If something must change,',
      'send the form back to the candidate with the reason.',
      '',
      'HRMS',
    ].join('\n'),
  })
}

// HR sends the submitted form back: the candidate can change it again and must submit it again. The previous
// signature is cleared (it no longer matches the form). The candidate is e-mailed a new link with HR's reason;
// HR sees whether that e-mail went out (and gets the link to share by hand).
export async function sendBackJoiningForm({ candidateId, reason }: z.infer<typeof sendBackJoiningFormInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId, 'WRITE')
  if (candidate.status !== 'ACCEPTED') {
    throw new ORPCError('CONFLICT', { message: `The joining form can be changed only before joining; this candidate is ${candidate.status}` })
  }
  if (!candidate.joiningFormSubmittedAt) throw new ORPCError('CONFLICT', { message: 'The candidate has not submitted the joining form yet' })
  await joiningFormRepository.updateSubmission(
    candidateId,
    {
      joiningFormSubmittedAt: null,
      joiningFormSubmittedById: null,
      joiningFormSignedName: null,
      joiningFormDeclaration: null,
      joiningFormSignIp: null,
      joiningFormSignUserAgent: null,
      joiningFormReturnedAt: new Date(),
      joiningFormReturnedById: actorId,
      joiningFormReturnReason: reason,
    },
    actorId,
  )
  const email = await offerLettersService.sendPortalLink(candidate.id, actorId, reason)
  return { candidate: await candidatesService.getCandidateDetails(candidateId, viewer), ...email }
}
