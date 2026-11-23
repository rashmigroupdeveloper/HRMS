import { createdBy, prisma, updatedBy, type AccessArea, type ActorId, type ApprovalBreachAction, type ApprovalKind, type ApproverType, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for approval_chains and approval_chain_steps.

const chainSelect = {
  id: true,
  kind: true,
  companyId: true,
  isActive: true,
  updatedAt: true,
  updatedById: true,
  company: { select: { code: true, name: true } },
  steps: {
    orderBy: { stepNo: 'asc' },
    select: {
      stepNo: true,
      approverType: true,
      roleId: true,
      accessArea: true,
      approverId: true,
      seesConfidential: true,
      slaHours: true,
      onBreach: true,
      escalateRoleId: true,
      role: { select: { name: true } },
      escalateRole: { select: { name: true } },
    },
  },
} satisfies Prisma.ApprovalChainSelect

export type ChainRow = Prisma.ApprovalChainGetPayload<{ select: typeof chainSelect }>

// Every chain - the shared ones first
export function list(db: DbClient = prisma) {
  return db.approvalChain.findMany({ orderBy: [{ kind: 'asc' }, { companyId: { sort: 'asc', nulls: 'first' } }], select: chainSelect })
}

// The chains of these kinds that apply to a company: its own and the shared ones
export function listFor(kinds: ApprovalKind[], companyId: number, db: DbClient = prisma) {
  return db.approvalChain.findMany({ where: { kind: { in: kinds }, OR: [{ companyId }, { companyId: null }] }, select: chainSelect })
}

export function find(kind: ApprovalKind, companyId: number | null, db: DbClient = prisma) {
  return db.approvalChain.findFirst({ where: { kind, companyId }, select: chainSelect })
}

type NewChainStep = {
  stepNo: number
  approverType: ApproverType
  roleId: number | null
  accessArea: AccessArea | null
  approverId: number | null
  seesConfidential: boolean
  slaHours: number | null
  onBreach: ApprovalBreachAction
  escalateRoleId: number | null
}

// Creates the chain, or replaces the steps of the one there
export async function save(kind: ApprovalKind, companyId: number | null, isActive: boolean, steps: NewChainStep[], actorId: ActorId, db: DbClient = prisma) {
  const existing = await db.approvalChain.findFirst({ where: { kind, companyId }, select: { id: true } })
  const withActor = steps.map((step) => ({ ...step, ...createdBy(actorId) }))
  if (!existing) {
    return db.approvalChain.create({ data: { kind, companyId, isActive, ...createdBy(actorId), steps: { create: withActor } }, select: chainSelect })
  }
  return db.approvalChain.update({
    where: { id: existing.id },
    data: { isActive, ...updatedBy(actorId), steps: { deleteMany: {}, create: withActor } },
    select: chainSelect,
  })
}

export function remove(kind: ApprovalKind, companyId: number, db: DbClient = prisma) {
  return db.approvalChain.deleteMany({ where: { kind, companyId } })
}
