import { hasLevelAt, assertGroupWide, SYSTEM_SCOPE } from '#core/auth/scope'
import { prisma, SYSTEM_ACTOR } from '#core/db/prisma'
import { readFirstSheet, writeWorkbook, type CellValue } from '#core/excel/workbook'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as leaveService from '../leave.service.js'
import * as typesService from '../types/types.service.js'
import * as balancesRepository from './balances.repository.js'
import { type adjustInput, type balancesInput, type importBalancesInput, MAX_IMPORT_ROWS, type registerInput } from './balances.schema.js'

// Leave balances (2026-11-22 - the old HRMS's lv.ledger): every credit and debit is a row, the balance their sum.
// - Credited on the 1st of every month (the type's days a month) to everyone employed that day whose service is long
//   enough and whom the type applies to; no part credit for a joiner's first month (old HRMS - the first credit is the
//   next 1st). The daily job credits every month due, so a missed run catches up by itself; a month is credited once.
// - At the year end the balance above the type's carry-forward limit lapses (old HRMS: by hand only - here the job does it
//   on 1 January, once).
// - Credits and lapses start with the month after the type was added - going live never credits months back; balances
//   brought from before are HR's adjustments.
// - Days waiting for approval are held back: available = balance - waiting. Leave without pay has no balance.

// (+ 0: never "-0")
const round2 = (n: number) => Math.round(n * 100) / 100 + 0
const yearRange = (year: number) => ({ from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) })
const firstOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()))
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
// the first 1st of a month after the day a type was added (when its credits start)
const firstCreditDay = (createdAt: Date) => addMonths(firstOfMonth(createdAt), 1)

type Person = leaveService.Person
type LeaveType = typesService.LeaveType

// --- the balances ---

export type Balance = {
  leaveType: { id: number; code: string; name: string; isPaid: boolean; allowHalfDay: boolean }
  // the sum of every row (null: leave without pay - no balance)
  balance: number | null
  // asked for and waiting for approval
  pending: number
  // what can still be asked for (null: no limit - leave without pay)
  available: number | null
  // in the year: credited, HR's adjustments, taken (less days returned), lapsed
  credited: number
  adjusted: number
  taken: number
  lapsed: number
}

// The balances of these employees in a year, per type: the active types that apply to them, and any other with days left
export async function balancesOf(people: Person[], year: number, types?: LeaveType[]) {
  const all = types ?? (await typesService.allTypes())
  const ids = people.map((p) => p.id)
  const { from, to } = yearRange(year)
  const [sums, pending, kinds] = await Promise.all([balancesRepository.sumBalances(ids), balancesRepository.sumPending(ids), balancesRepository.sumByKind(ids, from, to)])
  const key = (employeeId: number, typeId: number) => `${employeeId}:${typeId}`
  const sumOf = new Map(sums.map((s) => [key(s.employeeId, s.leaveTypeId), s.days]))
  const pendingOf = new Map(pending.map((s) => [key(s.employeeId, s.leaveTypeId), s.days]))
  const kindOf = new Map(kinds.map((s) => [`${key(s.employeeId, s.leaveTypeId)}:${s.kind}`, s.days]))
  const result = new Map<number, Balance[]>()
  for (const person of people) {
    const rows: Balance[] = []
    for (const type of all) {
      const k = key(person.id, type.id)
      const total = round2(sumOf.get(k) ?? 0)
      const waiting = round2(pendingOf.get(k) ?? 0)
      const shown = (type.isActive && leaveService.typeAppliesTo(type, person)) || total !== 0 || waiting !== 0
      if (!shown) continue
      const kind = (name: string) => kindOf.get(`${k}:${name}`) ?? 0
      rows.push({
        leaveType: { id: type.id, code: type.code, name: type.name, isPaid: type.isPaid, allowHalfDay: type.allowHalfDay },
        balance: type.isPaid ? total : null,
        pending: waiting,
        available: type.isPaid ? round2(total - waiting) : null,
        // (comp-off earned counts as credited, comp-off expired as lapsed - 2026-11-22)
        credited: round2(kind('CREDIT') + kind('COMP_OFF')),
        adjusted: round2(kind('ADJUSTMENT')),
        taken: round2(-(kind('TAKEN') + kind('RETURNED'))),
        lapsed: round2(-(kind('LAPSE') + kind('EXPIRED'))),
      })
    }
    result.set(person.id, rows)
  }
  return result
}

// What one employee can still ask for of a type (the balance less what waits for approval) - null: no limit (unpaid)
export async function availableOf(employeeId: number, type: Pick<LeaveType, 'id' | 'isPaid'>) {
  if (!type.isPaid) return null
  const [sums, pending] = await Promise.all([balancesRepository.sumBalances([employeeId]), balancesRepository.sumPending([employeeId])])
  const total = sums.find((s) => s.leaveTypeId === type.id)?.days ?? 0
  const waiting = pending.find((s) => s.leaveTypeId === type.id)?.days ?? 0
  return { balance: round2(total), pending: round2(waiting), available: round2(total - waiting) }
}

const ENTRY_LABEL = {
  CREDIT: 'Monthly credit',
  TAKEN: 'Leave taken',
  RETURNED: 'Leave cancelled - days back',
  LAPSE: 'Lapsed at the year end',
  ADJUSTMENT: 'Adjusted by HR',
  COMP_OFF: 'Comp-off earned',
  EXPIRED: 'Comp-off expired',
} as const

// One employee's balances in a year and every row behind them - one's own (no access), a team member's / department's,
// or anyone's with Leave View covering them
export async function getBalances(viewer: CurrentUser, input: z.infer<typeof balancesInput>) {
  const person = input?.employeeCode ? await leaveService.getVisiblePerson(viewer, input.employeeCode) : await leaveService.getVisiblePerson(viewer, viewer.employeeCode)
  const year = input?.year ?? today().getUTCFullYear()
  const { from, to } = yearRange(year)
  const [balances, entries] = await Promise.all([balancesOf([person], year), balancesRepository.listEntries(person.id, from, to)])
  const people = await employeesService.lookupPeople(entries.map((e) => e.createdById))
  return {
    employee: { employeeCode: person.employeeCode, name: person.name },
    year,
    balances: balances.get(person.id) ?? [],
    entries: entries.map((e) => ({
      id: e.id,
      leaveType: e.leaveType,
      kind: e.kind,
      what: ENTRY_LABEL[e.kind],
      days: e.days.toNumber(),
      date: e.effectiveDate,
      leave: e.application,
      note: e.note,
      // a comp-off credit: the day it expires
      expiresOn: e.expiresOn,
      // System for credits and lapses
      by: people(e.createdById),
      at: e.createdAt,
    })),
    // HR may adjust (Leave Edit covering them)
    canAdjust: hasLevelAt(viewer, 'LEAVE', leaveService.placementOf(person), 'WRITE'),
  }
}

// The register: everyone in the list's scope with their balance of each active type (old HRMS leave register)
export async function getRegister(viewer: CurrentUser, { year: asked, ...filter }: z.infer<typeof registerInput>) {
  const year = asked ?? today().getUTCFullYear()
  const { from, to } = yearRange(year)
  const people = await leaveService.peopleInScope(viewer, filter, from, to)
  const types = (await typesService.allTypes()).filter((t) => t.isActive)
  const balances = await balancesOf(people, year, types)
  return {
    year,
    types: types.map((t) => ({ id: t.id, code: t.code, name: t.name, isPaid: t.isPaid })),
    rows: people.map((p) => ({
      employeeCode: p.employeeCode,
      name: p.name,
      company: p.company.code,
      department: p.department?.name ?? null,
      // per type id: the balance (null: unpaid), what waits, what was taken in the year
      balances: Object.fromEntries((balances.get(p.id) ?? []).map((b) => [b.leaveType.id, { balance: b.balance, pending: b.pending, taken: b.taken }])),
      canAdjust: hasLevelAt(viewer, 'LEAVE', leaveService.placementOf(p), 'WRITE'),
    })),
  }
}

export async function exportRegister(viewer: CurrentUser, input: z.infer<typeof registerInput>) {
  const register = await getRegister(viewer, input)
  const bytes = await writeWorkbook([
    {
      name: `Leave ${register.year}`,
      columns: [
        { header: 'Employee code', key: 'code', width: 14 },
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Company', key: 'company', width: 10 },
        { header: 'Department', key: 'department', width: 18 },
        ...register.types.flatMap((t) => [
          { header: `${t.code} balance`, key: `b${t.id}`, width: 11 },
          { header: `${t.code} taken ${register.year}`, key: `t${t.id}`, width: 12 },
        ]),
      ],
      rows: register.rows.map((r) => ({
        code: r.employeeCode,
        name: r.name,
        company: r.company,
        department: r.department,
        ...Object.fromEntries(register.types.flatMap((t) => [[`b${t.id}`, r.balances[t.id]?.balance ?? null], [`t${t.id}`, r.balances[t.id]?.taken ?? null]])),
      })),
    },
  ])
  return new File([new Uint8Array(bytes)], `leave-balances-${register.year}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// HR adds or takes away days with a reason (opening balances at go-live, maternity / comp-off days given, a mistake put
// right) - Leave Edit covering the employee; never below zero (old HRMS)
export async function adjust(viewer: CurrentUser, input: z.infer<typeof adjustInput>) {
  const person = await leaveService.getChangeablePerson(viewer, input.employeeCode)
  const type = await typesService.getType(input.leaveTypeId)
  if (!type.isPaid) throw new ORPCError('BAD_REQUEST', { message: `${type.code} is leave without pay - it has no balance` })
  const days = round2(input.days)
  const current = (await availableOf(person.id, type))!
  if (current.balance + days < 0) throw new ORPCError('BAD_REQUEST', { message: `${type.code} balance is ${current.balance} - it cannot go below zero` })
  await balancesRepository.addEntries([{ employeeId: person.id, leaveTypeId: type.id, kind: 'ADJUSTMENT', days, effectiveDate: today(), note: input.note }], viewer.employeeId)
  return { balance: round2(current.balance + days) }
}

// --- crediting and the year end (the daily job; HR may run it now) ---

// Credits every month due up to `asOf` and lapses every year ended (only these employees, if given - tests). Safe to run
// any number of times: a month / year is done once per employee and type.
export async function creditDue(asOf: Date = today(), only?: { employeeIds: number[] }) {
  const types = (await typesService.allTypes()).filter((t) => t.isPaid)
  let credited = 0
  let lapsed = 0
  // the year end first: every year ended since the type was added
  for (const type of types.filter((t) => t.maxCarryForward !== null)) {
    for (let year = type.createdAt.getUTCFullYear(); Date.UTC(year + 1, 0, 1) <= asOf.getTime(); year++) {
      const yearEnd = new Date(Date.UTC(year, 11, 31))
      const balances = (await balancesRepository.sumTypeForEveryone(type.id, yearEnd)).filter((b) => !only || only.employeeIds.includes(b.employeeId))
      lapsed += await balancesRepository.addEntries(
        balances
          .filter((b) => round2(b.days - type.maxCarryForward!) > 0)
          .map((b) => ({ employeeId: b.employeeId, leaveTypeId: type.id, kind: 'LAPSE' as const, days: -round2(b.days - type.maxCarryForward!), effectiveDate: yearEnd, period: String(year) })),
        SYSTEM_ACTOR,
      )
    }
  }
  // the monthly credits: every 1st since the type was added, up to asOf
  const peopleOn = new Map<string, Person[]>()
  for (const type of types.filter((t) => t.creditPerMonth > 0)) {
    for (let day = firstCreditDay(type.createdAt); day <= asOf; day = addMonths(day, 1)) {
      const month = monthKey(day)
      if (!peopleOn.has(month)) {
        peopleOn.set(month, await employeesService.listLeavePeople({ scope: SYSTEM_SCOPE, ...(only && { ids: only.employeeIds }), from: day, to: day }))
      }
      const due = peopleOn.get(month)!.filter((p) => p.status !== 'EXITED' && addMonths(p.dateOfJoining, type.creditAfterMonths) <= day && leaveService.typeAppliesTo(type, p))
      credited += await balancesRepository.addEntries(
        due.map((p) => ({ employeeId: p.id, leaveTypeId: type.id, kind: 'CREDIT' as const, days: type.creditPerMonth, effectiveDate: day, period: month })),
        SYSTEM_ACTOR,
      )
    }
  }
  // comp-off not used before it expired (2026-11-22, old HRMS: expired credits are spent first): what is above the credits
  // still valid and HR's days (which never expire) lapses - each day, so it lapses the day after it expires
  let expired = 0
  const compOff = types.find((t) => t.isCompOff)
  if (compOff) {
    const standing = (await balancesRepository.compOffStanding(compOff.id, asOf)).filter((s) => !only || only.employeeIds.includes(s.employeeId))
    expired = await balancesRepository.addEntries(
      standing
        .map((s) => ({ ...s, over: round2(s.balance - s.live - s.given) }))
        .filter((s) => s.over > 0)
        .map((s) => ({ employeeId: s.employeeId, leaveTypeId: compOff.id, kind: 'EXPIRED' as const, days: -s.over, effectiveDate: asOf, note: 'Not used within 90 days of the day worked' })),
      SYSTEM_ACTOR,
    )
  }
  return { credited, lapsed, expired }
}

// HR runs it now (e.g. after adding a type or an employee) - the job does the same every night. Every company's
// employees: Leave Edit for all companies.
export async function runCredits(viewer: CurrentUser) {
  assertGroupWide(viewer, 'LEAVE', 'Crediting leave')
  return creditDue()
}

// --- the opening balances import (2026-11-22 - the old HRMS's "leave-balances" importer, set-the-balance mode) ---

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const IMPORT_HEADERS = { code: 'Employee code', type: 'Leave type', balance: 'Balance', note: 'Note' } as const

// The file HR fills in: one row per employee and leave type (the balance to set as of today); a second sheet lists the codes
export async function importTemplate() {
  const types = (await typesService.allTypes()).filter((t) => t.isActive && t.isPaid)
  const bytes = await writeWorkbook([
    {
      name: 'Balances',
      columns: [
        { header: IMPORT_HEADERS.code, key: 'code', width: 16 },
        { header: IMPORT_HEADERS.type, key: 'type', width: 12 },
        { header: IMPORT_HEADERS.balance, key: 'balance', width: 10 },
        { header: IMPORT_HEADERS.note, key: 'note', width: 40 },
      ],
      rows: [],
    },
    {
      name: 'Leave types',
      columns: [
        { header: 'Code', key: 'code', width: 10 },
        { header: 'Leave type', key: 'name', width: 30 },
      ],
      rows: types.map((t) => ({ code: t.code, name: t.name })),
    },
  ])
  return new File([new Uint8Array(bytes)], 'leave-opening-balances.xlsx', { type: XLSX_TYPE })
}

const cellText = (v: CellValue | undefined) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v).trim())

// Checks every row - the employee (Leave Edit covering them - data access, each row's person), the type (active, paid),
// the balance (0-999), one row per employee and type - and, with `save` and no row wrong, sets each balance: the
// difference from today's balance is added as an adjustment with the row's note. All rows or none (as the employee import).
export async function importBalances(viewer: CurrentUser, { file, save }: z.infer<typeof importBalancesInput>) {
  let sheet: Awaited<ReturnType<typeof readFirstSheet>>
  try {
    sheet = await readFirstSheet(new Uint8Array(await file.arrayBuffer()))
  } catch (error) {
    throw new ORPCError('BAD_REQUEST', { message: error instanceof Error ? error.message : 'The file cannot be read' })
  }
  const hasColumn = (h: string) => sheet.headers.some((x) => x.toLowerCase() === h.toLowerCase())
  const missing = [IMPORT_HEADERS.code, IMPORT_HEADERS.type, IMPORT_HEADERS.balance].filter((h) => !hasColumn(h))
  if (missing.length) throw new ORPCError('BAD_REQUEST', { message: `The file has no ${missing.join(' / ')} column - use the template` })
  if (!sheet.rows.length) throw new ORPCError('BAD_REQUEST', { message: 'The file has no rows' })
  if (sheet.rows.length > MAX_IMPORT_ROWS) throw new ORPCError('BAD_REQUEST', { message: `At most ${MAX_IMPORT_ROWS} rows in one file` })
  const cell = (values: Record<string, CellValue>, header: string) => cellText(Object.entries(values).find(([k]) => k.toLowerCase() === header.toLowerCase())?.[1])
  const types = new Map((await typesService.allTypes()).map((t) => [t.code, t]))
  const codes = sheet.rows.map((r) => cell(r.values, IMPORT_HEADERS.code).toUpperCase())
  const ids = await employeesService.mapCodesToIds(codes.filter(Boolean))
  const people = new Map(
    (await employeesService.listLeavePeople({ scope: SYSTEM_SCOPE, ids: [...new Set(ids.values())], from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) })).map((p) => [p.id, p]),
  )
  const current = new Map((await balancesRepository.sumBalances([...people.keys()])).map((b) => [`${b.employeeId}:${b.leaveTypeId}`, b.days]))
  const seen = new Set<string>()
  const rows = sheet.rows.map((r, i) => {
    const code = codes[i]!
    const typeCode = cell(r.values, IMPORT_HEADERS.type).toUpperCase()
    const raw = cell(r.values, IMPORT_HEADERS.balance)
    const note = cell(r.values, IMPORT_HEADERS.note).slice(0, 500) || 'Opening balance (Excel import)'
    const id = ids.get(code)
    const person = id ? people.get(id) : undefined
    const type = types.get(typeCode)
    const balance = Number(raw)
    let problem: string | null = null
    // (outside the caller's data access the employee is "not found" - never reveal they exist)
    if (!code) problem = 'No employee code'
    else if (!person || !hasLevelAt(viewer, 'LEAVE', leaveService.placementOf(person), 'READ')) problem = `No employee found with code ${code}`
    else if (!hasLevelAt(viewer, 'LEAVE', leaveService.placementOf(person), 'WRITE')) problem = "You do not have access to change this employee's leave"
    else if (!type || !type.isActive) problem = `No leave type ${typeCode || '(empty)'}`
    else if (!type.isPaid) problem = `${type.code} is leave without pay - it has no balance`
    else if (raw === '' || !Number.isFinite(balance) || balance < 0 || balance > 999) problem = 'The balance must be a number from 0 to 999'
    else if (seen.has(`${person.id}:${type.id}`)) problem = `${code} ${type.code} is in the file twice`
    if (person && type) seen.add(`${person.id}:${type.id}`)
    const now = !problem && person && type ? round2(current.get(`${person.id}:${type.id}`) ?? 0) : null
    const set = problem ? null : round2(balance)
    return {
      rowNumber: r.rowNumber,
      employeeCode: code,
      name: !problem || problem.startsWith('No leave type') ? (person?.name ?? null) : null,
      leaveType: type?.code ?? (typeCode || null),
      current: now,
      balance: set,
      change: set !== null && now !== null ? round2(set - now) : null,
      note,
      problem,
      personId: person?.id ?? null,
      typeId: type?.id ?? null,
    }
  })
  const problems = rows.filter((r) => r.problem).length
  const changes = rows.filter((r) => !r.problem && r.change)
  let saved = 0
  if (save) {
    if (problems) throw new ORPCError('BAD_REQUEST', { message: `${problems} ${problems === 1 ? 'row is' : 'rows are'} wrong - nothing was saved; fix the file and upload it again` })
    saved = await prisma.$transaction((tx) =>
      balancesRepository.addEntries(
        changes.map((r) => ({ employeeId: r.personId!, leaveTypeId: r.typeId!, kind: 'ADJUSTMENT' as const, days: r.change!, effectiveDate: today(), note: r.note })),
        viewer.employeeId,
        tx,
      ),
    )
  }
  return {
    rows: rows.map(({ personId: _personId, typeId: _typeId, ...r }) => r),
    problems,
    // rows that change a balance (the others already have it)
    changes: changes.length,
    saved,
  }
}
