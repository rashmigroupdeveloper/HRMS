import { cn } from '@/lib/utils'
import { teamDot } from './labels'

// A team's name with its colour dot (the same colour for the same team everywhere on the page)
export function TeamChip({ team, className }: { team: string; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium whitespace-nowrap', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', teamDot(team))} />
      <span className="truncate">{team}</span>
    </span>
  )
}

// A person's initials in a small circle, then the name
export function PersonChip({ name, initials }: { name: string; initials: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted-foreground">
        {initials}
      </span>
      <span className="truncate">{name}</span>
    </span>
  )
}
