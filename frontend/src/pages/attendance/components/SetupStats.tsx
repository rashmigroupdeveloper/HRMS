import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { orpc } from '@/lib/orpc'
import { SETUP_ICONS } from './labels'

// The headline numbers of the attendance setup (the setup's redesign, 2026-11-25): how many shifts, schedule patterns,
// policies and holiday lists are in use - big light numbers, each opening its part. The same queries as the parts
// themselves (the same input), so a part opened next is already loaded. Every list here is shared by every company or
// listed for every company, so the numbers are the same for every viewer of the setup.
export function SetupStats() {
  const [, setParams] = useSearchParams()
  const shifts = useQuery(orpc.attendance.shifts.list.queryOptions({ input: { includeInactive: true } }))
  const patterns = useQuery(orpc.attendance.shifts.patterns.list.queryOptions({ input: { includeInactive: true } }))
  const policies = useQuery(orpc.attendance.policies.list.queryOptions({ input: { includeInactive: true } }))
  const lists = useQuery(orpc.attendance.holidayLists.list.queryOptions({ input: { includeInactive: true } }))
  // the number in use; '—' when the list failed to load (the part itself shows the error)
  const active = (q: { data?: { isActive: boolean }[]; isError: boolean }) => (q.isError ? '—' : q.data?.filter((x) => x.isActive).length)
  const stats = [
    ['shifts', 'Shifts', active(shifts)],
    ['patterns', 'Patterns', active(patterns)],
    ['policies', 'Policies', active(policies)],
    ['holidays', 'Holiday lists', active(lists)],
  ] as const
  return (
    <div className="flex items-end gap-6 max-md:hidden">
      {stats.map(([part, label, value]) => {
        const Icon = SETUP_ICONS[part]
        return (
          <button key={part} type="button" onClick={() => setParams({ part }, { replace: true })} className="group flex flex-col items-start rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="flex h-12 items-center text-5xl leading-none font-extralight tracking-tight tabular-nums group-hover:text-foreground/80">
              {value === undefined ? <Skeleton className="h-9 w-10 rounded-xl" /> : value}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground">
              <Icon aria-hidden className="size-3.5" />
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
