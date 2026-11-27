import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'info' | 'gold' | 'positive' | 'warning' | 'negative'

// Soft status pills in the old HRMS style (used by several pages): a pastel tint with a darker ink of the same hue.
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted-foreground',
  info: 'bg-info/15 text-info-ink',
  gold: 'bg-gold-soft text-foreground',
  positive: 'bg-positive/15 text-positive-ink',
  warning: 'bg-warning/15 text-warning-ink',
  negative: 'bg-destructive/10 text-negative-ink',
}

export function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span data-slot="pill" className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  )
}
