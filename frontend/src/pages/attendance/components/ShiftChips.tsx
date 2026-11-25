import { cn } from '@/lib/utils'

// The small pictures of shifts in the attendance setup (the setup's redesign, 2026-11-25)

// "09:30" -> minutes of the day
const minutesOf = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

// A shift's hours on a bar of the whole day (00-24): one span, or two when it ends the next day
export function ShiftDayBar({ start, end }: { start: string; end: string }) {
  const from = minutesOf(start)
  const to = minutesOf(end)
  const spans = to > from ? [[from, to]] : [[from, 1440], [0, to]]
  return (
    <span aria-hidden className="relative block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      {spans.map(([a = 0, b = 0]) => (
        <span key={a} className="absolute inset-y-0 rounded-full bg-hero" style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }} />
      ))}
    </span>
  )
}

// A shift's short code, as on the roster: a dark chip - the same as a worked day in a schedule pattern
export function ShiftCode({ code, className }: { code: string; className?: string }) {
  return <span className={cn('inline-grid min-w-9 place-items-center rounded-lg bg-hero px-1.5 py-1 font-mono text-xs leading-4 font-semibold text-hero-foreground', className)}>{code}</span>
}
