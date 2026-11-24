import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type NewRow, type Prisma } from '#core/db/prisma'

// Database access for the holiday lists and the plants' default lists (2026-11-24).

const listSelect = {
  id: true,
  name: true,
  companyId: true,
  isActive: true,
  company: { select: { id: true, code: true, name: true } },
  defaultPlants: { orderBy: { plant: { plantCode: 'asc' } }, select: { plant: { select: { id: true, plantCode: true, name: true, companyId: true } } } },
} satisfies Prisma.HolidayListSelect
export type HolidayListRow = Prisma.HolidayListGetPayload<{ select: typeof listSelect }>

export function list(includeInactive: boolean, db: DbClient = prisma) {
  return db.holidayList.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { name: 'asc' }, select: listSelect })
}

export function find(id: number, db: DbClient = prisma) {
  return db.holidayList.findUnique({ where: { id }, select: listSelect })
}

export function create(data: NewRow<Prisma.HolidayListUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  return db.holidayList.create({ data: { ...data, ...createdBy(actorId) }, select: listSelect })
}

export function update(id: number, data: Prisma.HolidayListUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.holidayList.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: listSelect })
}

// The plant's default list from now on (replacing the one it had)
export function upsertPlantDefault(plantId: number, holidayListId: number, actorId: ActorId, db: DbClient = prisma) {
  return db.plantDefaultHolidayList.upsert({
    where: { plantId },
    create: { plantId, holidayListId, ...createdBy(actorId) },
    update: { holidayListId, ...updatedBy(actorId) },
    select: { id: true },
  })
}

export function deletePlantDefault(plantId: number, db: DbClient = prisma) {
  return db.plantDefaultHolidayList.deleteMany({ where: { plantId } })
}

// every plant's default list (to give the plant's default to those without a list)
export function listPlantDefaults(db: DbClient = prisma) {
  return db.plantDefaultHolidayList.findMany({ select: { plantId: true, holidayList: { select: { id: true, name: true, companyId: true, isActive: true } } } })
}

// --- the employees' lists, each from a date (2026-11-24) ---

const employeeListSelect = {
  employeeId: true,
  effectiveFrom: true,
  holidayList: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeHolidayListSelect
export type EmployeeListRow = Prisma.EmployeeHolidayListGetPayload<{ select: typeof employeeListSelect }>

// data access: the ids come from the service, already limited to the people the viewer may see (or system steps)
export function listEmployeeRows(employeeIds: number[], db: DbClient = prisma) {
  return db.employeeHolidayList.findMany({ where: { employeeId: { in: employeeIds } }, orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'asc' }], select: employeeListSelect })
}

// data access: a check on the list itself (retiring it, moving it to another company) - only the people's companies are
// read, nothing is returned to the viewer
export function listRowsOfList(holidayListId: number, db: DbClient = prisma) {
  return db.employeeHolidayList.findMany({ where: { holidayListId }, select: { employeeId: true, employee: { select: { companyId: true } } } })
}

// The employee's list from a date (replacing one that starts that same day)
export function upsertEmployeeList(data: { employeeId: number; holidayListId: number; effectiveFrom: Date }, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeHolidayList.upsert({
    where: { employeeId_effectiveFrom: { employeeId: data.employeeId, effectiveFrom: data.effectiveFrom } },
    create: { ...data, ...createdBy(actorId) },
    update: { holidayListId: data.holidayListId, ...updatedBy(actorId) },
    select: { id: true },
  })
}
