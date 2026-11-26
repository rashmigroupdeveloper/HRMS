import { type DataScope, scopeWhere } from '#core/auth/scope'
import {
  createdBy,
  linesAsNumbers,
  updatedBy,
  prisma,
  type ActorId,
  type DbClient,
  type EmployeeStatus,
  type EmploymentType,
  type IdentityDocumentType,
  type MedicalResult,
  type NewRow,
  type Prisma,
  type WorkforceCategory,
} from '#core/db/prisma'

import { jobDetailsOf, joiningRecord } from './job-history/job-history.repository.js'

// Database access for employees - the only file that queries the employees table (and its joining-form records).

// Columns returned to callers. Listing them explicitly means sensitive columns added later
// (bank account, PAN, salary) are never returned by accident.
const employeeSelect = {
  id: true,
  // official / employment
  employeeCode: true,
  joiningType: true,
  employmentType: true,
  workforceCategory: true,
  dateOfJoining: true,
  contractEndDate: true,
  probationEndDate: true,
  noticeMonthsProbation: true,
  noticeMonthsConfirmed: true,
  confirmationDate: true,
  dateOfLeaving: true,
  status: true,
  // placement
  company: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, plantCode: true, name: true } },
  workLocation: { select: { id: true, name: true, countryCode: true, address: true, postalCode: true, region: { select: { name: true } } } },
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  grade: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
  functionalManager: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } },
  reportingManager: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } },
  // the HOD post: the plant-department they are placed in (BACKLOG 3e)
  hodPostId: true,
  // personal
  salutation: true,
  firstName: true,
  middleName: true,
  lastName: true,
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
  // contact
  workEmail: true,
  personalEmail: true,
  mobile: true,
  alternateMobile: true,
} satisfies Prisma.EmployeeSelect

// The profile page: the employee plus the joining-form records. Identity and bank numbers ONLY as their last 4
// digits - the encrypted columns are never selected here.
const profileSelect = {
  ...employeeSelect,
  createdAt: true,
  createdById: true,
  updatedAt: true,
  updatedById: true,
  addresses: {
    select: {
      type: true,
      houseNo: true,
      locality: true,
      cityOrVillage: true,
      district: true,
      state: true,
      countryCode: true,
      postalCode: true,
      postOffice: true,
      policeStation: true,
      subDivision: true,
    },
    orderBy: { type: 'asc' },
  },
  emergencyContacts: {
    select: { name: true, relationship: true, mobile: true, alternateMobile: true, address: true },
    orderBy: { id: 'asc' },
  },
  identityDocuments: {
    select: { type: true, numberLast4: true, nameOnDocument: true, issuingCountry: true, validFrom: true, validUntil: true },
    orderBy: { type: 'asc' },
  },
  bankAccounts: {
    select: {
      bankName: true,
      branch: true,
      accountHolderName: true,
      accountNumberLast4: true,
      ifsc: true,
      accountType: true,
      isSalaryAccount: true,
    },
    orderBy: { id: 'asc' },
  },
  statutory: {
    select: {
      pfApplicable: true,
      uan: true,
      pfNumber: true,
      epfRelative: true,
      aadhaarMobile: true,
      isInternationalWorker: true,
      wasEpfMember: true,
      wasEpsMember: true,
      previousPfNumber: true,
      previousExitDate: true,
      schemeCertificateNumber: true,
      ppoNumber: true,
      firstEpfEnrolledOn: true,
      firstEpfWages: true,
      isEpfMemberBeforeSep2014: true,
      epfWithdrawn: true,
      epsWithdrawn: true,
      epsWithdrawnAfterSep2014: true,
      esicApplicable: true,
      esicIpNumber: true,
      esicBranchOffice: true,
      esicDispensary: true,
      previousEsicIpNumber: true,
      previousEmployerCode: true,
      previousEmployerName: true,
      previousEmployerAddress: true,
    },
  },
  qualifications: {
    select: { qualification: true, institute: true, yearOfPassing: true, specialization: true, score: true },
    orderBy: { yearOfPassing: 'desc' },
  },
  certifications: {
    select: { name: true, issuedBy: true, certifiedOn: true, specialization: true, score: true },
    orderBy: { id: 'asc' },
  },
  previousJobs: {
    select: { employerName: true, designation: true, fromDate: true, toDate: true, reasonForLeaving: true },
    orderBy: { fromDate: 'desc' },
  },
  // the family member's Aadhaar only as its last 4 digits
  familyMembers: {
    select: {
      name: true,
      relationship: true,
      gender: true,
      dateOfBirth: true,
      aadhaarLast4: true,
      preExistingDisease: true,
      livesWithEmployee: true,
      residenceTown: true,
      residenceState: true,
    },
    orderBy: { id: 'asc' },
  },
  nominees: {
    select: { scheme: true, name: true, relationship: true, dateOfBirth: true, address: true, sharePercent: true, guardianName: true, guardianAddress: true },
    orderBy: [{ scheme: 'asc' }, { id: 'asc' }],
  },
  onboarding: {
    select: {
      completedAt: true,
      completedById: true,
      formDate: true,
      declarationAcceptedAt: true,
      declarationAcceptedById: true,
      joiningFormalitiesCompletedAt: true,
      joiningFormalitiesCompletedById: true,
      payrollUpdatedAt: true,
      payrollUpdatedById: true,
      idCardIssuedAt: true,
      idCardIssuedById: true,
      inductionDate: true,
      medicalResult: true,
      medicalExamDate: true,
      medicalExaminer: true,
      medicalRestrictions: true,
    },
  },
  // health data - the service returns it only to the employee and to MEDICAL READ
  medicalInfo: { omit: { id: true, employeeId: true, createdById: true, updatedById: true, createdAt: true } },
  candidate: { select: { id: true } },
} satisfies Prisma.EmployeeSelect

// The employee's HOD post (a plant-department) with its appointments not over at `now` - the one going on and the upcoming
// ones, earliest first (BACKLOG 3e)
const hodPostSelect = (now: Date) =>
  ({
    select: {
      id: true,
      plant: { select: { plantCode: true, name: true, company: { select: { code: true } } } },
      department: { select: { name: true } },
      hodAppointments: {
        where: { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        orderBy: { startsAt: 'asc' },
        select: { startsAt: true, endsAt: true, employee: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } } },
      },
    },
  }) satisfies Prisma.Employee$hodPostArgs

// One row of the employee directory
const directorySelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  middleName: true,
  lastName: true,
  status: true,
  employmentType: true,
  workforceCategory: true,
  dateOfJoining: true,
  // to flag PF / ESIC numbers still to be recorded
  statutory: { select: { pfApplicable: true, uan: true, pfNumber: true, esicApplicable: true, esicIpNumber: true } },
  company: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, plantCode: true, name: true } },
  workLocation: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  position: { select: { name: true } },
  costCenter: { select: { code: true, name: true } },
  reportingManager: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } },
  functionalManager: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } },
} satisfies Prisma.EmployeeSelect

// With the first entry of the job timeline: the details they join with, from the date of joining.
export function create(data: NewRow<Prisma.EmployeeUncheckedCreateInput>, actorId: ActorId, db: DbClient = prisma) {
  const jobRecords = { create: [joiningRecord(jobDetailsOf(data), { companyId: data.companyId, employeeCode: data.employeeCode }, new Date(data.dateOfJoining), actorId)] }
  return db.employee.create({ data: { ...data, ...createdBy(actorId), jobRecords }, select: employeeSelect })
}

// Changes the employee's own columns (not the joining-form records).
export function update(id: number, data: Prisma.EmployeeUncheckedUpdateInput, actorId: ActorId, db: DbClient = prisma) {
  return db.employee.update({ where: { id }, data: { ...data, ...updatedBy(actorId) }, select: employeeSelect })
}

// Who an employee reports to, to follow the reporting line upwards (loops, a manager who left), or null.
const managerLinkSelect = { id: true, employeeCode: true, status: true, reportingManagerId: true } satisfies Prisma.EmployeeSelect
export function findManagerLinkById(id: number, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { id }, select: managerLinkSelect })
}
export function findManagerLinkByCode(employeeCode: string, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { employeeCode }, select: managerLinkSelect })
}

// The joining-form records created together with the employee on the joining day
export type JoiningRows = {
  employee: NewRow<Prisma.EmployeeUncheckedCreateInput>
  addresses: NewRow<Prisma.EmployeeAddressCreateWithoutEmployeeInput>[]
  emergencyContacts: NewRow<Prisma.EmployeeEmergencyContactCreateWithoutEmployeeInput>[]
  identityDocuments: NewRow<Prisma.EmployeeIdentityDocumentCreateWithoutEmployeeInput>[]
  bankAccounts: NewRow<Prisma.EmployeeBankAccountCreateWithoutEmployeeInput>[]
  statutory: NewRow<Prisma.EmployeeStatutoryCreateWithoutEmployeeInput> | null
  qualifications: NewRow<Prisma.EmployeeQualificationCreateWithoutEmployeeInput>[]
  certifications: NewRow<Prisma.EmployeeCertificationCreateWithoutEmployeeInput>[]
  previousJobs: NewRow<Prisma.EmployeePreviousEmploymentCreateWithoutEmployeeInput>[]
  familyMembers: NewRow<Prisma.EmployeeFamilyMemberCreateWithoutEmployeeInput>[]
  nominees: NewRow<Prisma.EmployeeNomineeCreateWithoutEmployeeInput>[]
  medicalInfo: NewRow<Prisma.EmployeeMedicalInfoCreateWithoutEmployeeInput> | null
  // when joining was completed (EmployeeOnboarding.completedAt; completedById = the actor)
  completedAt: Date
  // the employee's declaration (JF §10) signed with the joining form, and the form's date
  declaration: { acceptedAt: Date; acceptedById: ActorId; formDate: Date } | null
  // the pre-employment medical recorded before joining
  preEmploymentMedical: { result: MedicalResult; examDate: Date | null; examiner: string | null; restrictions: string | null } | null
  // the first salary (the offer's), from the date of joining, with its monthly breakup
  salary: {
    effectiveFrom: Date
    annualCtc: number
    performancePayAnnual: number | null
    currency: string
    lines: { salaryComponentId: number; monthlyAmount: number }[]
  }
}

// Creates the employee with every joining-form record and the joining record, all by the same person.
export function createWithJoiningRecords(rows: JoiningRows, actorId: ActorId, db: DbClient = prisma) {
  const by = createdBy(actorId)
  const withBy = <T extends object>(items: T[]) => items.map((item) => ({ ...item, ...by }))
  return db.employee.create({
    data: {
      ...rows.employee,
      ...by,
      // the first entry of the job timeline
      jobRecords: {
        create: [joiningRecord(jobDetailsOf(rows.employee), { companyId: rows.employee.companyId, employeeCode: rows.employee.employeeCode }, new Date(rows.employee.dateOfJoining), actorId)],
      },
      addresses: { create: withBy(rows.addresses) },
      emergencyContacts: { create: withBy(rows.emergencyContacts) },
      identityDocuments: { create: withBy(rows.identityDocuments) },
      bankAccounts: { create: withBy(rows.bankAccounts) },
      ...(rows.statutory && { statutory: { create: { ...rows.statutory, ...by } } }),
      qualifications: { create: withBy(rows.qualifications) },
      certifications: { create: withBy(rows.certifications) },
      previousJobs: { create: withBy(rows.previousJobs) },
      familyMembers: { create: withBy(rows.familyMembers) },
      nominees: { create: withBy(rows.nominees) },
      ...(rows.medicalInfo && { medicalInfo: { create: { ...rows.medicalInfo, ...by } } }),
      salaries: {
        create: {
          effectiveFrom: rows.salary.effectiveFrom,
          annualCtc: rows.salary.annualCtc,
          performancePayAnnual: rows.salary.performancePayAnnual,
          currency: rows.salary.currency,
          ...by,
          lines: { create: withBy(rows.salary.lines) },
        },
      },
      onboarding: {
        create: {
          completedAt: rows.completedAt,
          completedById: actorId,
          ...(rows.declaration && {
            formDate: rows.declaration.formDate,
            declarationAcceptedAt: rows.declaration.acceptedAt,
            declarationAcceptedById: rows.declaration.acceptedById,
          }),
          ...(rows.preEmploymentMedical && {
            medicalResult: rows.preEmploymentMedical.result,
            medicalExamDate: rows.preEmploymentMedical.examDate,
            medicalExaminer: rows.preEmploymentMedical.examiner,
            medicalRestrictions: rows.preEmploymentMedical.restrictions,
          }),
          ...by,
        },
      },
    },
    select: { id: true, employeeCode: true },
  })
}

// --- Salary history (2026-11-20): one row per salary from its day; revisions are approved job changes ---

const salaryRowSelect = {
  id: true,
  effectiveFrom: true,
  annualCtc: true,
  performancePayAnnual: true,
  currency: true,
  reason: true,
  jobChangeRequestId: true,
  approvedAt: true,
  approvedById: true,
  lines: {
    select: { monthlyAmount: true, salaryComponent: { select: { id: true, name: true, kind: true } } },
    orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
  },
} satisfies Prisma.EmployeeSalarySelect

// Every salary of the employee, the latest first (future ones too) - confidential: the service checked the viewer
export async function listSalaries(employeeId: number, db: DbClient = prisma) {
  const rows = await db.employeeSalary.findMany({ where: { employeeId }, orderBy: { effectiveFrom: 'desc' }, select: salaryRowSelect })
  return rows.map((row) => ({ ...row, lines: linesAsNumbers(row.lines) }))
}

export type SalaryInput = {
  effectiveFrom: Date
  annualCtc: number
  performancePayAnnual: number | null
  currency: string
  reason: Prisma.EmployeeSalaryCreateInput['reason']
  jobChangeRequestId: number | null
  approvedAt: Date | null
  approvedById: number | null
  lines: { salaryComponentId: number; monthlyAmount: number }[]
}

// A new salary row from its day, with its breakup
export function createSalary(employeeId: number, data: SalaryInput, actorId: ActorId, db: DbClient = prisma) {
  const { lines, ...row } = data
  return db.employeeSalary.create({
    data: { ...row, employeeId, ...createdBy(actorId), lines: { create: lines.map((line) => ({ ...line, ...createdBy(actorId) })) } },
    select: { id: true },
  })
}

// Replaces a salary row's figures and breakup (a correction for the same day)
export function replaceSalary(id: number, data: Omit<SalaryInput, 'effectiveFrom'>, actorId: ActorId, db: DbClient = prisma) {
  const { lines, ...row } = data
  return db.employeeSalary.update({
    where: { id },
    data: { ...row, ...updatedBy(actorId), lines: { deleteMany: {}, create: lines.map((line) => ({ ...line, ...createdBy(actorId) })) } },
    select: { id: true },
  })
}

// --- For a pay run (payroll stage 2, 2026-11-26) ---

// Everyone who worked for the company on at least one day of [from, to] by the job timeline (whatever their placement
// or status today), with what a pay run copies: their job-timeline rows and salaries up to `to` (the earlier ones too, to
// know what was in force on `from`). Filtered by the timeline's company, which scopeWhere cannot express.
// data access: one company's pay run - the payroll service checked Payroll access covering the whole company first
export async function listForPayrollRun(companyId: number, from: Date, to: Date, db: DbClient = prisma) {
  const rows = await db.employee.findMany({
    where: {
      dateOfJoining: { lte: to },
      OR: [{ dateOfLeaving: null }, { dateOfLeaving: { gte: from } }],
      jobRecords: { some: { companyId, effectiveFrom: { lte: to } } },
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      dateOfJoining: true,
      dateOfLeaving: true,
      jobRecords: {
        where: { effectiveFrom: { lte: to } },
        orderBy: { effectiveFrom: 'asc' },
        select: {
          effectiveFrom: true,
          companyId: true,
          employeeCode: true,
          plantId: true,
          departmentId: true,
          costCenterId: true,
          employmentType: true,
          workforceCategory: true,
        },
      },
      salaries: {
        where: { effectiveFrom: { lte: to } },
        orderBy: { effectiveFrom: 'asc' },
        select: { id: true, effectiveFrom: true, annualCtc: true, currency: true, lines: { select: { salaryComponentId: true, monthlyAmount: true } } },
      },
    },
  })
  return rows.map((row) => ({ ...row, salaries: row.salaries.map((salary) => ({ ...salary, lines: linesAsNumbers(salary.lines) })) }))
}

// The salary that applies today (the newest one already in effect), with its monthly breakup in the components'
// order, or null - confidential: only for the employee and SALARY READ (checked in the service)
export async function findCurrentSalary(employeeId: number, db: DbClient = prisma) {
  const row = await db.employeeSalary.findFirst({
    where: { employeeId, effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      effectiveFrom: true,
      annualCtc: true,
      performancePayAnnual: true,
      currency: true,
      lines: {
        select: { monthlyAmount: true, salaryComponent: { select: { id: true, name: true, kind: true } } },
        orderBy: [{ salaryComponent: { displayOrder: 'asc' } }, { salaryComponent: { name: 'asc' } }],
      },
    },
  })
  return row && { ...row, lines: linesAsNumbers(row.lines) }
}

// The employee with this exact (upper-case) code, or null.
// By the employee's code - or a code they had before a company transfer (2026-11-20)
export async function findByCode(employeeCode: string, db: DbClient = prisma) {
  const byCode = await db.employee.findUnique({ where: { employeeCode }, select: employeeSelect })
  if (byCode) return byCode
  const former = await db.employeeFormerCode.findUnique({ where: { employeeCode }, select: { employee: { select: employeeSelect } } })
  return former?.employee ?? null
}

// The profile of the employee with this exact (upper-case) code, or null - with their HOD post as it is now
// By the employee's code - or a code they had before a company transfer (2026-11-20)
export async function findProfileByCode(employeeCode: string, db: DbClient = prisma) {
  const select = { ...profileSelect, hodPost: hodPostSelect(new Date()) }
  const byCode = await db.employee.findUnique({ where: { employeeCode }, select })
  if (byCode) return byCode
  const former = await db.employeeFormerCode.findUnique({ where: { employeeCode }, select: { employee: { select } } })
  return former?.employee ?? null
}

// The id of the employee using this work e-mail (lower case), or null.
export function findIdByWorkEmail(workEmail: string, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { workEmail }, select: { id: true, employeeCode: true } })
}

export type DirectoryFilter = {
  // whose employees may be listed (data access - required, so no list can leave it out) and whose PF / ESIC numbers may
  // be filtered on
  scope: DataScope
  numbersScope: DataScope
  search?: string | undefined
  companyIds?: number[] | undefined
  plantIds?: number[] | undefined
  workLocationIds?: number[] | undefined
  departmentIds?: number[] | undefined
  designationIds?: number[] | undefined
  employmentTypes?: EmploymentType[] | undefined
  workforceCategories?: WorkforceCategory[] | undefined
  // the employees who report to the employee with this (upper-case) code
  reportingManagerCode?: string | undefined
  status?: EmployeeStatus | undefined
  numbersPending?: boolean | undefined
  joinedFrom?: Date | undefined
}

// PF / ESIC numbers still to record: the UAN or PF member number where PF applies, the ESIC IP number where ESIC
// applies (as the service's pendingNumbers)
const numbersPendingWhere: Prisma.EmployeeWhereInput = {
  statutory: {
    OR: [
      { pfApplicable: true, uan: null },
      { pfApplicable: true, pfNumber: null },
      { esicApplicable: true, esicIpNumber: null },
    ],
  },
}

// The directory's counts (the employees in `scope`, whatever the filters): by status, joined since `monthStart`, and the
// active employees (in `numbers` too) whose PF / ESIC numbers are not all recorded
export async function summary(monthStart: Date, scopes: { scope: DataScope; numbers: DataScope }, db: DbClient = prisma) {
  const inScope = scopeWhere(scopes.scope)
  const [byStatus, joinedThisMonth, numbersPending] = await Promise.all([
    db.employee.groupBy({ by: ['status'], where: inScope, _count: { _all: true } }),
    db.employee.count({ where: { AND: [inScope, { dateOfJoining: { gte: monthStart } }] } }),
    db.employee.count({ where: { AND: [inScope, scopeWhere(scopes.numbers), { status: 'ACTIVE' }, numbersPendingWhere] } }),
  ])
  const count = (status: EmployeeStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0
  return { active: count('ACTIVE'), onNotice: count('ON_NOTICE'), exited: count('EXITED'), joinedThisMonth, numbersPending }
}

// The filters as a query. `search`: every word must match the code or a part of the name ("demo hr" finds "Demo HR
// Head"). `except`: leave one filter out (for that filter's counts).
const any = <T>(values: T[] | undefined) => (values?.length ? { in: values } : undefined)
function directoryWhere(filter: DirectoryFilter, except?: DirectoryFacet): Prisma.EmployeeWhereInput {
  const words = (filter.search ?? '').split(/\s+/).filter(Boolean)
  return {
    ...(except !== 'companyId' && filter.companyIds?.length && { companyId: any(filter.companyIds) }),
    ...(except !== 'plantId' && filter.plantIds?.length && { plantId: any(filter.plantIds) }),
    ...(except !== 'workLocationId' && filter.workLocationIds?.length && { workLocationId: any(filter.workLocationIds) }),
    ...(except !== 'departmentId' && filter.departmentIds?.length && { departmentId: any(filter.departmentIds) }),
    ...(except !== 'designationId' && filter.designationIds?.length && { designationId: any(filter.designationIds) }),
    ...(except !== 'employmentType' && filter.employmentTypes?.length && { employmentType: any(filter.employmentTypes) }),
    ...(except !== 'workforceCategory' && filter.workforceCategories?.length && { workforceCategory: any(filter.workforceCategories) }),
    ...(filter.reportingManagerCode !== undefined && { reportingManager: { employeeCode: filter.reportingManagerCode } }),
    ...(filter.status !== undefined && { status: filter.status }),
    ...(filter.joinedFrom !== undefined && { dateOfJoining: { gte: filter.joinedFrom } }),
    AND: [
      scopeWhere(filter.scope),
      ...(filter.numbersPending ? [scopeWhere(filter.numbersScope), numbersPendingWhere] : []),
      ...words.map((word) => ({
        OR: [
          { employeeCode: { contains: word, mode: 'insensitive' as const } },
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { middleName: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
        ],
      })),
    ],
  }
}

export type DirectorySort = { field: 'code' | 'name' | 'joined' | 'designation' | 'department' | 'company'; direction: 'asc' | 'desc' }
function directoryOrder({ field, direction }: DirectorySort): Prisma.EmployeeOrderByWithRelationInput[] {
  const then: Prisma.EmployeeOrderByWithRelationInput = { employeeCode: 'asc' }
  switch (field) {
    case 'name':
      return [{ firstName: direction }, { lastName: direction }, then]
    case 'joined':
      return [{ dateOfJoining: direction }, then]
    case 'designation':
      return [{ designation: { name: direction } }, then]
    case 'department':
      return [{ department: { name: direction } }, then]
    case 'company':
      return [{ company: { code: direction } }, then]
    default:
      return [{ employeeCode: direction }]
  }
}

// Up to 20 employees who have not left, whose code or name matches every word - the people pickers (code, name,
// designation and company only)
// data access: whole group on purpose - the people pickers (code, name, designation, company only - agreed 2026-11-18)
export function searchPeople(words: string[], db: DbClient = prisma) {
  return db.employee.findMany({
    where: {
      status: { not: 'EXITED' },
      AND: words.map((word) => ({
        OR: [
          { employeeCode: { contains: word, mode: 'insensitive' as const } },
          // a code they had before a company transfer (2026-11-20)
          { formerCodes: { some: { employeeCode: { contains: word, mode: 'insensitive' as const } } } },
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { middleName: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
        ],
      })),
    },
    orderBy: { employeeCode: 'asc' },
    take: 20,
    select: { employeeCode: true, firstName: true, middleName: true, lastName: true, designation: { select: { name: true } }, company: { select: { code: true } } },
  })
}

// One page of the directory in the chosen order, and how many employees match in total.
export async function list(
  filter: DirectoryFilter,
  page: { skip: number; take: number },
  sort: DirectorySort = { field: 'code', direction: 'asc' },
  db: DbClient = prisma,
) {
  const where = directoryWhere(filter)
  const [rows, total] = await Promise.all([
    db.employee.findMany({ where, orderBy: directoryOrder(sort), skip: page.skip, take: page.take, select: directorySelect }),
    db.employee.count({ where }),
  ])
  return { rows, total }
}

// How many employees each value of a filter would show, with the other filters applied (a value's count does not
// shrink when another value of the same filter is ticked). Null = not set (e.g. no department).
export type DirectoryFacet = 'companyId' | 'plantId' | 'workLocationId' | 'departmentId' | 'designationId' | 'employmentType' | 'workforceCategory'
const FACETS: DirectoryFacet[] = ['companyId', 'plantId', 'workLocationId', 'departmentId', 'designationId', 'employmentType', 'workforceCategory']
export async function facets(filter: DirectoryFilter, db: DbClient = prisma) {
  const counts = await Promise.all(
    FACETS.map(async (facet) => {
      const rows = (await db.employee.groupBy({ by: [facet], where: directoryWhere(filter, facet), _count: { _all: true } })) as unknown as (Record<
        DirectoryFacet,
        string | number | null
      > & { _count: { _all: number } })[]
      return [facet, rows.map((row) => ({ value: row[facet], count: row._count._all }))] as const
    }),
  )
  return Object.fromEntries(counts) as Record<DirectoryFacet, { value: string | number | null; count: number }[]>
}

// The joining record's office-use checklist of an employee (null when they did not join through the system)
export function findOnboardingChecklist(employeeId: number, db: DbClient = prisma) {
  return db.employeeOnboarding.findUnique({
    where: { employeeId },
    select: { joiningFormalitiesCompletedAt: true, payrollUpdatedAt: true, idCardIssuedAt: true, inductionDate: true },
  })
}

// Sets the office-use checklist (the joining record is created for an employee who has none)
export function upsertOnboardingChecklist(
  employeeId: number,
  data: {
    joiningFormalitiesCompletedAt?: Date | null
    joiningFormalitiesCompletedById?: number | null
    payrollUpdatedAt?: Date | null
    payrollUpdatedById?: number | null
    idCardIssuedAt?: Date | null
    idCardIssuedById?: number | null
    inductionDate?: Date | null
  },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.employeeOnboarding.upsert({
    where: { employeeId },
    create: { employeeId, ...data, ...createdBy(actorId) },
    update: { ...data, ...updatedBy(actorId) },
    select: { joiningFormalitiesCompletedAt: true, payrollUpdatedAt: true, idCardIssuedAt: true, inductionDate: true },
  })
}

// The employee who already holds this UAN or ESIC IP number, or null
export function findStatutoryNumberOwner(number: { uan: string } | { esicIpNumber: string }, db: DbClient = prisma) {
  return db.employeeStatutory.findFirst({ where: number, select: { employeeId: true, employee: { select: { employeeCode: true } } } })
}

// Sets the PF / ESIC numbers of an employee (their PF / ESIC row is created if they have none yet)
export function upsertStatutoryNumbers(
  employeeId: number,
  numbers: { uan?: string | null; pfNumber?: string | null; esicIpNumber?: string | null },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.employeeStatutory.upsert({
    where: { employeeId },
    create: { employeeId, ...numbers, ...createdBy(actorId) },
    update: { ...numbers, ...updatedBy(actorId) },
    select: { uan: true, pfNumber: true, esicIpNumber: true },
  })
}

// The employee who holds this identity number (looked up by its fingerprint), or null.
// data access: whole group on purpose - an Aadhaar / PAN / passport number must not belong to two employees in any company
export function findByIdentityHash(type: IdentityDocumentType, numberHash: string, db: DbClient = prisma) {
  return db.employee.findFirst({
    where: { identityDocuments: { some: { type, numberHash } } },
    select: { id: true, employeeCode: true, status: true },
  })
}

// Just enough to identify an employee (login, "who is logged in").
const employeeSummarySelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  middleName: true,
  lastName: true,
  status: true,
  // where they are - for data-access checks (core/auth/scope.ts)
  companyId: true,
  plantId: true,
  departmentId: true,
  // their HOD post (BACKLOG 3e)
  hodPostId: true,
} satisfies Prisma.EmployeeSelect

export function findSummaryById(id: number, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { id }, select: employeeSummarySelect })
}

// Who an approval request is about: where they are, their managers and HOD post (modules/approvals), or null
export function findApprovalSubject(id: number, db: DbClient = prisma) {
  return db.employee.findUnique({
    where: { id },
    select: { ...employeeSummarySelect, reportingManagerId: true, functionalManagerId: true },
  })
}

// Name and work e-mail - to e-mail an employee (e.g. the HR person who sent an offer)
export function findMailContactById(id: number, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { id }, select: { firstName: true, middleName: true, lastName: true, workEmail: true } })
}

// Code, name, status, personal e-mail and company of an employee - for e-mails about their login, or null
export function findContactByCode(employeeCode: string, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { employeeCode }, select: { ...employeeSummarySelect, personalEmail: true, company: { select: { name: true } } } })
}

// By the employee's code - or a code they had before a company transfer (2026-11-20: it still signs them in, finds them,
// and is never given to anyone else)
export async function findSummaryByCode(employeeCode: string, db: DbClient = prisma) {
  const byCode = await db.employee.findUnique({ where: { employeeCode }, select: employeeSummarySelect })
  if (byCode) return byCode
  const former = await db.employeeFormerCode.findUnique({ where: { employeeCode }, select: { employee: { select: employeeSummarySelect } } })
  return former?.employee ?? null
}

// A code retired by a company transfer (2026-11-20)
export function createFormerCode(
  data: { employeeId: number; employeeCode: string; companyId: number; usedUntil: Date; jobChangeRequestId: number | null },
  actorId: ActorId,
  db: DbClient = prisma,
) {
  return db.employeeFormerCode.create({ data: { ...data, ...createdBy(actorId) }, select: { id: true } })
}

// The codes the employee had before, the latest first
export function listFormerCodes(employeeId: number, db: DbClient = prisma) {
  return db.employeeFormerCode.findMany({
    where: { employeeId },
    orderBy: { usedUntil: 'desc' },
    select: { employeeCode: true, usedUntil: true, company: { select: { code: true, name: true } } },
  })
}

// data access: by ids the caller already holds - names of who did something, and logins / sessions the service filters by data access
export function listSummariesByIds(ids: number[], db: DbClient = prisma) {
  return db.employee.findMany({ where: { id: { in: ids } }, select: employeeSummarySelect })
}

// Code, name and status of the employee with this (lower-case) work e-mail, or null - signing in with the e-mail
export function findSummaryByWorkEmail(workEmail: string, db: DbClient = prisma) {
  return db.employee.findUnique({ where: { workEmail }, select: employeeSummarySelect })
}

// Employees with this mobile (its last 10 digits, however written) or this e-mail (personal or work) - a possible
// duplicate of a candidate
// data access: whole group on purpose - an offer's possible duplicates (shown as code + name outside the viewer's data access - A5)
export function findByContact(contact: { mobileDigits: string | null; email: string | null }, db: DbClient = prisma) {
  const or: Prisma.EmployeeWhereInput[] = []
  if (contact.mobileDigits) or.push({ mobile: { contains: contact.mobileDigits } })
  if (contact.email) or.push({ personalEmail: contact.email }, { workEmail: contact.email })
  if (!or.length) return Promise.resolve([])
  return db.employee.findMany({
    where: { OR: or },
    take: 5,
    select: {
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      mobile: true,
      personalEmail: true,
      workEmail: true,
      // where they are (data access)
      companyId: true,
      plantId: true,
      departmentId: true,
    },
  })
}

// --- for attendance (2026-11-16) ---

// The employees attendance works on: employed at some point between `from` and `to`, optionally only these ids /
// placements / matching a search; with what the day's calculation needs (work location's time zone, joining / leaving)
// `scope`: whose attendance may be listed (data access - required; the reporting tree and system steps pass SYSTEM_SCOPE
// with the ids)
export function listAttendancePeople(
  filter: {
    scope: DataScope
    ids?: number[]
    companyIds?: number[]
    // (plants and cost centres: the Schedules list's filters - 2026-11-23)
    plantIds?: number[]
    workLocationIds?: number[]
    departmentIds?: number[]
    costCenterIds?: number[]
    search?: string
    from: Date
    to: Date
  },
  db: DbClient = prisma,
) {
  const words = (filter.search ?? '').split(/\s+/).filter(Boolean)
  return db.employee.findMany({
    where: {
      ...(filter.ids && { id: { in: filter.ids } }),
      ...(filter.companyIds?.length && { companyId: { in: filter.companyIds } }),
      ...(filter.workLocationIds?.length && { workLocationId: { in: filter.workLocationIds } }),
      ...(filter.departmentIds?.length && { departmentId: { in: filter.departmentIds } }),
      ...(filter.plantIds?.length && { plantId: { in: filter.plantIds } }),
      ...(filter.costCenterIds?.length && { costCenterId: { in: filter.costCenterIds } }),
      dateOfJoining: { lte: filter.to },
      OR: [{ dateOfLeaving: null }, { dateOfLeaving: { gte: filter.from } }],
      // (the scope inside AND - spread next to the OR above it would be overwritten)
      AND: [
        scopeWhere(filter.scope),
        ...words.map((word) => ({
          OR: [
            { employeeCode: { contains: word, mode: 'insensitive' as const } },
            { firstName: { contains: word, mode: 'insensitive' as const } },
            { lastName: { contains: word, mode: 'insensitive' as const } },
          ],
        })),
      ],
    },
    orderBy: { employeeCode: 'asc' },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      companyId: true,
      // (where they are - data access)
      plantId: true,
      departmentId: true,
      workLocationId: true,
      reportingManagerId: true,
      dateOfJoining: true,
      dateOfLeaving: true,
      workEmail: true,
      personalEmail: true,
      company: { select: { code: true } },
      workLocation: { select: { name: true, timezone: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
      plant: { select: { plantCode: true, name: true } },
      costCenter: { select: { code: true } },
    },
  })
}

// --- for leave (2026-11-22) ---

// The employees leave works on: employed on `on` (or at some point from..to), optionally only these ids / placements /
// matching a search - with what the leave rules need (gender, employment type, joining / leaving). `scope`: whose leave
// may be listed (data access - required; the reporting tree, the HOD department and the credit job pass SYSTEM_SCOPE with
// the ids / for everyone)
export function listLeavePeople(
  filter: { scope: DataScope; ids?: number[]; companyIds?: number[]; departmentIds?: number[]; search?: string; from: Date; to: Date },
  db: DbClient = prisma,
) {
  const words = (filter.search ?? '').split(/\s+/).filter(Boolean)
  return db.employee.findMany({
    where: {
      ...(filter.ids && { id: { in: filter.ids } }),
      ...(filter.companyIds?.length && { companyId: { in: filter.companyIds } }),
      ...(filter.departmentIds?.length && { departmentId: { in: filter.departmentIds } }),
      dateOfJoining: { lte: filter.to },
      OR: [{ dateOfLeaving: null }, { dateOfLeaving: { gte: filter.from } }],
      // (the scope inside AND - spread next to the OR above it would be overwritten)
      AND: [
        scopeWhere(filter.scope),
        ...words.map((word) => ({
          OR: [
            { employeeCode: { contains: word, mode: 'insensitive' as const } },
            { firstName: { contains: word, mode: 'insensitive' as const } },
            { lastName: { contains: word, mode: 'insensitive' as const } },
          ],
        })),
      ],
    },
    orderBy: { employeeCode: 'asc' },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      gender: true,
      employmentType: true,
      dateOfJoining: true,
      dateOfLeaving: true,
      // (their teammates - the team coverage warning)
      reportingManagerId: true,
      // (where they are - data access)
      companyId: true,
      plantId: true,
      departmentId: true,
      company: { select: { code: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
    },
  })
}

// The ids of the employees who report to any of these managers (one level)
// data access: the reporting tree - a relationship, not data-access rows
export async function listDirectReportIds(managerIds: number[], db: DbClient = prisma) {
  if (!managerIds.length) return []
  return (await db.employee.findMany({ where: { reportingManagerId: { in: managerIds } }, select: { id: true } })).map((r) => r.id)
}

// The employees with these (upper-case) codes: code -> id
// data access: codes to ids only - the services then check each employee's data access
export async function mapCodesToIds(codes: string[], db: DbClient = prisma) {
  if (!codes.length) return new Map<string, number>()
  const [rows, former] = await Promise.all([
    db.employee.findMany({ where: { employeeCode: { in: codes } }, select: { id: true, employeeCode: true } }),
    // a code someone had before a company transfer still matches them (e.g. punches sent with the old code - 2026-11-20)
    db.employeeFormerCode.findMany({ where: { employeeCode: { in: codes } }, select: { employeeId: true, employeeCode: true } }),
  ])
  return new Map([...former.map((f) => [f.employeeCode, f.employeeId] as const), ...rows.map((r) => [r.employeeCode, r.id] as const)])
}

// Name, status and e-mail addresses of several employees - to e-mail them (reminders)
// data access: the e-mail addresses of people the service already chose (reminder recipients)
export function listMailContactsByIds(ids: number[], db: DbClient = prisma) {
  return db.employee.findMany({
    where: { id: { in: ids } },
    select: { id: true, employeeCode: true, firstName: true, middleName: true, lastName: true, status: true, workEmail: true, personalEmail: true },
  })
}

// --- The company directory and the org chart (2026-11-21) ---

// What everyone may see of a colleague - basic fields only: never personal contacts, IDs, salary, documents
const colleagueSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  middleName: true,
  lastName: true,
  dateOfJoining: true,
  dateOfBirth: true,
  bloodGroup: true,
  workEmail: true,
  reportingManagerId: true,
  company: { select: { id: true, code: true, name: true } },
  plant: { select: { id: true, plantCode: true, name: true } },
  department: { select: { id: true, name: true } },
  designation: { select: { name: true } },
  workLocation: { select: { name: true } },
  reportingManager: { select: { employeeCode: true, firstName: true, middleName: true, lastName: true } },
  _count: { select: { directReports: { where: { status: { not: 'EXITED' as const } } } } },
} satisfies Prisma.EmployeeSelect
export type ColleagueRow = Prisma.EmployeeGetPayload<{ select: typeof colleagueSelect }>

export type ColleagueFilter = {
  words: string[]
  companyIds?: number[] | undefined
  plantIds?: number[] | undefined
  departmentIds?: number[] | undefined
  // my team: who reports to this employee
  reportingManagerId?: number | undefined
  // my department: these employees (the HOD's)
  ids?: number[] | undefined
  // only these (data access): the directory's Excel export of "everyone" (the user, 2026-11-24 - an export holds only
  // the records the viewer's access covers; the page itself stays open to all)
  scope?: DataScope | undefined
}

// One page of the directory, by name
// data access: the company directory - every logged-in employee sees everyone working now in every company, basic fields
// only (the user, 2026-11-21)
export async function listDirectory(filter: ColleagueFilter, paging: { skip: number; take: number }, db: DbClient = prisma) {
  const where: Prisma.EmployeeWhereInput = {
    AND: [
      { status: { not: 'EXITED' } },
      ...filter.words.map((word) => ({
        OR: [
          { employeeCode: { contains: word, mode: 'insensitive' as const } },
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { middleName: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
        ],
      })),
      ...(filter.companyIds?.length ? [{ companyId: { in: filter.companyIds } }] : []),
      ...(filter.plantIds?.length ? [{ plantId: { in: filter.plantIds } }] : []),
      ...(filter.departmentIds?.length ? [{ departmentId: { in: filter.departmentIds } }] : []),
      ...(filter.reportingManagerId !== undefined ? [{ reportingManagerId: filter.reportingManagerId }] : []),
      ...(filter.ids ? [{ id: { in: filter.ids } }] : []),
      ...(filter.scope ? [scopeWhere(filter.scope)] : []),
    ],
  }
  const [rows, total] = await Promise.all([
    db.employee.findMany({ where, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { employeeCode: 'asc' }], ...paging, select: colleagueSelect }),
    db.employee.count({ where }),
  ])
  return { rows, total }
}

// One colleague as the directory shows them, if working now
// data access: the company directory / org chart - basic fields of anyone working now (the user, 2026-11-21)
export function findDirectoryEntry(where: { employeeCode: string } | { id: number }, db: DbClient = prisma) {
  return db.employee.findFirst({ where: { ...where, status: { not: 'EXITED' } }, select: colleagueSelect })
}

// Who reports to this employee now, by name
// data access: the org chart - basic fields of anyone working now (the user, 2026-11-21)
export function listDirectReports(managerId: number, db: DbClient = prisma) {
  return db.employee.findMany({
    where: { reportingManagerId: managerId, status: { not: 'EXITED' } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: 200,
    select: colleagueSelect,
  })
}
