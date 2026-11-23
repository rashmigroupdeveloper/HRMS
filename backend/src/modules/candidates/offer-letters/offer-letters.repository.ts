import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for offer letters (and the offer number sequence) - the only file that queries those tables.

const letterSelect = {
  id: true,
  candidateId: true,
  revision: true,
  kind: true,
  letterTemplate: { select: { id: true, name: true } },
  storageKey: true,
  sha256: true,
  sentAt: true,
  sentById: true,
  emailedAt: true,
  emailedById: true,
  otpHash: true,
  otpValidUntil: true,
  otpFailedAttempts: true,
  otpSentCount: true,
  otpSentAt: true,
  response: true,
  respondedAt: true,
  responseName: true,
  responseIp: true,
  responseUserAgent: true,
  declineReason: true,
} satisfies Prisma.OfferLetterSelect

export function listByCandidate(candidateId: number, db: DbClient = prisma) {
  return db.offerLetter.findMany({ where: { candidateId }, orderBy: { revision: 'desc' }, select: letterSelect })
}

// The letter with this id, or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.offerLetter.findUnique({ where: { id }, select: letterSelect })
}

// The letter whose link token has this SHA-256, or null.
export function findByTokenHash(linkTokenHash: string, db: DbClient = prisma) {
  return db.offerLetter.findUnique({ where: { linkTokenHash }, select: letterSelect })
}

// The newest letter of the candidate, or null
// How many letters of this kind were sent before this one (the LOI and the full offer share the revision numbers)
export function countEarlier(candidateId: number, kind: Prisma.OfferLetterWhereInput['kind'], revision: number, db: DbClient = prisma) {
  return db.offerLetter.count({ where: { candidateId, kind, revision: { lt: revision } } })
}

export function findLatest(candidateId: number, db: DbClient = prisma) {
  return db.offerLetter.findFirst({ where: { candidateId }, orderBy: { revision: 'desc' }, select: letterSelect })
}

export function create(data: NewRow<Prisma.OfferLetterUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.offerLetter.create({ data: { ...data, ...createdBy(actorId) }, select: letterSelect })
}

export function update(id: number, data: Prisma.OfferLetterUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.offerLetter.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: letterSelect })
}

// Gives out the next running number of the company's offers in `year` (1, 2, 3...)
// Every letter's storage key with what its readable name is built from (scripts/rename-stored-files.ts).
// data access: a one-off script (scripts/rename-stored-files.ts) - every file
export function listStorageKeys(db: DbClient = prisma) {
  return db.offerLetter.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, revision: true, storageKey: true, createdAt: true, candidate: { select: { offerNumber: true, company: { select: { code: true } } } } },
  })
}

