import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type DocumentType, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for candidate_documents.

// Returned to callers. The storage key is internal - files are only fetched through `download`.
const documentSelect = {
  id: true,
  type: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  verificationStatus: true,
  rejectionReason: true,
  reviewedAt: true,
  reviewedById: true,
  isDeleted: true,
  deletedAt: true,
  deletedById: true,
  deleteReason: true,
  createdAt: true,
  createdById: true,
} satisfies Prisma.CandidateDocumentSelect

export function list(candidateId: number, db: DbClient = prisma) {
  return db.candidateDocument.findMany({
    where: { candidateId },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    select: documentSelect,
  })
}

// The document with its owner and storage key (for service use only), or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.candidateDocument.findUnique({
    where: { id },
    select: { ...documentSelect, candidateId: true, storageKey: true },
  })
}

// How many documents of this type the candidate has that were not rejected (or deleted).
export function countNotRejected(candidateId: number, type: DocumentType, since?: Date, db: DbClient = prisma) {
  return db.candidateDocument.count({
    where: { candidateId, type, verificationStatus: { not: 'REJECTED' }, isDeleted: false, ...(since && { createdAt: { gte: since } }) },
  })
}

export function create(data: NewRow<Prisma.CandidateDocumentUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.candidateDocument.create({ data: { ...data, ...createdBy(actorId) }, select: documentSelect })
}

export function update(id: number, data: Prisma.CandidateDocumentUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.candidateDocument.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: documentSelect })
}

// Everything needed to move the candidate's documents to the new employee on the joining day (deleted ones too -
// they are kept as history).
export function listForMove(candidateId: number, db: DbClient = prisma) {
  return db.candidateDocument.findMany({
    where: { candidateId },
    orderBy: { id: 'asc' },
    select: {
      type: true,
      storageKey: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      verificationStatus: true,
      rejectionReason: true,
      reviewedAt: true,
      reviewedById: true,
      isDeleted: true,
      deletedAt: true,
      deletedById: true,
      deleteReason: true,
      createdAt: true,
      createdById: true,
    },
  })
}

// Every document's storage key with what its readable name is built from (scripts/rename-stored-files.ts).
// data access: a one-off script (scripts/rename-stored-files.ts) - every file
export function listStorageKeys(db: DbClient = prisma) {
  return db.candidateDocument.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, type: true, storageKey: true, mimeType: true, createdAt: true, candidate: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
  })
}

// Removes the rows after the move (the files now belong to the employee's documents).
export function deleteAllOfCandidate(candidateId: number, db: DbClient = prisma) {
  return db.candidateDocument.deleteMany({ where: { candidateId } })
}
