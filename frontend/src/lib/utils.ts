import { ORPCError } from '@orpc/client'

export { cn } from 'cn'

// ---- Calendar dates -------------------------------------------------------------------------------------------
// The backend keeps calendar dates (joining date, date of birth...) as Dates at UTC midnight. An
// <input type="date"> works with "YYYY-MM-DD"; converting through UTC means the day never shifts in India time.

export function toDateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : ''
}

export function fromDateInput(value: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00Z`) : undefined
}

// "11 Nov 2026"
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
}

// "11 Nov 2026, 4:35 pm" in the browser's time zone (for moments, not calendar dates)
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ---- Moments in India time (HOD appointments start and end at a moment, India time for every plant - 2026-11-19) ----

const IST = 'Asia/Kolkata'
const clockAt = (date: Date) => date.toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayAt = (date: Date, short?: boolean) =>
  date.toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', ...(short ? {} : { year: 'numeric' }) })

// A start: "20 Nov 2026" at midnight (a day), else "20 Nov 2026, 15:05"; `short`
// without the year
export function formatMoment(date: Date | null | undefined, short?: boolean): string {
  if (!date) return '—'
  const clock = clockAt(date)
  return clock === '00:00' ? dayAt(date, short) : `${dayAt(date, short)}, ${clock}`
}

// An end (the moment it stops - not included) as the last day it covers: midnight -> the day before ("19 Nov 2026"), else
// the moment ("20 Nov 2026, 15:05")
export function formatLastDay(date: Date | null | undefined, short?: boolean): string {
  if (!date) return '—'
  return clockAt(date) === '00:00' ? dayAt(new Date(date.getTime() - 1), short) : formatMoment(date, short)
}

// A time and who did it: "12 Nov 2026, 3:10 pm · Priya Sharma" (the backend sends the person as { employeeCode, name };
// "System" for scripts and automatic jobs). "—" when it has not happened.
export function formatDoneBy(date: Date | null | undefined, person: { name: string } | null | undefined): string {
  if (!date) return '—'
  return person ? `${formatDateTime(date)} · ${person.name}` : formatDateTime(date)
}

// "₹6,00,000" / "USD 85,000"
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`
  }
}

// ---- People ---------------------------------------------------------------------------------------------------

// Initials of a name, for the round avatar of a person (used by several pages): "Priya Sharma" -> "PS"
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

// ---- API errors -----------------------------------------------------------------------------------------------

// A message to show the user. Validation errors list every bad field ("bankAccount.ifsc: An IFSC looks like...").
export function errorMessage(error: unknown): string {
  if (error instanceof ORPCError) {
    const issues = (error.data as { issues?: { path: string; message: string }[] } | undefined)?.issues
    if (issues?.length) return issues.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message)).join(' · ')
    return error.message
  }
  if (error instanceof TypeError) return 'Cannot reach the server. Check your connection and try again.'
  return 'Something went wrong. Please try again.'
}

// Opens a file the API returns (e.g. a PDF letter) in a new tab; a failure goes to `onError` as a message
export async function openPdf(load: () => Promise<Blob>, onError: (message: string) => void) {
  try {
    const blob = await load()
    window.open(URL.createObjectURL(blob), '_blank', 'noopener')
  } catch (error) {
    onError(errorMessage(error))
  }
}

// Saves a file the API returns (e.g. an Excel export) to the computer, under the name the API gave it; a failure goes
// to `onError` as a message
export async function downloadFile(load: () => Promise<Blob>, onError: (message: string) => void) {
  try {
    const blob = await load()
    const url = URL.createObjectURL(blob)
    const link = Object.assign(document.createElement('a'), { href: url, download: blob instanceof File ? blob.name : 'download' })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (error) {
    onError(errorMessage(error))
  }
}

// A file the API returned (e.g. an image) as a data: URL for <img src>. Unlike an object URL there is nothing to
// release afterwards.
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ORPCError && error.code === 'UNAUTHORIZED'
}

// "in 5 months", "2 months ago", "today" - from a day (the job dates timeline, the Pay & career list). A calendar day
// (stored as midnight UTC) against today's date where the viewer is - not against the moment, which made today's date
// "1 day ago" in the evening (fixed 2026-11-21)
export function relativeDay(at: number, now: number) {
  const day = new Date(at)
  const today = new Date(now)
  const days = Math.round((Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000)
  if (days === 0) return 'today'
  const abs = Math.abs(days)
  const months = Math.round(abs / 30.44)
  const span =
    abs < 31
      ? `${abs} ${abs === 1 ? 'day' : 'days'}`
      : months < 12
        ? `${months} ${months === 1 ? 'month' : 'months'}`
        : `${Math.floor(months / 12)} yr${months % 12 ? ` ${months % 12} mo` : ''}`
  return days > 0 ? `in ${span}` : `${span} ago`
}
