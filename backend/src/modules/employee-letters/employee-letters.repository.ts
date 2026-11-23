import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type LetterKind, type Prisma } from '#core/db/prisma'

// Data access for employee_letters (letters issued to employees).

const letterSelect = {
  id: true,
  kind: true,
  letterNumber: true,
  letterDate: true,
  lastWorkingDay: true,
  issuedAt: true,
  issuedById: true,
  emailedTo: true,
  letterTemplate: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeLetterSelect

export function listByEmployee(employeeId: number, db: DbClient = prisma) {
  return db.employeeLetter.findMany({ where: { employeeId }, orderBy: { issuedAt: 'desc' }, select: letterSelect })
}

// Every letter file of the employee - to move them to a new folder (a company transfer)
export function listFiles(employeeId: number, db: DbClient = prisma) {
  return db.employeeLetter.findMany({ where: { employeeId }, select: { id: true, kind: true, storageKey: true } })
}

export function updateStorageKey(id: number, storageKey: string, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeLetter.update({ where: { id }, data: { storageKey, ...updatedBy(actorId) }, select: { id: true } })
}

// One letter with its file and whose it is, or null
export function findById(id: number, db: DbClient = prisma) {
  // the owner's code and where they are (data-access checks)
  return db.employeeLetter.findUnique({
    where: { id },
    select: { ...letterSelect, storageKey: true, employee: { select: { employeeCode: true, companyId: true, plantId: true, departmentId: true } } },
  })
}

export function create(
  data: {
    employeeId: number
    kind: LetterKind
    letterTemplateId: number
    letterNumber: string
    letterDate: Date
    lastWorkingDay: Date | null
    storageKey: string
    sha256: string
    issuedAt: Date
    issuedById: number
  },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.employeeLetter.create({ data: { ...data, ...createdBy(actorId) }, select: letterSelect })
}

export function setEmailedTo(id: number, emailedTo: string, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeLetter.update({ where: { id }, data: { emailedTo, ...updatedBy(actorId) }, select: { id: true } })
}
