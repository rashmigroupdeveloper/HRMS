import { Search } from 'lucide-react'
import { TEAM_LEAVE_PARTS } from '@/pages/leave/components/labels'
import { segment, SEGMENTS } from '@/pages/attendance/components/labels'
import { LeaveRowsSkeleton } from './LeaveRowsSkeleton'

// Loading placeholder for the Team leave page while it learns which views the viewer has: the part switch (the real names
// - "Leave types" only shows for Leave View, so it is left out) and the leave list's card: its real filters and rows.
// (The status choices are TeamLeaveList's STATUSES - change both together.)
export function TeamLeaveSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <div className={SEGMENTS}>
        {TEAM_LEAVE_PARTS.filter(([value]) => value !== 'types' && value !== 'recount').map(([value, text], i) => (
          <span key={value} className={segment(i === 0)}>
            {text}
          </span>
        ))}
      </div>
      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        {/* the list's real filters (usable once the page knows the views - they need no data) */}
        <div className="flex flex-wrap items-end gap-3">
          {['From', 'To'].map((label) => (
            <div key={label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <div className="h-9 w-36 rounded-xl border border-input sm:w-40" />
            </div>
          ))}
          <div className="relative h-9 min-w-44 flex-1 rounded-xl border border-input sm:max-w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className={SEGMENTS}>
            {['Waiting & approved', 'Waiting', 'Every status'].map((text, i) => (
              <span key={text} className={segment(i === 0)}>
                {text}
              </span>
            ))}
          </div>
        </div>
        <LeaveRowsSkeleton showEmployee rows={4} />
      </section>
    </div>
  )
}
