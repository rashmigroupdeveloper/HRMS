import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Fingerprint, Lock, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Pill } from '@/components/Pill'
import { PunchesSkeleton } from '@/components/skeletons/attendance/PunchesSkeleton'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { cn, formatDoneBy } from '@/lib/utils'
import { coversText, dayMark, dayName, hours, MONTHS, type Month, type MonthDay, sameDay, STATUS, todayDay, TOTAL_LABELS, WEEKDAYS, splitFill } from './labels'

// One employee's month as a calendar (Monday-first weeks): each day's status, in / out times and shift; the totals above.
// The chosen day's details (the shift and its times, in / out, worked, late / early, every punch and its machine, HR's
// correction) sit BESIDE the calendar when there is room (a card the width of the page), under it when there is not (a
// drawer, a phone). They open on today, so the day is seen without a click. `actions(day)`: what the viewer can do on a
// day (HR's correction, asking for a change).

// `disabled`: the loading placeholder shows the picker without letting it move. `range`: the attendance month's days (RML's
// 26th to 25th - 2026-11-22) shown under its name; `locked`: the month is locked (nothing in it changes)
export function MonthPicker({
  year,
  month,
  onChange,
  disabled,
  range,
  locked,
}: {
  year: number
  month: number
  onChange: (year: number, month: number) => void
  disabled?: boolean
  range?: { from: Date; to: Date }
  locked?: boolean
}) {
  const short = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })
  const move = (step: number) => {
    const d = new Date(Date.UTC(year, month - 1 + step, 1))
    onChange(d.getUTCFullYear(), d.getUTCMonth() + 1)
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Previous month" disabled={disabled} onClick={() => move(-1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center text-sm leading-tight font-medium tabular-nums">
        <span className="inline-flex items-center gap-1">
          {MONTHS[month - 1]} {year}
          {locked && <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" />}
        </span>
        {range && range.from.getUTCDate() !== 1 && (
          <span className="block text-xs font-normal text-muted-foreground">
            {short(range.from)} – {short(range.to)}
          </span>
        )}
      </span>
      <Button variant="ghost" size="icon" aria-label="Next month" disabled={disabled} onClick={() => move(1)}>
        <ChevronRight />
      </Button>
    </div>
  )
}

export function MonthTotals({ totals }: { totals: Month['totals'] }) {
  // a count is coloured only when there is something to see - a zero stays in normal ink (same order as TOTAL_LABELS)
  const values: [number | string, string | false][] = [
    [totals.present, totals.present > 0 && 'text-positive-ink'],
    [totals.halfDay, totals.halfDay > 0 && 'text-warning-ink'],
    [totals.absent, totals.absent > 0 && 'text-negative-ink'],
    [totals.missedPunch, totals.missedPunch > 0 && 'text-warning-ink'],
    [totals.leave, false],
    [totals.onDuty, false],
    [totals.late, false],
    [totals.workedMinutes ? hours(totals.workedMinutes) : '0h', false],
  ]
  const tiles = TOTAL_LABELS.map((label, i) => [label, ...values[i]!] as const)
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {tiles.map(([label, value, ink]) => (
        <div key={label} className="rounded-xl bg-surface-2/60 px-3 py-2">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className={cn('text-lg leading-6 font-light tabular-nums', ink || 'text-foreground')}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// the marks used in the cells, in the colours of the cells
// [mark, label, cell classes, background of a day drawn half and half]
const LEGEND: [string, string, string, string?][] = [
  ['P', 'Present', STATUS.PRESENT.cell],
  // a day whose halves differ shows both - drawn half and half (2026-11-22 / 2026-11-23)
  ['P | A', 'First half | second half', 'text-foreground', splitFill('PRESENT', 'ABSENT')],
  ['P | WO', 'Half day + half off', 'text-foreground', splitFill('PRESENT', 'WEEKLY_OFF')],
  ['MP', 'Missed punch', STATUS.MISSED_PUNCH.cell],
  ['A', 'Absent', STATUS.ABSENT.cell],
  ['WO', 'Weekly off', 'bg-surface-2 text-foreground/70'],
  ['H', 'Holiday', 'bg-surface-2 text-foreground/70'],
  // (2026-11-22) a leave shows its type's code
  ['CL', 'On leave (its type)', STATUS.LEAVE.cell],
  ['OD', 'On duty', STATUS.ON_DUTY.cell],
]

// What the marks in the cells mean (also under the loading placeholder's calendar)
export function MonthLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1 text-xs text-foreground/70">
      {LEGEND.map(([mark, label, cell, fill]) => (
        <li key={mark} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('grid h-5 min-w-6 place-items-center rounded-md px-1 font-semibold', cell)} style={fill ? { background: fill } : undefined}>
            {mark}
          </span>
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="font-semibold text-negative-ink">
          +12m
        </span>
        late by
      </li>
      <li className="flex items-center gap-1.5">
        <Pencil aria-hidden className="size-3" />
        corrected by HR
      </li>
    </ul>
  )
}

// the day the details open on: today in this month, else the last day worked out, else the first day employed
function firstChoice(days: MonthDay[], today: Date) {
  return days.find((d) => sameDay(d.date, today) && d.employed) ?? days.findLast((d) => d.employed && d.status) ?? days.find((d) => d.employed) ?? null
}

export function MonthCalendar({ data, actions }: { data: Month; actions?: (day: MonthDay) => React.ReactNode }) {
  const today = todayDay()
  const [picked, setPicked] = useState<Date | null>(null)
  // the picked day of THIS month (after a month change it falls back to the first choice)
  const open = data.days.find((d) => picked && sameDay(d.date, picked) && d.employed) ?? firstChoice(data.days, today)
  // blank cells before the 1st (the grid starts on Monday)
  const lead = (data.days[0]!.date.getUTCDay() + 6) % 7
  return (
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
            {data.days.map((day) => {
              const isToday = sameDay(day.date, today)
              const isOpen = !!open && sameDay(day.date, open.date)
              const future = day.date > today
              const status = day.status ? STATUS[day.status] : null
              // today before the checkout: "at work"
              const atWork = isToday && day.punchCount === 1
              // a weekly off or a holiday - by the day's status, or (a day not worked out yet) by the plan
              const kind = day.status ?? (day.employed ? day.planned : null)
              const off = kind === 'WEEKLY_OFF' || kind === 'HOLIDAY'
              // the day's mark, always in the same corner: the status, or the planned off / holiday
              // a day to come on approved leave / on duty shows it (2026-11-22)
              const ahead = !status && !off && day.employed ? day.covers.find((c) => c.status !== 'PRESENT') : undefined
              const mark = atWork ? 'In' : status || ahead ? dayMark(day) : kind === 'WEEKLY_OFF' ? 'WO' : kind === 'HOLIDAY' ? 'H' : null
              const shiftCode = !status && !off && day.employed ? day.shift?.code : null
              const times = day.inAt ? `${day.inAt}${day.outAt ? `–${day.outAt}` : ''}` : null
              const line = times ?? day.holiday ?? shiftCode
              // halves that differ: half and half, the first half on the left (2026-11-23)
              const split = !atWork && day.firstHalf && day.secondHalf && day.firstHalf !== day.secondHalf ? splitFill(day.firstHalf, day.secondHalf) : null
              return (
                <button
                  key={day.date.toISOString()}
                  type="button"
                  disabled={!day.employed}
                  aria-pressed={isOpen}
                  onClick={() => setPicked(day.date)}
                  style={split ? { background: split } : undefined}
                  className={cn(
                    'flex min-h-12 min-w-0 flex-col items-stretch rounded-lg p-1 text-left text-xs transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/60 disabled:opacity-40 sm:min-h-16 sm:rounded-xl sm:px-2 sm:py-1.5',
                    atWork
                      ? 'bg-positive/10 text-positive-ink'
                      : split
                        ? 'text-foreground'
                        : off
                        ? 'bg-surface-2 text-foreground/70'
                        : status
                          ? status.cell
                          : ahead
                            ? STATUS[ahead.status].cell
                            : future
                            ? 'ring-1 ring-border/60 ring-inset'
                            : 'ring-1 ring-border ring-inset',
                    // the day whose details are shown (an outline: the cards' shadow would hide a ring)
                    isOpen && 'outline-2 -outline-offset-2 outline-hero',
                  )}
                >
                  <span className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:justify-between">
                    <span
                      className={cn(
                        'grid h-6 place-items-center self-start text-sm font-semibold tabular-nums',
                        isToday ? '-ml-0.5 w-6 rounded-full bg-hero text-hero-foreground' : (off || (future && !status)) && 'font-medium text-muted-foreground',
                      )}
                    >
                      {day.date.getUTCDate()}
                    </span>
                    {mark && (
                      <span className="flex items-center gap-1 font-semibold">
                        {day.lateMinutes > 0 && <span className="hidden font-medium text-negative-ink sm:inline">+{day.lateMinutes}m</span>}
                        {mark}
                        {day.lateMinutes > 0 && <span aria-hidden className="size-1.5 rounded-full bg-destructive sm:hidden" />}
                        {day.correction && (
                          <span title="Corrected by HR">
                            <Pencil aria-label="Corrected by HR" className="size-3" />
                          </span>
                        )}
                      </span>
                    )}
                    {!mark && shiftCode && <span className="truncate text-foreground/70 sm:hidden">{shiftCode}</span>}
                  </span>
                  {line && <span className={cn('mt-auto hidden truncate tabular-nums sm:block', !times && !day.holiday && 'text-foreground/70')}>{line}</span>}
                </button>
              )
            })}
          </div>
          <MonthLegend />
        </div>
        {open && <DayPanel day={open} employeeCode={data.employee.employeeCode} actions={actions?.(open)} />}
      </div>
    </div>
  )
}

// The chosen day: its shift with the times, the numbers, every punch and the machine it came from, HR's correction
function DayPanel({ day, employeeCode, actions }: { day: MonthDay; employeeCode: string; actions?: React.ReactNode }) {
  const punches = useQuery({ ...orpc.attendance.days.punches.queryOptions({ input: { employeeCode, date: day.date } }), enabled: day.punchCount > 0 })
  // the day carries the shift's name; the times come from the shift list (open to every employee)
  const shifts = useQuery(orpc.attendance.shifts.list.queryOptions({ input: {} }))
  const shift = day.shift?.id ? shifts.data?.find((s) => s.id === day.shift?.id) : undefined
  const status = day.status ? STATUS[day.status] : null
  const future = day.date > todayDay()
  const kind = day.holiday ? `Holiday - ${day.holiday}` : day.planned === 'WEEKLY_OFF' ? 'Weekly off' : null
  // the two halves when they differ (2026-11-22)
  const halves = day.firstHalf && day.secondHalf && day.firstHalf !== day.secondHalf ? { first: STATUS[day.firstHalf], second: STATUS[day.secondHalf] } : null
  // approved leave / regularization / on duty on the day (2026-11-22)
  const covered = coversText(day)
  const numbers: [string, string, string?][] = [
    ['First in', day.inAt ?? '—'],
    ['Last out', day.outAt ?? '—'],
    ['Worked', hours(day.workedMinutes)],
    ['Late in', day.lateMinutes ? `${day.lateMinutes}m` : '—', day.lateMinutes ? 'text-negative-ink' : undefined],
    ['Early out', day.earlyMinutes ? `${day.earlyMinutes}m` : '—', day.earlyMinutes ? 'text-negative-ink' : undefined],
    ['Punches', String(day.punchCount || '—')],
  ]
  return (
    <section aria-label="The day's details" className="space-y-3 rounded-2xl bg-surface-2/60 p-3 @4xl:sticky @4xl:top-24">
      <div className="flex items-start gap-3">
        <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-card py-1 shadow-card">
          <span className="text-xl leading-7 font-light tabular-nums">{day.date.getUTCDate()}</span>
          <span className="text-xs text-muted-foreground">{day.date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {status ? <Pill tone={status.tone}>{status.label}</Pill> : <Pill tone="neutral">{future ? 'Still to come' : 'Not worked out yet'}</Pill>}
            {day.correction && (
              <Pill tone="info">
                <Pencil className="size-3" /> Corrected
              </Pill>
            )}
          </div>
          {halves && (
            <p className="mt-1 text-xs">
              First half <strong>{halves.first.label}</strong> · second half <strong>{halves.second.label}</strong>
            </p>
          )}
          {covered.length > 0 && <p className="mt-1 text-xs font-medium">{covered.join(' · ')}</p>}
          <p className="mt-1 truncate text-xs text-muted-foreground">{dayName(day.date)}</p>
        </div>
      </div>

      {/* the shift: what the day is measured against */}
      <div className="rounded-xl bg-card px-3 py-2 text-sm shadow-card">
        {kind ? (
          <p className="font-medium">{kind}</p>
        ) : (
          <>
            <p className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{day.shift ? `${day.shift.name} shift` : 'No shift'}</span>
              {shift && (
                <span className="shrink-0 tabular-nums">
                  {shift.start}–{shift.end}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {day.rostered ? 'Roster change' : (day.pattern ?? 'Schedule')}
              {/* a half day: only the first half is worked, no break (e.g. Saturday) */}
              {day.halfDay ? ` · half day - first half only${shift ? `, to ${shift.halfSplit ?? 'the middle'}` : ''}` : shift && ` · break ${shift.breakMinutes}m`}
              {/* the rules the day is judged by (the attendance policy - 2026-11-22) */}
              {day.policy && ` · ${day.policy.name} policy, grace ${day.policy.graceMinutes}m`}
            </p>
          </>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        {numbers.map(([label, value, ink]) => (
          <div key={label} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className={cn('tabular-nums', ink)}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* every punch of the day, with the machine it came from */}
      {day.punchCount > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Fingerprint className="size-3.5" aria-hidden /> Punches
          </p>
          {punches.data ? (
            <ol className="divide-y divide-border/70 rounded-xl bg-card px-3 shadow-card">
              {punches.data.map((p, i) => (
                <li key={p.at.toISOString()} className="flex items-baseline gap-3 py-1.5 text-sm">
                  <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="font-medium tabular-nums">{p.time}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground" title={p.device ?? undefined}>
                    {p.device ?? '—'}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <PunchesSkeleton count={day.punchCount} label="Loading punches" />
          )}
        </div>
      )}

      {/* why a policy rule made a half absent, e.g. "3rd late this month - first half absent" */}
      {day.note && <p className="rounded-xl bg-warning/15 px-3 py-2 text-xs text-warning-ink">{day.note}</p>}
      {day.correction && (
        <p className="rounded-xl bg-card px-3 py-2 text-xs shadow-card">
          Corrected:{' '}
          <strong>
            {[day.correction.firstHalf && `first half ${STATUS[day.correction.firstHalf].label.toLowerCase()}`, day.correction.secondHalf && `second half ${STATUS[day.correction.secondHalf].label.toLowerCase()}`]
              .filter(Boolean)
              .join(', ')}
          </strong>{' '}
          {formatDoneBy(day.correction.at, day.correction.by)} - {day.correction.reason}
          {day.autoStatus && <span className="text-muted-foreground"> (the punches gave {STATUS[day.autoStatus].label.toLowerCase()})</span>}
        </p>
      )}
      {actions}
    </section>
  )
}
