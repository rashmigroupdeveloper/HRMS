import { createdBy, prisma, updatedBy, type ActorId, type DbClient, type Prisma } from '#core/db/prisma'

// Data access for HR's edits of an employee's records: reading them in the joining form's sections (with the encrypted
// numbers, which the service keeps when HR leaves a number empty - never returned to the browser), and replacing a
// section's rows.

const omitBookkeeping = { id: true, employeeId: true, createdAt: true, createdById: true, updatedAt: true, updatedById: true } as const

const formSelect = {
  id: true,
  employeeCode: true,
  joiningType: true,
  employmentType: true,
  dateOfJoining: true,
  contractEndDate: true,
  probationEndDate: true,
  confirmationDate: true,
  // personal
  firstName: true,
  middleName: true,
  lastName: true,
  mobile: true,
  alternateMobile: true,
  fatherName: true,
  motherName: true,
  gender: true,
  dateOfBirth: true,
  placeOfBirth: true,
  maritalStatus: true,
  spouseName: true,
  marriageDate: true,
  countryOfOrigin: true,
  nationality: true,
  religion: true,
  category: true,
  bloodGroup: true,
  heightCm: true,
  weightKg: true,
  identificationMark: true,
  hobbies: true,
  isPhysicallyDisabled: true,
  disabilityType: true,
  disabilityPercent: true,
  addresses: { omit: omitBookkeeping, orderBy: { type: 'asc' } },
  emergencyContacts: { omit: omitBookkeeping, orderBy: { id: 'asc' } },
  identityDocuments: { omit: omitBookkeeping, orderBy: { type: 'asc' } },
  bankAccounts: { where: { isSalaryAccount: true }, omit: omitBookkeeping, take: 1 },
  statutory: { omit: omitBookkeeping },
  qualifications: { omit: omitBookkeeping, orderBy: { id: 'asc' } },
  certifications: { omit: omitBookkeeping, orderBy: { id: 'asc' } },
  previousJobs: { omit: omitBookkeeping, orderBy: { id: 'asc' } },
  familyMembers: { omit: omitBookkeeping, orderBy: { id: 'asc' } },
  nominees: { omit: omitBookkeeping, orderBy: [{ scheme: 'asc' }, { id: 'asc' }] },
  medicalInfo: { omit: omitBookkeeping },
} satisfies Prisma.EmployeeSelect

// The employee's records in sections, with the encrypted numbers, or null
export function findForm(employeeCode: string, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { employeeCode }, select: formSelect })
}
export type EmployeeFormRow = NonNullable<Awaited<ReturnType<typeof findForm>>>

// The employee who already holds this identity number (by its fingerprint), other than this one, or null
export function findOtherIdentityOwner(employeeId: number, type: Prisma.EmployeeIdentityDocumentWhereInput['type'], numberHash: string, db: DbClient = prisma) {
  return db.employeeIdentityDocument.findFirst({
    where: { type, numberHash, employeeId: { not: employeeId } },
    select: { employee: { select: { employeeCode: true, status: true } } },
  })
}

// --- replacing a section (the old rows go, the new ones come - each recorded in the change history) ---

const by = (actorId: ActorId, employeeId: number) => ({ employeeId, ...createdBy(actorId) })

export async function replaceAddresses(employeeId: number, rows: Omit<Prisma.EmployeeAddressCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeeAddress.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeeAddress.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

export async function replaceEmergencyContacts(employeeId: number, rows: Omit<Prisma.EmployeeEmergencyContactCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeeEmergencyContact.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeeEmergencyContact.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

export async function replaceIdentityDocuments(employeeId: number, rows: Omit<Prisma.EmployeeIdentityDocumentCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeeIdentityDocument.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeeIdentityDocument.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

// The salary account (other accounts, none today, are left as they are)
export async function replaceSalaryAccount(employeeId: number, row: Omit<Prisma.EmployeeBankAccountCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>, actorId: ActorId, db: DbClient = prisma) {
  await db.employeeBankAccount.deleteMany({ where: { employeeId, isSalaryAccount: true } })
  await db.employeeBankAccount.create({ data: { ...row, isSalaryAccount: true, ...by(actorId, employeeId) }, select: { id: true } })
}

export async function replaceQualifications(employeeId: number, rows: Omit<Prisma.EmployeeQualificationCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeeQualification.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeeQualification.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

export async function replaceCertifications(employeeId: number, rows: Omit<Prisma.EmployeeCertificationCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeeCertification.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeeCertification.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

export async function replacePreviousJobs(employeeId: number, rows: Omit<Prisma.EmployeePreviousEmploymentCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeePreviousEmployment.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeePreviousEmployment.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

export async function replaceFamilyMembers(employeeId: number, rows: Omit<Prisma.EmployeeFamilyMemberCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeeFamilyMember.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeeFamilyMember.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

export async function replaceNominees(employeeId: number, rows: Omit<Prisma.EmployeeNomineeCreateManyInput, 'employeeId' | 'createdById' | 'updatedById'>[], actorId: ActorId, db: DbClient = prisma) {
  await db.employeeNominee.deleteMany({ where: { employeeId } })
  if (rows.length) await db.employeeNominee.createMany({ data: rows.map((row) => ({ ...row, ...by(actorId, employeeId) })) })
}

// The PF / ESIC answers and Form F declarations: only the columns given change
export function upsertStatutory(employeeId: number, data: Omit<Prisma.EmployeeStatutoryUncheckedUpdateInput, 'employeeId'>, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeStatutory.upsert({
    where: { employeeId },
    create: { ...(data as Omit<Prisma.EmployeeStatutoryUncheckedCreateInput, 'employeeId' | 'createdById' | 'updatedById'>), ...by(actorId, employeeId) },
    update: { ...data, ...updatedBy(actorId) },
    select: { id: true },
  })
}

// The medical information (consent, given at joining, stays as it was)
export function upsertMedicalInfo(employeeId: number, data: Omit<Prisma.EmployeeMedicalInfoUncheckedUpdateInput, 'employeeId'>, actorId: ActorId, db: DbClient = prisma) {
  return db.employeeMedicalInfo.upsert({
    where: { employeeId },
    create: { ...(data as Omit<Prisma.EmployeeMedicalInfoUncheckedCreateInput, 'employeeId' | 'createdById' | 'updatedById'>), ...by(actorId, employeeId) },
    update: { ...data, ...updatedBy(actorId) },
    select: { id: true },
  })
}
