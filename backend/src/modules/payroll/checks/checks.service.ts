import { ORPCError } from '@orpc/server'
import { levelOver } from '#core/auth/scope'
import { prisma, type DbClient, type EmploymentType, type PayWarning } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { toPaise } from '#shared/utils/money'
import * as calculationRepository from '../calculation/calculation.repository.js'
import { taxYearOf } from '../deductions/deductions.service.js'
import * as peopleService from '../people/people.service.js'
import * as statutoryService from '../statutory/statutory.service.js'
import * as openingsService from '../tax-openings/tax-openings.service.js'
import * as checksRepository from './checks.repository.js'
import type { AcknowledgeInput } from './checks.schema.js'

// Payroll stage 5 (approved by the user 2026-11-27): the run's checks - things about a person that are not errors but
// must be looked at before the run is sent: this month's payment (net zero, no or an incomplete salary account, a big
// change from last month, leaving, absent throughout, a duplicate or large input) and what matters in later months (no
// PAN, a PF member without UAN or Aadhaar, ESIC without an IP number, no PF though the PF wages are within the ceiling, a
// joiner of this tax year without opening tax figures, the EPS age limit soon). Every warning must be acknowledged with
// a comment before the run is sent ("Send for approval" refuses otherwise). Worked out from the run and the employee's
// records while the run is a draft; once sent, the acknowledgements are the record of what was looked at. The warnings
// carry no amounts (Payroll alone may read them); the tolerances are the payroll settings (statutoryService.runSettings).

// --- The rules (pure - unit tested) ---

export type CheckPerson = {
  // the pay worked out: status and net (null when not worked out), last month's net in the same company's run (null: none)
  status: peopleService.PayStatus | null
  net: number | null
  previousNet: number | null
  // the stretch at the period's end, and its monthly gross
  employmentType: EmploymentType
  monthlyGross: number
  inputs: { salaryComponentId: number; amount: number }[]
  allAbsent: boolean
  dateOfBirth: Date | null
  dateOfJoining: Date
  dateOfLeaving: Date | null
  hasPan: boolean
  hasAadhaar: boolean
  salaryAccount: { complete: boolean } | null
  statutory: { pfApplicable: boolean; epsMember: boolean; uan: string | null; esicIpNumber: string | null } | null
  // ESIC was worked out for them this month; their earned PF wages
  esicCovered: boolean
  pfWages: number
  hasTaxOpening: boolean
}
export type CheckContext = {
  periodTo: Date
  taxYearFrom: Date
  pfCeiling: number | null
  epsAgeLimit: number | null
  bigChangePercent: number
  epsAgeSoonMonths: number
}

const addMonths = (date: Date, months: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))

export function warningsOf(p: CheckPerson, ctx: CheckContext): PayWarning[] {
  const out: PayWarning[] = []
  const pf = p.statutory?.pfApplicable ?? false
  if (p.status === 'WORKED_OUT' && p.net === 0) out.push('NET_ZERO')
  if (!p.salaryAccount) out.push('NO_BANK_ACCOUNT')
  else if (!p.salaryAccount.complete) out.push('BANK_INCOMPLETE')
  if (p.status === 'WORKED_OUT' && p.net !== null && p.previousNet !== null && p.previousNet > 0) {
    if (Math.abs(toPaise(p.net) - toPaise(p.previousNet)) * 100 > ctx.bigChangePercent * toPaise(p.previousNet)) out.push('BIG_CHANGE')
  }
  if (p.dateOfLeaving && p.dateOfLeaving <= ctx.periodTo) out.push('LEAVING')
  if (p.allAbsent) out.push('ABSENT_THROUGHOUT')
  const seen = new Set<string>()
  if (p.inputs.some((i) => (seen.has(`${i.salaryComponentId}:${toPaise(i.amount)}`) ? true : (seen.add(`${i.salaryComponentId}:${toPaise(i.amount)}`), false)))) out.push('DUPLICATE_INPUT')
  if (p.monthlyGross > 0 && p.inputs.some((i) => i.amount > p.monthlyGross)) out.push('LARGE_INPUT')
  if (!p.hasPan) out.push('NO_PAN')
  if (pf && !p.statutory?.uan) out.push('NO_UAN')
  if (pf && !p.hasAadhaar) out.push('NO_AADHAAR')
  if (p.esicCovered && !p.statutory?.esicIpNumber) out.push('NO_ESIC_NUMBER')
  // PF is not for consultants (a fee) or apprentices (outside the Act)
  if (!pf && p.employmentType !== 'CONSULTANT' && p.employmentType !== 'APPRENTICE' && ctx.pfCeiling !== null && p.pfWages > 0 && p.pfWages <= ctx.pfCeiling) out.push('NO_PF_UNDER_CEILING')
  if (p.dateOfJoining > ctx.taxYearFrom && !p.hasTaxOpening) out.push('NO_TAX_OPENING')
  if (pf && p.statutory?.epsMember && p.dateOfBirth && ctx.epsAgeLimit !== null) {
    const limit = addMonths(p.dateOfBirth, 12 * ctx.epsAgeLimit)
    if (limit > ctx.periodTo && limit <= addMonths(ctx.periodTo, ctx.epsAgeSoonMonths)) out.push('EPS_AGE_SOON')
  }
  return out
}

// --- The run's warnings, from its records ---

type Run = { id: number; companyId: number; payMonth: Date; attendanceFrom: Date; attendanceTo: Date }

// Every person of a draft run (in the pay period) with their warnings - empty when they have none
export async function currentWarnings(run: Run, db?: DbClient) {
  const { to } = peopleService.payPeriodOf(run)
  const taxYearFrom = taxYearOf(run.payMonth)
  const previousMonth = new Date(Date.UTC(run.payMonth.getUTCFullYear(), run.payMonth.getUTCMonth() - 1, 1))
  const [people, sources, settings, options, totals, esic, pfWages, previous] = await Promise.all([
    peopleService.payPeopleOf(run.id, db),
    calculationRepository.listPaySources(run.id, db),
    statutoryService.loadSettings(db),
    statutoryService.runSettings(db),
    calculationRepository.totalsByPerson(run.id, db),
    calculationRepository.peopleWithRole(run.id, 'ESIC_EMPLOYEE', db),
    checksRepository.pfWagesByPerson(run.id, db),
    checksRepository.findPreviousRun(run.companyId, previousMonth, db),
  ])
  const ids = sources.map((s) => s.employeeId)
  const [facts, openings, previousNets] = await Promise.all([
    employeesService.listPayrollFacts(ids, to, db),
    openingsService.openingsFor(ids, taxYearFrom, db),
    previous ? previousNetsOf(previous.id, db) : new Map<number, number>(),
  ])
  const factsOf = new Map(facts.map((f) => [f.id, f]))
  const opened = new Set(openings.map((o) => o.employeeId))
  const context: CheckContext = {
    periodTo: to,
    taxYearFrom,
    pfCeiling: statutoryService.valueOver(settings.rates, 'PF_WAGE_CEILING', run.attendanceFrom, to),
    epsAgeLimit: statutoryService.valueOn(settings.rates, 'EPS_AGE_LIMIT', to),
    bigChangePercent: options.bigChangePercent,
    epsAgeSoonMonths: options.epsAgeSoonMonths,
  }
  const out = new Map<number, PayWarning[]>()
  for (const source of sources) {
    if (!source.segments.length) continue
    const person = people.get(source.id)!
    const fact = factsOf.get(source.employeeId)!
    const last = source.segments.at(-1)!
    const total = totals.get(source.id)
    out.set(
      source.id,
      warningsOf(
        {
          status: person.status,
          net: person.status === 'WORKED_OUT' && total ? (toPaise(total.earned) - toPaise(total.deducted)) / 100 : null,
          previousNet: previousNets.get(source.employeeId) ?? null,
          employmentType: last.employmentType,
          monthlyGross: last.lines.filter((l) => l.kind === 'EARNING').reduce((sum, l) => sum + l.monthlyAmount, 0),
          inputs: source.inputs,
          allAbsent: person.allAbsent,
          dateOfBirth: fact.dateOfBirth,
          dateOfJoining: fact.dateOfJoining,
          dateOfLeaving: fact.dateOfLeaving,
          hasPan: fact.hasPan,
          hasAadhaar: fact.hasAadhaar,
          salaryAccount: fact.salaryAccount,
          statutory: fact.statutory,
          esicCovered: esic.has(source.id),
          pfWages: pfWages.get(source.id) ?? 0,
          hasTaxOpening: opened.has(source.employeeId),
        },
        context,
      ),
    )
  }
  return out
}

// Last month's net of each employee in the run of the month before (its worked-out people only)
async function previousNetsOf(runId: number, db?: DbClient) {
  await peopleService.assertClassifiedRun(runId, db)
  const [members, totals] = await Promise.all([checksRepository.listMembers(runId, db), calculationRepository.totalsByPerson(runId, db)])
  const nets = new Map<number, number>()
  for (const m of members) {
    const t = totals.get(m.id)
    if (t?.lines && !m.heldFor.length) nets.set(m.employeeId, (toPaise(t.earned) - toPaise(t.deducted)) / 100)
  }
  return nets
}

// How many warnings of a draft run are not acknowledged yet ("Send for approval" refuses while any are)
export async function openWarningsCount(run: Run, db?: DbClient) {
  const [warnings, acks] = await Promise.all([currentWarnings(run, db), checksRepository.listAcks(run.id, db)])
  const done = new Set(acks.map((a) => `${a.payrollRunEmployeeId}:${a.warning}`))
  let open = 0
  for (const [personId, list] of warnings) for (const warning of list) if (!done.has(`${personId}:${warning}`)) open++
  return open
}

// --- From the API ---

const companySlice = (companyId: number) => ({ companyId, plantId: null, departmentId: null })

// The run's warnings with their acknowledgements. A draft: worked out now; once sent: the acknowledgements made before it
// was sent - the record of what was looked at (nothing is worked out again from the employee records)
export async function listChecks(viewer: CurrentUser, { runId }: { runId: number }) {
  const run = await peopleService.runFor(viewer, runId)
  const draft = run.status === 'DRAFT'
  const [acks, members] = await Promise.all([checksRepository.listAcks(run.id), checksRepository.listMembers(run.id)])
  const warnings = draft ? await currentWarnings({ id: run.id, companyId: run.company.id, payMonth: run.payMonth, attendanceFrom: run.attendanceFrom, attendanceTo: run.attendanceTo }) : null
  const ackOf = new Map(acks.map((a) => [`${a.payrollRunEmployeeId}:${a.warning}`, a]))
  const pairs = warnings
    ? [...warnings].flatMap(([personId, list]) => list.map((warning) => ({ personId, warning })))
    : acks.map((a) => ({ personId: a.payrollRunEmployeeId, warning: a.warning }))
  const employeeOf = new Map(members.map((m) => [m.id, m.employeeId]))
  const [names, person] = await Promise.all([
    employeesService.lookupPeople(pairs.map((p) => employeeOf.get(p.personId))),
    employeesService.lookupPeople(acks.flatMap((a) => [a.createdById, a.updatedById])),
  ])
  const items = pairs.map(({ personId, warning }) => {
    const ack = ackOf.get(`${personId}:${warning}`)
    const who = names(employeeOf.get(personId))
    return {
      personId,
      employeeCode: who?.employeeCode ?? '',
      name: who?.name ?? '',
      warning,
      // about the viewer's own pay: someone else acknowledges it (acknowledge refuses it), so the page never offers it
      own: employeeOf.get(personId) === viewer.employeeId,
      acknowledgement: ack ? { comment: ack.comment, by: person(ack.updatedById), at: ack.updatedAt } : null,
    }
  })
  return {
    items,
    total: items.length,
    open: items.filter((i) => !i.acknowledgement).length,
    frozen: !draft,
    canAcknowledge: draft && levelOver(viewer, 'PAYROLL', companySlice(run.company.id)) === 'WRITE',
  }
}

// Acknowledges warnings with one comment: only while the run is a draft, by someone with Payroll Edit over the whole
// company, never their own, and only warnings that apply now
export async function acknowledge(viewer: CurrentUser, { runId, items, comment }: AcknowledgeInput) {
  return prisma.$transaction(
    async (tx) => {
      const run = await peopleService.draftRunFor(viewer, runId, 'Acknowledging payroll warnings', tx)
      const [warnings, members] = await Promise.all([
        currentWarnings({ id: run.id, companyId: run.company.id, payMonth: run.payMonth, attendanceFrom: run.attendanceFrom, attendanceTo: run.attendanceTo }, tx),
        checksRepository.listMembers(run.id, tx),
      ])
      const employeeOf = new Map(members.map((m) => [m.id, m.employeeId]))
      for (const item of items) {
        if (!employeeOf.has(item.personId)) throw new ORPCError('NOT_FOUND', { message: 'This person is not in the payroll run' })
        if (employeeOf.get(item.personId) === viewer.employeeId) throw new ORPCError('FORBIDDEN', { message: 'Nobody acknowledges warnings about their own pay - ask a colleague with Payroll access' })
        if (!warnings.get(item.personId)?.includes(item.warning)) throw new ORPCError('BAD_REQUEST', { message: 'A warning picked no longer applies - reload the checks' })
      }
      await checksRepository.saveAcks(
        items.map((i) => ({ payrollRunEmployeeId: i.personId, warning: i.warning })),
        comment,
        viewer.employeeId,
        tx,
      )
      return { acknowledged: items.length }
    },
    { timeout: 120_000 },
  )
}
