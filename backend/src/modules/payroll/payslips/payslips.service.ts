import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { assertWholeSlice, levelOver } from '#core/auth/scope'
import { env } from '#core/config/env'
import { SYSTEM_ACTOR, type ActorId, type DbClient } from '#core/db/prisma'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { copyFile, deleteFile, readStoredFile, saveFile } from '#core/storage/file-storage'
import { employeesService } from '#modules/employees'
import { leaveBalancesService } from '#modules/leave'
import { letterTemplatesService } from '#modules/letter-templates'
import { companiesService } from '#modules/organization'
import { today } from '#shared/utils/dates'
import * as peopleService from '../people/people.service.js'
import * as payslipsRepository from './payslips.repository.js'
import type { PayslipInput, PreviewInput, ReleaseInput } from './payslips.schema.js'

// Payroll stage 6 (approved by the user 2026-11-27): payslips. Once a run is FINALISED, someone with Payroll Edit over the
// whole company releases its payslips with a payslip template (Letter templates); the background job (payroll.jobs.ts)
// then makes each person's PDF from the run's own copy and lines and the employee's records, stores it and e-mails the
// employee a link - no attachment: it shows the full bank account number and PAN (the user's choice). A payslip made is
// never changed. The employee sees their own in self-service; viewers with Payroll and Salary View over the whole
// company see anyone's of that company (a payslip is all salary figures).

const companySlice = (companyId: number) => ({ companyId, plantId: null, departmentId: null })
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
// "2026-06": the folder of a month's payslip
const monthKey = (payMonth: Date) => payMonth.toISOString().slice(0, 7)
const placeOf = (employeeCode: string, payMonth: Date) => ({ area: 'employees', owner: [employeeCode], what: `PAYSLIP-${monthKey(payMonth)}` })
const pdfFile = (bytes: Uint8Array, name: string) => new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })
const fileName = (payMonth: Date, employeeCode: string, preview = false) => `Payslip ${MONTH.format(payMonth)} ${employeeCode}${preview ? ' (preview)' : ''}.pdf`

type Run = { id: number; companyId: number; payMonth: Date; attendanceFrom: Date; attendanceTo: Date }
type FoundRun = Awaited<ReturnType<typeof peopleService.runFor>>
const runOf = (run: FoundRun): Run => ({ id: run.id, companyId: run.company.id, payMonth: run.payMonth, attendanceFrom: run.attendanceFrom, attendanceTo: run.attendanceTo })

// --- What each payslip shows ---

// The payslip of each person of the run (or only those asked for) whose pay is worked out: from the run's own copy (their
// code in the run, the stretch at the period's end) and lines, the days it took from the locked attendance, the
// employee's records (name, designation, bank account and PAN in full...) and their leave in the pay period
export async function payslipsOf(run: Run, personIds?: number[], db?: DbClient) {
  const period = peopleService.payPeriodOf(run)
  const [company, people, rawLines, days] = await Promise.all([
    companiesService.getCompany(run.companyId, db),
    payslipsRepository.listPeople(run.id, personIds, db),
    payslipsRepository.listLines(run.id, personIds, db),
    peopleService.dayTotalsOf(run.id, db),
  ])
  const lines = peopleService.classifiedLines(rawLines)
  const employeeIds = people.map((p) => p.employeeId)
  const [facts, leave] = await Promise.all([
    employeesService.listPayslipFacts(employeeIds, period.to, db),
    leaveBalancesService.periodLeaveOf(employeeIds, period.from, period.to),
  ])
  const factsOf = new Map(facts.map((f) => [f.id, f]))
  const linesOf = new Map<number, typeof lines>()
  for (const line of lines) linesOf.set(line.personId, [...(linesOf.get(line.personId) ?? []), line])
  const periodDays = peopleService.daysIn(period.from, period.to)
  const companyAddress = [company.address, company.postalCode].filter(Boolean).join(' - ') || null
  // India's calendar day (a payslip made at 01:00 in India is dated that day, not the UTC day before)
  const madeOn = today()
  const out = new Map<number, { employeeId: number; employeeCode: string; data: letterTemplatesService.PayslipData }>()
  for (const person of people) {
    const mine = linesOf.get(person.id) ?? []
    // (no pay worked out - no payslip)
    if (!mine.some((l) => l.component.kind === 'EARNING')) continue
    const fact = factsOf.get(person.employeeId)
    if (!fact) continue
    const last = person.segments[0]
    const monthlyOf = new Map((last?.lines ?? []).map((l) => [l.salaryComponentId, l.monthlyAmount.toNumber()]))
    const total = days.get(person.id)
    out.set(person.id, {
      employeeId: person.employeeId,
      employeeCode: person.employeeCode,
      data: {
        company: company.name,
        companyAddress,
        payMonth: run.payMonth,
        payFrom: period.from,
        payTo: period.to,
        name: fact.name,
        employeeCode: person.employeeCode,
        designation: fact.designation,
        department: last?.department.name ?? '-',
        location: last?.workLocation?.name ?? last?.plant.name ?? '-',
        joiningDate: fact.dateOfJoining,
        // (a leaving date after the period is not this month's)
        leavingDate: fact.dateOfLeaving && fact.dateOfLeaving <= period.to ? fact.dateOfLeaving : null,
        periodDays,
        paidDays: total?.paidDays ?? 0,
        unpaidDays: total?.unpaidDays ?? 0,
        bankName: fact.bankName,
        bankAccount: fact.bankAccount,
        pan: fact.pan,
        uan: fact.uan,
        pfNumber: fact.pfNumber,
        esicNumber: fact.esicNumber,
        // the monthly amount of the salary at the period's end - none for a typed input
        earnings: mine.filter((l) => l.component.kind === 'EARNING').map((l) => ({ name: l.component.name, monthly: monthlyOf.get(l.component.id) ?? null, amount: l.amount })),
        // (a deduction worked out as nothing - e.g. professional tax below the first slab - is not printed)
        deductions: mine.filter((l) => l.component.kind === 'DEDUCTION' && l.amount !== 0).map((l) => ({ name: l.component.name, amount: l.amount })),
        leave: (leave.get(person.employeeId) ?? []).map(({ name, opening, earned, taken, other, closing }) => ({ name, opening, earned, taken, other, closing })),
        madeOn,
      },
    })
  }
  return out
}

// --- From the API ---

// Someone else's payslip: the run in whole-company Payroll scope (else NOT_FOUND), and Salary View over the whole
// company - a payslip is all salary figures (and the full bank account number and PAN)
async function runWithSalaries(viewer: CurrentUser, runId: number) {
  const run = await peopleService.runFor(viewer, runId)
  if (!peopleService.seesSalaries(viewer, run.company.id)) {
    throw new ORPCError('FORBIDDEN', { message: 'Payslips show salaries - they need Salary View covering the whole company as well as Payroll' })
  }
  return run
}

// A person's payslip as it would be made with this template - to check the template before releasing; nothing is stored
export async function preview(viewer: CurrentUser, { runId, personId, templateId }: PreviewInput) {
  const run = await runWithSalaries(viewer, runId)
  if (run.status !== 'FINALISED') throw new ORPCError('CONFLICT', { message: 'Payslips are made from an approved run - this run is not final yet' })
  await letterTemplatesService.assertPayslipTemplate(templateId)
  const payslip = (await payslipsOf(runOf(run), [personId])).get(personId)
  if (!payslip) throw new ORPCError('NOT_FOUND', { message: 'This person is not in the payroll run, or has no pay worked out' })
  return pdfFile(await letterTemplatesService.writePayslip(templateId, payslip.data), fileName(run.payMonth, payslip.employeeCode, true))
}

// Releases a final run's payslips with a payslip template: the job makes them within minutes and each employee is
// e-mailed. Once, by someone with Payroll Edit over the whole company.
export async function release(viewer: CurrentUser, { runId, templateId }: ReleaseInput) {
  const run = await peopleService.runFor(viewer, runId)
  assertAccess(viewer.access, 'PAYROLL', 'WRITE')
  assertWholeSlice(viewer, 'PAYROLL', companySlice(run.company.id), 'Releasing payslips')
  if (run.status !== 'FINALISED') throw new ORPCError('CONFLICT', { message: 'Only an approved (final) run can release its payslips' })
  await peopleService.assertClassifiedRun(run.id)
  if (run.payslipsReleasedAt) throw new ORPCError('CONFLICT', { message: "This run's payslips are already released" })
  await letterTemplatesService.assertPayslipTemplate(templateId)
  if (!(await payslipsRepository.release(run.id, templateId, viewer.employeeId))) {
    throw new ORPCError('CONFLICT', { message: "This run's payslips were released a moment ago - reload the page" })
  }
  return { released: true }
}

// A person's payslip as it was made (stored)
export async function download(viewer: CurrentUser, { runId, personId }: PayslipInput) {
  const run = await runWithSalaries(viewer, runId)
  const payslip = await payslipsRepository.findInRun(run.id, personId)
  if (!payslip) throw new ORPCError('NOT_FOUND', { message: run.payslipsReleasedAt ? 'This payslip is not made yet - try again in a minute' : "This run's payslips are not released yet" })
  return pdfFile(await readStoredFile(payslip.storageKey), fileName(payslip.runEmployee.run.payMonth, payslip.runEmployee.employeeCode))
}

// For the run's page: where its payslips stand (a final run only) - released when, by whom, with which template; how many
// are made; whether the viewer may release them; and, until they are released, the payslip templates to preview a
// payslip with (for a viewer who sees the salaries - the preparer, and the approvers checking before the release)
export async function statusOf(viewer: CurrentUser, run: { id: number; company: { id: number }; status: string; payslipsReleasedAt: Date | null; payslipTemplate: { id: number; name: string } | null }) {
  if (run.status !== 'FINALISED') return null
  const counts = await payslipsRepository.countMade(run.id)
  const verified = await peopleService.classificationsVerified(run.id)
  const canRelease = verified && !run.payslipsReleasedAt && levelOver(viewer, 'PAYROLL', companySlice(run.company.id)) === 'WRITE'
  const mayPreview = verified && !run.payslipsReleasedAt && peopleService.seesSalaries(viewer, run.company.id)
  return {
    releasedAt: run.payslipsReleasedAt,
    template: run.payslipTemplate,
    made: counts.made,
    total: counts.total,
    canRelease,
    templates: canRelease || mayPreview ? await letterTemplatesService.listPayslipTemplates() : [],
  }
}

// --- One's own (Employee self-service) ---

// One's own payslips: every month whose payslips are released, newest first (not made yet = still being made)
export async function listMine(viewer: CurrentUser) {
  const rows = await payslipsRepository.listOwn(viewer.employeeId)
  return rows.map((row) => {
    const period = peopleService.payPeriodOf(row.run)
    return {
      personId: row.id,
      id: row.payslip?.id ?? null,
      payMonth: row.run.payMonth,
      payFrom: period.from,
      payTo: period.to,
      company: row.run.company,
      employeeCode: row.employeeCode,
      madeAt: row.payslip?.createdAt ?? null,
    }
  })
}

// One of one's own payslips (NOT_FOUND for anyone else's, or one not released)
export async function downloadMine(viewer: CurrentUser, { id }: { id: number }) {
  const payslip = await payslipsRepository.findOwn(id, viewer.employeeId)
  if (!payslip) throw new ORPCError('NOT_FOUND', { message: 'No payslip found' })
  return pdfFile(await readStoredFile(payslip.storageKey), fileName(payslip.runEmployee.run.payMonth, payslip.runEmployee.employeeCode))
}

// --- The background job ---

// Makes the payslips of released runs not made yet - at most `limit` each run of the job (payroll.makePayslips, every
// minute) - stores each and e-mails the employee a link. One person's failure is listed and tried again next time.
// `only`: just these runs (tests - as the other jobs' filters)
export async function makeDue(only?: { runIds: number[] }, limit = 300) {
  const due = await payslipsRepository.listToMake(limit, only?.runIds)
  const byRun = new Map<number, typeof due>()
  for (const row of due) byRun.set(row.run.id, [...(byRun.get(row.run.id) ?? []), row])
  let made = 0
  const failures: string[] = []
  for (const rows of byRun.values()) {
    const run = rows[0]!.run
    const payslips = await payslipsOf(run, rows.map((r) => r.id))
    const contacts = new Map((await employeesService.listMailContacts([...payslips.values()].map((p) => p.employeeId))).map((c) => [c.id, c]))
    for (const [personId, payslip] of payslips) {
      let storageKey: string | undefined
      try {
        const pdf = await letterTemplatesService.writePayslip(run.payslipTemplateId!, payslip.data, true)
        storageKey = await saveFile(placeOf(payslip.employeeCode, run.payMonth), 'application/pdf', pdf)
        await payslipsRepository.create(personId, storageKey, SYSTEM_ACTOR)
        made++
      } catch (error) {
        if (storageKey) await deleteFile(storageKey).catch(() => undefined)
        failures.push(`${payslip.employeeCode}: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }
      await mailEmployee(contacts.get(payslip.employeeId), payslip.data)
    }
  }
  return failures.length ? `${made} payslips made; ${failures.length} failed - ${failures.slice(0, 5).join('; ')}` : `${made} payslips made`
}

// "Your payslip is ready" with a link to self-service - never the PDF (it shows the full bank account number and PAN)
async function mailEmployee(to: { email: string; name: string } | undefined, payslip: letterTemplatesService.PayslipData) {
  if (!to) return
  const month = MONTH.format(payslip.payMonth)
  await sendMail({
    to: to.email,
    subject: `Your payslip for ${month}`,
    text: [
      `Dear ${to.name},`,
      '',
      `Your payslip for ${month} (${payslip.company}) is ready. Open it in Employee self-service:`,
      `${env.APP_URL}/ess/pay-career?view=payslips`,
      '',
      'It is not attached to this e-mail because it shows your bank account number and PAN in full.',
    ].join('\n'),
  }).catch((error: unknown) => console.error('[payroll] payslip e-mail failed:', error))
}

// --- A company transfer (job changes) ---

// The employee's payslips move to the folder of their new code: each file is copied and its row pointed at the copy,
// inside the caller's transaction; the caller deletes the old files once it is saved (oldKeys) - or the copies if it
// fails (newKeys). A file missing on disk keeps its key.
export async function moveToCode(employeeId: number, employeeCode: string, actorId: ActorId, tx: DbClient) {
  const moved = { oldKeys: [] as string[], newKeys: [] as string[] }
  for (const row of await payslipsRepository.listFilesOf(employeeId, tx)) {
    let storageKey: string
    try {
      storageKey = await copyFile(row.storageKey, placeOf(employeeCode, row.runEmployee.run.payMonth), { type: 'application/pdf' })
    } catch (error) {
      console.error(`[payroll] ${row.storageKey} could not be copied to the new folder - it keeps its key:`, error)
      continue
    }
    moved.newKeys.push(storageKey)
    moved.oldKeys.push(row.storageKey)
    await payslipsRepository.updateStorageKey(row.id, storageKey, actorId, tx)
  }
  return moved
}
