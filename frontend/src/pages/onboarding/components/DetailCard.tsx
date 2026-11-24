import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// A card of a candidate's offer tab: a gold icon tile and the title, something on the right (`aside`), then the body.
// Its loading skeleton (CandidatePageSkeleton) uses the same card.
export function DetailCard({
  title,
  icon: Icon,
  aside,
  className,
  children,
}: {
  title: string
  icon: LucideIcon
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('rounded-3xl bg-card p-5 shadow-card', className)}>
      <header className="mb-3.5 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gold-soft">
          <Icon className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-base font-medium tracking-tight">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  )
}
