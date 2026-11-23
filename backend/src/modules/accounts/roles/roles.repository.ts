import { createdBy, prisma, updatedBy, type AccessArea, type AccessLevel, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Database access for roles and role_permissions.

const roleSelect = {
  id: true,
  name: true,
  description: true,
  isSuperAdmin: true,
  isApprovalFallback: true,
  updatedAt: true,
  updatedById: true,
  permissions: { select: { area: true, level: true } },
  _count: { select: { accounts: true, approvalChainSteps: true, approvalEscalations: true, joiningTaskTypes: true } },
} satisfies Prisma.RoleSelect

type Permission = { area: AccessArea; level: AccessLevel }

// Super Admin first, then by name
export function list(db: DbClient = prisma) {
  return db.role.findMany({ orderBy: [{ isSuperAdmin: 'desc' }, { name: 'asc' }], select: roleSelect })
}

export function findById(id: number, db: DbClient = prisma) {
  return db.role.findUnique({ where: { id }, select: roleSelect })
}

export function findManyByIds(ids: number[], db: DbClient = prisma) {
  return db.role.findMany({ where: { id: { in: ids } }, select: roleSelect })
}

// The role with this name, ignoring upper / lower case, or null
export function findByName(name: string, db: DbClient = prisma) {
  return db.role.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: roleSelect })
}

// The permission rows of a role are written with it, by the same person
const withActor = (permissions: Permission[], actorId: ActorId) => permissions.map((p) => ({ ...p, ...createdBy(actorId) }))

export function create(
  data: { name: string; description?: string | undefined; permissions: Permission[] },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.role.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      permissions: { create: withActor(data.permissions, actorId) },
      ...createdBy(actorId),
    },
    select: roleSelect,
  })
}

// `permissions`, when given, replaces the role's whole list
export function update(
  id: number,
  data: { name?: string | undefined; description?: string | null | undefined; permissions?: Permission[] | undefined; isApprovalFallback?: boolean | undefined },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isApprovalFallback !== undefined && { isApprovalFallback: data.isApprovalFallback }),
      ...(data.permissions && { permissions: { deleteMany: {}, create: withActor(data.permissions, actorId) } }),
      ...updatedBy(actorId),
    },
    select: roleSelect,
  })
}

// Takes the fallback-approver mark from every role but this one (one role at most carries it)
export function clearApprovalFallback(exceptId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.role.updateMany({ where: { isApprovalFallback: true, id: { not: exceptId } }, data: { isApprovalFallback: false, ...updatedBy(actorId) } })
}

export function deleteById(id: number, db: DbClient = prisma) {
  return db.role.delete({ where: { id }, select: { id: true } })
}
