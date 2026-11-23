import { prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Data access for the joining-form draft and its submission (columns of the candidates table).

// The encrypted draft, or null if nothing was saved yet (or the candidate does not exist).
export async function find(candidateId: number, db: DbClient = prisma) {
  const row = await db.candidate.findUnique({ where: { id: candidateId }, select: { joiningFormEncrypted: true } })
  return row?.joiningFormEncrypted ?? null
}

// Saving the draft counts as a change of the candidate (updatedAt / updatedById)
export function update(candidateId: number, joiningFormEncrypted: string, actorId: ActorId, db: DbClient = prisma) {
  return db.candidate.update({
    where: { id: candidateId },
    data: { joiningFormEncrypted, ...updatedBy(actorId) },
    select: { id: true },
  })
}

type SubmissionChange = Pick<
  Prisma.CandidateUncheckedUpdateInput,
  | 'joiningFormSubmittedAt'
  | 'joiningFormSubmittedById'
  | 'joiningFormSignedName'
  | 'joiningFormDeclaration'
  | 'joiningFormSignIp'
  | 'joiningFormSignUserAgent'
  | 'joiningFormReturnedAt'
  | 'joiningFormReturnedById'
  | 'joiningFormReturnReason'
>

// Submitted / signed by the candidate, or sent back by HR
export function updateSubmission(candidateId: number, data: SubmissionChange, actorId: ActorId, db: DbClient = prisma) {
  return db.candidate.update({ where: { id: candidateId }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}
