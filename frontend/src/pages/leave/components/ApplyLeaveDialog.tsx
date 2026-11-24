import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { TeamOffNote } from '@/components/TeamOffNote'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { orpc } from '@/lib/orpc'
import { cn, fromDateInput, toDateInput, todayDay } from '@/lib/utils'
import { type Balance, daysText, timingRules } from './labels'

// Applying for leave (2026-11-22): the type (with what is available), the days - the first day from its second half, the
// last day to its first half - and the reason. While it is filled in, the backend counts the days by the attendance plan
// (weekly offs and holidays out, unless the type counts them) and says what would stop it - before anything is sent.
// Approved through the leave approval chain (the reporting manager first).
// `initialDate`: the day it opens on (an on-application holiday's Apply on My leave - 2026-11-24), else today
export function ApplyLeaveDialog({ balances, initialTypeId, initialDate, onClose }: { balances: Balance[]; initialTypeId?: number; initialDate?: Date; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [start] = useState(() => toDateInput(initialDate ?? todayDay()))
  const [typeId, setTypeId] = useState(initialTypeId ? String(initialTypeId) : '')
  const [from, setFrom] = useState(start)
  const [to, setTo] = useState(start)
  const [fromSecondHalf, setFromSecondHalf] = useState(false)
  const [toFirstHalf, setToFirstHalf] = useState(false)
  const [reason, setReason] = useState('')
  const type = balances.find((b) => String(b.leaveType.id) === typeId)
  // when the type may be applied for (2026-11-24): its notice, today or past only, how far back - also the dates offered
  const types = useQuery(orpc.leave.types.list.queryOptions({ input: {} }))
  const rules = types.data?.find((t) => String(t.id) === typeId)
  const plusDays = (n: number) => toDateInput(new Date(todayDay().getTime() + n * 86_400_000))
  const earliest = rules?.maxDaysBack != null ? plusDays(-rules.maxDaysBack) : rules?.noticeDays ? plusDays(rules.noticeDays) : undefined
  const latest = rules?.todayOrPastOnly ? start : undefined
  const oneDay = from === to
  const halves = { fromSecondHalf: type?.leaveType.allowHalfDay ? fromSecondHalf : false, toFirstHalf: type?.leaveType.allowHalfDay && !(oneDay && fromSecondHalf) ? toFirstHalf : false }
  const input = typeId && from && to && to >= from ? { leaveTypeId: Number(typeId), fromDate: fromDateInput(from)!, toDate: fromDateInput(to)!, ...halves } : null
  const preview = useQuery({ ...orpc.leave.applications.preview.queryOptions({ input: input! }), enabled: !!input, placeholderData: keepPreviousData })
  const apply = useMutation(
    orpc.leave.applications.apply.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.leave.key() })
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
        onClose()
      },
    }),
  )
  const dirty = typeId !== (initialTypeId ? String(initialTypeId) : '') || from !== start || to !== start || fromSecondHalf || toFirstHalf || !!reason.trim()
  const p = input ? preview.data : undefined
  const ready = !!input && !!p && !preview.isFetching && p.problems.length === 0 && p.days > 0 && reason.trim().length >= 3

  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Apply for leave</DialogTitle>
        <DialogDescription>Your manager approves it. Weekly offs and holidays inside the leave are not counted (except for leave that counts them).</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="lv-type" className="text-xs text-muted-foreground">
            Leave
          </Label>
          <NativeSelect id="lv-type" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <NativeSelectOption value="">Choose…</NativeSelectOption>
            {balances.map((b) => (
              <NativeSelectOption key={b.leaveType.id} value={String(b.leaveType.id)}>
                {b.leaveType.name} ({b.leaveType.code}){b.available !== null ? ` - ${b.available} available` : ' - unpaid'}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lv-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="lv-from"
              type="date"
              min={rules?.noticeDays ? plusDays(rules.noticeDays) : earliest}
              max={latest}
              className="h-10 rounded-xl"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                if (!to || e.target.value > to) setTo(e.target.value)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lv-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id="lv-to" type="date" min={from} max={latest} className="h-10 rounded-xl" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {rules && timingRules(rules).length > 0 && <p className="text-xs text-muted-foreground">{rules.name}: {timingRules(rules).join(' · ')}.</p>}
        {/* half days, when the type has them */}
        {type?.leaveType.allowHalfDay && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={fromSecondHalf} onCheckedChange={(v) => setFromSecondHalf(v === true)} />
              {oneDay ? 'Second half only' : 'First day from the second half'}
            </label>
            {!(oneDay && fromSecondHalf) && (
              <label className="flex items-center gap-2">
                <Checkbox checked={toFirstHalf} onCheckedChange={(v) => setToFirstHalf(v === true)} />
                {oneDay ? 'First half only' : 'Last day to the first half'}
              </label>
            )}
          </div>
        )}
        {/* what it takes - counted by the backend */}
        {input && (
          <div className={cn('rounded-xl px-3 py-2 text-sm', p?.problems.length ? 'bg-warning/15 text-warning-ink' : 'bg-surface-2/60')} aria-live="polite">
            {!p ? (
              <span className="text-muted-foreground">Counting the days…</span>
            ) : p.problems.length ? (
              p.problems.map((problem) => <p key={problem}>{problem}</p>)
            ) : (
              <p>
                Takes <strong>{daysText(p.days)}</strong>
                {p.available !== null && (
                  <>
                    {' '}
                    · {p.available} available → <strong>{p.after}</strong> left
                  </>
                )}
              </p>
            )}
          </div>
        )}
        {/* who of the team is away then (a warning only) */}
        {p && <TeamOffNote away={p.teamOff} />}
        <div className="space-y-1.5">
          <Label htmlFor="lv-reason" className="text-xs text-muted-foreground">
            Why (required)
          </Label>
          <Textarea id="lv-reason" className="rounded-xl" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. a family function" />
        </div>
      </div>
      <FormError error={apply.error ?? preview.error} />
      <DialogFooter>
        <DialogCancel />
        <Button variant="gold" disabled={!ready || apply.isPending} onClick={() => input && apply.mutate({ ...input, reason })}>
          {apply.isPending ? 'Sending…' : 'Apply'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
