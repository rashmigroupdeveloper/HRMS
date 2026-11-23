import { Check, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const CHIP = ['w-20', 'w-14', 'w-24', 'w-16', 'w-28', 'w-12', 'w-20', 'w-24']
const NAME = ['w-24', 'w-32', 'w-20', 'w-36', 'w-28', 'w-16']

// Loading placeholder for the plant's departments drawer, drawn like its form: the summary box ("... of ... departments
// run here", the bar, the ticked ones as chips and the note under them in real text) and - with `canChange` - the search,
// the All / Ticked / Not ticked switch, the Tick all / Untick all buttons (disabled) and the ticks in two columns.
export function PlantDepartmentsSkeleton({ canChange = false, label = 'Loading' }: { canChange?: boolean; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <section className="space-y-2 rounded-2xl bg-surface-2/50 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex h-5 items-center gap-1 text-sm text-muted-foreground">
            <Skeleton className="h-3.5 w-14 rounded-full" /> departments run here
          </div>
          <span className="h-1.5 min-w-24 flex-1 rounded-full bg-border" />
        </div>
        <ul className="flex flex-wrap gap-1">
          {CHIP.map((width, i) => (
            <li key={i} className="inline-flex h-7 items-center rounded-full border border-border bg-card px-2.5">
              <Skeleton className={cn('h-3 rounded-full', width)} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Employees and candidates here can only be placed in these. Unticking one where people are placed keeps it for them - nobody new can be placed in it.
        </p>
      </section>

      {canChange && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1 max-sm:basis-full">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" aria-label="Search departments" placeholder="Search departments" disabled className="h-9 rounded-full pl-8 sm:h-8" />
            </div>
            <div className="inline-flex rounded-full bg-surface-2 p-0.5">
              {['All', 'Ticked', 'Not ticked'].map((text, i) => (
                <span
                  key={text}
                  className={cn('flex h-7 items-center rounded-full px-2.5 text-xs font-medium max-sm:h-8', i === 0 ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground')}
                >
                  {text}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="mr-auto flex items-center gap-1">
              <Skeleton className="h-3 w-6 rounded-full" /> departments
            </span>
            <Button variant="ghost" size="sm" disabled>
              <Check /> Tick all
            </Button>
            <Button variant="ghost" size="sm" disabled>
              <X /> Untick all
            </Button>
          </div>
          <ul className="grid gap-x-2 gap-y-0.5 sm:grid-cols-2">
            {Array.from({ length: 20 }, (_, i) => (
              <li key={i} className="flex min-h-8 items-center gap-2 px-2 py-1 max-sm:min-h-10">
                <span className="size-4 shrink-0 rounded-[4px] border border-input" />
                <Skeleton className={cn('h-3.5 rounded-full', NAME[i % NAME.length])} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
