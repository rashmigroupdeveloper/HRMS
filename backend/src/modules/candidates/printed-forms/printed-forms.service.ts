import type { CurrentUser } from '#core/rpc/procedures'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { JoiningType } from '#core/db/prisma'
import { EXTRA_PAGE, fillPdf, type PdfMark } from '#core/pdf/fill-pdf'
import { today, yearsOld as ageOf } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { JoiningForm } from '../joining-form/joining-form.schema.js'
import * as candidatesService from '../candidates.service.js'
import * as joiningFormService from '../joining-form/joining-form.service.js'
import * as printedFormsRepository from './printed-forms.repository.js'

// Business rules for the printed joining forms (decided 2026-11-15): on the joining day HR prints HR's own paper forms
// (docs/hr-forms) filled in from the joining form, the candidate signs them by hand, and HR uploads the scans as the
// "signed" documents of the joining checklist. Nothing is copied by hand; left for the paper: the signatures, dates of
// signing, Form F's witnesses and employer certificate, ESIC's counter-signature, Form 11's employer part and the
// office-use boxes.
// The three packs are the same pages (checked 2026-11-15), so the Regular pack is the one template:
//   Regular            joining form (4) + Gratuity Form F (2) + ESIC Form 1 (only when ESIC applies) + EPF Form 11
//                      + medical information (2)
//   Consultant/Intern  joining form + medical information
//   Overseas           joining form
// The medical pages are filled only for someone with MEDICAL READ, else left out. Positions are PDF points from the
// top-left of each page, measured on the template (pages are 612 x 792; ESIC Form 1 540 x 900; medical 595 x 842).

const TEMPLATE = fileURLToPath(new URL('../../../../../docs/hr-forms/joining-form-regular.pdf', import.meta.url))
const PAGE = { JF1: 0, JF2: 1, JF3: 2, JF4: 3, FORM_F1: 4, FORM_F2: 5, ESIC: 6, EPF: 7, MED1: 8, MED2: 9 } as const

type Candidate = NonNullable<Awaited<ReturnType<typeof printedFormsRepository.findForPrint>>>
type Address = NonNullable<JoiningForm['addresses']>[number]
type Range = [number, number]
type Value = string | number | null | undefined

// --- small formatting helpers ---

const two = (n: number) => String(n).padStart(2, '0')
const dmy = (date: Date | null | undefined) => (date ? `${two(date.getUTCDate())}/${two(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}` : '')
const yearsOld = (birth: Date | null | undefined) => (birth ? String(ageOf(birth)) : '')
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryName = (code: string | null | undefined) => (code ? (regionNames.of(code) ?? code) : '')
const groupedAadhaar = (n: string | undefined) => (n ? n.replace(/(\d{4})(?=\d)/g, '$1 ') : '')
const rupees = (n: number | undefined) => (n === undefined ? '' : `Rs. ${n.toLocaleString('en-IN')}`)
const join = (parts: Value[], separator = ', ') => parts.filter((p) => p !== undefined && p !== null && p !== '').join(separator)
const addressLine = (a: Address | undefined, withPin = true) =>
  a ? join([a.houseNo, a.locality, a.cityOrVillage, a.district, a.state, (a.countryCode ?? 'IN') !== 'IN' ? countryName(a.countryCode) : null, withPin ? a.postalCode : null]) : ''

const GENDER: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', TRANSGENDER: 'Transgender' }
const CATEGORY: Record<string, string> = { GENERAL: 'General', EWS: 'EWS', OBC: 'OBC', SC: 'SC', ST: 'ST' }
const BLOOD: Record<string, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
}
const RELATION: Record<string, string> = {
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
const MARITAL: Record<string, string> = { SINGLE: 'Single', MARRIED: 'Married', WIDOWED: 'Widowed', DIVORCED: 'Divorced', SEPARATED: 'Separated' }

// The pages printed for this pack, in order
function pagesFor(pack: JoiningType, esicApplies: boolean, withMedical: boolean): number[] {
  const joiningForm = [PAGE.JF1, PAGE.JF2, PAGE.JF3, PAGE.JF4]
  const medical = withMedical ? [PAGE.MED1, PAGE.MED2] : []
  if (pack === 'OVERSEAS') return joiningForm
  if (pack === 'CONSULTANT_INTERN') return [...joiningForm, ...medical]
  return [...joiningForm, PAGE.FORM_F1, PAGE.FORM_F2, ...(esicApplies ? [PAGE.ESIC] : []), PAGE.EPF, ...medical]
}

// Collects the marks; what does not fit the form's rows goes to a continuation sheet at the end
class Sheet {
  marks: PdfMark[] = []
  more: { heading: string; lines: string[] }[] = []

  text(page: number, x: number, y: number, value: Value, options: { width?: number; size?: number; lines?: number; bold?: boolean } = {}) {
    if (value === undefined || value === null || value === '') return
    this.marks.push({ kind: 'text', page, x, y, text: String(value), ...options })
  }
  circle(page: number, [x0, x1]: Range, [y0, y1]: Range) {
    this.marks.push({ kind: 'circle', page, x0, x1, y0, y1 })
  }
  tick(page: number, x: number, y: number, size?: number) {
    this.marks.push({ kind: 'tick', page, x, y, ...(size ? { size } : {}) })
  }
  strike(page: number, x0: number, x1: number, ...ys: number[]) {
    for (const y of ys) this.marks.push({ kind: 'strike', page, x0, x1, y })
  }
  // circles "Yes" or "No" printed on the form
  yesNo(page: number, value: boolean | undefined, yes: Range, no: Range, y: Range) {
    if (value === true) this.circle(page, yes, y)
    if (value === false) this.circle(page, no, y)
  }
  // ticks the "Yes" or the "No" box
  tickYesNo(page: number, value: boolean | undefined, yes: [number, number], no: [number, number]) {
    if (value === true) this.tick(page, ...yes)
    if (value === false) this.tick(page, ...no)
  }
  // a table: each row's cells written in its columns (x ranges); rows beyond the form's go to the continuation sheet
  table(page: number, columns: number[], rowTops: number[], rowHeight: number, rows: Value[][], heading: string, size = 8) {
    rows.forEach((cells, r) => {
      const top = rowTops[r]
      if (top === undefined) return
      cells.forEach((cell, c) => {
        const x0 = columns[c]!
        const x1 = columns[c + 1]!
        const twoLines = rowHeight >= 24
        this.text(page, x0 + 3, top + (twoLines ? rowHeight / 2 - 2 : rowHeight - 3.5), cell, { width: x1 - x0 - 6, size, lines: twoLines ? 2 : 1 })
      })
    })
    const extra = rows.slice(rowTops.length)
    if (extra.length) this.more.push({ heading, lines: extra.map((cells) => join(cells, ' | ')) })
  }

  // The continuation sheet's marks; returns how many extra pages it needs
  continuation(): number {
    if (!this.more.length) return 0
    let page = 0
    let y = 60
    const line = (text: string, options: { bold?: boolean; size?: number } = {}) => {
      if (y > 750) {
        page++
        y = 60
      }
      this.text(EXTRA_PAGE + page, 50, y, text, { width: 512, lines: 2, size: 9, ...options })
      y += text.length > 110 ? 24 : 14
    }
    line('Continuation sheet - entries that did not fit on the form', { bold: true, size: 11 })
    y += 6
    for (const section of this.more) {
      line(section.heading, { bold: true })
      section.lines.forEach((text, i) => line(`${i + 1}. ${text}`))
      y += 8
    }
    return page + 1
  }
}

// The joining forms of a candidate as one PDF to print
// HR prints the forms (Onboarding View covering the candidate - data access); the medical pages only with medical
// access covering the candidate too
export async function printFormsFor(viewer: CurrentUser, candidateId: number) {
  const candidate = await candidatesService.getCandidateFor(viewer, candidateId)
  return printForms(candidateId, { medical: candidatesService.viewerHasAt(viewer, candidate, 'MEDICAL', 'READ') })
}

export async function printForms(candidateId: number, viewer: { medical: boolean }) {
  const candidate = await printedFormsRepository.findForPrint(candidateId)
  if (!candidate) throw new ORPCError('NOT_FOUND', { message: `No candidate found with id ${candidateId}` })
  if (candidate.status !== 'ACCEPTED') {
    throw new ORPCError('CONFLICT', {
      message: `The joining forms are printed from the joining form between acceptance and joining; this candidate is ${candidate.status}`,
    })
  }
  const form = await joiningFormService.getJoiningForm(candidateId)
  const pack = candidate.joiningType
  // only a complete form is printed for signing - every required part filled, by the candidate or HR (2026-11-15)
  const missing = joiningFormService.checkForm(pack, form).filter((c) => !c.ok)
  if (missing.length) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Fill the joining form first - still missing: ${missing.map((c) => c.label.replace('Joining form: ', '')).join('; ')}`,
    })
  }
  const esicApplies = pack === 'REGULAR' && form.statutory?.esicApplicable === true
  const withMedical = viewer.medical && pack !== 'OVERSEAS'
  const pages = pagesFor(pack, esicApplies, withMedical)

  const sheet = new Sheet()
  const p = facts(candidate, form)
  joiningFormPages(sheet, p)
  if (pages.includes(PAGE.FORM_F1)) formF(sheet, p)
  if (pages.includes(PAGE.ESIC)) esicForm1(sheet, p)
  if (pages.includes(PAGE.EPF)) epfForm11(sheet, p)
  if (withMedical) medicalPages(sheet, p)
  const extraPages = sheet.continuation()

  const bytes = await fillPdf(await readFile(TEMPLATE), pages, sheet.marks, extraPages)
  const fileName = `joining-forms-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || candidateId}.pdf`
  return new File([new Uint8Array(bytes)], fileName, { type: 'application/pdf' })
}

// What the forms print, worked out once from the offer and the joining form
function facts(candidate: Candidate, form: JoiningForm) {
  const personal = form.personal ?? {}
  const idOf = (type: string) => form.identityDocuments?.find((d) => d.type === type)
  const addressOf = (type: string) => form.addresses?.find((a) => a.type === type)
  const married = personal.maritalStatus === 'MARRIED' || personal.maritalStatus === 'SEPARATED'
  const company = candidate.company
  return {
    candidate,
    form,
    personal,
    name: joiningFormService.fullName(joiningFormService.nameOnForm(candidate, form)),
    mobile: personal.mobile ?? candidate.mobile,
    email: candidate.personalEmail,
    female: personal.gender === 'FEMALE',
    married,
    aadhaar: idOf('AADHAAR'),
    pan: idOf('PAN'),
    passport: idOf('PASSPORT'),
    drivingLicence: idOf('DRIVING_LICENCE'),
    present: addressOf('PRESENT') ?? addressOf('PERMANENT'),
    permanent: addressOf('PERMANENT'),
    statutory: form.statutory ?? {},
    gratuity: form.gratuity ?? {},
    noFamily: joiningFormService.gratuityNoFamilyOf(form),
    family: form.familyMembers ?? [],
    nominees: form.nominees ?? [],
    emergency: form.emergencyContacts?.[0],
    employer: join([company.name, company.address, company.region, company.postalCode, (company.countryCode ?? 'IN') !== 'IN' ? countryName(company.countryCode) : null]),
    joiningDate: candidate.proposedJoiningDate,
    place: candidate.workLocation?.name ?? '',
  }
}
type Facts = ReturnType<typeof facts>

// --- EMPLOYEE JOINING FORM RML/HR/02/01 (pages 1-4) ---
function joiningFormPages(s: Sheet, p: Facts) {
  const { candidate, personal } = p
  // page 1: header, 1. Official / Employment details, 2. Personal details
  const page1 = PAGE.JF1
  s.text(page1, 140, 131, candidate.company.name, { width: 262 })
  s.text(page1, 100, 161, p.place, { width: 300 })
  const printed = today()
  s.text(page1, 79, 191, two(printed.getUTCDate()))
  s.text(page1, 108, 191, two(printed.getUTCMonth() + 1))
  s.text(page1, 140, 191, printed.getUTCFullYear())
  s.text(page1, 131, 250, p.name, { width: 232 })
  s.text(page1, 110, 281, candidate.designation.name, { width: 255 })
  s.text(page1, 436, 281, candidate.department?.name, { width: 136 })
  s.text(page1, 122, 313, dmy(p.joiningDate))
  s.text(page1, 447, 313, p.place, { width: 125 })
  const employment: Record<string, Range> = { PERMANENT: [176, 223], CONTRACT: [230, 268], TRAINEE: [276, 307], APPRENTICE: [276, 307], CONSULTANT: [314, 362] }
  const employmentAt = employment[candidate.employmentType]
  if (employmentAt) s.circle(page1, employmentAt, [335, 347])
  if (candidate.employmentType === 'APPRENTICE') s.text(page1, 268, 358, '(Apprentice)', { size: 7 })
  s.text(page1, 438, 345, candidate.grade?.name, { width: 134 })

  s.text(page1, 124, 425, personal.fatherName, { width: 255 })
  s.text(page1, 452, 425, dmy(personal.dateOfBirth))
  const gender: Record<string, Range> = { MALE: [170, 193], FEMALE: [202, 237], TRANSGENDER: [245, 303] }
  if (personal.gender) s.circle(page1, gender[personal.gender]!, [447, 459])
  const marital: Record<string, Range> = { SINGLE: [461, 490], MARRIED: [498, 534] }
  if (personal.maritalStatus) {
    s.circle(page1, marital[personal.maritalStatus] ?? [543, 570], [447, 459])
    if (!marital[personal.maritalStatus]) s.text(page1, 530, 470, MARITAL[personal.maritalStatus], { size: 6.5 })
  }
  s.text(page1, 128, 488, personal.spouseName, { width: 250 })
  s.text(page1, 468, 488, dmy(personal.marriageDate))
  s.text(page1, 134, 524, countryName(personal.countryOfOrigin), { width: 245 })
  s.text(page1, 445, 524, countryName(personal.nationality), { width: 127 })
  s.text(page1, 82, 556, personal.category ? CATEGORY[personal.category] : '', { width: 295 })
  s.text(page1, 431, 556, personal.religion, { width: 141 })
  s.text(page1, 86, 587, personal.heightCm ? `${personal.heightCm} cm` : '')
  s.text(page1, 426, 587, personal.weightKg ? `${personal.weightKg} kg` : '')
  s.yesNo(page1, personal.isPhysicallyDisabled, [170, 186], [195, 208], [610, 621])
  if (personal.isPhysicallyDisabled) {
    s.text(page1, 216, 619, join([personal.disabilityType, personal.disabilityPercent !== undefined ? `${personal.disabilityPercent}%` : null]), { width: 160, size: 7.5 })
  }
  s.text(page1, 451, 619, personal.bloodGroup ? BLOOD[personal.bloodGroup] : '')
  s.text(page1, 142, 651, personal.identificationMark, { width: 430 })
  s.text(page1, 136, 679, p.email, { width: 242 })
  s.text(page1, 444, 679, p.mobile)
  s.text(page1, 111, 714, p.passport?.number, { width: 265 })
  s.text(page1, 468, 714, p.drivingLicence?.number, { width: 104 })

  // page 2: 3. Address details, 4. Statutory / compliance details, 5. Bank details
  const page2 = PAGE.JF2
  const address = (a: Address | undefined, [line1, line2, line3]: [number, number, number]) => {
    if (!a) return
    s.text(page2, 220, line1, a.houseNo, { width: 143 })
    s.text(page2, 410, line1, a.locality, { width: 98 })
    s.text(page2, 146, line2, a.cityOrVillage, { width: 122 })
    s.text(page2, 300, line2, a.district, { width: 117 })
    s.text(page2, 452, line2, a.state, { width: 116 })
    s.text(page2, 190, line3, countryName(a.countryCode ?? 'IN'), { width: 157 })
    s.text(page2, 374, line3, a.postalCode, { width: 90 })
  }
  address(p.present, [114, 147, 181])
  address(p.permanent, [235, 269, 302])
  s.text(page2, 135, 400, p.pan?.number, { width: 180 })
  s.text(page2, 388, 399, groupedAadhaar(p.aadhaar?.number), { width: 184 })
  s.text(page2, 95, 432, p.statutory.uan, { width: 220 })
  s.text(page2, 371, 432, p.statutory.esicIpNumber, { width: 200 })
  const nominee = p.nominees.find((n) => n.scheme === 'GENERAL')
  s.text(page2, 135, 465, nominee?.name, { width: 180 })
  s.text(page2, 408, 465, nominee?.relationship, { width: 164 })
  const bank = p.form.bankAccount
  if (bank) {
    s.text(page2, 108, 548, bank.bankName, { width: 236 })
    s.text(page2, 392, 548, bank.branch, { width: 180 })
    s.text(page2, 163, 580, bank.accountHolderName, { width: 182 })
    s.text(page2, 426, 580, bank.accountNumber, { width: 146 })
    s.text(page2, 104, 611, bank.ifsc, { width: 240 })
    s.circle(page2, bank.accountType === 'SAVINGS' ? [456, 492] : [500, 537], [601, 613])
  }

  // page 3: 6. Educational qualification, 7. Additional certification, 8. Previous employment
  const page3 = PAGE.JF3
  s.table(
    page3,
    [43, 139, 289, 399, 504, 574],
    [113, 144, 176, 208, 240],
    31,
    (p.form.qualifications ?? []).map((q) => [q.qualification, q.institute, q.yearOfPassing, q.specialization, q.score]),
    '6. Educational qualification (continued): qualification | institute | year | specialization | % / CGPA',
  )
  s.table(
    page3,
    [43, 163, 311, 397, 500, 574],
    [355, 387],
    32,
    (p.form.certifications ?? []).map((c) => [c.name, c.issuedBy, dmy(c.certifiedOn), c.specialization, c.score]),
    '7. Additional certification (continued): name | issued by | date | specialization | grade / score',
  )
  s.table(
    page3,
    [43, 151, 196, 307, 390, 466, 574],
    [489, 521, 553, 584, 616, 648, 679, 717],
    31,
    (p.form.previousJobs ?? []).map((j) => [j.employerName, '', j.designation, dmy(j.fromDate), dmy(j.toDate), j.reasonForLeaving]),
    '8. Previous employment (continued): employer | - | designation | from | to | reason for leaving',
  )

  // page 4: 6. Family details, 9. Emergency contact
  const page4 = PAGE.JF4
  s.table(
    page4,
    [43, 74, 178, 205, 269, 326, 425, 510, 572],
    [118, 150, 182, 214, 245],
    31,
    p.family.map((m, i) => [
      i + 1,
      m.name,
      yearsOld(m.dateOfBirth),
      m.gender ? GENDER[m.gender] : '',
      dmy(m.dateOfBirth),
      groupedAadhaar(m.aadhaar),
      m.preExistingDisease,
      RELATION[m.relationship],
    ]),
    'Family details (continued): no. | name | age | gender | date of birth | Aadhaar | pre-existing disease | relation',
    7.5,
  )
  const contact = p.emergency
  if (contact) {
    s.text(page4, 82, 342, contact.name, { width: 218 })
    s.text(page4, 375, 342, contact.relationship, { width: 196 })
    s.text(page4, 104, 373, contact.mobile)
    s.text(page4, 418, 373, contact.alternateMobile)
    s.text(page4, 92, 405, contact.address, { width: 478 })
  }
}

// --- Gratuity FORM 'F' - Nomination (pages 5-6) ---
function formF(s: Sheet, p: Facts) {
  const page = PAGE.FORM_F1
  const { personal } = p
  s.text(page, 106, 159, p.employer, { width: 416, size: 8.5 })
  // Shri / Shrimati / Kumari
  if (personal.gender === 'MALE') s.circle(page, [107, 131], [202, 214])
  else if (p.female) s.circle(page, personal.maritalStatus && personal.maritalStatus !== 'SINGLE' && personal.maritalStatus !== 'DIVORCED' ? [137, 183] : [190, 229], [202, 214])
  s.text(page, 231, 211, p.name, { width: 78, size: 8.5 })
  // 2. family members nominated / 3. no family - the one that applies is ticked, the other struck through
  const certifyLines = [325, 338, 351]
  const noFamilyLines = [377, 390]
  if (p.noFamily === false) {
    s.tick(page, 80, 324)
    s.strike(page, 126, 525, ...noFamilyLines)
  } else if (p.noFamily === true) {
    s.tick(page, 80, 376)
    s.strike(page, 126, 525, ...certifyLines)
  }
  // 4(a) parents not dependent, 4(b) husband's parents not dependent (a married woman), 5. husband excluded
  const { gratuityParentsNotDependent, gratuityHusbandsParentsNotDependent, gratuityHusbandExcludedOn } = p.gratuity
  if (gratuityParentsNotDependent === true) s.tick(page, 80, 415)
  if (gratuityParentsNotDependent === false) s.strike(page, 162, 470, 416)
  if (gratuityHusbandsParentsNotDependent === true) s.tick(page, 80, 441)
  else if (gratuityParentsNotDependent !== undefined) s.strike(page, 125, 525, 442, 455)
  if (gratuityHusbandExcludedOn) {
    s.tick(page, 80, 467)
    s.text(page, 485, 469, dmy(gratuityHusbandExcludedOn), { width: 27, size: 6.5 })
  } else if (gratuityParentsNotDependent !== undefined) s.strike(page, 110, 525, 468, 481, 494)
  // Nominee(s): name, relationship, age, share; their full addresses under the table
  const nominees = p.nominees.filter((n) => n.scheme === 'GRATUITY')
  const rows = [625, 638, 652, 665]
  nominees.slice(0, rows.length).forEach((n, i) => {
    const y = rows[i]!
    s.text(page, i === 3 ? 164 : 142, y, n.name, { width: i === 3 ? 56 : 78, size: 7.5 })
    s.text(page, 226, y, n.relationship, { width: 96, size: 7.5 })
    s.text(page, 330, y, yearsOld(n.dateOfBirth), { size: 7.5 })
    s.text(page, 430, y, n.sharePercent !== undefined ? `${n.sharePercent}%` : '', { size: 7.5 })
  })
  let y = 688
  if (nominees.length) {
    s.text(page, 126, y, 'Full address of nominee(s):', { size: 7.5, bold: true })
    nominees.slice(0, rows.length).forEach((n, i) => {
      y += 11
      s.text(page, 126, y, `${i + 1}. ${n.name}: ${n.address ?? ''}`, { width: 395, size: 7.5 })
    })
    // a minor nominee's guardian (2026-11-20 - the form has no column for it)
    nominees.slice(0, rows.length).forEach((n) => {
      if (!n.guardianName) return
      y += 11
      s.text(page, 126, y, `Guardian of ${n.name} (minor): ${n.guardianName}, ${n.guardianAddress ?? ''}`, { width: 395, size: 7.5 })
    })
  }
  if (nominees.length > rows.length) {
    s.more.push({
      heading: "Gratuity Form 'F' - nominee(s) (continued): name | relationship | age | proportion | full address",
      lines: nominees
        .slice(rows.length)
        .map((n) => join([n.name, n.relationship, yearsOld(n.dateOfBirth), n.sharePercent !== undefined ? `${n.sharePercent}%` : '', n.address, n.guardianName && `guardian: ${n.guardianName}, ${n.guardianAddress ?? ''}`], ' | ')),
    })
  }

  // Statement
  const page2 = PAGE.FORM_F2
  s.text(page2, 292, 109, p.name, { width: 230 })
  s.text(page2, 185, 122, personal.gender ? GENDER[personal.gender] : '')
  s.text(page2, 207, 135, personal.religion, { width: 300 })
  const marital = personal.maritalStatus
  const maritalAt: Range | undefined =
    marital === 'SINGLE' || marital === 'DIVORCED'
      ? [198, 255]
      : marital === 'MARRIED' || marital === 'SEPARATED'
        ? [262, 304]
        : marital === 'WIDOWED'
          ? p.female
            ? [311, 344]
            : [351, 395]
          : undefined
  if (maritalAt) s.circle(page2, maritalAt, [138, 149])
  s.text(page2, 410, 161, p.candidate.department?.name, { width: 112 })
  s.text(page2, 383, 174, p.candidate.designation.name, { width: 140 })
  s.text(page2, 274, 187, dmy(p.joiningDate))
  s.text(page2, 268, 200, addressLine(p.permanent), { width: 256, size: 8 })
  s.text(page2, 125, 223, p.permanent?.cityOrVillage, { width: 66, size: 7.5 })
  s.text(page2, 234, 223, p.permanent?.policeStation, { width: 74, size: 7.5 })
  s.text(page2, 382, 223, p.permanent?.subDivision, { width: 63, size: 7.5 })
  s.text(page2, 447, 236, p.permanent?.postOffice, { width: 78, size: 7.5 })
  s.text(page2, 120, 251, p.place, { width: 200 })
}

// --- ESIC Form 1 - Declaration form (page 7; 540 x 900) ---
function esicForm1(s: Sheet, p: Facts) {
  const page = PAGE.ESIC
  const { personal, statutory } = p
  s.text(page, 123, 141, statutory.esicIpNumber, { width: 142 })
  s.text(page, 123, 166, p.name.toUpperCase(), { width: 142 })
  s.text(page, 123, 194, p.female && p.married && personal.spouseName ? personal.spouseName : personal.fatherName, { width: 142 })
  const birth = personal.dateOfBirth
  if (birth) {
    s.text(page, 122, 264, two(birth.getUTCDate()), { size: 7.5 })
    s.text(page, 145, 264, two(birth.getUTCMonth() + 1), { size: 7.5 })
    s.text(page, 168, 264, birth.getUTCFullYear(), { size: 7.5 })
  }
  // 5. marital status M / U / W, 6. sex M / F
  const maritalAt: Range | undefined = p.married ? [234, 242.5] : personal.maritalStatus === 'WIDOWED' ? [254, 263] : personal.maritalStatus ? [245, 251.5] : undefined
  if (maritalAt) s.circle(page, maritalAt, [239.5, 246])
  if (personal.gender === 'MALE') s.circle(page, [253, 259], [254, 260])
  if (personal.gender === 'FEMALE') s.circle(page, [262, 266], [254, 260])
  // 7. present / 8. permanent address, PIN in the boxes, phone
  const address = (a: Address | undefined, x: number, pinBoxes: number[], phoneX: number, phoneWidth: number) => {
    if (!a) return
    s.text(page, x, 291, addressLine(a, false), { width: 120, lines: 3, size: 6.5 })
    const pin = (a.postalCode ?? '').replace(/\s/g, '')
    if (pin.length <= pinBoxes.length) pinBoxes.forEach((boxX, i) => s.text(page, boxX + 3.5, 326.5, pin[i], { size: 7 }))
    else s.text(page, pinBoxes[0]!, 326.5, pin, { width: 80, size: 6.5 })
    s.text(page, phoneX, 342, p.mobile, { width: phoneWidth, size: 6 })
  }
  address(p.present, 22, [56, 69, 83, 96, 109, 122], 104, 40)
  address(p.permanent, 150, [186, 199, 212, 225, 239, 252], 231, 37)
  s.text(page, 68, 368, statutory.esicBranchOffice, { width: 75, size: 6.5 })
  s.text(page, 200, 368, statutory.esicDispensary, { width: 67, size: 6.5 })
  // (B) employer: 9. code, 10. date of appointment, 11. name and address
  s.text(page, 372, 148, p.candidate.company.esicEmployerCode, { width: 146, size: 8 })
  if (p.joiningDate) {
    s.text(page, 410, 186, two(p.joiningDate.getUTCDate()), { size: 8 })
    s.text(page, 450, 186, two(p.joiningDate.getUTCMonth() + 1), { size: 8 })
    s.text(page, 490, 186, p.joiningDate.getUTCFullYear(), { size: 8 })
  }
  s.text(page, 284, 211, p.employer, { width: 234, lines: 3, size: 7 })
  // 12. previous employment
  s.text(page, 372, 287, statutory.previousEsicIpNumber, { width: 146, size: 8 })
  s.text(page, 375, 314, statutory.previousEmployerCode, { width: 143, size: 8 })
  s.text(page, 418, 330, join([statutory.previousEmployerName, statutory.previousEmployerAddress]), { width: 101, lines: 2, size: 6.5 })
  s.text(page, 418, 363, statutory.previousEmployerContact, { width: 101, size: 6.5 })
  // (c) nominee
  const nominee = p.nominees.find((n) => n.scheme === 'ESIC')
  if (nominee) {
    s.text(page, 22, 431, nominee.name, { width: 145, size: 8 })
    s.text(page, 172, 431, nominee.relationship, { width: 141, size: 8 })
    s.text(page, 320, 431, nominee.address, { width: 199, size: 7 })
  }
  // (D) family particulars - the residing yes / no as a tick
  const rowTops = [635, 645, 655, 665, 675, 685]
  p.family.slice(0, rowTops.length).forEach((m, i) => {
    const y = rowTops[i]! + 7.8
    s.text(page, 30, y, i + 1, { size: 6.5 })
    s.text(page, 54, y, m.name, { width: 94, size: 6.5 })
    s.text(page, 154, y, join([dmy(m.dateOfBirth), m.dateOfBirth ? `(${yearsOld(m.dateOfBirth)} yrs)` : null], ' '), { width: 85, size: 6.5 })
    s.text(page, 245, y, RELATION[m.relationship], { width: 88, size: 6.5 })
    if (m.livesWithEmployee === true) s.tick(page, 358, y - 2.5, 5)
    if (m.livesWithEmployee === false) s.tick(page, 404, y - 2.5, 5)
    s.text(page, 431, y, m.residenceTown, { width: 47, size: 6.5 })
    s.text(page, 483, y, m.residenceState, { width: 37, size: 6.5 })
  })
  if (p.family.length > rowTops.length) {
    s.more.push({
      heading: 'ESIC Form 1 - family particulars (continued): name | date of birth | relationship | residing with the employee | town | state',
      lines: p.family
        .slice(rowTops.length)
        .map((m) => join([m.name, dmy(m.dateOfBirth), RELATION[m.relationship], m.livesWithEmployee === undefined ? '' : m.livesWithEmployee ? 'Yes' : 'No', m.residenceTown, m.residenceState], ' | ')),
    })
  }
}

// --- EPF New Form 11 - Declaration form (page 8) ---
function epfForm11(s: Sheet, p: Facts) {
  const page = PAGE.EPF
  const { personal, statutory } = p
  const x = 318
  const width = 218
  s.text(page, x, 115, p.aadhaar?.nameOnDocument ?? p.name, { width })
  // 2. father's or spouse's name, its box ticked
  const spouse = statutory.epfRelative === 'SPOUSE'
  s.tick(page, spouse ? 248 : 160, 125.5, 6)
  s.text(page, x, 135, spouse ? personal.spouseName : personal.fatherName, { width })
  s.text(page, x, 152, dmy(personal.dateOfBirth))
  s.text(page, x, 166, personal.gender ? GENDER[personal.gender] : '')
  const marital = personal.maritalStatus
  s.text(page, x, 181, marital === 'WIDOWED' ? (p.female ? 'Widow' : 'Widower') : marital === 'DIVORCED' ? 'Divorcee' : marital ? MARITAL[marital] : '')
  s.text(page, x, 196, p.email, { width })
  s.text(page, x, 211, statutory.aadhaarMobile ?? p.mobile)
  // 7. / 8. earlier EPF / EPS member
  s.yesNo(page, statutory.wasEpfMember, [411, 424], [431, 444], [222, 231])
  s.yesNo(page, statutory.wasEpsMember, [411, 424], [431, 444], [245, 254])
  // 9. previous employment
  s.text(page, x, 286, statutory.uan, { width })
  s.text(page, x, 301, statutory.previousPfNumber, { width })
  s.text(page, x, 318, dmy(statutory.previousExitDate))
  s.text(page, x, 333, statutory.schemeCertificateNumber, { width })
  s.text(page, x, 348, statutory.ppoNumber, { width })
  // 10. international worker
  s.yesNo(page, statutory.isInternationalWorker, [411, 424], [431, 444], [354, 363])
  if (statutory.isInternationalWorker) {
    s.text(page, x, 377, countryName(personal.countryOfOrigin ?? personal.nationality), { width })
    s.text(page, x, 392, p.passport?.number, { width })
    s.text(page, x, 407, p.passport?.validFrom || p.passport?.validUntil ? `${dmy(p.passport.validFrom)} to ${dmy(p.passport.validUntil)}` : '', { width })
  }
  // 11. KYC
  const bank = p.form.bankAccount
  s.text(page, x, 441, bank ? join([bank.accountNumber, bank.ifsc], ' / ') : '', { width })
  s.text(page, x, 456, groupedAadhaar(p.aadhaar?.number), { width })
  s.text(page, x, 471, p.pan?.number, { width })
  // 12. first EPF membership, withdrawals
  s.text(page, 99, 520, dmy(statutory.firstEpfEnrolledOn), { width: 64, size: 7.5 })
  s.text(page, 170, 520, rupees(statutory.firstEpfWages), { width: 68, size: 7.5 })
  s.yesNo(page, statutory.isEpfMemberBeforeSep2014, [263, 276], [282, 291], [512, 521])
  s.yesNo(page, statutory.epfWithdrawn, [336, 349], [355, 364], [512, 521])
  s.yesNo(page, statutory.epsWithdrawn, [409, 422], [428, 437], [512, 521])
  s.yesNo(page, statutory.epsWithdrawnAfterSep2014, [486, 499], [505, 514], [512, 521])
  s.text(page, 102, 611, p.place, { width: 200 })
}

// --- Employee Medical Information (pages 9-10; 595 x 842) ---
function medicalPages(s: Sheet, p: Facts) {
  const m = p.form.medical
  const page = PAGE.MED1
  const page2 = PAGE.MED2
  // the emergency contact and the name are printed even without the medical answers
  const contact = p.emergency
  if (contact) s.text(page2, 199, 76, join([contact.name, contact.relationship && `(${contact.relationship})`, contact.mobile], ' '), { width: 330 })
  s.text(page2, 170, 529, p.name, { width: 300 })
  if (!m) return
  const boxes: Record<string, [number, number]> = {
    ASTHMA: [131, 137],
    DIABETES: [244.5, 137],
    HEART_DISEASE: [329.6, 137],
    HIGH_BLOOD_PRESSURE: [452.6, 137],
    EPILEPSY: [161.4, 154.5],
    MENTAL_HEALTH: [308.3, 178.8],
  }
  for (const condition of m.conditions ?? []) {
    const at = boxes[condition]
    if (at) s.tick(page, ...at)
  }
  s.text(page, 165, 204, m.allergies, { width: 102, size: 8 })
  s.text(page, 345, 204, m.otherConditions, { width: 190, size: 8 })
  s.tickYesNo(page, m.takesMedication, [115.2, 257.5], [155.2, 257.5])
  s.text(page, 254, 263, m.medications, { width: 285, size: 8 })
  s.tickYesNo(page, m.hasPhysicalLimitations, [117.6, 312.2], [157.2, 312.2])
  s.text(page, 254, 317, m.physicalLimitations, { width: 285, size: 8 })
  s.tickYesNo(page, m.hadSurgery, [117.6, 351.8], [155.3, 351.8])
  s.text(page, 303, 357, m.surgeries, { width: 236, size: 8 })
  s.tickYesNo(page, m.hasAllergies, [117.6, 391.2], [157.2, 391.2])
  s.text(page, 272, 396, m.allergies, { width: 267, size: 8 })
  const { heightCm, weightKg } = p.personal
  s.text(page, 170, 418, weightKg ? `${weightKg} kg` : '', { width: 56 })
  s.text(page, 276, 418, heightCm ? `${heightCm} cm` : '', { width: 80 })
  s.text(page, 398, 418, heightCm && weightKg ? (weightKg / (heightCm / 100) ** 2).toFixed(1) : '')
  // family history: the condition ticked, who has it in the "Family member(s)" column
  const family: [string | undefined, number][] = [
    [m.familyHeartDisease, 511],
    [m.familyDiabetes, 525],
    [m.familyHighBloodPressure, 539.5],
    [m.familyCancer, 554.6],
    [m.familyStroke, 572.4],
    [m.familyMentalHealth, 587.5],
    [m.familyGeneticDisorders, 605.4],
    [m.familyOther, 621.4],
  ]
  for (const [who, y] of family) {
    if (!who) continue
    s.tick(page, 62.4, y - 0.5, 3.6)
    s.text(page, 244, y + 3, who, { width: 300, size: 8 })
  }
  s.tickYesNo(page, m.hasHereditaryCondition, [104.2, 700.7], [143.6, 700.7])
  s.text(page, 261, 706, m.hereditaryCondition, { width: 280, size: 8 })
  s.tickYesNo(page, m.needsHealthLeave, [104.2, 760.6], [143.4, 760.6])
  s.text(page, 260, 766, m.healthLeave, { width: 280, size: 8 })

  s.tickYesNo(page2, m.smokes, [104.2, 144.5], [144, 144.5])
  s.tickYesNo(page2, m.drinksAlcohol, [104.2, 196.6], [144, 196.6])
  s.tickYesNo(page2, m.exercisesRegularly, [104.2, 248.6], [144, 248.6])
  s.text(page2, 204, 268, m.exerciseFrequency, { width: 330, size: 8 })
  s.tickYesNo(page2, m.needsEmergencyCare, [104.2, 346.8], [144, 346.8])
  s.text(page2, 186, 366, m.emergencyCare, { width: 350, size: 8 })
  const sports: Record<string, [number, number]> = {
    TENNIS: [93.2, 427.6],
    PADDLE_BALL: [157.2, 427.6],
    BADMINTON: [220.5, 427.6],
    FOOTBALL: [275.6, 427.6],
    BASKETBALL: [341, 427.6],
    OTHER: [385.2, 427.6],
  }
  for (const sport of m.sports ?? []) {
    const at = sports[sport]
    if (at) s.tick(page2, ...at)
  }
  s.text(page2, 395, 433, m.otherSports, { width: 145, size: 8 })
  s.text(page2, 117, 466, m.sportsFrequency, { width: 300, size: 8 })
}
