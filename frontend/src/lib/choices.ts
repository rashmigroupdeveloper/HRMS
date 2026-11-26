// Shared dropdown choices (used by several pages): places (countries, Indian states / UTs, time zones) for the
// organization masters and addresses, and the people lists of the joining form.
import type { client } from '@/lib/orpc'


// ISO 3166-1 alpha-2 country codes; names come from the browser (Intl.DisplayNames), so they need no upkeep here
const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO ' +
  'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR ' +
  'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO ' +
  'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV ' +
  'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ')

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

// "India (IN)", sorted by name, India first (most locations are in India)
export const COUNTRY_OPTIONS = COUNTRY_CODES.map((code) => ({ value: code, label: `${regionNames.of(code) ?? code} (${code})` })).sort(
  (a, b) => (a.value === 'IN' ? -1 : b.value === 'IN' ? 1 : a.label.localeCompare(b.label)),
)

// Indian states and union territories with their 2-letter codes
const INDIAN_STATES: [string, string][] = [
  ['AN', 'Andaman and Nicobar Islands'],
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CH', 'Chandigarh'],
  ['CG', 'Chhattisgarh'],
  ['DH', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['DL', 'Delhi'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'],
  ['JK', 'Jammu and Kashmir'],
  ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['LA', 'Ladakh'],
  ['LD', 'Lakshadweep'],
  ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'],
  ['MN', 'Manipur'],
  ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OD', 'Odisha'],
  ['PY', 'Puducherry'],
  ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'],
  ['TG', 'Telangana'],
  ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'],
  ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
]
export const INDIAN_STATE_OPTIONS = INDIAN_STATES.map(([value, name]) => ({ value, label: `${name} (${value})` }))
// The same list by name - for fields that store the state name (company / plant region, as SAP sends it)
export const INDIAN_STATE_NAME_OPTIONS = INDIAN_STATES.map(([, name]) => ({ value: name, label: name }))

// Every IANA time zone the browser knows, Asia/Kolkata first
const timeZones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Asia/Kolkata']
export const TIME_ZONE_OPTIONS = ['Asia/Kolkata', ...timeZones.filter((tz) => tz !== 'Asia/Kolkata' && tz !== 'Asia/Calcutta')].map(
  (tz) => ({
    value: tz,
    label: tz.replace(/_/g, ' '),
  }),
)

// ---- People: the joining form and the employee master ----
// Stored as the text shown (e.g. "Hindu", "Father"), so a list can grow without changing data.

const textOptions = (labels: string[]) => labels.map((label) => ({ value: label, label }))

export const RELIGION_OPTIONS = textOptions(['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi', 'Jewish', 'Other', 'Prefer not to say'])

// Relationships of an emergency contact or a nominee to the employee
export const RELATIONSHIP_OPTIONS = textOptions([
  'Father',
  'Mother',
  'Spouse',
  'Son',
  'Daughter',
  'Brother',
  'Sister',
  'Father-in-law',
  'Mother-in-law',
  'Grandfather',
  'Grandmother',
  'Uncle',
  'Aunt',
  'Cousin',
  'Guardian',
  'Friend',
  'Other relative',
])

// The specified disabilities in the schedule of the Rights of Persons with Disabilities Act, 2016
export const DISABILITY_OPTIONS = textOptions([
  'Locomotor disability',
  'Leprosy cured',
  'Cerebral palsy',
  'Dwarfism',
  'Muscular dystrophy',
  'Acid attack victim',
  'Blindness',
  'Low vision',
  'Deaf / hard of hearing',
  'Speech and language disability',
  'Intellectual disability',
  'Specific learning disability',
  'Autism spectrum disorder',
  'Mental illness',
  'Multiple sclerosis',
  "Parkinson's disease",
  'Haemophilia',
  'Thalassemia',
  'Sickle cell disease',
  'Deaf-blindness',
  'Multiple disabilities',
])

// Common qualifications - the field also takes any other typed in
export const QUALIFICATION_OPTIONS = textOptions([
  'Class VIII',
  'Class X',
  'Class XII',
  'ITI',
  'Diploma',
  'B.A.',
  'B.Sc.',
  'B.Com.',
  'B.E. / B.Tech.',
  'BBA',
  'BCA',
  'B.Pharm.',
  'LL.B.',
  'M.A.',
  'M.Sc.',
  'M.Com.',
  'M.E. / M.Tech.',
  'MBA',
  'PGDM',
  'MCA',
  'CA',
  'CS',
  'CMA',
  'Ph.D.',
])

// Common banks in India - the field also takes any other typed in
export const BANK_OPTIONS = textOptions([
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDFC FIRST Bank',
  'IDBI Bank',
  'Federal Bank',
  'Bandhan Bank',
  'RBL Bank',
  'South Indian Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Jammu & Kashmir Bank',
  'AU Small Finance Bank',
  'India Post Payments Bank',
])

// The actions of the change history (the Change history page's filter, and each entry)
export type HistoryAction = Awaited<ReturnType<typeof client.changeHistory.list>>['items'][number]['action']
export const HISTORY_ACTION_LABEL: Record<HistoryAction, string> = {
  CREATE: 'Created',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
  SIGN_IN: 'Signed in',
  SIGN_IN_FAILED: 'Sign-in failed',
  SIGN_OUT: 'Signed out',
}
export const HISTORY_ACTION_OPTIONS = (Object.keys(HISTORY_ACTION_LABEL) as HistoryAction[]).map((value) => ({ value, label: HISTORY_ACTION_LABEL[value] }))

// --- Job lists (moved from the employee pages, 2026-11-21: used by the profile, the Pay & career page and the change form) ---

type Profile = Awaited<ReturnType<typeof client.employees.getByCode>>
export const JOINING_TYPE: Record<Profile['joiningType'], string> = {
  REGULAR: 'Regular',
  CONSULTANT_INTERN: 'Consultant & Intern',
  OVERSEAS: 'Overseas',
}

export const EMPLOYMENT_TYPE: Record<Profile['employmentType'], string> = {
  PERMANENT: 'Permanent',
  CONTRACT: 'Contract',
  TRAINEE: 'Trainee / Intern',
  CONSULTANT: 'Consultant',
  APPRENTICE: 'Apprentice',
}

export const WORKFORCE: Record<Profile['workforceCategory'], string> = { WHITE_COLLAR: 'White collar (staff)', BLUE_COLLAR: 'Blue collar (worker)' }

// Why a salary row exists - the salary history and a pay run's salary copy (payroll)
export const SALARY_REASON: Record<Awaited<ReturnType<typeof client.employees.salaryHistory>>[number]['reason'], string> = {
  JOINING: 'Joining',
  INCREMENT: 'Increment',
  PROMOTION: 'Promotion',
  CONFIRMATION: 'Confirmation',
  CORRECTION: 'Correction',
  OTHER: 'Other',
}

// What kind of change a job-timeline entry is (2026-11-19)
type JobChangeKind = Awaited<ReturnType<typeof client.employees.jobHistory.list>>[number]['kind']
export const JOB_CHANGE_KIND: Record<JobChangeKind, string> = {
  JOINING: 'Joining',
  PROMOTION: 'Promotion',
  TRANSFER: 'Transfer',
  REDESIGNATION: 'Redesignation',
  MANAGER_CHANGE: 'Change of manager',
  COMPANY_TRANSFER: 'Company transfer',
  SALARY_REVISION: 'Salary revision',
  SALARY_CORRECTION: 'Salary correction',
  OTHER: 'Other',
}
