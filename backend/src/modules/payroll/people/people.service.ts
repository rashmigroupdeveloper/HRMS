import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { assertWholeSlice, levelOver, wholeCompanyScopeOf } from '#core/auth/scope'
import { prisma, type ActorId, type DayStatus, type DbClient, type PayClass, type PayHold } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { fromPaise, toPaise } from '#shared/utils/money'
import * as payrollRepository from '../payroll.repository.js'
import * as calculationRepository from '../calculation/calculation.repository.js'
import * as checksRepository from '../checks/checks.repository.js'
import * as daysRepository from '../days/days.repository.js'
import * as peopleRepository from './people.repository.js'
import type { PersonRow, SegmentRow } from './people.repository.js'
import type { PeopleListInput } from './people.schema.js'

// Payroll stage 2 (approved 2026-11-26): who is in a pay run and the salary copy it is built from.
// A run keeps its own copy of the salary and placement in force on each day of its period (salary rows and the latest
// job-timeline row are corrected in place, so a pointer would not record what the run used). The copy is written when
// the draft is created and on "Refresh from employee records" while the run is a draft.

const DAY = 86_400_000
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY)
const later = (a: Date, b: Date) => (a > b ? a : b)
const earlier = (a: Date, b: Date) => (a < b ? a : b)
export const daysIn = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY) + 1

// --- The run's period ---

// The days a run pays (decided by the user, 2026-11-27: salary is for 26th to 25th, not the calendar month, and the
// start day must stay changeable - replaces "the calendar month until the cut-off is agreed"): the attendance
// cycle of its pay month, as captured on the run when it was created - with the company's start day of 26, "March" pays
// 26 Feb - 25 Mar. The start day is a setting (Attendance setup, attendance.locks.setCycleStart), never a number in code:
// changing it moves the runs created afterwards, and a run already created keeps its own dates. Every reader of a run's
// period goes through this one function, so a different rule would change only here, not the tables.
export function payPeriodOf(run: { attendanceFrom: Date; attendanceTo: Date }) {
  return { from: run.attendanceFrom, to: run.attendanceTo }
}

// --- Who is in the run, and their segments (pure - unit tested) ---

type Source = employeesService.PayrollRunSource
type JobRow = Source['jobRecords'][number]
type SalaryRow = Source['salaries'][number]

// The row in force on a day: the last one starting on or before it (rows sorted by effectiveFrom)
function inForce<T extends { effectiveFrom: Date }>(rows: T[], day: Date): T | undefined {
  let found: T | undefined
  for (const row of rows) {
    if (row.effectiveFrom <= day) found = row
    else break
  }
  return found
}

const sameSegment = (a: { job: JobRow; salary: SalaryRow | undefined }, b: { job: JobRow; salary: SalaryRow | undefined }) =>
  a.salary?.id === b.salary?.id &&
  a.job.plantId === b.job.plantId &&
  a.job.departmentId === b.job.departmentId &&
  a.job.costCenterId === b.job.costCenterId &&
  a.job.workLocationId === b.job.workLocationId &&
  a.job.employmentType === b.job.employmentType &&
  a.job.workforceCategory === b.job.workforceCategory

// The people a company pays in [from, to] and, for each, the stretches of days with one salary and one placement.
// A person is in when the job timeline places them in the company on at least one day between their joining and leaving
// dates (both included). The days are cut at every salary change and every job-timeline change; stretches in another
// company (a transfer in the period) are left out - that company's run pays them. Next to each other with nothing copied
// changed (e.g. only the manager changed) they stay one segment.
export function buildPeople(companyId: number, from: Date, to: Date, sources: Source[]): PersonRow[] {
  const people: PersonRow[] = []
  for (const source of sources) {
    const start = later(from, source.dateOfJoining)
    const end = source.dateOfLeaving ? earlier(to, source.dateOfLeaving) : to
    if (start > end) continue
    const cuts = new Set<number>([start.getTime()])
    for (const row of [...source.jobRecords, ...source.salaries]) {
      if (row.effectiveFrom > start && row.effectiveFrom <= end) cuts.add(row.effectiveFrom.getTime())
    }
    const days = [...cuts].sort((a, b) => a - b)
    const parts: { from: Date; to: Date; job: JobRow; salary: SalaryRow | undefined }[] = []
    days.forEach((time, i) => {
      const partFrom = new Date(time)
      const next = days[i + 1]
      const partTo = next !== undefined ? addDays(new Date(next), -1) : end
      const job = inForce(source.jobRecords, partFrom)
      if (!job || job.companyId !== companyId) return
      const salary = inForce(source.salaries, partFrom)
      const last = parts.at(-1)
      if (last && addDays(last.to, 1).getTime() === partFrom.getTime() && sameSegment(last, { job, salary })) last.to = partTo
      else parts.push({ from: partFrom, to: partTo, job, salary })
    })
    if (!parts.length) continue
    const segments: SegmentRow[] = parts.map((p) => ({
      fromDate: p.from,
      toDate: p.to,
      plantId: p.job.plantId,
      departmentId: p.job.departmentId,
      costCenterId: p.job.costCenterId,
      workLocationId: p.job.workLocationId,
      employmentType: p.job.employmentType,
      workforceCategory: p.job.workforceCategory,
      employeeSalaryId: p.salary?.id ?? null,
      annualCtc: p.salary?.annualCtc ?? null,
      currency: p.salary?.currency ?? null,
      lines: p.salary?.lines.map((l) => ({ salaryComponentId: l.salaryComponentId, monthlyAmount: l.monthlyAmount })) ?? [],
    }))
    people.push({ employeeId: source.id, employeeCode: parts.at(-1)!.job.employeeCode, segments })
  }
  return people
}

// --- Writing the copy ---

// Rebuilds the run's people and salary copy from the employee records, inside the caller's transaction. People who no
// longer belong are removed - except those with inputs, who stay (with no days) so their inputs are not lost. The days
// taken from attendance and the pay worked out from them (stage 3) belong to the old stretches, so they are removed too
// and worked out again.
export async function rebuildCopy(run: { id: number; companyId: number; attendanceFrom: Date; attendanceTo: Date }, actorId: ActorId, tx: DbClient) {
  const { from, to } = payPeriodOf(run)
  const people = buildPeople(run.companyId, from, to, await employeesService.listForPayrollRun(run.companyId, from, to, tx))
  const belong = new Set(people.map((p) => p.employeeId))
  const dropIds = (await peopleRepository.listMembers(run.id, tx)).filter((m) => !belong.has(m.employeeId) && m._count.inputs === 0).map((m) => m.id)
  // (a dropped person's acknowledgements go first, through Prisma - so the change history keeps them; stage 5)
  await checksRepository.deleteAcksOf(dropIds, tx)
  await peopleRepository.replaceCopy(run.id, people, dropIds, actorId, tx)
  await daysRepository.clearDays(run.id, tx)
  await calculationRepository.clearLines(run.id, actorId, tx)
  await payrollRepository.markRefreshed(run.id, actorId, tx)
  return { people: people.length }
}

// --- Reading, from the API ---

const companySlice = (companyId: number) => ({ companyId, plantId: null, departmentId: null })

// The run as the viewer may see it (whole-company Payroll scope), or NOT_FOUND
export async function runFor(viewer: CurrentUser, runId: number, db?: DbClient) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const run = await payrollRepository.find(runId, wholeCompanyScopeOf(viewer, 'PAYROLL'), db)
  if (!run) throw new ORPCError('NOT_FOUND', { message: 'No payroll run found' })
  return run
}

// The run as the viewer may change it: found in scope, Payroll Edit over the whole company, and still a draft
export async function draftRunFor(viewer: CurrentUser, runId: number, what: string, db?: DbClient) {
  const run = await runFor(viewer, runId, db)
  assertAccess(viewer.access, 'PAYROLL', 'WRITE')
  assertWholeSlice(viewer, 'PAYROLL', companySlice(run.company.id), what)
  if (run.status !== 'DRAFT') throw new ORPCError('CONFLICT', { message: 'This payroll run is no longer a draft - it cannot be changed' })
  return run
}

// Salary figures inside a run need Salary View covering the whole company as well as Payroll (the user, 2026-11-26)
export function seesSalaries(viewer: CurrentUser, companyId: number) {
  return levelOver(viewer, 'SALARY', companySlice(companyId)) !== undefined
}

// amounts added up in whole paise (a missing one counts as nothing)
const total = (amounts: (number | null)[]) => fromPaise(amounts.reduce<number>((sum, a) => sum + toPaise(a ?? 0), 0))

const grossOf = (lines: { kind: string; monthlyAmount: number }[]) =>
  fromPaise(lines.filter((l) => l.kind === 'EARNING').reduce((sum, l) => sum + toPaise(l.monthlyAmount), 0))

// --- The days of each person (stage 3, 2026-11-27): added up from the run's day rows ---

type HalfGroup = { firstHalf: PayClass; secondHalf: PayClass; firstStatus: DayStatus | null; secondStatus: DayStatus | null; days: number }
// a half that shows the person was there or accounted for
const ATTENDED = new Set<DayStatus>(['PRESENT', 'ON_DUTY', 'LEAVE', 'MISSED_PUNCH'])

// A person's days in the run, in days (a half counts 0.5), from their day rows grouped by class and status.
// `allAbsent`: absent on every working half and never present, on duty, on leave or with a single punch - most likely
// someone who does not punch at all. Until attendance can mark such people (BACKLOG item 31), payroll lists them to be
// checked rather than paying nothing unnoticed (the user, 2026-11-27).
export function totalsOf(groups: HalfGroup[]) {
  let paid = 0
  let unpaid = 0
  let unclear = 0
  let absent = 0
  let attended = 0
  for (const group of groups) {
    for (const [payClass, status] of [[group.firstHalf, group.firstStatus], [group.secondHalf, group.secondStatus]] as const) {
      if (payClass === 'PAID') paid += group.days
      else if (payClass === 'UNPAID') unpaid += group.days
      else unclear += group.days
      if (status === 'ABSENT') absent += group.days
      else if (status && ATTENDED.has(status)) attended += group.days
    }
  }
  return { paidDays: paid / 2, unpaidDays: unpaid / 2, unclearDays: unclear / 2, allAbsent: absent > 0 && attended === 0 }
}
export type DayTotals = ReturnType<typeof totalsOf>

// Every person's totals in a run (by the person's id in the run) - nobody has any until the days are worked out (also
// the payslips and the register, stage 6)
export async function dayTotalsOf(runId: number, db?: DbClient) {
  const byPerson = new Map<number, HalfGroup[]>()
  for (const group of await daysRepository.groupHalves(runId, db)) {
    byPerson.set(group.payrollRunEmployeeId, [...(byPerson.get(group.payrollRunEmployeeId) ?? []), group])
  }
  return new Map([...byPerson].map(([id, groups]) => [id, totalsOf(groups)]))
}

// --- Whether a person's pay can be worked out (stages 3 and 4, 2026-11-27) ---

// Why stage 3 holds a person's pay - never guessed, listed for HR (pure - unit tested; stage 4 adds its own reasons):
// - NOT_IN_PERIOD: no days in the pay period any more (kept in the run only for their inputs);
// - NO_SALARY: days with no salary in force;
// - OTHER_CURRENCY: a salary in another currency than INR - an India run does not pay it;
// - DAYS_MISSING: days attendance has no answer for ("unclear" halves - only when records change after the lock, e.g.
//   a joiner added later with a joining date in a locked month; locking the month again works their days out).
// "Work out pay" stores the reasons on the person (PayrollRunEmployee.heldFor / heldNote); the lists read them back.
export function holdReasonsOf(segments: { annualCtc: number | null; currency: string | null }[], unclearDays: number): PayHold[] {
  const reasons: PayHold[] = []
  if (!segments.length) reasons.push('NOT_IN_PERIOD')
  if (segments.some((s) => s.annualCtc === null)) reasons.push('NO_SALARY')
  if (segments.some((s) => s.currency !== null && s.currency !== 'INR')) reasons.push('OTHER_CURRENCY')
  if (unclearDays > 0) reasons.push('DAYS_MISSING')
  return reasons
}

// WORKED_OUT: pay worked out; HELD: it could not be (the stored reasons) - their earnings are still shown when they
// could be worked out (a stage 4 hold: the user, 2026-11-27), never deductions or net; AGAIN: their inputs changed after
// the pay was worked out (the change removed their lines and reasons) - press "Work out pay" again
export type PayStatus = 'WORKED_OUT' | 'HELD' | 'AGAIN'
type PayState = { status: PayStatus; heldFor: PayHold[]; heldNote: string | null; earned: number | null; deducted: number | null; net: number | null; employer: number | null }

const stateOf = (heldFor: PayHold[], heldNote: string | null, totals: { lines: number; earned: number; deducted: number; employer: number } | undefined): PayState => {
  const status: PayStatus = heldFor.length ? 'HELD' : totals?.lines ? 'WORKED_OUT' : 'AGAIN'
  if (status === 'HELD') return { status, heldFor, heldNote, earned: totals?.lines ? totals.earned : null, deducted: null, net: null, employer: null }
  if (status === 'AGAIN') return { status, heldFor, heldNote, earned: null, deducted: null, net: null, employer: null }
  return { status, heldFor, heldNote, earned: totals!.earned, deducted: totals!.deducted, net: fromPaise(toPaise(totals!.earned) - toPaise(totals!.deducted)), employer: totals!.employer }
}

// Every person's pay state in a worked-out run, from their stored reasons and their lines
async function payStatesOf(runId: number, people: { id: number; heldFor: PayHold[]; heldNote: string | null }[], db?: DbClient) {
  const totals = await calculationRepository.totalsByPerson(runId, db)
  return new Map<number, PayState>(people.map((p) => [p.id, stateOf(p.heldFor, p.heldNote, totals.get(p.id))]))
}

// Each person's pay status and "absent throughout" in a worked-out run (the run's checks, stage 5)
export async function payPeopleOf(runId: number, db?: DbClient) {
  const [dayTotals, people] = await Promise.all([dayTotalsOf(runId, db), peopleRepository.listPeople(runId, db)])
  const pay = await payStatesOf(runId, people, db)
  return new Map(people.map((p) => [p.id, { status: pay.get(p.id)!.status as PayStatus | null, allAbsent: dayTotals.get(p.id)?.allAbsent ?? false }]))
}

// For the run's header: how many people have unpaid days, how many need a look (unclear days, absent throughout, or
// pay not worked out), how many have their pay held or to work out again, and the totals - earned gross, deductions,
// net pay, employer contributions (null when the viewer may not see salaries) - null as a whole until worked out
export async function runCountsOf(run: { id: number; computedAt: Date | null }, showSalary: boolean, db?: DbClient) {
  if (!run.computedAt) return null
  const [dayTotals, people, inPf] = await Promise.all([dayTotalsOf(run.id, db), peopleRepository.listPeople(run.id, db), calculationRepository.peopleWithRole(run.id, 'PF_EMPLOYEE', db)])
  const pay = await payStatesOf(run.id, people, db)
  const zero = { paidDays: 0, unpaidDays: 0, unclearDays: 0, allAbsent: false }
  const states = people.map((p) => ({ days: dayTotals.get(p.id) ?? zero, pay: pay.get(p.id)! }))
  return {
    unpaidDays: states.filter((s) => s.days.unpaidDays > 0).length,
    toCheck: states.filter((s) => s.days.unclearDays > 0 || s.days.allAbsent || s.pay.status !== 'WORKED_OUT').length,
    held: states.filter((s) => s.pay.status === 'HELD').length,
    again: states.filter((s) => s.pay.status === 'AGAIN').length,
    earnedGross: showSalary ? total(states.map((s) => s.pay.earned)) : null,
    deductions: showSalary ? total(states.map((s) => s.pay.deducted)) : null,
    netPay: showSalary ? total(states.map((s) => s.pay.net)) : null,
    employerContributions: showSalary ? total(states.map((s) => s.pay.employer)) : null,
    // stage 4: PF is worked out only for people whose statutory details say "PF applicable" - how many worked-out people
    // have none, so a missing tick is not a silent zero
    withoutPf: people.filter((p) => pay.get(p.id)!.status === 'WORKED_OUT' && !inPf.has(p.id)).length,
  }
}

export async function listPeople(viewer: CurrentUser, input: PeopleListInput) {
  const run = await runFor(viewer, input.runId)
  const showSalary = seesSalaries(viewer, run.company.id)
  const computed = run.computedAt !== null
  const [rows, dayTotals] = await Promise.all([peopleRepository.listPeople(run.id), computed ? dayTotalsOf(run.id) : null])
  const [person, pay, inPf] = await Promise.all([
    employeesService.lookupPeople(rows.map((r) => r.employeeId)),
    dayTotals ? payStatesOf(run.id, rows) : null,
    dayTotals ? calculationRepository.peopleWithRole(run.id, 'PF_EMPLOYEE') : null,
  ])
  const all = rows.map((row) => {
    const latest = row.segments.at(-1)
    // (worked out, but someone with no days in the period has no rows: zeros)
    const days = dayTotals ? (dayTotals.get(row.id) ?? { paidDays: 0, unpaidDays: 0, unclearDays: 0, allAbsent: false }) : null
    const state = pay?.get(row.id) ?? null
    const flags = {
      noSalary: row.segments.some((s) => s.annualCtc === null),
      changed: row.segments.length > 1,
      hasInputs: row._count.inputs > 0,
      notInPeriod: row.segments.length === 0,
      unpaidDays: !!days && days.unpaidDays > 0,
      unclearDays: !!days && days.unclearDays > 0,
      allAbsent: !!days && days.allAbsent,
      // stage 3: pay worked out but not for this person (held, or their inputs changed since)
      payNotWorkedOut: !!state && state.status !== 'WORKED_OUT',
      // stage 4: pay worked out with no PF (their statutory details do not say "PF applicable")
      noPf: !!state && state.status === 'WORKED_OUT' && !inPf?.has(row.id),
    }
    return {
      id: row.id,
      employeeCode: row.employeeCode,
      name: person(row.employeeId)?.name ?? '',
      days: row.segments.reduce((sum, s) => sum + daysIn(s.fromDate, s.toDate), 0),
      // from the locked attendance (stage 3) - null until the pay is worked out
      paidDays: days?.paidDays ?? null,
      unpaidDays: days?.unpaidDays ?? null,
      unclearDays: days?.unclearDays ?? null,
      from: row.segments[0]?.fromDate ?? null,
      to: latest?.toDate ?? null,
      segments: row.segments.length,
      inputs: row._count.inputs,
      annualCtc: showSalary ? (latest?.annualCtc ?? null) : null,
      monthlyGross: showSalary && latest && latest.annualCtc !== null ? grossOf(latest.lines) : null,
      // stages 3-4: whether the pay is worked out (null until "Work out pay"), why it is held, what they earned in the
      // period and their net pay (salary figures: null when hidden or not worked out)
      payStatus: state?.status ?? null,
      heldFor: state?.heldFor ?? [],
      heldNote: state?.heldNote ?? null,
      earnedGross: showSalary ? (state?.earned ?? null) : null,
      deductions: showSalary ? (state?.deducted ?? null) : null,
      netPay: showSalary ? (state?.net ?? null) : null,
      flags,
    }
  })
  const counts = {
    all: all.length,
    noSalary: all.filter((p) => p.flags.noSalary).length,
    changed: all.filter((p) => p.flags.changed).length,
    hasInputs: all.filter((p) => p.flags.hasInputs).length,
    notInPeriod: all.filter((p) => p.flags.notInPeriod).length,
    unpaidDays: all.filter((p) => p.flags.unpaidDays).length,
    unclearDays: all.filter((p) => p.flags.unclearDays).length,
    allAbsent: all.filter((p) => p.flags.allAbsent).length,
    payNotWorkedOut: all.filter((p) => p.flags.payNotWorkedOut).length,
    noPf: all.filter((p) => p.flags.noPf).length,
  }
  const flagKey = { NO_SALARY: 'noSalary', CHANGED: 'changed', HAS_INPUTS: 'hasInputs', NOT_IN_PERIOD: 'notInPeriod', UNPAID_DAYS: 'unpaidDays', UNCLEAR_DAYS: 'unclearDays', ALL_ABSENT: 'allAbsent', PAY_NOT_WORKED_OUT: 'payNotWorkedOut', NO_PF: 'noPf' } as const
  const text = input.search?.toLowerCase()
  const matching = all.filter(
    (p) => (!input.flag || p.flags[flagKey[input.flag]]) && (!text || p.employeeCode.toLowerCase().includes(text) || p.name.toLowerCase().includes(text)),
  )
  const items = matching.slice((input.page - 1) * input.pageSize, input.page * input.pageSize)
  return { items, total: matching.length, counts, salaryHidden: !showSalary, daysWorkedOut: computed }
}

export async function getPerson(viewer: CurrentUser, { runId, personId }: { runId: number; personId: number }) {
  const run = await runFor(viewer, runId)
  const showSalary = seesSalaries(viewer, run.company.id)
  const row = await peopleRepository.findPerson(run.id, personId)
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'This person is not in the payroll run' })
  const [person, days, lines] = await Promise.all([
    employeesService.lookupPeople([row.employeeId]),
    run.computedAt ? daysRepository.listPersonDays(row.id) : null,
    run.computedAt ? calculationRepository.listPersonLines(row.id) : null,
  ])
  const dayTotals = days ? totalsOf(days.map((d) => ({ ...d, days: 1 }))) : null
  // stages 3-4: the pay worked out for them - null until "Work out pay"; the amounts are salary figures (hidden without
  // Salary View over the whole company), whether it is worked out and why not is shown to every Payroll viewer
  const sumOf = (kind: string) => fromPaise((lines ?? []).filter((l) => l.component.kind === kind).reduce((sum, l) => sum + toPaise(l.amount), 0))
  const state = lines && dayTotals ? stateOf(row.heldFor, row.heldNote, { lines: lines.filter((l) => l.component.kind === 'EARNING').length, earned: sumOf('EARNING'), deducted: sumOf('DEDUCTION'), employer: sumOf('EMPLOYER_CONTRIBUTION') }) : null
  const pay = state
    ? {
        status: state.status,
        heldFor: state.heldFor,
        heldNote: state.heldNote,
        periodDays: daysIn(payPeriodOf(run).from, payPeriodOf(run).to),
        lines: showSalary ? lines!.map((l) => ({ ...l, fromInput: l.component.enteredMonthly })) : null,
        earnedGross: showSalary ? state.earned : null,
        deductions: showSalary ? state.deducted : null,
        netPay: showSalary ? state.net : null,
        employerContributions: showSalary ? state.employer : null,
      }
    : null
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    name: person(row.employeeId)?.name ?? '',
    salaryHidden: !showSalary,
    // stage 3: each day as the run took it from the locked attendance, and the totals - null until worked out
    days,
    dayTotals,
    pay,
    segments: row.segments.map(({ employeeSalary, lines, annualCtc, currency, employeeSalaryId, ...segment }) => ({
      ...segment,
      days: daysIn(segment.fromDate, segment.toDate),
      hasSalary: annualCtc !== null,
      salary: showSalary && annualCtc !== null
        ? {
            annualCtc,
            currency,
            effectiveFrom: employeeSalary?.effectiveFrom ?? null,
            reason: employeeSalary?.reason ?? null,
            monthlyGross: grossOf(lines.map((l) => ({ kind: l.salaryComponent.kind, monthlyAmount: l.monthlyAmount }))),
            lines: lines.map((l) => ({ component: l.salaryComponent, monthlyAmount: l.monthlyAmount })),
          }
        : null,
      employeeSalaryId: showSalary ? employeeSalaryId : null,
    })),
  }
}

// --- Refreshing, from the API ---

export async function refresh(viewer: CurrentUser, { runId, expectedRefreshedAt }: { runId: number; expectedRefreshedAt: Date | null }) {
  return prisma.$transaction(
    async (tx) => {
      const run = await draftRunFor(viewer, runId, 'Refreshing a payroll run', tx)
      const seen = expectedRefreshedAt?.getTime() ?? null
      if ((run.peopleRefreshedAt?.getTime() ?? null) !== seen) {
        throw new ORPCError('CONFLICT', { message: 'Someone refreshed this run in the meantime - reload it to see the latest people' })
      }
      const { people } = await rebuildCopy({ id: run.id, companyId: run.company.id, attendanceFrom: run.attendanceFrom, attendanceTo: run.attendanceTo }, viewer.employeeId, tx)
      return { people }
    },
    { timeout: 120_000 },
  )
}
