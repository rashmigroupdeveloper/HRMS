import { useEffect, useState, type CSSProperties } from 'react'
import { cycleSpan } from '@/lib/cycle'
import { cn } from '@/lib/utils'

const dayLabel = (day: Date) => day.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })

// Where today sits between two calendar days. The gold fill and the mark are one move: the days already passed.
export function CycleRuler({ from, to, today, ink = 'light' }: { from: Date; to: Date; today: Date; ink?: 'light' | 'dark' }) {
  const { length, index, outside, ratio } = cycleSpan(from, to, today)
  const fromTime = from.getTime()
  const toTime = to.getTime()
  const [placed, setPlaced] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPlaced(true))
    return () => cancelAnimationFrame(frame)
  }, [fromTime, toTime])
  const mark = outside === 'before' ? 'Before this period' : outside === 'after' ? 'After this period' : `Day ${index + 1} of ${length}`
  const light = ink === 'light'
  return (
    <div className="mt-4 px-1">
      <div className="relative h-6" role="img" aria-label={`${dayLabel(from)} to ${dayLabel(to)}. ${mark}.`}>
        <div className={cn('absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full', light ? 'bg-hero-foreground/15' : 'bg-surface-2')}>
          <span data-placed={placed || undefined} className="cycle-fill block h-full rounded-full bg-gold" style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%` }} />
        </div>
        <span
          data-placed={placed || undefined}
          className={cn('cycle-mark absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold ring-4', light ? 'ring-hero' : 'ring-card')}
          style={{ '--at': `${ratio * 100}%` } as CSSProperties}
        />
      </div>
      <div className={cn('mt-1 flex items-baseline justify-between gap-3 text-xs tabular-nums', light ? 'text-hero-foreground/70' : 'text-muted-foreground')}>
        <span>{dayLabel(from)}</span>
        <span className={cn('text-center', light ? 'text-gold' : 'text-foreground')}>{mark}</span>
        <span>{dayLabel(to)}</span>
      </div>
    </div>
  )
}
