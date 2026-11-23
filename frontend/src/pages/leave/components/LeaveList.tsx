import { Pill } from '@/components/Pill'
import { cn } from '@/lib/utils'
import { type Application, daysText, LEAVE_STATUS, spanText } from './labels'

// Leave applications as compact rows: (whose -) the type, the days, the reason and where its approval stands (who has it
// now), the status; `actions(a)`: what the viewer can do on one (withdraw, cancel). Also drawn by LeaveRowsSkeleton.
export function LeaveList({ rows, showEmployee = false, actions }: { rows: Application[]; showEmployee?: boolean; actions?: (a: Application) => React.ReactNode }) {
  return (
    <ul className="divide-y">
      {rows.map((a) => {
        const step = a.status === 'PENDING' ? a.approval?.step : a.cancelRequest?.status === 'PENDING' ? a.cancelRequest.step : null
        const held = a.status === 'PENDING' ? a.approval?.held : a.cancelRequest?.status === 'PENDING' ? a.cancelRequest.held : null
        return (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
            {/* (basis: on a phone the status wraps under the text instead of squeezing it) */}
            <div className="min-w-0 flex-1 basis-60">
              <p className="flex flex-wrap items-baseline gap-x-2">
                {showEmployee && <span className="font-medium">{a.employee.name}</span>}
                <span className={cn('font-semibold', showEmployee && 'text-xs')}>{a.leaveType.code}</span>
                <span className={cn(!showEmployee && 'font-medium')}>{spanText(a)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{daysText(a.days)}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {a.reason}
                {a.cancelRequest?.status === 'PENDING' && ' · asked to cancel'}
                {step && ` · step ${step.stepNo} of ${step.of}: with ${step.approver?.name ?? step.who}`}
                {held && <span className="text-warning-ink"> · held: {held}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={LEAVE_STATUS[a.status].tone}>{LEAVE_STATUS[a.status].label}</Pill>
              {actions?.(a)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
