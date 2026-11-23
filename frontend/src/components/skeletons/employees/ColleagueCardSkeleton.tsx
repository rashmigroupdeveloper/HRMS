import { Building2, Cake, Droplet, Mail, MapPin, Network, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const ROWS: [typeof Mail, string, string][] = [
  [Building2, 'Company', 'w-48'],
  [MapPin, 'Plant', 'w-40'],
  [Network, 'Department', 'w-28'],
  [Mail, 'Work e-mail', 'w-44'],
  [UserRound, 'Reports to', 'w-36'],
]

// Loading placeholder for a colleague's basic card (the People page's directory, the org chart): the same card with the
// real labels, icons and the Org chart button (disabled); the name, designation, code and values are bars
export function ColleagueCardSkeleton({ chart = true, label = 'Loading', className }: { chart?: boolean; label?: string; className?: string }) {
  return (
    <article role="status" aria-label={label} className={cn('rounded-2xl bg-card p-4 shadow-card', className)}>
      <header className="flex items-center gap-3">
        <Skeleton className="size-14 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex h-[22.5px] items-center">
            <Skeleton className="h-4 w-44 max-w-full rounded-full" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-36 max-w-full rounded-full" />
          </div>
        </div>
      </header>
      <dl className="mt-4 space-y-2 text-sm">
        {ROWS.map(([Icon, text, width]) => (
          <div key={text} className="grid grid-cols-[1.25rem_7rem_minmax(0,1fr)] items-center gap-x-2">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            <dt className="text-muted-foreground">{text}</dt>
            <dd className="flex h-5 min-w-0 items-center">
              <Skeleton className={cn('h-3.5 max-w-full rounded-full', width)} />
            </dd>
          </div>
        ))}
      </dl>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {['Joined', 'Birthday', 'Blood group'].map((text, i) => (
          <div key={text} className="rounded-xl bg-surface-2/70 px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {i === 1 && <Cake aria-hidden className="size-3" />}
              {i === 2 && <Droplet aria-hidden className="size-3" />}
              {text}
            </dt>
            <dd className="flex h-5 items-center">
              <Skeleton className={cn('h-3.5 rounded-full bg-card', ['w-20', 'w-14', 'w-10'][i])} />
            </dd>
          </div>
        ))}
      </dl>
      {chart && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled>
            <Network /> Org chart
          </Button>
        </div>
      )}
    </article>
  )
}
