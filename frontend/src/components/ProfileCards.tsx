import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// The building blocks of the employee profile's tabs (compact design, 2026-11-17): a card with an icon tile and a
// title, label-value lines (label left, value right), item rows with an icon, small chips and an empty note. Every tab
// is made of these so they all look the same.

export function InfoCard({
  icon: Icon,
  title,
  aside,
  className,
  children,
}: {
  icon: LucideIcon
  title: React.ReactNode
  // on the right of the title: a count, a status, a small button
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('min-w-0 rounded-3xl bg-card p-4 shadow-card sm:p-5', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <CardTitle icon={Icon}>{title}</CardTitle>
        {aside}
      </div>
      {children}
    </section>
  )
}

// A card's title: the icon in a soft gold tile, then the name (also used by the profile's own cards - letters, joining
// tasks, change history)
export function CardTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-medium">
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-xl bg-gold/20">
        <Icon className="size-3.5" />
      </span>
      {children}
    </h3>
  )
}

export type LineRow = [label: string, value: React.ReactNode]

// Label-value lines; `columns` 2 puts them side by side from sm. A missing value (null / undefined / '' / '—') is a
// muted dash so the filled ones stand out.
export function Lines({ rows, columns = 1 }: { rows: LineRow[]; columns?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-8', columns === 2 && 'sm:grid-cols-2')}>
      {rows.map(([label, value]) => (
        <Line key={label} label={label} value={value} lastPair={columns === 2} />
      ))}
    </dl>
  )
}

function Line({ label, value, lastPair }: { label: string; value: React.ReactNode; lastPair: boolean }) {
  const missing = value === null || value === undefined || value === '' || value === '—' || value === false
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-dashed border-border/80 py-2 last:border-b-0',
        // two columns: the bottom row of the left column has no line either
        lastPair && 'sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0',
      )}
    >
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 text-right text-sm break-words', missing ? 'text-muted-foreground' : 'font-medium')}>{missing ? '—' : value}</dd>
    </div>
  )
}

// One item of a list (a qualification, a family member, an address...): a round icon or initials, the title with
// optional chips, and a line of details
export function ItemRow({
  icon: Icon,
  initials,
  title,
  chips,
  details,
  aside,
  extra,
  muted,
}: {
  icon?: LucideIcon
  initials?: string
  title: React.ReactNode
  chips?: React.ReactNode
  // the parts of the details line - empty ones are left out
  details?: React.ReactNode[]
  aside?: React.ReactNode
  // anything more under the details (small chips)
  extra?: React.ReactNode
  muted?: boolean
}) {
  const parts = (details ?? []).filter((d) => d !== null && d !== undefined && d !== false && d !== '')
  return (
    <li className={cn('flex items-start gap-3 py-2.5 first:pt-1 last:pb-0', muted && 'text-muted-foreground')}>
      <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          {title}
          {chips}
        </p>
        {parts.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {parts.map((part, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {part}
              </span>
            ))}
          </p>
        )}
        {extra}
      </div>
      {aside}
    </li>
  )
}

// A list of ItemRows with thin lines between them
export function ItemList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border/70">{children}</ul>
}

// A small neutral tag next to a title ("Salary account", "50%", "Expired")
export function Chip({ tone = 'neutral', children }: { tone?: 'neutral' | 'gold' | 'positive' | 'negative' | 'warning'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-muted-foreground',
        tone === 'gold' && 'bg-gold/20 text-foreground',
        tone === 'positive' && 'bg-positive/12 text-positive-ink',
        tone === 'negative' && 'bg-destructive/12 text-negative-ink',
        tone === 'warning' && 'bg-warning/15 text-warning-ink',
      )}
    >
      {children}
    </span>
  )
}

// "None recorded" inside a card
export function EmptyNote({ children = 'None recorded.' }: { children?: React.ReactNode }) {
  return <p className="rounded-2xl bg-surface-2/60 px-3 py-2.5 text-sm text-muted-foreground">{children}</p>
}
