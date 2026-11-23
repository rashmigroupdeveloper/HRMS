import { prisma, type DbClient, type Prisma, createdBy, updatedBy, type ActorId, type NewRow } from '#core/db/prisma'

// Database access for plants.

const plantSelect = {
  id: true,
  plantCode: true,
  name: true,
  address: true,
  postalCode: true,
  countryCode: true,
  region: true,
  isActive: true,
  company: { select: { id: true, code: true, name: true } },
  // how many departments run at it (retired links not counted)
  _count: { select: { departments: { where: { isActive: true } } } },
} satisfies Prisma.PlantSelect

export function list(filter: { companyId?: number | undefined; includeInactive: boolean }, db: DbClient = prisma) {
  return db.plant.findMany({
    where: {
      ...(filter.companyId !== undefined && { companyId: filter.companyId }),
      ...(!filter.includeInactive && { isActive: true }),
    },
    orderBy: [{ company: { name: 'asc' } }, { plantCode: 'asc' }],
    select: plantSelect,
  })
}

// The plant with this id, or null.
export function findById(id: number, db: DbClient = prisma) {
  return db.plant.findUnique({ where: { id }, select: plantSelect })
}

export function create(data: NewRow<Prisma.PlantUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.plant.create({ data: { ...data, ...createdBy(actorId) }, select: plantSelect })
}

export function update(id: number, data: Prisma.PlantUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.plant.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: plantSelect })
}

// --- The departments that run at a plant (plant_departments) ---

// Every department linked to the plant (retired ones too), with how many employees / candidates are placed there - and,
// as an HOD post (BACKLOG 3e), its appointments and the employees whose post it is
export function listDepartmentLinks(plantId: number, db: DbClient = prisma) {
  return db.plantDepartment.findMany({
    where: { plantId },
    select: {
      departmentId: true,
      isActive: true,
      _count: { select: { employees: true, candidates: true, hodAppointments: true, hodEmployees: true, jobRecords: true } },
    },
  })
}

// Every (plant, department) link that is not retired - to check many placements at once (the Excel import)
export function listActiveDepartmentPairs(db: DbClient = prisma) {
  return db.plantDepartment.findMany({ where: { isActive: true }, select: { id: true, plantId: true, departmentId: true } })
}

// The link of the department at the plant (whether it is retired), or null
export function findDepartmentLink(plantId: number, departmentId: number, db: DbClient = prisma) {
  return db.plantDepartment.findUnique({ where: { plantId_departmentId: { plantId, departmentId } }, select: { id: true, isActive: true } })
}

// Every link (retired ones too) with its company, plant and department - the HOD posts (BACKLOG 3e)
export function listAllDepartmentLinks(db: DbClient = prisma) {
  return db.plantDepartment.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      isActive: true,
      plant: { select: { id: true, plantCode: true, name: true, isActive: true, company: { select: { id: true, code: true, name: true } } } },
      department: { select: { id: true, code: true, name: true } },
    },
  })
}

// Adds the links that do not exist yet (an existing link is left as it is)
export function addDepartmentLinks(plantId: number, departmentIds: number[], actorId: ActorId, db: DbClient = prisma) {
  return db.plantDepartment.createMany({
    data: departmentIds.map((departmentId) => ({ plantId, departmentId, ...createdBy(actorId) })),
    skipDuplicates: true,
  })
}

// Retires (isActive false) or brings back (true) these links of the plant
export function setDepartmentLinksActive(plantId: number, departmentIds: number[], isActive: boolean, actorId: ActorId, db: DbClient = prisma) {
  return db.plantDepartment.updateMany({ where: { plantId, departmentId: { in: departmentIds } }, data: { isActive, ...updatedBy(actorId) } })
}

export function deleteDepartmentLinks(plantId: number, departmentIds: number[], db: DbClient = prisma) {
  return db.plantDepartment.deleteMany({ where: { plantId, departmentId: { in: departmentIds } } })
}
