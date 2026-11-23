import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { orpc } from '@/lib/orpc'
import { cn, fromDateInput, toDateInput } from '@/lib/utils'
import { todayDay } from './labels'

// Asking for a missed punch to count as present (days already come, up to 30 days back), or to be marked on official duty
// outside the office (days to come too) - the whole day(s) or one half of a single day. Approved through the approval chain
// (2026-11-22, the old HRMS's regularisation and on duty).

type Kind = 'MISSED_PUNCH' | 'ON_DUTY'
type Portion = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'
const DAYS_BACK = 30
const KINDS: [Kind, string][] = [
  ['MISSED_PUNCH', 'Missed punch'],
  ['ON_DUTY', 'On duty'],
]
const PORTIONS: [Portion, string][] = [
  ['FULL_DAY', 'Whole day'],
  ['FIRST_HALF', 'First half'],
  ['SECOND_HALF', 'Second half'],
]
// the small segmented control of the dialog (as the shift-change dialog's)
const chip = (active: boolean) =>
  cn('rounded-full px-3 py-2.5 text-xs leading-4 font-medium sm:py-1.5', active ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')

export function RegularizationDialog({ initialDate, onClose }: { initialDate?: Date; onClose: () => void }) {
  const queryClient = useQueryClient()
  const today = todayDay()
  const start = initialDate ?? today
  const [initialKind] = useState<Kind>(start > today ? 'ON_DUTY' : 'MISSED_PUNCH')
  const [kind, setKind] = useState<Kind>(initialKind)
  const [from, setFrom] = useState(toDateInput(start))
  const [to, setTo] = useState(toDateInput(start))
  const [portion, setPortion] = useState<Portion>('FULL_DAY')
  const [reason, setReason] = useState('')
  const create = useMutation(
    orpc.attendance.regularizations.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
        onClose()
      },
    }),
  )
  const oneDay = from === to
  const min = toDateInput(new Date(today.getTime() - DAYS_BACK * 86_400_000))
  const max = kind === 'MISSED_PUNCH' ? toDateInput(today) : undefined
  const dirty = kind !== initialKind || from !== toDateInput(start) || to !== toDateInput(start) || portion !== 'FULL_DAY' || !!reason.trim()
  const ready = !!from && !!to && to >= from && reason.trim().length >= 5
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Regularize / on duty</DialogTitle>
        <DialogDescription>
          {kind === 'MISSED_PUNCH'
            ? 'A day you worked but a punch is missing - it counts as present once your manager approves.'
            : 'Work outside the office (a client, another site, travel) - the days show as on duty once your manager approves.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-0.5 rounded-full bg-surface-2 p-0.5">
          {KINDS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={chip(kind === value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rg-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="rg-from"
              type="date"
              min={min}
              max={max}
              className="h-10 rounded-xl"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                if (!to || e.target.value > to) setTo(e.target.value)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id="rg-to" type="date" min={from || min} max={max} className="h-10 rounded-xl" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {/* a half only for one day */}
        {oneDay && (
          <div className="grid grid-cols-3 gap-0.5 rounded-full bg-surface-2 p-0.5">
            {PORTIONS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={portion === value} onClick={() => setPortion(value)} className={chip(portion === value)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="rg-reason" className="text-xs text-muted-foreground">
            Why (required)
          </Label>
          <Textarea
            id="rg-reason"
            className="rounded-xl"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={kind === 'MISSED_PUNCH' ? 'e.g. forgot my ID card, came in at 09:05' : 'e.g. client visit at the Pune plant'}
          />
        </div>
      </div>
      <FormError error={create.error} />
      <DialogFooter>
        <DialogCancel />
        <Button
          variant="gold"
          disabled={!ready || create.isPending}
          onClick={() => create.mutate({ kind, fromDate: fromDateInput(from)!, toDate: fromDateInput(to)!, portion: oneDay ? portion : 'FULL_DAY', reason })}
        >
          {create.isPending ? 'Sending…' : 'Send request'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
