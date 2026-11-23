import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type LetterheadPart, type LetterKind, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for letter templates and their letterhead images - the only file that queries the letter_templates
// and letterhead_images tables.

const templateSummarySelect = {
  id: true,
  kind: true,
  joiningType: true,
  name: true,
  // the letterhead images (the storage keys stay in the service - only the ids go to the API)
  headerImageId: true,
  footerImageId: true,
  signatureImageId: true,
  headerImage: { select: { storageKey: true } },
  footerImage: { select: { storageKey: true } },
  signatureImage: { select: { storageKey: true } },
  isActive: true,
  updatedAt: true,
  updatedById: true,
} satisfies Prisma.LetterTemplateSelect

const templateSelect = { ...templateSummarySelect, body: true, createdAt: true, createdById: true } satisfies Prisma.LetterTemplateSelect

export function list(db: DbClient = prisma) {
  return db.letterTemplate.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }], select: templateSummarySelect })
}

// The template with this id, or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.letterTemplate.findUnique({ where: { id }, select: templateSelect })
}

// The active templates of this kind, by name (without the letter text)
export function listActive(kind: LetterKind, db: DbClient = prisma) {
  return db.letterTemplate.findMany({ where: { kind, isActive: true }, orderBy: { name: 'asc' }, select: templateSummarySelect })
}

export function create(data: NewRow<Prisma.LetterTemplateUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.letterTemplate.create({ data: { ...data, ...createdBy(actorId) }, select: templateSelect })
}

export function update(id: number, data: Prisma.LetterTemplateUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.letterTemplate.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: templateSelect })
}

// --- Letterhead images ---

const templateRef = { select: { id: true, name: true }, orderBy: { name: 'asc' } } as const

// Returned to the service: the image and the templates that use it
const imageSelect = {
  id: true,
  part: true,
  fileName: true,
  mimeType: true,
  createdAt: true,
  createdById: true,
  headerOf: templateRef,
  footerOf: templateRef,
  signatureOf: templateRef,
} satisfies Prisma.LetterheadImageSelect

// The uploaded images of one part, newest first
export function listImages(part: LetterheadPart, db: DbClient = prisma) {
  return db.letterheadImage.findMany({ where: { part }, orderBy: { id: 'desc' }, select: imageSelect })
}

// The image with its storage key (for service use only), or null.
export function findImage(id: number, db: DbClient = prisma) {
  return db.letterheadImage.findUnique({ where: { id }, select: { ...imageSelect, storageKey: true } })
}

// Every image with its storage key and the templates that use it (scripts/rename-stored-files.ts)
export function listImageKeys(db: DbClient = prisma) {
  return db.letterheadImage.findMany({ orderBy: { id: 'asc' }, select: { ...imageSelect, storageKey: true } })
}

export function createImage(data: NewRow<Prisma.LetterheadImageUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.letterheadImage.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

export function updateImage(id: number, data: Prisma.LetterheadImageUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.letterheadImage.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// Takes the next number of the company's series for this kind of letter and year (the row is locked until the
// transaction ends, so two letters never get the same number)
export async function nextNumber(companyId: number, kind: LetterKind, year: number, actorId: ActorId, db: DbClient = prisma) {
  const row = await db.offerNumberSequence.upsert({
    where: { companyId_kind_year: { companyId, kind, year } },
    create: { companyId, kind, year, lastNumber: 1, ...createdBy(actorId) },
    update: { lastNumber: { increment: 1 }, ...updatedBy(actorId) },
    select: { lastNumber: true },
  })
  return row.lastNumber
}
