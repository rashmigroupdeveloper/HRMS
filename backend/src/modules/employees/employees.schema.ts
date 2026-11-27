import {
  AddressType,
  BankAccountType,
  BloodGroup,
  EmployeeStatus,
  EmploymentType,
  EpfRelative,
  FamilyRelationship,
  Gender,
  IdentityDocumentType,
  JoiningType,
  MaritalStatus,
  MedicalCondition,
  NominationScheme,
  Salutation,
  SocialCategory,
  Sport,
  TaxRegime,
  WorkforceCategory,
} from '#core/db/prisma'
import { countryCodeSchema, emailSchema, idSchema, mobileSchema } from '#shared/schemas/common.schema'
import { isPersonalPan, isValidAadhaar } from '#shared/utils/identity'
import { yearsOld } from '#shared/utils/dates'
import { z } from 'zod'

// Employee codes are stored in UPPER CASE, so input is trimmed and upper-cased: "rml035384 " finds "RML035384".
export const employeeCodeSchema = z.string().trim().min(1, 'Employee code is required').max(30).toUpperCase()

export const getEmployeeByCodeInput = z.object({
  employeeCode: employeeCodeSchema,
})

// The employee directory: optional search and filters, one page at a time (sorted by employee code)
// The directory's sort orders
export const DIRECTORY_SORTS = ['code', 'name', 'joined', 'designation', 'department', 'company'] as const

export const listEmployeesInput = z
  .object({
    // matches the employee code or any part of the name
    search: z.string().trim().max(100).optional(),
    // any of these (2026-11-16: several values per filter); an empty list = no filter
    companyIds: z.array(idSchema).max(100).optional(),
    plantIds: z.array(idSchema).max(200).optional(),
    workLocationIds: z.array(idSchema).max(100).optional(),
    departmentIds: z.array(idSchema).max(100).optional(),
    designationIds: z.array(idSchema).max(200).optional(),
    employmentTypes: z.array(z.enum(EmploymentType)).max(10).optional(),
    workforceCategories: z.array(z.enum(WorkforceCategory)).max(2).optional(),
    // only those who report to this employee
    reportingManagerCode: employeeCodeSchema.optional(),
    status: z.enum(EmployeeStatus).optional(),
    // only those with PF / ESIC numbers still to record (HR's to-do after joining)
    numbersPending: z.boolean().optional(),
    // only those who joined on or after this date (e.g. this month's joiners)
    joinedFrom: z.date().optional(),
    // the order (default: employee code, ascending)
    sort: z.enum(DIRECTORY_SORTS).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
    // 1 = first page
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  })
  .optional()

const text = (max = 100) => z.string().trim().min(1).max(max)

// ---------------------------------------------------------------------------------------------------------------
// Joining-form sections - one schema per employee table (JF = joining form RML/HR/02/01).
// Also used by the candidates module for the pre-joining draft, so both always follow the same rules.
// ---------------------------------------------------------------------------------------------------------------

// A date of birth is in the past - checked when saved (not when the server started), so "today" is always today
const dateOfBirthSchema = z.date().refine((date) => date < new Date(), 'Date of birth must be in the past')
// A date something already happened on (a marriage, leaving a job, joining PF): today or earlier, checked when saved
const pastDate = (what: string) => z.date().refine((date) => date <= new Date(), `The ${what} cannot be in the future`)

// JF §2 personal details (columns of the employees table)
export const personalDetailsSchema = z.object({
  fatherName: text().optional(),
  motherName: text().optional(),
  gender: z.enum(Gender).optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  placeOfBirth: text(100).optional(),
  maritalStatus: z.enum(MaritalStatus).optional(),
  spouseName: text().optional(),
  marriageDate: pastDate('date of marriage').optional(),
  countryOfOrigin: countryCodeSchema.optional(),
  nationality: countryCodeSchema.optional(),
  religion: text(50).optional(),
  category: z.enum(SocialCategory).optional(),
  bloodGroup: z.enum(BloodGroup).optional(),
  heightCm: z.number().int().min(50).max(250).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  identificationMark: text(200).optional(),
  hobbies: text(200).optional(),
  isPhysicallyDisabled: z.boolean().optional(),
  disabilityType: text().optional(),
  disabilityPercent: z.number().int().min(0).max(100).optional(),
})

// The spouse questions are only for someone who is or was married - the spouse counts as family for PF, ESIC and
// gratuity: married or separated (still legally married) give the spouse's name and the date of marriage; widowed
// the late spouse's name; single or divorced (a former spouse is not family) neither. Applied wherever personal
// details are saved (a plain refine here would stop the joining form from extending this schema).
const SPOUSE_NAME_STATUSES: MaritalStatus[] = ['MARRIED', 'SEPARATED', 'WIDOWED']
const MARRIAGE_DATE_STATUSES: MaritalStatus[] = ['MARRIED', 'SEPARATED']
export function checkMarriage(
  personal: { maritalStatus?: MaritalStatus | undefined; spouseName?: string | undefined; marriageDate?: Date | undefined },
  ctx: z.RefinementCtx,
) {
  const status = personal.maritalStatus
  if (personal.spouseName && !(status && SPOUSE_NAME_STATUSES.includes(status))) {
    ctx.addIssue({ code: 'custom', path: ['spouseName'], message: "A spouse's name is only given when married, separated or widowed" })
  }
  if (personal.marriageDate && !(status && MARRIAGE_DATE_STATUSES.includes(status))) {
    ctx.addIssue({ code: 'custom', path: ['marriageDate'], message: 'A date of marriage is only given when married or separated' })
  }
}

// JF §3 present / permanent address (employee_addresses)
export const addressSchema = z
  .object({
    type: z.enum(AddressType),
    houseNo: text(200),
    locality: text(200).optional(),
    cityOrVillage: text(),
    district: text().optional(),
    state: text().optional(),
    // Default IN
    countryCode: countryCodeSchema.optional(),
    postalCode: z.string().trim().min(3).max(12).optional(),
    postOffice: text().optional(),
    policeStation: text().optional(),
    subDivision: text().optional(),
  })
  .refine((a) => (a.countryCode ?? 'IN') !== 'IN' || a.postalCode === undefined || /^\d{6}$/.test(a.postalCode), {
    message: 'An Indian PIN code has 6 digits',
    path: ['postalCode'],
  })

// An employee's addresses: at most one of each type (permanent, present, contact, emergency contact, spouse), and up
// to 3 others
const ADDRESS_TYPE_NAME: Record<AddressType, string> = {
  PERMANENT: 'permanent',
  PRESENT: 'present',
  CONTACT: 'contact',
  EMERGENCY: 'emergency contact',
  SPOUSE: 'spouse',
  OTHER: 'other',
}
export const addressesSchema = z
  .array(addressSchema)
  .max(8)
  .superRefine((addresses, ctx) => {
    const count = (type: AddressType) => addresses.filter((a) => a.type === type).length
    for (const type of Object.keys(ADDRESS_TYPE_NAME) as AddressType[]) {
      if (type !== 'OTHER' && count(type) > 1) ctx.addIssue({ code: 'custom', message: `Only one ${ADDRESS_TYPE_NAME[type]} address` })
    }
    if (count('OTHER') > 3) ctx.addIssue({ code: 'custom', message: 'At most 3 other addresses' })
  })

// JF §9 emergency contact (employee_emergency_contacts)
export const emergencyContactSchema = z.object({
  name: text(),
  relationship: text(50),
  mobile: mobileSchema,
  alternateMobile: mobileSchema.optional(),
  address: text(500).optional(),
})

// Identity numbers are compared and stored without spaces / hyphens, in upper case: "abcde 1234f" -> "ABCDE1234F"
export function normaliseIdentityNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase()
}

// Aadhaar: its check digit too; PAN: a person's (4th letter P) - old HRMS rules, 2026-11-16
const IDENTITY_NUMBER_RULES: Record<IdentityDocumentType, { pattern: RegExp | { test: (value: string) => boolean }; message: string }> = {
  AADHAAR: { pattern: { test: isValidAadhaar }, message: 'This is not a valid Aadhaar number - check the 12 digits' },
  PAN: { pattern: { test: isPersonalPan }, message: "A person's PAN looks like ABCPE1234F (the 4th letter is P)" },
  FOREIGN_TAX_ID: { pattern: /^[A-Z0-9]{4,30}$/, message: 'Use 4-30 letters or digits' },
  PASSPORT: { pattern: /^[A-Z0-9]{6,20}$/, message: 'Use 6-20 letters or digits' },
  DRIVING_LICENCE: { pattern: /^[A-Z0-9]{6,20}$/, message: 'Use 6-20 letters or digits' },
}

// JF §2 / §4, EPF Form 11 items 10-11 (employee_identity_documents)
export const identityDocumentSchema = z
  .object({
    type: z.enum(IdentityDocumentType),
    number: z.string().transform(normaliseIdentityNumber),
    // EPF Form 11 asks for the name exactly as on Aadhaar
    nameOnDocument: text(200).optional(),
    issuingCountry: countryCodeSchema.optional(),
    validFrom: pastDate('date of issue').optional(),
    validUntil: z.date().optional(),
  })
  .superRefine((doc, ctx) => {
    const rule = IDENTITY_NUMBER_RULES[doc.type]
    if (!rule.pattern.test(doc.number)) ctx.addIssue({ code: 'custom', message: rule.message, path: ['number'] })
    if (doc.validFrom && doc.validUntil && doc.validUntil <= doc.validFrom) {
      ctx.addIssue({ code: 'custom', message: 'validUntil must be after validFrom', path: ['validUntil'] })
    }
  })

// JF §5 bank details for salary (employee_bank_accounts)
export const bankAccountSchema = z.object({
  bankName: text(),
  branch: text().optional(),
  accountHolderName: text(200),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6,34}$/, 'Use 6-34 letters or digits')),
  // Indian accounts; overseas accounts have none
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'An IFSC looks like ABCD0123456')
    .optional(),
  accountType: z.enum(BankAccountType),
})

const digits = (count: number, label: string) =>
  z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().regex(new RegExp(`^\\d{${count}}$`), `${label} has ${count} digits`))

// EPF Form 11 + ESIC Form 1 answers (employee_statutory)
export const statutorySchema = z.object({
  // --- EPF ---
  pfApplicable: z.boolean().optional(),
  uan: digits(12, 'A UAN').optional(),
  // Allotted by the employer after joining
  pfNumber: text(30).optional(),
  epfRelative: z.enum(EpfRelative).optional(),
  aadhaarMobile: mobileSchema.optional(),
  isInternationalWorker: z.boolean().optional(),
  wasEpfMember: z.boolean().optional(),
  wasEpsMember: z.boolean().optional(),
  previousPfNumber: text(30).optional(),
  previousExitDate: pastDate('date of exit from the previous job').optional(),
  schemeCertificateNumber: text(30).optional(),
  ppoNumber: text(30).optional(),
  firstEpfEnrolledOn: pastDate('first EPF enrolment date').optional(),
  // Whole rupees
  firstEpfWages: z.number().int().min(0).optional(),
  isEpfMemberBeforeSep2014: z.boolean().optional(),
  epfWithdrawn: z.boolean().optional(),
  epsWithdrawn: z.boolean().optional(),
  epsWithdrawnAfterSep2014: z.boolean().optional(),
  // --- ESIC ---
  esicApplicable: z.boolean().optional(),
  esicIpNumber: digits(10, 'An ESIC IP number').optional(),
  esicBranchOffice: text().optional(),
  esicDispensary: text().optional(),
  previousEsicIpNumber: digits(10, 'An ESIC IP number').optional(),
  previousEmployerCode: text(30).optional(),
  previousEmployerName: text(200).optional(),
  previousEmployerAddress: text(500).optional(),
  previousEmployerContact: text(200).optional(),
  // --- Gratuity Form F declarations ---
  gratuityNoFamily: z.boolean().optional(),
  gratuityParentsNotDependent: z.boolean().optional(),
  gratuityHusbandsParentsNotDependent: z.boolean().optional(),
  gratuityHusbandExcludedOn: pastDate('date of the notice').optional(),
})

// The consent the medical information is given with - stored word for word with it (old HRMS kept the consent text's
// version and SHA-256, 2026-11-16). The joining form shows the same sentence (frontend JoiningFormSections.tsx, the
// "consent" field) - change both together.
export const MEDICAL_CONSENT_TEXT =
  'I agree that the company keeps this medical information for my employment. Only HR with medical access can see it.'

// The joining form's "Employee Medical Information" pages (employee_medical_info) - health data, seen and changed only
// with the MEDICAL access area. Each yes / no question has its details next to it.
export const medicalInfoSchema = z.object({
  conditions: z.array(z.enum(MedicalCondition)).max(10).optional(),
  otherConditions: text(500).optional(),
  takesMedication: z.boolean().optional(),
  medications: text(500).optional(),
  hasPhysicalLimitations: z.boolean().optional(),
  physicalLimitations: text(500).optional(),
  hadSurgery: z.boolean().optional(),
  surgeries: text(500).optional(),
  hasAllergies: z.boolean().optional(),
  allergies: text(500).optional(),
  familyHeartDisease: text(200).optional(),
  familyDiabetes: text(200).optional(),
  familyHighBloodPressure: text(200).optional(),
  familyCancer: text(200).optional(),
  familyStroke: text(200).optional(),
  familyMentalHealth: text(200).optional(),
  familyGeneticDisorders: text(200).optional(),
  familyOther: text(200).optional(),
  hasHereditaryCondition: z.boolean().optional(),
  hereditaryCondition: text(500).optional(),
  needsHealthLeave: z.boolean().optional(),
  healthLeave: text(500).optional(),
  smokes: z.boolean().optional(),
  drinksAlcohol: z.boolean().optional(),
  exercisesRegularly: z.boolean().optional(),
  exerciseFrequency: text(100).optional(),
  needsEmergencyCare: z.boolean().optional(),
  emergencyCare: text(500).optional(),
  sports: z.array(z.enum(Sport)).max(10).optional(),
  otherSports: text(200).optional(),
  sportsFrequency: text(100).optional(),
})

// The Gratuity Form F declarations - stored with the PF / ESIC answers (employee_statutory), asked next to the nominees
export const gratuityDeclarationsSchema = statutorySchema.pick({
  gratuityNoFamily: true,
  gratuityParentsNotDependent: true,
  gratuityHusbandsParentsNotDependent: true,
  gratuityHusbandExcludedOn: true,
})

// HR's "For HR / Office Use Only" checklist (JF §11) after joining: payroll updated, ID card / access created,
// induction date. Only the fields sent change; false / null clears one.
export const updateOnboardingChecklistInput = z.object({
  employeeCode: employeeCodeSchema,
  // JF §11 "Joining Formalities Completed" - everything of the joining done
  joiningFormalitiesCompleted: z.boolean().optional(),
  payrollUpdated: z.boolean().optional(),
  idCardIssued: z.boolean().optional(),
  inductionDate: z.date().nullable().optional(),
})

// HR records the numbers given after joining - the UAN and PF member number (EPFO) and the ESIC IP number - and the
// payroll facts the candidate never answers (payroll stage 4, approved 2026-11-27): PF on full wages, EPS membership, the
// income-tax regime. Only the fields sent change; null clears a number. Never part of the joining form's statutorySchema,
// so the candidate's own pages cannot set them.
export const updateStatutoryNumbersInput = z.object({
  employeeCode: employeeCodeSchema,
  uan: digits(12, 'A UAN').nullable().optional(),
  pfNumber: z.string().trim().toUpperCase().min(1).max(30).nullable().optional(),
  esicIpNumber: digits(10, 'An ESIC IP number').nullable().optional(),
  pfOnFullWages: z.boolean().optional(),
  epsMember: z.boolean().optional(),
  taxRegime: z.enum(TaxRegime).optional(),
})

// JF §6 educational qualification (employee_qualifications)
export const qualificationSchema = z.object({
  qualification: text(),
  institute: text(200),
  yearOfPassing: z.number().int().min(1950).max(2100),
  specialization: text().optional(),
  score: text(20).optional(),
})

// JF §7 additional certification (employee_certifications)
export const certificationSchema = z.object({
  name: text(200),
  issuedBy: text(200),
  certifiedOn: pastDate('date of certification').optional(),
  specialization: text().optional(),
  score: text(20).optional(),
})

// JF §8 previous employment (employee_previous_employments)
export const previousEmploymentSchema = z
  .object({
    employerName: text(200),
    designation: text(),
    fromDate: pastDate('start date'),
    toDate: pastDate('end date'),
    reasonForLeaving: text(500).optional(),
  })
  .refine((job) => job.toDate >= job.fromDate, { message: 'The end date must be after the start date', path: ['toDate'] })

// JF family details + ESIC Form 1 family particulars (employee_family_members)
export const familyMemberSchema = z
  .object({
    name: text(200),
    relationship: z.enum(FamilyRelationship),
    gender: z.enum(Gender).optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    aadhaar: z
      .string()
      .transform(normaliseIdentityNumber)
      .pipe(z.string().refine(isValidAadhaar, 'This is not a valid Aadhaar number - check the 12 digits'))
      .optional(),
    preExistingDisease: text(500).optional(),
    livesWithEmployee: z.boolean().optional(),
    residenceTown: text().optional(),
    residenceState: text().optional(),
  })
  .refine((m) => m.livesWithEmployee !== true || (!m.residenceTown && !m.residenceState), {
    message: 'Town and state are only for a family member who does not live with the employee',
    path: ['residenceTown'],
  })

// JF §4 nominee, Gratuity Form F nominees, ESIC Form 1 nominee (employee_nominees)
export const nomineeSchema = z.object({
  scheme: z.enum(NominationScheme),
  name: text(200),
  relationship: text(50),
  dateOfBirth: dateOfBirthSchema.optional(),
  address: text(500).optional(),
  sharePercent: z.number().int().min(1).max(100).optional(),
  // only for a nominee under 18 - and required then (nomineesSchema, 2026-11-20)
  guardianName: text(200).optional(),
  guardianAddress: text(500).optional(),
})

const NOMINEE_SCHEME_LABEL: Record<NominationScheme, string> = { GENERAL: 'joining-form', GRATUITY: 'gratuity', ESIC: 'ESIC' }

// All nominees of an employee: one joining-form (JF §4) and one ESIC nominee at most; gratuity nominees (Form F)
// each with a share, the shares adding up to 100.
export const nomineesSchema = z
  .array(nomineeSchema)
  .max(10)
  .superRefine((nominees, ctx) => {
    for (const scheme of ['GENERAL', 'ESIC'] as const) {
      if (nominees.filter((n) => n.scheme === scheme).length > 1) {
        ctx.addIssue({ code: 'custom', message: `Only one ${NOMINEE_SCHEME_LABEL[scheme]} nominee` })
      }
    }
    const gratuity = nominees.filter((n) => n.scheme === 'GRATUITY')
    if (gratuity.length && (gratuity.some((n) => n.sharePercent === undefined) || gratuity.reduce((sum, n) => sum + (n.sharePercent ?? 0), 0) !== 100)) {
      ctx.addIssue({ code: 'custom', message: 'Give every gratuity nominee a share; the shares must add up to 100%' })
    }
    // Gratuity Form F asks the nominee's age and full address
    if (gratuity.some((n) => !n.dateOfBirth || !n.address)) {
      ctx.addIssue({ code: 'custom', message: 'Give every gratuity nominee a date of birth and a full address (Form F asks them)' })
    }
    // a nominee under 18: their guardian's name and address; nobody else has a guardian (2026-11-20)
    for (const n of nominees) {
      const minor = n.dateOfBirth !== undefined && yearsOld(n.dateOfBirth) < 18
      if (minor && (!n.guardianName || !n.guardianAddress)) {
        ctx.addIssue({ code: 'custom', message: `${n.name} is under 18 - give their guardian's name and address` })
      }
      if (!minor && (n.guardianName || n.guardianAddress)) {
        ctx.addIssue({ code: 'custom', message: `${n.name} is not under 18 - a guardian is only for a minor nominee` })
      }
    }
  })

// Saved numbers are shown only as their last 4 digits (the candidate's own page, HR editing an employee), so a number
// may be left out to keep the saved one: identity documents by type, the bank account, a family member by name +
// aadhaarLast4. The service puts the kept numbers back; a number that is given is checked with the rules above.
export const keptIdentityDocumentSchema = z
  .object({ ...identityDocumentSchema.shape, number: z.string().max(40).optional() })
  .superRefine((doc, ctx) => {
    if (doc.number === undefined) return
    const rule = IDENTITY_NUMBER_RULES[doc.type]
    if (!rule.pattern.test(normaliseIdentityNumber(doc.number))) ctx.addIssue({ code: 'custom', message: rule.message, path: ['number'] })
  })
export const keptBankAccountSchema = z.object({ ...bankAccountSchema.shape, accountNumber: bankAccountSchema.shape.accountNumber.optional() })
export const keptFamilyMemberSchema = z.object({
  ...familyMemberSchema.shape,
  aadhaarLast4: z.string().max(4).optional(),
})

// ---------------------------------------------------------------------------------------------------------------

// Everything that can be set when creating an employee (the joining day, "Add employee", the import, scripts). Only what
// is known at hiring is required. No employeeCode: the next code of the company's series is taken (2026-11-16).
export const createEmployeeInput = z.object({
  // official / employment
  employeeCode: employeeCodeSchema.optional(),
  joiningType: z.enum(JoiningType),
  employmentType: z.enum(EmploymentType),
  workforceCategory: z.enum(WorkforceCategory),
  dateOfJoining: z.date(),
  contractEndDate: z.date().optional(),
  probationEndDate: z.date().optional(),
  // notice either side gives, during probation / after confirmation (from the offer)
  noticeMonthsProbation: z.number().int().min(0).max(24).optional(),
  noticeMonthsConfirmed: z.number().int().min(0).max(24).optional(),
  confirmationDate: z.date().optional(),
  dateOfLeaving: z.date().optional(),
  status: z.enum(EmployeeStatus).optional(),
  // placement: the plant is one of the company's, the department one of the plant's (checked in the service)
  companyId: idSchema,
  plantId: idSchema,
  workLocationId: idSchema.optional(),
  // required (2026-11-19): one of the plant's departments
  departmentId: idSchema,
  designationId: idSchema.optional(),
  gradeId: idSchema.optional(),
  positionId: idSchema.optional(),
  // one of the company's cost centres (checked in the service)
  costCenterId: idSchema.optional(),
  // who the employee reports to (checked in the service: a current employee, no loop)
  reportingManagerId: idSchema.optional(),
  // a second manager, shown only (checked in the service: a current employee, not themselves)
  functionalManagerId: idSchema.optional(),
  // name ("Mr. / Ms. ..." on letters - from the offer)
  salutation: z.enum(Salutation).optional(),
  firstName: text(),
  middleName: text().optional(),
  lastName: text().optional(),
  // personal
  ...personalDetailsSchema.shape,
  // contact
  workEmail: emailSchema.optional(),
  personalEmail: emailSchema.optional(),
  mobile: mobileSchema.optional(),
  alternateMobile: mobileSchema.optional(),
}).superRefine(checkMarriage)

// ---------------------------------------------------------------------------------------------------------------
// HR adds / edits an employee directly (old HRMS "Add employee" / "Edit details", agreed 2026-11-16). Only the core
// details - IDs, bank, family, education... are not part of it (decided 2026-11-16: later). The same columns are the
// Excel import's (employees/imports). Dates and the reporting manager are checked in the service.
// ---------------------------------------------------------------------------------------------------------------
const employeeDetailsShape = {
  salutation: z.enum(Salutation).optional(),
  firstName: text(),
  middleName: text().optional(),
  lastName: text().optional(),
  // as the old HRMS (2026-11-16): only the company, the first name and the date of joining are required (and the plant,
  // 2026-11-18, and the department, 2026-11-19) - the rest can be filled in later; the three kinds default to Regular /
  // Permanent / White collar
  gender: z.enum(Gender).optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  // required (2026-11-18): a plant of the company; the department must run at it
  plantId: idSchema,
  workLocationId: idSchema.optional(),
  // required (2026-11-19): one of the plant's departments (every employee has an HOD post)
  departmentId: idSchema,
  designationId: idSchema.optional(),
  gradeId: idSchema.optional(),
  positionId: idSchema.optional(),
  // one of the company's cost centres
  costCenterId: idSchema.optional(),
  dateOfJoining: z.date(),
  joiningType: z.enum(JoiningType).default('REGULAR'),
  employmentType: z.enum(EmploymentType).default('PERMANENT'),
  workforceCategory: z.enum(WorkforceCategory).default('WHITE_COLLAR'),
  // only for a fixed-term engagement (not PERMANENT)
  contractEndDate: z.date().optional(),
  probationEndDate: z.date().optional(),
  mobile: mobileSchema.optional(),
  personalEmail: emailSchema.optional(),
  workEmail: emailSchema.optional(),
  // who the employee reports to, by employee code
  reportingManagerCode: employeeCodeSchema.optional(),
  // a second manager the employee works for day to day (shown only), by employee code
  functionalManagerCode: employeeCodeSchema.optional(),
}

// "Add employee": a new active employee in this company; the code is the next of the company's series
export const addEmployeeInput = z.object({ companyId: idSchema, ...employeeDetailsShape })

// "Edit details": only the fields sent change; null clears an optional one. The company and the code do not change
// here (a move to another company is a transfer - a later module), nor the status (joining / leaving).
export const updateEmployeeInput = z.object({
  employeeCode: employeeCodeSchema,
  salutation: employeeDetailsShape.salutation.unwrap().nullable().optional(),
  firstName: employeeDetailsShape.firstName.optional(),
  middleName: text().nullable().optional(),
  lastName: text().nullable().optional(),
  gender: z.enum(Gender).nullable().optional(),
  dateOfBirth: dateOfBirthSchema.nullable().optional(),
  plantId: idSchema.optional(),
  workLocationId: idSchema.nullable().optional(),
  // can be changed, never cleared (required since 2026-11-19)
  departmentId: idSchema.optional(),
  designationId: idSchema.nullable().optional(),
  gradeId: idSchema.nullable().optional(),
  positionId: idSchema.nullable().optional(),
  costCenterId: idSchema.nullable().optional(),
  dateOfJoining: z.date().optional(),
  joiningType: z.enum(JoiningType).optional(),
  employmentType: z.enum(EmploymentType).optional(),
  workforceCategory: z.enum(WorkforceCategory).optional(),
  contractEndDate: z.date().nullable().optional(),
  probationEndDate: z.date().nullable().optional(),
  confirmationDate: z.date().nullable().optional(),
  mobile: mobileSchema.nullable().optional(),
  alternateMobile: mobileSchema.nullable().optional(),
  personalEmail: emailSchema.nullable().optional(),
  workEmail: emailSchema.nullable().optional(),
  reportingManagerCode: employeeCodeSchema.nullable().optional(),
  functionalManagerCode: employeeCodeSchema.nullable().optional(),
})

// The directory as an Excel file: the same filters as the list, every matching employee
// People pickers (a reporting manager, a colleague...): employees who have not left, by code or name - across the whole
// group (data access does not narrow it: only code, name, designation and company are returned - 2026-11-18)
export const searchEmployeesInput = z.object({ query: z.string().trim().max(100).optional() }).optional()

// The company directory (the user, 2026-11-21 - like greytHR's People): every logged-in employee, everyone working now in
// every company, basic fields only. Search by code or name; filter by company / plant / department.
export const directoryInput = z
  .object({
    // TEAM: who reports to the viewer; DEPARTMENT: whose HOD the viewer is now (2026-11-21 - "my team / my department /
    // everyone"); none: everyone
    group: z.enum(['TEAM', 'DEPARTMENT']).optional(),
    search: z.string().trim().max(100).optional(),
    companyIds: z.array(idSchema).max(100).optional(),
    plantIds: z.array(idSchema).max(200).optional(),
    departmentIds: z.array(idSchema).max(100).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(50),
  })
  .optional()

// The org chart around one employee (default: oneself)
export const orgChartInput = z.object({ employeeCode: employeeCodeSchema.optional() }).optional()

// An employee's salary history (2026-11-20)
export const salaryHistoryInput = z.object({ employeeCode: employeeCodeSchema })

export const exportEmployeesInput = listEmployeesInput.unwrap().omit({ page: true, pageSize: true }).optional()

// The words the screens use for these values - the Excel export writes them and the import reads them back
export const GENDER_LABEL: Record<Gender, string> = { MALE: 'Male', FEMALE: 'Female', TRANSGENDER: 'Transgender' }
export const SALUTATION_LABEL: Record<Salutation, string> = { MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.' }
export const JOINING_TYPE_LABEL: Record<JoiningType, string> = { REGULAR: 'Regular', CONSULTANT_INTERN: 'Consultant & Intern', OVERSEAS: 'Overseas' }
export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  PERMANENT: 'Permanent',
  CONTRACT: 'Contract',
  TRAINEE: 'Trainee / Intern',
  CONSULTANT: 'Consultant',
  APPRENTICE: 'Apprentice',
}
export const WORKFORCE_LABEL: Record<WorkforceCategory, string> = { WHITE_COLLAR: 'White collar (staff)', BLUE_COLLAR: 'Blue collar (worker)' }
export const STATUS_LABEL: Record<EmployeeStatus, string> = { ACTIVE: 'Active', ON_NOTICE: 'On notice', EXITED: 'Exited' }

export const exportDirectoryInput = directoryInput.unwrap().omit({page:true,pageSize:true}).optional()
