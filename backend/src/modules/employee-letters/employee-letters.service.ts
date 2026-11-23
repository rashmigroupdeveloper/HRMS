import { createHash } from 'node:crypto'
import { prisma, SYSTEM_ACTOR, type ActorId, type DbClient } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { copyFile, deleteFile, readStoredFile, saveFile } from '#core/storage/file-storage'
import { employeesSchemas, employeesService } from '#modules/employees'
import { letterTemplatesService } from '#modules/letter-templates'
import { companiesService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as lettersRepository from './employee-letters.repository.js'
import type { EmployeeLetterKind, writeEmployeeLetterInput } from './employee-letters.schema.js'

// Letters issued to an employee (2026-11-16): appointment, confirmation, experience, relieving, salary certificate. HR picks a template
// (wording + letterhead, Letter templates page), previews the PDF filled with the employee's details and issues it: it gets a
// number of its own series (RML/APPT/2026/0001...), is kept exactly as issued (employees/<code>/<kind>/...) and e-mailed
// to the employee. The appointment letter is issued automatically on the joining day (issueAppointmentOnJoining).
// Seeing others' letters: "Employee · Documents & letters" View; issuing: its Edit (the router); one's own: always.

const KIND_NAME: Record<EmployeeLetterKind, string> = {
  APPOINTMENT_LETTER: 'Appointment letter',
  CONFIRMATION_LETTER: 'Confirmation letter',
  EXPERIENCE_LETTER: 'Experience letter',
  RELIEVING_LETTER: 'Relieving letter',
  SALARY_CERTIFICATE: 'Salary certificate',
}
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const fileNameOf = (kind: EmployeeLetterKind, number: string) => `${KIND_NAME[kind]} ${number.replace(/\//g, '-')}.pdf`
const pdfFile = (bytes: Uint8Array, name: string) => new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })

type Details = Awaited<ReturnType<typeof employeesService.getForLetter>>
type WriteInput = z.infer<typeof writeEmployeeLetterInput>

// What the kind of letter needs before it can be written
function checkCanWrite(kind: EmployeeLetterKind, details: Details, lastWorkingDay: Date | undefined) {
  const e = details.employee
  if (kind === 'CONFIRMATION_LETTER' && !e.confirmationDate) {
    throw new ORPCError('BAD_REQUEST', { message: 'Set the confirmation date first ("Edit details" on the profile)' })
  }
  if (kind === 'EXPERIENCE_LETTER' || kind === 'RELIEVING_LETTER') {
    if (!lastWorkingDay) throw new ORPCError('BAD_REQUEST', { message: 'Give the last working day' })
    if (lastWorkingDay < e.dateOfJoining) throw new ORPCError('BAD_REQUEST', { message: 'The last working day cannot be before the date of joining' })
  }
  if ((kind === 'APPOINTMENT_LETTER' || kind === 'SALARY_CERTIFICATE') && !details.salary) {
    throw new ORPCError('BAD_REQUEST', { message: `This employee has no salary recorded - ${kind === 'SALARY_CERTIFICATE' ? 'a salary certificate' : 'an appointment letter'} states it` })
  }
}

// The letter PDF: the template filled with the employee's details
async function writePdf(kind: EmployeeLetterKind, templateId: number, details: Details, letterNumber: string, letterDate: Date, lastWorkingDay: Date | undefined) {
  const { money, monthsInWords, letterDate: inWords, ctcTable } = letterTemplatesService
  const e = details.employee
  const s = details.salary
  const salutation = e.salutation ? employeesSchemas.SALUTATION_LABEL[e.salutation] : undefined
  return letterTemplatesService.writeLetter({
    templateId,
    kind,
    title: `${KIND_NAME[kind]} ${letterNumber}`,
    values: {
      letter_number: letterNumber,
      letter_date: inWords(letterDate),
      salutation,
      name: details.name,
      first_name: e.firstName,
      employee_code: e.employeeCode,
      address: details.address,
      company: e.company.name,
      designation: e.designation?.name,
      department: e.department?.name,
      grade: e.grade?.name,
      location: e.workLocation?.name,
      employment_type: employeesSchemas.EMPLOYMENT_TYPE_LABEL[e.employmentType],
      joining_date: inWords(e.dateOfJoining),
      probation_end_date: inWords(e.probationEndDate),
      contract_end_date: inWords(e.contractEndDate),
      confirmation_date: inWords(e.confirmationDate),
      last_working_day: inWords(lastWorkingDay),
      notice_probation: monthsInWords(e.noticeMonthsProbation),
      notice_confirmed: monthsInWords(e.noticeMonthsConfirmed),
      annual_ctc: s ? money(s.annualCtc, s.currency) : undefined,
      monthly_ctc: s ? money(s.annualCtc / 12, s.currency) : undefined,
      performance_pay: s?.performancePayAnnual ? money(s.performancePayAnnual, s.currency) : undefined,
      total_ctc: s ? money(s.annualCtc + (s.performancePayAnnual ?? 0), s.currency) : undefined,
    },
    blocks:
      (kind === 'APPOINTMENT_LETTER' || kind === 'SALARY_CERTIFICATE') && s?.lines.length
        ? {
            ctc_table: ctcTable({
              name: [salutation, details.name].filter(Boolean).join(' '),
              designation: e.designation?.name ?? '',
              currency: s.currency,
              lines: s.lines.map((l) => ({ name: l.salaryComponent.name, kind: l.salaryComponent.kind, monthlyAmount: l.monthlyAmount })),
              performancePayAnnual: s.performancePayAnnual,
            }),
          }
        : {},
  })
}

// Writing a letter for an employee: "Employee · Documents & letters" Edit covering where they are (data access, 2026-11-18)
async function assertMayWrite(viewer: CurrentUser, employeeCode: string) {
  employeesService.assertPart(viewer, await employeesService.getEmployeeFor(viewer, employeeCode), 'EMPLOYEE_DOCUMENTS', 'WRITE')
}

// The templates of this kind HR can pick for the employee, and the one to pre-select (for their joining type)
export async function templatesFor(viewer: CurrentUser, employeeCode: string, kind: EmployeeLetterKind) {
  await assertMayWrite(viewer, employeeCode)
  return templatesOf(employeeCode, kind)
}
async function templatesOf(employeeCode: string, kind: EmployeeLetterKind) {
  const { employee } = await employeesService.getForLetter(employeeCode)
  return letterTemplatesService.listTemplatesToSend(kind, employee.joiningType)
}

// The letter as it would be issued now (the number is given when it is issued)
export async function previewLetter({ employeeCode, kind, templateId, letterDate, lastWorkingDay }: WriteInput, viewer: CurrentUser) {
  await assertMayWrite(viewer, employeeCode)
  const details = await employeesService.getForLetter(employeeCode)
  checkCanWrite(kind, details, lastWorkingDay)
  const pdf = await writePdf(kind, templateId, details, '(given when issued)', letterDate ?? today(), lastWorkingDay)
  return pdfFile(pdf, `${KIND_NAME[kind]} (preview).pdf`)
}

// Issues the letter: numbered, stored, recorded, then e-mailed to the employee (work e-mail, else personal)
export async function issueLetter(input: WriteInput, viewer: CurrentUser) {
  await assertMayWrite(viewer, input.employeeCode)
  return issue(input, viewer.employeeId)
}
// a company transfer (2026-11-20): the employee's files move to the folder of their new code. Each file is copied and its
// row pointed at the copy, inside the caller's transaction; the caller deletes the old files once the transaction is
// saved (oldKeys) - or the copies if it fails (newKeys). A file missing on disk keeps its key (it cannot be copied).
export async function moveFilesToCode(employeeId: number, employeeCode: string, actorId: ActorId, tx: DbClient) {
  const moved = { oldKeys: [] as string[], newKeys: [] as string[] }
  for (const row of await lettersRepository.listFiles(employeeId, tx)) {
    let key: string
    try {
      key = await copyFile(row.storageKey, { area: 'employees', owner: [employeeCode], what: row.kind }, { type: 'application/pdf' })
    } catch (error) {
      console.error(`[letters] ${row.storageKey} could not be copied to the new folder - it keeps its key:`, error)
      continue
    }
    moved.newKeys.push(key)
    moved.oldKeys.push(row.storageKey)
    await lettersRepository.updateStorageKey(row.id, key, actorId, tx)
  }
  return moved
}

// (also the joining day's appointment letter, by System)
async function issue({ employeeCode, kind, templateId, letterDate, lastWorkingDay }: WriteInput, actorId: ActorId) {
  const details = await employeesService.getForLetter(employeeCode)
  checkCanWrite(kind, details, lastWorkingDay)
  const e = details.employee
  let storageKey: string | undefined
  let saved
  try {
    saved = await prisma.$transaction(
      async (tx) => {
        const company = await companiesService.getCompany(e.company.id, tx)
        const letterNumber = await letterTemplatesService.nextLetterNumber(company, kind, actorId, tx)
        const date = letterDate ?? today()
        const pdf = new Uint8Array(await writePdf(kind, templateId, details, letterNumber, date, lastWorkingDay))
        storageKey = await saveFile({ area: 'employees', owner: [e.employeeCode], what: kind }, 'application/pdf', pdf)
        const letter = await lettersRepository.create(
          {
            employeeId: e.id,
            kind,
            letterTemplateId: templateId,
            letterNumber,
            letterDate: date,
            lastWorkingDay: lastWorkingDay ?? null,
            storageKey,
            sha256: sha256(pdf),
            issuedAt: new Date(),
            issuedById: actorId,
          },
          actorId,
          tx,
        )
        return { letter, pdf }
      },
      { timeout: 30_000 },
    )
  } catch (error) {
    // the letter's row rolled back -> no orphan file. Only here: once saved, the row points at the file, so a step
    // failing after it (recording the e-mail) never deletes it (2026-11-23, the review)
    if (storageKey) await deleteFile(storageKey).catch(() => undefined)
    throw error
  }
  const { letter, pdf } = saved
  const emailedTo = await emailLetter(details, kind, letter.letterNumber, pdf)
  if (emailedTo) await lettersRepository.setEmailedTo(letter.id, emailedTo, actorId)
  return { ...letter, emailedTo }
}

// E-mails the letter as an attachment; returns where it went, or null (no address, or the e-mail failed - logged)
async function emailLetter(details: Details, kind: EmployeeLetterKind, letterNumber: string, pdf: Uint8Array) {
  const e = details.employee
  const to = e.workEmail ?? e.personalEmail
  if (!to) return null
  try {
    const result = await sendMail({
      to,
      subject: `${KIND_NAME[kind]} - ${e.company.name}`,
      text: [`Dear ${details.name},`, '', `Please find attached your ${KIND_NAME[kind].toLowerCase()} (${letterNumber}).`, '', 'You can also see it in HRMS under My profile > Letters.'].join('\n'),
      attachments: [{ filename: fileNameOf(kind, letterNumber), content: Buffer.from(pdf), contentType: 'application/pdf' }],
    })
    // no mail server (only saved in the outbox folder): not e-mailed - the letter is not marked as sent (2026-11-23)
    return result === 'SAVED_TO_OUTBOX' ? null : to
  } catch (error) {
    console.error(`[mail] ${kind} ${letterNumber} to ${e.employeeCode} failed:`, error)
    return null
  }
}

// The joining day: issues the appointment letter from the template for the employee's joining type - never stops the
// joining: without a ready template (or with a missing detail) it says why and HR issues it from the profile later.
export async function issueAppointmentOnJoining(employeeCode: string, actorId: ActorId = SYSTEM_ACTOR) {
  try {
    const { suggestedId } = await templatesOf(employeeCode, 'APPOINTMENT_LETTER')
    if (!suggestedId) return { issued: false as const, reason: 'No ready appointment letter template (Letter templates page) - issue it from the profile later' }
    const letter = await issue({ employeeCode, kind: 'APPOINTMENT_LETTER', templateId: suggestedId }, actorId)
    return { issued: true as const, letterNumber: letter.letterNumber, emailedTo: letter.emailedTo }
  } catch (error) {
    return { issued: false as const, reason: error instanceof Error ? error.message : String(error) }
  }
}

// The employee's letters, newest first (own, or "Employee · Documents & letters" View)
export async function listLetters(viewer: CurrentUser, employeeCode: string) {
  const employee = await employeesService.getEmployeeFor(viewer, employeeCode)
  employeesService.assertPart(viewer, employee, 'EMPLOYEE_DOCUMENTS')
  const rows = await lettersRepository.listByEmployee(employee.id)
  const person = await employeesService.lookupPeople(rows.map((r) => r.issuedById))
  return rows.map(({ issuedById, ...row }) => ({ ...row, issuedBy: person(issuedById) }))
}

// The letter's PDF exactly as issued
export async function downloadLetter(viewer: CurrentUser, id: number) {
  const letter = await lettersRepository.findById(id)
  if (!letter) throw new ORPCError('NOT_FOUND', { message: `No letter found with id ${id}` })
  employeesService.assertPart(viewer, letter.employee, 'EMPLOYEE_DOCUMENTS')
  return pdfFile(await readStoredFile(letter.storageKey), fileNameOf(letter.kind as EmployeeLetterKind, letter.letterNumber))
}
