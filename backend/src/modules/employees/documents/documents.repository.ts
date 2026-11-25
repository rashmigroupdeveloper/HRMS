import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type DocumentType, type Prisma } from '#core/db/prisma'

// Database access for employee_documents.

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
} satisfies Prisma.EmployeeDocumentSelect

export function list(employeeId: number, db: DbClient = prisma) {
  return db.employeeDocument.findMany({
    where: { employeeId },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    select: documentSelect,
  })
}

// Every file of the employee (deleted documents too) - to move them to a new folder (a company transfer)
export function listFiles(employeeId: number, db: DbClient = prisma) {
  return db.employeeDocument.findMany({ where: { employeeId }, select: { id: true, type: true, storageKey: true, mimeType: true, createdAt: true } })
}

// The document with its storage key and the owner's code (for service use only), or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.employeeDocument.findUnique({
    where: { id },
    // the owner's code and where they are (data-access checks)
    select: { ...documentSelect, storageKey: true, employee: { select: { employeeCode: true, companyId: true, plantId: true, departmentId: true } } },
  })
}

// Self-submitted evidence only qualifies after verification; preserve the existing HR-upload rule.
export function countNotRejected(employeeId: number, type: DocumentType, db: DbClient = prisma) {
  return db.employeeDocument.count({ where: { employeeId, type, verificationStatus: { not: 'REJECTED' }, isDeleted: false, OR: [{ verificationStatus: 'VERIFIED' }, { createdById: { not: employeeId } }] } })
}

// Every document's storage key with what its readable name is built from (scripts/rename-stored-files.ts).
// data access: a one-off script (scripts/rename-stored-files.ts) - every file
export function listStorageKeys(db: DbClient = prisma) {
  return db.employeeDocument.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, type: true, storageKey: true, mimeType: true, createdAt: true, employee: { select: { employeeCode: true } } },
  })
}

export function updateStorageKey(id: number, storageKey: string, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeDocument.update({ where: { id }, data: { storageKey, ...updatedBy(actorId) }, select: { id: true } })
}

// Documents moved from the candidate on the joining day, with their review and "by" columns as they were.
export function createMany(rows: Prisma.EmployeeDocumentCreateManyInput[], db: DbClient = prisma) {
  return db.employeeDocument.createMany({ data: rows })
}

// A new document, always pending review; the caller supplies no review state.
export function create(
  data: { employeeId: number; type: DocumentType; storageKey: string; fileName: string; mimeType: string; sizeBytes: number },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.employeeDocument.create({ data: { ...data, ...createdBy(actorId) }, select: documentSelect })
}

// Its review (verified / rejected) or its deletion / restoring
export function update(id: number, data: Prisma.EmployeeDocumentUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeDocument.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: documentSelect })
}
