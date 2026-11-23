import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for attendance policies and their dated versions (2026-11-23).

export const ruleSelect = {
  graceMinutes: true,
  fullDayMinutes: true,
  halfDayMinutes: true,
  latesPerHalfDayCut: true,
  veryLateMinutes: true,
  veryEarlyMinutes: true,
} satisfies Prisma.AttendancePolicyVersionSelect
export type Rules = Prisma.AttendancePolicyVersionGetPayload<{ select: typeof ruleSelect }>

export const policySelect = {
  id: true,
  name: true,
  isDefault: true,
  isActive: true,
  versions: { orderBy: { effectiveFrom: 'asc' }, select: { id: true, effectiveFrom: true, ...ruleSelect, updatedAt: true, updatedById: true } },
} satisfies Prisma.AttendancePolicySelect
export type PolicyRow = Prisma.AttendancePolicyGetPayload<{ select: typeof policySelect }>

export function listPolicies(includeInactive: boolean, db: DbClient = prisma) {
  return db.attendancePolicy.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: policySelect })
}

export function findPolicy(id: number, db: DbClient = prisma) {
  return db.attendancePolicy.findUnique({ where: { id }, select: policySelect })
}

// A new policy with its first version (from `effectiveFrom`)
export async function createPolicy(data: { name: string; isDefault: boolean }, rules: Rules, effectiveFrom: Date, actorId: ActorId, db: DbClient = prisma) {
  const policy = await db.attendancePolicy.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
  await db.attendancePolicyVersion.create({ data: { policyId: policy.id, effectiveFrom, ...rules, ...createdBy(actorId) } })
  return policy.id
}

export function updatePolicy(id: number, data: Prisma.AttendancePolicyUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.attendancePolicy.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: { id: true } })
}

// The policy's rules from a date (replacing a version that starts that same day)
export function upsertVersion(policyId: number, effectiveFrom: Date, rules: Rules, actorId: ActorId, db: DbClient = prisma) {
  return db.attendancePolicyVersion.upsert({
    where: { policyId_effectiveFrom: { policyId, effectiveFrom } },
    create: { policyId, effectiveFrom, ...rules, ...createdBy(actorId) },
    update: { ...rules, ...updatedBy(actorId) },
    select: { id: true },
  })
}

// Only one default policy: the others lose the flag
export function clearDefault(exceptId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.attendancePolicy.updateMany({ where: { isDefault: true, id: { not: exceptId } }, data: { isDefault: false, ...updatedBy(actorId) } })
}

// The employees whose schedule ever named the policy - whose days a dated change may rework
// data access: a step of a policy change (Attendance setup Edit for all companies) - the days are worked out again, nothing is returned
export async function listEmployeeIdsOnPolicy(policyId: number, db: DbClient = prisma) {
  const rows = await db.shiftAssignment.findMany({ where: { policyId }, distinct: ['employeeId'], select: { employeeId: true } })
  return rows.map((r) => r.employeeId)
}
