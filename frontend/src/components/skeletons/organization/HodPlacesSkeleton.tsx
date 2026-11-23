import { ChevronDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Loading placeholder for the HOD places picker (HodPlacesPicker): its search box (disabled until the places are there),
// then `companies` closed company rows - the tick, the company's code and name, "n of m" and the arrow
export function HodPlacesSkeleton({ companies = 2, label = 'Loading', className }: { companies?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('space-y-2', className)}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Search places" placeholder="Company, plant or department" className="h-9 rounded-full pl-8" disabled />
      </div>
      {Array.from({ length: companies }, (_, i) => (
        <section key={i} className="rounded-2xl bg-surface-2/60">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-4 shrink-0 rounded-[4px] bg-card" />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="flex h-5 items-center">
                <Skeleton className={cn('h-3.5 rounded-full bg-card', ['w-48', 'w-40'][i % 2])} />
              </span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <Skeleton className="h-3 w-10 rounded-full bg-card" />
                <ChevronDown className="size-4" />
              </span>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
