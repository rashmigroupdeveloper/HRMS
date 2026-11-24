import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TEAM_REPORT_COLUMNS, TEAM_REPORT_WIDTHS } from '@/pages/approvals/components/request-kinds'
import { cn } from '@/lib/utils'

export function TeamRequestsSkeleton({label}:{label:string}) {
  return <div role="status" aria-label={label} className="min-w-0">
    <Table className="min-w-[960px] table-fixed text-[13px]"><TableHeader><TableRow>{TEAM_REPORT_COLUMNS.map((h,i)=><TableHead key={h} style={{width:TEAM_REPORT_WIDTHS[i]}} className={cn('h-8 px-2 text-xs',i===0&&'sticky left-0 z-10 bg-card')}>{h}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{Array.from({length:5},(_,i)=><TableRow key={i} className="[&>td]:align-top">
        <TableCell className="sticky left-0 bg-card px-2 py-1.5"><Skeleton className="h-4 w-32 rounded-full"/><Skeleton className="mt-1 h-3 w-20 rounded-full"/></TableCell>
        <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-24 rounded-full"/><Skeleton className="mt-1 h-3 w-10 rounded-full"/></TableCell>
        <TableCell className="px-2 py-1.5"><Skeleton className="h-3 w-20 rounded-full"/><Skeleton className="mt-1 h-3 w-12 rounded-full"/></TableCell>
        <TableCell className="px-2 py-1.5"><Skeleton className="h-4 w-full rounded-full"/><Skeleton className="mt-1 h-4 w-4/5 rounded-full"/></TableCell>
        <TableCell className="px-2 py-1.5"><div className="flex min-h-9 items-center justify-between gap-2 sm:min-h-6"><Skeleton className="h-6 w-20 rounded-full"/><span className="text-xs text-muted-foreground">Details</span></div><Skeleton className="mt-1 h-3 w-36 rounded-full"/></TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </div>
}
