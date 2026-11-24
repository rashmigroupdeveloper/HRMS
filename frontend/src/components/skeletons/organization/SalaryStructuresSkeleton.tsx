import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const COMPONENT = ['w-20', 'w-12', 'w-32', 'w-16', 'w-28', 'w-24', 'w-40', 'w-36', 'w-44']
const RULE = ['w-24', 'w-28', 'w-20', 'w-24', 'w-44', 'w-32', 'w-24', 'w-28', 'w-56']
// lines per card, as the seeded structures in name order (blue collar, white collar, trainee)
const CARDS = [7, 9, 1]

// Loading placeholder for the Organization page's "Salary structures" tab, drawn like the loaded cards
// (SalaryStructuresTab): per structure its name, the "For:" line and a row per line (component, rule); `canEdit` adds
// the pencil (disabled) as the loaded cards have it
export function SalaryStructuresSkeleton({ canEdit = false, label = 'Loading' }: { canEdit?: boolean; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
      {CARDS.map((rows, c) => (
        <div key={c} className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Skeleton className="mt-1 h-4 w-44 rounded-full" />
              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                For: <Skeleton className="h-3 w-56 max-w-full rounded-full" />
              </p>
            </div>
            {canEdit && (
              <Button size="icon-sm" variant="ghost" disabled aria-hidden>
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {Array.from({ length: rows }, (_, r) => (
                <tr key={r} className="border-t border-dashed border-border/80">
                  <td className="py-1 pr-3">
                    <Skeleton className={cn('my-1 h-3 rounded-full', COMPONENT[r % COMPONENT.length])} />
                  </td>
                  <td className="py-1">
                    <Skeleton className={cn('my-1 ml-auto h-3 rounded-full', RULE[r % RULE.length])} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
