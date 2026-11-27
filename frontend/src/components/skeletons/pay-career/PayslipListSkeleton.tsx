import { Skeleton } from '@/components/ui/skeleton'

const MONTH = ['w-28', 'w-32', 'w-24', 'w-28']
const DETAIL = ['w-64', 'w-56', 'w-60', 'w-52']

// Loading placeholder for one's own payslips (Pay & career › Payslips), drawn like the real list rows: the month, a line
// of pay period · company · code, and the Open button - one line a row, as the real ones; the section's heading and note
// stay real text above it
export function PayslipListSkeleton({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <ul role="status" aria-label={label} className="divide-y">
      {Array.from({ length: rows }, (_, r) => (
        <li key={r} className="flex items-center justify-between gap-3 py-2.5">
          {/* (each bar in a box of its text's line height: the month 24px, the details 16px - rows as tall as the real ones) */}
          <div className="min-w-0">
            <p className="flex h-6 items-center"><Skeleton className={`h-4 ${MONTH[r % 4]}`} /></p>
            <p className="flex h-4 items-center"><Skeleton className={`h-3 max-w-full ${DETAIL[r % 4]}`} /></p>
          </div>
          <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  )
}
