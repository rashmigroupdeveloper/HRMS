// The home widgets' fixed texts and small date helpers (2026-11-27) - shared with their skeletons in
// components/skeletons/home/, so the loading state shows the same titles and labels as the loaded widget.

export const MY_DAY_TILES = ['First in', 'Last out', 'Worked'] as const
export const MY_DAY_NOTE = 'Punches arrive with each machine upload.'
export const TO_FIX_TITLE = 'Needs your attention'

export const HOLIDAYS_TITLE = 'Coming holidays'
// People today's split bar and its legend, in this order
export const PEOPLE_LEGEND = ['in', 'on leave', 'not in yet'] as const
// the attendance month's strip under the greeting, in this order (the skeleton draws the same parts)
export const MONTH_STRIP = ['Present', 'Leave', 'Absent or missed', 'Off days', 'Still to come'] as const

export const AWAY_TITLE = 'Away this week'
export const AWAY_LEGEND = [
  { label: 'Approved', swatch: 'bg-hero' },
  { label: 'Waiting for approval', swatch: 'border border-dashed border-foreground/45 bg-surface-2' },
] as const

export const MONTH_CLOSE_TITLE = 'Attendance month'
export const MONTH_CLOSE_COUNTS = ['Missed punches', 'Shift changes', 'Unmatched codes'] as const

export const PAYROLL_TITLE = 'Payroll runs'
export const MOVEMENTS_TITLE = 'Joiners & leavers'
export const MOVEMENT_TILES = ['Joined this month', 'Left this month'] as const
export const MOVEMENTS_NOTE = 'Leaving dates as recorded on the employee record - not a confirmed exit.'

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const DAY_MS = 86_400_000
export const addDays = (day: Date, days: number) => new Date(day.getTime() + days * DAY_MS)
// Monday to Sunday of the week a calendar day (UTC midnight) is in
export function weekOf(day: Date) {
  const monday = addDays(day, -((day.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
// whole days from one calendar day to another
export const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS)
// "today", "tomorrow", "in 12 days"
export function inDays(days: number) {
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
}
// "Wed, 9 Dec" (a calendar day kept at UTC midnight)
export const shortDay = (day: Date) => day.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
// "3h 10m", "40m"
export function span(minutes: number) {
  const m = Math.max(0, Math.round(minutes))
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}
// "09:04" as minutes from midnight
export function minutesOf(clock: string) {
  const [h, m] = clock.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
