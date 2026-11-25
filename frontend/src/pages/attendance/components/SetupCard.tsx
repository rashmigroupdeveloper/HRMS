import { Info, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export type SetupCardProps = {
  title: string
  // one short line under the title, always shown
  summary?: string
  // the longer explanation of how the part works - folded behind the (i) button, so the content leads
  hint?: string
  icon?: LucideIcon
  // a count next to the title ("6"), when it helps to see how many there are
  count?: React.ReactNode
  action?: React.ReactNode
  // the one dark card of a part (its main action - e.g. the punch upload)
  dark?: boolean
  className?: string
  children: React.ReactNode
}

// A card of the attendance setup (the setup's redesign, 2026-11-25 - the user: "boring, not professional"): an icon,
// the title with a count, a one-line summary, the long explanation folded behind (i), the actions on the title row.
// Also drawn by the setup's skeletons (change both together).
export function SetupCard({ title, summary, hint, icon: Icon, count, action, dark, className, children }: SetupCardProps) {
  const [open, setOpen] = useState(false)
  const muted = dark ? 'text-hero-muted' : 'text-muted-foreground'
  return (
    <section className={cn('min-w-0 space-y-3 rounded-3xl p-4 sm:p-5', dark ? 'bg-hero text-hero-foreground shadow-float' : 'bg-card shadow-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', dark ? 'bg-hero-foreground/10' : 'bg-surface-2')}>
              <Icon aria-hidden className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-2 text-lg leading-6 font-normal tracking-tight">
              {title}
              {count !== undefined && <span className={cn('text-sm tabular-nums', muted)}>{count}</span>}
            </h2>
            {summary && <p className={cn('text-xs leading-4', muted)}>{summary}</p>}
          </div>
          {hint && (
            <button
              type="button"
              aria-expanded={open}
              aria-label={`How it works: ${title}`}
              title={open ? 'Hide the explanation' : 'How it works'}
              onClick={() => setOpen((v) => !v)}
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-8',
                dark ? 'text-hero-muted hover:bg-hero-foreground/10 hover:text-hero-foreground aria-expanded:bg-hero-foreground/10' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2 aria-expanded:text-foreground',
              )}
            >
              <Info className="size-4" />
            </button>
          )}
        </div>
        {action}
      </div>
      {hint && open && <p className={cn('max-w-3xl rounded-2xl px-3 py-2 text-xs leading-5', dark ? 'bg-hero-foreground/10 text-hero-muted' : 'bg-surface-2/70 text-muted-foreground')}>{hint}</p>}
      {children}
    </section>
  )
}
