import { Award, Briefcase, Check, CircleAlert, GraduationCap, HeartHandshake, HeartPulse, IdCard, Landmark, type LucideIcon, MapPin, Pencil, Phone, Plus, ScrollText, ShieldCheck, Trash2, UserRound, Users } from 'lucide-react'
import { type ComponentProps, useEffect, useState } from 'react'
import { FormError } from '@/components/FormError'
import { FieldsGrid, ListSectionForm, SavedNote, SectionForm, SectionShell, type ShellProps } from '@/components/FormFields'
import { Pill, type Tone } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  BANK_OPTIONS,
  COUNTRY_OPTIONS,
  DISABILITY_OPTIONS,
  INDIAN_STATE_NAME_OPTIONS,
  QUALIFICATION_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELIGION_OPTIONS,
} from '@/lib/choices'
import { type FieldDef, type FormValues, fromFormValues, isShown, toFormValues, toOptions } from '@/lib/form-values'
import type { client } from '@/lib/orpc'
import { cn, formatDate, toDateInput } from '@/lib/utils'

// The sections of the joining form RML/HR/02/01 (JF), shared by HR's "Joining form" tab (JoiningFormReview: an index
// + read-only summaries, "Edit" opens a section's form) and the candidate's own page (JoiningFormSections: open forms).
// Each section saves on its own. The option labels are typed from the API, so a renamed or added
// backend value shows up here as a TypeScript error.

type SaveForm = Parameters<typeof client.candidates.joiningForm.save>[0]
// The joining pack (the offer's joining type): Regular, Consultant & Intern or Overseas
export type JoiningPack = Awaited<ReturnType<typeof client.candidates.portal.me>>['candidate']['joiningType']
export type JoiningFormSection = Exclude<keyof SaveForm, 'candidateId' | 'loadedAt'>

type Personal = NonNullable<SaveForm['personal']>
type Address = NonNullable<SaveForm['addresses']>[number]
type Identity = NonNullable<SaveForm['identityDocuments']>[number]
type Bank = NonNullable<SaveForm['bankAccount']>
type Statutory = NonNullable<SaveForm['statutory']>
type Family = NonNullable<SaveForm['familyMembers']>[number]
type Nominee = NonNullable<SaveForm['nominees']>[number]

const GENDER: Record<NonNullable<Personal['gender']>, string> = { MALE: 'Male', FEMALE: 'Female', TRANSGENDER: 'Transgender' }
const MARITAL: Record<NonNullable<Personal['maritalStatus']>, string> = {
  SINGLE: 'Single',
  MARRIED: 'Married',
  WIDOWED: 'Widowed',
  DIVORCED: 'Divorced',
  SEPARATED: 'Separated',
}
const CATEGORY: Record<NonNullable<Personal['category']>, string> = {
  GENERAL: 'General',
  EWS: 'EWS (Economically Weaker Section)',
  OBC: 'OBC (Other Backward Class)',
  SC: 'SC (Scheduled Caste)',
  ST: 'ST (Scheduled Tribe)',
}
const BLOOD: Record<NonNullable<Personal['bloodGroup']>, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A−',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B−',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB−',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O−',
}
const ADDRESS_TYPE: Record<Address['type'], string> = {
  PERMANENT: 'Permanent address',
  PRESENT: 'Present address',
  CONTACT: 'Contact address',
  EMERGENCY: 'Emergency contact address',
  SPOUSE: 'Spouse address',
  OTHER: 'Other address',
}
const IDENTITY_TYPE: Record<Identity['type'], string> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  FOREIGN_TAX_ID: 'Foreign tax id (TPIN)',
  PASSPORT: 'Passport',
  DRIVING_LICENCE: 'Driving licence',
}
const BANK_ACCOUNT_TYPE: Record<Bank['accountType'], string> = { SAVINGS: 'Savings', CURRENT: 'Current' }
const EPF_RELATIVE: Record<NonNullable<Statutory['epfRelative']>, string> = { FATHER: "My father's name", SPOUSE: "My spouse's name" }
const FAMILY_RELATIONSHIP: Record<Family['relationship'], string> = {
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
const NOMINATION_SCHEME: Record<Nominee['scheme'], string> = {
  GENERAL: 'Joining form nominee',
  GRATUITY: 'Gratuity (Form F)',
  ESIC: 'ESIC (Form 1)',
}

// Who the spouse questions are for - the spouse counts as family for PF, ESIC and gratuity:
// - married or separated (still legally married): the spouse's name and the date of marriage
// - widowed: the late spouse's name (EPF Form 11 may show it); the date of marriage is not needed
// - single or divorced (a former spouse is not family): neither
const hasSpouseName = (v: FormValues) => ['MARRIED', 'SEPARATED', 'WIDOWED'].includes(v.maritalStatus ?? '')
const hasMarriageDate = (v: FormValues) => ['MARRIED', 'SEPARATED'].includes(v.maritalStatus ?? '')

// The name starts as it is on the offer (HR typed it) and can be corrected to match the documents. `forCandidate`:
// the wording on the candidate's own page ("Your gender").
const personalFields = (forCandidate: boolean): FieldDef[] => [
  {
    name: 'firstName',
    label: 'First name',
    required: true,
    group: 'Name',
    hint: forCandidate ? 'As on your Aadhaar / PAN' : 'As on the documents',
  },
  { name: 'middleName', label: 'Middle name', group: 'Name' },
  { name: 'lastName', label: 'Last name', group: 'Name' },
  {
    name: 'mobile',
    label: forCandidate ? 'Your mobile' : 'Mobile',
    required: true,
    group: 'Contact',
    hint: forCandidate ? 'Fix it if it is wrong' : 'Fix it if it is wrong',
  },
  { name: 'alternateMobile', label: forCandidate ? 'Another number to reach you' : 'Alternate mobile', group: 'Contact' },
  {
    name: 'personalEmail',
    label: forCandidate ? 'Your personal e-mail' : 'Personal e-mail',
    readOnly: true,
    group: 'Contact',
    hint: forCandidate ? 'Only HR can change it' : 'Change it on the candidate',
  },
  { name: 'gender', label: forCandidate ? 'Your gender' : 'Gender', type: 'select', required: true, options: toOptions(GENDER), group: 'Basic' },
  { name: 'dateOfBirth', label: forCandidate ? 'Your date of birth' : 'Date of birth', type: 'date', required: true, group: 'Basic' },
  { name: 'fatherName', label: "Father's name", group: 'Basic' },
  { name: 'motherName', label: "Mother's name", group: 'Basic' },
  { name: 'maritalStatus', label: 'Marital status', type: 'select', options: toOptions(MARITAL), group: 'Marriage' },
  { name: 'spouseName', label: "Spouse's name", group: 'Marriage', showIf: hasSpouseName },
  { name: 'marriageDate', label: 'Date of marriage', type: 'date', group: 'Marriage', showIf: hasMarriageDate },
  { name: 'nationality', label: 'Nationality', type: 'search', options: COUNTRY_OPTIONS, group: 'Origin' },
  { name: 'countryOfOrigin', label: 'Country of origin', type: 'search', options: COUNTRY_OPTIONS, group: 'Origin' },
  { name: 'placeOfBirth', label: 'Place of birth', placeholder: 'Town / city', group: 'Origin' },
  { name: 'religion', label: 'Religion', type: 'select', options: RELIGION_OPTIONS, group: 'Origin' },
  { name: 'category', label: 'Category', type: 'select', options: toOptions(CATEGORY), group: 'Origin' },
  { name: 'bloodGroup', label: 'Blood group', type: 'select', options: toOptions(BLOOD), group: 'Physical' },
  { name: 'identificationMark', label: 'Identification mark', group: 'Physical' },
  { name: 'heightCm', label: 'Height (cm)', type: 'number', group: 'Physical' },
  { name: 'weightKg', label: 'Weight (kg)', type: 'number', group: 'Physical' },
  { name: 'isPhysicallyDisabled', label: 'Physically disabled?', type: 'yesno', group: 'Disability' },
  { name: 'disabilityType', label: 'Disability type', type: 'search', options: DISABILITY_OPTIONS, group: 'Disability', showIf: (v) => v.isPhysicallyDisabled === 'yes' },
  { name: 'disabilityPercent', label: 'Disability %', type: 'number', group: 'Disability', showIf: (v) => v.isPhysicallyDisabled === 'yes' },
  { name: 'hobbies', label: 'Hobbies', placeholder: 'e.g. cricket, music, reading', wide: true, group: 'Other' },
]

// an address is in India unless another country is chosen (the server defaults the country to IN)
const inIndia = (v: FormValues) => !v.countryCode || v.countryCode === 'IN'

const ADDRESS: FieldDef[] = [
  { name: 'type', label: 'Address type', type: 'select', required: true, options: toOptions(ADDRESS_TYPE) },
  { name: 'houseNo', label: 'House no. / street', required: true },
  { name: 'locality', label: 'Locality' },
  { name: 'cityOrVillage', label: 'City / village', required: true },
  { name: 'district', label: 'District' },
  // the country first: an Indian address picks its state from the list, any other types it
  { name: 'countryCode', label: 'Country', type: 'search', options: COUNTRY_OPTIONS, placeholder: 'India (IN) if empty' },
  { name: 'state', label: 'State', type: 'search', options: INDIAN_STATE_NAME_OPTIONS, showIf: inIndia },
  { name: 'state', label: 'State / region', showIf: (v) => !inIndia(v) },
  { name: 'postalCode', label: 'PIN / postal code' },
  { name: 'postOffice', label: 'Post office' },
  { name: 'policeStation', label: 'Police station' },
  { name: 'subDivision', label: 'Sub-division' },
]

const EMERGENCY: FieldDef[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'relationship', label: 'Relationship', type: 'search', options: RELATIONSHIP_OPTIONS, allowCustom: true, required: true },
  { name: 'mobile', label: 'Mobile', required: true },
  { name: 'alternateMobile', label: 'Alternate mobile' },
  { name: 'address', label: 'Address', wide: true },
]

// On the candidate's page: the "saved number ends with" box only when a number is saved
const hasSaved = (name: string) => (v: FormValues) => !!v[name]
const expires = (v: FormValues) => ['PASSPORT', 'DRIVING_LICENCE'].includes(v.type ?? '')

const identityFields = (masked: boolean): FieldDef[] => [
  { name: 'type', label: 'Document', type: 'select', required: true, options: toOptions(IDENTITY_TYPE) },
  // the candidate's page: a saved number may be left empty to keep it; a new document needs its number
  ...(masked
    ? ([
        { name: 'number', label: 'New number (empty keeps the saved one)', placeholder: 'Aadhaar 12 digits · PAN ABCDE1234F', showIf: hasSaved('numberLast4') },
        { name: 'number', label: 'Number', required: true, placeholder: 'Aadhaar 12 digits · PAN ABCDE1234F', showIf: (v) => !v.numberLast4 },
      ] satisfies FieldDef[])
    : [{ name: 'number', label: 'Number', required: true, sensitive: true, placeholder: 'Aadhaar 12 digits · PAN ABCDE1234F' } satisfies FieldDef]),
  ...(masked ? [{ name: 'numberLast4', label: 'Saved number ends with', disabled: true, showIf: hasSaved('numberLast4') } satisfies FieldDef] : []),
  { name: 'nameOnDocument', label: 'Name as on document' },
  // Aadhaar, PAN and a driving licence are Indian; a passport or a foreign tax id names its country
  { name: 'issuingCountry', label: 'Issuing country', type: 'search', options: COUNTRY_OPTIONS, showIf: (v) => ['PASSPORT', 'FOREIGN_TAX_ID'].includes(v.type ?? '') },
  // only a passport and a driving licence expire
  { name: 'validFrom', label: 'Valid from', type: 'date', showIf: expires },
  { name: 'validUntil', label: 'Valid until', type: 'date', showIf: expires },
]

const bankFields = (masked: boolean): FieldDef[] => [
  { name: 'bankName', label: 'Bank name', type: 'search', options: BANK_OPTIONS, allowCustom: true, required: true },
  { name: 'branch', label: 'Branch' },
  { name: 'accountHolderName', label: 'Account holder name', required: true },
  ...(masked
    ? ([
        { name: 'accountNumber', label: 'New account number (empty keeps the saved one)', showIf: hasSaved('accountNumberLast4') },
        { name: 'accountNumber', label: 'Account number', required: true, showIf: (v) => !v.accountNumberLast4 },
      ] satisfies FieldDef[])
    : [{ name: 'accountNumber', label: 'Account number', required: true, sensitive: true } satisfies FieldDef]),
  ...(masked ? [{ name: 'accountNumberLast4', label: 'Saved account ends with', disabled: true, showIf: hasSaved('accountNumberLast4') } satisfies FieldDef] : []),
  { name: 'ifsc', label: 'IFSC', placeholder: 'ABCD0123456', hint: 'The 11-letter bank code. It is on your cheque book or passbook.' },
  { name: 'accountType', label: 'Account type', type: 'select', required: true, options: toOptions(BANK_ACCOUNT_TYPE) },
]

const EPF = 'EPF (Form 11)'
const PREVIOUS_EPF = 'Previous EPF / EPS membership'
// Everything about PF only once PF applies; the earlier membership's details only if they were a member
const pf = (v: FormValues) => v.pfApplicable === 'yes'
// the earlier PF account's details if they were in EPF; EPS (the pension) is part of EPF, so it is asked only then,
// and the pension's details (certificate, PPO, withdrawal) only if they were in it
const wasEpf = (v: FormValues) => pf(v) && v.wasEpfMember === 'yes'
const wasEps = (v: FormValues) => wasEpf(v) && v.wasEpsMember === 'yes'
// Everything about ESIC only once ESIC applies; the previous employer only with a previous ESIC number (Form 1 "if any")
const esic = (v: FormValues) => v.esicApplicable === 'yes'
const hadEsic = (v: FormValues) => esic(v) && !!v.previousEsicIpNumber?.trim()
const ESIC = 'ESIC (Form 1)'
const STATUTORY: FieldDef[] = [
  { name: 'pfApplicable', label: 'PF applicable?', type: 'yesno', group: EPF, hint: 'PF is savings for your future. A little money is cut from your salary every month, and the company adds the same amount. Not sure? Ask HR.' },
  // a first-job joiner has none yet - the company registers them with EPFO after joining
  { name: 'uan', label: 'UAN (12 digits)', hint: 'Your 12-digit PF number from an old job. It is printed on your old salary slip. Leave it empty if this is your first job.', group: EPF, showIf: pf },
  // EPF Form 11 item 2 "Father's / Spouse's name": which of the two (the name itself is in the personal details)
  {
    name: 'epfRelative',
    label: 'Name on the PF form',
    type: 'select',
    options: toOptions(EPF_RELATIVE),
    hint: "The PF form prints your father's name or your husband's / wife's name. Choose which one you want.",
    group: EPF,
    showIf: pf,
  },
  // EPF Form 11 item 6(b) - starts with the mobile from the personal details (see withAadhaarMobile)
  {
    name: 'aadhaarMobile',
    label: 'Mobile number registered with Aadhaar',
    placeholder: '10-digit mobile',
    group: EPF,
    showIf: pf,
    hint: 'The phone that gets the OTP when you use your Aadhaar. Usually it is your own mobile number - change it only if your Aadhaar has a different number.',
  },
  { name: 'isInternationalWorker', label: 'International worker?', type: 'yesno', group: EPF, showIf: pf, hint: 'Choose Yes only if you are NOT an Indian citizen. Most people choose No.' },
  { name: 'wasEpfMember', label: 'Earlier EPF member?', type: 'yesno', group: PREVIOUS_EPF, showIf: pf, hint: 'Choose Yes if PF money was cut from your salary in any old job.' },
  { name: 'wasEpsMember', label: 'Earlier EPS (pension) member?', type: 'yesno', group: PREVIOUS_EPF, showIf: wasEpf, hint: 'Pension (EPS) is a part of PF. Choose Yes if your old PF slip or passbook shows pension (EPS).' },
  // EPF Form 11: the details of the earlier membership - each scheme's own
  { name: 'previousPfNumber', label: 'Previous PF number', group: PREVIOUS_EPF, showIf: wasEpf, hint: 'The PF account number of your old job. It is on your old salary slip.' },
  { name: 'previousExitDate', label: 'Previous exit date', type: 'date', group: PREVIOUS_EPF, showIf: wasEpf, hint: 'Your last working day in that old job.' },
  { name: 'schemeCertificateNumber', label: 'Scheme certificate no.', group: PREVIOUS_EPF, showIf: wasEps, hint: 'Only if PF gave you a pension "scheme certificate". Most people leave this empty.' },
  { name: 'ppoNumber', label: 'PPO number', group: PREVIOUS_EPF, showIf: wasEps, hint: 'Only if you already get a monthly PF pension. Most people leave this empty.' },
  { name: 'firstEpfEnrolledOn', label: 'First EPF enrolment', type: 'date', group: PREVIOUS_EPF, showIf: wasEpf, hint: 'The date PF was first cut from your salary, in your very first job with PF.' },
  { name: 'firstEpfWages', label: 'Wages at first enrolment (₹)', type: 'number', group: PREVIOUS_EPF, showIf: wasEpf, hint: 'Your basic salary (not total salary) in that first PF job. See your old salary slip.' },
  { name: 'isEpfMemberBeforeSep2014', label: 'EPF member before 1 Sep 2014?', type: 'yesno', group: PREVIOUS_EPF, showIf: wasEpf, hint: 'Choose Yes if you were in PF before 1 September 2014.' },
  { name: 'epfWithdrawn', label: 'EPF withdrawn?', type: 'yesno', group: PREVIOUS_EPF, showIf: wasEpf, hint: 'Choose Yes if you took out your old PF money.' },
  { name: 'epsWithdrawn', label: 'EPS withdrawn?', type: 'yesno', group: PREVIOUS_EPF, showIf: wasEps, hint: 'Choose Yes if you took out your old pension money.' },
  { name: 'epsWithdrawnAfterSep2014', label: 'EPS withdrawn after Sep 2014?', type: 'yesno', group: PREVIOUS_EPF, showIf: (v) => wasEps(v) && v.epsWithdrawn === 'yes', hint: 'Choose Yes if you took out that pension money after September 2014.' },
  { name: 'esicApplicable', label: 'ESIC applicable?', type: 'yesno', group: ESIC, hint: 'ESIC gives free medical treatment to you and your family. It is for people whose salary is ₹21,000 a month or less. Not sure? Ask HR. If Yes, you also add an ESIC nominee in "Family & nominees".' },
  { name: 'esicIpNumber', label: 'ESIC IP number (10 digits)', group: ESIC, showIf: esic, hint: 'Your 10-digit ESIC number, if you already have one from an old job.' },
  { name: 'esicBranchOffice', label: 'ESIC branch office', group: ESIC, showIf: esic, hint: 'The ESIC office near your home.' },
  { name: 'esicDispensary', label: 'ESIC dispensary', group: ESIC, showIf: esic, hint: 'The ESIC hospital or dispensary where you want to go for treatment.' },
  { name: 'previousEsicIpNumber', label: 'Previous ESIC IP number (if any)', group: ESIC, showIf: esic, hint: 'Your ESIC number from your last job, if you had ESIC there.' },
  { name: 'previousEmployerCode', label: 'Previous employer code', group: ESIC, showIf: hadEsic, hint: 'The ESIC code of your old company. Ask your old company if you do not know it.' },
  { name: 'previousEmployerName', label: 'Previous employer name', group: ESIC, showIf: hadEsic, hint: 'The name of your old company where you had ESIC.' },
  { name: 'previousEmployerAddress', label: 'Previous employer address', wide: true, group: ESIC, showIf: hadEsic, hint: 'The address of that old company.' },
  { name: 'previousEmployerContact', label: 'Previous employer phone / e-mail', group: ESIC, showIf: hadEsic, hint: 'The phone number or e-mail of that old company.' },
]

// The answers to "do they depend on the salary?" - the value is Form F's "not dependent" (yes = not dependent)
const PARENTS_DEPEND_ANSWERS = [
  { value: 'no', label: 'Yes - they need the salary to live' },
  { value: 'yes', label: 'No - they live on their own money, or are no longer alive' },
]

// Gratuity Form F declarations (Payment of Gratuity Act s.2(h)) - next to the nominees (Regular); the two about the
// husband only for a married woman. "I have no family" is not asked: "Your family for gratuity" shows what it works out
// to (the backend's gratuityNoFamilyOf decides), updated as the questions are answered
function gratuityFields(ctx: FormContext | undefined): FieldDef[] {
  const marriedWoman = ctx?.marriedWoman ?? false
  const update = (parents: string, husbandsParents: string) => ({ familyForGratuity: familyForGratuity(ctx, parents, husbandsParents) })
  return [
  {
    name: 'familyForGratuity',
    label: 'Your family for gratuity',
    readOnly: true,
    wide: true,
    placeholder: 'Shown after you answer the question below',
    hint: 'Worked out from your family details and your answers here: only your husband / wife, children, and parents who depend on you count. With no family, you may name anyone.',
  },
  // asked plainly (2026-11-20 - "My parents are not dependent on me: Yes / No" was a double negative); stored as Form F
  // 4(a) words it: true = not dependent
  { name: 'gratuityParentsNotDependent', label: 'Do your parents depend on your salary?', type: 'yesno', options: PARENTS_DEPEND_ANSWERS, required: true, fills: (v, values) => update(v, values.gratuityHusbandsParentsNotDependent ?? ''), hint: 'Printed on Form F as "My parents are / are not dependent on me".' },
  ...(marriedWoman
    ? ([
        { name: 'gratuityHusbandsParentsNotDependent', label: "Do your husband's parents depend on his salary?", type: 'yesno', options: PARENTS_DEPEND_ANSWERS, required: true, fills: (v, values) => update(values.gratuityParentsNotDependent ?? '', v), hint: `Printed on Form F as "My husband's parents are / are not dependent on my husband".` },
        { name: 'gratuityHusbandExcludedOn', label: 'Notice excluding my husband from my family - date (if given)', type: 'date', hint: 'Only if you gave the company a written letter saying your husband should not get the gratuity. Almost everyone leaves this empty.' },
      ] satisfies FieldDef[])
    : []),
  ]
}

// "Yes - Riya Sen (Spouse), Subir Sen (Father)" / "No family - ..." / '' while the parents question is unanswered;
// `parents` / `husbandsParents`: the "not dependent" answers as 'yes' / 'no' / ''
function familyForGratuity(ctx: FormContext | undefined, parents: string, husbandsParents: string): string {
  if (!ctx || !parents || (ctx.marriedWoman && !husbandsParents)) return ''
  const has = (...relationships: string[]) => ctx.family.some((m) => relationships.includes(m.relationship))
  const counts = (m: FamilyPerson) =>
    ['SPOUSE', 'SON', 'DAUGHTER'].includes(m.relationship) ||
    (parents === 'no' && ['FATHER', 'MOTHER'].includes(m.relationship)) ||
    (ctx.marriedWoman && husbandsParents === 'no' && ['FATHER_IN_LAW', 'MOTHER_IN_LAW'].includes(m.relationship))
  const people = ctx.family.filter(counts).map((m) => `${m.name} (${NOMINEE_RELATIONSHIP[m.relationship] ?? m.relationship})`)
  if (ctx.married && !has('SPOUSE')) people.unshift('your husband / wife')
  if (parents === 'no' && !has('FATHER', 'MOTHER')) people.push('your parents')
  if (ctx.marriedWoman && husbandsParents === 'no' && !has('FATHER_IN_LAW', 'MOTHER_IN_LAW')) people.push("your husband's parents")
  return people.length ? `Yes - ${people.join(', ')}` : 'No family - you may name anyone as your gratuity nominee'
}

const QUALIFICATION: FieldDef[] = [
  { name: 'qualification', label: 'Qualification', type: 'search', options: QUALIFICATION_OPTIONS, allowCustom: true, required: true },
  { name: 'institute', label: 'Institute / university / board', required: true },
  { name: 'yearOfPassing', label: 'Year of passing', type: 'number', required: true },
  { name: 'specialization', label: 'Specialization' },
  { name: 'score', label: '% / CGPA', placeholder: 'e.g. 78% or 8.2 CGPA' },
]

const CERTIFICATION: FieldDef[] = [
  { name: 'name', label: 'Certification', required: true },
  { name: 'issuedBy', label: 'Issued by (organisation / institute)', required: true },
  { name: 'certifiedOn', label: 'Date of certification', type: 'date' },
  { name: 'specialization', label: 'Specialization' },
  { name: 'score', label: 'Grade / score' },
]

const PREVIOUS_JOB: FieldDef[] = [
  { name: 'employerName', label: 'Employer', required: true },
  { name: 'designation', label: 'Designation', required: true },
  { name: 'fromDate', label: 'From', type: 'date', required: true },
  { name: 'toDate', label: 'To', type: 'date', required: true },
  { name: 'reasonForLeaving', label: 'Reason for leaving', wide: true },
]

const familyFields = (masked: boolean): FieldDef[] => [
  { name: 'name', label: 'Name', required: true },
  { name: 'relationship', label: 'Relationship', type: 'select', required: true, options: toOptions(FAMILY_RELATIONSHIP) },
  { name: 'gender', label: 'Gender', type: 'select', options: toOptions(GENDER) },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { name: 'aadhaar', label: masked ? 'New Aadhaar (empty keeps the saved one)' : 'Aadhaar number', sensitive: true, showIf: masked ? hasSaved('aadhaarLast4') : undefined },
  ...(masked ? [{ name: 'aadhaar', label: 'Aadhaar number', showIf: (v: FormValues) => !v.aadhaarLast4 } satisfies FieldDef] : []),
  ...(masked ? [{ name: 'aadhaarLast4', label: 'Saved Aadhaar ends with', disabled: true, showIf: hasSaved('aadhaarLast4') } satisfies FieldDef] : []),
  { name: 'preExistingDisease', label: 'Any pre-existing disease', wide: true },
  { name: 'livesWithEmployee', label: 'Lives with the employee? (ESIC)', type: 'yesno', hint: 'Does this person live in the same house as you?' },
  { name: 'residenceTown', label: 'Lives in town', showIf: (v) => v.livesWithEmployee === 'no' },
  { name: 'residenceState', label: 'Lives in state', type: 'search', options: INDIAN_STATE_NAME_OPTIONS, allowCustom: true, showIf: (v) => v.livesWithEmployee === 'no' },
]

const isGratuityNominee = (v: FormValues) => v.scheme === 'GRATUITY'

// A family member's relationship as a nominee's (the nominee's is free text, from RELATIONSHIP_OPTIONS)
const NOMINEE_RELATIONSHIP: Record<string, string> = {
  SPOUSE: 'Spouse',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  FATHER: 'Father',
  MOTHER: 'Mother',
  BROTHER: 'Brother',
  SISTER: 'Sister',
  FATHER_IN_LAW: 'Father-in-law',
  MOTHER_IN_LAW: 'Mother-in-law',
  OTHER: 'Other relative',
}

// The nominee's name: picked from the family details (any other name can be typed); picking someone fills their
// relationship, date of birth and - when they live with the employee - the home address
function nomineeNameFields(family: FamilyPerson[], homeAddress: string | undefined): FieldDef[] {
  const pickHint = 'Pick someone from your family details - the rest fills in by itself. Or type a name.'
  if (!family.length) {
    return [
      { name: 'name', label: 'Name', required: true, showIf: (v) => !isGratuityNominee(v) },
      { name: 'name', label: 'Name', required: true, showIf: isGratuityNominee, hint: 'Gratuity can go only to your family - husband / wife, children, or parents who depend on you. Add them in "Family details" first.' },
    ]
  }
  const name: FieldDef = {
    name: 'name',
    label: 'Name',
    type: 'search',
    options: family.map((m) => ({ value: m.name, label: `${m.name} (${NOMINEE_RELATIONSHIP[m.relationship] ?? m.relationship})` })),
    allowCustom: true,
    required: true,
    fills: (picked) => {
      const person = family.find((m) => m.name === picked)
      if (!person) return undefined
      return {
        relationship: NOMINEE_RELATIONSHIP[person.relationship] ?? '',
        dateOfBirth: person.dateOfBirth ? toDateInput(new Date(person.dateOfBirth)) : '',
        ...(person.livesWithEmployee && homeAddress ? { address: homeAddress } : {}),
      }
    },
  }
  return [
    { ...name, showIf: (v) => !isGratuityNominee(v), hint: pickHint },
    { ...name, showIf: isGratuityNominee, hint: `${pickHint} Gratuity can go only to your family - husband / wife, children, or parents who depend on you.` },
  ]
}

// A nominee under 18 on today's date (the date typed as YYYY-MM-DD): their guardian is asked (2026-11-20 - the backend's
// nomineesSchema checks the same)
function isMinorNominee(values: FormValues) {
  const born = values.dateOfBirth
  if (!born || !/^\d{4}-\d{2}-\d{2}$/.test(born)) return false
  const now = new Date()
  const [y, m, d] = born.split('-').map(Number) as [number, number, number]
  let years = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) years--
  return years < 18
}

// Gratuity (Form F) and ESIC nominations are Indian payroll schemes - Regular only; the others give a general nominee.
// The name is picked from the family details (`family`) - for gratuity the Act allows only the family when there is one
const nomineeFields = (regular: boolean, family: FamilyPerson[], homeAddress?: string): FieldDef[] => [
  {
    name: 'scheme',
    label: 'Nominee for',
    type: 'select',
    required: true,
    hint: 'Who gets the money if something happens to you. Joining form nominee: your salary and dues. Gratuity: the gratuity money. ESIC: the ESIC money.',
    options: toOptions(NOMINATION_SCHEME).filter((o) => regular || o.value === 'GENERAL'),
  },
  ...nomineeNameFields(family, homeAddress),
  { name: 'relationship', label: 'Relationship', type: 'search', options: RELATIONSHIP_OPTIONS, allowCustom: true, required: true },
  // Gratuity Form F asks the nominee's age and full address
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, showIf: isGratuityNominee },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date', showIf: (v) => !isGratuityNominee(v) },
  { name: 'sharePercent', label: 'Share % (gratuity)', type: 'number', required: true, showIf: isGratuityNominee, hint: 'How much (in %) this person gets. All gratuity shares together must make 100.' },
  { name: 'address', label: 'Full address', wide: true, required: true, showIf: isGratuityNominee },
  { name: 'address', label: 'Full address', wide: true, showIf: (v) => !isGratuityNominee(v) },
  // only for a nominee under 18 (shown when the date of birth makes them one)
  { name: 'guardianName', label: "Guardian's name (nominee under 18)", required: true, showIf: isMinorNominee, hint: 'A nominee under 18 cannot receive the money - name the adult who receives it for them.' },
  { name: 'guardianAddress', label: "Guardian's full address", wide: true, required: true, showIf: isMinorNominee },
]

// The "Employee Medical Information" pages of the joining form (Regular, Consultant & Intern)
type Medical = NonNullable<SaveForm['medical']>
const MEDICAL_CONDITION: Record<NonNullable<Medical['conditions']>[number], string> = {
  ASTHMA: 'Asthma',
  DIABETES: 'Diabetes',
  HEART_DISEASE: 'Heart disease',
  HIGH_BLOOD_PRESSURE: 'High blood pressure',
  EPILEPSY: 'Epilepsy / seizures',
  MENTAL_HEALTH: 'Mental health condition',
}
const SPORT: Record<NonNullable<Medical['sports']>[number], string> = {
  TENNIS: 'Tennis',
  PADDLE_BALL: 'Paddle ball',
  BADMINTON: 'Badminton',
  FOOTBALL: 'Football',
  BASKETBALL: 'Basketball',
  OTHER: 'Other',
}
const answeredYes = (name: string) => (v: FormValues) => v[name] === 'yes'
const MEDICAL_SELF = 'Medical history - self'
const MEDICAL_FAMILY = 'Medical history - family'
const MEDICAL: FieldDef[] = [
  { name: 'conditions', label: 'Do you have, or have you had, any of these?', type: 'checks', options: toOptions(MEDICAL_CONDITION), wide: true, group: MEDICAL_SELF },
  { name: 'otherConditions', label: 'Any other condition', wide: true, group: MEDICAL_SELF },
  { name: 'takesMedication', label: 'Taking any medication now?', type: 'yesno', group: MEDICAL_SELF },
  { name: 'medications', label: 'Which medications', showIf: answeredYes('takesMedication'), group: MEDICAL_SELF },
  { name: 'hasPhysicalLimitations', label: 'Physical limitation that may affect your work?', type: 'yesno', group: MEDICAL_SELF },
  { name: 'physicalLimitations', label: 'Which limitations', showIf: answeredYes('hasPhysicalLimitations'), group: MEDICAL_SELF },
  { name: 'hadSurgery', label: 'Surgery or major treatment in the past 5 years?', type: 'yesno', group: MEDICAL_SELF },
  { name: 'surgeries', label: 'Details of the surgery / treatment', showIf: answeredYes('hadSurgery'), group: MEDICAL_SELF },
  { name: 'hasAllergies', label: 'Any known allergies?', type: 'yesno', group: MEDICAL_SELF },
  { name: 'allergies', label: 'Which allergies', showIf: answeredYes('hasAllergies'), group: MEDICAL_SELF },
  { name: 'familyHeartDisease', label: 'Heart disease - who in the family', placeholder: 'e.g. Father', group: MEDICAL_FAMILY },
  { name: 'familyDiabetes', label: 'Diabetes - who', group: MEDICAL_FAMILY },
  { name: 'familyHighBloodPressure', label: 'High blood pressure - who', group: MEDICAL_FAMILY },
  { name: 'familyCancer', label: 'Cancer - who, and which type', group: MEDICAL_FAMILY },
  { name: 'familyStroke', label: 'Stroke - who', group: MEDICAL_FAMILY },
  { name: 'familyMentalHealth', label: 'Mental health disorder - who', group: MEDICAL_FAMILY },
  { name: 'familyGeneticDisorders', label: 'Genetic disorder - who', group: MEDICAL_FAMILY },
  { name: 'familyOther', label: 'Other condition - which, and who', group: MEDICAL_FAMILY },
  { name: 'hasHereditaryCondition', label: 'Hereditary condition that could affect your health or work?', type: 'yesno', group: MEDICAL_FAMILY },
  { name: 'hereditaryCondition', label: 'Which hereditary condition', showIf: answeredYes('hasHereditaryCondition'), group: MEDICAL_FAMILY },
  { name: 'needsHealthLeave', label: 'A condition needing unplanned leave (your or family health)?', type: 'yesno', group: MEDICAL_FAMILY },
  { name: 'healthLeave', label: 'Details', showIf: answeredYes('needsHealthLeave'), group: MEDICAL_FAMILY },
  { name: 'smokes', label: 'Smoke or use tobacco?', type: 'yesno', group: 'Lifestyle' },
  { name: 'drinksAlcohol', label: 'Drink alcohol?', type: 'yesno', group: 'Lifestyle' },
  { name: 'exercisesRegularly', label: 'Exercise regularly?', type: 'yesno', group: 'Lifestyle' },
  { name: 'exerciseFrequency', label: 'How often', placeholder: 'e.g. 3 times a week', showIf: answeredYes('exercisesRegularly'), group: 'Lifestyle' },
  { name: 'needsEmergencyCare', label: 'Need any specific emergency medical care?', type: 'yesno', group: 'Emergency care' },
  { name: 'emergencyCare', label: 'What care', showIf: answeredYes('needsEmergencyCare'), group: 'Emergency care' },
  { name: 'sports', label: 'Sports you play', type: 'checks', options: toOptions(SPORT), wide: true, group: 'Physical activity' },
  { name: 'otherSports', label: 'Which other sport', showIf: (v) => (v.sports ?? '').split(',').includes('OTHER'), group: 'Physical activity' },
  { name: 'sportsFrequency', label: 'How often', showIf: (v) => !!v.sports, group: 'Physical activity' },
  {
    name: 'consent',
    label: 'Consent',
    type: 'checkbox',
    required: true,
    wide: true,
    // the same sentence as MEDICAL_CONSENT_TEXT (backend employees.schema.ts) - stored word for word with the consent
    placeholder: 'I agree that the company keeps this medical information for my employment. Only HR with medical access can see it.',
    group: 'Consent',
  },
]

// What a section's form needs from the other sections: the Form F husband questions only for a married woman, the
// ESIC nominee only when ESIC applies, the gratuity nominees picked from the family details
type FamilyPerson = { name: string; relationship: string; dateOfBirth?: Date | string; livesWithEmployee?: boolean }
// homeAddress: the present (else permanent) address as one line - a nominee living with the employee lives there
// married: has a husband / wife (married or separated)
type FormContext = { married: boolean; marriedWoman: boolean; esic: boolean | undefined; family: FamilyPerson[]; homeAddress?: string }
function contextOf(form: Record<string, unknown>): FormContext {
  const personal = (form.personal ?? {}) as Record<string, unknown>
  const statutory = (form.statutory ?? {}) as Record<string, unknown>
  return {
    married: personal.maritalStatus === 'MARRIED' || personal.maritalStatus === 'SEPARATED',
    marriedWoman: personal.gender === 'FEMALE' && personal.maritalStatus === 'MARRIED',
    esic: typeof statutory.esicApplicable === 'boolean' ? statutory.esicApplicable : undefined,
    family: (Array.isArray(form.familyMembers) ? form.familyMembers : []) as FamilyPerson[],
    homeAddress: homeAddressOf(form),
  }
}

function homeAddressOf(form: Record<string, unknown>) {
  const addresses = (Array.isArray(form.addresses) ? form.addresses : []) as Record<string, unknown>[]
  const home = addresses.find((a) => a.type === 'PRESENT') ?? addresses.find((a) => a.type === 'PERMANENT')
  if (!home) return undefined
  return ['houseNo', 'locality', 'cityOrVillage', 'district', 'state', 'postalCode']
    .map((k) => home[k])
    .filter((v) => typeof v === 'string' && v.trim())
    .join(', ')
}

type SectionDef = {
  key: JoiningFormSection
  title: string
  description?: string
  icon: LucideIcon
  // the heading it is listed under in the review layout
  group: 'Personal' | 'Identity & pay' | 'Background' | 'Family' | 'Health'
  fields: FieldDef[]
} & ({ kind: 'one' } | { kind: 'list'; itemLabel: string; max: number; titleField: string })


// `pack`: the offer's joining type - PF / ESIC and the gratuity and ESIC nominees only for Regular (all when unknown)
// `withMedical: false`: leave the medical information out (an HR person without the "Employee · Medical" access)
// `ctx`: what the other sections say (see FormContext)
function sectionDefs(masked: boolean, forCandidate = false, pack?: JoiningPack, withMedical = true, ctx?: FormContext): SectionDef[] {
  const regular = !pack || pack === 'REGULAR'
  // 4: say up front whether an ESIC nominee is needed (it follows the "ESIC applicable?" answer)
  const esicNominee =
    ctx?.esic === true
      ? 'and one ESIC nominee (ESIC applies to you)'
      : ctx?.esic === false
        ? 'no ESIC nominee is needed (ESIC does not apply to you)'
        : 'and one ESIC nominee if ESIC applies to you (see "PF and ESIC")'
  const all: SectionDef[] = [
    { key: 'personal', kind: 'one', group: 'Personal', icon: UserRound, title: 'Personal details', fields: personalFields(forCandidate) },
    {
      key: 'addresses',
      kind: 'list',
      group: 'Personal',
      icon: MapPin,
      title: 'Addresses',
      description: 'Permanent and present address are needed; contact, emergency contact, spouse and other addresses are optional.',
      itemLabel: 'Address',
      max: 2,
      fields: ADDRESS,
      titleField: 'type',
    },
    { key: 'emergencyContacts', kind: 'list', group: 'Personal', icon: Phone, title: 'Emergency contacts', itemLabel: 'Contact', max: 5, fields: EMERGENCY, titleField: 'name' },
    {
      key: 'identityDocuments',
      kind: 'list',
      group: 'Identity & pay',
      icon: IdCard,
      title: 'Identity documents',
      description: masked ? 'Aadhaar, PAN, passport, driving licence.' : 'Aadhaar / PAN are checked against existing employees when saved.',
      itemLabel: 'Document',
      max: 5,
      fields: identityFields(masked),
      titleField: 'type',
    },
    { key: 'bankAccount', kind: 'one', group: 'Identity & pay', icon: Landmark, title: 'Bank account', description: 'The account the salary is paid into.', fields: bankFields(masked) },
    { key: 'statutory', kind: 'one', group: 'Identity & pay', icon: ShieldCheck, title: 'PF and ESIC', description: 'Questions for your PF (savings for the future) and ESIC (free medical treatment). Not sure about an answer? Ask HR.', fields: STATUTORY },
    {
      key: 'qualifications',
      kind: 'list',
      group: 'Background',
      icon: GraduationCap,
      title: 'Education',
      description: 'Add at least one - your highest study, for example Class 10, Class 12, ITI, diploma or degree.',
      itemLabel: 'Qualification',
      max: 15,
      fields: QUALIFICATION,
      titleField: 'qualification',
    },
    {
      key: 'certifications',
      kind: 'list',
      group: 'Background',
      icon: Award,
      title: 'Additional certifications',
      description: 'Only if you did a course or have a certificate. Leave it empty if you have none.',
      itemLabel: 'Certification',
      max: 15,
      fields: CERTIFICATION,
      titleField: 'name',
    },
    {
      key: 'previousJobs',
      kind: 'list',
      group: 'Background',
      icon: Briefcase,
      title: 'Previous employment',
      description: 'Your earlier jobs. Leave it empty if this is your first job.',
      itemLabel: 'Job',
      max: 15,
      fields: PREVIOUS_JOB,
      titleField: 'employerName',
    },
    {
      key: 'familyMembers',
      kind: 'list',
      group: 'Family',
      icon: Users,
      title: 'Family details',
      description: 'Add at least one person - your husband / wife, children, parents, brothers or sisters.',
      itemLabel: 'Family member',
      max: 15,
      fields: familyFields(masked),
      titleField: 'name',
    },
    {
      key: 'nominees',
      kind: 'list',
      group: 'Family',
      icon: HeartHandshake,
      title: 'Nominees',
      description: regular
        ? `The people who get your money if something happens to you. Add one joining-form nominee, one or more gratuity nominees from your family (their shares must add up to 100%), ${esicNominee}.`
        : 'The person who gets your salary and dues if something happens to you. Add one.',
      itemLabel: 'Nominee',
      max: regular ? 10 : 1,
      fields: nomineeFields(regular, ctx?.family ?? [], ctx?.homeAddress),
      titleField: 'name',
    },
  ]
  // the Form F declarations, with the nominees (Regular only)
  if (regular) {
    all.push({
      key: 'gratuity',
      kind: 'one',
      group: 'Family',
      icon: ScrollText,
      title: 'Gratuity nomination (Form F)',
      description: 'Gratuity is money the company pays you when you leave after working 5 years or more. If you die before that, your gratuity nominees get it. Answer these questions about your family.',
      fields: gratuityFields(ctx),
    })
  }
  // the medical pages: Regular and Consultant & Intern only
  if (withMedical && pack !== 'OVERSEAS') {
    all.push({
      key: 'medical',
      kind: 'one',
      group: 'Health',
      icon: HeartPulse,
      title: 'Medical information',
      description: forCandidate ? 'As on the paper form. Only HR with medical access sees it.' : 'Health data - seen only with the "Employee · Medical" access.',
      fields: MEDICAL,
    })
  }
  return regular ? all : all.filter((d) => d.key !== 'statutory')
}

type SaveState = { pending: boolean; error: unknown; saved: boolean }

// 1: the family details can be "I have no family members to list" (saved as its own part of the form; adding a person
// unticks it)
function noneTickOf(
  key: JoiningFormSection,
  form: Record<string, unknown>,
  onSave: (section: JoiningFormSection, value: unknown, done: () => void) => void,
): ComponentProps<typeof SectionRow>['noneTick'] {
  if (key !== 'familyMembers') return undefined
  return {
    label: 'I have no family members to list',
    hint: 'Tick only if you have no husband / wife, children, parents, brothers or sisters.',
    checked: form.noFamilyMembers === true,
    onChange: (checked) => onSave('noFamilyMembers', checked, () => {}),
  }
}

// The PF / ESIC answers as the form opens with them: the Aadhaar-registered mobile starts as the employee's own mobile
// (from the personal details, else the offer) - it usually is the same number
function withAadhaarMobile(statutory: unknown, personal: unknown, offer: FromOffer | undefined) {
  const saved = (statutory ?? {}) as Record<string, unknown>
  if (saved.aadhaarMobile) return statutory
  const mobile = ((personal ?? {}) as Record<string, unknown>).mobile ?? offer?.mobile
  return mobile ? { ...saved, aadhaarMobile: mobile } : statutory
}

// What a section's form opens with (both views): the personal details with the offer's name and mobile, the PF / ESIC
// answers with the Aadhaar mobile filled in
function editDataOf(form: Record<string, unknown>, key: JoiningFormSection, fromOffer: FromOffer | undefined, pack: JoiningPack | undefined) {
  if (key === 'personal') return withOffer(form.personal, fromOffer)
  if (key === 'statutory') return withAadhaarMobile(form.statutory, form.personal, fromOffer)
  if (key === 'nominees') return withNeededNominees(form, pack)
  return viewDataOf(form, key)
}

// What a section shows: the Form F answers with "Your family for gratuity" worked out
function viewDataOf(form: Record<string, unknown>, key: JoiningFormSection) {
  if (key !== 'gratuity') return form[key]
  const saved = (form.gratuity ?? {}) as Record<string, unknown>
  const answer = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : '')
  const line = familyForGratuity(contextOf(form), answer(saved.gratuityParentsNotDependent), answer(saved.gratuityHusbandsParentsNotDependent))
  return line ? { ...saved, familyForGratuity: line } : form.gratuity
}

// The nominees as their form opens: a row, its type already chosen, for each compulsory nominee not there yet - the
// joining-form one for everyone; for Regular the gratuity one, and the ESIC one when ESIC applies (as the joining
// checklist asks)
function withNeededNominees(form: Record<string, unknown>, pack: JoiningPack | undefined) {
  const saved = (Array.isArray(form.nominees) ? form.nominees : []) as Record<string, unknown>[]
  const regular = !pack || pack === 'REGULAR'
  const esic = (form.statutory as Record<string, unknown> | undefined)?.esicApplicable === true
  const needed = ['GENERAL', ...(regular ? ['GRATUITY'] : []), ...(regular && esic ? ['ESIC'] : [])]
  return [...saved, ...needed.filter((scheme) => !saved.some((n) => n.scheme === scheme)).map((scheme) => ({ scheme }))]
}

// What HR typed on the offer: the name (in parts), the mobile and the personal e-mail
export type FromOffer = { firstName: string; middleName: string | null; lastName: string | null; mobile: string; personalEmail: string | null }

// The personal details as the form opens with them: the offer's name and mobile until the form has its own, and the
// personal e-mail (shown only - it is not part of the form)
function withOffer(personal: unknown, offer: FromOffer | undefined) {
  if (!offer) return personal
  const saved = (personal ?? {}) as Record<string, unknown>
  return {
    ...saved,
    ...(!saved.firstName && { firstName: offer.firstName, middleName: offer.middleName ?? undefined, lastName: offer.lastName ?? undefined }),
    ...(!saved.mobile && { mobile: offer.mobile }),
    personalEmail: offer.personalEmail ?? undefined,
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Addresses: the permanent and the present address (both needed - "same as permanent" copies it) and up to 3 others
// ------------------------------------------------------------------------------------------------------------------

const ADDRESS_FIELDS = ADDRESS.filter((f) => f.name !== 'type')
type AddressRow = Record<string, unknown>

// The further (optional) addresses: contact, emergency contact and spouse once each, and up to 3 others
const EXTRA_TYPES = ['CONTACT', 'EMERGENCY', 'SPOUSE', 'OTHER'] as const
const MAX_OTHER_ADDRESSES = 3
const MAX_EXTRA_ADDRESSES = EXTRA_TYPES.length - 1 + MAX_OTHER_ADDRESSES
// The types an extra address can still take: its own, the named ones no other block uses, and "other" while there is room
function freeExtraTypes(extras: FormValues[], index: number) {
  const usedByOthers = extras.filter((_, i) => i !== index).map((v) => v.type)
  return EXTRA_TYPES.filter((type) =>
    type === 'OTHER' ? extras[index]?.type === 'OTHER' || usedByOthers.filter((t) => t === 'OTHER').length < MAX_OTHER_ADDRESSES : !usedByOthers.includes(type),
  )
}

// The two addresses are the same place (every field equal, the type aside)
function sameAddress(a: AddressRow | undefined, b: AddressRow | undefined) {
  return !!a && !!b && ADDRESS_FIELDS.every((f) => String(a[f.name] ?? '') === String(b[f.name] ?? ''))
}

// Permanent first, then present, then the others - as they are asked
const ADDRESS_ORDER: Record<string, number> = { PERMANENT: 0, PRESENT: 1, CONTACT: 2, EMERGENCY: 3, SPOUSE: 4, OTHER: 5 }
function sortAddresses(rows: AddressRow[]) {
  return [...rows].sort((a, b) => (ADDRESS_ORDER[String(a.type)] ?? 9) - (ADDRESS_ORDER[String(b.type)] ?? 9))
}

function AddressBlock({ title, required, aside, children }: { title: string; required?: boolean; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-surface-2/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {title}
          {required && <span className="text-negative-ink"> *</span>}
        </p>
        {aside}
      </div>
      {children}
    </div>
  )
}

function AddressesForm({
  data,
  disabled,
  state,
  onSave,
  onCancel,
  bare,
  ...shell
}: ShellProps & {
  data: AddressRow[] | undefined
  disabled: boolean
  state: SaveState
  onSave: (value: AddressRow[]) => void
  onCancel?: () => void
  bare?: boolean
}) {
  const rows = data ?? []
  const permanentRow = rows.find((a) => a.type === 'PERMANENT')
  const presentRow = rows.find((a) => a.type === 'PRESENT')
  const [permanent, setPermanent] = useState(() => toFormValues(ADDRESS_FIELDS, permanentRow))
  const [present, setPresent] = useState(() => toFormValues(ADDRESS_FIELDS, presentRow))
  const [same, setSame] = useState(() => sameAddress(permanentRow, presentRow))
  // the further addresses, each with its type (contact / emergency contact / spouse / other)
  const extraFields = (index: number): FieldDef[] => [
    { name: 'type', label: 'Address type', type: 'select', required: true, options: freeExtraTypes(others, index).map((t) => ({ value: t, label: ADDRESS_TYPE[t] })) },
    ...ADDRESS_FIELDS,
  ]
  const [others, setOthers] = useState(() =>
    sortAddresses(rows.filter((a) => a.type !== 'PERMANENT' && a.type !== 'PRESENT')).map((a) => ({ ...toFormValues(ADDRESS_FIELDS, a), type: String(a.type) })),
  )
  const set = (setter: (update: (v: FormValues) => FormValues) => void) => (name: string, value: string) => setter((v) => ({ ...v, [name]: value }))

  // The addresses as saved: a block left empty is not sent; "same as permanent" saves a copy as the present address
  function save() {
    const out: AddressRow[] = []
    const add = (type: string, values: FormValues) => {
      const address = fromFormValues(ADDRESS_FIELDS, values)
      if (Object.keys(address).length) out.push({ type, ...address })
    }
    add('PERMANENT', permanent)
    add('PRESENT', same ? permanent : present)
    others.forEach((values) => add(values.type || 'OTHER', values))
    onSave(out)
  }

  return (
    <SectionShell bare={bare} {...shell}>
      <AddressBlock title="Permanent address" required>
        <FieldsGrid fields={ADDRESS_FIELDS} values={permanent} onChange={set(setPermanent)} disabled={disabled} idPrefix="permanent-" />
      </AddressBlock>

      <AddressBlock
        title="Present address"
        required
        aside={
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox id="present-same" checked={same} disabled={disabled} onCheckedChange={(checked) => setSame(checked === true)} />
            Same as permanent address
          </label>
        }
      >
        {same ? (
          <p className="text-sm text-muted-foreground">The permanent address above is also where you live now.</p>
        ) : (
          <FieldsGrid fields={ADDRESS_FIELDS} values={present} onChange={set(setPresent)} disabled={disabled} idPrefix="present-" />
        )}
      </AddressBlock>

      {others.map((values, index) => (
        <AddressBlock
          key={index}
          title={ADDRESS_TYPE[values.type as Address['type']] ?? `Further address ${index + 1}`}
          aside={
            !disabled && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-negative-ink" onClick={() => setOthers((list) => list.filter((_, i) => i !== index))}>
                <Trash2 /> Remove
              </Button>
            )
          }
        >
          <FieldsGrid
            fields={extraFields(index)}
            values={values}
            onChange={(name, value) => setOthers((list) => list.map((v, i) => (i === index ? { ...v, [name]: value } : v)))}
            disabled={disabled}
            idPrefix={`other${index + 1}-`}
          />
        </AddressBlock>
      ))}

      <FormError error={state.error} />
      {!disabled && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={others.length >= MAX_EXTRA_ADDRESSES}
            // a new block starts with the first type still free (contact, then emergency contact, spouse, other)
            onClick={() => setOthers((list) => [...list, { ...toFormValues(ADDRESS_FIELDS, {}), type: freeExtraTypes([...list, {}], list.length)[0] ?? 'OTHER' }])}
          >
            <Plus /> Add another address <span className="text-muted-foreground">(optional)</span>
          </Button>
          <div className="flex items-center gap-3">
            <SavedNote show={state.saved} />
            {onCancel && (
              <Button variant="ghost" disabled={state.pending} onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button disabled={state.pending} onClick={save}>
              {state.pending ? 'Saving…' : 'Save addresses'}
            </Button>
          </div>
        </div>
      )}
    </SectionShell>
  )
}

// ------------------------------------------------------------------------------------------------------------------
// Edit mode (the candidate's page): the sections as open forms
// ------------------------------------------------------------------------------------------------------------------

export function JoiningFormSections({
  form,
  sections,
  masked = false,
  forCandidate = masked,
  allowNoFamily = true,
  fromOffer,
  pack,
  required,
  disabled,
  note,
  state,
  onSave,
  onEditingChange,
}: {
  // the form as returned by the API (HR: full numbers; the candidate: masked - see `masked`)
  form: Record<string, unknown>
  // the offer's joining type: decides the PF / ESIC section and the nominee schemes
  pack?: JoiningPack
  // what HR typed on the offer: the personal details start with its name and mobile and show its e-mail
  fromOffer?: FromOffer
  // which sections to show, in this order (default: all)
  sections?: JoiningFormSection[]
  // saved numbers are shown as their last 4 digits and may be left empty to keep them (the candidate's page, HR editing
  // an employee)
  masked?: boolean
  // the candidate's own wording ("Your gender") - default: with masked numbers
  forCandidate?: boolean
  // offer "I have no family members to list" (the joining form only - an employee simply has no family rows)
  allowNoFamily?: boolean
  // the required parts (from the form's checks), with whether they are filled - for the status of each card
  required?: (section: JoiningFormSection) => RequiredPart | undefined
  disabled: boolean
  // a line under a section's title, e.g. who changed it last
  note?: (section: JoiningFormSection) => string | undefined
  state: (section: JoiningFormSection) => SaveState
  // `done`: call it when the save succeeded (closes the section's form back to its summary)
  onSave: (section: JoiningFormSection, value: unknown, done: () => void) => void
  // a section's form was opened (true) or closed (false) - e.g. so a drawer asks before discarding an open form. Only
  // opening by hand is told (not a required part that starts open)
  onEditingChange?: (section: JoiningFormSection, editing: boolean) => void
}) {
  const defs = sectionDefs(masked, forCandidate, pack, true, contextOf(form))
  // a section not in this pack (e.g. the Form F declarations for a consultant) is left out
  const shown = sections ? sections.flatMap((key) => defs.filter((d) => d.key === key)) : defs
  // The same cards as HR's view: a saved section is a compact summary with "Edit"; an empty required one starts as an
  // open form
  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-3xl bg-card shadow-card">
      {shown.map((def) => {
        const req = required?.(def.key)
        return (
          <SectionRow
            key={def.key}
            def={def}
            data={viewDataOf(form, def.key)}
            editData={editDataOf(form, def.key, fromOffer, pack)}
            status={statusOf(isFilled(form[def.key]), req)}
            missing={req && !req.ok ? (req.detail ?? undefined) : undefined}
            note={note?.(def.key)}
            disabled={disabled}
            // only a required part opens by itself - an optional one (certifications, earlier jobs) waits for "Add", so
            // it does not look compulsory
            // (a required part already satisfied - "no family members" ticked - stays closed)
            startOpen={!disabled && !!req && !req.ok && !isFilled(form[def.key])}
            noneTick={allowNoFamily ? noneTickOf(def.key, form, onSave) : undefined}
            state={state(def.key)}
            onSave={(v, done) => onSave(def.key, v, done)}
            onEditingChange={onEditingChange && ((editing) => onEditingChange(def.key, editing))}
          />
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------------------------
// Review mode (HR): an index of the sections, each a card with a read-only summary and "Edit" to open its form
// ------------------------------------------------------------------------------------------------------------------

// A required part of the form (from the joining checklist): filled or not, and what is missing
export type RequiredPart = { ok: boolean; detail: string | null }

// How a section stands: the pill, the colour of its icon tile, and its segment in the progress bar
type Status = { label: string; tone: Tone; tile: string; bar: string; done: boolean; missing: boolean }

function isFilled(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return !!value && typeof value === 'object' && Object.values(value).some((v) => v !== undefined && v !== null && v !== '')
}

function statusOf(filled: boolean, required: RequiredPart | undefined): Status {
  if (required && !required.ok) return { label: 'Missing', tone: 'warning', tile: 'bg-warning/15 text-warning-ink', bar: 'bg-warning', done: false, missing: true }
  if (required || filled) {
    return { label: required ? 'Complete' : 'Filled', tone: 'positive', tile: 'bg-positive/15 text-positive-ink', bar: 'bg-positive', done: true, missing: false }
  }
  return { label: 'Optional', tone: 'neutral', tile: 'bg-surface-2 text-muted-foreground', bar: 'bg-foreground/10', done: false, missing: false }
}

// A value as text for the summary; null = not filled
function display(field: FieldDef, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (Array.isArray(value)) return value.length ? value.map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v)).join(', ') : null
  if (value instanceof Date) return formatDate(value)
  if (typeof value === 'boolean') return field.options?.find((o) => o.value === (value ? 'yes' : 'no'))?.label ?? (value ? 'Yes' : 'No')
  if (field.options) return field.options.find((o) => o.value === value)?.label ?? String(value)
  if (field.sensitive) return `•••• ${String(value).slice(-4)}`
  return String(value)
}

// The card title of a list item: the value of its title field, as shown in the summary
function titleOf(fields: FieldDef[], name: string, item: Record<string, unknown>) {
  const field = fields.find((f) => f.name === name)
  return field ? display(field, item[name]) : null
}

function Summary({ fields, data, skip }: { fields: FieldDef[]; data: Record<string, unknown>; skip?: string }) {
  // as the form: only the fields that apply (e.g. one of the two "state" fields of an address)
  const values = toFormValues(fields, data)
  const rows = fields.filter((f) => f.name !== skip && isShown(f, values)).flatMap((f) => {
    const text = display(f, data[f.name])
    return text === null ? [] : [{ field: f, text }]
  })
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing filled in yet.</p>

  const cells = (list: typeof rows) =>
    list.map(({ field, text }) => (
      <div key={field.name} className={cn('min-w-0', field.wide && 'col-span-2')}>
        <dt className="text-xs leading-4 text-muted-foreground">{field.label.replace(/\?$/, '')}</dt>
        <dd className={cn('text-sm leading-5 font-medium break-words', field.sensitive && 'font-mono tracking-wide')}>{text}</dd>
      </div>
    ))
  // columns by the room the summary has (a container query), not the screen: a half-width card keeps 2 columns
  const grid = 'grid grid-cols-2 gap-x-5 gap-y-2 @lg:grid-cols-3 @xl:grid-cols-4'

  // Compact: a section with sub-headings (personal details, PF / ESIC) is one row per group - the group's name on the
  // left, its answers beside it; a list item (an address, a contact) is just the grid.
  const groups: { name: string; rows: typeof rows }[] = []
  for (const row of rows) {
    const name = row.field.group ?? ''
    if (groups.at(-1)?.name === name) groups.at(-1)!.rows.push(row)
    else groups.push({ name, rows: [row] })
  }
  if (groups.length === 1 && !groups[0]!.name) {
    return (
      <dl className="@container">
        <div className={grid}>{cells(rows)}</div>
      </dl>
    )
  }
  return (
    <dl className="divide-y divide-border/60">
      {groups.map((group) => (
        <div key={group.name} className="grid gap-x-5 gap-y-1.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
          <p className="pt-px text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group.name}</p>
          <div className="@container">
            <div className={grid}>{cells(group.rows)}</div>
          </div>
        </div>
      ))}
    </dl>
  )
}

// One section as a row of its group's card: status-tinted icon, title, what is missing, the summary, and "Edit"
function SectionRow({
  def,
  data,
  editData = data,
  startOpen = false,
  status,
  missing,
  note,
  disabled,
  state,
  onSave,
  noneTick,
  onEditingChange,
}: {
  def: SectionDef
  data: unknown
  // what the form opens with, when it differs from what is saved (the personal details start with the offer's name)
  editData?: unknown
  // open the form at once (the candidate's empty sections)
  startOpen?: boolean
  status: Status
  // what exactly the joining checklist says is missing (the "Missing" pill already says that something is)
  missing?: string
  note?: string
  disabled: boolean
  state: SaveState
  // `done` closes the form again - call it when the save succeeded
  onSave: (value: unknown, done: () => void) => void
  // a list nobody may have to fill (the family details): "I have none" as a tick while the list is empty
  noneTick?: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }
  onEditingChange?: (editing: boolean) => void
}) {
  const [editing, setEditingState] = useState(startOpen)
  const setEditing = (next: boolean) => {
    setEditingState(next)
    onEditingChange?.(next)
  }
  const save = (value: unknown) => onSave(value, () => setEditing(false))
  const filled = isFilled(data)
  const Icon = def.icon
  const items = (Array.isArray(data) ? data : []) as Record<string, unknown>[]
  // addresses read permanent, present, others - the present one as "same as permanent" when it is a copy
  const isAddresses = def.key === 'addresses'
  const shownItems = isAddresses ? sortAddresses(items) : items
  const permanentItem = isAddresses ? items.find((a) => a.type === 'PERMANENT') : undefined

  return (
    <section id={`jf-${def.key}`} className={cn('scroll-mt-24 transition-colors', editing && 'bg-gold-soft/25')}>
      <header className="flex items-start gap-4 px-5 py-3.5">
        <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-2xl', status.tile)}>
          <Icon className="size-5" />
          {status.done && (
            <span className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full bg-positive text-white ring-2 ring-card">
              <Check className="size-3" strokeWidth={3} />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[15px] font-medium tracking-tight">{def.title}</h3>
            <Pill tone={status.tone} className="px-2 py-0.5">
              {status.label}
            </Pill>
            {def.kind === 'list' && items.length > 0 && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {items.length} {items.length === 1 ? def.itemLabel.toLowerCase() : def.itemLabel.toLowerCase().replace(/(s|x|ch|sh)$|$/, (end) => (end ? `${end}es` : 's'))}
              </span>
            )}
          </div>
          {missing && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-warning-ink">
              <CircleAlert className="size-3.5 shrink-0" /> {missing}
            </p>
          )}
          {(def.description || note) && <p className="mt-0.5 text-xs text-muted-foreground">{[def.description, note].filter(Boolean).join(' · ')}</p>}
          {noneTick && !filled && (
            <label className={cn('mt-2 flex w-fit items-start gap-2 text-sm', !disabled && 'cursor-pointer')}>
              <Checkbox
                className="mt-0.5"
                checked={noneTick.checked}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  noneTick.onChange(checked === true)
                  if (checked === true) setEditing(false)
                }}
              />
              <span>
                {noneTick.label}
                <span className="block text-xs text-muted-foreground">{noneTick.hint}</span>
              </span>
            </label>
          )}
        </div>
        {!disabled && !editing && (
          <Button variant={filled ? 'ghost' : 'secondary'} size="sm" className="shrink-0 max-sm:size-9 max-sm:px-0" onClick={() => setEditing(true)}>
            {filled ? <Pencil /> : <Plus />}
            <span className="max-sm:sr-only">{filled ? 'Edit' : 'Add'}</span>
          </Button>
        )}
      </header>
      {/* the summary lines up under the title; the form being edited takes the full width */}
      {(editing || filled) && (
        <div className={cn('px-5 pb-4', !editing && 'sm:pl-19')}>
          {editing ? (
            <div className="rounded-2xl bg-card p-4 shadow-card sm:p-5">
              {def.key === 'addresses' ? (
                <AddressesForm bare title={def.title} data={items} disabled={false} state={state} onSave={save} onCancel={() => setEditing(false)} />
              ) : def.kind === 'one' ? (
                <SectionForm bare title={def.title} fields={def.fields} data={editData as Record<string, unknown> | undefined} disabled={false} state={state} onSave={save} onCancel={() => setEditing(false)} />
              ) : (
                <ListSectionForm
                  bare
                  startWithRow
                  title={def.title}
                  itemLabel={def.itemLabel}
                  max={def.max}
                  fields={def.fields}
                  data={Array.isArray(editData) ? (editData as Record<string, unknown>[]) : items}
                  disabled={false}
                  state={state}
                  onSave={save}
                  onCancel={() => setEditing(false)}
                />
              )}
            </div>
          ) : def.kind === 'one' ? (
            <Summary fields={def.fields} data={data as Record<string, unknown>} />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {shownItems.map((item, i) => (
                <li key={i} className="space-y-2 rounded-2xl border border-border/70 bg-surface-2/40 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-hero text-xs font-semibold text-hero-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0 break-words">{titleOf(def.fields, def.titleField, item) ?? `${def.itemLabel} ${i + 1}`}</span>
                  </p>
                  {isAddresses && item.type === 'PRESENT' && sameAddress(item, permanentItem) ? (
                    <p className="text-sm text-muted-foreground">Same as the permanent address</p>
                  ) : (
                    <Summary fields={def.fields} data={item} skip={def.titleField} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// The sections' names - the one list every place that names a section uses (the cards, the side index, HR's checklist)
// oxlint-disable-next-line react/only-export-components -- the names come from sectionDefs, which lives in this file
export function joiningSectionTitles() {
  return Object.fromEntries(sectionDefs(false).map((d) => [d.key, d.title])) as Partial<Record<JoiningFormSection, string>>
}

const ALL_GROUPS = [
  { name: 'Personal', icon: UserRound },
  { name: 'Identity & pay', icon: Landmark },
  { name: 'Background', icon: GraduationCap },
  { name: 'Family', icon: Users },
  { name: 'Health', icon: HeartPulse },
] as const

// The section nearest the top of the screen, for the side index (updated while scrolling)
function useSectionInView(keys: string[]) {
  const [active, setActive] = useState(keys[0])
  const joined = keys.join(',')
  useEffect(() => {
    const onScroll = () => {
      let current = joined.split(',')[0]
      for (const key of joined.split(',')) {
        const top = document.getElementById(`jf-${key}`)?.getBoundingClientRect().top
        if (top !== undefined && top <= 140) current = key
      }
      setActive(current)
    }
    const frame = requestAnimationFrame(onScroll)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [joined])
  return active
}

export function JoiningFormReview({
  form,
  fromOffer,
  pack,
  medical = true,
  disabled,
  required,
  note,
  state,
  onSave,
}: {
  form: Record<string, unknown>
  // what HR typed on the offer: editing the personal details starts with its name and mobile and shows its e-mail
  fromOffer?: FromOffer
  // the offer's joining type: decides the PF / ESIC section and the nominee schemes
  pack?: JoiningPack
  // show the medical information (the viewer has the "Employee · Medical" access)
  medical?: boolean
  disabled: boolean
  // the sections the joining checklist requires, with whether they are filled
  required: (section: JoiningFormSection) => RequiredPart | undefined
  note?: (section: JoiningFormSection) => string | undefined
  state: (section: JoiningFormSection) => SaveState
  // `done`: call it when the save succeeded (closes the section's form)
  onSave: (section: JoiningFormSection, value: unknown, done: () => void) => void
}) {
  const defs = sectionDefs(false, false, pack, medical, contextOf(form))
  // the groups that have sections (Health only with the medical information)
  const GROUPS = ALL_GROUPS.filter((g) => defs.some((d) => d.group === g.name))
  const statuses = Object.fromEntries(defs.map((d) => [d.key, statusOf(isFilled(form[d.key]), required(d.key))])) as Record<JoiningFormSection, Status>
  const active = useSectionInView(defs.map((d) => d.key))
  const filledCount = defs.filter((d) => statuses[d.key].done).length
  // the count on top is of the sections that must be filled - the optional ones are not part of it
  const requiredDefs = defs.filter((d) => required(d.key))
  const requiredDone = requiredDefs.filter((d) => required(d.key)?.ok).length

  return (
    <div className="flex items-start gap-6">
      <nav aria-label="Joining form sections" className="sticky top-24 hidden w-64 shrink-0 overflow-hidden rounded-3xl bg-card shadow-card lg:block">
        {/* how far the form is: a segment per section, in page order */}
        <div className="space-y-2.5 border-b bg-surface-2/40 px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Sections</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {requiredDefs.length > 0 ? (
                <>
                  <span className="text-base font-semibold text-foreground">{requiredDone}</span> of {requiredDefs.length} required
                </>
              ) : (
                <>
                  <span className="text-base font-semibold text-foreground">{filledCount}</span> of {defs.length} filled
                </>
              )}
            </p>
          </div>
          <div className="flex gap-1">
            {defs.map((d) => (
              <span key={d.key} title={`${d.title}: ${statuses[d.key].label}`} className={cn('h-1.5 flex-1 rounded-full', statuses[d.key].bar)} />
            ))}
          </div>
        </div>
        <div className="space-y-3 p-3">
          {GROUPS.map((group) => {
            const inGroup = defs.filter((d) => d.group === group.name)
            return (
              <div key={group.name} className="space-y-0.5">
                <p className="flex items-center justify-between px-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {group.name}
                  <span className="font-medium tracking-normal tabular-nums">
                    {inGroup.filter((d) => statuses[d.key].done).length}/{inGroup.length}
                  </span>
                </p>
                {inGroup.map((def) => {
                  const s = statuses[def.key]
                  const Icon = def.icon
                  const current = active === def.key
                  return (
                    <button
                      key={def.key}
                      type="button"
                      aria-current={current ? 'location' : undefined}
                      onClick={() => document.getElementById(`jf-${def.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className={cn(
                        'relative flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors',
                        current ? 'bg-surface-2 font-medium text-foreground' : 'text-foreground/75 hover:bg-surface-2/60 hover:text-foreground',
                      )}
                    >
                      {current && <span className="absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-gold" />}
                      <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', s.tile)}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">{def.title}</span>
                      {s.done ? (
                        <Check className="size-4 shrink-0 text-positive" strokeWidth={2.5} />
                      ) : s.missing ? (
                        <CircleAlert className="size-4 shrink-0 text-warning" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </nav>

      <div className="min-w-0 flex-1 space-y-5">
        {GROUPS.map((group) => {
          const inGroup = defs.filter((d) => d.group === group.name)
          const done = inGroup.filter((d) => statuses[d.key].done).length
          const GroupIcon = group.icon
          return (
            <div key={group.name} className="overflow-hidden rounded-3xl bg-card shadow-card">
              <div className="flex items-center gap-3 border-b bg-surface-2/40 px-5 py-2.5">
                <GroupIcon className="size-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group.name}</h2>
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span className="flex gap-0.5">
                    {inGroup.map((d) => (
                      <span key={d.key} className={cn('size-1.5 rounded-full', statuses[d.key].bar)} />
                    ))}
                  </span>
                  {done} of {inGroup.length}
                </span>
              </div>
              <div className="divide-y divide-border/70">
                {inGroup.map((def) => {
                  const req = required(def.key)
                  return (
                    <SectionRow
                      key={def.key}
                      def={def}
                      data={viewDataOf(form, def.key)}
                      editData={editDataOf(form, def.key, fromOffer, pack)}
                      status={statuses[def.key]}
                      missing={req && !req.ok ? (req.detail ?? undefined) : undefined}
                      note={note?.(def.key)}
                      disabled={disabled}
                      state={state(def.key)}
                      onSave={(v, done) => onSave(def.key, v, done)}
                      noneTick={noneTickOf(def.key, form, onSave)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
