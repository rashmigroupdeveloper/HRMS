import { ORPCError } from '@orpc/server'
import { reportFile, reportSheet, type ReportField } from '#core/excel/report'
import type { PayHold } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { fromPaise, toPaise } from '#shared/utils/money'
import * as peopleService from '../people/people.service.js'
import * as payslipsRepository from '../payslips/payslips.repository.js'
import * as registerRepository from './register.repository.js'
import type { RegisterInput } from './register.schema.js'

// Payroll stage 6 (approved by the user 2026-11-27): a run's salary register as Excel - one row per person with their days
// and every component worked out, then the totals per component. For a run not final yet it can be downloaded too
// (preparers and approvers check it before sending and approving), and then every sheet says "DRAFT - not final" with the
// time the pay was worked out. Salary figures: Payroll and Salary View over the whole company.

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const STAMP = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const DAY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const KIND_ORDER = { EARNING: 0, DEDUCTION: 1, EMPLOYER_CONTRIBUTION: 2 } as const
// why a person's pay is held (PayHold - change both together with the run page's labels)
const HOLD: Record<PayHold, string> = {
  NOT_IN_PERIOD: 'no days in the period',
  NO_SALARY: 'no salary',
  OTHER_CURRENCY: 'salary in another currency',
  DAYS_MISSING: 'days missing',
  NO_WORK_LOCATION: 'no work location',
  NO_RATE: 'a statutory rate missing',
  NO_COMPONENT: 'a statutory component missing',
  OVER_HALF: 'deductions over half the wages',
  TAX_TO_TYPE: 'TDS to type',
}
const sum = (amounts: number[]) => fromPaise(amounts.reduce((total, a) => total + toPaise(a), 0))

export async function exportRegister(viewer: CurrentUser, { runId }: RegisterInput) {
  const run = await peopleService.runFor(viewer, runId)
  if (!peopleService.seesSalaries(viewer, run.company.id)) {
    throw new ORPCError('FORBIDDEN', { message: 'The salary register shows salaries - it needs Salary View covering the whole company as well as Payroll' })
  }
  if (!run.computedAt) throw new ORPCError('BAD_REQUEST', { message: 'Work out the pay first - the register is made from it' })
  const [people, lines, days] = await Promise.all([registerRepository.listPeople(run.id), payslipsRepository.listLines(run.id, undefined), peopleService.dayTotalsOf(run.id)])
  const person = await employeesService.lookupPeople(people.map((p) => p.employeeId))

  // the components worked out, earnings first, then deductions and what the company pays on top - each in the payslip's order
  const components = [...new Map(lines.map((l) => [l.component.id, l.component])).values()].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
  const amountOf = new Map(lines.map((l) => [`${l.personId}:${l.component.id}`, l.amount]))
  const amountsOf = (personId: number, kind: keyof typeof KIND_ORDER) => components.filter((c) => c.kind === kind).map((c) => amountOf.get(`${personId}:${c.id}`) ?? 0)
  const rows = people.map((p) => {
    const last = p.segments[0]
    const total = days.get(p.id)
    const workedOut = lines.some((l) => l.personId === p.id && l.component.kind === 'EARNING')
    const earned = sum(amountsOf(p.id, 'EARNING'))
    const deducted = sum(amountsOf(p.id, 'DEDUCTION'))
    const held = p.heldFor.length > 0
    return {
      id: p.id,
      employeeCode: p.employeeCode,
      name: person(p.employeeId)?.name ?? '',
      department: last?.department.name ?? null,
      plant: last?.plant.name ?? null,
      costCentre: last?.costCenter?.code ?? null,
      location: last?.workLocation?.name ?? null,
      paidDays: total?.paidDays ?? null,
      unpaidDays: total?.unpaidDays ?? null,
      earned: workedOut ? earned : null,
      // a held person's deductions and net are not worked out (their earnings are shown)
      deducted: workedOut && !held ? deducted : null,
      net: workedOut && !held ? sum([earned, -deducted]) : null,
      employer: workedOut && !held ? sum(amountsOf(p.id, 'EMPLOYER_CONTRIBUTION')) : null,
      status: held ? `Held: ${p.heldFor.map((h) => HOLD[h]).join(', ')}` : workedOut ? 'Worked out' : 'To work out again',
    }
  })
  type Row = (typeof rows)[number]
  const componentColumn = (c: (typeof components)[number]): ReportField<Row> => ({ header: c.name, width: 13, value: (r) => (r.earned === null ? null : (amountOf.get(`${r.id}:${c.id}`) ?? 0)) })
  const final = run.status === 'FINALISED'
  const draft = final ? '' : 'DRAFT - not final · '
  const period = peopleService.payPeriodOf(run)
  const month = MONTH.format(run.payMonth)

  const register = reportSheet(`${final ? '' : 'DRAFT '}Register`, rows, [
    { header: 'Employee code', text: true, width: 14, value: (r) => r.employeeCode },
    { header: 'Name', width: 26, value: (r) => r.name },
    { header: 'Department', width: 18, value: (r) => r.department },
    { header: 'Plant', width: 16, value: (r) => r.plant },
    { header: 'Cost centre', text: true, width: 12, value: (r) => r.costCentre },
    { header: 'Work location', width: 16, value: (r) => r.location },
    { header: 'Days paid', width: 9, value: (r) => r.paidDays },
    { header: 'Unpaid days', width: 9, value: (r) => r.unpaidDays },
    ...components.filter((c) => c.kind === 'EARNING').map(componentColumn),
    { header: 'Earned gross', width: 13, value: (r) => r.earned },
    ...components.filter((c) => c.kind === 'DEDUCTION').map((c) => ({ ...componentColumn(c), value: (r: Row) => (r.deducted === null ? null : (amountOf.get(`${r.id}:${c.id}`) ?? 0)) })),
    { header: 'Total deductions', width: 13, value: (r) => r.deducted },
    { header: 'Net pay', width: 13, value: (r) => r.net },
    ...components.filter((c) => c.kind === 'EMPLOYER_CONTRIBUTION').map((c) => ({ ...componentColumn(c), value: (r: Row) => (r.employer === null ? null : (amountOf.get(`${r.id}:${c.id}`) ?? 0)) })),
    { header: 'Employer total', width: 13, value: (r) => r.employer },
    { header: 'Pay status', width: 28, value: (r) => r.status },
  ])
  // the totals of each component over the people whose pay is worked out (a held person's earnings only)
  const counted = (c: (typeof components)[number]) => rows.filter((r) => (c.kind === 'EARNING' ? r.earned !== null : r.net !== null))
  const totals = components.map((c) => ({
    kind: c.kind === 'EARNING' ? 'Earning' : c.kind === 'DEDUCTION' ? 'Deduction' : 'Employer pays',
    name: c.name,
    people: counted(c).filter((r) => amountOf.has(`${r.id}:${c.id}`)).length,
    amount: sum(counted(c).map((r) => amountOf.get(`${r.id}:${c.id}`) ?? 0)),
  }))
  const totalsSheet = reportSheet(`${final ? '' : 'DRAFT '}Totals`, totals, [
    { header: 'Kind', width: 14, value: (r) => r.kind },
    { header: 'Component', width: 30, value: (r) => r.name },
    { header: 'People', width: 9, value: (r) => r.people },
    { header: 'Amount', width: 15, value: (r) => r.amount },
  ])
  return reportFile(
    [register, totalsSheet],
    {
      title: `${draft}Salary register · ${run.company.code} · ${month}`,
      preparedBy: `${viewer.name} (${viewer.employeeCode})`,
      coverage: `Every person of the ${run.company.name} pay run for ${month}, with the days and amounts the run worked out. A held person's earnings are shown; their deductions and net pay are not worked out.`,
      filters: [
        { label: 'Company', value: `${run.company.code} · ${run.company.name}` },
        { label: 'Pay month', value: month },
        { label: 'Pay period', value: `${DAY.format(period.from)} to ${DAY.format(period.to)}` },
        { label: 'Run status', value: final ? `Final - approved ${run.finalisedAt ? STAMP.format(run.finalisedAt) : ''}` : `DRAFT - not final; pay worked out ${STAMP.format(run.computedAt)}` },
      ],
    },
    `salary-register-${run.company.code}-${run.payMonth.toISOString().slice(0, 7)}${final ? '' : '-DRAFT'}`,
  )
}
