import { Pill, type Tone } from '@/components/Pill'
import { hours, NOT_TRACKED_DAY_NOTE, type Overview, STATUS } from '@/pages/attendance/components/labels'
import { CardTitle, CornerLink } from './HomeParts'
import { MY_DAY_NOTE, MY_DAY_TILES, shortDay, span } from './home-labels'
import { useNow } from './useNow'

// "Today" on the self-service home (2026-11-27, the redesign - Crextio's time tracker as a ring): the ring is the shift
// from its start to its end, filled up to the clock now (time, not presence - punches arrive by upload); in its middle
// the first punch; beside it the last punch, the time worked and how late. A weekly off, holiday, leave or a person whose
// attendance is not tracked says so in the middle instead.
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

// what the middle of the ring says on a day that is not a working day for the person
function dayOff(t: Today) {
  if (notTracked(t)) return { big: 'Present', small: 'not tracked' }
  const away = awayAllDay(t)
  if (away && !t.inAt) return { big: away.status === 'LEAVE' ? 'Leave' : 'On duty', small: away.label }
  if (t.planned === 'HOLIDAY' && !t.inAt) return { big: 'Holiday', small: t.holiday ?? '' }
  if (t.planned === 'WEEKLY_OFF' && !t.inAt) return { big: 'Off', small: 'weekly off' }
  return null
}

const R = 54
const CIRCUMFERENCE = 2 * Math.PI * R

export function HomeToday({ overview }: { overview: Overview }) {
  const t = overview.today
  const now = useNow()
  const top = headline(t)
  const off = dayOff(t)
  const shift = !off ? t.shiftHours : null
  const start = shift?.startsAt.getTime() ?? 0
  const end = shift?.endsAt.getTime() ?? 0
  const share = shift ? Math.min(1, Math.max(0, (now.getTime() - start) / (end - start))) : 0
  const where = !shift ? null : now.getTime() < start ? `starts in ${span((start - now.getTime()) / 60_000)}` : now.getTime() < end ? `ends in ${span((end - now.getTime()) / 60_000)}` : 'over for today'
  const facts = [
    [MY_DAY_TILES[1], t.outAt ?? '—'],
    [MY_DAY_TILES[2], t.outAt ? hours(t.workedMinutes) : '—'],
    ['Late', t.lateMinutes > 0 ? `${t.lateMinutes}m` : '—'],
  ] as const
  return (
    <section className="home-panel flex min-w-0 flex-col p-4 sm:p-5">
      <CardTitle title="Today" sub={shortDay(t.date)} action={<div className="flex items-center gap-2"><Pill tone={top.tone}>{top.label}</Pill><CornerLink to="/ess/attendance" label="Open my attendance" /></div>} />
      <div className="mt-3 flex flex-1 items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
            <circle cx="64" cy="64" r={R} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="1.2 5.6" className="text-foreground/25" />
            {share > 0 && <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-gold)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${CIRCUMFERENCE * share} ${CIRCUMFERENCE}`} className="home-ring" />}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="text-[28px] leading-none font-light tabular-nums">{off ? off.big : (t.inAt ?? '—')}</span>
            <span className="mt-1 max-w-24 truncate text-xs text-muted-foreground">{off ? off.small : t.inAt ? MY_DAY_TILES[0] : 'not in yet'}</span>
          </div>
        </div>
        <dl className="min-w-0 flex-1 divide-y divide-border/60">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={`text-lg font-light tabular-nums ${label === 'Late' && t.lateMinutes > 0 ? 'text-warning-ink' : ''}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {shift ? <><span className="text-foreground">{t.shift?.name ?? 'Shift'} {shift.start} – {shift.end}</span> · shift {where}</> : t.planned === 'WORK' && t.holidayHalf && t.holiday ? `${t.holiday}: half day off` : MY_DAY_NOTE}
      </p>
    </section>
  )
}
