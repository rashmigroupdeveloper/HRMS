import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Fingerprint, Lock, Pencil } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FormError } from '@/components/FormError'
import { Pill } from '@/components/Pill'
import { PunchesSkeleton } from '@/components/skeletons/attendance/PunchesSkeleton'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { cn, formatDoneBy, todayDay } from '@/lib/utils'
import { coversText, dayMark, dayName, hours, MONTHS, MONTH_BARS, type Month, type MonthDay, NOT_TRACKED_DAY_NOTE, sameDay, STATUS, TOTAL_LABELS, WEEKDAYS, splitFill } from './labels'

// One employee's month as a calendar (Monday-first weeks): each day's status, in / out times and shift; the totals above.
// The chosen day's details (the shift and its times, in / out, worked, late / early, every punch and its machine, HR's
// correction) sit BESIDE the calendar when there is room (a card the width of the page), under it when there is not (a
// drawer, a phone). They open on today, so the day is seen without a click. `actions(day)`: what the viewer can do on a
// day (HR's correction, asking for a change).

// `disabled`: the loading placeholder shows the picker without letting it move. `range`: the attendance month's days (RML's
// 26th to 25th - 2026-11-22). The pill says that range; a month that starts on the 1st says its name. `locked`: nothing in it changes.
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
  const move = (step: number) => {
    const d = new Date(Date.UTC(year, month - 1 + step, 1))
    onChange(d.getUTCFullYear(), d.getUTCMonth() + 1)
  }
  const sameMonth = range && range.from.getUTCFullYear() === range.to.getUTCFullYear() && range.from.getUTCMonth() === range.to.getUTCMonth()
  const dayMonth = (d: Date, withYear = false) => d.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined })
  const crossYear = !!range && range.from.getUTCFullYear() !== range.to.getUTCFullYear()
  const label = !range || (range.from.getUTCDate() === 1 && sameMonth) ? `${MONTHS[month - 1]} ${year}` : `${dayMonth(range.from, crossYear)} – ${dayMonth(range.to, crossYear)}`
  return (
    <div className="inline-flex h-9 max-w-full items-center rounded-full bg-background">
      <Button variant="ghost" size="icon-lg" className="rounded-full hover:bg-card" aria-label="Previous month" disabled={disabled} onClick={() => move(-1)}>
        <ChevronLeft />
      </Button>
      <span className="inline-flex min-w-0 items-center justify-center gap-1 px-0.5 text-sm font-medium whitespace-nowrap tabular-nums">
        {label}
        {locked && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />}
      </span>
      <Button variant="ghost" size="icon-lg" className="rounded-full hover:bg-card" aria-label="Next month" disabled={disabled} onClick={() => move(1)}>
        <ChevronRight />
      </Button>
    </div>
  )
}

// The month summary, in the shape of the Crextio salary calendar (crextio-011 desktop, crextio-025 phone):
// one light hours figure, then three segments — present, absent, leave. The other counts stay as a quiet line.
// Change MonthSkeleton's summary together with this.
export function MonthTotals({ totals }: { totals: Month['totals'] }) {
  const parts = [
    { ...MONTH_BARS[0], value: totals.present },
    { ...MONTH_BARS[1], value: totals.absent },
    { ...MONTH_BARS[2], value: totals.leave },
  ]
  const peak = Math.max(...parts.map((part) => part.value), 0)
  const quiet = [
    [TOTAL_LABELS[1], totals.halfDay],
    [TOTAL_LABELS[3], totals.missedPunch],
    [TOTAL_LABELS[5], totals.onDuty],
    [TOTAL_LABELS[6], totals.late],
  ] as const
  return (
    <div className="space-y-3">
      <p className="flex items-baseline gap-2">
        <span className="text-4xl leading-none font-light tracking-tight tabular-nums">{totals.workedMinutes ? hours(totals.workedMinutes) : '0h'}</span>
        <span className="text-sm text-muted-foreground">worked</span>
      </p>
      <div className="grid grid-cols-3 gap-3" role="img" aria-label={parts.map((part) => `${part.label} ${part.value}`).join(', ')}>
        {parts.map((part) => (
          <div key={part.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{part.label}</span>
              <span className="text-sm font-medium tabular-nums">{part.value}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn('h-full rounded-full', part.value > 0 && part.bar)}
                style={{ width: peak > 0 ? `${(part.value / peak) * 100}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {quiet.map(([label, value]) => (
          <div key={label} className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn('tabular-nums', value ? 'font-medium text-foreground' : 'text-muted-foreground')}>{value}</dd>
          </div>
        ))}
      </dl>
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
  ['WO', 'Weekly off', 'u-hatch bg-surface-2 text-foreground/70'],
  ['H', 'Holiday', 'u-hatch bg-surface-2 text-foreground/70'],
  [' ', 'No result yet', 'u-hatch bg-surface-2/60'],
  // (2026-11-22) a leave shows its type's code
  ['CL', 'On leave (its type)', STATUS.LEAVE.cell],
  ['OD', 'On duty', STATUS.ON_DUTY.cell],
]

// What the marks in the cells mean (also under the loading placeholder's calendar)
export function MonthLegend() {
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="min-h-9 cursor-pointer py-2 font-medium text-foreground focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-ring">Attendance key</summary>
      <ul className="flex flex-wrap gap-x-3 gap-y-2 pb-1">
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
    </details>
  )
}

// the day the details open on: today in this month, else the last day worked out, else the first day employed
function firstChoice(days: MonthDay[], today: Date) {
  return days.find((d) => sameDay(d.date, today) && d.employed) ?? days.findLast((d) => d.employed && d.status) ?? days.find((d) => d.employed) ?? null
}

export function MonthCalendar({ data, actions }: { data: Month; actions?: (day: MonthDay) => React.ReactNode }) {
  const today = todayDay()
  const [picked, setPicked] = useState<Date | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  // the picked day of THIS month (after a month change it falls back to the first choice). A day before joining does not open.
  const open = data.days.find((d) => picked && sameDay(d.date, picked) && d.employed) ?? firstChoice(data.days, today)
  // on a phone the day's card sits under the month, so bring it up when a day is chosen
  useEffect(() => {
    if (!picked) return
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [picked])
  // blank cells before the 1st (the grid starts on Monday)
  const lead = data.days[0] ? (data.days[0].date.getUTCDay() + 6) % 7 : 0
  const selectedIndex = open ? data.days.indexOf(open) + lead : -1
  const selection = useRef<HTMLDivElement>(null)
  const calendarGrid = useRef<HTMLDivElement>(null)
  const previousSelection = useRef<DOMRect | null>(null)
  const movement = useRef<Animation | null>(null)
  const openDate = open?.date.getTime()
  useEffect(() => {
    const grid = calendarGrid.current
    if (!grid) return
    // A phone rotation or a resized drawer changes cell geometry; finish any old movement.
    const observer = new ResizeObserver(() => movement.current?.cancel())
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])
  const pick = (date: Date) => {
    if (open && sameDay(open.date, date)) return
    previousSelection.current = selection.current?.getBoundingClientRect() ?? null
    movement.current?.cancel()
    setPicked(date)
  }
  useLayoutEffect(() => {
    const element = selection.current
    const before = previousSelection.current
    previousSelection.current = null
    if (!element || !before || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const after = element.getBoundingClientRect()
    const animation = element.animate([
      { transform: `translate(${before.x - after.x}px, ${before.y - after.y}px) scale(${before.width / after.width}, ${before.height / after.height})` },
      { transform: 'none' },
    ], { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
    movement.current = animation
    return () => animation.cancel()
  }, [openDate])
  return (
    <div className="@container">
      {data.days.length > 0 && !data.days.some((day) => day.employed) && <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted-foreground">This period is outside your employment dates. Choose another month to see attendance.</p>}
      <div className="grid gap-3 @4xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:items-start @4xl:gap-5">
        <div className="relative z-10 min-w-0 space-y-2">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground sm:gap-1.5">
            {WEEKDAYS.map((w) => (
              <span key={w.key}>{w.short}</span>
            ))}
          </div>
          <div ref={calendarGrid} className="relative grid grid-cols-7 gap-1 sm:gap-1.5">
            {selectedIndex >= 0 && <div ref={selection} aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-lg outline-2 -outline-offset-2 outline-foreground sm:rounded-xl" style={{ gridColumn: `${selectedIndex % 7 + 1} / ${selectedIndex % 7 + 2}`, gridRow: `${Math.floor(selectedIndex / 7) + 1} / ${Math.floor(selectedIndex / 7) + 2}`, transformOrigin: 'top left' }} />}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {data.days.map((day) => {
              const isToday = sameDay(day.date, today)
              const isOpen = !!open && sameDay(day.date, open.date)
              const future = day.date > today
              const status = day.status ? STATUS[day.status] : null
              // today before the checkout: "at work"
              const atWork = isToday && !!day.inAt && !day.outAt
              // a weekly off or a holiday - by the day's status, or (a day not worked out yet) by the plan
              const kind = day.status ?? (day.employed ? day.planned : null)
              const off = kind === 'WEEKLY_OFF' || kind === 'HOLIDAY'
              // the day's mark, always in the middle of the cell: the status, or the planned off / holiday
              // a day to come on approved leave / on duty shows it (2026-11-22)
              const ahead = !status && !off && day.employed ? day.covers.find((c) => c.status !== 'PRESENT') : undefined
              const mark = atWork ? 'In' : status || ahead ? dayMark(day) : kind === 'WEEKLY_OFF' ? 'WO' : kind === 'HOLIDAY' ? 'H' : null
              const shiftCode = !status && !off && day.employed ? day.shift?.code : null
              const times = day.inAt ? `${day.inAt}${day.outAt ? `–${day.outAt}` : ''}` : null
              const line = times ?? day.holiday ?? shiftCode
              // halves that differ: half and half, the first half on the left (2026-11-23)
              const split = !atWork && day.firstHalf && day.secondHalf && day.firstHalf !== day.secondHalf ? splitFill(day.firstHalf, day.secondHalf) : null
              // a day with nothing worked out yet: still shows its date and shift, hatched like an off day so it is not a blank
              const noResult = day.employed && !isToday && !atWork && !split && !off && !status && !ahead
              return (
                <button
                  key={day.date.toISOString()}
                  type="button"
                  disabled={!day.employed}
                  aria-pressed={isOpen}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${day.date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}: ${!day.employed ? 'Outside employment' : atWork ? 'At work' : status?.label ?? ahead?.label ?? (off ? (kind === 'HOLIDAY' ? 'Holiday' : 'Weekly off') : future ? 'Scheduled' : isToday ? 'Not in yet' : 'Not worked out yet')}${day.firstHalf && day.secondHalf && day.firstHalf !== day.secondHalf ? `; first half ${STATUS[day.firstHalf].label}, second half ${STATUS[day.secondHalf].label}` : ''}`}
                  onClick={() => pick(day.date)}
                  style={split ? { background: split } : undefined}
                  className={cn(
                    'relative flex min-h-12 min-w-0 cursor-pointer flex-col items-stretch overflow-hidden rounded-lg p-1 text-left text-xs transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/60 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-18 sm:rounded-xl sm:px-2 sm:py-1.5',
                    atWork
                      ? 'bg-positive/10 text-positive-ink'
                      : split
                        ? 'text-foreground'
                        : off
                        ? 'u-hatch bg-surface-2 text-foreground/70'
                        : status
                          ? status.cell
                          : ahead
                            ? STATUS[ahead.status].cell
                            : noResult
                            ? 'u-hatch bg-surface-2/60 text-muted-foreground'
                            : 'bg-surface-2/70',
                  )}
                >
                  {/* three rows (2026-11-27): the date (and month) top left with HR's pencil in the corner, the mark in the
                      middle, the times / holiday / shift centred at the bottom */}
                  <span className={cn('flex min-w-0 items-center gap-1', day.correction && 'pr-3.5')}>
                    <span
                      className={cn(
                        'grid h-6 shrink-0 place-items-center text-sm font-semibold tabular-nums',
                        isOpen ? 'w-6 rounded-full bg-gold text-gold-foreground' : isToday ? 'w-6 rounded-full bg-hero text-hero-foreground' : (off || noResult) && 'font-medium text-muted-foreground',
                      )}
                    >
                      {day.date.getUTCDate()}
                    </span>
                    {(day.date.getUTCDate() === 1 || day === data.days[0]) && <span className="truncate text-xs font-normal text-muted-foreground">{day.date.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short' })}</span>}
                  </span>
                  {day.correction && (
                    <span title="Corrected by HR" className="absolute top-1.5 right-1 sm:top-2 sm:right-2">
                      <Pencil aria-label="Corrected by HR" className="size-3" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 items-center justify-center gap-1">
                    {mark && (
                      <>
                        <span className="font-semibold sm:text-sm">{mark}</span>
                        {day.lateMinutes > 0 && <span className="hidden font-medium text-negative-ink sm:inline">+{day.lateMinutes}m</span>}
                        {day.lateMinutes > 0 && <span aria-hidden className="size-1.5 rounded-full bg-destructive sm:hidden" />}
                      </>
                    )}
                    {!mark && shiftCode && <span className="truncate text-foreground/70 sm:hidden">{shiftCode}</span>}
                  </span>
                  {line && <span className={cn('hidden truncate text-center tabular-nums sm:block', !times && !day.holiday && 'text-foreground/70')}>{line}</span>}
                </button>
              )
            })}
          </div>
          <MonthLegend />
        </div>
        {open && <DayPanel ref={panelRef} day={open} employeeCode={data.employee.employeeCode} actions={actions?.(open)} />}
      </div>
    </div>
  )
}

// The chosen day: its shift with the times, the numbers, every punch and the machine it came from, HR's correction
function DayPanel({ ref, day, employeeCode, actions }: { ref?: React.Ref<HTMLElement>; day: MonthDay; employeeCode: string; actions?: React.ReactNode }) {
  return (
    <section ref={ref} aria-label="The day's details" className="pointer-events-none relative z-0 min-w-0 rounded-3xl bg-hero p-4 text-hero-foreground shadow-card sm:p-5 @4xl:sticky @4xl:top-24">
      <div className="pointer-events-auto">
        <DayDetails key={`${employeeCode}:${day.date.toISOString()}`} day={day} employeeCode={employeeCode} actions={actions} />
      </div>
    </section>
  )
}

function DayDetails({ day, employeeCode, actions }: { day: MonthDay; employeeCode: string; actions?: React.ReactNode }) {
  const punches = useQuery({ ...orpc.attendance.days.punches.queryOptions({ input: { employeeCode, date: day.date } }), enabled: day.punchCount > 0 })
  // the day carries the shift's name; the times come from the shift list (open to every employee)
  const shifts = useQuery(orpc.attendance.shifts.list.queryOptions({ input: {} }))
  const shift = day.shift?.id ? shifts.data?.find((s) => s.id === day.shift?.id) : undefined
  const status = day.status ? STATUS[day.status] : null
  const isToday = sameDay(day.date, todayDay())
  const atWork = isToday && !!day.inAt && !day.outAt
  const plannedStatus = day.planned === 'WEEKLY_OFF' || day.planned === 'HOLIDAY' ? STATUS[day.planned] : null
  const cover = day.covers.find((c) => c.status !== 'PRESENT')
  const state = atWork ? { label: 'At work', tone: 'positive' as const } : status ?? (cover ? STATUS[cover.status] : plannedStatus)
  const future = day.date > todayDay()
  // (a half-day holiday says which half - 2026-11-24)
  const kind = day.holiday ? `Holiday${day.holidayHalf ? ` (${day.holidayHalf === 'FIRST' ? 'first' : 'second'} half)` : ''} - ${day.holiday}` : day.planned === 'WEEKLY_OFF' ? 'Weekly off' : null
  // the two halves when they differ (2026-11-22)
  const halves = day.firstHalf && day.secondHalf && day.firstHalf !== day.secondHalf ? { first: STATUS[day.firstHalf], second: STATUS[day.secondHalf] } : null
  // approved leave / regularization / on duty on the day (2026-11-22)
  const covered = coversText(day)
  const numbers: [string, string, string?][] = [
    ['First in', day.inAt ?? '—'],
    ['Last out', day.outAt ?? '—'],
    ['Worked', hours(day.workedMinutes)],
    ['Late in', day.lateMinutes ? `${day.lateMinutes}m` : '—', day.lateMinutes ? 'font-medium text-hero-foreground' : undefined],
    ['Early out', day.earlyMinutes ? `${day.earlyMinutes}m` : '—', day.earlyMinutes ? 'font-medium text-hero-foreground' : undefined],
    ['Punches', String(day.punchCount || '—')],
  ]
  return (
    <div className="attendance-day-content space-y-4 [&_[role=alert]]:bg-card [&_[role=alert]]:text-negative-ink">
      <div className="flex items-start gap-3">
        <div className="grid w-12 shrink-0 place-items-center rounded-2xl bg-hero-foreground/10 py-1">
          <span className="text-xl leading-7 font-light tabular-nums">{day.date.getUTCDate()}</span>
          <span className="text-xs text-hero-foreground/70">{day.date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {state ? <Pill tone={state.tone} className="bg-hero-foreground/10 text-hero-foreground">{state.label}</Pill> : <Pill tone="neutral" className="bg-hero-foreground/10 text-hero-foreground">{future ? 'Scheduled' : isToday ? 'Not in yet' : 'Not worked out yet'}</Pill>}
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
          <p className="mt-1 truncate text-xs text-hero-foreground/70">{dayName(day.date)}</p>
        </div>
      </div>

      <FormError error={shifts.error} />

      {/* the shift: what the day is measured against */}
      <div className="rounded-xl bg-hero-foreground/5 px-3 py-2.5 text-sm">
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
            <p className="text-xs text-hero-foreground/70">
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
            <dt className="truncate text-xs text-hero-foreground/70">{label}</dt>
            <dd className={cn('tabular-nums', ink)}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* every punch of the day, with the machine it came from */}
      {day.punchCount > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-hero-foreground/70">
            <Fingerprint className="size-3.5" aria-hidden /> Punches
          </p>
          <FormError error={punches.error} />
          {punches.isError && <Button variant="secondary" size="sm" onClick={() => void punches.refetch()}>Retry punches</Button>}
          {punches.data ? (
            <ol className="divide-y divide-hero-foreground/10 rounded-xl bg-hero-foreground/5 px-3">
              {punches.data.map((p, i) => (
                <li key={p.at.toISOString()} className="flex items-baseline gap-3 py-1.5 text-sm">
                  <span className="w-4 text-xs text-hero-foreground/70 tabular-nums">{i + 1}</span>
                  <span className="font-medium tabular-nums">{p.time}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-hero-foreground/70" title={p.device ?? undefined}>
                    {p.device ?? '—'}
                  </span>
                </li>
              ))}
            </ol>
          ) : punches.isPending ? (
            <PunchesSkeleton count={day.punchCount} label="Loading punches" />
          ) : null}
        </div>
      )}

      {/* why a policy rule made a half absent, e.g. "3rd late this month - first half absent" - amber; that the day counts
          present because their attendance is not tracked (2026-11-27) - calm, it is no penalty */}
      {day.note && <p className={cn('rounded-xl px-3 py-2 text-xs', day.note === NOT_TRACKED_DAY_NOTE ? 'bg-hero-foreground/10 text-hero-foreground/80' : 'bg-warning/20 text-hero-foreground')}>{day.note}</p>}
      {day.correction && (
        <p className="rounded-xl bg-hero-foreground/5 px-3 py-2 text-xs">
          Corrected:{' '}
          <strong>
            {[day.correction.firstHalf && `first half ${STATUS[day.correction.firstHalf].label.toLowerCase()}`, day.correction.secondHalf && `second half ${STATUS[day.correction.secondHalf].label.toLowerCase()}`]
              .filter(Boolean)
              .join(', ')}
          </strong>{' '}
          {formatDoneBy(day.correction.at, day.correction.by)} - {day.correction.reason}
          {day.autoStatus && <span className="text-hero-foreground/70"> (the punches gave {STATUS[day.autoStatus].label.toLowerCase()})</span>}
        </p>
      )}
      {actions}
    </div>
  )
}
