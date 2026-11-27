import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router'
import { FormError } from '@/components/FormError'
import { Pill, type Tone } from '@/components/Pill'
import { HomeToFixSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import { orpc } from '@/lib/orpc'
import { toDateInput } from '@/lib/utils'
import { hours, NOT_TRACKED_DAY_NOTE, type MonthDay, type Overview, STATUS } from '@/pages/attendance/components/labels'
import { MY_DAY_NOTE, MY_DAY_TILES, TO_FIX_TITLE, minutesOf, shortDay, span } from './home-labels'
import { useMyDays } from './useMyDays'
import { useNow } from './useNow'

// "My day" on the self-service home (2026-11-27, from main's employee dashboard - first in / last out, made more useful):
// today's status, the first and last punch and the time worked, where the shift stands now, and the days of the last 30
// that still need a request from the employee (a missed punch, an absence) - each one tap from its request.
type Today = Overview['today']

// approved leave / on duty for the whole day
const awayAllDay = (t: Today) => (t.covers.length === 2 && t.covers[0]!.label === t.covers[1]!.label && t.covers[0]!.status !== 'PRESENT' ? t.covers[0]! : null)
const notTracked = (t: Today) => t.notTracked || !!t.note?.includes(NOT_TRACKED_DAY_NOTE)

function headline(t: Today): { label: string; tone: Tone } {
  if (notTracked(t)) return { label: 'Not tracked', tone: 'neutral' }
  if (t.inAt && !t.outAt) return { label: 'In', tone: 'positive' }
  if (t.status) return { label: STATUS[t.status].label, tone: STATUS[t.status].tone }
  const away = awayAllDay(t)
  if (away) return away.status === 'LEAVE' ? { label: 'On leave', tone: 'gold' } : { label: 'On duty', tone: 'positive' }
  if (t.planned === 'HOLIDAY') return { label: 'Holiday', tone: 'info' }
  if (t.planned === 'WEEKLY_OFF') return { label: 'Weekly off', tone: 'neutral' }
  return { label: 'Not in yet', tone: 'neutral' }
}

// one plain sentence on what today means for the employee
function explain(t: Today, now: Date) {
  const away = awayAllDay(t)
  let line: string
  if (notTracked(t)) line = 'Your attendance is not tracked - your working days count present.'
  else if (t.planned === 'HOLIDAY' && !t.inAt) line = `Holiday${t.holiday ? ` - ${t.holiday}` : ''}.`
  else if (away && !t.inAt) line = away.status === 'LEAVE' ? `On leave - ${away.label}.` : 'On duty today.'
  else if (t.planned === 'WEEKLY_OFF' && !t.inAt) line = 'Weekly off.'
  else if (t.inAt && t.outAt) line = `${t.inAt} – ${t.outAt}, ${hours(t.workedMinutes)} worked.`
  else if (t.inAt) line = ''
  else if (t.shiftHours && now < t.shiftHours.startsAt) line = `Your shift starts at ${t.shiftHours.start}.`
  else line = 'No punch has arrived for today yet.'
  if (t.planned === 'WORK' && t.holidayHalf && t.holiday) line += ` ${t.holiday}: the ${t.holidayHalf === 'FIRST' ? 'first' : 'second'} half is off.`
  return line
}

// ((d + 720) mod 1440) - 720: a clock difference between -12h and +12h, so 08:50 against a 09:00 start is 10 minutes early
const signed = (minutes: number) => ((((minutes + 720) % 1440) + 1440) % 1440) - 720

// The shift as a line from its start to its end: the time at work drawn on it (first in to last out), and a marker at
// "now" that moves with the clock while the shift runs
function ShiftLine({ t, now }: { t: Today; now: Date }) {
  const shift = t.shiftHours!
  const start = shift.startsAt.getTime()
  const end = shift.endsAt.getTime()
  const at = (ms: number) => Math.min(100, Math.max(0, ((ms - start) / (end - start)) * 100))
  const inMs = t.inAt ? start + signed(minutesOf(t.inAt) - minutesOf(shift.start)) * 60_000 : null
  const outMs = t.outAt ? end + signed(minutesOf(t.outAt) - minutesOf(shift.end)) * 60_000 : null
  const nowMs = now.getTime()
  const where = nowMs < start ? `starts in ${span((start - nowMs) / 60_000)}` : nowMs < end ? `ends in ${span((end - nowMs) / 60_000)}` : 'over for today'
  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{t.shift?.name ?? 'Shift'} · {shift.start} – {shift.end}</span>
        <span className="font-medium text-foreground">Shift {where}</span>
      </p>
      <div className="relative mt-2 h-2 rounded-full bg-surface-2" role="img" aria-label={`Shift ${shift.start} to ${shift.end}${t.inAt ? `, in at ${t.inAt}` : ''}${t.outAt ? `, out at ${t.outAt}` : ''}, ${where}`}>
        {inMs !== null && outMs !== null && <span className="home-grow absolute inset-y-0 rounded-full bg-gold" style={{ left: `${at(inMs)}%`, width: `${Math.max(1, at(outMs) - at(inMs))}%` }} />}
        {inMs !== null && outMs === null && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold ring-2 ring-card" style={{ left: `${at(inMs)}%` }} />}
        {nowMs >= start && nowMs <= end && <span aria-hidden className="home-slide absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${at(nowMs)}%` }} />}
      </div>
    </div>
  )
}

export function HomeMyDay({ overview }: { overview: Overview }) {
  const t = overview.today
  const now = useNow()
  const top = headline(t)
  const late = t.lateMinutes > 0 ? `${t.lateMinutes}m late` : null
  const early = t.earlyMinutes > 0 && t.outAt ? `${t.earlyMinutes}m early` : null
  const values = [t.inAt ?? '—', t.outAt ?? '—', t.outAt ? hours(t.workedMinutes) : '—']
  const notes = [late, early, null]
  return (
    <section className="home-panel min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium tracking-tight">My day</h2>
          <p className="text-xs text-muted-foreground">{shortDay(t.date)}</p>
        </div>
        <Pill tone={top.tone}>{top.label}</Pill>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {MY_DAY_TILES.map((label, i) => (
          <div key={label} className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-2xl font-light tabular-nums">{values[i]}</dd>
            {notes[i] && <dd className="text-xs text-warning-ink">{notes[i]}</dd>}
          </div>
        ))}
      </dl>
      {t.shiftHours && !notTracked(t) && !(awayAllDay(t) && !t.inAt) && <ShiftLine t={t} now={now} />}
      {explain(t, now) && <p className="mt-3 text-sm">{explain(t, now)}</p>}
      <ToFix overview={overview} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-3">
        <Link to="/ess/attendance" className="home-cta flex min-h-9 items-center gap-1.5 text-sm font-medium">Open my attendance <ArrowRight aria-hidden className="size-4" /></Link>
        <p className="text-xs text-muted-foreground">{MY_DAY_NOTE}</p>
      </div>
    </section>
  )
}

// A working day of the last 30 (in a month not locked yet) with a missed punch or an absence and no request for it yet -
// regularization, leave or on duty waiting or approved
function ToFix({ overview }: { overview: Overview }) {
  const my = useMyDays(overview)
  const regularizations = useQuery(orpc.attendance.regularizations.mine.queryOptions())
  const leave = useQuery(orpc.leave.applications.mine.queryOptions())
  const pending = my.pending || regularizations.isPending || leave.isPending
  const asked = (day: Date) =>
    !!regularizations.data?.some((r) => (r.status === 'PENDING' || r.status === 'APPROVED') && r.fromDate <= day && r.toDate >= day) ||
    !!leave.data?.some((l) => (l.status === 'PENDING' || l.status === 'APPROVED') && l.fromDate <= day && l.toDate >= day)
  const problem = (d: MonthDay) => [d.firstHalf, d.secondHalf].find((s) => s === 'MISSED_PUNCH') ?? [d.firstHalf, d.secondHalf].find((s) => s === 'ABSENT')
  const days = pending
    ? []
    : my.days.filter((d) => !d.locked && d.employed && d.planned === 'WORK' && d.date < my.today! && d.date >= my.earliest! && problem(d) && !asked(d.date)).reverse()
  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {TO_FIX_TITLE}
        {days.length > 0 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning-ink tabular-nums">{days.length}</span>}
      </h3>
      <FormError error={my.error ?? regularizations.error ?? leave.error} />
      {pending && <HomeToFixSkeleton />}
      {!pending && days.length === 0 && (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><CircleCheck aria-hidden className="size-4 shrink-0" />Every working day of the last 30 is in order.</p>
      )}
      <ul className="divide-y divide-border/60">
        {days.slice(0, 3).map((d) => {
          const what = problem(d)!
          return (
            <li key={d.date.toISOString()}>
              <Link to={`/ess/attendance?regularize=${toDateInput(d.date)}`} className="group flex min-h-14 items-center justify-between gap-3 rounded-xl py-2 outline-none hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{shortDay(d.date)}</p>
                  <p className="text-xs text-muted-foreground">{what === 'MISSED_PUNCH' ? 'Ask to correct the punch' : 'Ask to correct it, or apply for leave'}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <Pill tone={STATUS[what].tone}>{STATUS[what].label}</Pill>
                  <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {days.length > 3 && <Link to="/ess/attendance" className="flex min-h-9 items-center text-xs underline underline-offset-4">{days.length - 3} more in My attendance</Link>}
    </div>
  )
}
