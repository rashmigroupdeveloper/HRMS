import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { assertWholeSlice, levelOver, wholeCompanyScopeOf } from '#core/auth/scope'
import { prisma, type ActorId, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { fromPaise, toPaise } from '#shared/utils/money'
import * as payrollRepository from '../payroll.repository.js'
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
// longer belong are removed - except those with inputs, who stay (with no days) so their inputs are not lost.
export async function rebuildCopy(run: { id: number; companyId: number; attendanceFrom: Date; attendanceTo: Date }, actorId: ActorId, tx: DbClient) {
  const { from, to } = payPeriodOf(run)
  const people = buildPeople(run.companyId, from, to, await employeesService.listForPayrollRun(run.companyId, from, to, tx))
  const belong = new Set(people.map((p) => p.employeeId))
  const dropIds = (await peopleRepository.listMembers(run.id, tx)).filter((m) => !belong.has(m.employeeId) && m._count.inputs === 0).map((m) => m.id)
  await peopleRepository.replaceCopy(run.id, people, dropIds, actorId, tx)
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

const grossOf = (lines: { kind: string; monthlyAmount: number }[]) =>
  fromPaise(lines.filter((l) => l.kind === 'EARNING').reduce((sum, l) => sum + toPaise(l.monthlyAmount), 0))

export async function listPeople(viewer: CurrentUser, input: PeopleListInput) {
  const run = await runFor(viewer, input.runId)
  const showSalary = seesSalaries(viewer, run.company.id)
  const rows = await peopleRepository.listPeople(run.id)
  const person = await employeesService.lookupPeople(rows.map((r) => r.employeeId))
  const all = rows.map((row) => {
    const latest = row.segments.at(-1)
    const flags = {
      noSalary: row.segments.some((s) => s.annualCtc === null),
      changed: row.segments.length > 1,
      hasInputs: row._count.inputs > 0,
      notInPeriod: row.segments.length === 0,
    }
    return {
      id: row.id,
      employeeCode: row.employeeCode,
      name: person(row.employeeId)?.name ?? '',
      days: row.segments.reduce((sum, s) => sum + daysIn(s.fromDate, s.toDate), 0),
      from: row.segments[0]?.fromDate ?? null,
      to: latest?.toDate ?? null,
      segments: row.segments.length,
      inputs: row._count.inputs,
      annualCtc: showSalary ? (latest?.annualCtc ?? null) : null,
      monthlyGross: showSalary && latest && latest.annualCtc !== null ? grossOf(latest.lines) : null,
      flags,
    }
  })
  const counts = {
    all: all.length,
    noSalary: all.filter((p) => p.flags.noSalary).length,
    changed: all.filter((p) => p.flags.changed).length,
    hasInputs: all.filter((p) => p.flags.hasInputs).length,
    notInPeriod: all.filter((p) => p.flags.notInPeriod).length,
  }
  const flagKey = { NO_SALARY: 'noSalary', CHANGED: 'changed', HAS_INPUTS: 'hasInputs', NOT_IN_PERIOD: 'notInPeriod' } as const
  const text = input.search?.toLowerCase()
  const matching = all.filter(
    (p) => (!input.flag || p.flags[flagKey[input.flag]]) && (!text || p.employeeCode.toLowerCase().includes(text) || p.name.toLowerCase().includes(text)),
  )
  const items = matching.slice((input.page - 1) * input.pageSize, input.page * input.pageSize)
  return { items, total: matching.length, counts, salaryHidden: !showSalary }
}

export async function getPerson(viewer: CurrentUser, { runId, personId }: { runId: number; personId: number }) {
  const run = await runFor(viewer, runId)
  const showSalary = seesSalaries(viewer, run.company.id)
  const row = await peopleRepository.findPerson(run.id, personId)
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'This person is not in the payroll run' })
  const person = await employeesService.lookupPeople([row.employeeId])
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    name: person(row.employeeId)?.name ?? '',
    salaryHidden: !showSalary,
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
