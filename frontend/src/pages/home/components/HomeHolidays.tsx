import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { HomeHolidaysSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { orpc } from '@/lib/orpc'
import { todayDay } from '@/lib/utils'
import { HOLIDAY_PORTION, toneOf } from '@/pages/attendance/components/labels'
import { HOLIDAYS_TITLE, daysBetween, inDays, shortDay } from './home-labels'

// The next holidays of the list the employee follows (2026-11-27): the next one large - how many days away - and the two
// after it. An on-application holiday is a working day unless they apply for it, so it says so. Near the year end the
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
    <section className="home-panel min-w-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium tracking-tight">{HOLIDAYS_TITLE}</h2>
        <Link to="/ess/holidays" className="flex min-h-9 items-center gap-1 text-sm underline underline-offset-4">All holidays <ArrowRight aria-hidden className="size-3.5" /></Link>
      </div>
      <FormError error={thisYear.error ?? nextYear.error} />
      {pending && <HomeHolidaysSkeleton />}
      {!pending && noList && <p className="py-3 text-sm text-muted-foreground">You follow no holiday list yet - HR gives one with your plant.</p>}
      {!pending && !noList && !next && <p className="py-3 text-sm text-muted-foreground">No more holidays on your list this year.</p>}
      {next && (
        <div className="mt-3 rounded-2xl bg-surface-2/60 p-3">
          <p className="text-xs text-muted-foreground">Next · {shortDay(next.date)}</p>
          <p className="mt-0.5 text-xl font-light leading-snug">{next.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium tabular-nums">{inDays(daysBetween(today, next.date))}</span>
            {next.portion !== 'FULL_DAY' && <span className="text-xs text-muted-foreground">{HOLIDAY_PORTION[next.portion]}</span>}
            <Pill tone={toneOf(next.category.tone)}>{next.category.name}</Pill>
          </p>
          {next.mode === 'ON_APPLICATION' && <p className="mt-1 text-xs text-warning-ink">A working day unless you apply for it{next.leaveType ? ` (${next.leaveType.name})` : ''}.</p>}
        </div>
      )}
      {after.length > 0 && (
        <ul className="mt-1 divide-y divide-border/60">
          {after.map((h) => (
            <li key={`${h.id}-${h.date.toISOString()}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
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
