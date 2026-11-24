import { useQuery } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { MyHolidayListNameSkeleton, MyHolidaysSkeleton } from '@/components/skeletons/leave/MyHolidaysSkeleton'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { cn, formatDate, todayDay } from '@/lib/utils'
import { HOLIDAY_PORTION, segment, SEGMENTS, toneOf } from '@/pages/attendance/components/labels'
import type { Application, Balance } from './labels'

// My holidays (the user, 2026-11-24): the holidays of the employee's own holiday list - not every company's calendar. The
// automatic ones are days off; an on-application one (a restricted / election holiday) is theirs to apply for from its
// leave type's balance: Apply, then Waiting / Taken - approved, the day is a holiday for them.
export function MyHolidays({ balances, applications, onApply }: { balances: Balance[] | undefined; applications: Application[] | undefined; onApply: (typeId: number, date: Date) => void }) {
  const thisYear = todayDay().getUTCFullYear()
  const [year, setYear] = useState(thisYear)
  const mine = useQuery(orpc.attendance.holidays.mine.queryOptions({ input: { year } }))
  const today = todayDay()
  const m = mine.data
  // their leave taking the holiday (waiting or approved), and what is left of its type
  const takenOn = (typeId: number, date: Date) =>
    applications?.find((a) => a.leaveType.id === typeId && a.fromDate <= date && a.toDate >= date && (a.status === 'PENDING' || a.status === 'APPROVED'))
  const left = (typeId: number) => balances?.find((b) => b.leaveType.id === typeId)?.available ?? 0
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-light tracking-tight">Holidays</h2>
          <p className="text-xs text-muted-foreground">
            {!m ? (
              <>
                Your holiday list: <MyHolidayListNameSkeleton />
              </>
            ) : m.holidayList ? (
              `Your holiday list: ${m.holidayList.name}`
            ) : (
              'You have no holiday list yet - HR gives one.'
            )}
            {m?.next && ` · ${m.next.holidayList.name} from ${formatDate(m.next.from)}`}
          </p>
        </div>
        <div className={SEGMENTS}>
          {[thisYear, thisYear + 1].map((y) => (
            <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)} className={segment(year === y)}>
              {y}
            </button>
          ))}
        </div>
      </div>
      <FormError error={mine.error} />
      {mine.isPending && <MyHolidaysSkeleton label="Loading your holidays" />}
      {m && !m.holidays.length && <p className="py-2 text-sm text-muted-foreground">No holidays in {year} on your list yet.</p>}
      {m && m.holidays.length > 0 && (
        <ul className="divide-y text-sm">
          {m.holidays.map((h) => {
            const past = h.date < today
            const applied = h.leaveType ? takenOn(h.leaveType.id, h.date) : undefined
            return (
              <li key={h.id} className={cn('flex flex-wrap items-center justify-between gap-2 py-2', past && !applied && 'opacity-60')}>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium tabular-nums">{formatDate(h.date)}</span>
                  <span>{h.name}</span>
                  <Pill tone={toneOf(h.category.tone)}>{h.category.name}</Pill>
                  <span className="text-xs text-muted-foreground">
                    {h.mode === 'AUTOMATIC'
                      ? HOLIDAY_PORTION[h.portion]
                      : `Optional · ${h.leaveType?.code} · ${left(h.leaveType!.id)} left${h.allowHalfDay ? ' · half day allowed' : ''}`}
                  </span>
                </span>
                {h.mode === 'ON_APPLICATION' && h.leaveType && (
                  <span className="flex items-center gap-2">
                    {applied ? (
                      <Pill tone={applied.status === 'APPROVED' ? 'positive' : 'info'}>{applied.status === 'APPROVED' ? 'Taken' : 'Waiting'}</Pill>
                    ) : left(h.leaveType.id) > 0 ? (
                      <Button variant="secondary" size="sm" onClick={() => onApply(h.leaveType!.id, h.date)}>
                        <CalendarPlus /> Apply
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No {h.leaveType.code} left</span>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
