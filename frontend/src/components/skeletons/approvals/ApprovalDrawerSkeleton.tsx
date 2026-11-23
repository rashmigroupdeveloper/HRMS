import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const WHO = ['w-24', 'w-28', 'w-20']
const NAME = ['w-28', 'w-24', 'w-32']

// Loading placeholder for the body of an approval request's side panel (ApprovalDrawer), drawn like the real one: the
// request's summary line, then the "Steps" heading (real text) and the steps as ApprovalTrail draws them - the step's
// number, who decides it, the approver's name, its status pill and a line below. Change both together.
export function ApprovalDrawerSkeleton({ steps = 2, label = 'Loading' }: { steps?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="h-4 w-3/4 rounded-full" />
      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Steps</h3>
        <ol className="space-y-1.5">
          {Array.from({ length: steps }, (_, i) => (
            <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm">
              <span className="pt-0.5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className={cn('h-4 rounded-full', WHO[i % WHO.length])} />
                  <Skeleton className={cn('h-3.5 rounded-full', NAME[i % NAME.length])} />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48 max-w-full rounded-full" />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
