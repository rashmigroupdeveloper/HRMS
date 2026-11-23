import type { Tone } from '@/components/Pill'
import type { client } from '@/lib/orpc'

// shared with the job & salary cards and pages (lib/choices.ts, 2026-11-21)
export { EMPLOYMENT_TYPE, JOB_CHANGE_KIND, JOINING_TYPE, WORKFORCE } from '@/lib/choices'

// Types and display labels of the employee pages, typed from the API (a renamed / added backend value shows up here
// as a TypeScript error).

export type EmployeeProfile = Awaited<ReturnType<typeof client.employees.getByCode>>
export type DirectoryPage = Awaited<ReturnType<typeof client.employees.list>>
export type EmployeeRow = DirectoryPage['items'][number]
export type EmployeeStatus = EmployeeRow['status']
export type EmployeeDocument = Awaited<ReturnType<typeof client.employees.documents.list>>[number]
type Statutory = NonNullable<EmployeeProfile['statutory']>
type Joining = NonNullable<EmployeeProfile['joining']>
export const SALUTATION: Record<NonNullable<EmployeeProfile['salutation']>, string> = { MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.' }
export const MEDICAL_RESULT: Record<NonNullable<Joining['medicalResult']>, string> = {
  FIT: 'Fit',
  FIT_WITH_RESTRICTIONS: 'Fit with restrictions',
  UNFIT: 'Unfit',
}

export const STATUS_LABEL: Record<EmployeeStatus, string> = { ACTIVE: 'Active', ON_NOTICE: 'On notice', EXITED: 'Exited' }
export const STATUS_TONE: Record<EmployeeStatus, Tone> = { ACTIVE: 'positive', ON_NOTICE: 'warning', EXITED: 'neutral' }

export const GENDER: Record<NonNullable<EmployeeProfile['gender']>, string> = { MALE: 'Male', FEMALE: 'Female', TRANSGENDER: 'Transgender' }
export const MARITAL: Record<NonNullable<EmployeeProfile['maritalStatus']>, string> = {
  SINGLE: 'Single',
  MARRIED: 'Married',
  WIDOWED: 'Widowed',
  DIVORCED: 'Divorced',
  SEPARATED: 'Separated',
}
export const CATEGORY: Record<NonNullable<EmployeeProfile['category']>, string> = { GENERAL: 'General', EWS: 'EWS', OBC: 'OBC', SC: 'SC', ST: 'ST' }
type MedicalInfo = NonNullable<EmployeeProfile['medicalInfo']>
export const MEDICAL_CONDITION: Record<MedicalInfo['conditions'][number], string> = {
  ASTHMA: 'Asthma',
  DIABETES: 'Diabetes',
  HEART_DISEASE: 'Heart disease',
  HIGH_BLOOD_PRESSURE: 'High blood pressure',
  EPILEPSY: 'Epilepsy / seizures',
  MENTAL_HEALTH: 'Mental health condition',
}
export const SPORT: Record<MedicalInfo['sports'][number], string> = {
  TENNIS: 'Tennis',
  PADDLE_BALL: 'Paddle ball',
  BADMINTON: 'Badminton',
  FOOTBALL: 'Football',
  BASKETBALL: 'Basketball',
  OTHER: 'Other',
}
export const BLOOD: Record<NonNullable<EmployeeProfile['bloodGroup']>, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A−',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B−',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB−',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O−',
}
export const ADDRESS_TYPE: Record<EmployeeProfile['addresses'][number]['type'], string> = {
  PERMANENT: 'Permanent address',
  PRESENT: 'Present address',
  CONTACT: 'Contact address',
  EMERGENCY: 'Emergency contact address',
  SPOUSE: 'Spouse address',
  OTHER: 'Other address',
}
export const IDENTITY_TYPE: Record<EmployeeProfile['identityDocuments'][number]['type'], string> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  FOREIGN_TAX_ID: 'Foreign tax id',
  PASSPORT: 'Passport',
  DRIVING_LICENCE: 'Driving licence',
}
export const BANK_ACCOUNT_TYPE: Record<EmployeeProfile['bankAccounts'][number]['accountType'], string> = { SAVINGS: 'Savings', CURRENT: 'Current' }
export const EPF_RELATIVE: Record<Statutory['epfRelative'], string> = { FATHER: 'Father', SPOUSE: 'Spouse' }
export const FAMILY_RELATIONSHIP: Record<EmployeeProfile['familyMembers'][number]['relationship'], string> = {
  SPOUSE: 'Spouse',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  FATHER: 'Father',
  MOTHER: 'Mother',
  BROTHER: 'Brother',
  SISTER: 'Sister',
  FATHER_IN_LAW: 'Father-in-law',
  MOTHER_IN_LAW: 'Mother-in-law',
  OTHER: 'Other',
}
export const NOMINATION_SCHEME: Record<EmployeeProfile['nominees'][number]['scheme'], string> = {
  GENERAL: 'Joining form nominee',
  GRATUITY: 'Gratuity (Form F)',
  ESIC: 'ESIC (Form 1)',
}
export const DOCUMENT_TYPE: Record<EmployeeDocument['type'], string> = {
  PHOTO: 'Photograph',
  SIGNED_JOINING_FORM: 'Signed joining form',
  SIGNED_FORMS_PACK: 'Signed forms pack (all pages)',
  MEDICAL_FORM: 'Medical form',
  MEDICAL_FITNESS_CERTIFICATE: 'Medical fitness certificate',
  EPF_FORM_11: 'EPF Form 11',
  ESIC_FORM_1: 'ESIC Form 1',
  GRATUITY_FORM_F: 'Gratuity Form F',
  AADHAAR_COPY: 'Aadhaar copy',
  PAN_COPY: 'PAN copy',
  PASSPORT_COPY: 'Passport copy',
  BANK_PROOF: 'Bank proof',
  BGV_CONSENT_FORM: 'BGV consent form',
  SIGNED_OFFER_LETTER: 'Signed offer letter',
  EDUCATION_CERTIFICATE: 'Other education certificate',
  CLASS_X_MARKSHEET: 'Class X marksheet',
  CLASS_XII_MARKSHEET: 'Class XII marksheet',
  GRADUATION_CERTIFICATE: 'Graduation certificate',
  POST_GRADUATION_CERTIFICATE: 'Post-graduation certificate',
  EXPERIENCE_LETTER: 'Experience / relieving letter',
  DRIVING_LICENCE_COPY: 'Driving licence copy',
  VISA_COPY: 'Visa / residence permit',
  WORK_PERMIT_COPY: 'Work permit / labour card',
  TRADE_LICENCE_COPY: 'Trade / safety licence',
  POLICE_VERIFICATION: 'Police verification certificate',
}
export const VERIFICATION: Record<EmployeeDocument['verificationStatus'], { label: string; tone: Tone }> = {
  PENDING: { label: 'To verify', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'negative' },
}

export function fullName(e: { firstName: string; middleName: string | null; lastName: string | null }) {
  return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
}

// Only the last 4 digits are ever sent: "•••• 1234"
export function masked(last4: string) {
  return `•••• ${last4}`
}

export const yesNo = (value: boolean | null | undefined) => (value == null ? '—' : value ? 'Yes' : 'No')

// "32 yrs" from a date of birth (shown only, never stored)
export function ageOf(dateOfBirth: Date | null) {
  if (!dateOfBirth) return null
  const born = new Date(dateOfBirth)
  const now = new Date()
  let years = now.getFullYear() - born.getFullYear()
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) years--
  return years >= 0 ? `${years} yrs` : null
}

