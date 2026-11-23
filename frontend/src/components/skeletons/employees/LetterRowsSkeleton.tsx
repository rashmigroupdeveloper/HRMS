import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const KIND = ['w-36', 'w-28', 'w-40']
const DETAIL = ['w-72', 'w-64', 'w-80']

// Loading placeholder for the profile's issued letters: `rows` rows as the list draws them - the letter's kind and
// number, the dated / issued / e-mailed line, and the real PDF button (disabled)
export function LetterRowsSkeleton({ rows = 3, label = 'Loading', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <ul role="status" aria-label={label} className={cn('divide-y', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex h-5 items-center gap-2">
              <Skeleton className={cn('h-3.5 rounded-full', KIND[i % KIND.length])} />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className={cn('h-3 max-w-full rounded-full', DETAIL[i % DETAIL.length])} />
            </div>
          </div>
          <Button variant="ghost" size="sm" disabled>
            <Download /> PDF
          </Button>
        </li>
      ))}
    </ul>
  )
}
