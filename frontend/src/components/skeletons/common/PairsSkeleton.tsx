import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const VALUE = ['w-20', 'w-24', 'w-16', 'w-28', 'w-20', 'w-32']

// Loading placeholder for label / value pairs on one line each (the details in force on a day, a record's facts): the
// real `labels` in text and a bar for each value, in one or (`columns` 2, from sm) two columns; `title` adds a bar for
// the line above them. Sized for small text (text-xs), as the job timeline's "As of" box.
export function PairsSkeleton({
  labels,
  columns = 2,
  title = false,
  label = 'Loading',
  className,
}: {
  labels: string[]
  columns?: 1 | 2
  title?: boolean
  label?: string
  className?: string
}) {
  return (
    <div role="status" aria-label={label} className={className}>
      {title && (
        <div className="mb-1.5 flex h-4 items-center">
          <Skeleton className="h-3 w-80 max-w-full rounded-full" />
        </div>
      )}
      <dl className={cn('grid gap-x-4 gap-y-1', columns === 2 && 'sm:grid-cols-2')}>
        {labels.map((text, i) => (
          <div key={text} className="flex min-w-0 items-center gap-2">
            <dt className="shrink-0 text-muted-foreground">{text}</dt>
            <dd className="flex h-4 min-w-0 items-center">
              <Skeleton className={cn('h-3 rounded-full', VALUE[i % VALUE.length])} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
