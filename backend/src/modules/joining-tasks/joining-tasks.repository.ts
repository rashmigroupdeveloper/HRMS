import { type DataScope, scopeWhere } from '#core/auth/scope'
import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type JoiningType, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for the joining tasks and their types - the only file that queries those tables.

const taskTypeSelect = {
  id: true,
  name: true,
  // the team
  role: { select: { id: true, name: true } },
  description: true,
  dueDays: true,
  joiningTypes: true,
  defaultAssigneeId: true,
  isActive: true,
} satisfies Prisma.JoiningTaskTypeSelect

export function listTypes(includeInactive: boolean, db: DbClient = prisma) {
  return db.joiningTaskType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ dueDays: 'asc' }, { name: 'asc' }],
    select: taskTypeSelect,
  })
}

// The active types for a new employee of this joining type (a type with no joining types is for everyone)
export function listTypesFor(joiningType: JoiningType, db: DbClient = prisma) {
  return db.joiningTaskType.findMany({
    where: { isActive: true, OR: [{ joiningTypes: { isEmpty: true } }, { joiningTypes: { has: joiningType } }] },
    orderBy: [{ dueDays: 'asc' }, { name: 'asc' }],
    select: taskTypeSelect,
  })
}

export function findType(id: number, db: DbClient = prisma) {
  return db.joiningTaskType.findUnique({ where: { id }, select: taskTypeSelect })
}

export function createType(data: NewRow<Prisma.JoiningTaskTypeUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.joiningTaskType.create({ data: { ...data, ...createdBy(actorId) }, select: taskTypeSelect })
}

export function updateType(id: number, data: Prisma.JoiningTaskTypeUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.joiningTaskType.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: taskTypeSelect })
}

const taskSelect = {
  id: true,
  name: true,
  team: true,
  description: true,
  dueDate: true,
  assignedToId: true,
  doneAt: true,
  doneById: true,
  note: true,
  createdAt: true,
  // the team's role now (a reassigned task goes to one of its holders)
  taskType: { select: { roleId: true } },
  // whose task it is
  employee: {
    select: {
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      dateOfJoining: true,
      status: true,
      company: { select: { code: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
      // where they are (data access)
      companyId: true,
      plantId: true,
      departmentId: true,
    },
  },
} satisfies Prisma.JoiningTaskSelect

export type TaskRow = Prisma.JoiningTaskGetPayload<{ select: typeof taskSelect }>

// `scope`: whose (new employees') tasks may be listed (data access - required)
export function listTasks(
  filter: { scope: DataScope; done: boolean; assignedToId?: number; team?: string; search?: string; take: number },
  db: DbClient = prisma,
) {
  const search = filter.search
    ? [
        {
          OR: [
            { employeeCode: { contains: filter.search, mode: 'insensitive' as const } },
            { firstName: { contains: filter.search, mode: 'insensitive' as const } },
            { lastName: { contains: filter.search, mode: 'insensitive' as const } },
          ],
        },
      ]
    : []
  return db.joiningTask.findMany({
    where: {
      doneAt: filter.done ? { not: null } : null,
      ...(filter.assignedToId !== undefined && { assignedToId: filter.assignedToId }),
      ...(filter.team && { team: filter.team }),
      employee: { AND: [scopeWhere(filter.scope), ...search] },
    },
    orderBy: filter.done ? [{ doneAt: 'desc' }] : [{ dueDate: 'asc' }, { id: 'asc' }],
    take: filter.take,
    select: taskSelect,
  })
}

// The teams that have open tasks (for the filter), with how many - of one person's tasks, or of all
export function countOpenByTeam(assignedToId: number | undefined, scope: DataScope, db: DbClient = prisma) {
  return db.joiningTask.groupBy({
    by: ['team'],
    where: { doneAt: null, ...(assignedToId !== undefined && { assignedToId }), employee: scopeWhere(scope) },
    _count: { _all: true },
    orderBy: { team: 'asc' },
  })
}

export function listByEmployee(employeeId: number, db: DbClient = prisma) {
  return db.joiningTask.findMany({ where: { employeeId }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], select: taskSelect })
}

export function countByEmployee(employeeId: number, db: DbClient = prisma) {
  return db.joiningTask.count({ where: { employeeId } })
}

// Open tasks due on or before this day (for the morning reminder)
// data access: a background job - each person gets their own tasks; HR is e-mailed only about employees inside their data access
export function listOpenDueBy(day: Date, db: DbClient = prisma) {
  return db.joiningTask.findMany({ where: { doneAt: null, dueDate: { lte: day } }, orderBy: [{ team: 'asc' }, { dueDate: 'asc' }], select: taskSelect })
}

export function findTask(id: number, db: DbClient = prisma) {
  return db.joiningTask.findUnique({ where: { id }, select: taskSelect })
}

export function createTasks(rows: NewRow<Prisma.JoiningTaskUncheckedCreateInput>[], actorId: ActorId, db: DbClient = prisma) {
  return db.joiningTask.createMany({ data: rows.map((row) => ({ ...row, ...createdBy(actorId) })) })
}

export function updateTask(id: number, data: Prisma.JoiningTaskUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.joiningTask.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: taskSelect })
}
