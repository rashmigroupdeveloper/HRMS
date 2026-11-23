import { assertGroupWide, hasLevelAt, scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }
import { assertAccess, hasAccess } from '#core/auth/access'
import { prisma } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import * as daysService from '../days/days.service.js'
import * as policiesService from '../policies/policies.service.js'
import * as shiftsRepository from './shifts.repository.js'
import type { assignShiftInput, createPatternInput, createShiftInput, listSchedulesInput, updatePatternInput, updateShiftInput } from './shifts.schema.js'

// Shifts, schedule patterns and who follows which (attendance, 2026-11-16; one pattern idea for everyone - the user,
// 2026-11-23). Shifts are read by everyone (rosters, one's own
// attendance); set up with Attendance setup: Edit. A night shift ends the next day (its end is not after its start).
// Dated (2026-11-23, like the policies): a shift's timing and a pattern's days are versions, each from a date - a day
// follows the version in force on it, so the days before a change keep what they had even when worked out again later.
// A change from a day already passed works those days out again at once (never across a locked month).

// a new shift's / pattern's first version - from the start
const FROM_THE_START = new Date(Date.UTC(2000, 0, 1))
// the version in force on a day (the first one before it starts)
const versionOn = <T extends { effectiveFrom: Date }>(versions: T[], day: Date) => versions.filter((v) => v.effectiveFrom <= day).at(-1) ?? versions[0]!

const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const lengthOf = (s: { startMinute: number; endMinute: number }) => (s.endMinute > s.startMinute ? s.endMinute - s.startMinute : s.endMinute + 1440 - s.startMinute)

const timingOf = (v: shiftsRepository.Timing): shiftsRepository.Timing => ({ startMinute: v.startMinute, endMinute: v.endMinute, breakMinutes: v.breakMinutes, halfSplitMinute: v.halfSplitMinute })
const clocks = (t: shiftsRepository.Timing) => ({
  ...t,
  start: clock(t.startMinute),
  end: clock(t.endMinute),
  // where the first half ends (null: the middle of the shift)
  halfSplit: t.halfSplitMinute === null ? null : clock(t.halfSplitMinute),
  crossesMidnight: t.endMinute <= t.startMinute,
  lengthMinutes: lengthOf(t),
})

// For the API: the timing in force today - the times as "09:00", whether it crosses midnight, how long it is - with the
// date it runs from, and every version (who set it)
async function toShifts(rows: shiftsRepository.ShiftRow[]) {
  const person = await employeesService.lookupPeople(rows.flatMap((r) => r.versions.map((v) => v.updatedById)))
  const now = today()
  return rows.map(({ versions, ...shift }) => {
    const current = versionOn(versions, now)
    return {
      ...shift,
      ...clocks(timingOf(current)),
      // the date the timing in force today runs from (2000-01-01 = from the start)
      from: current.effectiveFrom,
      versions: versions.map((v) => ({ effectiveFrom: v.effectiveFrom, ...clocks(timingOf(v)), current: v.id === current.id, upcoming: v.effectiveFrom > now, by: person(v.updatedById), at: v.updatedAt })),
    }
  })
}

export async function listShifts(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ATTENDANCE_SETUP', 'READ')
  // earliest start first (the timing in force today)
  return (await toShifts(await shiftsRepository.listShifts(includeInactive))).sort((a, b) => a.startMinute - b.startMinute || a.code.localeCompare(b.code))
}

async function getShift(id: number) {
  const shift = await shiftsRepository.findShift(id)
  if (!shift) throw new ORPCError('NOT_FOUND', { message: `No shift with id ${id}` })
  return shift
}

function checkTimes(s: { startMinute: number; endMinute: number; breakMinutes: number; halfSplitMinute: number | null }) {
  const bad = (message: string) => {
    throw new ORPCError('BAD_REQUEST', { message })
  }
  if (s.startMinute === s.endMinute) bad('The shift cannot start and end at the same time')
  if (lengthOf(s) - s.breakMinutes <= 0) bad('The break is longer than the shift')
  // the first half ends inside the shift (a night shift: after midnight counts)
  if (s.halfSplitMinute !== null) {
    const fromStart = (s.halfSplitMinute - s.startMinute + 1440) % 1440
    if (fromStart <= 0 || fromStart >= lengthOf(s)) bad(`The first half must end between the shift's start and end (${clock(s.startMinute)}-${clock(s.endMinute)})`)
  }
}

// Shifts and patterns are the same for every company: changing them needs Attendance setup Edit for all companies (A4, 2026-11-18)
export async function createShift({ start, end, halfSplit, code, name, breakMinutes }: z.infer<typeof createShiftInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A shift')
  const timing = { startMinute: start, endMinute: end, breakMinutes, halfSplitMinute: halfSplit ?? null }
  checkTimes(timing)
  const id = await prisma.$transaction((tx) => shiftsRepository.createShift({ code, name }, timing, FROM_THE_START, viewer.employeeId, tx))
  const [shift] = await toShifts([await getShift(id)])
  return shift!
}

// The code, name, retired - and the timing from a date: the version in force that day with the changes, kept as the
// version from that date (one on the same date is replaced); later versions stay. From a day already passed: the days
// worked out on this shift since then are worked out again (never across a locked month).
export async function updateShift({ id, start, end, halfSplit, breakMinutes, effectiveFrom, code, name, isActive }: z.infer<typeof updateShiftInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A shift')
  const actorId = viewer.employeeId
  const current = await getShift(id)
  const changesTiming = start !== undefined || end !== undefined || halfSplit !== undefined || breakMinutes !== undefined
  if (changesTiming && !effectiveFrom) throw new ORPCError('BAD_REQUEST', { message: 'Give the date the new times apply from' })
  let timing: shiftsRepository.Timing | null = null
  if (changesTiming && effectiveFrom) {
    const base = timingOf(versionOn(current.versions, effectiveFrom))
    timing = {
      startMinute: start ?? base.startMinute,
      endMinute: end ?? base.endMinute,
      breakMinutes: breakMinutes ?? base.breakMinutes,
      halfSplitMinute: halfSplit === undefined ? base.halfSplitMinute : halfSplit,
    }
    checkTimes(timing)
    // the new times reach every day from that date on: not across a locked attendance month
    await daysService.assertNothingLockedFrom(effectiveFrom)
  }
  // a shift that a pattern in use names (today, or from a later version) stays in use (the pattern would point at a
  // retired shift)
  if (isActive === false) {
    const now = today()
    const using = (await shiftsRepository.listPatterns(false)).filter((p) => p.versions.some((v) => (v.effectiveFrom > now || v.id === versionOn(p.versions, now).id) && v.days.includes(id)))
    if (using.length) throw new ORPCError('CONFLICT', { message: `${current.name} is used by ${using.map((p) => p.name).join(', ')} - change ${using.length === 1 ? 'that pattern' : 'those patterns'} first` })
  }
  await prisma.$transaction(async (tx) => {
    if (code !== undefined || name !== undefined || isActive !== undefined) {
      await shiftsRepository.updateShift(id, { ...(code !== undefined && { code }), ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) }, actorId, tx)
    }
    if (timing && effectiveFrom) await shiftsRepository.upsertShiftVersion(id, effectiveFrom, timing, actorId, tx)
  })
  // the days already passed from that date follow the new times
  if (timing && effectiveFrom && effectiveFrom <= today()) {
    await daysService.recompute(await shiftsRepository.listEmployeeIdsWithShiftFrom(id, effectiveFrom), effectiveFrom, today())
  }
  const [shift] = await toShifts([await getShift(id)])
  return shift!
}

// --- schedules (who follows which pattern) ---

// Which day of a pattern a date is, when the date's week is week `startWeek` of it: a 7 / 14 / 21-day pattern lines up
// with Monday-Sunday (Monday = the first day of a week)
// - a pattern that is not whole weeks (e.g. 4 days on, 4 off - only through the API) starts on its first day on the
// schedule's first date (2026-11-23, the review: a 4-day pattern given from a Thursday started on its day 4)
export function patternDayOf(date: Date, startWeek: number, length: number) {
  if (length % 7 !== 0) return 1
  const weekday = (date.getUTCDay() + 6) % 7
  return (((startWeek - 1) * 7 + weekday) % length) + 1
}

// Gives employees a schedule pattern from a date - and an attendance policy (2026-11-22); the days already passed from
// that date are worked out again
export async function assignShift({ employeeCodes, patternId, startWeek, policyId, effectiveFrom }: z.infer<typeof assignShiftInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const pattern = await getPattern(patternId)
  // the pattern's days on the schedule's first day (dated patterns - 2026-11-23)
  const { days } = versionOn(pattern.versions, effectiveFrom)
  const weeks = Math.ceil(days.length / 7)
  if (startWeek > weeks) throw new ORPCError('BAD_REQUEST', { message: `${pattern.name} has only ${weeks} week${weeks === 1 ? '' : 's'}` })
  const patternDay = patternDayOf(effectiveFrom, startWeek, days.length)
  // the policy named must be in use (none: the default policy)
  if (policyId) await policiesService.getActivePolicy(policyId)
  // a schedule reaches every day from its date on: not across a locked attendance month (2026-11-23)
  await daysService.assertNothingLockedFrom(effectiveFrom)
  const ids = await employeesService.mapCodesToIds(employeeCodes)
  const unknown = [...new Set(employeeCodes)].filter((code) => !ids.has(code))
  if (unknown.length) throw new ORPCError('BAD_REQUEST', { message: `No employee found with code ${unknown.slice(0, 5).join(', ')}` })
  // each employee: Attendance setup Edit covering where they are (data access)
  for (const person of await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [...new Set(ids.values())], ...EVER })) {
    daysService.assertAttendanceEdit(viewer, person, 'ATTENDANCE_SETUP')
  }
  await prisma.$transaction(async (tx) => {
    for (const employeeId of new Set(ids.values())) {
      await shiftsRepository.upsertAssignment({ employeeId, patternId, patternDay, policyId: policyId ?? null, effectiveFrom }, actorId, tx)
    }
  })
  if (effectiveFrom <= today()) await daysService.recompute([...new Set(ids.values())], effectiveFrom, today())
  return { assigned: new Set(ids.values()).size }
}

// Who follows which pattern and policy today (the user, 2026-11-23: "which employee got what schedule pattern and
// what policy"): every employee inside the viewer's Attendance setup View data access - their schedule in force today (or
// the default pattern / policy when none was given), since when, and the next change already set
export async function listSchedules(viewer: CurrentUser, filter: NonNullable<z.infer<typeof listSchedulesInput>>) {
  const day = today()
  const people = await employeesService.listAttendancePeople({
    scope: scopeOf(viewer, 'ATTENDANCE_SETUP', 'READ'),
    search: filter.search,
    companyIds: filter.companyIds,
    plantIds: filter.plantIds,
    departmentIds: filter.departmentIds,
    costCenterIds: filter.costCenterIds,
    from: day,
    to: day,
  })
  const [assignments, patterns, policies] = await Promise.all([
    shiftsRepository.listAssignments(people.map((p) => p.id), new Date(Date.UTC(2200, 0, 1))),
    shiftsRepository.listPatterns(true).then(toPatterns),
    policiesService.listPolicies(viewer, true),
  ])
  const patternOf = new Map(patterns.map((p) => [p.id, p]))
  const policyOf = new Map(policies.map((p) => [p.id, p]))
  const defaultPattern = patterns.find((p) => p.isDefault && p.isActive)
  const defaultPolicy = policies.find((p) => p.isDefault && p.isActive)
  const name = (p: { id: number; name: string } | undefined) => (p ? { id: p.id, name: p.name } : null)
  const rows = people.map((person) => {
    const own = assignments.filter((a) => a.employeeId === person.id)
    const current = own.filter((a) => a.effectiveFrom <= day).at(-1)
    const next = own.find((a) => a.effectiveFrom > day)
    const pattern = current ? patternOf.get(current.patternId) : defaultPattern
    const policy = current?.policyId ? policyOf.get(current.policyId) : defaultPolicy
    return {
      employee: {
        employeeCode: person.employeeCode,
        name: person.name,
        company: person.company.code,
        plant: `${person.plant.plantCode} ${person.plant.name}`,
        department: person.department?.name ?? null,
        costCenter: person.costCenter?.code ?? null,
        workLocation: person.workLocation?.name ?? null,
      },
      pattern: name(pattern),
      // true: never given a schedule - the default pattern
      patternIsDefault: !current,
      policy: name(policy),
      // true: the schedule names no policy - the default one
      policyIsDefault: !current?.policyId,
      since: current?.effectiveFrom ?? null,
      next: next ? { from: next.effectiveFrom, pattern: name(patternOf.get(next.patternId)) } : null,
    }
  })
  return rows.filter((r) => (!filter.patternId || r.pattern?.id === filter.patternId) && (!filter.policyId || r.policy?.id === filter.policyId))
}

// One employee's assignments, newest first (own record, or Attendance setup: View)
export async function listEmployeeAssignments(viewer: CurrentUser, employeeCode: string) {
  const employee = await employeesService.getByCode(employeeCode)
  // own record, or Attendance setup View covering where they are (data access) - else "not found"
  const at = { companyId: employee.company.id, plantId: employee.plant.id, departmentId: employee.department?.id ?? null }
  if (viewer.employeeCode !== employeeCode && !hasLevelAt(viewer, 'ATTENDANCE_SETUP', at, 'READ')) {
    throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  }
  const rows = await shiftsRepository.listEmployeeAssignments(employee.id)
  const person = await employeesService.lookupPeople(rows.map((r) => r.createdById))
  return rows.map(({ createdById, ...row }) => ({ ...row, by: person(createdById) }))
}

// --- schedule patterns ---

// For the API: the days in force today, with the date they run from, and every version (who set it)
// (and whether it is the default today, or becomes it on a later date)
async function toPatterns(rows: shiftsRepository.PatternRow[]) {
  const [person, defaults] = await Promise.all([employeesService.lookupPeople(rows.flatMap((r) => r.versions.map((v) => v.updatedById))), shiftsRepository.listDefaultChanges()])
  const now = today()
  const defaultId = defaults.length ? versionOn(defaults, now).patternId : null
  const list = rows.map(({ versions, ...pattern }) => {
    const current = versionOn(versions, now)
    return {
      ...pattern,
      // the default pattern today (dated - 2026-11-23)
      isDefault: pattern.id === defaultId,
      // the date it becomes the default, when a later change names it
      defaultFrom: defaults.find((d) => d.effectiveFrom > now && d.patternId === pattern.id)?.effectiveFrom ?? null,
      days: current.days,
      halfDays: current.halfDays,
      // the date the days in force today run from (2000-01-01 = from the start)
      from: current.effectiveFrom,
      versions: versions.map((v) => ({ effectiveFrom: v.effectiveFrom, days: v.days, halfDays: v.halfDays, current: v.id === current.id, upcoming: v.effectiveFrom > now, by: person(v.updatedById), at: v.updatedAt })),
    }
  })
  // the default first
  return list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

// Whether the pattern is the default on any day from `from` on (today's default, or named by a later change)
async function isDefaultFrom(patternId: number, from: Date) {
  const defaults = await shiftsRepository.listDefaultChanges()
  if (!defaults.length) return false
  return versionOn(defaults, from).patternId === patternId || defaults.some((d) => d.effectiveFrom > from && d.patternId === patternId)
}

// Read by whoever builds rosters (managers and Attendance); the retired ones with Attendance setup: View
export async function listPatterns(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive && !hasAccess(viewer.access, 'ATTENDANCE_SETUP', 'READ')) includeInactive = false
  return toPatterns(await shiftsRepository.listPatterns(includeInactive))
}

async function checkPatternDays(days: number[], halfDays: number[]) {
  const ids = new Set((await shiftsRepository.listShifts(false)).map((s) => s.id))
  const bad = days.filter((d) => d !== 0 && !ids.has(d))
  if (bad.length) throw new ORPCError('BAD_REQUEST', { message: 'The pattern uses a shift that does not exist or is retired' })
  if (!days.some((d) => d !== 0)) throw new ORPCError('BAD_REQUEST', { message: 'A pattern needs at least one working day' })
  // a half day is the first half of a working day
  if (halfDays.some((n) => n > days.length || days[n - 1] === 0)) throw new ORPCError('BAD_REQUEST', { message: 'A half day must be a day with a shift' })
}

async function toPattern(id: number) {
  const row = await shiftsRepository.findPattern(id)
  if (!row) throw new ORPCError('NOT_FOUND', { message: `No schedule pattern with id ${id}` })
  const [pattern] = await toPatterns([row])
  return pattern!
}

export async function createPattern({ halfDays, days, name }: z.infer<typeof createPatternInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A schedule pattern')
  const half = [...new Set(halfDays)].sort((a, b) => a - b)
  await checkPatternDays(days, half)
  const id = await prisma.$transaction((tx) => shiftsRepository.createPattern(name, { days, halfDays: half }, FROM_THE_START, viewer.employeeId, tx))
  return toPattern(id)
}

// The name, default, retired - and the days from a date: the version in force that day with the changes, kept as the
// version from that date (one on the same date is replaced); later versions stay. From a day already passed: the days of
// the employees following it are worked out again from then (never across a locked month). `isDefault` makes it the
// default from today (dated - 2026-11-23: the days before today keep the default they had); there is always exactly one,
// so the default - today's or a later one - cannot be retired.
export async function updatePattern({ id, effectiveFrom, days: newDays, halfDays: newHalfDays, ...changes }: z.infer<typeof updatePatternInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A schedule pattern')
  const actorId = viewer.employeeId
  const current = await shiftsRepository.findPattern(id)
  if (!current) throw new ORPCError('NOT_FOUND', { message: `No schedule pattern with id ${id}` })
  const { isDefault, ...own } = changes
  const day = today()
  if (own.isActive === false && (await isDefaultFrom(id, day))) throw new ORPCError('CONFLICT', { message: 'The default pattern cannot be retired - star another pattern first' })
  const becomesDefault = !!isDefault && !(await toPattern(id)).isDefault
  if (isDefault && (own.isActive === false || !current.isActive)) throw new ORPCError('BAD_REQUEST', { message: 'A retired pattern cannot be the default' })
  const changesDays = newDays !== undefined || newHalfDays !== undefined
  if (changesDays && !effectiveFrom) throw new ORPCError('BAD_REQUEST', { message: 'Give the date the new days apply from' })
  let cycle: shiftsRepository.Cycle | null = null
  if (changesDays && effectiveFrom) {
    const base = versionOn(current.versions, effectiveFrom)
    cycle = { days: newDays ?? base.days, halfDays: newHalfDays ? [...new Set(newHalfDays)].sort((a, b) => a - b) : base.halfDays }
    await checkPatternDays(cycle.days, cycle.halfDays)
    // the new days reach every day from that date on: not across a locked attendance month
    await daysService.assertNothingLockedFrom(effectiveFrom)
  }
  await prisma.$transaction(async (tx) => {
    if (own.name !== undefined || own.isActive !== undefined) await shiftsRepository.updatePattern(id, own, actorId, tx)
    if (becomesDefault) await shiftsRepository.setDefaultFrom(id, day, actorId, tx)
    if (cycle && effectiveFrom) await shiftsRepository.upsertPatternVersion(id, effectiveFrom, cycle, actorId, tx)
  })
  // the days already passed from that date follow the new days: everyone given the pattern - and, for the default one,
  // everyone never given a schedule
  if (cycle && effectiveFrom && effectiveFrom <= today()) {
    const ids = (await isDefaultFrom(id, effectiveFrom))
      ? (await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, from: effectiveFrom, to: today() })).map((p) => p.id)
      : await shiftsRepository.listEmployeeIdsOnPattern(id)
    await daysService.recompute(ids, effectiveFrom, today())
  }
  // the new default from today: today's days of everyone are worked out again (those never given a schedule follow it)
  if (becomesDefault) await daysService.recompute((await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, from: day, to: day })).map((p) => p.id), day, day)
  return toPattern(id)
}

export async function getPattern(id: number) {
  const pattern = await shiftsRepository.findPattern(id)
  if (!pattern || !pattern.isActive) throw new ORPCError('NOT_FOUND', { message: `No schedule pattern with id ${id}` })
  return pattern
}
