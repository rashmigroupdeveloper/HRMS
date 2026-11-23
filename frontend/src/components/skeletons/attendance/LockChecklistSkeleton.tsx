import { Skeleton } from '@/components/ui/skeleton'

// Loading placeholder for the "Lock <month>?" dialog's checklist (MonthLockSetup's LockDialog): the same list with each
// check's real name and hint (`checks`, the dialog's own LOCK_CHECKS) - only the counts are bars.
export function LockChecklistSkeleton({ checks, label = 'Loading' }: { checks: readonly (readonly [string, string])[]; label?: string }) {
  return (
    <ul role="status" aria-label={label} className="divide-y rounded-2xl bg-surface-2/60 px-3 text-sm">
      {checks.map(([name, hint]) => (
        <li key={name} className="flex items-center justify-between gap-3 py-2">
          <span>
            {name}
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
          <Skeleton className="h-4 w-5 rounded-full" />
        </li>
      ))}
    </ul>
  )
}
