import { useQuery } from '@tanstack/react-query'
import { FormDialog, DialogCancel } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { PayrollRunSkeleton } from '@/components/skeletons/payroll/PayrollRunSkeleton'
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { formatDate } from '@/lib/utils'
import { RUN_DETAIL_LABELS } from './payroll-labels'

export function PayrollRunDialog({ id, close }: { id: number; close: () => void }) {
  const query = useQuery(orpc.payroll.get.queryOptions({ input: { id } }))
  const r = query.data
  const values = r ? [`${r.company.code} · ${r.company.name}`, new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(r.payMonth), `${formatDate(r.attendanceFrom)} – ${formatDate(r.attendanceTo)}`, 'Draft', formatDate(r.createdAt), r.createdBy ? `${r.createdBy.name} (${r.createdBy.employeeCode})` : 'System'] : []
  return <FormDialog onOpenChange={close} className="sm:max-w-xl">
    <DialogHeader><DialogTitle>Payroll run</DialogTitle><DialogDescription>Regular monthly draft. Attendance dates stay as captured at creation.</DialogDescription></DialogHeader>
    {query.isPending ? <PayrollRunSkeleton /> : r ? <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{RUN_DETAIL_LABELS.map((label, i) => <div className="min-w-0 space-y-1" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{values[i]}</dd></div>)}</dl> : <FormError error={query.error} />}
    <DialogFooter>{query.isError && <Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}<DialogCancel>Close</DialogCancel></DialogFooter>
  </FormDialog>
}
