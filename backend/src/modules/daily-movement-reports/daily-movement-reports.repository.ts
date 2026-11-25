import { createdBy, prisma, updatedBy, type ActorId, type DbClient } from '#core/db/prisma'
import type { SaveSetting } from './daily-movement-reports.schema.js'

const select = { id: true, isEnabled: true, hrHeadRole: { select: { id: true, name: true } }, sendAtMinutes: true, coverage: true, sendEmpty: true, updatedAt: true } as const

// data access: singleton group-wide configuration, restricted to the active Super Admin in the service; no people's records.
export function find(db: DbClient = prisma) {
  return db.dailyMovementReportSetting.findUnique({ where: { id: 1 }, select })
}

export function save(input: SaveSetting, actorId: ActorId, db: DbClient = prisma) {
  const { expectedUpdatedAt, ...data } = input
  // Delivery is deliberately inactive until the recipient/delivery stage is approved and built.
  if (expectedUpdatedAt === null) return db.dailyMovementReportSetting.createMany({ data: { id: 1, ...data, isEnabled: false, ...createdBy(actorId) }, skipDuplicates: true })
  return db.dailyMovementReportSetting.updateMany({ where: { id: 1, updatedAt: expectedUpdatedAt }, data: { ...data, isEnabled: false, ...updatedBy(actorId) } })
}
