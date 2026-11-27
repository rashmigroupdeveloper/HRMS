import { ORPCError } from '@orpc/server'
import { assertAccess } from '#core/auth/access'
import { ALL_OF_GROUP, assertGroupWide, levelOver } from '#core/auth/scope'
import { prisma, type DbClient, type Gender, type StatutoryParameter, type TaxRegime } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { formatDate } from '#shared/utils/dates'
import type { z } from 'zod'
import * as statutoryRepository from './statutory.repository.js'
import type { PtSlabRow, TaxSlabRow } from './statutory.repository.js'
import type { SavePtSlabsInput, SaveTaxSlabsInput, saveLwfInput, saveRateInput } from './statutory.schema.js'

// Payroll stage 4 (approved by the user 2026-11-27): the statutory settings - every rate, ceiling and slab payroll works
// with is a dated row entered here from the official notification (the CA checks them); nothing is seeded or written in
// code. One list for the whole group: reading needs Payroll View, changing needs Payroll Edit for every company
// (assertGroupWide). A pay run reads them when its pay is worked out; a missing row holds the person, never a zero.

const WHAT = 'The statutory rates and slabs'

// Rates in percent (at most 100); the others are rupees (a month or a year) or years
const PERCENT = new Set<StatutoryParameter>(['PF_EMPLOYEE_RATE', 'PF_EMPLOYER_RATE', 'EPS_RATE', 'EDLI_RATE', 'ESIC_EMPLOYEE_RATE', 'ESIC_EMPLOYER_RATE', 'TAX_CESS_RATE'])

// --- Reading ---

export async function listSettings(viewer: CurrentUser) {
  assertAccess(viewer.access, 'PAYROLL', 'READ')
  const [rates, ptSlabs, lwf, taxSlabs] = await Promise.all([statutoryRepository.listRates(), statutoryRepository.listPtSlabs(), statutoryRepository.listLwf(), statutoryRepository.listTaxSlabs()])
  const person = await employeesService.lookupPeople([...rates, ...ptSlabs, ...lwf, ...taxSlabs].map((r) => r.updatedById))
  const by = <T extends { createdById: number; updatedById: number }>({ createdById: _c, updatedById, ...row }: T) => ({ ...row, updatedBy: person(updatedById) })
  // the slabs as sets: one State from one day, one regime for one tax year
  const ptSets = new Map<string, { stateCode: string; effectiveFrom: Date; reference: string; updatedAt: Date; slabs: PtSlabRow[] }>()
  for (const s of ptSlabs) {
    const key = `${s.stateCode}:${s.effectiveFrom.getTime()}`
    const set = ptSets.get(key) ?? { stateCode: s.stateCode, effectiveFrom: s.effectiveFrom, reference: s.reference, updatedAt: s.updatedAt, slabs: [] }
    set.slabs.push({ gender: s.gender, wagesFrom: s.wagesFrom, wagesTo: s.wagesTo, amount: s.amount, specialMonth: s.specialMonth, specialAmount: s.specialAmount })
    if (s.updatedAt > set.updatedAt) set.updatedAt = s.updatedAt
    ptSets.set(key, set)
  }
  const taxSets = new Map<string, { regime: TaxRegime; taxYearFrom: Date; reference: string; updatedAt: Date; slabs: TaxSlabRow[] }>()
  for (const s of taxSlabs) {
    const key = `${s.regime}:${s.taxYearFrom.getTime()}`
    const set = taxSets.get(key) ?? { regime: s.regime, taxYearFrom: s.taxYearFrom, reference: s.reference, updatedAt: s.updatedAt, slabs: [] }
    set.slabs.push({ incomeFrom: s.incomeFrom, incomeTo: s.incomeTo, ratePercent: s.ratePercent })
    if (s.updatedAt > set.updatedAt) set.updatedAt = s.updatedAt
    taxSets.set(key, set)
  }
  return {
    rates: rates.map(by),
    ptSets: [...ptSets.values()],
    lwf: lwf.map(by),
    taxSets: [...taxSets.values()],
    canChange: levelOver(viewer, 'PAYROLL', ALL_OF_GROUP) === 'WRITE',
  }
}

// Every setting, for working out a pay run (system read: the run was found with whole-company Payroll scope first)
export async function loadSettings(db?: DbClient) {
  const [rates, ptSlabs, lwf, taxSlabs] = await Promise.all([statutoryRepository.listRates(db), statutoryRepository.listPtSlabs(db), statutoryRepository.listLwf(db), statutoryRepository.listTaxSlabs(db)])
  return { rates, ptSlabs, lwf, taxSlabs }
}
export type Settings = Awaited<ReturnType<typeof loadSettings>>

// --- Looking a value up (pure - unit tested) ---

const DAY = 86_400_000
const daysIn = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY) + 1
type Rate = { parameter: StatutoryParameter; effectiveFrom: Date; value: number }

// The value in force on a day (the row with the latest start on or before it), or null
export function valueOn(rates: Rate[], parameter: StatutoryParameter, day: Date): number | null {
  let found: Rate | undefined
  for (const r of rates) if (r.parameter === parameter && r.effectiveFrom <= day && (!found || r.effectiveFrom > found.effectiveFrom)) found = r
  return found ? found.value : null
}

// The value over from..to, weighted by days: a change inside the period splits it at its day (the PF ceiling of 17 Sep
// 2026 - 16 days at the old ceiling, 14 at the new, as the EPFO splits that month). Null when a day has no value.
export function valueOver(rates: Rate[], parameter: StatutoryParameter, from: Date, to: Date): number | null {
  const changes = rates.filter((r) => r.parameter === parameter && r.effectiveFrom > from && r.effectiveFrom <= to).map((r) => r.effectiveFrom.getTime())
  const cuts = [from.getTime(), ...[...new Set(changes)].sort((a, b) => a - b)]
  let total = 0
  for (let i = 0; i < cuts.length; i++) {
    const start = new Date(cuts[i]!)
    const end = i + 1 < cuts.length ? new Date(cuts[i + 1]! - DAY) : to
    const v = valueOn(rates, parameter, start)
    if (v === null) return null
    total += v * daysIn(start, end)
  }
  return total / daysIn(from, to)
}

// The professional-tax slabs of a State in force on a day (its latest set starting on or before it), or null
export function ptSlabsOn<T extends PtSlabRow & { stateCode: string; effectiveFrom: Date }>(slabs: T[], stateCode: string, day: Date): T[] | null {
  let start: number | undefined
  for (const s of slabs) if (s.stateCode === stateCode && s.effectiveFrom <= day && (start === undefined || s.effectiveFrom.getTime() > start)) start = s.effectiveFrom.getTime()
  return start === undefined ? null : slabs.filter((s) => s.stateCode === stateCode && s.effectiveFrom.getTime() === start)
}

// The labour welfare fund row of a State in force on a day, or null
export function lwfOn<T extends { stateCode: string; effectiveFrom: Date }>(rows: T[], stateCode: string, day: Date): T | null {
  let found: T | undefined
  for (const r of rows) if (r.stateCode === stateCode && r.effectiveFrom <= day && (!found || r.effectiveFrom > found.effectiveFrom)) found = r
  return found ?? null
}

// The income-tax slabs of a regime for a tax year, or null
export function taxSlabsFor<T extends TaxSlabRow & { regime: TaxRegime; taxYearFrom: Date }>(slabs: T[], regime: TaxRegime, taxYearFrom: Date): T[] | null {
  const set = slabs.filter((s) => s.regime === regime && s.taxYearFrom.getTime() === taxYearFrom.getTime()).sort((a, b) => a.incomeFrom - b.incomeFrom)
  return set.length ? set : null
}

// --- Checking a set of slabs ---

const bad = (message: string) => new ORPCError('BAD_REQUEST', { message })

// Professional-tax slabs: for each gender (and for everyone) they start at 0, follow on without gaps or overlaps (the
// next starts one rupee after the last ends) and the last has no upper limit - so every gross finds exactly one slab
function checkPtSlabs(slabs: PtSlabRow[]) {
  const groups = new Map<Gender | null, PtSlabRow[]>()
  for (const s of slabs) groups.set(s.gender, [...(groups.get(s.gender) ?? []), s])
  for (const [gender, group] of groups) {
    const who = gender ? `the ${gender.toLowerCase()} slabs` : 'the slabs'
    const sorted = [...group].sort((a, b) => a.wagesFrom - b.wagesFrom)
    if (sorted[0]!.wagesFrom !== 0) throw bad(`${who} must start at 0`)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!
      if (prev.wagesTo === null || sorted[i]!.wagesFrom !== prev.wagesTo + 1) throw bad(`In ${who}, each slab starts one rupee after the one before ends (no gaps or overlaps)`)
    }
    if (sorted.at(-1)!.wagesTo !== null) throw bad(`In ${who}, the last slab has no upper limit`)
  }
}

// Income-tax slabs: start at 0, each starts where the one before ends, the last has no upper limit
function checkTaxSlabs(slabs: TaxSlabRow[]) {
  const sorted = [...slabs].sort((a, b) => a.incomeFrom - b.incomeFrom)
  if (sorted[0]!.incomeFrom !== 0) throw bad('The slabs must start at 0')
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1]!.incomeTo !== sorted[i]!.incomeFrom) throw bad('Each slab starts where the one before ends (no gaps or overlaps)')
  }
  if (sorted.at(-1)!.incomeTo !== null) throw bad('The last slab has no upper limit')
}

// --- Changing, from the API (Payroll Edit for every company) ---

function assertCanChange(viewer: CurrentUser) {
  assertAccess(viewer.access, 'PAYROLL', 'WRITE')
  assertGroupWide(viewer, 'PAYROLL', WHAT)
}

export async function saveRate(viewer: CurrentUser, { id, ...data }: z.infer<typeof saveRateInput>) {
  assertCanChange(viewer)
  if (PERCENT.has(data.parameter) && data.value > 100) throw bad('A rate is a percentage - at most 100')
  if (data.parameter === 'EPS_AGE_LIMIT' && !Number.isInteger(data.value)) throw bad('The age limit is in whole years')
  if (data.parameter.startsWith('TAX_') && !(data.effectiveFrom.getUTCMonth() === 3 && data.effectiveFrom.getUTCDate() === 1)) {
    throw bad('Income-tax values go by tax year - start them on 1 April')
  }
  // (the same rate twice from one day: CONFLICT, mapped centrally)
  return prisma.$transaction((tx) => (id ? statutoryRepository.updateRate(id, data, viewer.employeeId, tx) : statutoryRepository.createRate(data, viewer.employeeId, tx)))
}

export async function deleteRate(viewer: CurrentUser, { id }: { id: number }) {
  assertCanChange(viewer)
  return statutoryRepository.deleteRate(id)
}

export async function savePtSlabs(viewer: CurrentUser, input: SavePtSlabsInput) {
  assertCanChange(viewer)
  checkPtSlabs(input.slabs)
  return prisma.$transaction(async (tx) => {
    if (input.replaces) await statutoryRepository.deletePtSet(input.replaces.stateCode, input.replaces.effectiveFrom, tx)
    await statutoryRepository.deletePtSet(input.stateCode, input.effectiveFrom, tx)
    await statutoryRepository.createPtSet(input.stateCode, input.effectiveFrom, input.reference, input.slabs, viewer.employeeId, tx)
    return { stateCode: input.stateCode, effectiveFrom: input.effectiveFrom }
  })
}

export async function deletePtSlabs(viewer: CurrentUser, { stateCode, effectiveFrom }: { stateCode: string; effectiveFrom: Date }) {
  assertCanChange(viewer)
  const { count } = await prisma.$transaction((tx) => statutoryRepository.deletePtSet(stateCode, effectiveFrom, tx))
  if (!count) throw new ORPCError('NOT_FOUND', { message: `No professional-tax slabs for ${stateCode} from ${formatDate(effectiveFrom)}` })
  return { count }
}

export async function saveLwf(viewer: CurrentUser, { id, ...data }: z.infer<typeof saveLwfInput>) {
  assertCanChange(viewer)
  const months = [...new Set(data.months)].sort((a, b) => a - b)
  return prisma.$transaction((tx) => (id ? statutoryRepository.updateLwf(id, { ...data, months }, viewer.employeeId, tx) : statutoryRepository.createLwf({ ...data, months }, viewer.employeeId, tx)))
}

export async function deleteLwf(viewer: CurrentUser, { id }: { id: number }) {
  assertCanChange(viewer)
  return statutoryRepository.deleteLwf(id)
}

export async function saveTaxSlabs(viewer: CurrentUser, input: SaveTaxSlabsInput) {
  assertCanChange(viewer)
  checkTaxSlabs(input.slabs)
  return prisma.$transaction(async (tx) => {
    if (input.replaces) await statutoryRepository.deleteTaxSet(input.replaces.regime, input.replaces.taxYearFrom, tx)
    await statutoryRepository.deleteTaxSet(input.regime, input.taxYearFrom, tx)
    await statutoryRepository.createTaxSet(input.regime, input.taxYearFrom, input.reference, input.slabs, viewer.employeeId, tx)
    return { regime: input.regime, taxYearFrom: input.taxYearFrom }
  })
}

export async function deleteTaxSlabs(viewer: CurrentUser, { regime, taxYearFrom }: { regime: TaxRegime; taxYearFrom: Date }) {
  assertCanChange(viewer)
  const { count } = await prisma.$transaction((tx) => statutoryRepository.deleteTaxSet(regime, taxYearFrom, tx))
  if (!count) throw new ORPCError('NOT_FOUND', { message: 'No income-tax slabs for that regime and tax year' })
  return { count }
}
