import { reportFile, reportSheet } from '#core/excel/report'
import { writeReport } from '#core/excel/report'
import { hasAccess } from '#core/auth/access'
import { type DataScope, hasLevelAt, type Placement, scopeAllows, scopeOf } from '#core/auth/scope'
import { encrypt, fingerprint, last4 } from '#core/crypto/encryption'
import { prisma, SYSTEM_ACTOR, type AccessArea, type AccessLevel, type ActorId, type EmployeeStatus, type DbClient, type EmploymentType, type IdentityDocumentType, type MedicalResult, type Prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { companiesService, costCentersService, departmentsService, designationsService, gradesService, plantsService, positionsService, workLocationsService } from '#modules/organization'
import { formatDate, today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as hodsService from './hods/hods.service.js'
import * as employeesRepository from './employees.repository.js'
import * as jobHistoryRepository from './job-history/job-history.repository.js'
import { JOB_FIELDS, type JobField, jobDetailsOf } from './job-history/job-history.repository.js'
import {
  type addEmployeeInput,
  addressesSchema,
  addressSchema,
  bankAccountSchema,
  certificationSchema,
  createEmployeeInput,
  emergencyContactSchema,
  EMPLOYMENT_TYPE_LABEL,
  WORKFORCE_LABEL,
  type exportEmployeesInput,
  type searchEmployeesInput,
  type directoryInput,
  type exportDirectoryInput,
  type orgChartInput,
  familyMemberSchema,
  identityDocumentSchema,
  type listEmployeesInput,
  medicalInfoSchema,
  nomineesSchema,
  normaliseIdentityNumber,
  previousEmploymentSchema,
  qualificationSchema,
  STATUS_LABEL,
  statutorySchema,
  type updateEmployeeInput,
  type updateOnboardingChecklistInput,
  type updateStatutoryNumbersInput,
} from './employees.schema.js'

// Business rules for employees. All database access goes through employees.repository.ts.

// The employee with this code; throws NOT_FOUND if there is none.
// `employeeCode` must already be upper-case (employeeCodeSchema does that for API input).
export async function getByCode(employeeCode: string, db?: DbClient) {
  const employee = await employeesRepository.findByCode(employeeCode, db)
  if (!employee) {
    throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  }
  return employee
}

// --- Who may see / change which employee (data access, 2026-11-18 - core/auth/scope.ts) ---
// An employee as the checks need them: the code and where they are (company / plant / department)
export type EmployeeRef = { employeeCode: string; companyId: number; plantId: number; departmentId: number | null }
export const placementOf = (employee: EmployeeRef): Placement => ({
  companyId: employee.companyId,
  plantId: employee.plantId,
  departmentId: employee.departmentId,
})
const notFound = (employeeCode: string) => new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
const noAccess = () => new ORPCError('FORBIDDEN', { message: 'You do not have access to this' })

// Everyone may see their own record; anyone else's needs "Employee · Directory & job" (EMPLOYEES) View covering where the
// employee is
export function canSeeEmployee(viewer: CurrentUser, employee: EmployeeRef) {
  return viewer.employeeCode === employee.employeeCode || hasLevelAt(viewer, 'EMPLOYEES', placementOf(employee), 'READ')
}
// Outside one's data access an employee is "not found" (A3, 2026-11-18) - their existence is not given away
export function assertCanView(viewer: CurrentUser, employee: EmployeeRef) {
  if (!canSeeEmployee(viewer, employee)) throw notFound(employee.employeeCode)
}

// The employee with this (upper-case) code and where they are, if the viewer may see them - else NOT_FOUND
export async function getEmployeeFor(viewer: CurrentUser, employeeCode: string, db?: DbClient) {
  const employee = await employeesRepository.findSummaryByCode(employeeCode, db)
  if (!employee || !canSeeEmployee(viewer, employee)) throw notFound(employeeCode)
  return employee
}

// The parts of an employee's record with an area of their own (split 2026-11-16): one's own record always (to view);
// anyone else's needs "Employee · Directory & job" View (EMPLOYEES - the way in) plus the part's area at this level, both
// covering where the employee is.
export type RecordPart = 'EMPLOYEE_PERSONAL_DETAILS' | 'EMPLOYEE_IDS_BANK' | 'EMPLOYEE_DOCUMENTS' | 'MEDICAL' | 'SALARY'
export function seesPart(viewer: CurrentUser, employee: EmployeeRef, part: RecordPart, level: AccessLevel = 'READ') {
  if (viewer.employeeCode === employee.employeeCode && level === 'READ') return true
  const at = placementOf(employee)
  return hasLevelAt(viewer, 'EMPLOYEES', at, 'READ') && hasLevelAt(viewer, part, at, level)
}
export function assertPart(viewer: CurrentUser, employee: EmployeeRef, part: RecordPart, level: AccessLevel = 'READ') {
  if (seesPart(viewer, employee, part, level)) return
  assertCanView(viewer, employee)
  throw noAccess()
}

// Changing an employee: this area (default "Employee · Directory & job") at Edit covering where they are - and, for a
// move, `to` where they go (data access on both, 2026-11-18)
export function assertCanChange(viewer: CurrentUser, employee: EmployeeRef, area: AccessArea = 'EMPLOYEES', to?: Placement) {
  assertCanView(viewer, employee)
  if (!hasLevelAt(viewer, area, placementOf(employee), 'WRITE')) throw noAccess()
  if (to && !hasLevelAt(viewer, area, to, 'WRITE')) {
    throw new ORPCError('FORBIDDEN', { message: 'You can only move an employee to a plant / department inside your data access' })
  }
}

// Changing an employee's job details directly ("Edit details", the Excel import) - instead of a job change through
// approval - needs "Approve job & salary changes" at Edit covering each place (D7, the user 2026-11-20)
export function mayChangeJobDirectly(viewer: CurrentUser, at: Placement[]) {
  return at.every((placement) => hasLevelAt(viewer, 'JOB_CHANGE_APPROVAL', placement, 'WRITE'))
}
export function assertMayChangeJobDirectly(viewer: CurrentUser, at: Placement[]) {
  if (!mayChangeJobDirectly(viewer, at)) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Changing job details directly needs "Approve job & salary changes" - ask for a job change instead (Raise a change on the Pay & career page), which goes through approval',
    })
  }
}

// A new employee may only be placed inside the viewer's Edit data access
export function assertCanPlace(viewer: CurrentUser, placement: Placement, area: AccessArea = 'EMPLOYEES') {
  if (!hasLevelAt(viewer, area, placement, 'WRITE')) {
    throw new ORPCError('FORBIDDEN', { message: 'You can only place people in a company / plant / department inside your data access' })
  }
}

// What a viewer without "Employee · Personal" gets instead of those parts of the profile
const HIDDEN_PERSONAL = {
  fatherName: null,
  motherName: null,
  gender: null,
  dateOfBirth: null,
  placeOfBirth: null,
  maritalStatus: null,
  spouseName: null,
  marriageDate: null,
  countryOfOrigin: null,
  nationality: null,
  religion: null,
  category: null,
  bloodGroup: null,
  heightCm: null,
  weightKg: null,
  identificationMark: null,
  hobbies: null,
  isPhysicallyDisabled: null,
  disabilityType: null,
  disabilityPercent: null,
  addresses: [],
  emergencyContacts: [],
  qualifications: [],
  certifications: [],
  previousJobs: [],
  familyMembers: [],
  nominees: [],
}
// ... and without "Employee · IDs, bank & statutory"
const HIDDEN_IDS = { identityDocuments: [], bankAccounts: [], statutory: null }

// The profile of the employee with this code, for the logged-in `viewer` (see assertCanView): the employee, their
// addresses, emergency contacts, identity documents and bank accounts (numbers as last 4 digits only), PF / ESIC
// details, and who created / changed the record and completed joining.
export async function getByCodeFor(viewer: CurrentUser, employeeCode: string) {
  const employee = await employeesRepository.findProfileByCode(employeeCode)
  const ref = employee && { employeeCode, companyId: employee.company.id, plantId: employee.plant.id, departmentId: employee.department?.id ?? null }
  if (!employee || !ref || !canSeeEmployee(viewer, ref)) throw notFound(employeeCode)
  const { createdById, updatedById, onboarding, candidate, medicalInfo, reportingManager, functionalManager, hodPost, ...rest } = employee
  // who heads the post now, and who is appointed next (earliest first - BACKLOG 3e)
  const now = new Date()
  const [first, second] = hodPost?.hodAppointments ?? []
  const hodNow = first && first.startsAt <= now ? first : undefined
  const hodNext = hodNow ? second : first
  const person = await lookupPeople([
    createdById,
    updatedById,
    onboarding?.completedById,
    onboarding?.joiningFormalitiesCompletedById,
    onboarding?.payrollUpdatedById,
    onboarding?.idCardIssuedById,
  ])
  // health data and the salary: the employee themselves, or the area (Employee · Medical / salary)
  const seesMedical = seesPart(viewer, ref, 'MEDICAL')
  const seesSalary = seesPart(viewer, ref, 'SALARY')
  // the parts with an area of their own (2026-11-16) - empty, with a flag, without it
  const seesPersonal = seesPart(viewer, ref, 'EMPLOYEE_PERSONAL_DETAILS')
  const seesIds = seesPart(viewer, ref, 'EMPLOYEE_IDS_BANK')
  const salary = await employeesRepository.findCurrentSalary(employee.id)
  return {
    ...rest,
    ...(seesPersonal ? {} : HIDDEN_PERSONAL),
    ...(seesIds ? {} : HIDDEN_IDS),
    personalDetailsHidden: !seesPersonal,
    idsBankHidden: !seesIds,
    documentsHidden: !seesPart(viewer, ref, 'EMPLOYEE_DOCUMENTS'),
    reportingManager: reportingManager && { employeeCode: reportingManager.employeeCode, name: fullName(reportingManager) },
    functionalManager: functionalManager && { employeeCode: functionalManager.employeeCode, name: fullName(functionalManager) },
    // the HOD post (a plant-department - BACKLOG 3e), who heads it now - null holder: nobody (approvals go to HR); the
    // employee themselves when they head the place they work in - and who is appointed next
    hod: hodPost && {
      postId: hodPost.id,
      company: hodPost.plant.company.code,
      plant: { plantCode: hodPost.plant.plantCode, name: hodPost.plant.name },
      department: hodPost.department.name,
      holder: hodNow ? { employeeCode: hodNow.employee.employeeCode, name: fullName(hodNow.employee), since: hodNow.startsAt, until: hodNow.endsAt } : null,
      next: hodNext ? { employeeCode: hodNext.employee.employeeCode, name: fullName(hodNext.employee), from: hodNext.startsAt } : null,
    },
    medicalInfo: seesMedical ? medicalInfo : null,
    medicalInfoHidden: !seesMedical && medicalInfo !== null,
    salary: seesSalary ? salary : null,
    salaryHidden: !seesSalary && salary !== null,
    createdBy: person(createdById),
    updatedBy: person(updatedById),
    // the joining day (null for employees imported or created directly), with the declaration signed online
    joining: onboarding
      ? {
          completedAt: onboarding.completedAt,
          completedBy: person(onboarding.completedById),
          formDate: onboarding.formDate,
          declarationAcceptedAt: onboarding.declarationAcceptedAt,
          // JF §11 "For HR / Office Use Only"
          joiningFormalitiesCompletedAt: onboarding.joiningFormalitiesCompletedAt,
          joiningFormalitiesCompletedBy: person(onboarding.joiningFormalitiesCompletedById),
          payrollUpdatedAt: onboarding.payrollUpdatedAt,
          payrollUpdatedBy: person(onboarding.payrollUpdatedById),
          idCardIssuedAt: onboarding.idCardIssuedAt,
          idCardIssuedBy: person(onboarding.idCardIssuedById),
          inductionDate: onboarding.inductionDate,
          // the pre-employment medical (from onboarding) - health data: only with Medical (2026-11-23, before anyone who
          // saw the profile saw it)
          medicalResult: seesMedical ? onboarding.medicalResult : null,
          medicalExamDate: seesMedical ? onboarding.medicalExamDate : null,
          medicalExaminer: seesMedical ? onboarding.medicalExaminer : null,
          medicalRestrictions: seesMedical ? onboarding.medicalRestrictions : null,
          medicalHidden: !seesMedical && onboarding.medicalResult !== null,
        }
      : null,
    // the offer this employee joined from
    candidateId: candidate?.id ?? null,
  }
}

const DEFAULT_PAGE_SIZE = 25

// The PF / ESIC numbers still to be recorded: the UAN and PF member number where PF applies, the ESIC IP number where
// ESIC applies (all given after joining - see updateStatutoryNumbers)
function pendingNumbers(s: { pfApplicable: boolean; uan: string | null; pfNumber: string | null; esicApplicable: boolean; esicIpNumber: string | null } | null) {
  if (!s) return []
  return [
    ...(s.pfApplicable && !s.uan ? ['UAN'] : []),
    ...(s.pfApplicable && !s.pfNumber ? ['PF member number'] : []),
    ...(s.esicApplicable && !s.esicIpNumber ? ['ESIC IP number'] : []),
  ]
}

// HR's "For HR / Office Use Only" checklist after joining (JF §11): payroll updated and ID card / access created are
// recorded with when and by whom (ticking again keeps the first time); the induction date as given.
export async function updateOnboardingChecklist(
  { employeeCode, joiningFormalitiesCompleted, payrollUpdated, idCardIssued, inductionDate }: z.infer<typeof updateOnboardingChecklistInput>,
  viewer: CurrentUser,
) {
  const actorId = viewer.employeeId
  const employee = await getEmployeeFor(viewer, employeeCode)
  assertCanChange(viewer, employee)
  const current = await employeesRepository.findOnboardingChecklist(employee.id)
  const now = new Date()
  const toggle = (on: boolean | undefined, at: Date | null | undefined) =>
    on === undefined ? undefined : on ? (at ? undefined : { at: now, by: actorId }) : { at: null, by: null }
  const formalities = toggle(joiningFormalitiesCompleted, current?.joiningFormalitiesCompletedAt)
  const payroll = toggle(payrollUpdated, current?.payrollUpdatedAt)
  const idCard = toggle(idCardIssued, current?.idCardIssuedAt)
  return employeesRepository.upsertOnboardingChecklist(
    employee.id,
    {
      ...(formalities && { joiningFormalitiesCompletedAt: formalities.at, joiningFormalitiesCompletedById: formalities.by }),
      ...(payroll && { payrollUpdatedAt: payroll.at, payrollUpdatedById: payroll.by }),
      ...(idCard && { idCardIssuedAt: idCard.at, idCardIssuedById: idCard.by }),
      ...(inductionDate !== undefined && { inductionDate }),
    },
    actorId,
  )
}

// HR records the PF / ESIC numbers given after joining (a first-job joiner has no UAN until the company registers
// them). A UAN or ESIC IP number that already belongs to another employee is refused (the database's unique rule,
// mapped centrally to 409).
export async function updateStatutoryNumbers({ employeeCode, ...numbers }: z.infer<typeof updateStatutoryNumbersInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const employee = await getEmployeeFor(viewer, employeeCode)
  assertPart(viewer, employee, 'EMPLOYEE_IDS_BANK', 'WRITE')
  // say whose number it is (the database's unique rule would only say "already exists")
  const checks = [
    numbers.uan ? { label: 'UAN', owner: await employeesRepository.findStatutoryNumberOwner({ uan: numbers.uan }) } : null,
    numbers.esicIpNumber ? { label: 'ESIC IP number', owner: await employeesRepository.findStatutoryNumberOwner({ esicIpNumber: numbers.esicIpNumber }) } : null,
  ]
  for (const check of checks) {
    if (check?.owner && check.owner.employeeId !== employee.id) {
      throw new ORPCError('CONFLICT', { message: `This ${check.label} already belongs to employee ${check.owner.employee.employeeCode}` })
    }
  }
  return employeesRepository.upsertStatutoryNumbers(employee.id, numbers, actorId)
}

// The employee directory (EMPLOYEES READ is checked by the router).
// The PF / ESIC numbers still to record are IDs / PF information: shown, counted and filtered only with "Employee IDs,
// bank & PF / ESIC" View.
export async function listEmployees(input: z.infer<typeof listEmployeesInput>, viewer: CurrentUser) {
  const scopes = directoryScopes(viewer)
  const page = input?.page ?? 1
  const pageSize = input?.pageSize ?? DEFAULT_PAGE_SIZE
  const now = today()
  const [{ rows, total }, facets, summary] = await Promise.all([
    employeesRepository.list(
      directoryFilter(input, scopes),
      { skip: (page - 1) * pageSize, take: pageSize },
      { field: input?.sort ?? 'code', direction: input?.direction ?? 'asc' },
    ),
    // how many each filter value would show (the filter drawer's counts) - of the employees the viewer may see
    employeesRepository.facets(directoryFilter(input, scopes)),
    // the directory's counts, whatever the filters (the page's stat tiles) - of the employees the viewer may see
    employeesRepository.summary(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), scopes),
  ])
  const seesNumbersOf = (row: { company: { id: number }; plant: { id: number }; department: { id: number } | null }) =>
    scopeAllows(scopes.numbers, { companyId: row.company.id, plantId: row.plant.id, departmentId: row.department?.id ?? null })
  return {
    items: rows.map(({ id: _id, firstName, middleName, lastName, statutory, reportingManager, functionalManager, ...row }) => ({
      ...row,
      name: fullName({ firstName, middleName, lastName }),
      reportingManager: reportingManager && { employeeCode: reportingManager.employeeCode, name: fullName(reportingManager) },
      functionalManager: functionalManager && { employeeCode: functionalManager.employeeCode, name: fullName(functionalManager) },
      pendingNumbers: seesNumbersOf(row) ? pendingNumbers(statutory) : [],
    })),
    total,
    page,
    pageSize,
    summary: { ...summary, numbersPending: seesAnyNumbers(scopes) ? summary.numbersPending : null },
    facets,
  }
}

// Whose employees the directory shows (Employee · Directory & job View) and whose PF / ESIC numbers it may count and
// filter ("Employee · IDs, bank & statutory" View) - data access, 2026-11-18
function directoryScopes(viewer: CurrentUser) {
  return { scope: scopeOf(viewer, 'EMPLOYEES', 'READ'), numbers: scopeOf(viewer, 'EMPLOYEE_IDS_BANK', 'READ') }
}
const seesAnyNumbers = (scopes: ReturnType<typeof directoryScopes>) => scopes.numbers.slices === 'ALL' || scopes.numbers.slices.length > 0

// The directory's filters as the repository takes them (the PF / ESIC filter only with the IDs access)
function directoryFilter(input: z.infer<typeof listEmployeesInput> | z.infer<typeof exportEmployeesInput>, scopes: ReturnType<typeof directoryScopes>) {
  const seesNumbers = seesAnyNumbers(scopes)
  return {
    scope: scopes.scope,
    numbersScope: scopes.numbers,
    search: input?.search,
    companyIds: input?.companyIds,
    plantIds: input?.plantIds,
    workLocationIds: input?.workLocationIds,
    departmentIds: input?.departmentIds,
    designationIds: input?.designationIds,
    employmentTypes: input?.employmentTypes,
    workforceCategories: input?.workforceCategories,
    reportingManagerCode: input?.reportingManagerCode,
    status: input?.status,
    numbersPending: seesNumbers ? input?.numbersPending : undefined,
    joinedFrom: input?.joinedFrom,
  }
}

// Everything the joining day turns into employee rows (the candidates module builds it from the offer and the
// joining-form draft). Every section is validated again with this module's schemas.
export type JoiningInput = {
  employee: z.input<typeof createEmployeeInput>
  addresses: z.input<typeof addressSchema>[]
  emergencyContacts: z.input<typeof emergencyContactSchema>[]
  identityDocuments: z.input<typeof identityDocumentSchema>[]
  bankAccount: z.input<typeof bankAccountSchema> | undefined
  statutory: z.input<typeof statutorySchema> | undefined
  qualifications: z.input<typeof qualificationSchema>[]
  certifications: z.input<typeof certificationSchema>[]
  previousJobs: z.input<typeof previousEmploymentSchema>[]
  familyMembers: z.input<typeof familyMemberSchema>[]
  nominees: z.input<typeof nomineesSchema>
  // the medical information with the consent it was given with (Regular and Consultant & Intern joiners)
  medical: (z.input<typeof medicalInfoSchema> & { consentAt: Date; consentById: ActorId; consentText: string | null }) | undefined
  completedAt: Date
  // the declaration the candidate signed online with the joining form (null: signed on paper only)
  declaration: { acceptedAt: Date; acceptedById: ActorId; formDate: Date } | null
  // the pre-employment medical recorded before joining (null: none - Overseas)
  preEmploymentMedical: PreEmploymentMedical | null
  // the salary agreed in the offer - the employee's first salary, effective from the date of joining
  salary: JoiningSalary
}
export type JoiningSalary = {
  annualCtc: number
  performancePayAnnual: number | null
  currency: string
  lines: { salaryComponentId: number; monthlyAmount: number }[]
}
export type PreEmploymentMedical = { result: MedicalResult; examDate: Date | null; examiner: string | null; restrictions: string | null }

// Creates the employee on the joining day with all joining-form records and the joining record (completedById =
// the actor). Identity and bank numbers are stored encrypted, with their last 4 digits and (identity) fingerprint.
// Throws CONFLICT for a code, work e-mail or identity number that is already used.
// The code is the next of the company's series (2026-11-16) - pass the transaction as `db`, so the series stays locked
// until the employee is saved.
export async function createFromJoining(input: JoiningInput, actorId: ActorId, db?: DbClient) {
  const parsed = createEmployeeInput.parse(input.employee)
  if (parsed.employeeCode && (await employeesRepository.findSummaryByCode(parsed.employeeCode, db))) {
    throw new ORPCError('CONFLICT', { message: `Employee code ${parsed.employeeCode} is already used` })
  }
  // the HOD post: the plant-department they are placed in (BACKLOG 3e)
  const hodPostId = await hodPostOf(parsed, db)
  const employee = { ...parsed, hodPostId, employeeCode: parsed.employeeCode ?? (await takeEmployeeCode(parsed.companyId, actorId, db)) }
  if (employee.workEmail) {
    const owner = await employeesRepository.findIdByWorkEmail(employee.workEmail, db)
    if (owner) throw new ORPCError('CONFLICT', { message: `The work e-mail ${employee.workEmail} is already used by ${owner.employeeCode}` })
  }
  const identityDocuments = input.identityDocuments.map((doc) => identityDocumentSchema.parse(doc))
  for (const doc of identityDocuments) {
    const owner = await employeesRepository.findByIdentityHash(doc.type, fingerprint(doc.number), db)
    if (owner) {
      throw new ORPCError('CONFLICT', { message: `This ${doc.type} number already belongs to employee ${owner.employeeCode} (${owner.status})` })
    }
  }
  const bank = input.bankAccount && bankAccountSchema.parse(input.bankAccount)

  return employeesRepository.createWithJoiningRecords(
    {
      employee,
      addresses: addressesSchema.parse(input.addresses),
      emergencyContacts: input.emergencyContacts.map((contact) => emergencyContactSchema.parse(contact)),
      identityDocuments: identityDocuments.map(({ number, ...doc }) => ({
        ...doc,
        numberEncrypted: encrypt(number),
        numberLast4: last4(number),
        numberHash: fingerprint(number),
      })),
      bankAccounts: bank
        ? [
            {
              bankName: bank.bankName,
              branch: bank.branch,
              accountHolderName: bank.accountHolderName,
              accountNumberEncrypted: encrypt(bank.accountNumber),
              accountNumberLast4: last4(bank.accountNumber),
              ifsc: bank.ifsc,
              accountType: bank.accountType,
              isSalaryAccount: true,
            },
          ]
        : [],
      statutory: input.statutory ? statutorySchema.parse(input.statutory) : null,
      qualifications: input.qualifications.map((row) => qualificationSchema.parse(row)),
      certifications: input.certifications.map((row) => certificationSchema.parse(row)),
      previousJobs: input.previousJobs.map((row) => previousEmploymentSchema.parse(row)),
      familyMembers: input.familyMembers.map((row) => {
        const { aadhaar, ...member } = familyMemberSchema.parse(row)
        return { ...member, ...(aadhaar && { aadhaarEncrypted: encrypt(aadhaar), aadhaarLast4: last4(aadhaar) }) }
      }),
      nominees: nomineesSchema.parse(input.nominees),
      medicalInfo: input.medical
        ? {
            ...medicalInfoSchema.parse(input.medical),
            consentAt: input.medical.consentAt,
            consentById: input.medical.consentById,
            consentText: input.medical.consentText,
          }
        : null,
      completedAt: input.completedAt,
      declaration: input.declaration,
      preEmploymentMedical: input.preEmploymentMedical,
      salary: { ...input.salary, effectiveFrom: employee.dateOfJoining },
    },
    actorId,
    db,
  )
}

// Validates here as well as in the router, so scripts and other modules get the same rules (throws ZodError).
// Duplicate code / work email -> 409 and unknown company or master ids -> 409 are mapped centrally.
// `actorId`: who creates it (SYSTEM_ACTOR for a script). Without a code, the next of the company's series is taken -
// pass a transaction as `db` then.
export async function createEmployee(input: z.input<typeof createEmployeeInput>, actorId: ActorId, db?: DbClient) {
  const parsed = createEmployeeInput.parse(input)
  await plantsService.assertPlacement(parsed, { plant: true, department: true }, db)
  if (parsed.costCenterId !== undefined) await assertCostCenter(parsed.costCenterId, parsed.companyId, db)
  // the HOD post: the plant-department they are placed in (BACKLOG 3e)
  const hodPostId = await hodPostOf(parsed, db)
  const employeeCode = parsed.employeeCode ?? (await takeEmployeeCode(parsed.companyId, actorId, db))
  return employeesRepository.create({ ...parsed, hodPostId, employeeCode }, actorId, db)
}

// The next free code of the company's series: one already used (imported or typed by hand) is skipped, as in the old
// HRMS. Call inside the transaction that saves the employee.
export async function takeEmployeeCode(companyId: number, actorId: ActorId, db?: DbClient) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const code = await companiesService.takeNextEmployeeCode(companyId, actorId, db)
    if (!(await employeesRepository.findSummaryByCode(code, db))) return code
  }
  throw new ORPCError('CONFLICT', { message: 'The next 1000 codes of this company are all used - set a higher next employee number' })
}

// The reporting manager, by employee code, checked: someone who has not left, not the employee themselves, and not
// someone who reports (directly or further up) to the employee - that would be a loop. `employeeId`: the employee
// being changed (null for a new one). Returns the manager's id.
export async function resolveReportingManager(managerCode: string, employeeId: number | null, db?: DbClient) {
  const manager = await employeesRepository.findManagerLinkByCode(managerCode, db)
  if (!manager) throw new ORPCError('BAD_REQUEST', { message: `No employee found with code ${managerCode} (reporting manager)` })
  if (manager.status === 'EXITED') throw new ORPCError('BAD_REQUEST', { message: `${managerCode} has left - pick a current employee as reporting manager` })
  if (employeeId !== null) await assertNoReportingLoop(manager.id, employeeId, db)
  return manager.id
}

// The manager is not the employee and does not report (directly or further up) to them - else BAD_REQUEST
export async function assertNoReportingLoop(managerId: number, employeeId: number, db?: DbClient) {
  let link = await employeesRepository.findManagerLinkById(managerId, db)
  const managerCode = link?.employeeCode
  for (let depth = 0; link && depth < 100; depth++) {
    if (link.id === employeeId) {
      throw new ORPCError('BAD_REQUEST', {
        message: depth === 0 ? 'An employee cannot report to themselves' : `${managerCode} reports (directly or further up) to this employee - that would be a loop`,
      })
    }
    link = link.reportingManagerId === null ? null : await employeesRepository.findManagerLinkById(link.reportingManagerId, db)
  }
}

// The functional manager (the user, 2026-11-19 - shown only, no approvals), by employee code, checked: someone who has
// not left and not the employee themselves. No loop check - it gives no rights, so a loop harms nothing. Returns the id.
export async function resolveFunctionalManager(managerCode: string, employeeId: number | null, db?: DbClient) {
  const manager = await employeesRepository.findManagerLinkByCode(managerCode, db)
  if (!manager) throw new ORPCError('BAD_REQUEST', { message: `No employee found with code ${managerCode} (functional manager)` })
  if (manager.status === 'EXITED') throw new ORPCError('BAD_REQUEST', { message: `${managerCode} has left - pick a current employee as functional manager` })
  if (manager.id === employeeId) throw new ORPCError('BAD_REQUEST', { message: 'An employee cannot be their own functional manager' })
  return manager.id
}

// The cost centre an employee's salary is booked to (the user, 2026-11-19): one of their own company's, and active when
// chosen (one retired since stays on the employees who have it)
export async function assertCostCenter(costCenterId: number, companyId: number, db?: DbClient) {
  const costCenter = await costCentersService.getCostCenter(costCenterId, db)
  if (costCenter.company.id !== companyId) throw new ORPCError('BAD_REQUEST', { message: `Cost centre ${costCenter.code} belongs to another company` })
  if (!costCenter.isActive) throw new ORPCError('BAD_REQUEST', { message: `Cost centre ${costCenter.code} is no longer active` })
}

// The masters an employee is given anew must still be in use (2026-11-23, the review - only the plant, the department at
// the plant and the cost centre were checked): a retired company, department, work location, designation, grade or
// position is refused. One the employee already has stays - pass only what is chosen anew (null / undefined: nothing).
export type MasterChoice = Partial<Record<'companyId' | 'departmentId' | 'workLocationId' | 'designationId' | 'gradeId' | 'positionId', number | null>>
export async function assertMastersInUse(chosen: MasterChoice, db?: DbClient) {
  const retired: string[] = []
  if (chosen.companyId != null) {
    const company = await companiesService.getCompany(chosen.companyId, db)
    if (!company.isActive) retired.push(`Company ${company.code}`)
  }
  if (chosen.workLocationId != null) {
    const location = await workLocationsService.getWorkLocation(chosen.workLocationId, db)
    if (!location.isActive) retired.push(`Work location ${location.name}`)
  }
  // (an unknown id is refused by the database - mapped centrally)
  const inList = async (id: number | null | undefined, what: string, load: () => Promise<{ id: number; name: string; isActive: boolean }[]>) => {
    if (id == null) return
    const master = (await load()).find((m) => m.id === id)
    if (master && !master.isActive) retired.push(`${what} ${master.name}`)
  }
  await inList(chosen.departmentId, 'Department', () => departmentsService.listDepartments(true))
  await inList(chosen.designationId, 'Designation', () => designationsService.listDesignations(true))
  await inList(chosen.gradeId, 'Grade', () => gradesService.listGrades(true))
  await inList(chosen.positionId, 'Position', () => positionsService.listPositions(true))
  if (retired.length) {
    throw new ORPCError('BAD_REQUEST', { message: `${retired.join(', ')} ${retired.length > 1 ? 'are' : 'is'} no longer in use - choose one that is (Organization page)` })
  }
}

// The dates of an employment that must fit together (as the old HRMS checked): added on or after the day they join, at
// least 18 on the date of joining, and the contract end / probation end / confirmation after joining. A permanent
// employee has no contract end date.
export type EmploymentDates = {
  dateOfBirth?: Date | null | undefined
  dateOfJoining: Date
  employmentType: EmploymentType
  contractEndDate?: Date | null | undefined
  probationEndDate?: Date | null | undefined
  confirmationDate?: Date | null | undefined
}
export function checkEmploymentDates(d: EmploymentDates) {
  const bad = (message: string) => {
    throw new ORPCError('BAD_REQUEST', { message })
  }
  if (d.dateOfBirth) {
    const eighteenth = new Date(Date.UTC(d.dateOfBirth.getUTCFullYear() + 18, d.dateOfBirth.getUTCMonth(), d.dateOfBirth.getUTCDate()))
    if (eighteenth > d.dateOfJoining) bad('The employee must be at least 18 years old on the date of joining')
  }
  if (d.employmentType === 'PERMANENT' && d.contractEndDate) bad('A permanent employee has no contract end date')
  if (d.contractEndDate && d.contractEndDate <= d.dateOfJoining) bad('The contract end date must be after the date of joining')
  if (d.probationEndDate && d.probationEndDate <= d.dateOfJoining) bad('The probation end date must be after the date of joining')
  if (d.confirmationDate && d.confirmationDate < d.dateOfJoining) bad('The confirmation date cannot be before the date of joining')
}

// --- The employee's HOD post (BACKLOG 3e, changed with the user 2026-11-19) ---
// An HOD post is a plant-department (one company + one of its plants + one department running there); its appointments say
// who heads it (hods/hods.service.ts). Every employee stores theirs - for now always the one they are placed in, set
// whenever they are placed (none without a department: approvals go to HR). Stored (the user's decision) to find the HOD
// directly, and so that someone can later be given an HOD from another place.
export function hodPostOf(placement: { plantId: number; departmentId?: number | null | undefined }, db?: DbClient) {
  return placement.departmentId == null ? Promise.resolve(null) : plantsService.findPlantDepartmentId(placement.plantId, placement.departmentId, db)
}

// "Add employee" (EMPLOYEES WRITE): HR adds someone directly, without onboarding (old HRMS, agreed 2026-11-16) - a new
// active employee with the core details; the code is the next of the company's series. No login is created (as in the
// old HRMS - HR gives logins on the Roles & access page).
export async function addEmployee({ reportingManagerCode, functionalManagerCode, ...details }: z.infer<typeof addEmployeeInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  assertCanPlace(viewer, { companyId: details.companyId, plantId: details.plantId, departmentId: details.departmentId ?? null })
  checkEmploymentDates(details)
  await assertMastersInUse(details)
  return prisma.$transaction(async (tx) => {
    const reportingManagerId = reportingManagerCode ? await resolveReportingManager(reportingManagerCode, null, tx) : undefined
    const functionalManagerId = functionalManagerCode ? await resolveFunctionalManager(functionalManagerCode, null, tx) : undefined
    const created = await createEmployee({ ...details, status: 'ACTIVE', reportingManagerId, functionalManagerId }, actorId, tx)
    return { employeeCode: created.employeeCode }
  })
}

// "Edit details" (EMPLOYEES WRITE): the core details of an employee - only the fields sent change, null clears one.
export async function updateEmployee({ employeeCode, reportingManagerCode, functionalManagerCode, ...changes }: z.infer<typeof updateEmployeeInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const current = await getByCode(employeeCode)
  const ref = { employeeCode, companyId: current.company.id, plantId: current.plant.id, departmentId: current.department?.id ?? null }
  const moved = changes.plantId !== undefined || changes.departmentId !== undefined
  assertCanChange(
    viewer,
    ref,
    'EMPLOYEES',
    moved ? { companyId: ref.companyId, plantId: changes.plantId ?? ref.plantId, departmentId: changes.departmentId === undefined ? ref.departmentId : changes.departmentId } : undefined,
  )
  // D7 (the user, 2026-11-20): job details change through approval (jobChanges.create); changing them here directly
  // needs "Approve job & salary changes" where the employee is (and where a move goes)
  const differs = <T>(change: T | undefined, now: T) => change !== undefined && change !== now
  const jobChanged =
    differs(changes.plantId, current.plant.id) ||
    differs(changes.departmentId, current.department?.id ?? null) ||
    differs(changes.workLocationId, current.workLocation?.id ?? null) ||
    differs(changes.designationId, current.designation?.id ?? null) ||
    differs(changes.gradeId, current.grade?.id ?? null) ||
    differs(changes.positionId, current.position?.id ?? null) ||
    differs(changes.costCenterId, current.costCenter?.id ?? null) ||
    differs(changes.employmentType, current.employmentType) ||
    differs(changes.workforceCategory, current.workforceCategory) ||
    differs(reportingManagerCode, current.reportingManager?.employeeCode ?? null) ||
    differs(functionalManagerCode, current.functionalManager?.employeeCode ?? null)
  if (jobChanged) {
    const moveTo = { companyId: ref.companyId, plantId: changes.plantId ?? ref.plantId, departmentId: changes.departmentId ?? ref.departmentId }
    assertMayChangeJobDirectly(viewer, [placementOf(ref), moveTo])
  }
  const pick = <T>(change: T | undefined, now: T) => (change === undefined ? now : change)
  checkEmploymentDates({
    dateOfBirth: pick(changes.dateOfBirth, current.dateOfBirth),
    dateOfJoining: pick(changes.dateOfJoining, current.dateOfJoining),
    employmentType: pick(changes.employmentType, current.employmentType),
    contractEndDate: pick(changes.contractEndDate, current.contractEndDate),
    probationEndDate: pick(changes.probationEndDate, current.probationEndDate),
    confirmationDate: pick(changes.confirmationDate, current.confirmationDate),
  })
  // the plant and department as they will be: a new plant keeps the department only if it runs there
  await plantsService.assertPlacement(
    { companyId: current.company.id, plantId: changes.plantId ?? current.plant.id, departmentId: pick(changes.departmentId, current.department?.id) },
    {
      plant: changes.plantId !== undefined && changes.plantId !== current.plant.id,
      department: changes.departmentId != null && changes.departmentId !== current.department?.id,
    },
  )
  if (changes.costCenterId != null && changes.costCenterId !== current.costCenter?.id) await assertCostCenter(changes.costCenterId, current.company.id)
  const anew = <T>(change: T | undefined, now: T) => (differs(change, now) ? change : undefined)
  await assertMastersInUse({
    departmentId: anew(changes.departmentId, current.department?.id ?? null),
    workLocationId: anew(changes.workLocationId, current.workLocation?.id ?? null),
    designationId: anew(changes.designationId, current.designation?.id ?? null),
    gradeId: anew(changes.gradeId, current.grade?.id ?? null),
    positionId: anew(changes.positionId, current.position?.id ?? null),
  })
  return prisma.$transaction(async (tx) => {
    const data: Prisma.EmployeeUncheckedUpdateInput = { ...changes }
    if (reportingManagerCode !== undefined) {
      data.reportingManagerId = reportingManagerCode === null ? null : await resolveReportingManager(reportingManagerCode, current.id, tx)
    }
    if (functionalManagerCode !== undefined) {
      data.functionalManagerId = functionalManagerCode === null ? null : await resolveFunctionalManager(functionalManagerCode, current.id, tx)
    }
    // a move: the HOD post follows - the plant-department they are placed in now (BACKLOG 3e)
    const placementAfter = { plantId: changes.plantId ?? current.plant.id, departmentId: pick(changes.departmentId, current.department?.id ?? null) }
    if (placementAfter.plantId !== current.plant.id || placementAfter.departmentId !== (current.department?.id ?? null)) {
      data.hodPostId = await hodPostOf(placementAfter, tx)
    }
    await employeesRepository.update(current.id, data, actorId, tx)
    // a correction: the job timeline's entry in force is fixed too (no new entry - that is "Change job")
    await correctJobRecords(current.id, data, actorId, tx)
    return { employeeCode }
  })
}

// The people pickers: up to 20 employees who have not left, by code or name, across the whole group (only code, name,
// designation and company - so a manager can be picked from another plant; data access does not narrow it)
export async function searchPeople(input: z.infer<typeof searchEmployeesInput>) {
  const words = (input?.query ?? '').split(/\s+/).filter(Boolean)
  const rows = await employeesRepository.searchPeople(words)
  return rows.map((row) => ({ employeeCode: row.employeeCode, name: fullName(row), designation: row.designation?.name ?? null, company: row.company.code }))
}

// The directory as an Excel file (EMPLOYEES READ): every employee matching the filters, one row each.
export async function exportEmployees(input: z.infer<typeof exportEmployeesInput>, viewer: CurrentUser) {
  const scopes = directoryScopes(viewer)
  const seesNumbers = seesAnyNumbers(scopes)
  const { rows, total } = await employeesRepository.list(directoryFilter(input, scopes), { skip: 0, take: 20_000 }, { field: input?.sort ?? 'code', direction: input?.direction ?? 'asc' })
  if (total > rows.length) throw new ORPCError('BAD_REQUEST', { message: 'This report exceeds 20,000 employees. Narrow the filters and export again.' })
  const bytes = await writeReport([
    {
      name: 'Employees',
      columns: [
        { header: 'Employee code', key: 'code', width: 14 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Status', key: 'status' },
        { header: 'Company', key: 'company', width: 28 },
        { header: 'Plant', key: 'plant', width: 26 },
        { header: 'Work location', key: 'location', width: 20 },
        { header: 'Department', key: 'department', width: 22 },
        { header: 'Designation', key: 'designation', width: 22 },
        { header: 'Position', key: 'position', width: 22 },
        { header: 'Employment type', key: 'employmentType', width: 16 },
        { header: 'Workforce', key: 'workforce', width: 20 },
        { header: 'Date of joining', key: 'dateOfJoining', date: true, width: 15 },
        { header: 'Reporting manager code', key: 'managerCode', width: 16 },
        { header: 'Reporting manager', key: 'managerName', width: 26 },
        { header: 'Functional manager code', key: 'functionalCode', width: 16 },
        { header: 'Functional manager', key: 'functionalName', width: 26 },
        { header: 'Cost centre', key: 'costCenter', width: 22 },
        // IDs / PF information - only with "Employee · IDs, bank & statutory" View
        ...(seesNumbers ? [{ header: 'PF / ESIC numbers to record', key: 'pending', width: 30 }] : []),
      ],
      rows: rows.map((e) => ({
        code: e.employeeCode,
        name: fullName(e),
        status: STATUS_LABEL[e.status],
        company: e.company.name,
        plant: `${e.plant.plantCode} ${e.plant.name}`,
        location: e.workLocation?.name,
        department: e.department?.name,
        designation: e.designation?.name,
        position: e.position?.name,
        employmentType: EMPLOYMENT_TYPE_LABEL[e.employmentType],
        workforce: WORKFORCE_LABEL[e.workforceCategory],
        dateOfJoining: e.dateOfJoining,
        managerCode: e.reportingManager?.employeeCode,
        managerName: e.reportingManager && fullName(e.reportingManager),
        functionalCode: e.functionalManager?.employeeCode,
        functionalName: e.functionalManager && fullName(e.functionalManager),
        costCenter: e.costCenter && `${e.costCenter.code} ${e.costCenter.name}`,
        // only for employees whose IDs / PF information the viewer may see (data access)
        pending: scopeAllows(scopes.numbers, { companyId: e.company.id, plantId: e.plant.id, departmentId: e.department?.id ?? null })
          ? pendingNumbers(e.statutory).join(', ')
          : '',
      })),
    },
  ], { filters: [{label:'Filters',value:JSON.stringify(input ?? {})}], title: 'Employee records', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: 'Employees matching the current filters and sort order, within the active role data scope.' })
  return new File([new Uint8Array(bytes)], `employees-${today().toISOString().slice(0, 10)}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// The employee who already holds this Aadhaar / PAN / passport... number, or null.
// Lets other modules warn early about a duplicate (or a rehire) instead of failing at the unique index later.
export function findByIdentityNumber(type: IdentityDocumentType, number: string, db?: DbClient) {
  return employeesRepository.findByIdentityHash(type, fingerprint(normaliseIdentityNumber(number)), db)
}

// Code, name and status of an employee, or null (used by login).
export function findSummaryById(id: number, db?: DbClient) {
  return employeesRepository.findSummaryById(id, db)
}

// The name and work e-mail of an employee, to e-mail them; null if unknown. `email` is null when they have none.
// Who an approval request is about (modules/approvals): code, name, status, where they are, their reporting and
// functional managers and HOD post - or null
export async function findApprovalSubject(id: number, db?: DbClient) {
  const row = await employeesRepository.findApprovalSubject(id, db)
  return row && { ...row, name: fullName(row), placement: placementOf(row) }
}

export async function findMailContact(id: number, db?: DbClient) {
  const row = await employeesRepository.findMailContactById(id, db)
  return row ? { name: fullName(row), email: row.workEmail } : null
}

// `employeeCode` must already be upper-case (employeeCodeSchema does that).
// Code, name, status, personal e-mail and company - for e-mails about the employee's login, or null
export function findContactByCode(employeeCode: string, db?: DbClient) {
  return employeesRepository.findContactByCode(employeeCode, db)
}

export function findSummaryByCode(employeeCode: string, db?: DbClient) {
  return employeesRepository.findSummaryByCode(employeeCode, db)
}

// Code, name and status of several employees (missing ids are left out).
export function listSummariesByIds(ids: number[], db?: DbClient) {
  return employeesRepository.listSummariesByIds(ids, db)
}

// Who did something, as shown next to a time ("Offer sent 12 Nov, by Priya Sharma")
export type Person = { employeeCode: string | null; name: string }
const SYSTEM_PERSON: Person = { employeeCode: null, name: 'System' }

export function fullName(employee: { firstName: string; middleName: string | null; lastName: string | null }) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ')
}

// Looks up the people behind "by" columns (createdById, reviewedById...) with one query, and returns a function
// id -> Person: SYSTEM_ACTOR -> "System", null (action not done) -> null.
export async function lookupPeople(ids: (number | null | undefined)[], db?: DbClient) {
  const wanted = [...new Set(ids.filter((id): id is number => id != null && id !== SYSTEM_ACTOR))]
  const rows = wanted.length ? await employeesRepository.listSummariesByIds(wanted, db) : []
  const byId = new Map(rows.map((e) => [e.id, { employeeCode: e.employeeCode, name: fullName(e) }]))
  return (id: number | null | undefined): Person | null => {
    if (id == null) return null
    if (id === SYSTEM_ACTOR) return SYSTEM_PERSON
    return byId.get(id) ?? { employeeCode: null, name: `Employee #${id}` }
  }
}

// Employees who may be the same person as a candidate (2026-11-16, inspired by the old HRMS's duplicate check): the same
// mobile (last 10 digits) or e-mail - a rehire, or an offer made twice. Says what matched.
export async function findPossibleDuplicates(contact: { mobile: string | null; email: string | null }) {
  const digits = contact.mobile?.replace(/\D/g, '').slice(-10) ?? ''
  const email = contact.email?.toLowerCase() ?? null
  const rows = await employeesRepository.findByContact({ mobileDigits: digits.length === 10 ? digits : null, email })
  return rows.map((e) => ({
    employeeCode: e.employeeCode,
    name: fullName(e),
    status: e.status as EmployeeStatus | null,
    // where they are - the caller shows one outside its data access as code + name only
    placement: { companyId: e.companyId, plantId: e.plantId, departmentId: e.departmentId },
    matchedOn: [
      ...(digits.length === 10 && e.mobile?.replace(/\D/g, '').endsWith(digits) ? ['mobile'] : []),
      ...(email && (e.personalEmail === email || e.workEmail === email) ? ['e-mail'] : []),
    ],
  }))
}

// --- for attendance (2026-11-16) ---

// The employees leave works on (see the repository - 2026-11-22), with their name as one string
export type LeavePerson = Awaited<ReturnType<typeof listLeavePeople>>[number]
export async function listLeavePeople(filter: Parameters<typeof employeesRepository.listLeavePeople>[0], db?: DbClient) {
  const rows = await employeesRepository.listLeavePeople(filter, db)
  return rows.map((row) => ({ ...row, name: fullName(row) }))
}

export type AttendancePerson = Awaited<ReturnType<typeof listAttendancePeople>>[number]
// The employees attendance works on (see the repository), with their name as one string
export async function listAttendancePeople(filter: Parameters<typeof employeesRepository.listAttendancePeople>[0], db?: DbClient) {
  const rows = await employeesRepository.listAttendancePeople(filter, db)
  return rows.map((row) => ({ ...row, name: fullName(row), timezone: row.workLocation?.timezone ?? 'Asia/Kolkata' }))
}

// Everyone below a manager in the reporting line, at every level (their reports, their reports' reports...)
export async function listReportingTreeIds(managerId: number, db?: DbClient) {
  const seen = new Set<number>()
  let level = [managerId]
  for (let depth = 0; level.length && depth < 20; depth++) {
    const next = (await employeesRepository.listDirectReportIds(level, db)).filter((id) => !seen.has(id) && id !== managerId)
    next.forEach((id) => seen.add(id))
    level = next
  }
  return [...seen]
}

// The employee's teammates: everyone else with the same reporting manager (none without a manager) - the leave team
// coverage warning (2026-11-22)
export async function listTeammateIds(employeeId: number, managerId: number | null, db?: DbClient) {
  if (!managerId) return []
  return (await employeesRepository.listDirectReportIds([managerId], db)).filter((id) => id !== employeeId)
}

// Employee codes (any case) -> employee ids, for the ones that exist
export function mapCodesToIds(codes: string[], db?: DbClient) {
  return employeesRepository.mapCodesToIds([...new Set(codes.map((c) => c.trim().toUpperCase()))], db)
}

// The employee signing in with this employee code or work e-mail (2026-11-16), or null
export function findSummaryByLogin(login: string, db?: DbClient) {
  const text = login.trim()
  return text.includes('@') ? employeesRepository.findSummaryByWorkEmail(text.toLowerCase(), db) : employeesRepository.findSummaryByCode(text.toUpperCase(), db)
}

// Name and the address to e-mail several employees at (work e-mail, else personal) - those with neither are left out
export async function listMailContacts(ids: number[], db?: DbClient) {
  const rows = ids.length ? await employeesRepository.listMailContactsByIds(ids, db) : []
  return rows.flatMap((row) => {
    const email = row.workEmail ?? row.personalEmail
    return email ? [{ id: row.id, employeeCode: row.employeeCode, name: fullName(row), status: row.status, email }] : []
  })
}

// What a letter to the employee is filled with (employee-letters): the employee, their address as one line (present,
// else permanent) and the salary in effect
export async function getForLetter(employeeCode: string, db?: DbClient) {
  const employee = await employeesRepository.findProfileByCode(employeeCode, db)
  if (!employee) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const salary = await employeesRepository.findCurrentSalary(employee.id, db)
  const a = employee.addresses.find((x) => x.type === 'PRESENT') ?? employee.addresses.find((x) => x.type === 'PERMANENT')
  const address = a ? [a.houseNo, a.locality, a.cityOrVillage, a.district, [a.state, a.postalCode].filter(Boolean).join(' - ')].filter(Boolean).join(', ') : null
  return { employee, name: fullName(employee), address, salary }
}

// --- The job timeline (the user, 2026-11-19 - job-history/): "Edit details" and the Excel import fix a typing mistake
// without a new entry ---

// After the employee row was corrected: the entry in force takes the corrected details. A corrected date of joining moves the first entry (it must stay
// before the next one). Pass the transaction that changed the employee.
export async function correctJobRecords(employeeId: number, data: Partial<Record<JobField | 'dateOfJoining', unknown>>, actorId: ActorId, db: DbClient) {
  const changed = JOB_FIELDS.filter((f) => data[f] !== undefined)
  const joiningDay = data.dateOfJoining instanceof Date ? data.dateOfJoining : undefined
  if (!changed.length && !joiningDay) return
  const records = await ensureFirstJobRecord(employeeId, actorId, db)
  // the entry in force today: the latest (a change not yet in force is a job-change request, not an entry)
  const current = records.at(-1)
  if (current && changed.length) await jobHistoryRepository.update(current.id, Object.fromEntries(changed.map((f) => [f, data[f]])), actorId, db)
  const [first, second] = records
  if (joiningDay && first?.kind === 'JOINING' && first.effectiveFrom.getTime() !== joiningDay.getTime()) {
    if (second && joiningDay >= second.effectiveFrom) {
      throw new ORPCError('BAD_REQUEST', { message: `The date of joining must be before the first job change (${formatDate(second.effectiveFrom)})` })
    }
    await jobHistoryRepository.update(first.id, { effectiveFrom: joiningDay }, actorId, db)
  }
}

// Employees from before the timeline have no entry: their first one is made from the details they have now, from the
// date of joining (also done for all of them by scripts/backfill-job-records.ts)
export async function ensureFirstJobRecord(employeeId: number, actorId: ActorId, db: DbClient) {
  const records = await jobHistoryRepository.list(employeeId, db)
  if (records.length) return records
  const employee = await jobHistoryRepository.findEmployeeJob(employeeId, db)
  if (!employee) throw new ORPCError('NOT_FOUND', { message: `No employee found with id ${employeeId}` })
  const first = await jobHistoryRepository.create(
    { ...jobDetailsOf(employee), employeeId, companyId: employee.companyId, employeeCode: employee.employeeCode, effectiveFrom: employee.dateOfJoining, kind: 'JOINING' },
    actorId,
    db,
  )
  return [first]
}

// --- Salary history (2026-11-20) ---

// The employee's salaries, the latest first, each with what changed from the one before (%), why, and who approved it.
// Own record, or Employee · Salary View (with Employees View) covering them.
export async function salaryHistory(viewer: CurrentUser, employeeCode: string) {
  const employee = await getEmployeeFor(viewer, employeeCode)
  assertPart(viewer, employee, 'SALARY')
  const rows = await employeesRepository.listSalaries(employee.id)
  const person = await lookupPeople(rows.map((r) => r.approvedById))
  const now = new Date()
  return rows.map((row, index) => {
    const before = rows[index + 1]
    return {
      ...row,
      approvedBy: person(row.approvedById),
      inForce: row.effectiveFrom <= now && !rows.slice(0, index).some((later) => later.effectiveFrom <= now),
      // approved, from a later day
      upcoming: row.effectiveFrom > now,
      // the fixed CTC against the salary before it, in % (one decimal); null for the first
      changePercent: before && before.annualCtc > 0 ? Math.round(((row.annualCtc - before.annualCtc) / before.annualCtc) * 1000) / 10 : null,
    }
  })
}

// Who worked for a company in a pay run's period, with their job-timeline rows and salaries up to its end (payroll stage
// 2) - no viewer check: the payroll service checks Payroll access covering the whole company before calling.
export function listForPayrollRun(companyId: number, from: Date, to: Date, db?: DbClient) {
  return employeesRepository.listForPayrollRun(companyId, from, to, db)
}
export type PayrollRunSource = Awaited<ReturnType<typeof listForPayrollRun>>[number]

// The employee's salaries, the latest first, for the job-change rules (modules/job-changes) - no viewer check
export function listSalaries(employeeId: number, db?: DbClient) {
  return employeesRepository.listSalaries(employeeId, db)
}

// Saves an approved salary (modules/job-changes): a new row from its day, or - a correction - the existing row of that day
// takes the new figures. Inside the caller's transaction.
export async function saveSalary(employeeId: number, salary: employeesRepository.SalaryInput, correction: boolean, actorId: ActorId, tx: DbClient) {
  if (!correction) return employeesRepository.createSalary(employeeId, salary, actorId, tx)
  const existing = (await employeesRepository.listSalaries(employeeId, tx)).find((row) => row.effectiveFrom.getTime() === salary.effectiveFrom.getTime())
  if (!existing) throw new ORPCError('BAD_REQUEST', { message: `There is no salary from ${formatDate(salary.effectiveFrom)} to correct` })
  const { effectiveFrom: _day, ...figures } = salary
  return employeesRepository.replaceSalary(existing.id, figures, actorId, tx)
}

// Gives every employee without a timeline entry their first one (scripts/backfill-job-records.ts) - each in a transaction
// of its own. Returns how many were given one.
export async function backfillJobRecords() {
  const ids = await jobHistoryRepository.listEmployeeIdsWithoutRecords()
  for (const id of ids) await prisma.$transaction((tx) => ensureFirstJobRecord(id, SYSTEM_ACTOR, tx))
  return ids.length
}

// --- The company directory and the org chart (the user, 2026-11-21 - like greytHR's People) ---
// Every logged-in employee sees everyone working now in every company - basic fields only (name, code, designation,
// department, plant, work location, work e-mail, reporting manager, joining day, birthday as day + month, blood group). Never
// personal contacts, IDs, salary or documents. The full profile stays with Employee · Directory & job (getByCodeFor).

function directoryCard(row: employeesRepository.ColleagueRow) {
  return {
    employeeCode: row.employeeCode,
    name: fullName(row),
    designation: row.designation?.name ?? null,
    department: row.department && { id: row.department.id, name: row.department.name },
    company: row.company,
    plant: { id: row.plant.id, code: row.plant.plantCode, name: row.plant.name },
    workLocation: row.workLocation?.name ?? null,
    workEmail: row.workEmail,
    reportingManager: row.reportingManager && { employeeCode: row.reportingManager.employeeCode, name: fullName(row.reportingManager) },
    dateOfJoining: row.dateOfJoining,
    // the birthday without the year (the age is not shown)
    birthday: row.dateOfBirth && { day: row.dateOfBirth.getUTCDate(), month: row.dateOfBirth.getUTCMonth() + 1 },
    bloodGroup: row.bloodGroup,
    directReports: row._count.directReports,
  }
}

const wordsOf = (text: string | undefined) => (text ?? '').split(/\s+/).filter(Boolean).slice(0, 5)

// `group`: my team (who reports to the viewer) or my department (whose HOD the viewer is now) - relationships worked out
// here from the viewer, never from the request (CLAUDE.md section 8, rule 7)
// `scope` (the Excel export of everyone): only the employees it covers
export async function listDirectory(viewer: CurrentUser, input: z.infer<typeof directoryInput>, scope?: DataScope) {
  const page = input?.page ?? 1
  const pageSize = input?.pageSize ?? 50
  const group = input?.group
  const ids = group === 'DEPARTMENT' ? await hodsService.listDepartmentIds(viewer.employeeId) : undefined
  const { rows, total } = await employeesRepository.listDirectory(
    {
      words: wordsOf(input?.search),
      companyIds: input?.companyIds,
      plantIds: input?.plantIds,
      departmentIds: input?.departmentIds,
      reportingManagerId: group === 'TEAM' ? viewer.employeeId : undefined,
      ids,
      scope,
    },
    { skip: (page - 1) * pageSize, take: pageSize },
  )
  return { items: rows.map(directoryCard), total, page, pageSize }
}

// The org chart around one employee (default: the viewer): their managers up to the top (nearest first, at most 15 -
// a loop stops it), the employee, and who reports to them now
export async function orgChart(viewer: CurrentUser, input: z.infer<typeof orgChartInput>) {
  const code = input?.employeeCode ?? viewer.employeeCode
  const person = await employeesRepository.findDirectoryEntry({ employeeCode: code })
  if (!person) throw notFound(code)
  const managers: employeesRepository.ColleagueRow[] = []
  const seen = new Set([person.id])
  let next = person.reportingManagerId
  while (next !== null && !seen.has(next) && managers.length < 15) {
    seen.add(next)
    const manager = await employeesRepository.findDirectoryEntry({ id: next })
    if (!manager) break
    managers.push(manager)
    next = manager.reportingManagerId
  }
  const reports = await employeesRepository.listDirectReports(person.id)
  return { person: directoryCard(person), managers: managers.map(directoryCard), reports: reports.map(directoryCard) }
}

// The directory as Excel - only what the viewer's access covers (the user, 2026-11-24): their team or HOD department as on
// the page; "everyone" only with Employees View, limited to its data access (the page shows everyone, a file is not given)
export async function exportDirectory(viewer:CurrentUser,input:z.infer<typeof exportDirectoryInput>){
  if (!input?.group && !hasAccess(viewer.access, 'EMPLOYEES', 'READ')) {
    throw new ORPCError('FORBIDDEN', { message: 'Exporting everyone needs Employees View - export your team or department instead' })
  }
  const scope = input?.group ? undefined : scopeOf(viewer, 'EMPLOYEES', 'READ')
  const {items,total}=await listDirectory(viewer,{...input,page:1,pageSize:20_000},scope)
  if(total>items.length)throw new ORPCError('BAD_REQUEST',{message:'The directory exceeds 20,000 records. Narrow the filters and export again.'})
  return reportFile([reportSheet('Directory',items,[
    {header:'Employee code',text:true,value:r=>r.employeeCode},{header:'Name',value:r=>r.name},
    {header:'Designation',value:r=>r.designation},{header:'Company',value:r=>r.company.code},
    {header:'Plant',value:r=>r.plant.name},{header:'Department',value:r=>r.department?.name},
    {header:'Work location',value:r=>r.workLocation},{header:'Work email',value:r=>r.workEmail},
    {header:'Reporting manager code',text:true,value:r=>r.reportingManager?.employeeCode},
    {header:'Reporting manager',value:r=>r.reportingManager?.name},{header:'Joined',date:true,value:r=>r.dateOfJoining},
  ])],{title:'People directory',preparedBy:`${viewer.name} (${viewer.employeeCode})`,
    coverage:input?.group?'Basic work-directory fields only, for currently working colleagues of your team or HOD department, with the place/search filters of the directory, across all matching pages.':'Basic work-directory fields only, for currently working colleagues inside your Employees data access, with the place/search filters of the directory, across all matching pages.',
    filters:[{label:'Group',value:input?.group??'Everyone'},{label:'Search',value:input?.search??'All'},
      {label:'Placement filters',value:JSON.stringify({companyIds:input?.companyIds,plantIds:input?.plantIds,departmentIds:input?.departmentIds})}],
  },'people-directory')
}
