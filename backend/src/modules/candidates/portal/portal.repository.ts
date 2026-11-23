import { createdBy, prisma, SYSTEM_ACTOR, updatedBy, type DbClient } from '#core/db/prisma'

// Database access for candidate_sessions (the candidate's sign-in to their joining-form page).
// Sessions are made by the candidate (no login), so they are recorded by SYSTEM_ACTOR.

export function createSession(data: { candidateId: number; tokenHash: string; expiresAt: Date }, db: DbClient = prisma) {
  return db.candidateSession.create({ data: { ...data, ...createdBy(SYSTEM_ACTOR) }, select: { id: true } })
}

// The session with this token hash and its candidate's status, or null
export function findSessionByTokenHash(tokenHash: string, db: DbClient = prisma) {
  return db.candidateSession.findUnique({
    where: { tokenHash },
    select: { id: true, candidateId: true, expiresAt: true, candidate: { select: { status: true } } },
  })
}

export function extendSession(id: number, expiresAt: Date, db: DbClient = prisma) {
  return db.candidateSession.update({ where: { id }, data: { expiresAt, ...updatedBy(SYSTEM_ACTOR) }, select: { id: true } })
}

export function deleteSession(id: number, db: DbClient = prisma) {
  return db.candidateSession.deleteMany({ where: { id } })
}

// Old sessions of this candidate (ended ones are removed at the next sign-in)
export function deleteExpiredSessions(candidateId: number, now: Date, db: DbClient = prisma) {
  return db.candidateSession.deleteMany({ where: { candidateId, expiresAt: { lt: now } } })
}
