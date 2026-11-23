import { Skeleton } from '@/components/ui/skeleton'
import { cn, todayDay } from '@/lib/utils'
import { dayName, TOTAL_LABELS, MONTH_BARS, WEEKDAYS } from '@/pages/attendance/components/labels'
import { MonthLegend } from '@/pages/attendance/components/MonthCalendar'

// Loading placeholder for one employee's month (MonthTotals + MonthCalendar): the hours figure, the three segments
// (Present / Absent / Leave), the quiet counts, the weekdays, the month's days with their real numbers (today circled),
// the legend, and the day panel opened on today.
// Only what comes from the punches - the counts, each day's mark and times, the day's status and shift - are bars.
// Without a `label` (inside another skeleton) it is not a status of its own. `actions`: the day panel's buttons, disabled.
// `range`: the attendance month's first and last day (RML: 26 Oct - 25 Nov - 2026-11-22), as the real calendar draws it;
// without it the calendar month of year / month.
export function MonthSkeleton({ year, month, range, label, actions }: { year?: number; month?: number; range?: { from: Date; to: Date }; label?: string; actions?: React.ReactNode }) {
  const today = todayDay()
  const y = year ?? today.getUTCFullYear()
  const m = month ?? today.getUTCMonth() + 1
  const first = range?.from ?? new Date(Date.UTC(y, m - 1, 1))
  const last = range?.to ?? new Date(Date.UTC(y, m, 0))
  const days = Array.from({ length: Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1 }, (_, i) => new Date(first.getTime() + i * 86_400_000))
  // blank cells before the first day (the grid starts on Monday)
  const lead = (first.getUTCDay() + 6) % 7
  const thisMonth = today >= first && today <= last
  // the day panel opens on today in this month, else on its first day
  const open = thisMonth ? today : first
  return (
    <div role={label ? 'status' : undefined} aria-label={label} className="space-y-3">
      <div className="space-y-3">
        <div className="flex h-10 items-end gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <span className="text-sm text-muted-foreground">worked</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {MONTH_BARS.map((part) => (
            <div key={part.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{part.label}</span>
                <Skeleton className="h-3.5 w-6 rounded-full" />
              </div>
              <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {[1, 3, 5, 6].map((i) => (
            <div key={TOTAL_LABELS[i]} className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">{TOTAL_LABELS[i]}</dt>
              <dd><Skeleton className="h-3 w-4 rounded-full" /></dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="@container">
        <div className="grid gap-3 @4xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:items-start @4xl:gap-5">
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground sm:gap-1.5">
              {WEEKDAYS.map((w) => (
                <span key={w.key}>{w.short}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {days.map((date) => {
                const day = date.getUTCDate()
                const isToday = date.getTime() === today.getTime()
                const noResult = date > today
                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      'flex min-h-12 min-w-0 flex-col items-stretch overflow-hidden rounded-lg p-1 text-xs sm:min-h-16 sm:rounded-xl sm:px-2 sm:py-1.5',
                      isToday && 'ring-2 ring-foreground ring-inset',
                      noResult ? 'u-hatch bg-surface-2/60' : 'bg-surface-2/45',
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={cn(
                          'grid h-6 place-items-center text-sm font-medium text-muted-foreground tabular-nums',
                          isToday && 'w-6 rounded-full bg-gold font-semibold text-gold-foreground',
                        )}
                      >
                        {day}
                      </span>
                      {(day === 1 || date.getTime() === first.getTime()) && <span className="text-xs font-normal text-muted-foreground">{date.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short' })}</span>}
                    </span>
                    {/* the mark (under the number on a phone) and the times line */}
                    <Skeleton className="mt-1 h-2.5 w-6 rounded-full sm:hidden" />
                    <Skeleton className="mt-auto hidden h-3 w-3/4 rounded-full sm:block" />
                  </div>
                )
              })}
            </div>
            <MonthLegend />
          </div>
          <section aria-label="The day's details" className="space-y-4 rounded-3xl bg-hero p-4 text-hero-foreground shadow-card sm:p-5 @4xl:sticky @4xl:top-24">
            <div className="flex items-start gap-3">
              <div className="grid w-12 shrink-0 place-items-center rounded-2xl bg-hero-foreground/10 py-1">
                <span className="text-xl leading-7 font-light tabular-nums">{open.getUTCDate()}</span>
                <span className="text-xs text-hero-foreground/70">{open.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5.5 w-28 rounded-full bg-hero-foreground/10" />
                <p className="mt-1 truncate text-xs text-hero-foreground/70">{dayName(open)}</p>
              </div>
            </div>
            <div className="rounded-xl bg-hero-foreground/5 px-3 py-2.5">
              <p className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-32 rounded-full bg-hero-foreground/10" />
              </p>
              <p className="flex h-4 items-center">
                <Skeleton className="h-3 w-44 max-w-full rounded-full bg-hero-foreground/10" />
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {['First in', 'Last out', 'Worked', 'Late in', 'Early out', 'Punches'].map((name) => (
                <div key={name} className="min-w-0">
                  <dt className="truncate text-xs text-hero-foreground/70">{name}</dt>
                  <dd className="flex h-5 items-center">
                    <Skeleton className="h-3.5 w-10 rounded-full bg-hero-foreground/10" />
                  </dd>
                </div>
              ))}
            </dl>
            {actions}
          </section>
        </div>
      </div>
    </div>
  )
}

