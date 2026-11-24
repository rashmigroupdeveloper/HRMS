import { assertAccess } from '#core/auth/access'
import { assertGroupWide } from '#core/auth/scope'
import { prisma, type ActorId, type EmploymentType, type JoiningType, type SalaryCalcMethod, type SalaryComponentKind, type WorkforceCategory } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { fromPaise, monthlyOf, toPaise } from '#shared/utils/money'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as salaryComponentsService from '../salary-components/salary-components.service.js'
import * as salaryStructuresRepository from './salary-structures.repository.js'
import type { StructureRow } from './salary-structures.repository.js'
import type { calculateInput, createSalaryStructureInput, StructureLineInput, updateSalaryStructureInput } from './salary-structures.schema.js'

// Salary structures (the user, 2026-11-24 - HR's "CTC Structure" sheet): HR types an offer's CTC, the breakup fills in.
// One group-wide list, so changing one needs Organization Edit for all companies. The offer saves the amounts, so a
// structure changed later never changes an offer already made.

const PERCENT_METHODS: SalaryCalcMethod[] = ['PERCENT_OF_CTC', 'PERCENT_OF_GROSS', 'PERCENT_OF_BASIC']
const AREA_TEXT = 'The salary structures'

// --- Reading ---

const toStructure = (row: StructureRow) => ({
  ...row,
  lines: row.lines.map((line) => ({ ...line, value: line.value === null ? null : line.value.toNumber() })),
})

export async function listSalaryStructures(includeInactive = false) {
  return (await salaryStructuresRepository.list(includeInactive)).map(toStructure)
}

// For the API: the active ones for everyone (the offer form lets HR pick one - 2026-11-24); retired ones need
// Organization View
export function listSalaryStructuresFor(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ORGANIZATION', 'READ')
  return listSalaryStructures(includeInactive)
}

// --- The calculation ---

type CalcLine = {
  salaryComponentId: number
  kind: SalaryComponentKind
  method: SalaryCalcMethod
  value: number | null
  minimumBase: number | null
  onlyIfGrossAtMost: number | null
}

// The breakup of a monthly CTC by a structure's lines - exported for the tests.
// 1. The Monthly Gross = the CTC less the employer contributions; those can hang on the Basic, which can hang on the
//    gross, so it is solved by repeating until it settles (exact, before rounding - HR's sheet does it with 2.1681).
// 2. A line with "only if the gross is at most" (ESIC) is dropped when the gross comes out above it, and the gross worked
//    out again without it (the sheet's 23,448 switch).
// 3. Every line is rounded to the paisa - never to the rupee: a stored paisa can always be shown rounded later, a rounded
//    amount cannot be undone (the user, 2026-11-24) - the "% of Basic" ones from the Basic so rounded; the BALANCE line
//    takes what is left, so the lines always add up to the monthly CTC exactly.
export function computeBreakup(lines: CalcLine[], basicComponentId: number | null, monthlyCtc: number) {
  const basicLine = lines.find((line) => line.salaryComponentId === basicComponentId)
  const balance = lines.find((line) => line.method === 'BALANCE')
  if (!balance) throw new ORPCError('BAD_REQUEST', { message: 'The structure has no balance line' })
  const amountOf = (line: CalcLine, gross: number, basic: number) => {
    if (line.method === 'FIXED') return line.value ?? 0
    const base = line.method === 'PERCENT_OF_CTC' ? monthlyCtc : line.method === 'PERCENT_OF_GROSS' ? gross : basic
    return ((line.value ?? 0) / 100) * Math.max(base, line.minimumBase ?? 0)
  }
  const basicAt = (gross: number) => (basicLine ? amountOf(basicLine, gross, 0) : 0)
  const solveGross = (included: CalcLine[]) => {
    const employer = included.filter((line) => line.kind === 'EMPLOYER_CONTRIBUTION')
    let gross = monthlyCtc
    for (let round = 0; round < 500; round++) {
      const next = monthlyCtc - employer.reduce((sum, line) => sum + amountOf(line, gross, basicAt(gross)), 0)
      if (!Number.isFinite(next)) break
      if (Math.abs(next - gross) < 1e-7) return next
      gross = next
    }
    throw new ORPCError('BAD_REQUEST', { message: 'The structure cannot be worked out - the employer contributions take more than the whole CTC' })
  }

  let included = lines
  let gross = solveGross(included)
  for (;;) {
    const dropped = included.filter((line) => line.onlyIfGrossAtMost !== null && gross > line.onlyIfGrossAtMost)
    if (!dropped.length) break
    included = included.filter((line) => !dropped.includes(line))
    gross = solveGross(included)
  }

  // half up to the paisa (the small nudge keeps 5765.415 from becoming 5765.41 through floating point)
  const toPaisa = (amount: number) => Math.round(amount * 100 + 1e-6) / 100
  const basic = toPaisa(basicAt(gross))
  const amounts = new Map<number, number>()
  for (const line of included) {
    if (line === balance) continue
    const exact = line === basicLine ? basic : line.method === 'FIXED' ? (line.value ?? 0) : amountOf(line, gross, basic)
    amounts.set(line.salaryComponentId, toPaisa(exact))
  }
  const rest = toPaise(monthlyCtc) - [...amounts.values()].reduce((sum, amount) => sum + toPaise(amount), 0)
  if (rest < 0) {
    throw new ORPCError('BAD_REQUEST', { message: `The CTC is too low for this structure - its other lines already come to more than ${monthlyCtc} a month` })
  }
  amounts.set(balance.salaryComponentId, fromPaise(rest))
  // in the structure's order (as the breakup prints them)
  return lines.filter((line) => amounts.has(line.salaryComponentId)).map((line) => ({ salaryComponentId: line.salaryComponentId, monthlyAmount: amounts.get(line.salaryComponentId)! }))
}

// --- Picking the structure for an offer ---

type Offer = { joiningType: JoiningType; employmentType: EmploymentType; workforceCategory: WorkforceCategory }
type Match = { joiningType: JoiningType | null; employmentType: EmploymentType | null; workforceCategory: WorkforceCategory | null }

// How closely a structure fits the offer: null = not for it. A given employment type counts most, then the joining type,
// then the category - so a trainee in a white-collar job takes the "Trainee" structure over "White collar". Different
// combinations never score the same (4 / 2 / 1), and two active structures never have the same combination.
function fit(structure: Match, offer: Offer) {
  if (structure.employmentType && structure.employmentType !== offer.employmentType) return null
  if (structure.joiningType && structure.joiningType !== offer.joiningType) return null
  if (structure.workforceCategory && structure.workforceCategory !== offer.workforceCategory) return null
  return (structure.employmentType ? 4 : 0) + (structure.joiningType ? 2 : 0) + (structure.workforceCategory ? 1 : 0)
}

export function pickStructure<S extends Match>(structures: S[], offer: Offer): S | null {
  let best: S | null = null
  let bestFit = -1
  for (const structure of structures) {
    const score = fit(structure, offer)
    if (score !== null && score > bestFit) [best, bestFit] = [structure, score]
  }
  return best
}

// The breakup for an annual CTC (rounded to the paisa a month: 5,84,000 -> 48,666.67): by the structure the offer
// matches - none matching: no lines, HR types them - or by a structure being edited.
export async function calculateBreakup(input: z.infer<typeof calculateInput>) {
  const monthlyCtc = monthlyOf(input.annualCtc)
  if (input.draft) {
    const lines = await checkLines(input.draft.lines, input.draft.basicComponentId ?? null)
    return { structure: null, monthlyCtc, balanceComponentId: balanceOf(lines), lines: computeBreakup(lines, input.draft.basicComponentId ?? null, monthlyCtc) }
  }
  const active = await listSalaryStructures()
  const structure = input.structureId ? active.find((s) => s.id === input.structureId) : pickStructure(active, input as Offer)
  if (input.structureId && !structure) throw new ORPCError('NOT_FOUND', { message: 'That salary structure is not in use (any more)' })
  if (!structure) return { structure: null, monthlyCtc, balanceComponentId: null, lines: [] }
  // a component retired after the structure was saved: the offer could not save the line - HR fixes the structure first
  const retired = structure.lines.find((line) => !line.salaryComponent.isActive)
  if (retired) {
    throw new ORPCError('BAD_REQUEST', { message: `The salary structure "${structure.name}" uses ${retired.salaryComponent.name}, which is retired - change the structure first` })
  }
  const lines = structure.lines.map((line) => ({ ...line, kind: line.salaryComponent.kind }))
  return { structure: { id: structure.id, name: structure.name }, monthlyCtc, balanceComponentId: balanceOf(lines), lines: computeBreakup(lines, structure.basicComponentId, monthlyCtc) }
}

// the line that takes what is left - the form adjusts it when HR changes another line, so the total stays the CTC
const balanceOf = (lines: { salaryComponentId: number; method: SalaryCalcMethod }[]) => lines.find((line) => line.method === 'BALANCE')?.salaryComponentId ?? null

// --- Changing ---

// The rules of a structure's lines (BAD_REQUEST): every component active and not a deduction, each once; exactly one
// BALANCE line, an earning; a value on every other line (a percentage at most 100); a minimum base only on a percentage;
// a Basic - one of its lines, worked out without the Basic or the balance - whenever a line is a "% of Basic".
async function checkLines(lines: StructureLineInput[], basicComponentId: number | null): Promise<CalcLine[]> {
  const bad = (message: string) => new ORPCError('BAD_REQUEST', { message })
  const components = new Map((await salaryComponentsService.listSalaryComponents()).map((c) => [c.id, c]))
  const ids = lines.map((line) => line.salaryComponentId)
  if (new Set(ids).size !== ids.length) throw bad('A component is in the structure twice')
  const out = lines.map((line) => {
    const component = components.get(line.salaryComponentId)
    if (!component) throw bad('The structure uses a salary component that is not active')
    if (component.kind === 'DEDUCTION') throw bad(`${component.name} is a deduction - it is never part of a salary breakup`)
    const isBalance = line.method === 'BALANCE'
    if (!isBalance && (line.value === null || line.value === undefined)) throw bad(`Give a value for ${component.name}`)
    if (PERCENT_METHODS.includes(line.method) && (line.value ?? 0) > 100) throw bad(`${component.name}: a percentage is at most 100`)
    if (line.minimumBase != null && !PERCENT_METHODS.includes(line.method)) throw bad(`${component.name}: a minimum base is only for a percentage`)
    if (isBalance && line.onlyIfGrossAtMost != null) throw bad(`${component.name}: the balance line has no condition`)
    if (isBalance && component.kind !== 'EARNING') throw bad(`The balance line must be an earning - ${component.name} is not`)
    return {
      salaryComponentId: line.salaryComponentId,
      kind: component.kind,
      method: line.method,
      value: isBalance ? null : (line.value ?? null),
      minimumBase: line.minimumBase ?? null,
      onlyIfGrossAtMost: line.onlyIfGrossAtMost ?? null,
    }
  })
  if (out.filter((line) => line.method === 'BALANCE').length !== 1) throw bad('A structure has exactly one balance line (e.g. Special Allowance)')
  const usesBasic = out.some((line) => line.method === 'PERCENT_OF_BASIC')
  if (usesBasic && basicComponentId === null) throw bad('Choose which line is the Basic - a line is a "% of Basic"')
  if (basicComponentId !== null) {
    const basic = out.find((line) => line.salaryComponentId === basicComponentId)
    if (!basic) throw bad('The Basic must be one of the structure\'s lines')
    if (basic.method === 'BALANCE' || basic.method === 'PERCENT_OF_BASIC') throw bad('The Basic cannot be the balance or a "% of Basic" itself')
  }
  return out
}

// Two active structures never cover the same offers (CONFLICT)
async function checkUnique(match: Match, exceptId?: number) {
  const same = (await listSalaryStructures()).find(
    (s) => s.id !== exceptId && s.joiningType === match.joiningType && s.employmentType === match.employmentType && s.workforceCategory === match.workforceCategory,
  )
  if (same) throw new ORPCError('CONFLICT', { message: `"${same.name}" is already for these offers - change it, or make this one for other offers` })
}

const lineData = (lines: CalcLine[]) =>
  lines.map(({ salaryComponentId, method, value, minimumBase, onlyIfGrossAtMost }) => ({ salaryComponentId, method, value, minimumBase, onlyIfGrossAtMost }))

export async function createSalaryStructure({ lines, ...input }: z.infer<typeof createSalaryStructureInput>, actorId: ActorId) {
  const match = { joiningType: input.joiningType ?? null, employmentType: input.employmentType ?? null, workforceCategory: input.workforceCategory ?? null }
  const basicComponentId = input.basicComponentId ?? null
  const checked = await checkLines(lines, basicComponentId)
  await checkUnique(match)
  return toStructure(await salaryStructuresRepository.create({ name: input.name, ...match, basicComponentId }, lineData(checked), actorId))
}

export async function updateSalaryStructure({ id, lines, ...changes }: z.infer<typeof updateSalaryStructureInput>, actorId: ActorId) {
  const current = await salaryStructuresRepository.findById(id)
  if (!current) throw new ORPCError('NOT_FOUND', { message: 'Salary structure not found' })
  const pick = <K extends keyof typeof changes>(key: K, now: unknown) => (changes[key] === undefined ? now : changes[key])
  const next = {
    joiningType: pick('joiningType', current.joiningType) as JoiningType | null,
    employmentType: pick('employmentType', current.employmentType) as EmploymentType | null,
    workforceCategory: pick('workforceCategory', current.workforceCategory) as WorkforceCategory | null,
    basicComponentId: pick('basicComponentId', current.basicComponentId) as number | null,
    isActive: changes.isActive ?? current.isActive,
  }
  // the lines are checked again whenever they or the Basic change (a retired component left in it is refused then)
  const nextLines = lines ?? current.lines.map((line) => ({ ...line, value: line.value === null ? null : line.value.toNumber() }))
  const checked = lines !== undefined || changes.basicComponentId !== undefined ? await checkLines(nextLines, next.basicComponentId) : null
  if (next.isActive) await checkUnique(next, id)
  return prisma.$transaction(async (tx) =>
    toStructure(await salaryStructuresRepository.update(id, { ...(changes.name !== undefined && { name: changes.name }), ...next }, checked ? lineData(checked) : undefined, actorId, tx)),
  )
}

// --- From the API (data access, 2026-11-24): one list for every company - Organization Edit for all companies ---
export function createSalaryStructureFor(viewer: CurrentUser, input: z.infer<typeof createSalaryStructureInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', AREA_TEXT)
  return createSalaryStructure(input, viewer.employeeId)
}
export function updateSalaryStructureFor(viewer: CurrentUser, input: z.infer<typeof updateSalaryStructureInput>) {
  assertGroupWide(viewer, 'ORGANIZATION', AREA_TEXT)
  return updateSalaryStructure(input, viewer.employeeId)
}
