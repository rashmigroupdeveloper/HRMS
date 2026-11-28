import { useQuery } from '@tanstack/react-query'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HomeHolidaysSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import { HOLIDAY_PORTION, toneOf } from '@/pages/attendance/components/labels'
import { CardTitle, CornerLink, TILE } from './HomeParts'
import { HOLIDAYS_TITLE, daysBetween, inDays, shortDay } from './home-labels'

// The next holidays of the list the employee follows (2026-11-27): the next one large - a soft gold card with its date
// big, as Crextio's birthday card (2026-11-28) - how many days away, and the two after it. An on-application holiday is a working day unless they apply for it, so it says so. Near the year end the
// next year's list is read too.
export function HomeHolidays() {
  const today = todayDay()
  const year = today.getUTCFullYear()
  const thisYear = useQuery(orpc.attendance.holidays.mine.queryOptions({ input: { year } }))
  const left = thisYear.data?.holidays.filter((h) => h.date >= today) ?? []
  const needNext = !!thisYear.data && left.length < 3
  const nextYear = useQuery({ ...orpc.attendance.holidays.mine.queryOptions({ input: { year: year + 1 } }), enabled: needNext })
  const pending = thisYear.isPending || (needNext && nextYear.isPending)
  const coming = [...left, ...(needNext ? (nextYear.data?.holidays ?? []) : [])].slice(0, 3)
  const [next, ...after] = coming
  const noList = thisYear.data && !thisYear.data.holidayList && !nextYear.data?.holidayList
  return (
    <section className={TILE}>
      <CardTitle title={HOLIDAYS_TITLE} sub="From the holiday list you follow" action={<CornerLink to="/ess/holidays" label="Open all holidays" />} />
      <FormError error={thisYear.error ?? nextYear.error} />
      {pending && <HomeHolidaysSkeleton />}
      {!pending && noList && <p className="py-3 text-sm text-muted-foreground">You follow no holiday list yet - HR gives one with your plant.</p>}
      {!pending && !noList && !next && <p className="py-3 text-sm text-muted-foreground">No more holidays on your list this year.</p>}
      {next && (
        <div className="mt-2.5 flex gap-3 rounded-2xl bg-gold-soft px-3 py-2.5 text-gold-foreground">
          <div className="w-12 shrink-0 text-center">
            <p className="text-[34px] leading-none font-light tabular-nums">{next.date.getUTCDate()}</p>
            <p className="mt-0.5 text-[11px]">{next.date.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short', weekday: 'short' })}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base leading-snug">{next.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium tabular-nums">{inDays(daysBetween(today, next.date))}</span>
              {next.portion !== 'FULL_DAY' && <span className="text-xs opacity-75">{HOLIDAY_PORTION[next.portion]}</span>}
              <Pill tone={toneOf(next.category.tone)}>{next.category.name}</Pill>
            </p>
            {next.mode === 'ON_APPLICATION' && <p className="mt-1 text-xs text-warning-ink">A working day unless you apply for it{next.leaveType ? ` (${next.leaveType.name})` : ''}.</p>}
          </div>
        </div>
      )}
      {after.length > 0 && (
        <ul className="mt-1 divide-y divide-border/60">
          {after.map((h) => (
            <li key={`${h.id}-${h.date.toISOString()}`} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">{shortDay(h.date)}{h.mode === 'ON_APPLICATION' ? ' · on application' : ''}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{inDays(daysBetween(today, h.date))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
