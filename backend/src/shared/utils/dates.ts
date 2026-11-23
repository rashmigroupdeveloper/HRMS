// Calendar-date helpers. Calendar dates (@db.Date columns) are handled as Date objects at UTC midnight,
// so a date never shifts by a day because of the time zone.

// Today's calendar date (by the server's local clock) as a UTC-midnight Date, comparable with @db.Date values.
export function today(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
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
