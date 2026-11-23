// Wall-clock time in a time zone (attendance, 2026-11-16). Calendar days are Dates at UTC midnight (as in dates.ts);
// a shift's times are minutes from midnight in the employee's work-location time zone (e.g. Asia/Kolkata). Pure helpers
// - no I/O, no library: the zone's offset comes from Intl.

export const MINUTE_MS = 60_000
export const DAY_MS = 86_400_000

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    formatters.set(timeZone, f)
  }
  return f
}

// The wall-clock parts of an instant in a zone
function partsOf(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]))
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) }
}

// How far the zone is ahead of UTC at this instant, in ms (Asia/Kolkata: +5:30)
function offsetMs(instant: Date, timeZone: string) {
  const p = partsOf(instant, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000
}

// The instant when the clock in `timeZone` shows `minute` minutes after midnight of `day` (minute may pass 1440 - the
// next day, e.g. a night shift's end)
export function zonedInstant(day: Date, minute: number, timeZone: string): Date {
  const wall = day.getTime() + minute * MINUTE_MS
  const first = wall - offsetMs(new Date(wall), timeZone)
  return new Date(wall - offsetMs(new Date(first), timeZone))
}

// The calendar day (UTC midnight) of an instant in a zone
export function localDay(instant: Date, timeZone: string): Date {
  const p = partsOf(instant, timeZone)
  return new Date(Date.UTC(p.year, p.month - 1, p.day))
}

// A time written without a zone (an Excel cell, "16-11-2026 09:04") read as the clock in `timeZone`: the wall-clock
// fields are taken from the Date's UTC parts
export function wallClockToInstant(wall: Date, timeZone: string): Date {
  const day = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()))
  return zonedInstant(day, wall.getUTCHours() * 60 + wall.getUTCMinutes() + wall.getUTCSeconds() / 60, timeZone)
}

// "09:04" in a zone
export function clockOf(instant: Date, timeZone: string): string {
  const p = partsOf(instant, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

export const addDays = (day: Date, days: number) => new Date(day.getTime() + days * DAY_MS)

// Monday = 0 ... Sunday = 6 of a calendar day
export function weekdayIndex(day: Date): number {
  return (day.getUTCDay() + 6) % 7
}

// Every calendar day from `from` to `to`, both included
export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = []
  for (let d = from.getTime(); d <= to.getTime(); d += DAY_MS) days.push(new Date(d))
  return days
}

export const dayKey = (day: Date) => day.toISOString().slice(0, 10)

// "2026-11-20" when the moment is midnight on the zone's clock, else "2026-11-20 15:05" - for messages
export function formatMoment(instant: Date, timeZone: string): string {
  const p = partsOf(instant, timeZone)
  const day = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
  return p.hour === 0 && p.minute === 0 ? day : `${day} ${clockOf(instant, timeZone)}`
}

// --- A span of time from a moment until a moment: the start included, the end not, so the next span can start at the
// very moment one ends; no end = open (an HOD appointment - 2026-11-19) ---
export type SpanStatus = 'UPCOMING' | 'CURRENT' | 'PAST'
export function spanStatus(span: { startsAt: Date; endsAt: Date | null }, now: Date): SpanStatus {
  if (span.startsAt > now) return 'UPCOMING'
  return span.endsAt === null || span.endsAt > now ? 'CURRENT' : 'PAST'
}

