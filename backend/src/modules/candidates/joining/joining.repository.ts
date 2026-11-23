import { prisma, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'

// Data access for the joining day (the status / link columns of the candidates table).

// JOINED, linked to the new employee. The encrypted joining-form draft is cleared: its data now lives in the
// employee's own (encrypted) records, so a second copy of the Aadhaar / PAN / bank numbers is not kept.
export function markJoined(candidateId: number, employeeId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.candidate.update({
    where: { id: candidateId },
    data: { status: 'JOINED', employeeId, joiningFormEncrypted: null, ...updatedBy(actorId) },
    select: { id: true },
  })
}
