import { FormError } from '@/components/FormError'
import { HomeWeekBarsSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { cn } from '@/lib/utils'
import { hours, type Overview, STATUS } from '@/pages/attendance/components/labels'
import { CardTitle, CornerLink } from './HomeParts'
import { WEEKDAY_SHORT, weekOf } from './home-labels'
import { useMyDays } from './useMyDays'

// "My week" on the self-service home (2026-11-27, Crextio's "Progress - 6.1 h work time this week" bars): the hours
// worked on each day from Monday to Sunday as thin bars - today gold, a weekly off / holiday hatched, leave soft gold, an
// absence or missed punch as a red / amber stub, days to come dotted. Hours come from the punches as worked out.
const FULL = 600 // a 10-hour day fills the bar

export function HomeWeek({ overview }: { overview: Overview }) {
  const my = useMyDays(overview)
  const today = overview.today
  const week = weekOf(today.date)
  const days = week.map((date) => {
    const isToday = date.getTime() === today.date.getTime()
    const d = my.days.find((x) => x.date.getTime() === date.getTime())
    const minutes = isToday ? (today.outAt ? today.workedMinutes : 0) : (d?.workedMinutes ?? 0)
    const status = isToday ? today.status : (d?.status ?? null)
    const planned = isToday ? today.planned : (d?.planned ?? null)
    // in today and not out yet: a short gold bar - the hours come with the out punch
    return { date, isToday, future: date > today.date, minutes, status, planned, inNow: isToday && !!today.inAt && !today.outAt }
  })
  const total = days.reduce((n, d) => n + d.minutes, 0)
  const worked = days.filter((d) => d.minutes > 0).length
  return (
    <section className="home-panel flex min-w-0 flex-col p-4 sm:p-5">
      <CardTitle title="My week" action={<CornerLink to="/ess/attendance" label="Open my attendance" />} />
      <div className="mt-2 flex items-end gap-3">
        <span className="text-[44px] leading-none font-light tabular-nums">{my.pending ? '—' : (total / 60).toFixed(1)}<span className="ml-1 text-2xl">h</span></span>
        <span className="pb-1 text-xs leading-tight text-muted-foreground">Worked this week{worked > 0 && <><br />{hours(Math.round(total / worked))} a day</>}</span>
      </div>
      <FormError error={my.error} />
      {my.pending ? (
        <HomeWeekBarsSkeleton />
      ) : (
        <div className="mt-auto grid grid-cols-7 items-end gap-1 pt-4" role="img" aria-label={`Hours worked this week: ${days.map((d, i) => `${WEEKDAY_SHORT[i]} ${d.future ? 'to come' : d.minutes ? hours(d.minutes) : d.status ? STATUS[d.status].label : 'none'}`).join(', ')}`}>
          {days.map((d, i) => {
            const off = d.planned === 'WEEKLY_OFF' || d.planned === 'HOLIDAY'
            const short = d.status === 'ABSENT' || d.status === 'MISSED_PUNCH'
            const height = d.minutes ? Math.max(10, Math.min(100, (d.minutes / FULL) * 100)) : d.inNow ? 14 : d.status === 'LEAVE' ? 45 : off || d.future ? 22 : short ? 10 : 6
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="relative flex h-28 w-full items-end justify-center">
                  {d.isToday && d.minutes > 0 && <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-gold-foreground tabular-nums" style={{ bottom: `calc(${height}% + 6px)` }}>{hours(d.minutes)}</span>}
                  <span
                    title={`${WEEKDAY_SHORT[i]}: ${d.future ? 'to come' : d.minutes ? hours(d.minutes) : d.status ? STATUS[d.status].label : off ? 'off' : 'not worked out yet'}`}
                    className={cn(
                      'home-rise w-2 rounded-full',
                      d.minutes || d.inNow ? (d.isToday ? 'bg-gold' : 'bg-foreground') : d.status === 'LEAVE' ? 'bg-gold-soft' : short ? (d.status === 'ABSENT' ? 'bg-destructive/50' : 'bg-warning/60') : 'home-hatch',
                    )}
                    style={{ height: `${height}%`, animationDelay: `${i * 40}ms` }}
                  />
                </div>
                <span aria-hidden className={cn('size-1.5 rounded-full', d.isToday ? 'bg-gold' : d.future ? 'bg-foreground/15' : 'bg-foreground/60')} />
                <span className={cn('text-xs', d.isToday ? 'font-medium text-foreground' : 'text-muted-foreground')}>{WEEKDAY_SHORT[i]![0]}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
