import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormError'
import { RunInputsSkeleton } from '@/components/skeletons/payroll/RunInputsSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { client, orpc } from '@/lib/orpc'
import { cn, formatDoneBy, formatMoney } from '@/lib/utils'
import { InputDrawer } from './InputDrawer'
import { INPUT_COLUMNS, INPUT_WIDTHS } from './payroll-labels'

const PAGE = 50
type Row = Awaited<ReturnType<typeof client.payroll.inputs.list>>['items'][number]

// The month's inputs of a run - added, changed and removed only while it is a draft, by someone with Payroll Edit over
// the whole company, never for oneself (checked on the server too)
export function RunInputs({ runId, canChange }: { runId: number; canChange: boolean }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)
  const deferred = useDeferredValue(search.trim())
  const queryClient = useQueryClient()
  const query = useQuery({ ...orpc.payroll.inputs.list.queryOptions({ input: { runId, search: deferred || undefined, page, pageSize: PAGE } }), placeholderData: keepPreviousData })
  const remove = useMutation({
    ...orpc.payroll.inputs.delete.mutationOptions(),
    onSuccess: () => { setRemoving(null); void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() }) },
  })
  const data = query.data
  const stale = query.isFetching || search.trim() !== deferred
  return (
    <section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-40 flex-1 space-y-1 sm:max-w-64">
          <Label htmlFor="pi-search" className="text-xs text-muted-foreground">Employee</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
            <Input id="pi-search" className="h-9 pl-8 sm:h-8" placeholder="Code or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
        {canChange && <Button className="min-h-9 gap-1.5 rounded-full" onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add input</Button>}
      </div>
      <FormError error={query.error ?? remove.error} />
      {query.isPending ? <RunInputsSkeleton /> : data && (data.total === 0 ? (
        <EmptyState className="py-6" title={deferred ? 'Nothing matches' : 'No inputs yet'} hint={deferred ? 'Try another name or code.' : 'Incentives, canteen and other amounts for this month only are entered here.'} />
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', stale && 'opacity-50')}>
          <Table aria-label="Inputs of the run" className="min-w-[760px] table-fixed text-[13px]">
            <TableHeader>
              <TableRow>{INPUT_COLUMNS.map((h, i) => <TableHead key={`${h}-${i}`} style={{ width: INPUT_WIDTHS[i] }} className="h-8 px-2 text-xs">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.id} className="[&>td]:align-top">
                  <TableCell className="px-2 py-1.5"><p className="font-medium">{r.person.name || r.person.employeeCode}</p><p className="text-xs text-muted-foreground">{r.person.employeeCode}</p></TableCell>
                  <TableCell className="px-2 py-1.5"><p>{r.salaryComponent.name}</p><p className="text-xs text-muted-foreground">{r.salaryComponent.kind === 'DEDUCTION' ? 'Deduction' : 'Earning'}</p></TableCell>
                  <TableCell className={cn('px-2 py-1.5 tabular-nums', r.salaryComponent.kind === 'DEDUCTION' && 'text-negative-ink')}>{r.salaryComponent.kind === 'DEDUCTION' ? '−' : ''}{formatMoney(r.amount, 'INR')}</TableCell>
                  <TableCell className="whitespace-normal break-words px-2 py-1.5">{r.note}</TableCell>
                  <TableCell className="whitespace-normal px-2 py-1.5 text-xs text-muted-foreground">{formatDoneBy(r.updatedAt, r.updatedBy)}</TableCell>
                  <TableCell className="px-1 py-1 text-right">
                    {canChange && (
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Change input for ${r.person.employeeCode}`} onClick={() => setEditing(r)}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove input for ${r.person.employeeCode}`} onClick={() => setRemoving(r)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {data && data.total > PAGE && (
        <nav aria-label="Input pages" className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, data.total)} of {data.total}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page <= 1 || stale} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden />Previous</Button>
            <Button size="sm" variant="secondary" className="min-h-9 rounded-full" disabled={page * PAGE >= data.total || stale} onClick={() => setPage(page + 1)}>Next<ChevronRight aria-hidden /></Button>
          </div>
        </nav>
      )}
      {editing && (
        <InputDrawer
          runId={runId}
          existing={editing === 'new' ? undefined : { id: editing.id, person: editing.person, salaryComponentId: editing.salaryComponent.id, amount: editing.amount, note: editing.note }}
          close={() => setEditing(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove this input?"
          description={`${removing.salaryComponent.name} of ${formatMoney(removing.amount, 'INR')} for ${removing.person.name || removing.person.employeeCode}. The removal is kept in the change history.`}
          confirm={remove.isPending ? 'Removing…' : 'Remove'}
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ runId, id: removing.id })}
          onClose={() => { if (!remove.isPending) setRemoving(null) }}
        />
      )}
    </section>
  )
}
