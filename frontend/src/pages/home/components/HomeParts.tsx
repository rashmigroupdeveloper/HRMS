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

// The headline numbers beside the greeting (compact, 2026-11-27 - the user: the header took too much space): a tiny
// icon, the number, a short label under it - each a link to its page
export type Headline = { icon: LucideIcon; label: string; value: ReactNode; to: string; hint?: string }
export function HeadlineStats({ stats, loading }: { stats: Headline[]; loading?: boolean }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-6">
      {stats.map(({ icon: Icon, label, value, to, hint }) => (
        <li key={label}>
          <Link to={to} title={hint} className="group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className="hidden size-8 place-items-center rounded-full bg-card text-muted-foreground shadow-card transition-colors group-hover:text-foreground sm:grid"><Icon className="size-3.5" /></span>
            <span>
              <span className="block text-[26px] leading-none font-light tracking-tight tabular-nums">{loading ? <Skeleton className="h-6 w-8 rounded" /> : value}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{label}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// A thin segmented bar under the greeting (Crextio's strip, made slim - 2026-11-27): each part as wide as its share,
// dark / gold / outline / grey / hatched, with a one-line legend of the counts. Parts at 0 are left out.
export type Segment = { label: string; value: number; tone: 'dark' | 'gold' | 'outline' | 'grey' | 'hatched' }
const SEGMENT_TONE: Record<Segment['tone'], string> = {
  dark: 'bg-hero',
  gold: 'bg-gold',
  outline: 'border border-foreground/40',
  grey: 'bg-foreground/15',
  hatched: 'home-hatch',
}
export function SegmentStrip({ segments, label, caption }: { segments: Segment[]; label: string; caption: ReactNode }) {
  const shown = segments.filter((s) => s.value > 0)
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">{caption}</span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {shown.map((s) => <li key={s.label} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn('size-2 rounded-full', SEGMENT_TONE[s.tone])} /><span className="tabular-nums">{s.value}</span><span className="text-muted-foreground">{s.label.toLowerCase()}</span></li>)}
        </ul>
      </div>
      <div role="img" aria-label={`${label}: ${shown.map((s) => `${s.label} ${s.value}`).join(', ')}`} className="mt-2 flex h-2 w-full gap-1">
        {shown.map((s) => <span key={s.label} className={cn('home-grow h-full min-w-2 rounded-full', SEGMENT_TONE[s.tone])} style={{ flex: `${s.value} 1 0%` }} />)}
      </div>
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
