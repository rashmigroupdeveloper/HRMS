import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { FormError } from '@/components/FormError'
import { RunChecksSkeleton } from '@/components/skeletons/payroll/RunChecksSkeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { client, orpc } from '@/lib/orpc'
import { formatDateTime } from '@/lib/utils'
import { CHECK_COLUMNS, CHECK_WIDTHS, WARNING } from './payroll-labels'

type Item = Awaited<ReturnType<typeof client.payroll.checks.list>>['items'][number]
type Warning = Item['warning']
const keyOf = (i: { personId: number; warning: Warning }) => `${i.personId}:${i.warning}`

// A run's checks (payroll stage 5): every warning about its people must be acknowledged with a comment before the run is
// sent - several at once with one comment (e.g. every "No PAN" of the month). Once sent, the list is the acknowledgements
// made before (nothing is worked out again). Acknowledging: Payroll Edit over the whole company, never one's own pay
// (checked on the server too).
export function RunChecks({ runId, mayChange }: { runId: number; mayChange: boolean }) {
  const [kind, setKind] = useState<Warning | ''>('')
  const [openOnly, setOpenOnly] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [acknowledging, setAcknowledging] = useState(false)
  const query = useQuery(orpc.payroll.checks.list.queryOptions({ input: { runId } }))
  const data = query.data
  const kinds = useMemo(() => [...new Set((data?.items ?? []).map((i) => i.warning))], [data])
  const shown = (data?.items ?? []).filter((i) => (!kind || i.warning === kind) && (!openOnly || data?.frozen || !i.acknowledgement))
  // never one's own pay - a colleague acknowledges it (the server refuses it too)
  const pickable = data?.canAcknowledge ? shown.filter((i) => !i.own && (!i.acknowledgement || openOnly === false)) : []
  const allPicked = pickable.length > 0 && pickable.every((i) => picked.has(keyOf(i)))
  const toggle = (key: string, on: boolean) => setPicked((old) => { const next = new Set(old); if (on) next.add(key); else next.delete(key); return next })
  return (
    <section className="min-w-0 space-y-3 rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 space-y-1">
            <Label htmlFor="pc-kind" className="text-xs text-muted-foreground">Warning</Label>
            <NativeSelect id="pc-kind" className="w-full [&_select]:h-9 sm:[&_select]:h-8" value={kind} onChange={(e) => { setKind(e.target.value as Warning | ''); setPicked(new Set()) }}>
              <NativeSelectOption value="">Every warning</NativeSelectOption>
              {kinds.map((k) => <NativeSelectOption key={k} value={k}>{WARNING[k][0]} ({(data?.items ?? []).filter((i) => i.warning === k).length})</NativeSelectOption>)}
            </NativeSelect>
          </div>
          {!data?.frozen && (
            <label className="flex min-h-9 items-center gap-2 text-sm sm:min-h-8">
              <Checkbox checked={openOnly} onCheckedChange={(on) => { setOpenOnly(on === true); setPicked(new Set()) }} /> Not acknowledged only
            </label>
          )}
        </div>
        {(data ? data.canAcknowledge : mayChange) && (
          <Button className="min-h-9 gap-1.5 rounded-full" disabled={!data || !picked.size} onClick={() => setAcknowledging(true)}>
            <CheckCheck className="size-4" aria-hidden />Acknowledge{picked.size ? ` ${picked.size}` : ''}
          </Button>
        )}
      </div>
      {query.isPending && <Skeleton className="h-4 w-80 max-w-full" />}
      {data && <p className="text-xs text-muted-foreground">{data.frozen ? 'Acknowledged before the run was sent.' : data.total ? `${data.open} of ${data.total} not acknowledged. Every warning must be acknowledged before the run can be sent.` : ''}</p>}
      <FormError error={query.error} />
      {query.isPending ? <RunChecksSkeleton /> : data && (shown.length === 0 ? (
        <EmptyState className="py-6" title={data.total ? 'Nothing left to acknowledge' : 'No warnings'} hint={data.total ? 'Untick “Not acknowledged only” to see what was acknowledged.' : 'Nothing about this run’s people needs a look.'} />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Warnings" className="min-w-[720px] table-fixed text-[13px]">
            <TableHeader>
              <TableRow>
                {CHECK_COLUMNS.map((h, i) => (
                  <TableHead key={`${h}-${i}`} style={{ width: CHECK_WIDTHS[i] }} className="h-8 px-2 text-xs">
                    {i === 0 && pickable.length > 0 ? <Checkbox aria-label="Pick every warning shown" checked={allPicked} onCheckedChange={(on) => setPicked(on === true ? new Set(pickable.map(keyOf)) : new Set())} /> : h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((item) => (
                <TableRow key={keyOf(item)}>
                  <TableCell className="px-2 py-1.5 align-top">
                    {pickable.includes(item) && <Checkbox aria-label={`Pick ${WARNING[item.warning][0]} - ${item.name}`} checked={picked.has(keyOf(item))} onCheckedChange={(on) => toggle(keyOf(item), on === true)} />}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 align-top"><p className="font-medium">{item.name || item.employeeCode}</p><p className="text-xs text-muted-foreground">{item.employeeCode}</p></TableCell>
                  <TableCell className="px-2 py-1.5 align-top"><p>{WARNING[item.warning][0]}</p><p className="text-xs text-muted-foreground">{WARNING[item.warning][1]}</p></TableCell>
                  <TableCell className="px-2 py-1.5 align-top text-xs">
                    {item.acknowledgement ? (
                      <>
                        <p className="break-words">{item.acknowledgement.comment}</p>
                        <p className="text-muted-foreground">{item.acknowledgement.by?.name ?? ''} · {formatDateTime(item.acknowledgement.at)}</p>
                      </>
                    ) : <span className="text-warning-ink">{item.own && data.canAcknowledge ? 'Not yet · your own pay - a colleague acknowledges it' : 'Not yet'}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {acknowledging && <AcknowledgeDialog runId={runId} items={(data?.items ?? []).filter((i) => picked.has(keyOf(i)))} close={(done) => { setAcknowledging(false); if (done) setPicked(new Set()) }} />}
    </section>
  )
}

function AcknowledgeDialog({ runId, items, close }: { runId: number; items: Item[]; close: (done: boolean) => void }) {
  const [comment, setComment] = useState('')
  const queryClient = useQueryClient()
  const save = useMutation({
    ...orpc.payroll.checks.acknowledge.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.payroll.key() })
      close(true)
    },
  })
  const kinds = [...new Set(items.map((i) => i.warning))]
  return (
    <FormDialog onOpenChange={() => close(false)} dirty={comment.trim() !== '' && !save.isSuccess} className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Acknowledge {items.length} {items.length === 1 ? 'warning' : 'warnings'}</DialogTitle>
        <DialogDescription>{kinds.map((k) => WARNING[k][0]).join(', ')}. Say why it is fine, or what was done - the approvers see it.</DialogDescription>
      </DialogHeader>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (comment.trim().length >= 3) save.mutate({ runId, items: items.map((i) => ({ personId: i.personId, warning: i.warning })), comment: comment.trim() }) }}>
        <Label htmlFor="ack-comment">Comment</Label>
        <Textarea id="ack-comment" rows={3} placeholder="e.g. Bank details collected, to be entered this week" value={comment} onChange={(e) => setComment(e.target.value)} disabled={save.isPending} />
        <FormError error={save.error} />
        <DialogFooter>
          <DialogCancel />
          <Button type="submit" disabled={comment.trim().length < 3 || save.isPending}>{save.isPending ? 'Saving…' : 'Acknowledge'}</Button>
        </DialogFooter>
      </form>
    </FormDialog>
  )
}
