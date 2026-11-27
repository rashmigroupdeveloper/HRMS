import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { REACH, segment, SEGMENTS } from '@/pages/attendance/components/labels'
import { DayBoardSkeleton } from './DayBoardSkeleton'

// Loading placeholder for the Team attendance page below its title, while it works out which views the viewer has: the
// views' switch (bars - they depend on the team sizes), then the day board. `team`: the team view is the one opening (its
// "Direct reports / Everyone under me" switch shows).
export function TeamAttendanceSkeleton({ label = 'Loading', team = false }: { label?: string; team?: boolean }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <div className={SEGMENTS}>
        {['w-24', 'w-32', 'w-16'].map((w) => (
          <span key={w} className="flex-none px-3 py-2.5 sm:py-1.5">
            <Skeleton className={`h-4 rounded-full ${w}`} />
          </span>
        ))}
      </div>
      <BoardSkeleton team={team} />
    </div>
  )
}

// PeopleView's card with its day board (change both together)
function BoardSkeleton({ team }: { team: boolean }) {
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className={`${SEGMENTS} mr-auto`}>
          <span className={segment(true)}>Day board</span>
          <span className={segment(false)}>Month muster</span>
        </div>
        {team && (
          <div className={SEGMENTS}>
            {REACH.map(([value, label], i) => (
              <span key={value} className={segment(i === 0)}>
                {label}
              </span>
            ))}
          </div>
        )}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <div className="relative col-span-2">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 w-full rounded-full pl-9 sm:w-56" placeholder="Name or employee code" disabled />
          </div>
          <Skeleton className="col-span-2 h-9 rounded-full sm:w-40" />
        </div>
      </div>
      <DayBoardSkeleton />
    </section>
  )
}
