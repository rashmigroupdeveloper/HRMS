import type { ActorId, DbClient, DocumentType, DocumentVerificationStatus } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { copyFile, deleteFile, isOldKey, readStoredFile, saveFile, type FilePlace } from '#core/storage/file-storage'
import { cleanFileName, detectFileType, type DetectedFileType } from '#shared/utils/file-type'
import type { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { assertPart, canSeeEmployee, type EmployeeRef, getEmployeeFor, lookupPeople, seesPart } from '../employees.service.js'
import * as documentsRepository from './documents.repository.js'
import type { deleteEmployeeDocumentInput, reviewEmployeeDocumentInput, uploadEmployeeDocumentInput } from './documents.schema.js'

// Business rules for an employee's documents. They arrive from the candidate on the joining day (already reviewed by
// HR). Since 2026-11-25 employees may submit their own files for HR review; HR may still add files for others.
// Verified copies stay current until a replacement is verified; all submissions remain as history.

type DocumentRow = Awaited<ReturnType<typeof documentsRepository.list>>[number]

// Sensitive documents need the access of what they show too (2026-11-16, inspired by the old HRMS): copies of IDs and
// bank proof - and the PF / ESIC forms that print them - also "Employee · IDs, bank & statutory"; medical documents also
// "Employee · Medical"; the whole signed pack (it holds both) both. One's own documents: always. Since 2026-11-23 also
// the signed joining form (it prints the ID and bank numbers - JF §4 / §5) and the signed offer letter (it shows the CTC -
// "Employee · Salary"). The candidate's documents follow the same list (candidates/documents).
export type SensitiveArea = 'EMPLOYEE_IDS_BANK' | 'MEDICAL' | 'SALARY'
const SENSITIVE: Partial<Record<DocumentType, SensitiveArea[]>> = {
  SIGNED_JOINING_FORM: ['EMPLOYEE_IDS_BANK'],
  SIGNED_OFFER_LETTER: ['SALARY'],
  AADHAAR_COPY: ['EMPLOYEE_IDS_BANK'],
  PAN_COPY: ['EMPLOYEE_IDS_BANK'],
  PASSPORT_COPY: ['EMPLOYEE_IDS_BANK'],
  DRIVING_LICENCE_COPY: ['EMPLOYEE_IDS_BANK'],
  VISA_COPY: ['EMPLOYEE_IDS_BANK'],
  BANK_PROOF: ['EMPLOYEE_IDS_BANK'],
  EPF_FORM_11: ['EMPLOYEE_IDS_BANK'],
  ESIC_FORM_1: ['EMPLOYEE_IDS_BANK'],
  MEDICAL_FORM: ['MEDICAL'],
  MEDICAL_FITNESS_CERTIFICATE: ['MEDICAL'],
  SIGNED_FORMS_PACK: ['EMPLOYEE_IDS_BANK', 'MEDICAL'],
}
export const AREA_NAME: Record<SensitiveArea, string> = {
  EMPLOYEE_IDS_BANK: '"Employee · IDs, bank & statutory"',
  MEDICAL: '"Employee · Medical"',
  SALARY: '"Employee · Salary"',
}

// The access areas a document type needs besides the documents' own (empty: none)
export function sensitiveAreasOf(type: DocumentType): SensitiveArea[] {
  return SENSITIVE[type] ?? []
}

// The areas of a document type the viewer lacks for this employee (empty: they may open it)
function missingAreas(viewer: CurrentUser, employee: EmployeeRef, type: DocumentType) {
  return (SENSITIVE[type] ?? []).filter((area) => !seesPart(viewer, employee, area))
}
function assertMayOpen(viewer: CurrentUser, employee: EmployeeRef, type: DocumentType) {
  const missing = missingAreas(viewer, employee, type)
  if (missing.length) throw new ORPCError('FORBIDDEN', { message: `This document also needs the ${missing.map((a) => AREA_NAME[a]).join(' and ')} access` })
}

// a company transfer (2026-11-20): the employee's files move to the folder of their new code. Each file is copied and its
// row pointed at the copy, inside the caller's transaction; the caller deletes the old files once the transaction is
// saved (oldKeys) - or the copies if it fails (newKeys). A file missing on disk keeps its key (it cannot be copied).
export async function moveFilesToCode(employeeId: number, employeeCode: string, actorId: ActorId, tx: DbClient) {
  const moved = { oldKeys: [] as string[], newKeys: [] as string[] }
  for (const row of await documentsRepository.listFiles(employeeId, tx)) {
    let key: string
    try {
      key = await copyFile(row.storageKey, placeOf(employeeCode, row.type), { type: row.mimeType as DetectedFileType, storedOn: row.createdAt })
    } catch (error) {
      console.error(`[documents] ${row.storageKey} could not be copied to the new folder - it keeps its key:`, error)
      continue
    }
    moved.newKeys.push(key)
    moved.oldKeys.push(row.storageKey)
    await documentsRepository.updateStorageKey(row.id, key, actorId, tx)
  }
  return moved
}

// Stored as employees/<employee code>/<document type>/<date>_<random>.<ext> (e.g. employees/RML035384/AADHAAR_COPY/...)
const placeOf = (employeeCode: string, type: DocumentType): FilePlace => ({ area: 'employees', owner: [employeeCode], what: type })

// For the API: who uploaded / reviewed / deleted each document, as { employeeCode, name }
async function withPeople(rows: DocumentRow[]) {
  const person = await lookupPeople(rows.flatMap((d) => [d.createdById, d.reviewedById, d.deletedById]))
  return rows.map(({ createdById, reviewedById, deletedById, ...d }) => ({
    ...d,
    uploadedBy: person(createdById),
    reviewedBy: person(reviewedById),
    deletedBy: person(deletedById),
  }))
}

// The employee's documents, deleted ones included (isDeleted - kept as history), for the logged-in viewer
// (own record, or "Employee · Documents & letters" View). A sensitive one the viewer lacks the access for is listed `locked`: its
// type and dates show, its file name does not, and it cannot be opened or changed.
export async function listDocuments(viewer: CurrentUser, employeeCode: string) {
  const employee = await getEmployeeFor(viewer, employeeCode)
  assertPart(viewer, employee, 'EMPLOYEE_DOCUMENTS')
  const rows = await withPeople(await documentsRepository.list(employee.id))
  return rows.map((d) => {
    const locked = missingAreas(viewer, employee, d.type).length > 0
    return { ...d, locked, fileName: locked ? null : d.fileName }
  })
}

const noDocument = (id: number) => new ORPCError('NOT_FOUND', { message: `No document found with id ${id}` })

// The document with this id, if the viewer may see its employee - else NOT_FOUND, the same as an id that does not exist
// (2026-11-23, the review: it named the owner's employee code)
async function findVisible(viewer: CurrentUser, id: number) {
  const document = await documentsRepository.findById(id)
  if (!document || !canSeeEmployee(viewer, document.employee)) throw noDocument(id)
  return document
}

// The file itself, with its original name and type (own record, or "Employee · Documents & letters" View).
export async function downloadDocument(viewer: CurrentUser, id: number) {
  const document = await findVisible(viewer, id)
  assertPart(viewer, document.employee, 'EMPLOYEE_DOCUMENTS')
  assertMayOpen(viewer, document.employee, document.type)
  const bytes = await readStoredFile(document.storageKey)
  return new File([new Uint8Array(bytes)], document.fileName, { type: document.mimeType })
}

// A self-submitted file only counts after HR verifies it (e.g. consent before a BGV check).
// Existing HR-uploaded evidence retains its non-rejected/not-deleted rule.
export async function hasDocument(employeeId: number, type: DocumentType, db?: DbClient) {
  return (await documentsRepository.countNotRejected(employeeId, type, db)) > 0
}

export type MovedDocument = {
  type: DocumentType
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
  verificationStatus: DocumentVerificationStatus
  rejectionReason: string | null
  reviewedAt: Date | null
  reviewedById: number | null
  isDeleted: boolean
  deletedAt: Date | null
  deletedById: number | null
  deleteReason: string | null
  createdAt: Date
  createdById: number
}

// Joining day: the candidate's documents become the employee's. Each file is copied into the employee's folder
// (same file name) and the rows are added with the new keys; upload and review details are kept, and the move is
// recorded as a change by the actor. Returns the new keys - if the joining transaction fails, the caller deletes them
// with `deleteFiles`; if it succeeds, the caller deletes the candidate's originals.
export async function addMovedDocuments(employee: { id: number; employeeCode: string }, documents: MovedDocument[], actorId: ActorId, db?: DbClient) {
  const copies: string[] = []
  try {
    for (const d of documents) copies.push(await copyFile(d.storageKey, placeOf(employee.employeeCode, d.type)))
    if (documents.length) {
      await documentsRepository.createMany(
        documents.map((d, i) => ({ ...d, storageKey: copies[i]!, employeeId: employee.id, updatedById: actorId })),
        db,
      )
    }
  } catch (error) {
    await deleteFiles(copies)
    throw error
  }
  return copies
}

// Removes copies made by `addMovedDocuments` when the joining did not go through.
export async function deleteFiles(storageKeys: string[]) {
  for (const key of storageKeys) await deleteFile(key).catch((error: unknown) => console.error(`Could not delete ${key}:`, error))
}

// Gives files stored before the readable names (<folder>/<uuid>) their readable name. For
// scripts/rename-stored-files.ts; returns how many were renamed.
export async function renameOldFiles(actorId: ActorId) {
  let renamed = 0
  for (const row of await documentsRepository.listStorageKeys()) {
    if (!isOldKey(row.storageKey)) continue
    const storageKey = await copyFile(row.storageKey, placeOf(row.employee.employeeCode, row.type), {
      type: row.mimeType as DetectedFileType,
      storedOn: row.createdAt,
    })
    try {
      await documentsRepository.updateStorageKey(row.id, storageKey, actorId)
    } catch (error) {
      await deleteFile(storageKey)
      throw error
    }
    await deleteFile(row.storageKey)
    renamed++
  }
  return renamed
}

// --- Employee self-submission and scoped HR document management ---

// The document, for a change by `viewer` - "Employee · Documents & letters" Edit covering where the employee is (data access),
// plus a sensitive type's access
async function getDocument(id: number, viewer: CurrentUser) {
  const document = await findVisible(viewer, id)
  assertPart(viewer, document.employee, 'EMPLOYEE_DOCUMENTS', 'WRITE')
  assertMayOpen(viewer, document.employee, document.type)
  return document
}

async function withPeopleOne(row: DocumentRow) {
  const [document] = await withPeople([row])
  return document!
}

// Adds a document to the employee (PDF / JPG / PNG, checked from the file's content), waiting for review - stored as
// employees/<code>/<type>/<date>_<random>.<ext>
export async function uploadDocument({ employeeCode, type, file }: z.infer<typeof uploadEmployeeDocumentInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const employee = await getEmployeeFor(viewer, employeeCode)
  if (employee.id !== viewer.employeeId) assertPart(viewer, employee, 'EMPLOYEE_DOCUMENTS', 'WRITE')
  assertMayOpen(viewer, employee, type)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectFileType(bytes)
  if (!mimeType) throw new ORPCError('BAD_REQUEST', { message: 'Only PDF, JPG or PNG files can be uploaded' })
  const storageKey = await saveFile(placeOf(employee.employeeCode, type), mimeType, bytes)
  try {
    const document = await documentsRepository.create(
      { employeeId: employee.id, type, storageKey, fileName: cleanFileName(file.name), mimeType, sizeBytes: bytes.byteLength },
      actorId,
    )
    return await withPeopleOne(document)
  } catch (error) {
    await deleteFile(storageKey) // no row -> no orphan file
    throw error
  }
}

// Marks a document verified, or rejected with a reason
export async function reviewDocument({ id, status, rejectionReason }: z.infer<typeof reviewEmployeeDocumentInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const document = await getDocument(id, viewer)
  if (document.employee.employeeCode === viewer.employeeCode && document.createdById === viewer.employeeId) {
    throw new ORPCError('FORBIDDEN', { message: 'Your own submission must be reviewed by another authorized HR employee' })
  }
  if (document.isDeleted) throw new ORPCError('CONFLICT', { message: 'This document is deleted - restore it first' })
  if (status === 'REJECTED' && !rejectionReason) throw new ORPCError('BAD_REQUEST', { message: 'Give the reason for rejecting the document' })
  return withPeopleOne(
    await documentsRepository.update(
      id,
      { verificationStatus: status, rejectionReason: status === 'REJECTED' ? rejectionReason : null, reviewedAt: new Date(), reviewedById: actorId },
      actorId,
    ),
  )
}

// Deletes a wrong document - never erased: kept under "Deleted" with who, when and why, and can be restored. A verified
// one must be rejected first (as for candidates).
export async function deleteDocument({ id, reason }: z.infer<typeof deleteEmployeeDocumentInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const document = await getDocument(id, viewer)
  if (document.isDeleted) throw new ORPCError('CONFLICT', { message: 'This document is already deleted' })
  if (document.verificationStatus === 'VERIFIED') throw new ORPCError('CONFLICT', { message: 'A verified document cannot be deleted - reject it first' })
  return withPeopleOne(await documentsRepository.update(id, { isDeleted: true, deletedAt: new Date(), deletedById: actorId, deleteReason: reason }, actorId))
}

export async function restoreDocument(id: number, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const document = await getDocument(id, viewer)
  if (!document.isDeleted) throw new ORPCError('CONFLICT', { message: 'This document is not deleted' })
  return withPeopleOne(await documentsRepository.update(id, { isDeleted: false, deletedAt: null, deletedById: null, deleteReason: null }, actorId))
}
