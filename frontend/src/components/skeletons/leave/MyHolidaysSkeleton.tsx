import { Skeleton } from '@/components/ui/skeleton'

// The list's name under the card's title while it loads ("Your holiday list: " stays real text)
export function MyHolidayListNameSkeleton() {
  return <Skeleton className="inline-block h-3 w-28 rounded-full align-middle" />
}

// The rows of My holidays (My leave) while they load: a date, a name, the category pill and the line beside it, and - on
// some - the Apply button's place (change both together with MyHolidays)
export function MyHolidaysSkeleton({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <ul role="status" aria-label={label} className="divide-y text-sm">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Skeleton className="h-3.5 w-20 rounded-full" />
            <Skeleton className={i % 2 ? 'h-3.5 w-24 rounded-full' : 'h-3.5 w-32 rounded-full'} />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </span>
          {i % 3 === 2 && <Skeleton className="h-8 w-20 rounded-full" />}
        </li>
      ))}
    </ul>
  )
}
