import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for comp-off claims (2026-11-22).

const claimSelect = {
  id: true,
  employeeId: true,
  workDate: true,
  days: true,
  reason: true,
  status: true,
  approvalRequestId: true,
  createdAt: true,
  employee: { select: { id: true, employeeCode: true, firstName: true, middleName: true, lastName: true } },
  entry: { select: { expiresOn: true } },
} satisfies Prisma.CompOffClaimSelect
export type ClaimRow = Prisma.CompOffClaimGetPayload<{ select: typeof claimSelect }>

export function create(data: Omit<Prisma.CompOffClaimUncheckedCreateInput, 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  return db.compOffClaim.create({ data: { ...data, ...createdBy(actorId) }, select: claimSelect })
}

export function update(id: number, data: Prisma.CompOffClaimUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.compOffClaim.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: claimSelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.compOffClaim.findUnique({ where: { id }, select: claimSelect })
}

// The claim of an approval request (the approval service's decision comes back by it)
export function findByApprovalRequestId(approvalRequestId: number, db: DbClient = prisma) {
  return db.compOffClaim.findUnique({ where: { approvalRequestId }, select: claimSelect })
}

// A claim of this employee for this day still waiting or approved (one per day)
export function findOpen(employeeId: number, workDate: Date, db: DbClient = prisma) {
  return db.compOffClaim.findFirst({ where: { employeeId, workDate, status: { in: ['PENDING', 'APPROVED'] } }, select: { id: true } })
}

// One employee's claims, newest first
export function listByEmployee(employeeId: number, take: number, db: DbClient = prisma) {
  return db.compOffClaim.findMany({ where: { employeeId }, orderBy: [{ workDate: 'desc' }, { id: 'desc' }], take, select: claimSelect })
}

// Holds this employee's comp-off claims until the transaction ends: a claim is checked again after it, so two sent at the
// same moment cannot both pass "already claimed" (2026-11-23)
export async function lockEmployee(employeeId: number, db: DbClient) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('comp-off-claims'), ${employeeId}::int)::text AS locked`
}
