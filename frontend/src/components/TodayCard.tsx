import { CalendarClock } from 'lucide-react'
import type { client } from '@/lib/orpc'
import { cn } from '@/lib/utils'

// The employee's today in one line: in since 09:04 / 09:01-18:10 / weekly off / not in yet - on the attendance page and
// the home page (attendance, 2026-11-16)

type Today = Awaited<ReturnType<typeof client.attendance.overview>>['today']
const STATUS_LABEL: Record<NonNullable<Today['status']>, string> = {
  PRESENT: 'Present',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
  MISSED_PUNCH: 'Missed punch',
  WEEKLY_OFF: 'Weekly off',
  HOLIDAY: 'Holiday',
  LEAVE: 'On leave',
  ON_DUTY: 'On duty',
}
const hours = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
export function TodayCard({ today, className }: { today: Today; className?: string }) {
  const status = today.status ? STATUS_LABEL[today.status] : null
  let line: string
  // approved leave / on duty for the whole day (2026-11-22): "On leave - Casual leave"
  const away = today.covers.length === 2 && today.covers[0]!.label === today.covers[1]!.label && today.covers[0]!.status !== 'PRESENT' ? today.covers[0]! : null
  if (today.planned === 'HOLIDAY') line = `Holiday${today.holiday ? ` - ${today.holiday}` : ''}`
  else if (away && !today.inAt) line = away.status === 'LEAVE' ? `On leave - ${away.label}` : 'On duty'
  else if (today.planned === 'WEEKLY_OFF' && !today.inAt) line = 'Weekly off'
  else if (today.inAt && !today.outAt) line = `In since ${today.inAt}`
  else if (today.inAt) line = `${today.inAt} – ${today.outAt} · ${hours(today.workedMinutes)}`
  else line = today.shift ? `Not in yet · ${today.shift.name} shift` : 'Not in yet'
  // a half-day holiday (2026-11-24): which half is off
  if (today.planned === 'WORK' && today.holidayHalf && today.holiday) line += ` · ${today.holiday}, ${today.holidayHalf === 'FIRST' ? 'first' : 'second'} half off`
  return (
    <div className={cn('flex items-center gap-3 rounded-3xl bg-card px-4 py-3 shadow-card', className)}>
      <span className="grid size-10 place-items-center rounded-2xl bg-surface-2">
        <CalendarClock className="size-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">Today</p>
        <p className="text-sm font-medium tabular-nums">
          {line}
          {today.lateMinutes > 0 && <span className="ml-2 text-xs text-negative-ink">{today.lateMinutes}m late</span>}
        </p>
        {status && today.outAt && <p className="text-xs text-muted-foreground">{status}</p>}
      </div>
    </div>
  )
}
