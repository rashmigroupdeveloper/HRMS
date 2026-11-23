import { Users } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

// The team coverage warning (2026-11-22, the old HRMS's - a warning, never a block): the teammates (the same reporting
// manager) away on the days of a leave - in the apply dialog and on the Approvals page. Names and days only.
type Away = { employee: { employeeCode: string; name: string }; fromDate: Date; toDate: Date; fromSecondHalf: boolean; toFirstHalf: boolean; waiting: boolean }

const short = (d: Date) => formatDate(d).replace(/ \d{4}$/, '')
function days(a: Away) {
  const half = a.fromDate.getTime() === a.toDate.getTime() && (a.fromSecondHalf || a.toFirstHalf) ? ' ½' : ''
  return a.fromDate.getTime() === a.toDate.getTime() ? `${short(a.fromDate)}${half}` : `${short(a.fromDate)} – ${short(a.toDate)}`
}

export function TeamOffNote({ away, className }: { away: Away[]; className?: string }) {
  if (!away.length) return null
  return (
    <p className={cn('flex items-start gap-2 text-xs text-muted-foreground', className)}>
      <Users aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Also away from the team:{' '}
        {away.map((a, i) => (
          <span key={`${a.employee.employeeCode}-${i}`}>
            {i > 0 && ', '}
            <span className="font-medium text-foreground">{a.employee.name}</span> ({days(a)}
            {a.waiting && ', waiting'})
          </span>
        ))}
      </span>
    </p>
  )
}
