import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { assertWholeSlice, levelOver, SYSTEM_SCOPE, wholeCompanyScopeOf } from '#core/auth/scope'
import { env } from '#core/config/env'
import { prisma, type StatutoryRole, type StatutoryScheme } from '#core/db/prisma'
import { reportFile, reportSheet } from '#core/excel/report'
import { sendMail } from '#core/mail/mailer'
import type { CurrentUser } from '#core/rpc/procedures'
import { accountsService } from '#modules/accounts'
import { employeesService } from '#modules/employees'
import { companiesService } from '#modules/organization'
import { formatDate, today } from '#shared/utils/dates'
import { fromPaise, toPaise } from '#shared/utils/money'
import * as peopleService from '../people/people.service.js'
import * as statutoryService from '../statutory/statutory.service.js'
import * as depositsRepository from './deposits.repository.js'
import { byState, type DepositState, type LeaveOutInput, type ListInput, type MarkPaidInput, type MonthInput, type PeopleInput, type PersonScheme, type RecordInput, type RemoveGapsInput, type TakeInInput, type UpdateInput } from './deposits.schema.js'

// Payroll stage 6 slice 3 (approved by the user 2026-11-28): statutory deposits. What each FINALISED run deducted from its
// people and owes on top for PF (EPF, EPS, EDLI), ESIC, professional tax and LWF must reach the scheme - per company,
// scheme and pay month, professional tax and LWF per State (the State the run charged them by). What is due is never
// stored: it is added up from the runs' lines each time, by the role and State each line saved when its pay was worked
// out (classification snapshots); an approved run with lines from before the snapshots stays out until it is reconciled. HR records each return /
// challan (filed, then paid) with the contributions it carries - compared with the runs to the paisa - and the other
// charges on it (admin charges, interest, damages - the company's cost, typed from the challan). For PF and ESIC, a person
// whose deduction could not go into the return (no UAN, details not matching...) is marked left out until a later deposit
// takes them in (the Code on Wages s.18(5): the employee is not responsible for a deduction not deposited). Due dates are
// dated rows on Statutory settings; a daily e-mail reminds the people who record deposits until the challan is paid. Access: the "Statutory deposits"
// area over the whole company - company totals; each person's amounts also need Salary View over it (the user, 2026-11-28);
// nobody marks themselves. Employees see their own months once the payslips are released. Income tax comes in stage 7.

const DAY = 86_400_000
const companySlice = (companyId: number) => ({ companyId, plantId: null, departmentId: null })
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const sum = (amounts: number[]) => fromPaise(amounts.reduce((total, a) => total + toPaise(a), 0))
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY)

export const SCHEMES: StatutoryScheme[] = ['PF', 'ESIC', 'PROFESSIONAL_TAX', 'LWF']
// The statutory roles each scheme's deposit carries - the employee's share first
export const ROLES: Record<StatutoryScheme, StatutoryRole[]> = {
  PF: ['PF_EMPLOYEE', 'PF_EMPLOYER', 'EPS', 'EDLI'],
  ESIC: ['ESIC_EMPLOYEE', 'ESIC_EMPLOYER'],
  PROFESSIONAL_TAX: ['PROFESSIONAL_TAX'],
  LWF: ['LWF_EMPLOYEE', 'LWF_EMPLOYER'],
}
const EMPLOYEE_SHARE: Record<StatutoryScheme, StatutoryRole> = { PF: 'PF_EMPLOYEE', ESIC: 'ESIC_EMPLOYEE', PROFESSIONAL_TAX: 'PROFESSIONAL_TAX', LWF: 'LWF_EMPLOYEE' }
const ALL_ROLES = SCHEMES.flatMap((s) => ROLES[s])
const PERSON_ROLES = [...ROLES.PF, ...ROLES.ESIC]
const schemeOf = (role: StatutoryRole) => SCHEMES.find((s) => ROLES[s].includes(role))
const SCHEME_NAME: Record<StatutoryScheme, string> = { PF: 'PF', ESIC: 'ESIC', PROFESSIONAL_TAX: 'Professional tax', LWF: 'LWF' }
const STATE_TEXT: Record<DepositState, string> = {
  NOT_DEPOSITED: 'not deposited',
  FILED_NOT_PAID: 'filed, not paid',
  SHORT: 'less deposited than due',
  MORE_THAN_DUE: 'more deposited than due - to check',
  PEOPLE_LEFT_OUT: 'people left out of the return',
  DEPOSITED: 'deposited',
}

// --- Where a scheme's month stands (pure - unit tested) ---

// Due = what the runs worked out; the people left out (not taken in yet) are not expected in the deposits so far. Compared
// to the paisa: equal = deposited (with the people left out still to follow), more = to check, less = filed but not paid,
// short or nothing yet. Overdue while anything is owed after the due date; late = paid after it.
export function standingOf(x: { due: number; deposited: number; filedUnpaid: number; leftOut: { count: number; amount: number }; dueOn: Date | null; lastPaidOn: Date | null }, now: Date) {
  const expected = toPaise(x.due) - toPaise(x.leftOut.amount)
  const deposited = toPaise(x.deposited)
  const state: DepositState =
    deposited === expected
      ? x.leftOut.count
        ? 'PEOPLE_LEFT_OUT'
        : 'DEPOSITED'
      : deposited > expected
        ? 'MORE_THAN_DUE'
        : x.filedUnpaid > 0
          ? 'FILED_NOT_PAID'
          : deposited > 0
            ? 'SHORT'
            : 'NOT_DEPOSITED'
  const owed = state !== 'DEPOSITED' && state !== 'MORE_THAN_DUE'
  return {
    state,
    expected: fromPaise(expected),
    // still to deposit (below zero: deposited more than due)
    difference: fromPaise(expected - deposited),
    daysOverdue: owed && x.dueOn && now > x.dueOn ? daysBetween(x.dueOn, now) : 0,
    daysLate: (state === 'DEPOSITED' || state === 'PEOPLE_LEFT_OUT') && x.dueOn && x.lastPaidOn && x.lastPaidOn > x.dueOn ? daysBetween(x.dueOn, x.lastPaidOn) : 0,
  }
}

// --- The schemes' months ---

type Run = { id: number; payMonth: Date; payslipsReleasedAt: Date | null; company: { id: number; code: string; name: string } }
type Deposit = Awaited<ReturnType<typeof depositsRepository.listDeposits>>[number]
type RoleSum = { amount: number; base: number; people: number }

const keyOf = (companyId: number, payMonth: Date, scheme: StatutoryScheme, stateCode: string | null) => `${companyId}:${payMonth.getTime()}:${scheme}:${stateCode ?? ''}`

// Each company's pay month and scheme (and State) of these approved runs: what is due (per statutory role), the deposits
// recorded, the people left out, the due date and where it stands
async function linesOf(runs: Run[], deposits: Deposit[], now: Date) {
  const runIds = runs.map((r) => r.id)
  const [sums, gaps, dueDates] = await Promise.all([depositsRepository.sumStatutory(runIds), depositsRepository.listGaps(runIds, PERSON_ROLES), statutoryService.loadDueDates()])
  const runOf = new Map(runs.map((r) => [r.id, r]))
  const monthRun = new Map(runs.map((r) => [`${r.company.id}:${r.payMonth.getTime()}`, r]))
  type Building = { run: Run; scheme: StatutoryScheme; stateCode: string | null; runIds: Set<number>; roles: Partial<Record<StatutoryRole, RoleSum>>; deposits: Deposit[]; leftOut: { count: number; amount: number }; takenIn: number }
  const lines = new Map<string, Building>()
  const lineFor = (run: Run, scheme: StatutoryScheme, stateCode: string | null) => {
    const key = keyOf(run.company.id, run.payMonth, scheme, stateCode)
    let line = lines.get(key)
    if (!line) lines.set(key, (line = { run, scheme, stateCode, runIds: new Set(), roles: {}, deposits: [], leftOut: { count: 0, amount: 0 }, takenIn: 0 }))
    return line
  }
  for (const s of sums) {
    const scheme = schemeOf(s.role)
    const run = runOf.get(s.runId)
    if (!scheme || !run) continue
    const line = lineFor(run, scheme, byState(scheme) ? s.stateCode : null)
    line.runIds.add(run.id)
    const role = line.roles[s.role] ?? { amount: 0, base: 0, people: 0 }
    line.roles[s.role] = { amount: sum([role.amount, s.amount]), base: sum([role.base, s.base ?? 0]), people: role.people + s.people }
  }
  for (const d of deposits) {
    const run = monthRun.get(`${d.companyId}:${d.payMonth.getTime()}`)
    if (run) lineFor(run, d.scheme, d.stateCode).deposits.push(d)
  }
  for (const g of gaps) {
    const run = runOf.get(g.person.payrollRunId)
    if (!run) continue
    const line = lineFor(run, g.scheme, null)
    if (g.depositId) line.takenIn++
    else line.leftOut = { count: line.leftOut.count + 1, amount: sum([line.leftOut.amount, ...g.lines.filter((l) => ROLES[g.scheme].includes(l.role)).map((l) => l.amount)]) }
  }
  return [...lines.values()].map((l) => {
    const roleSums = Object.values(l.roles)
    const due = sum(roleSums.map((r) => r.amount))
    const paid = l.deposits.filter((d) => d.paidOn)
    const deposited = sum(paid.map((d) => d.contributions))
    const filedUnpaid = sum(l.deposits.filter((d) => !d.paidOn).map((d) => d.contributions))
    const lastPaidOn = paid.reduce<Date | null>((last, d) => (!last || d.paidOn! > last ? d.paidOn : last), null)
    const dueOn = statutoryService.dueOn(dueDates, l.scheme, l.stateCode, l.run.payMonth)
    return {
      company: l.run.company,
      payMonth: l.run.payMonth,
      scheme: l.scheme,
      stateCode: l.stateCode,
      runIds: [...l.runIds],
      payslipsReleased: !!l.run.payslipsReleasedAt,
      // the people with an amount of the scheme (the most of any of its roles)
      people: Math.max(0, ...roleSums.map((r) => r.people)),
      due,
      roles: l.roles,
      deposited,
      filedUnpaid,
      otherCharges: sum(l.deposits.map((d) => d.otherCharges)),
      deposits: l.deposits,
      lastPaidOn,
      leftOut: l.leftOut,
      takenIn: l.takenIn,
      dueOn,
      ...standingOf({ due, deposited, filedUnpaid, leftOut: l.leftOut, dueOn, lastPaidOn }, now),
    }
  })
}
type Line = Awaited<ReturnType<typeof linesOf>>[number]

const ORDER = (a: Line, b: Line) =>
  b.payMonth.getTime() - a.payMonth.getTime() || a.company.code.localeCompare(b.company.code) || SCHEMES.indexOf(a.scheme) - SCHEMES.indexOf(b.scheme) || (a.stateCode ?? '').localeCompare(b.stateCode ?? '')
// open ones: the most overdue first, then by due date (none set last)
const URGENT = (a: Line, b: Line) => b.daysOverdue - a.daysOverdue || (a.dueOn?.getTime() ?? Infinity) - (b.dueOn?.getTime() ?? Infinity) || ORDER(a, b)

// A line without its deposits and roles - for lists
const summaryOf = ({ deposits: _d, roles: _r, runIds: _i, ...line }: Line) => line

// The companies whose deposits the viewer sees (Statutory deposits over the whole company) and whether they may record them
async function companiesOf(viewer: CurrentUser) {
  return (await companiesService.listCompanies())
    .map((c) => ({ id: c.id, code: c.code, name: c.name, level: levelOver(viewer, 'STATUTORY_DEPOSITS', companySlice(c.id)) }))
    .filter((c) => c.level !== undefined)
    .map(({ level, ...c }) => ({ ...c, canRecord: level === 'WRITE' }))
}

// A company's deposits may be changed by the viewer: seen (else NOT_FOUND - never reveal it), then Edit over the whole company
function assertMayRecord(viewer: CurrentUser, companyId: number) {
  if (levelOver(viewer, 'STATUTORY_DEPOSITS', companySlice(companyId)) === undefined) throw new ORPCError('NOT_FOUND', { message: 'Not found' })
  assertWholeSlice(viewer, 'STATUTORY_DEPOSITS', companySlice(companyId), 'Statutory deposits')
}

const ownRefused = () => new ORPCError('FORBIDDEN', { message: 'Nobody marks their own PF or ESIC - ask a colleague with Statutory deposits access' })

export async function listDeposits(viewer: CurrentUser, input: ListInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'READ')
  const scope = wholeCompanyScopeOf(viewer, 'STATUTORY_DEPOSITS')
  const [runs, deposits, companies, settings] = await Promise.all([
    depositsRepository.listFinalRuns(scope, { companyId: input.companyId }),
    depositsRepository.listDeposits(scope, { companyId: input.companyId }),
    companiesOf(viewer),
    statutoryService.runSettings(),
  ])
  const now = today()
  const unverified = await depositsRepository.listUnverifiedRuns(runs.map((r) => r.id))
  const lines = await linesOf(runs.filter((r) => !unverified.has(r.id)), deposits, now)
  const open = lines.filter((l) => l.state !== 'DEPOSITED')
  const shown = input.show === 'OPEN' ? [...open].sort(URGENT) : [...lines].sort(ORDER)
  const soon = now.getTime() + settings.depositReminderDays * DAY
  return {
    items: shown.slice((input.page - 1) * input.pageSize, input.page * input.pageSize).map(summaryOf),
    total: shown.length,
    counts: {
      open: open.length,
      overdue: open.filter((l) => l.daysOverdue > 0).length,
      dueSoon: open.filter((l) => !l.daysOverdue && l.dueOn && l.dueOn.getTime() <= soon).length,
      filedNotPaid: open.filter((l) => l.state === 'FILED_NOT_PAID').length,
      peopleLeftOut: open.reduce((n, l) => n + l.leftOut.count, 0),
      noDueDate: open.filter((l) => !l.dueOn).length,
    },
    reminderDays: settings.depositReminderDays,
    // approved months worked out before the classification snapshots - left out until reconciled
    unverifiedMonths: runs.filter((r) => unverified.has(r.id)).map((r) => ({ company: r.company, payMonth: r.payMonth })),
    companies,
  }
}

// The month's approved runs of a company in the viewer's scope - NOT_FOUND when there is none (or the company is not seen);
// CONFLICT when one was worked out before the classification snapshots (never added up from today's masters)
async function monthRunsFor(viewer: CurrentUser, { companyId, payMonth }: MonthInput) {
  const runs = await depositsRepository.listFinalRuns(wholeCompanyScopeOf(viewer, 'STATUTORY_DEPOSITS'), { companyId, payMonth })
  if (!runs.length) throw new ORPCError('NOT_FOUND', { message: 'No approved pay run of this company for that month' })
  if ((await depositsRepository.listUnverifiedRuns(runs.map((r) => r.id))).size) throw new ORPCError('CONFLICT', { message: peopleService.UNVERIFIED_CLASSIFICATIONS })
  return runs
}

// One company's pay month: each scheme's figures (per statutory role - company totals), the returns / challans recorded,
// the people left out and the ones with no UAN / ESIC number yet
export async function getMonth(viewer: CurrentUser, input: MonthInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'READ')
  const runs = await monthRunsFor(viewer, input)
  const deposits = await depositsRepository.listDeposits(wholeCompanyScopeOf(viewer, 'STATUTORY_DEPOSITS'), input)
  const lines = (await linesOf(runs, deposits, today())).sort(ORDER)
  const runIds = runs.map((r) => r.id)
  // who has no UAN / ESIC number and is not left out yet - to look at before filing
  const [pf, esic] = await Promise.all([depositsRepository.listSchemePeople(runIds, ROLES.PF, 'PF'), depositsRepository.listSchemePeople(runIds, ROLES.ESIC, 'ESIC')])
  const numbers = await employeesService.listStatutoryNumbers([...new Set([...pf, ...esic].map((p) => p.employeeId))])
  const noNumber = {
    PF: pf.filter((p) => !p.gap && !numbers.get(p.employeeId)?.uan).length,
    ESIC: esic.filter((p) => !p.gap && !numbers.get(p.employeeId)?.esicIpNumber).length,
  }
  const person = await employeesService.lookupPeople(deposits.flatMap((d) => [d.createdById, d.paidById]))
  const level = levelOver(viewer, 'STATUTORY_DEPOSITS', companySlice(input.companyId))
  return {
    company: runs[0]!.company,
    payMonth: input.payMonth,
    runs: runs.map((r) => ({ id: r.id, payslipsReleased: !!r.payslipsReleasedAt })),
    lines: lines.map(({ runIds: _i, deposits: ds, ...line }) => ({
      ...line,
      noNumber: line.scheme === 'PF' || line.scheme === 'ESIC' ? noNumber[line.scheme] : 0,
      deposits: ds.map(({ createdById, paidById, updatedById: _u, ...d }) => ({ ...d, recordedBy: person(createdById), paidBy: person(paidById) })),
    })),
    canRecord: level === 'WRITE',
    // each person's amounts (the people list, the figures sheet) also need Salary View over the whole company
    seesAmounts: peopleService.seesSalaries(viewer, input.companyId),
  }
}

// The people of a month's PF or ESIC: their UAN / ESIC number, whether they are left out (and taken in later) - and their
// amounts only with Salary View over the whole company as well
export async function listPeople(viewer: CurrentUser, input: PeopleInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'READ')
  const runs = await monthRunsFor(viewer, input)
  const all = await depositsRepository.listSchemePeople(runs.map((r) => r.id), ROLES[input.scheme], input.scheme)
  const [numbers, person] = await Promise.all([
    employeesService.listStatutoryNumbers([...new Set(all.map((p) => p.employeeId))]),
    employeesService.lookupPeople(all.flatMap((p) => [p.employeeId, p.gap?.createdById, p.gap?.coveredById])),
  ])
  const sees = peopleService.seesSalaries(viewer, input.companyId)
  const rows = all.map((p) => {
    const number = (input.scheme === 'PF' ? numbers.get(p.employeeId)?.uan : numbers.get(p.employeeId)?.esicIpNumber) ?? null
    const share = (role: StatutoryRole) => p.lines.find((l) => l.role === role)
    return {
      personId: p.id,
      employeeCode: p.employeeCode,
      name: person(p.employeeId)?.name ?? '',
      number,
      own: p.employeeId === viewer.employeeId,
      gap: p.gap
        ? {
            id: p.gap.id,
            reason: p.gap.reason,
            note: p.gap.note,
            at: p.gap.createdAt,
            by: person(p.gap.createdById),
            takenIn: p.gap.depositId ? { depositId: p.gap.depositId, reference: p.gap.deposit!.reference, paidOn: p.gap.deposit!.paidOn, at: p.gap.coveredAt, by: person(p.gap.coveredById) } : null,
          }
        : null,
      amounts: sees
        ? {
            wages: share(EMPLOYEE_SHARE[input.scheme])?.base ?? share(ROLES[input.scheme][1]!)?.base ?? null,
            employee: share(EMPLOYEE_SHARE[input.scheme])?.amount ?? 0,
            employer: sum(p.lines.filter((l) => l.role !== EMPLOYEE_SHARE[input.scheme]).map((l) => l.amount)),
          }
        : null,
    }
  })
  const text = input.search?.toLowerCase()
  const shown = rows.filter(
    (r) =>
      (input.show === 'ALL' || (input.show === 'LEFT_OUT' ? !!r.gap : !r.gap && !r.number)) &&
      (!text || r.employeeCode.toLowerCase().includes(text) || r.name.toLowerCase().includes(text) || (r.number ?? '').toLowerCase().includes(text)),
  )
  return {
    items: shown.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
    total: shown.length,
    counts: { all: rows.length, leftOut: rows.filter((r) => r.gap && !r.gap.takenIn).length, takenIn: rows.filter((r) => r.gap?.takenIn).length, noNumber: rows.filter((r) => !r.gap && !r.number).length },
    canMark: levelOver(viewer, 'STATUTORY_DEPOSITS', companySlice(input.companyId)) === 'WRITE',
    seesAmounts: sees,
  }
}

// --- Recording returns and challans ---

const bad = (message: string) => new ORPCError('BAD_REQUEST', { message })

function checkDays(filedOn: Date, paid: { paidOn: Date } | undefined) {
  const now = today()
  if (filedOn > now) throw bad('The day it was filed cannot be in the future')
  if (paid && paid.paidOn > now) throw bad('The day it was paid cannot be in the future')
  if (paid && paid.paidOn < filedOn) throw bad('It cannot be paid before it was filed')
}

// A return / challan filed for a company's pay month (and maybe paid at once): the month needs an approved run with an
// amount of the scheme (professional tax and LWF: in that State). A supplementary PF / ESIC return takes in the people left
// out it names in the same step - each left out of this company's month and scheme, not taken in yet, never the viewer.
export async function record(viewer: CurrentUser, input: RecordInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'WRITE')
  assertMayRecord(viewer, input.companyId)
  const runs = await monthRunsFor(viewer, input)
  const sums = await depositsRepository.sumStatutory(runs.map((r) => r.id))
  if (!sums.some((s) => schemeOf(s.role) === input.scheme && (!byState(input.scheme) || s.stateCode === input.stateCode))) {
    throw bad(`The month's approved run has no ${SCHEME_NAME[input.scheme]}${input.stateCode ? ` in ${input.stateCode}` : ''}`)
  }
  if (input.contributions + input.otherCharges <= 0) throw bad('Give the amount deposited')
  if (input.takeIn && input.scheme !== 'PF' && input.scheme !== 'ESIC') throw bad('Only a PF or ESIC return takes in people left out')
  checkDays(input.filedOn, input.paid)
  const takeIn = [...new Set(input.takeIn ?? [])]
  return prisma.$transaction(async (tx) => {
    const created = await depositsRepository.createDeposit(
      {
        companyId: input.companyId,
        scheme: input.scheme,
        stateCode: input.stateCode,
        payMonth: input.payMonth,
        reference: input.reference,
        filedOn: input.filedOn,
        contributions: input.contributions,
        otherCharges: input.otherCharges,
        note: input.note || null,
        paidOn: input.paid?.paidOn ?? null,
        paymentReference: input.paid?.paymentReference ?? null,
        paidAt: input.paid ? new Date() : null,
        paidById: input.paid ? viewer.employeeId : null,
      },
      viewer.employeeId,
      tx,
    )
    if (takeIn.length) {
      const gaps = await depositsRepository.findGaps(takeIn, tx)
      const wrong = gaps.length !== takeIn.length || gaps.some((g) => g.scheme !== input.scheme || g.runEmployee.run.companyId !== input.companyId || g.runEmployee.run.payMonth.getTime() !== input.payMonth.getTime())
      if (wrong) throw new ORPCError('NOT_FOUND', { message: `A person picked is not left out of this month's ${SCHEME_NAME[input.scheme]} return - reload the page` })
      if (gaps.some((g) => g.runEmployee.employeeId === viewer.employeeId)) throw ownRefused()
      if ((await depositsRepository.setGapsDeposit(takeIn, created.id, viewer.employeeId, tx)) !== takeIn.length) {
        throw new ORPCError('CONFLICT', { message: 'Some of them are already taken in - reload the page' })
      }
    }
    return created
  })
}

async function depositFor(viewer: CurrentUser, id: number) {
  const deposit = await depositsRepository.findDeposit(id, wholeCompanyScopeOf(viewer, 'STATUTORY_DEPOSITS'))
  if (!deposit) throw new ORPCError('NOT_FOUND', { message: 'No return or challan found' })
  assertMayRecord(viewer, deposit.companyId)
  return deposit
}

const changedRefused = () => new ORPCError('CONFLICT', { message: 'This return or challan changed a moment ago - reload the page' })

// Corrects a recorded return / challan (a typing mistake); the day and reference it was paid with only when it is paid
export async function update(viewer: CurrentUser, input: UpdateInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'WRITE')
  const deposit = await depositFor(viewer, input.id)
  if (input.paid && !deposit.paidOn) throw bad('It is not paid yet - mark it paid instead')
  checkDays(input.filedOn, input.paid ?? (deposit.paidOn ? { paidOn: deposit.paidOn } : undefined))
  if (input.contributions + input.otherCharges <= 0) throw bad('Give the amount deposited')
  const data = {
    reference: input.reference,
    filedOn: input.filedOn,
    contributions: input.contributions,
    otherCharges: input.otherCharges,
    note: input.note || null,
    ...(input.paid && { paidOn: input.paid.paidOn, paymentReference: input.paid.paymentReference, paidAt: new Date(), paidById: viewer.employeeId }),
  }
  if (!(await depositsRepository.updateDepositIf(deposit.id, !!deposit.paidOn, data, viewer.employeeId))) throw changedRefused()
  return { id: deposit.id }
}

// A filed return / challan paid on a day, with the payment's reference
export async function markPaid(viewer: CurrentUser, input: MarkPaidInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'WRITE')
  const deposit = await depositFor(viewer, input.id)
  if (deposit.paidOn) throw new ORPCError('CONFLICT', { message: 'It is already marked paid' })
  checkDays(deposit.filedOn, { paidOn: input.paidOn })
  const data = { paidOn: input.paidOn, paymentReference: input.paymentReference, paidAt: new Date(), paidById: viewer.employeeId }
  if (!(await depositsRepository.updateDepositIf(deposit.id, false, data, viewer.employeeId))) throw changedRefused()
  return { id: deposit.id }
}

// Removes a return / challan recorded by mistake - not while it took people in (mark them not taken in first)
export async function remove(viewer: CurrentUser, { id }: { id: number }) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'WRITE')
  const deposit = await depositFor(viewer, id)
  if (!(await depositsRepository.deleteDepositIf(deposit.id))) throw new ORPCError('CONFLICT', { message: 'It took people left out in - mark them not taken in first' })
  return { removed: true }
}

// --- People left out of a PF or ESIC return ---

// Marks these people of the month's approved runs left out of the PF or ESIC return, with why - each with an amount of the
// scheme, not marked already, never the viewer. Everything is checked before anything is saved.
export async function leaveOut(viewer: CurrentUser, input: LeaveOutInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'WRITE')
  assertMayRecord(viewer, input.companyId)
  const ids = [...new Set(input.personIds)]
  return prisma.$transaction(async (tx) => {
    const people = await depositsRepository.listPeopleToMark(ids, ROLES[input.scheme], input.scheme, tx)
    if (people.length !== ids.length) throw new ORPCError('NOT_FOUND', { message: 'A person picked is not in a pay run - reload the list' })
    if (people.some((p) => p.employeeId === viewer.employeeId)) throw ownRefused()
    const problems = people.flatMap((p) => {
      const why =
        p.run.companyId !== input.companyId || p.run.payMonth.getTime() !== input.payMonth.getTime() || p.run.status !== 'FINALISED'
          ? "not in this month's approved run"
          : !p.lines.length
            ? `no ${SCHEME_NAME[input.scheme]} this month`
            : p.depositGaps.length
              ? 'already marked left out'
              : null
      return why ? [`${p.employeeCode} (${why})`] : []
    })
    if (problems.length) throw new ORPCError('CONFLICT', { message: `${problems.length} of the people picked cannot be marked: ${problems.slice(0, 10).join('; ')}${problems.length > 10 ? '…' : ''}` })
    await depositsRepository.createGaps(
      people.map((p) => ({ payrollRunEmployeeId: p.id, scheme: input.scheme, reason: input.reason, note: input.note || null })),
      viewer.employeeId,
      tx,
    )
    return { marked: people.length }
  })
}

// These marks, each of a company the viewer may change and never their own; all of one company, pay month and scheme
async function gapsFor(viewer: CurrentUser, gapIds: number[]) {
  const ids = [...new Set(gapIds)]
  const gaps = await depositsRepository.findGaps(ids)
  if (gaps.length !== ids.length || gaps.some((g) => levelOver(viewer, 'STATUTORY_DEPOSITS', companySlice(g.runEmployee.run.companyId)) === undefined)) {
    throw new ORPCError('NOT_FOUND', { message: 'A person picked is not marked left out - reload the list' })
  }
  const first = gaps[0]!
  if (gaps.some((g) => g.scheme !== first.scheme || g.runEmployee.run.companyId !== first.runEmployee.run.companyId || g.runEmployee.run.payMonth.getTime() !== first.runEmployee.run.payMonth.getTime())) {
    throw bad('Pick people of one company, month and scheme')
  }
  assertMayRecord(viewer, first.runEmployee.run.companyId)
  if (gaps.some((g) => g.runEmployee.employeeId === viewer.employeeId)) throw ownRefused()
  return { ids, gaps, scheme: first.scheme as PersonScheme, companyId: first.runEmployee.run.companyId, payMonth: first.runEmployee.run.payMonth }
}

// People left out, taken in by a later deposit of the same company, month and scheme - or not after all (no deposit)
export async function takeIn(viewer: CurrentUser, input: TakeInInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'WRITE')
  const { ids, gaps, scheme, companyId, payMonth } = await gapsFor(viewer, input.gapIds)
  if (input.depositId !== null) {
    const deposit = await depositFor(viewer, input.depositId)
    if (deposit.companyId !== companyId || deposit.scheme !== scheme || deposit.payMonth.getTime() !== payMonth.getTime()) {
      throw bad(`Pick a ${SCHEME_NAME[scheme]} return of the same company and month`)
    }
    if (gaps.some((g) => g.depositId !== null)) throw new ORPCError('CONFLICT', { message: 'Some of them are already taken in - reload the list' })
  } else if (gaps.some((g) => g.depositId === null)) {
    throw new ORPCError('CONFLICT', { message: 'Some of them are not taken in - reload the list' })
  }
  return prisma.$transaction(async (tx) => {
    if ((await depositsRepository.setGapsDeposit(ids, input.depositId, viewer.employeeId, tx)) !== ids.length) {
      throw new ORPCError('CONFLICT', { message: 'Someone changed these people a moment ago - reload the list' })
    }
    return { changed: ids.length }
  })
}

// Takes away marks of people left out made by mistake - only while they are not taken in
export async function removeGaps(viewer: CurrentUser, input: RemoveGapsInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'WRITE')
  const { ids, gaps } = await gapsFor(viewer, input.gapIds)
  if (gaps.some((g) => g.depositId !== null)) throw new ORPCError('CONFLICT', { message: 'Someone taken in by a later deposit keeps the mark - mark them not taken in first' })
  return prisma.$transaction(async (tx) => {
    if ((await depositsRepository.deleteOpenGaps(ids, tx)) !== ids.length) throw new ORPCError('CONFLICT', { message: 'Someone changed these people a moment ago - reload the list' })
    return { removed: ids.length }
  })
}

// --- The figures sheet ---

const REASON_TEXT = { NO_UAN: 'No UAN', NO_ESIC_NUMBER: 'No ESIC number', DETAILS_MISMATCH: 'Details do not match', PREVIOUS_EMPLOYER: 'UAN with the last employer', OTHER: 'Other' } as const

// Each person's statutory figures of a company's pay month as Excel, a sheet per scheme (PF: UAN, wages, shares, unpaid
// days; ESIC: number, paid days, wages, shares; professional tax and LWF: State and amounts) and the totals - our own plain
// layout for preparing and checking the returns, not the ECR / ESIC upload files. Each person's amounts: Salary View over
// the whole company as well (the user, 2026-11-28).
export async function figures(viewer: CurrentUser, input: MonthInput) {
  assertAccess(viewer.access, 'STATUTORY_DEPOSITS', 'READ')
  const runs = await monthRunsFor(viewer, input)
  if (!peopleService.seesSalaries(viewer, input.companyId)) throw new ORPCError('FORBIDDEN', { message: "Each person's figures also need Salary View over the whole company" })
  const runIds = runs.map((r) => r.id)
  const [lines, ...perScheme] = await Promise.all([
    linesOf(runs, await depositsRepository.listDeposits(wholeCompanyScopeOf(viewer, 'STATUTORY_DEPOSITS'), input), today()),
    ...SCHEMES.map((s) => depositsRepository.listSchemePeople(runIds, ROLES[s], s)),
  ])
  const everyone = perScheme.flat()
  const [numbers, halves, person] = await Promise.all([
    employeesService.listStatutoryNumbers([...new Set(everyone.map((p) => p.employeeId))]),
    depositsRepository.countHalves([...new Set([...perScheme[0]!, ...perScheme[1]!].map((p) => p.id))]),
    employeesService.lookupPeople(everyone.map((p) => p.employeeId)),
  ])
  type P = (typeof everyone)[number]
  const amount = (p: P, role: StatutoryRole) => p.lines.find((l) => l.role === role)?.amount ?? null
  const base = (p: P, role: StatutoryRole) => p.lines.find((l) => l.role === role)?.base ?? null
  const name = (p: P) => person(p.employeeId)?.name ?? ''
  const days = (p: P, kind: 'paid' | 'unpaid') => (halves.get(p.id)?.[kind] ?? 0) / 2
  const leftOut = (p: P) => (p.gap ? `${REASON_TEXT[p.gap.reason]}${p.gap.depositId ? ` - taken in by ${p.gap.deposit!.reference}` : ''}` : null)
  const [pf, esic, pt, lwf] = perScheme as [P[], P[], P[], P[]]
  const sheets = [
    pf.length &&
      reportSheet('PF', pf, [
        { header: 'Employee code', text: true, width: 14, value: (p) => p.employeeCode },
        { header: 'Name', width: 26, value: name },
        { header: 'UAN', text: true, width: 14, value: (p) => numbers.get(p.employeeId)?.uan ?? '' },
        { header: 'PF wages', width: 12, value: (p) => base(p, 'PF_EMPLOYEE') },
        { header: 'EPS wages', width: 12, value: (p) => base(p, 'EPS') },
        { header: 'EDLI wages', width: 12, value: (p) => base(p, 'EDLI') },
        { header: 'Employee share', width: 13, value: (p) => amount(p, 'PF_EMPLOYEE') },
        { header: 'EPS (pension)', width: 13, value: (p) => amount(p, 'EPS') },
        { header: 'Employer EPF', width: 13, value: (p) => amount(p, 'PF_EMPLOYER') },
        { header: 'EDLI', width: 10, value: (p) => amount(p, 'EDLI') },
        { header: 'Unpaid days', width: 11, value: (p) => days(p, 'unpaid') },
        { header: 'Left out', width: 30, value: leftOut },
      ]),
    esic.length &&
      reportSheet('ESIC', esic, [
        { header: 'Employee code', text: true, width: 14, value: (p) => p.employeeCode },
        { header: 'Name', width: 26, value: name },
        { header: 'ESIC number', text: true, width: 14, value: (p) => numbers.get(p.employeeId)?.esicIpNumber ?? '' },
        { header: 'Paid days', width: 10, value: (p) => days(p, 'paid') },
        { header: 'ESI wages', width: 12, value: (p) => base(p, 'ESIC_EMPLOYEE') ?? base(p, 'ESIC_EMPLOYER') },
        { header: 'Employee share', width: 13, value: (p) => amount(p, 'ESIC_EMPLOYEE') },
        { header: 'Employer share', width: 13, value: (p) => amount(p, 'ESIC_EMPLOYER') },
        { header: 'Left out', width: 30, value: leftOut },
      ]),
    pt.length &&
      reportSheet('Professional tax', pt, [
        { header: 'Employee code', text: true, width: 14, value: (p) => p.employeeCode },
        { header: 'Name', width: 26, value: name },
        { header: 'State', text: true, width: 8, value: (p) => p.stateCode },
        { header: 'Gross', width: 12, value: (p) => base(p, 'PROFESSIONAL_TAX') },
        { header: 'Professional tax', width: 14, value: (p) => amount(p, 'PROFESSIONAL_TAX') },
      ]),
    lwf.length &&
      reportSheet('LWF', lwf, [
        { header: 'Employee code', text: true, width: 14, value: (p) => p.employeeCode },
        { header: 'Name', width: 26, value: name },
        { header: 'State', text: true, width: 8, value: (p) => p.stateCode },
        { header: 'Employee share', width: 13, value: (p) => amount(p, 'LWF_EMPLOYEE') },
        { header: 'Employer share', width: 13, value: (p) => amount(p, 'LWF_EMPLOYER') },
      ]),
    reportSheet('Totals', lines.sort(ORDER), [
      { header: 'Scheme', width: 18, value: (l) => SCHEME_NAME[l.scheme] },
      { header: 'State', text: true, width: 8, value: (l) => l.stateCode },
      { header: 'People', width: 9, value: (l) => l.people },
      { header: 'Due', width: 14, value: (l) => l.due },
      { header: 'Left out', width: 12, value: (l) => l.leftOut.amount },
      { header: 'Deposited', width: 14, value: (l) => l.deposited },
      { header: 'Filed, not paid', width: 14, value: (l) => l.filedUnpaid },
      { header: 'Due on', width: 12, value: (l) => l.dueOn },
      { header: 'Standing', width: 30, value: (l) => STATE_TEXT[l.state] },
    ]),
  ].filter((s) => !!s)
  const company = runs[0]!.company
  const month = MONTH.format(input.payMonth)
  return reportFile(
    sheets,
    {
      title: `Statutory figures · ${company.code} · ${month}`,
      preparedBy: `${viewer.name} (${viewer.employeeCode})`,
      coverage: `Each person's PF, ESIC, professional tax and LWF of the approved pay run. A plain sheet made by the HRMS for preparing and checking the returns - not the ECR or ESIC upload file.`,
      filters: [
        { label: 'Company', value: `${company.code} · ${company.name}` },
        { label: 'Pay month', value: month },
      ],
    },
    `statutory-figures-${company.code}-${input.payMonth.toISOString().slice(0, 7)}`,
  )
}

// --- One's own ---

// One's own deductions of each approved month whose payslips are released, scheme by scheme, and whether they reached the
// scheme: "deposited" only when the month's deposit is complete and they are not left out (or a later deposit took them in
// and is paid) - otherwise pending, with why when they are left out
export async function listMine(viewer: CurrentUser) {
  const rows = await depositsRepository.listOwn(viewer.employeeId, ALL_ROLES)
  if (!rows.length) return []
  const runs = [...new Map(rows.map((r) => [r.run.id, { id: r.run.id, payMonth: r.run.payMonth, payslipsReleasedAt: null, company: r.run.company }])).values()]
  const months = [...new Map(runs.map((r) => [`${r.company.id}:${r.payMonth.getTime()}`, { companyId: r.company.id, payMonth: r.payMonth }])).values()]
  const lines = await linesOf(runs, await depositsRepository.listDepositsOfMonths(months), today())
  const lineOf = new Map(lines.map((l) => [keyOf(l.company.id, l.payMonth, l.scheme, l.stateCode), l]))
  return rows.map((r) => ({
    payMonth: r.run.payMonth,
    company: { code: r.run.company.code, name: r.run.company.name },
    employeeCode: r.employeeCode,
    schemes: SCHEMES.flatMap((scheme) => {
      const amount = r.lines.find((l) => l.role === EMPLOYEE_SHARE[scheme])?.amount
      if (!amount) return []
      const line = lineOf.get(keyOf(r.run.company.id, r.run.payMonth, scheme, byState(scheme) ? r.stateCode : null))
      const gap = r.depositGaps.find((g) => g.scheme === scheme)
      const complete = line?.state === 'DEPOSITED' || line?.state === 'PEOPLE_LEFT_OUT'
      // the day the month's deposit was complete: its last payment that took nobody in
      const regular = line?.deposits.filter((d) => d.paidOn && !d.takesIn) ?? []
      const depositedOn = gap
        ? (gap.deposit?.paidOn ?? null)
        : complete
          ? (regular.length ? regular : (line?.deposits.filter((d) => d.paidOn) ?? [])).reduce<Date | null>((last, d) => (!last || d.paidOn! > last ? d.paidOn : last), null)
          : null
      return [
        {
          scheme,
          stateCode: byState(scheme) ? r.stateCode : null,
          amount,
          deposited: !!depositedOn,
          depositedOn,
          // left out of the return: why (taken in by a later deposit not paid yet: still pending, no reason)
          leftOut: gap && !gap.depositId ? gap.reason : null,
          dueOn: line?.dueOn ?? null,
        },
      ]
    }),
  }))
}

// --- The reminder ---

// E-mails the people who record deposits (Statutory deposits Edit over the whole company) every day about the schemes'
// months whose challan is not paid in full, from `depositReminderDays` before the due date on: not deposited, filed but not
// paid, short (never a person's amount). Once the challans are paid, people still left out stay on the page but are not
// e-mailed (the user, 2026-11-28). `only`: just these companies, `now`: another day (tests - as the other jobs' filters)
export async function remindDue(only?: { companyIds: number[] }, now: Date = today()) {
  const settings = await statutoryService.runSettings()
  const of = <T extends { companyId: number }>(rows: T[]) => (only ? rows.filter((r) => only.companyIds.includes(r.companyId)) : rows)
  // data access: a background job over every company - each person is e-mailed only about the companies they cover in full
  const all = of((await depositsRepository.listFinalRuns(SYSTEM_SCOPE, {})).map((r) => ({ ...r, companyId: r.company.id })))
  // (a run from before the classification snapshots is not added up - it waits for its reconciliation)
  const unverified = await depositsRepository.listUnverifiedRuns(all.map((r) => r.id))
  const runs = all.filter((r) => !unverified.has(r.id))
  const deposits = of(await depositsRepository.listDeposits(SYSTEM_SCOPE, {}))
  const due = (await linesOf(runs, deposits, now)).filter(
    (l) => (l.state === 'NOT_DEPOSITED' || l.state === 'FILED_NOT_PAID' || l.state === 'SHORT') && l.dueOn && now.getTime() >= l.dueOn.getTime() - settings.depositReminderDays * DAY,
  )
  if (!due.length) return 'nothing to remind'
  due.sort(URGENT)
  const recipients = await accountsService.mailRecipientsOver('STATUTORY_DEPOSITS', 'WRITE', due.map((l) => ({ ...l, slice: companySlice(l.company.id) })))
  for (const { person, items } of recipients) {
    const lines = items.map((l) => {
      const when = l.daysOverdue ? `overdue ${l.daysOverdue} day${l.daysOverdue === 1 ? '' : 's'}` : `due ${formatDate(l.dueOn!)}`
      const people = l.leftOut.count ? ` - ${l.leftOut.count} ${l.leftOut.count === 1 ? 'person' : 'people'} left out` : ''
      return `- ${l.company.code} · ${SCHEME_NAME[l.scheme]}${l.stateCode ? ` (${l.stateCode})` : ''} · ${MONTH.format(l.payMonth)}: ${when} - ${STATE_TEXT[l.state]}${people}`
    })
    await sendMail({
      to: person.email,
      subject: `Statutory deposits to look at: ${items.length}`,
      text: [
        `Dear ${person.name},`,
        '',
        'These PF, ESIC, professional tax and LWF deposits of approved pay runs are due or overdue:',
        '',
        ...lines,
        '',
        `Record the returns and challans on Statutory deposits: ${env.APP_URL}/manage/statutory-deposits`,
        '',
        'Sent every day from a few days before the due date until the challan is paid.',
      ].join('\n'),
    }).catch((error: unknown) => console.error(`[mail] statutory deposit reminder to ${person.employeeCode} failed:`, error))
  }
  return `${due.length} deposit(s) to look at, reminded ${recipients.length} person(s)`
}
