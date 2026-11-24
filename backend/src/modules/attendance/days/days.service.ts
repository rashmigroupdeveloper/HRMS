import type { exportMonthInput } from './days.schema.js'
import { reportFile, reportSheet, writeReport } from '#core/excel/report'
import { hasLevelAt, type Placement, scopeOf, SYSTEM_SCOPE } from '#core/auth/scope'
import { assertAccess } from '#core/auth/access'
import { prisma, type DayStatus, type DbClient } from '#core/db/prisma'
import type { CurrentUser } from '#core/rpc/procedures'
import { employeesService, hodsService } from '#modules/employees'
import { today } from '#shared/utils/dates'
import { addDays, clockOf, DAY_MS, dayKey, eachDay, MINUTE_MS, zonedInstant } from '#shared/utils/time'
import { ORPCError } from '@orpc/server'
import type { z } from 'zod'
import type { peopleFilterSchema } from '../attendance.schema.js'
import * as daysRepository from './days.repository.js'
import type { boardInput, correctDayInput, dayPunchesInput, employeeMonthInput, musterInput, removeCorrectionInput } from './days.schema.js'

// Each employee's days (attendance, 2026-11-16).
// Which shift applies on a day: a holiday of the holiday list the employee follows that day (2026-11-24 - was by company /
// work location) first - a whole day, or one half off with the other worked,
// then a published roster day (a shift, or off), then the employee's default in force that day - a fixed shift and weekly
// offs, or the day of their rotation pattern (2026-11-22) -
// else the default shift with Sunday off. The punches are given to the day whose shift they are nearest (from 4 hours
// before its start to 8 hours after its end - so a night shift's morning punch goes to the night before).
// A working day: no punch = absent, one punch = missed punch, else the time from the first in to the last out decides
// (the user, 2026-11-22: "coming 9:10, leave 18:10" - the whole time is stayed, the break inside it): at least the
// full-day hours = present, at least the half-day hours = half day, less = absent; the unpaid break only comes off the
// hours worked shown. Late = in after start + grace, early = out before end - grace. A weekly off / holiday stays so (time worked is still recorded). HR's correction wins.
// Half-day sessions (the user, 2026-11-22): each day has a first and a second half, split where the shift says (else in
// its middle). A full day = both halves present; a half day = the half where most of the time was worked present, the
// other absent. On a half-day weekday (RML's Saturday) only the first half is worked: the day ends at the split, present
// = stayed at least the half-day hours from the first in (in 9:10, out 13:10 or later - the user, 2026-11-22); the
// second half is a weekly off. HR may correct either half; an uncorrected half follows the punches.
// The rules come from the day's attendance policy (2026-11-22 - the default-shift line's, else the default one): the
// grace, the full day (the whole shift unless set) and half day hours; very late in / very early out make that half
// absent; every Nth late day of a calendar month loses its first half. A rule's reason is kept in the day's note.
// Leave and requests (2026-11-22): a working half covered by approved leave (the leave module) is "leave", by an approved
// missed-punch regularization "present", by approved official duty "on duty" - over what the punches give, under HR's
// correction. A weekly off / holiday half is never covered. Days not worked out yet (to come, today before a punch) show
// what covers them (`covers`).
// Worked out when punches are uploaded, when a default shift / roster / holiday changes, and every night for yesterday;
// today only once someone has punched (or it is an off day / holiday).

// employees with no schedule given follow the default pattern from this Monday - so a 7 / 14 / 21-day pattern's first day
// is a Monday
const DEFAULT_ANCHOR = new Date(Date.UTC(2024, 0, 1))
const WINDOW_BEFORE = 4 * 60 * MINUTE_MS
const WINDOW_AFTER = 8 * 60 * MINUTE_MS
// two working shifts meeting within this time share the punches around that moment by order (punchesByDay)
const PAIR_WINDOW = 60 * MINUTE_MS
// if no policy exists at all (should not happen - "Standard" is seeded): grace 10, the whole shift, half day 4h, no penalties
const FALLBACK_POLICY: PlanPolicy = { id: null, name: 'Standard', graceMinutes: 10, fullDayMinutes: null, halfDayMinutes: 240, latesPerHalfDayCut: null, veryLateMinutes: null, veryEarlyMinutes: null }

type Person = employeesService.AttendancePerson
// a shift as one day sees it: its timing in force that day (dated shifts - 2026-11-23)
export type PlanShift = { id: number; code: string; name: string; isActive: boolean; startMinute: number; endMinute: number; breakMinutes: number; halfSplitMinute: number | null }
type PlanPolicy = { id: number | null; name: string; graceMinutes: number; fullDayMinutes: number | null; halfDayMinutes: number; latesPerHalfDayCut: number | null; veryLateMinutes: number | null; veryEarlyMinutes: number | null }
// `halfDay`: a working day of the first half only (a half-day weekday of the default shift line; a roster day is whole);
// `holidayHalf`: a working day with this half a holiday (a half-day holiday - 2026-11-24), the other half worked;
// `policy`: the rules the day is judged by
// `pattern`: the schedule pattern the day comes from (the user, 2026-11-23)
export type Plan = { kind: 'WORK' | 'WEEKLY_OFF' | 'HOLIDAY'; shift: PlanShift; holiday: string | null; holidayHalf: Half | null; rostered: boolean; halfDay: boolean; policy: PlanPolicy; pattern: string }

// Whether a half of a planned day is worked: a working day, not the off half of a half-day weekday or a half-day holiday
export function isWorkingHalf(plan: Pick<Plan, 'kind' | 'halfDay' | 'holidayHalf'>, half: Half) {
  return plan.kind === 'WORK' && !(plan.halfDay && half === 'SECOND') && plan.holidayHalf !== half
}
type Correction = { firstHalf: DayStatus | null; secondHalf: DayStatus | null }

// The day overall from its two halves (the calculation and HR's corrections): the same = that; a missed punch shows; one
// present + one absent = half day; worked or absent beside an off half = that; a weekly off beside a holiday = holiday.
// On duty counts as worked (on duty + present = present); a leave half beside a worked half = half day, beside an absent
// half = absent (the absent half still needs explaining), beside an off half = leave (2026-11-22)
export function dayStatusOf(first: DayStatus, second: DayStatus): DayStatus {
  if (first === second) return first
  const pair = [first, second]
  if (pair.includes('MISSED_PUNCH')) return 'MISSED_PUNCH'
  const off = (x: DayStatus) => x === 'WEEKLY_OFF' || x === 'HOLIDAY'
  if (off(first) && off(second)) return 'HOLIDAY'
  if (off(first)) return second
  if (off(second)) return first
  const worked = (x: DayStatus) => x === 'PRESENT' || x === 'ON_DUTY'
  if (worked(first) && worked(second)) return 'PRESENT'
  if (pair.includes('ABSENT') && pair.includes('LEAVE')) return 'ABSENT'
  return 'HALF_DAY'
}

// --- what covers a half besides the punches (2026-11-22): approved leave and regularization / on-duty requests ---

export type Half = 'FIRST' | 'SECOND'
// `code`: shown on the muster (CL, OD...); `label`: on the day ("Casual leave", "On duty")
// (HOLIDAY: an on-application holiday taken - its approved leave makes the half a holiday, 2026-11-24)
export type DayCover = { employeeId: number; date: Date; half: Half; status: 'LEAVE' | 'PRESENT' | 'ON_DUTY' | 'HOLIDAY'; code: string; label: string }
// The leave module gives its approved leave (and, when asked, the leave still waiting for approval) as covers - it
// registers this when it loads (attendance never imports leave: leave depends on attendance)
export type LeaveCoverSource = (employeeIds: number[], from: Date, to: Date, options: { pending: boolean }) => Promise<DayCover[]>
let leaveCovers: LeaveCoverSource | null = null
export function registerLeaveCovers(source: LeaveCoverSource) {
  leaveCovers = source
}
// Loudly, never silently: a process that works out days without the leave module loaded would lose everyone's leave
function leaveSource() {
  if (!leaveCovers) throw new Error('The leave module is not loaded - import #modules/leave before working out attendance days')
  return leaveCovers
}

// What the leave module gives attendance for on-application holidays (2026-11-24) - registered when leave loads, as its
// covers are
export type HolidayLeaveHooks = {
  // the leave type an on-application holiday is taken from: there, in use and "only on its holiday dates" - throws if not
  assertLeaveType: (leaveTypeId: number) => Promise<void>
  // holidays or someone's list changed from..to (`employeeIds`: only theirs): the on-application holidays taken or asked
  // for then are checked again - those no longer theirs are cancelled, the days given back, the employee told
  recheck: (change: { from: Date; to: Date; employeeIds?: number[] }) => Promise<void>
}
let holidayLeave: HolidayLeaveHooks | null = null
export function registerHolidayLeave(hooks: HolidayLeaveHooks) {
  holidayLeave = hooks
}
// Loudly, never silently: changing holidays without the leave module loaded would leave taken holidays unchecked
export function holidayLeaveHooks() {
  if (!holidayLeave) throw new Error('The leave module is not loaded - import #modules/leave before changing holidays')
  return holidayLeave
}

// The halves of the days from..to (the first day from `startHalf`, the last day to `endHalf`)
export function halvesOf(from: Date, to: Date, startHalf: Half, endHalf: Half) {
  const out: { date: Date; half: Half }[] = []
  for (const date of eachDay(from, to)) {
    if (!(date.getTime() === from.getTime() && startHalf === 'SECOND')) out.push({ date, half: 'FIRST' })
    if (!(date.getTime() === to.getTime() && endHalf === 'FIRST')) out.push({ date, half: 'SECOND' })
  }
  return out
}

const REQUEST_COVER = {
  MISSED_PUNCH: { status: 'PRESENT', code: 'P', label: 'Regularized (missed punch)' },
  ON_DUTY: { status: 'ON_DUTY', code: 'OD', label: 'On duty' },
} as const

// Approved leave and approved regularization / on-duty requests over from..to (`pending`: also those still waiting), per
// employee and day ("<id>:<day>")
export async function loadCovers(employeeIds: number[], from: Date, to: Date, { pending = false }: { pending?: boolean } = {}) {
  const byDay = new Map<string, DayCover[]>()
  if (!employeeIds.length) return byDay
  const [leave, requests] = await Promise.all([leaveSource()(employeeIds, from, to, { pending }), daysRepository.listRegularizations(employeeIds, from, to, pending)])
  const covers = [...leave]
  for (const r of requests) {
    const cover = REQUEST_COVER[r.kind]
    for (const { date, half } of halvesOf(r.fromDate, r.toDate, r.portion === 'SECOND_HALF' ? 'SECOND' : 'FIRST', r.portion === 'FIRST_HALF' ? 'FIRST' : 'SECOND')) {
      if (date >= from && date <= to) covers.push({ employeeId: r.employeeId, date, half, ...cover })
    }
  }
  for (const c of covers) {
    const key = `${c.employeeId}:${dayKey(c.date)}`
    byDay.set(key, [...(byDay.get(key) ?? []), c])
  }
  return byDay
}

// A day's covers that apply: only working halves (a weekly off / holiday stays so; a half-day weekday's second half and a
// half-day holiday's half are off)
function workingCovers(plan: Plan | undefined, covers: DayCover[] | undefined) {
  if (!plan || plan.kind !== 'WORK' || !covers) return []
  return covers.filter((c) => isWorkingHalf(plan, c.half))
}

// --- the attendance month and its locks (the user, 2026-11-22) ---
// An attendance month runs from the settings' start day: with 26, "November" = 26 Oct - 25 Nov (1 = the calendar month).
// A locked month (one lock for the whole group) never changes: its days are not worked out again, and changes to them
// are refused (corrections, punches, roster days, shift changes).

export type LockState = { startDay: number; locked: Set<string> }
const monthKey = (year: number, month: number) => `${year}-${month}`

export async function loadLockState(): Promise<LockState> {
  const [startDay, locks] = await Promise.all([daysRepository.findCycleStartDay(), daysRepository.listOpenLocks()])
  return { startDay, locked: new Set(locks.map((l) => monthKey(l.year, l.month))) }
}

// The attendance month a day belongs to
export function cycleOf(day: Date, startDay: number) {
  let year = day.getUTCFullYear()
  let month = day.getUTCMonth() + 1
  if (startDay > 1 && day.getUTCDate() >= startDay) {
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return { year, month }
}

// The first and last day of an attendance month
export function cycleRange(year: number, month: number, startDay: number) {
  if (startDay <= 1) return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0)) }
  return { from: new Date(Date.UTC(year, month - 2, startDay)), to: new Date(Date.UTC(year, month - 1, startDay - 1)) }
}

export function isLockedDay(day: Date, state: LockState) {
  const { year, month } = cycleOf(day, state.startDay)
  return state.locked.has(monthKey(year, month))
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthName = (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`

// Refuses a change to a day of a locked attendance month
export async function assertOpenDays(days: Date[], state?: LockState) {
  const lock = state ?? (await loadLockState())
  const locked = days.find((d) => isLockedDay(d, lock))
  if (locked) {
    const { year, month } = cycleOf(locked, lock.startDay)
    throw new ORPCError('CONFLICT', { message: `${dayKey(locked)} is in ${monthName(year, month)}, a locked attendance month - open it again first` })
  }
}

// Refuses a change that reaches every day from `from` on (a schedule from a date) when a locked attendance month lies in
// that stretch - its planned days would change under the lock (2026-11-23)
export async function assertNothingLockedFrom(from: Date) {
  const lock = await loadLockState()
  const lockedAfter = [...lock.locked]
    .map((key) => key.split('-').map(Number) as [number, number])
    .filter(([year, month]) => cycleRange(year, month, lock.startDay).to >= from)
    .sort(([y1, m1], [y2, m2]) => y1 - y2 || m1 - m2)[0]
  if (lockedAfter) {
    throw new ORPCError('CONFLICT', { message: `${monthName(lockedAfter[0], lockedAfter[1])} is a locked attendance month - start the change after it, or open it again first` })
  }
}

// The first day from `from` on that a change reaching every later day may start on: the day after the last locked
// attendance month on or after `from` (none: `from` itself) - giving the plants' default holiday lists (2026-11-24)
export async function firstOpenDayFrom(from: Date) {
  const lock = await loadLockState()
  const lastLockedEnd = [...lock.locked]
    .map((key) => key.split('-').map(Number) as [number, number])
    .map(([year, month]) => cycleRange(year, month, lock.startDay).to)
    .filter((to) => to >= from)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  return lastLockedEnd ? addDays(lastLockedEnd, 1) : from
}

// --- who may see whom ---

type PeopleFilter = z.infer<typeof peopleFilterSchema>

// The employees a list shows: the viewer's reporting tree (TEAM), the employees whose HOD they are (DEPARTMENT), or
// everyone (ALL - Attendance: View); employed at some point from..to
export async function peopleInScope(viewer: CurrentUser, filter: PeopleFilter, from: Date, to: Date) {
  if (filter.scope === 'ALL') assertAccess(viewer.access, 'ATTENDANCE', 'READ')
  // (every list but ALL is limited to these ids - never everyone)
  const ids =
    filter.scope === 'ALL'
      ? undefined
      : filter.scope === 'TEAM'
        ? await employeesService.listReportingTreeIds(viewer.employeeId)
        : await hodsService.listDepartmentIds(viewer.employeeId)
  if (ids && !ids.length) return []
  return employeesService.listAttendancePeople({
    // everyone: inside the viewer's Attendance View data access; the team / department: the reporting tree / the HOD
    // relationship (relationships, not rows)
    scope: filter.scope === 'ALL' ? scopeOf(viewer, 'ATTENDANCE', 'READ') : SYSTEM_SCOPE,
    ids,
    companyIds: filter.companyIds,
    workLocationIds: filter.workLocationIds,
    departmentIds: filter.departmentIds,
    search: filter.search,
    from,
    to,
  })
}

const EVER = { from: new Date(Date.UTC(1950, 0, 1)), to: new Date(Date.UTC(2200, 0, 1)) }

// Where an attendance person is (data access)
export const placementOf = (p: { companyId: number; plantId: number; departmentId: number | null }): Placement => ({
  companyId: p.companyId,
  plantId: p.plantId,
  departmentId: p.departmentId,
})

// The employee, if the viewer may see their attendance: their own, someone in their reporting tree or whose HOD they are
// ("My department"), or Attendance: View covering where they are (data access) - else "not found"
export async function getVisiblePerson(viewer: CurrentUser, employeeCode: string) {
  const notFound = new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const id = (await employeesService.mapCodesToIds([employeeCode])).get(employeeCode)
  if (!id) throw notFound
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [id], ...EVER })
  if (!person) throw notFound
  if (id !== viewer.employeeId && !hasLevelAt(viewer, 'ATTENDANCE', placementOf(person), 'READ')) {
    const [tree, department] = await Promise.all([employeesService.listReportingTreeIds(viewer.employeeId), hodsService.listDepartmentIds(viewer.employeeId)])
    if (!tree.includes(id) && !department.includes(id)) throw notFound
  }
  return person
}

// HR's changes to someone's attendance: Attendance Edit covering where they are ("not found" outside the View range) -
// or Attendance setup Edit for the setup's per-person steps (default shifts, linking punches - 2026-11-22)
export function assertAttendanceEdit(viewer: CurrentUser, person: { employeeCode: string; companyId: number; plantId: number; departmentId: number | null }, area: 'ATTENDANCE' | 'ATTENDANCE_SETUP' = 'ATTENDANCE') {
  const at = placementOf(person)
  if (!hasLevelAt(viewer, area, at, 'READ')) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${person.employeeCode}` })
  if (!hasLevelAt(viewer, area, at, 'WRITE')) throw new ORPCError('FORBIDDEN', { message: "You do not have access to change this employee's attendance" })
}

// --- the plan of each day ---

// the version in force on a day: the latest that started by then (the first one runs from 2000-01-01)
const inForce = <T extends { effectiveFrom: Date }>(versions: T[], day: Date) => versions.filter((v) => v.effectiveFrom <= day).at(-1) ?? versions[0]!

// A shift's timing on a day, and a pattern's days on a day (dated - 2026-11-23: an edit from a date never reworks the days
// before it)
export function shiftOn({ versions, ...shift }: daysRepository.DatedShift, day: Date): PlanShift {
  const { startMinute, endMinute, breakMinutes, halfSplitMinute } = inForce(versions, day)
  return { ...shift, startMinute, endMinute, breakMinutes, halfSplitMinute }
}
export function patternOn(pattern: daysRepository.DatedPattern, day: Date) {
  const { days, halfDays } = inForce(pattern.versions, day)
  return { name: pattern.name, days, halfDays }
}

// Every shift, retired ones too (a day may still use one): the shift with this id as that day sees it
export async function loadShifts() {
  const byId = new Map((await daysRepository.listAllShifts()).map((s) => [s.id, s]))
  return (id: number, day: Date) => {
    const shift = byId.get(id)
    return shift ? shiftOn(shift, day) : undefined
  }
}

// `roster: false` - what the days are by default, without the roster (a roster day the same as the default is not kept -
// 2026-11-22)
export async function loadPlans(people: Person[], from: Date, to: Date, { roster: withRoster = true }: { roster?: boolean } = {}) {
  const ids = people.map((p) => p.id)
  const [shifts, policies, assignments, roster, holidays, defaults, holidayLists] = await Promise.all([
    daysRepository.listAllShifts(),
    daysRepository.listPolicies(),
    daysRepository.listAssignments(ids, to),
    withRoster ? daysRepository.listPublishedRoster(ids, from, to) : Promise.resolve([]),
    daysRepository.listHolidays(from, to),
    daysRepository.listDefaultPatterns(),
    daysRepository.listEmployeeHolidayLists(ids),
  ])
  // no schedule is built into the code (the user, 2026-11-23): employees with none given follow the default pattern -
  // there is always one (the default cannot be retired, only moved to another pattern); which one is dated (2026-11-23):
  // a day follows the default in force on it
  if (!defaults.length) throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'No default schedule pattern is set up - star a pattern on Attendance setup > Schedule patterns' })
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const shiftAt = (id: number, day: Date) => {
    const shift = shiftById.get(id)
    return shift ? shiftOn(shift, day) : undefined
  }
  const policyById = new Map(policies.map((p) => [p.id, p]))
  const defaultPolicy = policies.find((p) => p.isDefault && p.isActive)
  // a policy's rules on a day: the version in force then (dated policy changes - the user, 2026-11-23)
  const rulesOn = (p: (typeof policies)[number] | undefined, day: Date): PlanPolicy => {
    if (!p) return FALLBACK_POLICY
    const v = p.versions.filter((x) => x.effectiveFrom <= day).at(-1) ?? p.versions[0]
    return v ? { id: p.id, name: p.name, graceMinutes: v.graceMinutes, fullDayMinutes: v.fullDayMinutes, halfDayMinutes: v.halfDayMinutes, latesPerHalfDayCut: v.latesPerHalfDayCut, veryLateMinutes: v.veryLateMinutes, veryEarlyMinutes: v.veryEarlyMinutes } : FALLBACK_POLICY
  }
  const holidaysByDay = new Map<string, typeof holidays>()
  for (const h of holidays) holidaysByDay.set(dayKey(h.date), [...(holidaysByDay.get(dayKey(h.date)) ?? []), h])
  const plans = new Map<number, Map<string, Plan>>()
  for (const person of people) {
    const own = assignments.filter((a) => a.employeeId === person.id)
    const rostered = new Map(roster.filter((r) => r.employeeId === person.id).map((r) => [dayKey(r.date), r]))
    // the holiday list they follow, from each date (no row: no list - no holidays - 2026-11-24)
    const lists = holidayLists.filter((l) => l.employeeId === person.id)
    const days = new Map<string, Plan>()
    for (const day of eachDay(from, to)) {
      const key = dayKey(day)
      // the schedule in force: the latest that started by that day, else the default pattern
      const assignment = own.filter((a) => a.effectiveFrom <= day).at(-1)
      // the pattern's days in force that day (dated patterns - 2026-11-23); the cycle counts from the schedule's start
      const pattern = patternOn(assignment?.pattern ?? inForce(defaults, day).pattern, day)
      const anchor = assignment ? assignment.effectiveFrom : DEFAULT_ANCHOR
      const startDay = assignment ? assignment.patternDay : 1
      const policy = rulesOn((assignment?.policyId && policyById.get(assignment.policyId)) || defaultPolicy, day)
      // the pattern's day - counted from the schedule's start: a shift, its first half only, or off (0)
      const length = pattern.days.length
      const index = (((Math.round((day.getTime() - anchor.getTime()) / DAY_MS) + startDay - 1) % length) + length) % length
      const turn = pattern.days[index]!
      const half = pattern.halfDays.includes(index + 1)
      // an off day still has a shift - its punches (worked on a day off) are placed by it: the pattern's first shift
      const usual = shiftAt(pattern.days.find((d) => d !== 0)!, day)!
      const patternShift = turn ? (shiftAt(turn, day) ?? usual) : usual
      const listId = lists.filter((l) => l.effectiveFrom <= day).at(-1)?.holidayListId
      const holiday = listId === undefined ? undefined : holidaysByDay.get(key)?.find((h) => h.lists.some((l) => l.holidayListId === listId))
      // a published roster change (rare, one day) wins over the pattern
      const entry = rostered.get(key)
      const rosterShift = entry?.shiftId ? (shiftAt(entry.shiftId, day) ?? patternShift) : patternShift
      const base = { holiday: null, holidayHalf: null, rostered: false, halfDay: false, policy, pattern: pattern.name }
      // the day without a holiday: the roster's, else the pattern's
      const plain: Plan = entry
        ? { ...base, kind: entry.shiftId ? 'WORK' : 'WEEKLY_OFF', shift: rosterShift, rostered: true }
        : { ...base, kind: turn ? 'WORK' : 'WEEKLY_OFF', shift: patternShift, halfDay: !!turn && half }
      days.set(key, withHoliday(plain, holiday))
    }
    plans.set(person.id, days)
  }
  return plans
}

// A day with its holiday (2026-11-24): a whole-day holiday makes any day a holiday (one on a weekly off is simply lost); a
// half-day holiday makes that half off on a working day - on a half-day weekday its first half makes the whole day off
// and its second half (off anyway) changes nothing; on a weekly off it changes nothing
function withHoliday(plain: Plan, holiday: { name: string; portion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' } | undefined): Plan {
  if (!holiday) return plain
  if (holiday.portion === 'FULL_DAY') return { ...plain, kind: 'HOLIDAY', halfDay: false, holiday: holiday.name }
  if (plain.kind !== 'WORK') return plain
  const off: Half = holiday.portion === 'FIRST_HALF' ? 'FIRST' : 'SECOND'
  if (plain.halfDay) return off === 'FIRST' ? { ...plain, kind: 'HOLIDAY', halfDay: false, holiday: holiday.name } : plain
  return { ...plain, holiday: holiday.name, holidayHalf: off }
}

// Which part of the shift is worked: the whole, its first half only (a half-day weekday, a second-half holiday) or its
// second half only (a first-half holiday)
type Part = 'WHOLE' | 'FIRST' | 'SECOND'
const partOf = (plan: Plan): Part => (plan.halfDay || plan.holidayHalf === 'SECOND' ? 'FIRST' : plan.holidayHalf === 'FIRST' ? 'SECOND' : 'WHOLE')

// When the day's shift runs (a night shift ends the next day), and where its first half ends - a day of its first half
// only ends there, a day of its second half only starts there
function spanOf(day: Date, s: PlanShift, timeZone: string, part: Part = 'WHOLE') {
  const end = s.endMinute > s.startMinute ? s.endMinute : s.endMinute + 1440
  const split = s.halfSplitMinute === null ? Math.round((s.startMinute + end) / 2) : s.halfSplitMinute > s.startMinute ? s.halfSplitMinute : s.halfSplitMinute + 1440
  const at = (minute: number) => zonedInstant(day, minute, timeZone)
  return { start: at(part === 'SECOND' ? split : s.startMinute), end: at(part === 'FIRST' ? split : end), split: at(split), shiftMinutes: end - s.startMinute }
}

// Each punch goes to the day whose shift it is nearest
function punchesByDay(punches: Date[], days: Date[], plans: Map<string, Plan>, timeZone: string) {
  const spans = days.flatMap((day) => {
    const plan = plans.get(dayKey(day))
    return plan ? [{ key: dayKey(day), working: plan.kind === 'WORK', ...spanOf(day, plan.shift, timeZone, partOf(plan)) }] : []
  })
  const byDay = new Map<string, Date[]>()
  for (const punch of punches) {
    let best: { key: string; distance: number } | null = null
    for (const span of spans) {
      const t = punch.getTime()
      if (t < span.start.getTime() - WINDOW_BEFORE || t > span.end.getTime() + WINDOW_AFTER) continue
      const distance = t < span.start.getTime() ? span.start.getTime() - t : t > span.end.getTime() ? t - span.end.getTime() : 0
      if (!best || distance < best.distance) best = { key: span.key, distance }
    }
    if (best) byDay.set(best.key, [...(byDay.get(best.key) ?? []), punch])
  }
  // a shift ending where the next working day's starts (a night shift then a morning one - 2026-11-23, the review): the
  // punches around that moment are split at their biggest gap - the earlier close the first shift, the later open the
  // next (nearest alone put a late out and an early in both on one day, so one day lost its out and the other its in)
  for (let i = 0; i + 1 < spans.length; i++) {
    const [a, b] = [spans[i]!, spans[i + 1]!]
    if (!a.working || !b.working || Math.abs(b.start.getTime() - a.end.getTime()) > PAIR_WINDOW) continue
    const from = Math.min(a.end.getTime(), b.start.getTime()) - PAIR_WINDOW
    const to = Math.max(a.end.getTime(), b.start.getTime()) + PAIR_WINDOW
    const near = (key: string) => (byDay.get(key) ?? []).filter((p) => p.getTime() >= from && p.getTime() <= to)
    const zone = [...near(a.key), ...near(b.key)].sort((x, y) => x.getTime() - y.getTime())
    if (zone.length < 2) continue
    let cut = 1
    for (let j = 2; j < zone.length; j++) if (zone[j]!.getTime() - zone[j - 1]!.getTime() > zone[cut]!.getTime() - zone[cut - 1]!.getTime()) cut = j
    const inZone = new Set(zone.map((p) => p.getTime()))
    const keep = (key: string) => (byDay.get(key) ?? []).filter((p) => !inZone.has(p.getTime()))
    byDay.set(a.key, [...keep(a.key), ...zone.slice(0, cut)].sort((x, y) => x.getTime() - y.getTime()))
    byDay.set(b.key, [...zone.slice(cut), ...keep(b.key)].sort((x, y) => x.getTime() - y.getTime()))
  }
  return byDay
}

// One day's result from its plan and punches: each half as the punches and the policy give it (`auto`), with the reasons
// of any rule (`notes`) - the late penalty of the month and HR's corrections are added by `finish`
// punches this close to the first one are the same tap repeated
const SAME_TAP_MINUTES = 5

function computeDay(day: Date, plan: Plan, punches: Date[], timeZone: string) {
  const s = plan.shift
  const policy = plan.policy
  const part = partOf(plan)
  const { start, end, split, shiftMinutes } = spanOf(day, plan.shift, timeZone, part)
  const sorted = [...punches].sort((a, b) => a.getTime() - b.getTime())
  const firstIn = sorted[0] ?? null
  // an out punch only when it is more than a few minutes after the in punch: two taps at the door (09:00 and 09:01) are one
  // punch, so a forgotten out punch is a missed punch, not a 1-minute day marked absent (2026-11-23)
  const lastOut = firstIn && sorted.length > 1 && sorted.at(-1)!.getTime() - firstIn.getTime() > SAME_TAP_MINUTES * MINUTE_MS ? sorted.at(-1)! : null
  const minutes = (ms: number) => Math.max(0, Math.round(ms / MINUTE_MS))
  const span = firstIn && lastOut ? minutes(lastOut.getTime() - firstIn.getTime()) : 0
  // the hours worked shown: the time stayed less the unpaid break (none on a half day - it is the lunch of a full day);
  // the day's status goes by the time stayed (`span`)
  const worked = part !== 'WHOLE' ? span : Math.max(0, span - s.breakMinutes)
  // how much of a half the punches cover
  const covered = (from: Date, to: Date) => (firstIn && lastOut ? Math.max(0, Math.min(lastOut.getTime(), to.getTime()) - Math.max(firstIn.getTime(), from.getTime())) : 0)
  let first: DayStatus
  let second: DayStatus
  if (plan.kind === 'HOLIDAY') first = second = 'HOLIDAY'
  else if (plan.kind === 'WEEKLY_OFF') first = second = 'WEEKLY_OFF'
  else if (part !== 'WHOLE') {
    // one half worked: present = stayed at least the half-day hours; the other half off - the weekly off of a half-day
    // weekday, or the holiday half
    const worked = !firstIn ? 'ABSENT' : !lastOut ? 'MISSED_PUNCH' : span >= policy.halfDayMinutes ? 'PRESENT' : 'ABSENT'
    first = part === 'FIRST' ? worked : 'HOLIDAY'
    second = part === 'SECOND' ? worked : plan.halfDay ? 'WEEKLY_OFF' : 'HOLIDAY'
  } else if (!firstIn) first = second = 'ABSENT'
  else if (!lastOut) first = second = 'MISSED_PUNCH'
  else if (span >= (policy.fullDayMinutes ?? shiftMinutes)) first = second = 'PRESENT'
  else if (span >= policy.halfDayMinutes) {
    const morning = covered(start, split) >= covered(split, end)
    first = morning ? 'PRESENT' : 'ABSENT'
    second = morning ? 'ABSENT' : 'PRESENT'
  } else first = second = 'ABSENT'
  const working = plan.kind === 'WORK'
  const notes: string[] = []
  const clock = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
  // very late in: the first half is absent; very early out (a whole day): the second half
  const inLate = working && firstIn ? minutes(firstIn.getTime() - start.getTime()) : 0
  // (the note also when the half was absent anyway - it says why; the simulation of 2026-11-22)
  if (policy.veryLateMinutes !== null && lastOut && inLate > policy.veryLateMinutes && first !== 'HOLIDAY' && first !== 'WEEKLY_OFF') {
    first = 'ABSENT'
    notes.push(`In ${clock(inLate)} late - first half absent`)
  }
  const outEarly = working && lastOut && part !== 'FIRST' ? minutes(end.getTime() - lastOut.getTime()) : 0
  if (policy.veryEarlyMinutes !== null && outEarly > policy.veryEarlyMinutes && second !== 'HOLIDAY' && second !== 'WEEKLY_OFF') {
    second = 'ABSENT'
    notes.push(`Out ${clock(outEarly)} early - second half absent`)
  }
  return {
    date: day,
    shiftId: plan.shift?.id ?? null,
    auto: { first, second },
    notes,
    firstIn,
    lastOut,
    punchCount: sorted.length,
    workedMinutes: Math.min(worked, 32_000),
    // only with both punches: a single punch may be the way out (the simulation of 2026-11-22: "+230m" on a missed punch)
    lateMinutes: working && firstIn && lastOut ? minutes(firstIn.getTime() - start.getTime() - policy.graceMinutes * MINUTE_MS) : 0,
    earlyMinutes: working && lastOut ? minutes(end.getTime() - policy.graceMinutes * MINUTE_MS - lastOut.getTime()) : 0,
  }
}
type Computed = ReturnType<typeof computeDay>

// The day as kept: HR's correction of a half wins over approved leave / requests, which win over the punches and the
// rules; the day overall from the two halves
function finish(employeeId: number, c: Computed, correction: Correction | undefined, covers: DayCover[]): daysRepository.DayRow {
  const { auto, notes, ...rest } = c
  const cover = (half: Half) => covers.find((x) => x.half === half)?.status
  const firstHalf = correction?.firstHalf ?? cover('FIRST') ?? auto.first
  const secondHalf = correction?.secondHalf ?? cover('SECOND') ?? auto.second
  return { employeeId, ...rest, status: dayStatusOf(firstHalf, secondHalf), firstHalf, secondHalf, autoStatus: dayStatusOf(auto.first, auto.second), note: notes.length ? notes.join('; ') : null }
}

// The late penalty: every Nth late day of an attendance month (late after the grace, its first half present) loses its
// first half - counted in date order, each day by its own policy's N
// (a day whose first half is covered by leave or a request is not counted late - 2026-11-22)
function applyLatePenalty(days: { date: Date; plan: Plan; computed: Computed; covers: DayCover[] }[], startDay: number) {
  const counts = new Map<string, number>()
  for (const { date, plan, computed, covers } of days) {
    if (computed.lateMinutes <= 0 || computed.auto.first !== 'PRESENT' || covers.some((c) => c.half === 'FIRST')) continue
    const cycle = cycleOf(date, startDay)
    const month = monthKey(cycle.year, cycle.month)
    const n = (counts.get(month) ?? 0) + 1
    counts.set(month, n)
    const every = plan.policy.latesPerHalfDayCut
    if (every && n % every === 0) {
      computed.auto.first = 'ABSENT'
      computed.notes.push(`${ordinal(n)} late this month - first half absent`)
    }
  }
}
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`

// Works out again the days from..to (up to today) of these employees and keeps the results - whole attendance months,
// as the late penalty counts the month's lates in order (a day changed early in a month can move the later ones). The
// days of a locked month are left as they are.
export async function recompute(employeeIds: number[], fromDay: Date, toDay: Date) {
  const now = today()
  const state = await loadLockState()
  const firstCycle = cycleOf(fromDay, state.startDay)
  const lastCycle = cycleOf(toDay, state.startDay)
  const from = cycleRange(firstCycle.year, firstCycle.month, state.startDay).from
  const monthEnd = cycleRange(lastCycle.year, lastCycle.month, state.startDay).to
  const last = monthEnd < now ? monthEnd : now
  if (!employeeIds.length || from > last) return
  // a batch at a time, each in one transaction that first holds its employees' days: a second recompute of the same
  // employee (the nightly close and HR's correction, two uploads) waits and then reads what the first saved - before
  // (2026-11-23) both read, then both wrote: one failed on the duplicate days, or older results replaced newer ones
  for (let i = 0; i < employeeIds.length; i += RECOMPUTE_BATCH) {
    await prisma.$transaction((tx) => recomputeBatch(tx, employeeIds.slice(i, i + RECOMPUTE_BATCH), from, last, now, state), { timeout: 120_000 })
  }
}

const RECOMPUTE_BATCH = 100

// Works out again the attendance months of these dates (up to today) for the employees whose days of that month are
// already worked out (`employeeIds`: only among them) - when a holiday or someone's holiday list changes (2026-11-24).
// Months never worked out (before attendance started) stay so - a past holiday never fills them with absent days.
export async function reworkWorkedOut(dates: Date[], employeeIds?: number[]) {
  const now = today()
  const state = await loadLockState()
  const months = new Map<string, { from: Date; to: Date }>()
  for (const date of dates.filter((d) => d <= now)) {
    const cycle = cycleOf(date, state.startDay)
    months.set(monthKey(cycle.year, cycle.month), cycleRange(cycle.year, cycle.month, state.startDay))
  }
  for (const { from, to } of months.values()) {
    if (employeeIds && !employeeIds.length) return
    const ids = await daysRepository.listEmployeeIdsWithDays(from, to, employeeIds)
    await recompute(ids, from, to)
  }
}

// After someone's holiday list changed from a date: the holidays' dates since then are worked out again for them
export async function reworkHolidayDates(employeeIds: number[], from: Date) {
  if (!employeeIds.length || from > today()) return
  const holidays = await daysRepository.listHolidays(from, today())
  await reworkWorkedOut(
    holidays.map((h) => h.date),
    employeeIds,
  )
}

async function recomputeBatch(tx: DbClient, batch: number[], from: Date, last: Date, now: Date, state: LockState) {
  {
    await daysRepository.lockEmployees(batch, tx)
    const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: batch, from, to: last })
    if (!people.length) return
    const ids = people.map((p) => p.id)
    const plans = await loadPlans(people, addDays(from, -1), addDays(last, 1))
    const [punches, corrections, covers] = await Promise.all([
      daysRepository.listPunches(ids, new Date(from.getTime() - 2 * DAY_MS), new Date(last.getTime() + 3 * DAY_MS)),
      daysRepository.listCorrections(ids, from, last),
      loadCovers(ids, from, last),
    ])
    for (const person of people) {
      const start = person.dateOfJoining > from ? person.dateOfJoining : from
      const end = person.dateOfLeaving && person.dateOfLeaving < last ? person.dateOfLeaving : last
      const rows: daysRepository.DayRow[] = []
      if (start <= end) {
        const plan = plans.get(person.id)!
        const own = punches.filter((p) => p.employeeId === person.id).map((p) => p.punchedAt)
        const byDay = punchesByDay(own, eachDay(addDays(start, -1), addDays(end, 1)), plan, person.timezone)
        const correctionOf = new Map(corrections.filter((c) => c.employeeId === person.id).map((c) => [dayKey(c.date), { firstHalf: c.firstHalf, secondHalf: c.secondHalf }]))
        const computed: { date: Date; plan: Plan; computed: Computed; covers: DayCover[] }[] = []
        for (const day of eachDay(start, end)) {
          const key = dayKey(day)
          const dayPlan = plan.get(key)!
          const dayPunches = byDay.get(key) ?? []
          const dayCovers = workingCovers(dayPlan, covers.get(`${person.id}:${key}`))
          // today: only once someone has punched (or it is not a working day, or HR set it, or leave / a request covers it)
          if (day.getTime() === now.getTime() && !dayPunches.length && dayPlan.kind === 'WORK' && !correctionOf.has(key) && !dayCovers.length) continue
          computed.push({ date: day, plan: dayPlan, computed: computeDay(day, dayPlan, dayPunches, person.timezone), covers: dayCovers })
        }
        applyLatePenalty(computed, state.startDay)
        for (const c of computed) if (!isLockedDay(c.date, state)) rows.push(finish(person.id, c.computed, correctionOf.get(dayKey(c.date)), c.covers))
      }
      // only the open months' days are replaced
      for (const range of openRanges(from, last, state)) {
        await daysRepository.replaceDays(person.id, range.from, range.to, rows.filter((r) => r.date >= range.from && r.date <= range.to), tx)
      }
    }
  }
}

// The parts of from..to outside locked months
function openRanges(from: Date, to: Date, state: LockState) {
  const ranges: { from: Date; to: Date }[] = []
  let day = from
  while (day <= to) {
    const cycle = cycleOf(day, state.startDay)
    const end = cycleRange(cycle.year, cycle.month, state.startDay).to
    const until = end < to ? end : to
    if (!state.locked.has(monthKey(cycle.year, cycle.month))) {
      const previous = ranges.at(-1)
      if (previous && addDays(previous.to, 1).getTime() === day.getTime()) previous.to = until
      else ranges.push({ from: day, to: until })
    }
    day = addDays(until, 1)
  }
  return ranges
}

// The worker, every night: everyone's yesterday (an absent day is written once the day is over)
export async function closeDay(day: Date) {
  const people = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, from: day, to: day })
  await recompute(
    people.map((p) => p.id),
    day,
    day,
  )
  return `${people.length} employees' ${dayKey(day)} worked out`
}

// --- reading ---

const STATUS_CODE: Record<DayStatus, string> = { PRESENT: 'P', HALF_DAY: 'HD', ABSENT: 'A', WEEKLY_OFF: 'WO', HOLIDAY: 'H', MISSED_PUNCH: 'MP', LEAVE: 'L', ON_DUTY: 'OD' }

// An attendance month's days (26th to 25th with RML's start day) and whether it is locked
async function monthRange(year: number, month: number) {
  const state = await loadLockState()
  return { ...cycleRange(year, month, state.startDay), locked: state.locked.has(monthKey(year, month)) }
}

type DayResult = Awaited<ReturnType<typeof daysRepository.listDays>>[number]

// One day for the API: the result if worked out, else what is planned (a future day, today before the first punch)
function dayView(
  day: Date,
  person: Person,
  plan: Plan | undefined,
  row: DayResult | undefined,
  correction: { firstHalf: DayStatus | null; secondHalf: DayStatus | null; reason: string; updatedAt: Date; updatedById: number } | undefined,
  dayCovers?: DayCover[],
) {
  const employed = day >= person.dateOfJoining && (!person.dateOfLeaving || day <= person.dateOfLeaving)
  const shift = row?.shift ?? (plan?.shift ? { id: plan.shift.id, code: plan.shift.code, name: plan.shift.name } : null)
  return {
    date: day,
    employed,
    status: row?.status ?? null,
    // each half (2026-11-22)
    firstHalf: row?.firstHalf ?? null,
    secondHalf: row?.secondHalf ?? null,
    autoStatus: row?.autoStatus ?? null,
    // what the day is meant to be: a working day, a weekly off or a holiday (and whether the roster set it)
    planned: plan?.kind ?? null,
    holiday: plan?.holiday ?? null,
    rostered: plan?.rostered ?? false,
    // the schedule pattern the day comes from (2026-11-23)
    pattern: plan?.pattern ?? null,
    // only the first half is worked that day (e.g. Saturday)
    halfDay: plan?.halfDay ?? false,
    // the half that is a holiday on a half-day holiday (2026-11-24) - `holiday` names it
    holidayHalf: plan?.holidayHalf ?? null,
    // the rules the day is judged by, and why a rule made a half absent (2026-11-22)
    policy: plan ? { id: plan.policy.id, name: plan.policy.name, graceMinutes: plan.policy.graceMinutes } : null,
    note: row?.note ?? null,
    shift,
    inAt: row?.firstIn ? clockOf(row.firstIn, person.timezone) : null,
    outAt: row?.lastOut ? clockOf(row.lastOut, person.timezone) : null,
    punchCount: row?.punchCount ?? 0,
    workedMinutes: row?.workedMinutes ?? 0,
    lateMinutes: row?.lateMinutes ?? 0,
    earlyMinutes: row?.earlyMinutes ?? 0,
    correction: correction ? { firstHalf: correction.firstHalf, secondHalf: correction.secondHalf, reason: correction.reason, at: correction.updatedAt, byId: correction.updatedById } : null,
    // approved leave / regularization / on duty on its working halves (2026-11-22) - also for days to come
    covers: employed ? workingCovers(plan, dayCovers).map((c) => ({ half: c.half, status: c.status, code: c.code, label: c.label })) : [],
  }
}
type DayView = ReturnType<typeof dayView>

// The totals count in halves (2026-11-22): a Saturday present + off is 0.5 present and 0.5 weekly off
function totalsOf(days: DayView[]) {
  const halves = days.flatMap((d) => (d.firstHalf && d.secondHalf ? [d.firstHalf, d.secondHalf] : []))
  const count = (status: DayStatus) => halves.filter((h) => h === status).length / 2
  return {
    present: count('PRESENT'),
    // the days with one half present and the other absent
    halfDay: days.filter((d) => d.status === 'HALF_DAY').length,
    absent: count('ABSENT'),
    missedPunch: count('MISSED_PUNCH'),
    // in days, halves counting 0.5 (2026-11-22)
    leave: count('LEAVE'),
    onDuty: count('ON_DUTY'),
    weeklyOff: count('WEEKLY_OFF'),
    holiday: count('HOLIDAY'),
    late: days.filter((d) => d.lateMinutes > 0 && (d.status === 'PRESENT' || d.status === 'HALF_DAY')).length,
    workedMinutes: days.reduce((t, d) => t + d.workedMinutes, 0),
  }
}

// One employee's month: every day (worked out, or planned), the totals and who corrected which day
async function monthOf(person: Person, year: number, month: number) {
  const { from, to, locked } = await monthRange(year, month)
  const [rows, corrections, plans, covers] = await Promise.all([
    daysRepository.listDays([person.id], from, to),
    daysRepository.listCorrections([person.id], from, to),
    loadPlans([person], from, to),
    loadCovers([person.id], from, to),
  ])
  const rowOf = new Map(rows.map((r) => [dayKey(r.date), r]))
  const correctionOf = new Map(corrections.map((c) => [dayKey(c.date), c]))
  const days = eachDay(from, to).map((day) =>
    dayView(day, person, plans.get(person.id)?.get(dayKey(day)), rowOf.get(dayKey(day)), correctionOf.get(dayKey(day)), covers.get(`${person.id}:${dayKey(day)}`)),
  )
  const people = await employeesService.lookupPeople(days.map((d) => d.correction?.byId))
  return {
    employee: { employeeCode: person.employeeCode, name: person.name, department: person.department?.name ?? null, designation: person.designation?.name ?? null, company: person.company.code },
    year,
    month,
    // the attendance month's first and last day, and whether it is locked (2026-11-22)
    from,
    to,
    locked,
    days: days.map(({ correction, ...d }) => ({ ...d, correction: correction && { firstHalf: correction.firstHalf, secondHalf: correction.secondHalf, reason: correction.reason, at: correction.at, by: people(correction.byId) } })),
    totals: totalsOf(days.filter((d) => d.employed)),
  }
}

// One employee's day (the home page's "today")
export async function getDayOf(person: Person, date: Date) {
  const [rows, corrections, plans, covers] = await Promise.all([
    daysRepository.listDays([person.id], date, date),
    daysRepository.listCorrections([person.id], date, date),
    loadPlans([person], date, date),
    loadCovers([person.id], date, date),
  ])
  const { correction, ...view } = dayView(date, person, plans.get(person.id)?.get(dayKey(date)), rows[0], corrections[0], covers.get(`${person.id}:${dayKey(date)}`))
  return { ...view, corrected: !!correction }
}

export async function getMyMonth(viewer: CurrentUser, { year, month }: { year: number; month: number }) {
  return monthOf(await getVisiblePerson(viewer, viewer.employeeCode), year, month)
}

// `canCorrect`: the viewer's Attendance Edit covers the employee (the day correction - 2026-11-23, the review: the button
// showed for anyone with Attendance Edit somewhere, and saving failed)
export async function getEmployeeMonth(viewer: CurrentUser, { employeeCode, year, month }: z.infer<typeof employeeMonthInput>) {
  const person = await getVisiblePerson(viewer, employeeCode)
  return { ...(await monthOf(person, year, month)), canCorrect: hasLevelAt(viewer, 'ATTENDANCE', placementOf(person), 'WRITE') }
}

// The day's board: everyone in the scope on that date - in / late / not in yet / absent / off - with the counts
export async function getBoard(viewer: CurrentUser, { date, ...filter }: z.infer<typeof boardInput>) {
  const people = await peopleInScope(viewer, filter, date, date)
  const ids = people.map((p) => p.id)
  const [rows, corrections, plans, covers] = await Promise.all([
    daysRepository.listDays(ids, date, date),
    daysRepository.listCorrections(ids, date, date),
    loadPlans(people, date, date),
    loadCovers(ids, date, date),
  ])
  const isToday = date.getTime() === today().getTime()
  const items = people.map((person) => {
    const view = dayView(
      date,
      person,
      plans.get(person.id)?.get(dayKey(date)),
      rows.find((r) => r.employeeId === person.id),
      corrections.find((c) => c.employeeId === person.id),
      covers.get(`${person.id}:${dayKey(date)}`),
    )
    // today (or a day to come - 2026-11-23: shown as absent before), a working day with no punch yet is "not in yet" -
    // unless leave / on duty covers it (2026-11-22)
    const covered = view.covers.find((c) => c.status !== 'PRESENT')?.status
    const state = view.status ?? (view.planned === 'WORK' ? (covered ?? (date >= today() ? 'NOT_IN' : 'ABSENT')) : view.planned === 'HOLIDAY' ? 'HOLIDAY' : 'WEEKLY_OFF')
    return {
      employeeCode: person.employeeCode,
      name: person.name,
      company: person.company.code,
      department: person.department?.name ?? null,
      designation: person.designation?.name ?? null,
      state,
      ...view,
      correction: view.correction ? { firstHalf: view.correction.firstHalf, secondHalf: view.correction.secondHalf, reason: view.correction.reason } : null,
    }
  })
  const count = (fn: (i: (typeof items)[number]) => boolean) => items.filter(fn).length
  return {
    date,
    isToday,
    items,
    summary: {
      total: items.length,
      in: count((i) => i.punchCount > 0 && i.planned === 'WORK'),
      late: count((i) => i.lateMinutes > 0),
      notIn: count((i) => i.state === 'NOT_IN'),
      absent: count((i) => i.state === 'ABSENT'),
      off: count((i) => i.state === 'WEEKLY_OFF' || i.state === 'HOLIDAY'),
      // on leave / on duty for a half or the whole day (2026-11-22)
      leave: count((i) => i.firstHalf === 'LEAVE' || i.secondHalf === 'LEAVE' || (!i.status && i.covers.some((c) => c.status === 'LEAVE'))),
      onDuty: count((i) => i.firstHalf === 'ON_DUTY' || i.secondHalf === 'ON_DUTY' || (!i.status && i.covers.some((c) => c.status === 'ON_DUTY'))),
    },
  }
}

// The monthly muster: every employee in the scope x every day of the month (a code per day), with the totals
export async function getMuster(viewer: CurrentUser, { year, month, ...filter }: z.infer<typeof musterInput>) {
  const { from, to, locked } = await monthRange(year, month)
  const people = await peopleInScope(viewer, filter, from, to)
  const ids = people.map((p) => p.id)
  const [rows, corrections, plans, covers] = await Promise.all([
    daysRepository.listDays(ids, from, to),
    daysRepository.listCorrections(ids, from, to),
    loadPlans(people, from, to),
    loadCovers(ids, from, to),
  ])
  const rowOf = new Map(rows.map((r) => [`${r.employeeId}:${dayKey(r.date)}`, r]))
  const correctionOf = new Map(corrections.map((c) => [`${c.employeeId}:${dayKey(c.date)}`, c]))
  const days = eachDay(from, to)
  return {
    year,
    month,
    from,
    to,
    locked,
    days,
    rows: people.map((person) => {
      const views = days.map((day) => {
        const key = `${person.id}:${dayKey(day)}`
        return dayView(day, person, plans.get(person.id)?.get(dayKey(day)), rowOf.get(key), correctionOf.get(key), covers.get(key))
      })
      return {
        employeeCode: person.employeeCode,
        name: person.name,
        company: person.company.code,
        department: person.department?.name ?? null,
        // one code per day: P, A, MP, WO, H, OD, a leave type's code (CL) - or the two halves when they differ ("P/WO" a
        // Saturday, "P/A" a half day, "CL/P"); '' = not worked out yet / not employed (a day to come on leave / duty shows
        // it). `first` / `second`: each half's code
        cells: views.map((v) => {
          const shown = v.employed && v.firstHalf && v.secondHalf
          const codeOf = (status: DayStatus, half: Half) => (status === 'LEAVE' ? (v.covers.find((c) => c.half === half && c.status === 'LEAVE')?.code ?? 'L') : STATUS_CODE[status])
          const ahead = (half: Half) => v.covers.find((c) => c.half === half && c.status !== 'PRESENT')?.code ?? ''
          const first = shown ? codeOf(v.firstHalf!, 'FIRST') : ahead('FIRST')
          const second = shown ? codeOf(v.secondHalf!, 'SECOND') : ahead('SECOND')
          return { code: first === second ? first : `${first}/${second}`, first, second, late: v.lateMinutes > 0, corrected: !!v.correction }
        }),
        totals: totalsOf(views.filter((v) => v.employed)),
      }
    }),
  }
}

// The muster as an Excel file
export async function exportMuster(viewer: CurrentUser, input: z.infer<typeof musterInput>) {
  const muster = await getMuster(viewer, input)
  const dayColumns = muster.days.map((d, i) => ({ header: String(d.getUTCDate()), key: `d${i}`, width: 5 }))
  const bytes = await writeReport([
    {
      name: 'Muster',
      columns: [
        { header: 'Employee code', key: 'code', width: 14 },
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Company', key: 'company', width: 10 },
        { header: 'Department', key: 'department', width: 18 },
        ...dayColumns,
        { header: 'Present', key: 'present', width: 9 },
        { header: 'Half days (P/A)', key: 'halfDay', width: 13 },
        { header: 'Absent', key: 'absent', width: 8 },
        { header: 'Missed punch', key: 'missedPunch', width: 12 },
        { header: 'Leave', key: 'leave', width: 8 },
        { header: 'On duty', key: 'onDuty', width: 8 },
        { header: 'Weekly off', key: 'weeklyOff', width: 10 },
        { header: 'Holiday', key: 'holiday', width: 9 },
        { header: 'Late', key: 'late', width: 7 },
        { header: 'Hours worked', key: 'hours', width: 12 },
      ],
      rows: muster.rows.map((r) => ({
        code: r.employeeCode,
        name: r.name,
        company: r.company,
        department: r.department,
        ...Object.fromEntries(r.cells.map((c, i) => [`d${i}`, c.code + (c.late ? '*' : '')])),
        ...r.totals,
        hours: Math.round((r.totals.workedMinutes / 60) * 10) / 10,
      })),
    },
    {
      name: 'Codes',
      columns: [
        { header: 'Code', key: 'code', width: 8 },
        { header: 'Means', key: 'means', width: 50 },
      ],
      rows: [
        { code: 'P', means: 'Present' },
        { code: 'P/A', means: 'Two halves that differ: first half / second half (e.g. P/A a half day, P/WO a Saturday half day)' },
        { code: 'A', means: 'Absent' },
        { code: 'MP', means: 'Missed punch (only one punch)' },
        { code: 'WO', means: 'Weekly off' },
        { code: 'H', means: 'Holiday' },
        { code: 'OD', means: 'On duty (official work outside the office)' },
        { code: 'CL, SL, EL…', means: 'On leave - the leave type (L: a leave half whose type is not found)' },
        { code: '*', means: 'Late that day' },
      ],
    },
  ], { title: 'Attendance muster', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: 'Attendance for the selected month, people view and placement filters.', filters: [{ label: 'Period', value: `${muster.from.toISOString().slice(0, 10)} to ${muster.to.toISOString().slice(0, 10)}` }] })
  return new File([new Uint8Array(bytes)], `muster-${input.year}-${String(input.month).padStart(2, '0')}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// The punches of one day (the day's details)
export async function getDayPunches(viewer: CurrentUser, { employeeCode, date }: z.infer<typeof dayPunchesInput>) {
  const person = await getVisiblePerson(viewer, employeeCode)
  const plans = await loadPlans([person], addDays(date, -1), addDays(date, 1))
  const punches = await daysRepository.listPunches([person.id], new Date(date.getTime() - DAY_MS), new Date(date.getTime() + 2 * DAY_MS))
  const byDay = punchesByDay(
    punches.map((p) => p.punchedAt),
    [addDays(date, -1), date, addDays(date, 1)],
    plans.get(person.id)!,
    person.timezone,
  )
  const mine = new Set((byDay.get(dayKey(date)) ?? []).map((p) => p.getTime()))
  return punches.filter((p) => mine.has(p.punchedAt.getTime())).map((p) => ({ id: p.id, employeeCode: p.employeeCode, at: p.punchedAt, time: clockOf(p.punchedAt, person.timezone), timezone: person.timezone, device: p.device, source: p.source, uploadId: p.uploadId, uploadFile: p.upload?.fileName ?? null, storedAt: p.createdAt }))
}

// HR sets one half or both with a reason (an empty half keeps following the punches); the day is worked out again
export async function correctDay({ employeeCode, date, firstHalf, secondHalf, reason }: z.infer<typeof correctDayInput>, viewer: CurrentUser) {
  const actorId = viewer.employeeId
  if (firstHalf === undefined && secondHalf === undefined) throw new ORPCError('BAD_REQUEST', { message: 'Set the first half, the second half or both' })
  if (date > today()) throw new ORPCError('BAD_REQUEST', { message: 'A day can be corrected once it has come' })
  await assertOpenDays([date])
  const id = (await employeesService.mapCodesToIds([employeeCode])).get(employeeCode)
  if (!id) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const [anyDay] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [id], ...EVER })
  if (!anyDay) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  assertAttendanceEdit(viewer, anyDay)
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [id], from: date, to: date })
  if (!person) throw new ORPCError('BAD_REQUEST', { message: `${employeeCode} was not employed on that day` })
  const saved = await daysRepository.upsertCorrection({ employeeId: id, date, firstHalf, secondHalf, reason }, actorId)
  // both halves back to the punches: no correction is left
  if (saved.firstHalf === null && saved.secondHalf === null) await daysRepository.deleteCorrection(id, date)
  await recompute([id], date, date)
  return { corrected: true }
}

export async function removeCorrection({ employeeCode, date }: z.infer<typeof removeCorrectionInput>, viewer: CurrentUser) {
  const id = (await employeesService.mapCodesToIds([employeeCode])).get(employeeCode)
  if (!id) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  const [person] = await employeesService.listAttendancePeople({ scope: SYSTEM_SCOPE, ids: [id], ...EVER })
  if (!person) throw new ORPCError('NOT_FOUND', { message: `No employee found with code ${employeeCode}` })
  assertAttendanceEdit(viewer, person)
  await assertOpenDays([date])
  const removed = await daysRepository.deleteCorrection(id, date)
  if (!removed.count) throw new ORPCError('NOT_FOUND', { message: 'That day has no correction' })
  await recompute([id], date, date)
  return { removed: true }
}

export async function exportMonth(viewer: CurrentUser, input: z.infer<typeof exportMonthInput>) {
  const data = input.employeeCode ? await getEmployeeMonth(viewer, { ...input, employeeCode: input.employeeCode }) : await getMyMonth(viewer, input)
  return reportFile([reportSheet('Attendance days', data.days, [
    { header: 'Date', value: r => r.date, date: true }, { header: 'Status', value: r => r.status ?? (r.employed ? 'Scheduled' : 'Outside employment'), width: 22 },
    { header: 'First half', value: r => r.firstHalf }, { header: 'Second half', value: r => r.secondHalf },
    { header: 'Shift', value: r => r.shift?.code }, { header: 'Holiday', value: r => r.holiday, width: 25 },
    { header: 'First in', value: r => r.inAt }, { header: 'Last out', value: r => r.outAt },
    { header: 'Worked minutes', value: r => r.workedMinutes }, { header: 'Late minutes', value: r => r.lateMinutes },
    { header: 'Early-out minutes', value: r => r.earlyMinutes }, { header: 'Correction reason', value: r => r.correction?.reason, width: 40 },
  ])], { title: `Attendance · ${data.employee.name}`, preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: 'The visible employee and selected attendance cycle, using the same access and relationship checks as the month page.', filters: [{ label: 'Employee code', value: data.employee.employeeCode }, { label: 'Period', value: `${data.from.toISOString().slice(0, 10)} to ${data.to.toISOString().slice(0, 10)}` }, { label: 'Month locked', value: data.locked ? 'Yes' : 'No' }] }, `attendance-${data.employee.employeeCode}-${data.year}-${String(data.month).padStart(2, '0')}`)
}

export async function exportBoard(viewer: CurrentUser, input: z.infer<typeof boardInput>) {
  const data = await getBoard(viewer, input)
  return reportFile([reportSheet('Day board', data.items, [
    { header: 'Employee code', value: r => r.employeeCode, text: true }, { header: 'Employee', value: r => r.name, width: 30 },
    { header: 'Company', value: r => r.company }, { header: 'Department', value: r => r.department, width: 25 },
    { header: 'Status', value: r => r.state }, { header: 'Shift', value: r => r.shift?.code },
    { header: 'First in', value: r => r.inAt }, { header: 'Last out', value: r => r.outAt },
    { header: 'Worked minutes', value: r => r.workedMinutes }, { header: 'Late minutes', value: r => r.lateMinutes },
    { header: 'Correction reason', value: r => r.correction?.reason, width: 40 },
  ])], { title: 'Attendance day board', preparedBy: `${viewer.name} (${viewer.employeeCode})`, coverage: 'The selected date and people filters, inside the same attendance scope as the board.', filters: [{ label: 'Date', value: input.date.toISOString().slice(0, 10) }, { label: 'View', value: input.scope }, { label: 'Search', value: input.search ?? 'None' }] }, `attendance-board-${input.date.toISOString().slice(0, 10)}`)
}
