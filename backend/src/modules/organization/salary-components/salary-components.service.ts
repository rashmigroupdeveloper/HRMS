import { assertGroupWide } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import type { ActorId, SalaryComponentKind } from '#core/db/prisma'
import { ORPCError } from '@orpc/server'
import { fromPaise, monthlyOf, toPaise } from '#shared/utils/money'
import type { CurrentUser } from '#core/rpc/procedures'
import type { z } from 'zod'
import * as salaryComponentsRepository from './salary-components.repository.js'
import type { createSalaryComponentInput, updateSalaryComponentInput } from './salary-components.schema.js'

// The lines of a salary breakup (Basic, HRA, Employer PF...). Duplicate name -> 409 and unknown id -> 404 are
// mapped centrally (core/rpc/errors.ts). A retired component stays on the offers that already use it.

export function listSalaryComponents(includeInactive = false) {
  return salaryComponentsRepository.list(includeInactive)
}

// For the API: active entries are for everyone (the offer form needs them); inactive ones need ORGANIZATION READ.
export function listSalaryComponentsFor(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listSalaryComponents(includeInactive)
}

// A salary breakup (an offer's, or a revision's - 2026-11-20): every line an active earning or employer contribution -
// never a deduction, which payroll takes out of the month's pay (2026-11-24) - and the monthly lines adding up to the
// annual fixed CTC / 12 to the paisa (2026-11-24: 5,84,000 -> 48,666.67 a month; compared in whole paise). Throws
// BAD_REQUEST. An empty breakup is allowed (no lines given).
export async function checkBreakup(lines: { salaryComponentId: number; monthlyAmount: number }[], annualCtc: number) {
  if (lines.length === 0) return
  const components = new Map((await listSalaryComponents()).map((c) => [c.id, c]))
  if (lines.some((line) => !components.has(line.salaryComponentId))) {
    throw new ORPCError('BAD_REQUEST', { message: 'The salary breakup uses a salary component that is not active' })
  }
  if (lines.some((line) => components.get(line.salaryComponentId)!.kind === 'DEDUCTION')) {
    throw new ORPCError('BAD_REQUEST', { message: 'A deduction is not part of a salary breakup - payroll takes it out of the monthly pay' })
  }
  const monthly = lines.map((line) => components.get(line.salaryComponentId)!).find((c) => c.enteredMonthly)
  if (monthly) {
    throw new ORPCError('BAD_REQUEST', { message: `${monthly.name} is entered each month in payroll - it is not part of a salary breakup` })
  }
  const total = lines.reduce((sum, line) => sum + toPaise(line.monthlyAmount), 0)
  const expected = toPaise(monthlyOf(annualCtc))
  if (total !== expected) {
    throw new ORPCError('BAD_REQUEST', {
      message: `The salary breakup adds up to ${fromPaise(total).toFixed(2)} a month, but the annual CTC ${annualCtc} / 12 is ${fromPaise(expected).toFixed(2)}`,
    })
  }
}

// An employer contribution is never typed in payroll - it is worked out from the wages (payroll stage 2)
function assertEnteredMonthlyFits(kind: SalaryComponentKind, enteredMonthly: boolean | undefined) {
  if (enteredMonthly && kind === 'EMPLOYER_CONTRIBUTION') {
    throw new ORPCError('BAD_REQUEST', { message: 'An employer contribution is worked out from the wages - it cannot be entered each month' })
  }
}

export async function createSalaryComponent(input: z.infer<typeof createSalaryComponentInput>, actorId: ActorId) {
  assertEnteredMonthlyFits(input.kind, input.enteredMonthly)
  return salaryComponentsRepository.create(input, actorId)
}

// A component cannot turn into a deduction or stop being one: the earnings and employer contributions sit on salary
// breakups (adding up to the CTC), a deduction never does (2026-11-24). For the same reason "entered monthly" (payroll
// stage 2) can be switched only on a deduction, which is never on a breakup; an earning gets it when it is created
// (e.g. Incentive) and keeps it. Unknown id -> 404 (mapped centrally).
export async function updateSalaryComponent({ id, ...changes }: z.infer<typeof updateSalaryComponentInput>, actorId: ActorId) {
  if (changes.kind !== undefined || changes.enteredMonthly !== undefined) {
    const current = await salaryComponentsRepository.findById(id)
    if (current) {
      const kind = changes.kind ?? current.kind
      if (current.kind !== kind && (current.kind === 'DEDUCTION' || kind === 'DEDUCTION')) {
        throw new ORPCError('BAD_REQUEST', { message: 'A deduction cannot become an earning or an employer contribution, nor the other way round - add a new component instead' })
      }
      const enteredMonthly = changes.enteredMonthly ?? current.enteredMonthly
      assertEnteredMonthlyFits(kind, enteredMonthly)
      if (enteredMonthly !== current.enteredMonthly && kind !== 'DEDUCTION') {
        throw new ORPCError('BAD_REQUEST', { message: 'Whether an earning is entered each month is set when it is added - add a new component instead' })
      }
    }
  }
  return salaryComponentsRepository.update(id, changes, actorId)
}

// --- From the API (data access, A4 2026-11-18): one list for every company - Organization Edit for all companies ---
export async function createSalaryComponentFor(viewer: CurrentUser, input: z.infer<typeof createSalaryComponentInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of salary components')
  return createSalaryComponent(input, viewer.employeeId)
}
export async function updateSalaryComponentFor(viewer: CurrentUser, input: z.infer<typeof updateSalaryComponentInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', 'The list of salary components')
  return updateSalaryComponent(input, viewer.employeeId)
}
