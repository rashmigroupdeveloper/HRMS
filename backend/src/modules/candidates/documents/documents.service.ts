import type { CurrentUser } from '#core/rpc/procedures'
import { SYSTEM_ACTOR, type ActorId, type CandidateStatus, type DbClient, type DocumentType, type JoiningType } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import { copyFile, deleteFile, isOldKey, namedOwner, readStoredFile, saveFile, type FilePlace } from '#core/storage/file-storage'
import { employeeDocumentsService, employeesService } from '#modules/employees'
import { cleanFileName, detectFileType, type DetectedFileType } from '#shared/utils/file-type'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as candidatesService from '../candidates.service.js'
import * as documentsRepository from './documents.repository.js'
import type { deleteDocumentInput, reviewDocumentInput, uploadDocumentInput } from './documents.schema.js'

// Business rules for documents collected before the joining day.
// Uploading, reviewing and deleting happen only while the candidate is ACCEPTED - except the signed offer letter,
// which HR uploads while the offer is out (OFFERED) to record a paper acceptance. Viewing works at any time.
// No document is ever erased: deleting hides it (who, when, why kept; the file stays) and it can be restored.

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  PHOTO: 'Photo',
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
  BANK_PROOF: 'Bank proof',
  BGV_CONSENT_FORM: 'BGV consent form',
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

// Documents that must be uploaded AND verified before joining, per joining-form pack.
// ESIC Form 1 only when ESIC applies (the PF / ESIC section of the joining form).
const REQUIRED_DOCUMENTS: Record<JoiningType, DocumentType[]> = {
  REGULAR: [
    'PHOTO',
    'SIGNED_JOINING_FORM',
    'EPF_FORM_11',
    'ESIC_FORM_1',
    'GRATUITY_FORM_F',
    'AADHAAR_COPY',
    'PAN_COPY',
    'BANK_PROOF',
    'MEDICAL_FORM',
  ],
  CONSULTANT_INTERN: ['PHOTO', 'SIGNED_JOINING_FORM', 'AADHAAR_COPY', 'PAN_COPY', 'BANK_PROOF', 'MEDICAL_FORM'],
  OVERSEAS: ['PHOTO', 'SIGNED_JOINING_FORM', 'PASSPORT_COPY'],
}

// A copy the candidate uploads on their own page (not a form signed on paper on the joining day)
export function isCandidateDocument(type: DocumentType): boolean {
  return (CANDIDATE_DOCUMENT_TYPES as readonly DocumentType[]).includes(type)
}

// The pack's compulsory documents plus the ones the offer asks for (Candidate.extraRequiredDocuments, 2026-11-20)
export function requiredDocuments(pack: JoiningType, esicApplicable: boolean, extra: readonly DocumentType[] = []): DocumentType[] {
  const compulsory = REQUIRED_DOCUMENTS[pack].filter((type) => type !== 'ESIC_FORM_1' || esicApplicable)
  return [...compulsory, ...extra.filter((type) => !compulsory.includes(type))]
}

// For the offer form's "Documents needed" checklist: what every pack always needs (ticked and locked) and what an offer
// may ask for on top. No personal data.
export function documentRequirements() {
  return {
    compulsory: REQUIRED_DOCUMENTS,
    requestable: REQUESTABLE_DOCUMENTS.map((type) => ({ type, label: DOCUMENT_LABEL[type] })),
  }
}

// Stored as candidates/<id>-<name>/<document type>/<date>_<random>.<ext> (e.g. candidates/183-neha-das/AADHAAR_COPY/...)
function placeOf(candidate: { id: number; firstName: string; middleName: string | null; lastName: string | null }, type: DocumentType): FilePlace {
  const name = [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(' ')
  return { area: 'candidates', owner: [namedOwner(candidate.id, name)], what: type }
}

function requirePreJoining(status: CandidateStatus, type: DocumentType) {
  if (type === 'SIGNED_OFFER_LETTER' && (status === 'OFFERED' || status === 'LOI_ACCEPTED' || status === 'ACCEPTED')) return
  if (status !== 'ACCEPTED') {
    throw new ORPCError('CONFLICT', {
      message: `Documents can be changed only after the offer is accepted and before joining; this candidate is ${status}`,
    })
  }
}

type DocumentRow = Awaited<ReturnType<typeof documentsRepository.list>>[number]

// The candidate on their own page (SYSTEM_ACTOR) - shown as such, not as "System"
const CANDIDATE_ONLINE = { employeeCode: null, name: 'Candidate (online)' }

// For the API: who uploaded / reviewed / deleted each document, as { employeeCode, name } (one lookup for all rows)
async function withPeople(rows: DocumentRow[]) {
  const person = await employeesService.lookupPeople(rows.flatMap((d) => [d.createdById, d.reviewedById, d.deletedById]))
  const byCandidate = (id: number | null) => (id === SYSTEM_ACTOR ? CANDIDATE_ONLINE : person(id))
  return rows.map(({ createdById, reviewedById, deletedById, ...d }) => ({
    ...d,
    uploadedBy: byCandidate(createdById),
    reviewedBy: person(reviewedById),
    deletedBy: byCandidate(deletedById),
  }))
}

async function withPeopleOne(row: DocumentRow) {
  const [document] = await withPeople([row])
  return document!
}

async function getDocument(id: number) {
  const document = await documentsRepository.findById(id)
  if (!document) throw new ORPCError('NOT_FOUND', { message: `No document found with id ${id}` })
  return document
}

// True if the candidate has uploaded this document and HR has not rejected or deleted it (pending or verified).
// since: only one uploaded from then on (the signed copy of the newest letter - not of the Letter of Intent before it)
export async function hasDocument(candidateId: number, type: DocumentType, since?: Date) {
  return (await documentsRepository.countNotRejected(candidateId, type, since)) > 0
}

// The documents with their storage keys, for the joining day (moved to the employee).
export function listForJoining(candidateId: number, db?: DbClient) {
  return documentsRepository.listForMove(candidateId, db)
}

// After the joining day copied them to the employee: the rows go in the joining transaction...
export async function removeAfterJoining(candidateId: number, db?: DbClient) {
  await documentsRepository.deleteAllOfCandidate(candidateId, db)
}

// ...and the candidate's files once it is saved (a file that cannot be deleted is only logged - the employee's copy
// is already in place).
export async function deleteFilesAfterJoining(documents: { storageKey: string }[]) {
  for (const { storageKey } of documents) {
    await deleteFile(storageKey).catch((error: unknown) => console.error(`Could not delete ${storageKey} after joining:`, error))
  }
}

// Gives files stored before the readable names (candidates/<uuid>) their readable name. For
// scripts/rename-stored-files.ts; returns how many were renamed.
export async function renameOldFiles(actorId: ActorId) {
  let renamed = 0
  for (const row of await documentsRepository.listStorageKeys()) {
    if (!isOldKey(row.storageKey)) continue
    const storageKey = await copyFile(row.storageKey, placeOf(row.candidate, row.type), {
      type: row.mimeType as DetectedFileType,
      storedOn: row.createdAt,
    })
    try {
      await documentsRepository.update(row.id, { storageKey }, actorId)
    } catch (error) {
      await deleteFile(storageKey)
      throw error
    }
    await deleteFile(row.storageKey)
    renamed++
  }
  return renamed
}

// All documents, deleted ones included (isDeleted). Empty once the candidate has joined - the documents then
// belong to the employee.
export async function listDocuments(candidateId: number, viewer: CurrentUser) {
  await candidatesService.getCandidateFor(viewer, candidateId)
  return withPeople(await documentsRepository.list(candidateId))
}

// Stores the file and records it as PENDING verification. Several files of one type are allowed
// (e.g. Aadhaar front and back).
// HR uploads a candidate's document (Onboarding Edit covering the candidate - data access)
export async function uploadDocumentFor(input: z.infer<typeof uploadDocumentInput>, viewer: CurrentUser) {
  await candidatesService.getCandidateFor(viewer, input.candidateId, 'WRITE')
  return uploadDocument(input, viewer.employeeId)
}

// (also the candidate on their joining-form page, by System)
export async function uploadDocument({ candidateId, type, file }: z.infer<typeof uploadDocumentInput>, actorId: ActorId) {
  const candidate = await candidatesService.getCandidate(candidateId)
  requirePreJoining(candidate.status, type)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectFileType(bytes)
  if (!mimeType) throw new ORPCError('BAD_REQUEST', { message: 'Only PDF, JPG or PNG files can be uploaded' })

  const storageKey = await saveFile(placeOf(candidate, type), mimeType, bytes)
  try {
    const document = await documentsRepository.create(
      { candidateId, type, storageKey, fileName: cleanFileName(file.name), mimeType, sizeBytes: bytes.byteLength },
      actorId,
    )
    return await withPeopleOne(document)
  } catch (error) {
    await deleteFile(storageKey) // no row -> no orphan file
    throw error
  }
}

// The file itself, with its original name and type.
// HR downloads a candidate's document (Onboarding View covering the candidate - data access). A sensitive one also needs
// the access of what it shows, as on the employee (2026-11-23: ID / bank copies, medical documents, the signed joining form
// and offer letter opened with Onboarding View alone)
export async function downloadDocument(id: number, viewer: CurrentUser) {
  const document = await getDocument(id)
  const candidate = await candidatesService.getCandidateFor(viewer, document.candidateId)
  const missing = employeeDocumentsService.sensitiveAreasOf(document.type).filter((area) => !candidatesService.viewerHasAt(viewer, candidate, area, 'READ'))
  if (missing.length) {
    throw new ORPCError('FORBIDDEN', { message: `This document also needs the ${missing.map((a) => employeeDocumentsService.AREA_NAME[a]).join(' and ')} access` })
  }
  return fileOf(document)
}
async function fileOf(document: { storageKey: string; fileName: string; mimeType: string }) {
  const bytes = await readStoredFile(document.storageKey)
  return new File([new Uint8Array(bytes)], document.fileName, { type: document.mimeType })
}

// HR's verdict after checking the document against the original. Can be changed again before joining.
export async function reviewDocument({ id, status, rejectionReason }: z.infer<typeof reviewDocumentInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const document = await getDocument(id)
  const candidate = await candidatesService.getCandidateFor(viewer, document.candidateId, 'WRITE')
  requirePreJoining(candidate.status, document.type)
  if (document.isDeleted) throw new ORPCError('CONFLICT', { message: 'This document is deleted - restore it first' })
  if (status === 'REJECTED' && !rejectionReason) {
    throw new ORPCError('BAD_REQUEST', { message: 'Give the reason for rejecting the document' })
  }
  const updated = await documentsRepository.update(
    id,
    {
      verificationStatus: status,
      rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      reviewedAt: new Date(),
      reviewedById: actorId,
    },
    actorId,
  )
  // the candidate is told, so they can upload it again (the user, 2026-11-20) - only for a document they uploaded
  // themselves, on their open joining-form page, only when it newly becomes rejected, and not when they have already
  // uploaded a newer copy that is not rejected (nothing left for them to do)
  if (status === 'REJECTED' && document.verificationStatus !== 'REJECTED' && document.createdById === SYSTEM_ACTOR && candidate.joiningFormOpenedAt) {
    void hasDocument(candidate.id, document.type, document.createdAt)
      .then((replaced) => (replaced ? undefined : emailRejection(candidate, document.type, rejectionReason!)))
      .catch((error: unknown) => console.error(`[mail] the document-rejected e-mail to candidate ${candidate.id} failed:`, error))
  }
  return withPeopleOne(updated)
}

// "Please upload it again" to the candidate. In the background - a failure is only logged; HR sees the rejection on
// the candidate and the candidate sees it on their page. No new link: a new link would stop the one they have.
async function emailRejection(
  candidate: { firstName: string; personalEmail: string | null; company: { name: string } },
  type: DocumentType,
  reason: string,
) {
  if (!candidate.personalEmail) return
  await sendMail({
    to: candidate.personalEmail,
    subject: `Please upload your ${DOCUMENT_LABEL[type].toLowerCase()} again - ${candidate.company.name}`,
    text: [
      `Dear ${candidate.firstName},`,
      '',
      `HR has checked the ${DOCUMENT_LABEL[type].toLowerCase()} you uploaded with your joining form and could not accept it:`,
      '',
      `  ${reason}`,
      '',
      'Please open your joining-form page with the link we e-mailed you before, go to "Documents" and upload a new one.',
      'If you cannot find the link, reply to HR and they will send you a new one.',
      '',
      `HR, ${candidate.company.name}`,
    ].join('\n'),
  })
}

// Deletes a wrong or rejected upload: it is hidden from the list and the checks, with who, when and why - the record
// and the file are kept, and it can be restored. A verified document is evidence and cannot be deleted (reject it first).
export async function deleteDocument(input: z.infer<typeof deleteDocumentInput>, viewer: CurrentUser) {
  await candidatesService.getCandidateFor(viewer, (await getDocument(input.id)).candidateId, 'WRITE')
  return deleteDocumentAs(input, viewer.employeeId)
}
// (also the candidate removing their own upload, by System)
async function deleteDocumentAs({ id, reason }: z.infer<typeof deleteDocumentInput>, actorId: ActorId) {
  const document = await getDocument(id)
  requirePreJoining((await candidatesService.getCandidate(document.candidateId)).status, document.type)
  if (document.isDeleted) throw new ORPCError('CONFLICT', { message: 'This document is already deleted' })
  if (document.verificationStatus === 'VERIFIED') {
    throw new ORPCError('CONFLICT', { message: 'A verified document cannot be deleted - reject it first' })
  }
  return withPeopleOne(await documentsRepository.update(id, { isDeleted: true, deletedAt: new Date(), deletedById: actorId, deleteReason: reason }, actorId))
}

// --- The candidate's own page (candidates.portal.*): only their documents ---

// Types the candidate uploads themselves; the statutory forms, the signed joining form, the medical form and the BGV
// consent are signed on paper and uploaded by HR
export const CANDIDATE_DOCUMENT_TYPES = [
  'PHOTO',
  'AADHAAR_COPY',
  'PAN_COPY',
  'PASSPORT_COPY',
  'BANK_PROOF',
  'CLASS_X_MARKSHEET',
  'CLASS_XII_MARKSHEET',
  'GRADUATION_CERTIFICATE',
  'POST_GRADUATION_CERTIFICATE',
  'EDUCATION_CERTIFICATE',
  'EXPERIENCE_LETTER',
  'DRIVING_LICENCE_COPY',
] as const satisfies DocumentType[]

// What an offer may ask for on top of the pack's compulsory documents (the user, 2026-11-20): the copies the candidate
// uploads, and the police verification certificate (HR uploads it)
export const REQUESTABLE_DOCUMENTS = [
  'PASSPORT_COPY',
  'CLASS_X_MARKSHEET',
  'CLASS_XII_MARKSHEET',
  'GRADUATION_CERTIFICATE',
  'POST_GRADUATION_CERTIFICATE',
  'EDUCATION_CERTIFICATE',
  'EXPERIENCE_LETTER',
  'DRIVING_LICENCE_COPY',
  'POLICE_VERIFICATION',
] as const satisfies DocumentType[]

// The candidate's documents, deleted ones left out, with what they need to see (not who reviewed them)
export async function listForCandidate(candidateId: number) {
  return (await documentsRepository.list(candidateId))
    .filter((d) => !d.isDeleted)
    .map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      verificationStatus: d.verificationStatus,
      rejectionReason: d.rejectionReason,
      createdAt: d.createdAt,
      // uploaded by the candidate (they may remove it while it is not reviewed) - otherwise by HR
      uploadedByYou: d.createdById === SYSTEM_ACTOR,
    }))
}

// One of this candidate's (not deleted) documents; NOT_FOUND for anyone else's
async function getOwnDocument(candidateId: number, id: number) {
  const document = await documentsRepository.findById(id)
  if (!document || document.candidateId !== candidateId || document.isDeleted) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
  return document
}

export async function downloadOwnDocument(candidateId: number, id: number) {
  return fileOf(await getOwnDocument(candidateId, id))
}

// The candidate removes their own upload before HR has reviewed it (a wrong file); kept like any deleted document
export async function removeOwnDocument(candidateId: number, id: number) {
  const document = await getOwnDocument(candidateId, id)
  if (document.createdById !== SYSTEM_ACTOR) throw new ORPCError('FORBIDDEN', { message: 'Only a document you uploaded can be removed' })
  if (document.verificationStatus !== 'PENDING') {
    throw new ORPCError('CONFLICT', { message: 'HR has already checked this document - upload a new file instead, or contact HR' })
  }
  await deleteDocumentAs({ id, reason: 'Removed by the candidate' }, SYSTEM_ACTOR)
}

// Brings a deleted document back (same rules as deleting).
export async function restoreDocument(id: number, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const document = await getDocument(id)
  requirePreJoining((await candidatesService.getCandidateFor(viewer, document.candidateId, 'WRITE')).status, document.type)
  if (!document.isDeleted) throw new ORPCError('CONFLICT', { message: 'This document is not deleted' })
  return withPeopleOne(await documentsRepository.update(id, { isDeleted: false, deletedAt: null, deletedById: null, deleteReason: null }, actorId))
}
