import { LogOut, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAME = ['w-24', 'w-32', 'w-28', 'w-36']
const BROWSER = ['w-32', 'w-28', 'w-36', 'w-32']

// Loading placeholder for the list of who is signed in (Roles & access), drawn like SessionsList: per session the
// screen icon, the name, code and browser line and the times line; `canEnd` adds the Log out button (disabled - the
// first row is the viewer's own session, which has none).
export function SessionsSkeleton({ rows = 6, canEnd = false, label = 'Loading' }: { rows?: number; canEnd?: boolean; label?: string }) {
  return (
    <ul role="status" aria-label={label} className="divide-y divide-border/70">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-3 py-2">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2">
            <Monitor className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="flex h-5 min-w-0 flex-1 items-center gap-2">
                <Skeleton className={cn('h-3.5 rounded-full', NAME[i % NAME.length])} />
                <Skeleton className="h-3.5 w-20 rounded-full max-sm:hidden" />
                <Skeleton className={cn('h-3.5 rounded-full max-sm:hidden', BROWSER[i % BROWSER.length])} />
              </div>
              {canEnd && i > 0 && (
                <Button variant="ghost" size="sm" className="-my-1 shrink-0 max-sm:h-9" disabled>
                  <LogOut /> Log out
                </Button>
              )}
            </div>
            {/* a phone: the code and browser, then the times, run onto more lines */}
            <div className="flex h-5 items-center sm:hidden">
              <Skeleton className="h-3.5 w-40 rounded-full" />
            </div>
            <div className="flex h-5 items-center sm:hidden">
              <Skeleton className="h-3.5 w-16 rounded-full" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-80 max-w-full rounded-full" />
            </div>
            <div className="flex h-4 items-center sm:hidden">
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
