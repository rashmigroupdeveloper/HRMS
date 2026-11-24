import { Skeleton } from '@/components/ui/skeleton'
import { CHECK_GROUPS } from '@/pages/onboarding/components/labels'

// The joining day's checklist while it loads (JoiningDialog): its two real groups - titles and help - over item bars, in the
// same two-column grid (change both together)
export function JoiningChecklistSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      {CHECK_GROUPS.map((group, g) => (
        <div key={group.who} className="space-y-1.5">
          <p className="flex items-baseline justify-between gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.title}
            <Skeleton className="h-3 w-16 rounded-full" />
          </p>
          <p className="text-xs text-muted-foreground">{group.help}</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {Array.from({ length: g === 0 ? 6 : 4 }, (_, i) => (
              <li key={i} className="flex items-start gap-2 rounded-2xl bg-surface-2/70 px-3 py-2">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                <Skeleton className={i % 2 ? 'mt-1 h-3.5 w-32 rounded-full' : 'mt-1 h-3.5 w-44 rounded-full'} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
