import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { segment, SEGMENTS } from '@/pages/attendance/components/labels'

// Loading placeholder for the Team attendance page below its title, while it works out which views the viewer has: the
// views' switch (bars - they depend on the team sizes), then the day board.
export function TeamAttendanceSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <div className={SEGMENTS}>
        {['w-24', 'w-32', 'w-16'].map((w) => (
          <span key={w} className="flex-none px-3 py-2.5 sm:py-1.5">
            <Skeleton className={`h-4 rounded-full ${w}`} />
          </span>
        ))}
      </div>
      <BoardSkeleton />
    </div>
  )
}

// PeopleView's card with its day board (change both together)
function BoardSkeleton() {
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className={`${SEGMENTS} mr-auto`}>
          <span className={segment(true)}>Day board</span>
          <span className={segment(false)}>Month muster</span>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <div className="relative col-span-2">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 w-full rounded-full pl-9 sm:w-56" placeholder="Name or employee code" disabled />
          </div>
          <Skeleton className="col-span-2 h-9 rounded-full sm:w-40" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-64 max-w-full rounded-full" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="hidden min-w-24 sm:table-cell">Shift</TableHead>
              <TableHead className="hidden min-w-28 text-right sm:table-cell">In</TableHead>
              <TableHead className="hidden min-w-20 text-right sm:table-cell">Out</TableHead>
              <TableHead className="hidden min-w-24 text-right sm:table-cell">Worked</TableHead>
              <TableHead className="text-right sm:min-w-40">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }, (_, i) => (
              <TableRow key={i}>
                <TableCell className="space-y-1.5">
                  <Skeleton className="h-3.5 w-36 rounded-full" />
                  <Skeleton className="h-3 w-24 rounded-full" />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Skeleton className="h-3 w-10 rounded-full" />
                </TableCell>
                {['w-10', 'w-10', 'w-12'].map((w, j) => (
                  <TableCell key={j} className="hidden sm:table-cell">
                    <Skeleton className={`ml-auto h-3.5 rounded-full ${w}`} />
                  </TableCell>
                ))}
                <TableCell>
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
