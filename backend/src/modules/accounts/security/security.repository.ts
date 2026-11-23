import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for the security rules - one row, id 1.

const ROW_ID = 1

const rulesSelect = {
  maxFailedLogins: true,
  lockMinutes: true,
  sessionHours: true,
  minPasswordLength: true,
  passwordHistory: true,
  resetCodeMinutes: true,
  confirmPasswordMinutes: true,
  updatedAt: true,
  updatedById: true,
} satisfies Prisma.SecuritySettingSelect

export function find(db: DbClient = prisma) {
  return db.securitySetting.findUnique({ where: { id: ROW_ID }, select: rulesSelect })
}

export function save(rules: Omit<Prisma.SecuritySettingUncheckedCreateInput, 'id' | 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  return db.securitySetting.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, ...rules, ...createdBy(actorId) },
    update: { ...rules, ...updatedBy(actorId) },
    select: rulesSelect,
  })
}
