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

const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const lengthOf = (s: { startMinute: number; endMinute: number }) => (s.endMinute > s.startMinute ? s.endMinute - s.startMinute : s.endMinute + 1440 - s.startMinute)

// For the API: the times as "09:00", whether it crosses midnight, how long it is
export function toShift(s: shiftsRepository.ShiftRow) {
  return {
    ...s,
    start: clock(s.startMinute),
    end: clock(s.endMinute),
    // where the first half ends (null: the middle of the shift)
    halfSplit: s.halfSplitMinute === null ? null : clock(s.halfSplitMinute),
    crossesMidnight: s.endMinute <= s.startMinute,
    lengthMinutes: lengthOf(s),
  }
}

export async function listShifts(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive) assertAccess(viewer.access, 'ATTENDANCE_SETUP', 'READ')
  return (await shiftsRepository.listShifts(includeInactive)).map(toShift)
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
export async function createShift({ start, end, halfSplit, ...input }: z.infer<typeof createShiftInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A shift')
  const data = { ...input, startMinute: start, endMinute: end, halfSplitMinute: halfSplit ?? null }
  checkTimes(data)
  return toShift(await shiftsRepository.createShift(data, viewer.employeeId))
}

// A change applies to the days worked out from now on (days already worked out keep what they had)
export async function updateShift({ id, start, end, halfSplit, ...changes }: z.infer<typeof updateShiftInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A shift')
  const actorId = viewer.employeeId
  const current = await getShift(id)
  const next = {
    ...current,
    ...changes,
    startMinute: start ?? current.startMinute,
    endMinute: end ?? current.endMinute,
    halfSplitMinute: halfSplit === undefined ? current.halfSplitMinute : halfSplit,
  }
  checkTimes(next)
  // a shift that a pattern in use names stays in use (the pattern would point at a retired shift)
  if (changes.isActive === false) {
    const using = (await shiftsRepository.listPatterns(false)).filter((p) => p.days.includes(id))
    if (using.length) throw new ORPCError('CONFLICT', { message: `${current.name} is used by ${using.map((p) => p.name).join(', ')} - change ${using.length === 1 ? 'that pattern' : 'those patterns'} first` })
  }
  const shift = await shiftsRepository.updateShift(
    id,
    { ...changes, ...(start !== undefined && { startMinute: start }), ...(end !== undefined && { endMinute: end }), ...(halfSplit !== undefined && { halfSplitMinute: halfSplit }) },
    actorId,
  )
  return toShift(shift)
}

// --- schedules (who follows which pattern) ---

// Which day of a pattern a date is, when the date's week is week `startWeek` of it: a 7 / 14 / 21-day pattern lines up
// with Monday-Sunday (Monday = the first day of a week)
export function patternDayOf(date: Date, startWeek: number, length: number) {
  const weekday = (date.getUTCDay() + 6) % 7
  return (((startWeek - 1) * 7 + weekday) % length) + 1
}

// Gives employees a schedule pattern from a date - and an attendance policy (2026-11-22); the days already passed from
// that date are worked out again
export async function assignShift({ employeeCodes, patternId, startWeek, policyId, effectiveFrom }: z.infer<typeof assignShiftInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  const pattern = await getPattern(patternId)
  const weeks = Math.ceil(pattern.days.length / 7)
  if (startWeek > weeks) throw new ORPCError('BAD_REQUEST', { message: `${pattern.name} has only ${weeks} week${weeks === 1 ? '' : 's'}` })
  const patternDay = patternDayOf(effectiveFrom, startWeek, pattern.days.length)
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
    shiftsRepository.listPatterns(true),
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

// Read by whoever builds rosters (managers and Attendance); the retired ones with Attendance setup: View
export async function listPatterns(viewer: CurrentUser, includeInactive = false) {
  if (includeInactive && !hasAccess(viewer.access, 'ATTENDANCE_SETUP', 'READ')) includeInactive = false
  return shiftsRepository.listPatterns(includeInactive)
}

async function checkPatternDays(days: number[], halfDays: number[]) {
  const ids = new Set((await shiftsRepository.listShifts(false)).map((s) => s.id))
  const bad = days.filter((d) => d !== 0 && !ids.has(d))
  if (bad.length) throw new ORPCError('BAD_REQUEST', { message: 'The pattern uses a shift that does not exist or is retired' })
  if (!days.some((d) => d !== 0)) throw new ORPCError('BAD_REQUEST', { message: 'A pattern needs at least one working day' })
  // a half day is the first half of a working day
  if (halfDays.some((n) => n > days.length || days[n - 1] === 0)) throw new ORPCError('BAD_REQUEST', { message: 'A half day must be a day with a shift' })
}

export async function createPattern({ halfDays, ...input }: z.infer<typeof createPatternInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A schedule pattern')
  const half = [...new Set(halfDays)].sort((a, b) => a - b)
  await checkPatternDays(input.days, half)
  return shiftsRepository.createPattern({ ...input, halfDays: half }, viewer.employeeId)
}

// A change applies to the days worked out from now on (days already worked out keep what they had); `isDefault` moves
// the default here - there is always exactly one, so the default cannot be retired
export async function updatePattern({ id, ...changes }: z.infer<typeof updatePatternInput>, viewer: CurrentUser) {
  assertGroupWide(viewer, 'ATTENDANCE_SETUP', 'A schedule pattern')
  const actorId = viewer.employeeId
  const current = await shiftsRepository.findPattern(id)
  if (!current) throw new ORPCError('NOT_FOUND', { message: `No schedule pattern with id ${id}` })
  if (changes.isActive === false && current.isDefault) throw new ORPCError('CONFLICT', { message: 'The default pattern cannot be retired - star another pattern first' })
  if (changes.isDefault && (changes.isActive === false || !current.isActive)) throw new ORPCError('BAD_REQUEST', { message: 'A retired pattern cannot be the default' })
  const days = changes.days ?? current.days
  const halfDays = changes.halfDays ? [...new Set(changes.halfDays)].sort((a, b) => a - b) : current.halfDays
  if (changes.days || changes.halfDays) await checkPatternDays(days, halfDays)
  return prisma.$transaction(async (tx) => {
    const pattern = await shiftsRepository.updatePattern(id, { ...changes, ...(changes.halfDays && { halfDays }) }, actorId, tx)
    if (changes.isDefault) await shiftsRepository.clearDefaultPattern(id, actorId, tx)
    return pattern
  })
}

export async function getPattern(id: number) {
  const pattern = await shiftsRepository.findPattern(id)
  if (!pattern || !pattern.isActive) throw new ORPCError('NOT_FOUND', { message: `No schedule pattern with id ${id}` })
  return pattern
}
