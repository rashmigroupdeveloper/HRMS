import { ArrowUpRight, Check, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// The home pages' small building blocks (2026-11-27, after Crextio's composition - crextio-ref/NOTES.md): light titles
// with a round arrow link, big light headline numbers with a tiny icon, a segmented strip, the calm "all clear" line, and
// the class every tile of the self-service grid shares (one height, footer at the bottom).

// every card of the home's tile grid: content as a column so a footer sits at the bottom (`mt-auto`); the grid cell
// (.home-tile) gives every tile the same height from md up, so the rows stay regular
export const TILE = 'home-panel flex h-full min-w-0 flex-col overflow-hidden p-5'

// The round arrow button at a card's top right - opens the card's page
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
      <ArrowUpRight aria-hidden className="size-3.5" />
    </Link>
  )
}

// A card's title row: a light title (and an optional line under it) with the arrow link or another action on the right
export function CardTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl leading-tight font-light tracking-tight">{title}</h2>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

// Big light numbers beside the greeting: a tiny icon, the number, a short label - each a link to its page
export type Headline = { icon: LucideIcon; label: string; value: ReactNode; to: string; hint?: string }
export function HeadlineStats({ stats, loading }: { stats: Headline[]; loading?: boolean }) {
  return (
    <ul className="flex flex-wrap items-end gap-x-6 gap-y-3 sm:gap-x-8">
      {stats.map(({ icon: Icon, label, value, to, hint }) => (
        <li key={label}>
          <Link to={to} title={hint} className="group flex items-end gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="mb-1.5 grid size-6 place-items-center rounded-full bg-card text-muted-foreground shadow-card transition-colors group-hover:text-foreground"><Icon className="size-3" /></span>
            <span>
              <span className="block text-[38px] leading-none font-light tracking-tight tabular-nums sm:text-[52px]">{loading ? <Skeleton className="my-1 h-8 w-12 rounded sm:h-10" /> : value}</span>
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
        <div key={s.label} className="min-w-[48px]" style={{ flex: `${s.value} 1 0%` }}>
          <p className="mb-1 truncate text-[11px] text-muted-foreground">{s.label}</p>
          <div className={cn('home-grow flex h-10 items-center rounded-full px-4 text-sm font-medium tabular-nums', SEGMENT_TONE[s.tone])}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

// The calm line under the grid (the user, 2026-11-27): what needs nothing gets a small check here instead of a card
export function AllClear({ items }: { items: { label: string; to: string }[] }) {
  if (!items.length) return null
  return (
    <ul aria-label="All clear" className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label}>
          <Link to={item.to} className="inline-flex min-h-8 items-center gap-1.5 rounded-full outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="grid size-4 place-items-center rounded-full bg-positive/15 text-positive-ink"><Check className="size-2.5" /></span>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
