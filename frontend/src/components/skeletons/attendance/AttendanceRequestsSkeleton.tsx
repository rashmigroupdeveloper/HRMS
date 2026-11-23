import { Skeleton } from '@/components/ui/skeleton'

// The request history's real row layout. The section heading remains in MyAttendance.
export function AttendanceRequestsSkeleton({ label }: { label: string }) {
  return (
    <ul role="status" aria-label={label} className="divide-y">
      {[0, 1].map((row) => (
        <li key={row} className="flex flex-wrap items-center justify-between gap-3 py-2">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-44 max-w-full rounded-full" />
            <Skeleton className="h-3 w-56 max-w-full rounded-full" />
          </div>
          <Skeleton className="h-7 w-28 rounded-full" />
        </li>
      ))}
    </ul>
  )
}
