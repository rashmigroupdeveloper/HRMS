import { Skeleton } from '@/components/ui/skeleton'

const MONTH = ['w-28', 'w-32', 'w-24', 'w-28']
const PILLS = [['w-48', 'w-44'], ['w-48', 'w-40', 'w-36'], ['w-52', 'w-44'], ['w-48']]

// Loading placeholder for one's own statutory deposits (Pay & career › Statutory deposits), drawn like the real list rows:
// the month and its company line, then a pill per scheme - the section's heading and note stay real text above it
export function DepositStatusSkeleton({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <ul role="status" aria-label={label} className="divide-y">
      {Array.from({ length: rows }, (_, r) => (
        <li key={r} className="space-y-1.5 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="flex h-6 items-center"><Skeleton className={`h-4 ${MONTH[r % 4]}`} /></p>
            <p className="flex h-4 items-center"><Skeleton className="h-3 w-40" /></p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PILLS[r % 4]!.map((w, i) => <Skeleton key={i} className={`h-[22px] max-w-full rounded-full ${w}`} />)}
          </div>
        </li>
      ))}
    </ul>
  )
}
