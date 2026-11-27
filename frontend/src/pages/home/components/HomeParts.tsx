import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// The home pages' small building blocks (2026-11-27, the redesign after Crextio's composition - crextio-ref/NOTES.md):
// light titles with a round ↗ link, big light headline numbers with a tiny icon, and a segmented strip.

// The round ↗ button at a card's top right - opens the card's page
export function CornerLink({ to, label, dark = false }: { to: string; label: string; dark?: boolean }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cn(
        'home-corner grid size-9 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2',
        dark ? 'bg-hero-foreground/10 hover:bg-hero-foreground/20 focus-visible:ring-gold' : 'bg-surface-2 hover:bg-surface-2/70 focus-visible:ring-ring',
      )}
    >
      <ArrowUpRight aria-hidden className="size-4" />
    </Link>
  )
}

// A card's title row: a light title (and an optional line under it) with the ↗ link or another action on the right
export function CardTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-light tracking-tight">{title}</h2>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

// Big light numbers beside the greeting: a tiny icon, the number, a short label - each a link to its page
export type Headline = { icon: LucideIcon; label: string; value: ReactNode; to: string; hint?: string }
export function HeadlineStats({ stats, loading }: { stats: Headline[]; loading?: boolean }) {
  return (
    <ul className="flex flex-wrap items-end gap-x-5 gap-y-3 sm:gap-x-9">
      {stats.map(({ icon: Icon, label, value, to, hint }) => (
        <li key={label}>
          <Link to={to} title={hint} className="group flex items-end gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="mb-2 grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-card transition-colors group-hover:text-foreground"><Icon className="size-3.5" /></span>
            <span>
              <span className="block text-[38px] leading-none font-light tracking-tight tabular-nums sm:text-[56px]">{loading ? <Skeleton className="my-1 h-10 w-14 rounded sm:h-12" /> : value}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// A segmented strip: each part as wide as its share, its label above and its count inside - dark, gold, outline,
// grey or hatched (Crextio's "Interviews / Hired / Project time / Output" strip). Parts at 0 are left out.
export type Segment = { label: string; value: number; tone: 'dark' | 'gold' | 'outline' | 'grey' | 'hatched' }
const SEGMENT_TONE: Record<Segment['tone'], string> = {
  dark: 'bg-hero text-hero-foreground',
  gold: 'bg-gold text-gold-foreground',
  outline: 'border border-foreground/30 text-foreground',
  grey: 'bg-foreground/10 text-foreground',
  hatched: 'home-hatch text-muted-foreground',
}
export function SegmentStrip({ segments, label }: { segments: Segment[]; label: string }) {
  const shown = segments.filter((s) => s.value > 0)
  return (
    <div role="img" aria-label={`${label}: ${shown.map((s) => `${s.label} ${s.value}`).join(', ')}`} className="flex w-full gap-1.5">
      {shown.map((s) => (
        <div key={s.label} className="min-w-[52px]" style={{ flex: `${s.value} 1 0%` }}>
          <p className="mb-1.5 truncate text-xs text-muted-foreground">{s.label}</p>
          <div className={cn('home-grow flex h-11 items-center rounded-full px-4 text-sm font-medium tabular-nums', SEGMENT_TONE[s.tone])}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}
