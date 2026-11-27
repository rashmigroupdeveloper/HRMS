import { CalendarClock, CalendarHeart, Clock3, Fingerprint, Lock, Repeat, Scale, UsersRound, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/components/Pill'
import type { client } from '@/lib/orpc'
import { cn } from '@/lib/utils'

// Types and words of the attendance pages (typed from the API).

export type Overview = Awaited<ReturnType<typeof client.attendance.overview>>
export type Month = Awaited<ReturnType<typeof client.attendance.days.myMonth>>
export type MonthDay = Month['days'][number]
export type DayStatus = NonNullable<MonthDay['status']>
export type Shift = Awaited<ReturnType<typeof client.attendance.shifts.list>>[number]
export type Board = Awaited<ReturnType<typeof client.attendance.days.board>>
export type BoardState = Board['items'][number]['state']
export type ShiftChange = Awaited<ReturnType<typeof client.attendance.shiftChanges.mine>>[number]
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export const STATUS: Record<DayStatus, { label: string; short: string; tone: Tone; cell: string }> = {
  PRESENT: { label: 'Present', short: 'P', tone: 'positive', cell: 'bg-positive/15 text-positive-ink' },
  HALF_DAY: { label: 'Half day', short: 'HD', tone: 'warning', cell: 'bg-warning/20 text-warning-ink' },
  ABSENT: { label: 'Absent', short: 'A', tone: 'negative', cell: 'bg-destructive/12 text-negative-ink' },
  MISSED_PUNCH: { label: 'Missed punch', short: 'MP', tone: 'warning', cell: 'bg-warning/30 text-warning-ink' },
  WEEKLY_OFF: { label: 'Weekly off', short: 'WO', tone: 'neutral', cell: 'bg-surface-2 text-muted-foreground' },
  HOLIDAY: { label: 'Holiday', short: 'H', tone: 'info', cell: 'bg-info/15 text-info-ink' },
  // approved leave / on duty (2026-11-22) - a leave half shows its type's code (CL) where there is room
  LEAVE: { label: 'On leave', short: 'L', tone: 'gold', cell: 'bg-gold-soft text-foreground' },
  ON_DUTY: { label: 'On duty', short: 'OD', tone: 'positive', cell: 'bg-positive/10 text-positive-ink ring-1 ring-positive/30 ring-inset' },
}

// A half's colour as CSS - the same as its cell's background in STATUS (change both together). A day whose halves differ
// is drawn half and half, first half on the left (the user, 2026-11-23: present + absent = half green, half red;
// present + weekly off = half green, half the weekly-off colour)
const HALF_FILL: Record<DayStatus, string> = {
  PRESENT: 'color-mix(in oklab, var(--color-positive) 15%, transparent)',
  HALF_DAY: 'color-mix(in oklab, var(--color-warning) 20%, transparent)',
  ABSENT: 'color-mix(in oklab, var(--color-destructive) 12%, transparent)',
  MISSED_PUNCH: 'color-mix(in oklab, var(--color-warning) 30%, transparent)',
  WEEKLY_OFF: 'var(--color-surface-2)',
  HOLIDAY: 'color-mix(in oklab, var(--color-info) 15%, transparent)',
  LEAVE: 'var(--color-gold-soft)',
  ON_DUTY: 'color-mix(in oklab, var(--color-positive) 10%, transparent)',
}
export const splitFill = (first: DayStatus, second: DayStatus) => `linear-gradient(to right, ${HALF_FILL[first]} 50%, ${HALF_FILL[second]} 50%)`
// A muster code's status: P, A, WO... - any other code is a leave type's (CL, SL)
export const statusOfCode = (code: string) => (Object.keys(STATUS) as DayStatus[]).find((k) => STATUS[k].short === code) ?? 'LEAVE'

// A half's statuses HR may set (never "half day" - that is the day overall; never "leave" - only an approved application
// takes leave, from the balance - 2026-11-22)
export type HalfStatus = Exclude<DayStatus, 'HALF_DAY' | 'LEAVE'>
export const HALF_STATUSES: HalfStatus[] = ['PRESENT', 'ABSENT', 'MISSED_PUNCH', 'ON_DUTY', 'WEEKLY_OFF', 'HOLIDAY']

// "P | WO" - the two halves when they differ (a Saturday half day, a half day worked), else null
export function halvesText(first: DayStatus | null, second: DayStatus | null) {
  return first && second && first !== second ? `${STATUS[first].short} | ${STATUS[second].short}` : null
}

type Covered = Pick<MonthDay, 'status' | 'firstHalf' | 'secondHalf' | 'covers'>
// A half's short mark: its status, or for leave the type's code (CL); a day not worked out yet shows its approved leave /
// on duty (2026-11-22)
function halfMark(day: Covered, half: 'FIRST' | 'SECOND') {
  const status = half === 'FIRST' ? day.firstHalf : day.secondHalf
  const cover = day.covers.find((c) => c.half === half)
  if (!status) return cover && cover.status !== 'PRESENT' ? cover.code : null
  return status === 'LEAVE' ? (cover?.code ?? 'L') : STATUS[status].short
}
// The day's mark in a cell: one code, or the two halves ("CL | P")
export function dayMark(day: Covered) {
  const first = halfMark(day, 'FIRST')
  const second = halfMark(day, 'SECOND')
  if (!first && !second) return day.status ? STATUS[day.status].short : null
  return first === second || !second ? first : !first ? second : `${first} | ${second}`
}
// What covers a day besides the punches, in words: "Casual leave", "On duty - first half"
export function coversText(day: Pick<MonthDay, 'covers'>) {
  const byLabel = new Map<string, string[]>()
  for (const c of day.covers) byLabel.set(c.label, [...(byLabel.get(c.label) ?? []), c.half])
  return [...byLabel].map(([label, halves]) => (halves.length > 1 ? label : `${label} - ${halves[0] === 'FIRST' ? 'first' : 'second'} half`))
}

// The board's states: a day's status, or - today, before the first punch - "not in yet"
export const BOARD_STATE: Record<BoardState, { label: string; tone: Tone }> = {
  ...Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, { label: v.label, tone: v.tone }])),
  NOT_IN: { label: 'Not in yet', tone: 'neutral' },
} as Record<BoardState, { label: string; tone: Tone }>

export const WEEKDAYS: { key: Weekday; short: string }[] = [
  { key: 'MON', short: 'Mon' },
  { key: 'TUE', short: 'Tue' },
  { key: 'WED', short: 'Wed' },
  { key: 'THU', short: 'Thu' },
  { key: 'FRI', short: 'Fri' },
  { key: 'SAT', short: 'Sat' },
  { key: 'SUN', short: 'Sun' },
]

export type Regularization = Awaited<ReturnType<typeof client.attendance.regularizations.mine>>[number]

// (shift changes, regularizations and on duty have the same statuses)
export const REQUEST_STATUS: Record<ShiftChange['status'], { label: string; tone: Tone }> = {
  // who has it now is shown beside (the approval's open step)
  PENDING: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'positive' },
  REJECTED: { label: 'Rejected', tone: 'negative' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}

// A month's counts. MonthTotals leads with hours, then Present / Absent / Leave; these labels are the quiet line and the key.
export const TOTAL_LABELS = ['Present', 'Half days', 'Absent', 'Missed punch', 'Leave', 'On duty', 'Late', 'Hours worked']

// Shared with the month summary's skeleton.
export const MONTH_BARS = [
  { label: 'Present', bar: 'bg-gold' },
  { label: 'Absent', bar: 'bg-hero' },
  { label: 'Leave', bar: 'bg-foreground/15' },
] as const

// "Tuesday, November 2026" (the day panel and its loading placeholder)
export const dayName = (date: Date) =>
  `${date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long' })}, ${date.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' })}`

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// "8h 37m"
export function hours(minutes: number) {
  if (!minutes) return '—'
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

// the month muster's totals columns (PeopleView's Muster and its skeleton)
export const MUSTER_TOTALS = ['P', 'HD', 'A', 'MP', 'L', 'OD', 'Late']

export const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime()

// The first and last day of an attendance month (as the backend's cycleRange): with a start day of 26, "November" = 26 Oct
// - 25 Nov; 1 = the calendar month
export function cycleRange(year: number, month: number, startDay: number) {
  if (startDay <= 1) return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0)) }
  return { from: new Date(Date.UTC(year, month - 2, startDay)), to: new Date(Date.UTC(year, month - 1, startDay - 1)) }
}

// A second-level switch inside a tab (day board / month muster, a pattern's weeks in the setup's forms): a small grey segmented control whose
// open chip is cream - never dark, that is the page's own tab bar. One line; it scrolls sideways when it does not fit.
export const SEGMENTS = 'flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
export const segment = (active: boolean) =>
  cn('flex-none rounded-full px-3 py-2.5 text-xs leading-4 font-medium whitespace-nowrap sm:py-1.5', active ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')

// The setup's filters as soft pills - a search and dropdowns on a grey ground, no border (the redesign, 2026-11-25)
// The note of a day that counts present because the person's attendance is not tracked - the same text as the
// backend's NOT_TRACKED_NOTE (attendance days.service.ts): change both together. The month view shows it calmly, not in
// the amber box of a rule that cost a half day.
export const NOT_TRACKED_DAY_NOTE = 'Attendance not tracked - counted present'
// "Attendance not tracked" (2026-11-27): what the marker does - under both of its drawers
export const NOT_TRACKED_NOTE = 'They count present on their working days, whatever the punches say. Leave, on duty, weekly offs, holidays and HR\'s corrections stay as they are. Days already worked out are worked out again; a locked month is not changed.'
export const FILTER_SEARCH = 'h-9 rounded-full border-transparent bg-surface-2 pl-9 shadow-none focus-visible:bg-card'
export const FILTER_SELECT = '[&_select]:h-9 [&_select]:rounded-full [&_select]:border-transparent [&_select]:bg-surface-2 [&_select]:pl-3.5 [&_select]:hover:bg-surface-2/70'

// The attendance setup (its own area since 2026-11-22 - Attendance setup: View, changing it: Edit): shifts, attendance
// policies (2026-11-22), schedule patterns and who follows which (2026-11-23), holidays, the punch upload and the month lock.
// (also drawn by its skeleton)
export const SETUP_PARTS = [
  ['punches', 'Punches'],
  ['shifts', 'Shifts'],
  // weeks of shifts that repeat - one idea for everyone (the user, 2026-11-23)
  ['patterns', 'Schedule patterns'],
  ['policies', 'Policies'],
  // who follows which pattern from a date
  ['assign', 'Schedules'],
  // one-off changes from the pattern (moved here from Team attendance - the user, 2026-11-22)
  ['roster', 'Roster changes'],
  ['holidays', 'Holidays'],
  ['lock', 'Month lock'],
] as const

// Each part's icon on its tab (the setup's redesign, 2026-11-25 - also drawn by the setup's skeleton)
export const SETUP_ICONS: Record<(typeof SETUP_PARTS)[number][0], LucideIcon> = {
  punches: Fingerprint,
  shifts: Clock3,
  patterns: Repeat,
  policies: Scale,
  assign: UsersRound,
  roster: CalendarClock,
  holidays: CalendarHeart,
  lock: Lock,
}

// (also drawn by the setup's skeleton)
export const UPLOAD_TITLE = 'Upload punches'
export const UPLOAD_SUMMARY = 'Excel or CSV from the biometric machines'
export const UPLOAD_HINT =
  "The biometric machines' export - Excel or CSV - with an employee code column and the punch time (or a Date and a Time column). The same punch is kept once; the days are worked out at once."

export type TeamView = 'team' | 'department' | 'all'
export type TeamOverview = { teamSize: number; departmentSize: number; canSeeAll: boolean; canEdit: boolean }

// The views of the Team attendance page the viewer has (2026-11-22): their reporting tree, the employees whose HOD they are
// (view only), everyone (Attendance: View). (The roster moved to the attendance setup - 2026-11-22.)
export function teamViews(o: TeamOverview): [TeamView, string][] {
  return [
    ...(o.teamSize > 0 ? [['team', `My team · ${o.teamSize}`] as [TeamView, string]] : []),
    ...(o.departmentSize > 0 ? [['department', `My department · ${o.departmentSize}`] as [TeamView, string]] : []),
    ...(o.canSeeAll ? [['all', 'Everyone'] as [TeamView, string]] : []),
  ]
}

// The roster's line under its toolbar (also drawn by its skeleton)
export const ROSTER_SUMMARY = 'One-off days that differ from the schedule pattern'
export const ROSTER_HINT = "Every day follows each person's schedule pattern (Schedules). Only one-off changes from it are listed here."

// The comp-off a weekly off / holiday's work earns (2026-11-22): 8 hours = a day, 4 hours = half a day, less = none
// (change both with the backend's comp-off.service)
export const compOffDays = (minutes: number) => (minutes >= 480 ? 1 : minutes >= 240 ? 0.5 : 0)

// --- holiday categories (2026-11-24) ---
type HolidayTone = Awaited<ReturnType<typeof client.attendance.holidayCategories.list>>[number]['tone']

// The colours a category may have - the app's pill tones, with a name HR understands
export const HOLIDAY_TONES: { value: HolidayTone; tone: Tone; label: string }[] = [
  { value: 'NEUTRAL', tone: 'neutral', label: 'Grey' },
  { value: 'INFO', tone: 'info', label: 'Blue' },
  { value: 'GOLD', tone: 'gold', label: 'Gold' },
  { value: 'POSITIVE', tone: 'positive', label: 'Green' },
  { value: 'WARNING', tone: 'warning', label: 'Amber' },
  { value: 'NEGATIVE', tone: 'negative', label: 'Red' },
]
export const toneOf = (value: HolidayTone): Tone => HOLIDAY_TONES.find((t) => t.value === value)?.tone ?? 'neutral'

// The part of a holiday's day that is off (2026-11-24) - the holidays' setup, the calendars
export const HOLIDAY_PORTION: Record<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF', string> = { FULL_DAY: 'Whole day', FIRST_HALF: 'First half off', SECOND_HALF: 'Second half off' }

// The month lock's texts (also drawn by its skeleton)
export const LOCK_HINT =
  'A locked month does not change any more - its days are not worked out again, and punches, corrections, roster days and shift changes for it are refused. For payroll. One lock for every company.'
export const CYCLE_LABEL = 'Each attendance month starts on day'
export const CYCLE_HINT = '26: “November” is 26 Oct – 25 Nov; 1: the calendar month. The muster, the month views, the late count and the lock follow it.'
