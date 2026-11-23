import { prisma, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'

// Data access for the joining day (the status / link columns of the candidates table).

// JOINED, linked to the new employee. The encrypted joining-form draft is cleared: its data now lives in the
// employee's own (encrypted) records, so a second copy of the Aadhaar / PAN / bank numbers is not kept.
// Only while still ACCEPTED - false when the offer was withdrawn (or joined) a moment before (2026-11-23, the review)
export async function markJoined(candidateId: number, employeeId: number, actorId: ActorId, db: DbClient = prisma) {
  const result = await db.candidate.updateMany({
    where: { id: candidateId, status: 'ACCEPTED' },
    data: { status: 'JOINED', employeeId, joiningFormEncrypted: null, ...updatedBy(actorId) },
  })
  return result.count === 1
}
