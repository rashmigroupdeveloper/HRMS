import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { dayName, todayDay, TOTAL_LABELS, WEEKDAYS } from '@/pages/attendance/components/labels'
import { MonthLegend } from '@/pages/attendance/components/MonthCalendar'

// Loading placeholder for one employee's month (MonthTotals + MonthCalendar): the six totals with their labels, the
// weekdays, the month's days with their real numbers (today circled), the legend, and the day panel opened on today.
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
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {TOTAL_LABELS.map((tile) => (
          <div key={tile} className="rounded-xl bg-surface-2/60 px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{tile}</p>
            <p className="flex h-6 items-center">
              <Skeleton className="h-4 w-8 rounded-md" />
            </p>
          </div>
        ))}
      </div>
      <div className="@container">
        <div className="grid gap-3 @4xl:grid-cols-[minmax(0,1fr)_19rem] @4xl:items-start @4xl:gap-4">
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
                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      'flex min-h-12 min-w-0 flex-col items-stretch rounded-lg p-1 text-xs ring-1 ring-border/60 ring-inset sm:min-h-16 sm:rounded-xl sm:px-2 sm:py-1.5',
                      isToday && 'outline-2 -outline-offset-2 outline-hero',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-6 place-items-center self-start text-sm font-medium text-muted-foreground tabular-nums',
                        isToday && '-ml-0.5 w-6 rounded-full bg-hero font-semibold text-hero-foreground',
                      )}
                    >
                      {day}
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
          <section aria-label="The day's details" className="space-y-3 rounded-2xl bg-surface-2/60 p-3 @4xl:sticky @4xl:top-24">
            <div className="flex items-start gap-3">
              <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-card py-1 shadow-card">
                <span className="text-xl leading-7 font-light tabular-nums">{open.getUTCDate()}</span>
                <span className="text-xs text-muted-foreground">{open.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5.5 w-28 rounded-full" />
                <p className="mt-1 truncate text-xs text-muted-foreground">{dayName(open)}</p>
              </div>
            </div>
            <div className="rounded-xl bg-card px-3 py-2 shadow-card">
              <p className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-32 rounded-full" />
              </p>
              <p className="flex h-4 items-center">
                <Skeleton className="h-3 w-44 max-w-full rounded-full" />
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {['First in', 'Last out', 'Worked', 'Late in', 'Early out', 'Punches'].map((name) => (
                <div key={name} className="min-w-0">
                  <dt className="truncate text-xs text-muted-foreground">{name}</dt>
                  <dd className="flex h-5 items-center">
                    <Skeleton className="h-3.5 w-10 rounded-full" />
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

