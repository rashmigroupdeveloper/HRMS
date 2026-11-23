import type { IncomingHttpHeaders } from 'node:http'
import {
  clearCandidateSessionCookie,
  hashSessionToken,
  newSessionToken,
  readCandidateSessionToken,
  writeCandidateSessionCookie,
} from '#core/auth/session'
import { SYSTEM_ACTOR } from '#core/db/prisma'
import type { CurrentCandidate } from '#core/rpc/procedures'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as candidatesService from '../candidates.service.js'
import * as documentsService from '../documents/documents.service.js'
import { saveJoiningFormInput, type JoiningForm } from '../joining-form/joining-form.schema.js'
import * as joiningFormService from '../joining-form/joining-form.service.js'
import * as offerLettersService from '../offer-letters/offer-letters.service.js'
import * as portalRepository from './portal.repository.js'
import type { savePortalFormInput, signInInput, submitPortalFormInput, uploadPortalDocumentInput } from './portal.schema.js'

// The candidate's own joining-form page, after accepting the offer (online or on paper):
// - Signing in: the link from the offer e-mail + a one-time code sent to their e-mail -> a session in its own cookie,
//   ended after an hour without use or when the candidate is no longer ACCEPTED.
// - They fill the same joining form HR sees (joining-form service, recorded as "Candidate (online)") and upload their
//   own documents (photo, KYC copies, bank proof, certificates); HR verifies them.
// - Saved Aadhaar / PAN / passport / bank numbers come back only as their last 4 digits.
// - Submitting = signing online (declaration + typed name + a fresh code); the form is then locked for them.
// Everything is limited to the signed-in candidate - an id from the request never picks another candidate.

const SESSION_MINUTES = 60

// --- Session ---

export async function signIn({ token, code }: z.infer<typeof signInInput>, resHeaders: Headers | undefined) {
  const candidateId = await offerLettersService.checkJoiningFormCode(token, code)
  const now = new Date()
  await portalRepository.deleteExpiredSessions(candidateId, now)
  const sessionToken = newSessionToken()
  await portalRepository.createSession({ candidateId, tokenHash: hashSessionToken(sessionToken), expiresAt: new Date(now.getTime() + SESSION_MINUTES * 60_000) })
  writeCandidateSessionCookie(resHeaders, sessionToken)
  return getPortal(candidateId)
}

// The signed-in candidate from the cookie, or null (unknown / ended session, or no longer ACCEPTED). Each use moves
// the end of the session on (written at most every 5 minutes).
export async function resolveCandidate(headers: IncomingHttpHeaders): Promise<CurrentCandidate | null> {
  const token = readCandidateSessionToken(headers)
  if (!token) return null
  const session = await portalRepository.findSessionByTokenHash(hashSessionToken(token))
  const now = Date.now()
  if (!session || session.expiresAt.getTime() <= now || session.candidate.status !== 'ACCEPTED') return null
  if (session.expiresAt.getTime() - now < (SESSION_MINUTES - 5) * 60_000) {
    await portalRepository.extendSession(session.id, new Date(now + SESSION_MINUTES * 60_000))
  }
  return { sessionId: session.id, candidateId: session.candidateId }
}

export async function signOut(current: CurrentCandidate, resHeaders: Headers | undefined) {
  await portalRepository.deleteSession(current.sessionId)
  clearCandidateSessionCookie(resHeaders)
  return { signedOut: true }
}

// --- What the page shows ---

const { fullName } = joiningFormService
const last4 = (value: string) => value.slice(-4)

// The form as the candidate sees it: saved numbers only as their last 4 digits
function masked(form: JoiningForm) {
  return {
    ...form,
    identityDocuments: form.identityDocuments?.map(({ number, ...doc }) => ({ ...doc, numberLast4: last4(number) })),
    bankAccount: form.bankAccount && (({ accountNumber, ...bank }) => ({ ...bank, accountNumberLast4: last4(accountNumber) }))(form.bankAccount),
    familyMembers: form.familyMembers?.map(({ aadhaar, ...member }) => ({ ...member, aadhaarLast4: aadhaar ? last4(aadhaar) : undefined })),
  }
}

export async function getPortal(candidateId: number) {
  const candidate = await candidatesService.getCandidate(candidateId)
  const { form, changes } = await joiningFormService.getJoiningFormWithChanges(candidateId)
  const required = documentsService.requiredDocuments(candidate.joiningType, form.statutory?.esicApplicable === true, candidate.extraRequiredDocuments)
  return {
    candidate: {
      name: fullName(candidate),
      // what HR typed on the offer: the form starts with the name and the mobile (the candidate can correct them) and
      // shows the personal e-mail (only HR changes it - the codes go to it)
      fromOffer: {
        firstName: candidate.firstName,
        middleName: candidate.middleName,
        lastName: candidate.lastName,
        mobile: candidate.mobile,
        personalEmail: candidate.personalEmail,
      },
      // the name to type when signing: the form's (corrected) name, else the offer's
      signName: fullName(joiningFormService.nameOnForm(candidate, form)),
      company: candidate.company.name,
      designation: candidate.designation.name,
      workLocation: candidate.workLocation?.name ?? null,
      joiningDate: candidate.proposedJoiningDate,
      // decides which sections are needed (e.g. no PF / ESIC for Overseas)
      joiningType: candidate.joiningType,
    },
    // when this was read - sent back with a save, so a section HR changed meanwhile is not overwritten
    loadedAt: new Date(),
    form: masked(form),
    // who last changed each section: the candidate or HR (names of HR people are not shown)
    changes: Object.fromEntries(Object.entries(changes).map(([section, c]) => [section, { at: c.at, byHr: c.by?.employeeCode !== null }])),
    // the required parts of the form and whether each is filled
    checks: joiningFormService.checkForm(candidate.joiningType, form).map(({ key, label, ok, detail }) => ({ key, label: label.replace('Joining form: ', ''), ok, detail })),
    submission: {
      submittedAt: candidate.joiningFormSubmittedAt,
      signedName: candidate.joiningFormSignedName,
      returnedAt: candidate.joiningFormReturnedAt,
      returnReason: candidate.joiningFormReturnReason,
    },
    declaration: joiningFormService.JOINING_DECLARATION,
    documents: await documentsService.listForCandidate(candidateId),
    documentTypes: documentsService.CANDIDATE_DOCUMENT_TYPES.map((type) => ({ type, label: documentsService.DOCUMENT_LABEL[type], required: required.includes(type) })),
  }
}

// --- Filling the form ---

// Puts the kept (masked) numbers back from the saved form; a new item without a number must give one
function withKeptNumbers(input: z.infer<typeof savePortalFormInput>, saved: JoiningForm) {
  const missing = (what: string): never => {
    throw new ORPCError('BAD_REQUEST', { message: `Enter the ${what}` })
  }
  const identityDocuments = input.identityDocuments?.map((doc) => ({
    ...doc,
    number: doc.number ?? saved.identityDocuments?.find((s) => s.type === doc.type)?.number ?? missing(`${doc.type.replace('_', ' ').toLowerCase()} number`),
  }))
  const bankAccount = input.bankAccount && {
    ...input.bankAccount,
    accountNumber: input.bankAccount.accountNumber ?? saved.bankAccount?.accountNumber ?? missing('bank account number'),
  }
  const familyMembers = input.familyMembers?.map(({ aadhaarLast4, ...member }) => {
    if (member.aadhaar || !aadhaarLast4) return member
    const kept = saved.familyMembers?.find(
      (s) => s.aadhaar && last4(s.aadhaar) === aadhaarLast4 && s.name.trim().toLowerCase() === member.name.trim().toLowerCase(),
    )?.aadhaar
    return { ...member, aadhaar: kept ?? missing(`Aadhaar number of ${member.name} again`) }
  })
  return { ...input, identityDocuments, bankAccount, familyMembers }
}

export async function saveForm(candidateId: number, input: z.infer<typeof savePortalFormInput>) {
  const saved = await joiningFormService.getJoiningForm(candidateId)
  const sections = saveJoiningFormInput.parse({ ...withKeptNumbers(input, saved), candidateId })
  await joiningFormService.saveJoiningForm(sections, { actorId: SYSTEM_ACTOR, isCandidate: true })
  return getPortal(candidateId)
}

// --- Documents ---

export async function uploadDocument(candidateId: number, { type, file }: z.infer<typeof uploadPortalDocumentInput>) {
  await documentsService.assertCanUploadMore(candidateId, type)
  await documentsService.uploadDocument({ candidateId, type, file }, SYSTEM_ACTOR)
  return getPortal(candidateId)
}

export async function removeDocument(candidateId: number, id: number) {
  await documentsService.removeOwnDocument(candidateId, id)
  return getPortal(candidateId)
}

export function downloadDocument(candidateId: number, id: number) {
  return documentsService.downloadOwnDocument(candidateId, id)
}

// --- Submitting = signing online ---

export type Proof = { ip: string | null; userAgent: string | null }

export async function submit(candidateId: number, { code, name }: z.infer<typeof submitPortalFormInput>, proof: Proof) {
  const candidate = await candidatesService.getCandidate(candidateId)
  if (candidate.joiningFormSubmittedAt) throw new ORPCError('CONFLICT', { message: 'You have already submitted your joining form.' })
  // the documents the candidate uploads themselves must be there (HR verifies them later)
  const form = await joiningFormService.getJoiningForm(candidateId)
  const uploaded = await documentsService.listForCandidate(candidateId)
  const toUpload = documentsService
    .requiredDocuments(candidate.joiningType, form.statutory?.esicApplicable === true, candidate.extraRequiredDocuments)
    .filter((type) => (documentsService.CANDIDATE_DOCUMENT_TYPES as readonly string[]).includes(type))
    .filter((type) => !uploaded.some((d) => d.type === type && d.verificationStatus !== 'REJECTED'))
  const documentProblems = toUpload.length ? [`documents to upload: ${toUpload.map((type) => documentsService.DOCUMENT_LABEL[type]).join(', ')}`] : []
  const signature = { name, ip: proof.ip, userAgent: proof.userAgent }
  // the form first, then the code - used only once the form is saved (2026-11-23, the review: a refused submit used it up)
  await joiningFormService.checkSubmission(candidateId, signature, documentProblems)
  await offerLettersService.checkSigningCode(candidateId, code)
  await joiningFormService.submitJoiningForm(candidateId, signature, documentProblems)
  await offerLettersService.signingCodeUsed(candidateId)
  return getPortal(candidateId)
}
