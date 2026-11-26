// Calendar-date helpers. Calendar dates (@db.Date columns) are handled as Date objects at UTC midnight,
// so a date never shifts by a day because of the time zone.

// India's calendar day (UTC+05:30, no daylight saving) - the group works in India (2026-11-23, the review: "today" was the
// server's own clock, so on a UTC server every date rule was a day behind from 00:00 to 05:30 IST)
export const IST_OFFSET_MS = 330 * 60_000

// Today's calendar date in India as a UTC-midnight Date, comparable with @db.Date values - whatever the server's time zone.
export function today(now: Date = new Date()): Date {
  const india = new Date(now.getTime() + IST_OFFSET_MS)
  return new Date(Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()))
}

// The moment a calendar day (a UTC-midnight Date) starts in India - to compare a moment (createdAt, decidedAt) with a
// chosen day: 27 Nov starts at 26 Nov 18:30 UTC. Calendar dates (@db.Date) are compared as they are, never with this.
export function indiaDayStart(day: Date): Date {
  return new Date(day.getTime() - IST_OFFSET_MS)
}

// Full years from a birth date to a day (default today) - a person's age
export function yearsOld(birth: Date, on: Date = today()): number {
  let years = on.getUTCFullYear() - birth.getUTCFullYear()
  if (on.getUTCMonth() < birth.getUTCMonth() || (on.getUTCMonth() === birth.getUTCMonth() && on.getUTCDate() < birth.getUTCDate())) years--
  return years
}

// "2026-11-11" - for messages.
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
