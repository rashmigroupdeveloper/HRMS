import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const TITLE = ['w-24', 'w-20', 'w-28', 'w-16']
const BY = ['w-20', 'w-24', 'w-16', 'w-20']
const CHANGE = ['w-56', 'w-44', 'w-64', 'w-48']

// Loading placeholder for a timeline, drawn like the real entries: per entry a date on the left, a dot on the line (the
// latest one gold), a title with who did it, a change line and - with `link` - the entry's own link in real text (the
// job timeline's "Show all details"). `rows` = how many entries to draw.
export function TimelineSkeleton({ rows = 4, link, label = 'Loading', className }: { rows?: number; link?: string; label?: string; className?: string }) {
  return (
    <ol role="status" aria-label={label} className={cn('relative', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="grid grid-cols-[5.5rem_1rem_1fr] gap-x-3 pb-3 last:pb-0">
          <span className="flex justify-end pt-1">
            <Skeleton className="h-3 w-16 rounded-full" />
          </span>
          <span className="relative flex justify-center">
            <span className={cn('z-10 mt-1 size-2.5 rounded-full border-2', i === 0 ? 'border-gold bg-gold' : 'border-border bg-card')} />
            {i < rows - 1 && <span className="absolute top-3 bottom-[-0.75rem] w-px bg-border" />}
          </span>
          <div className="min-w-0 space-y-1.5 pt-0.5 text-sm">
            <div className="flex items-center gap-2">
              <Skeleton className={cn('h-3.5 rounded-full', TITLE[i % TITLE.length])} />
              <Skeleton className={cn('h-3 rounded-full', BY[i % BY.length])} />
            </div>
            {i < rows - 1 && <Skeleton className={cn('h-3 max-w-full rounded-full', CHANGE[i % CHANGE.length])} />}
            {link ? <p className="text-xs text-info-ink">{link}</p> : <Skeleton className="h-3 w-24 rounded-full" />}
          </div>
        </li>
      ))}
    </ol>
  )
}
