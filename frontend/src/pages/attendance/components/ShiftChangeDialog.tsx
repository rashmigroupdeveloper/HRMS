import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { EmployeePicker, type PickedEmployee } from '@/components/EmployeePicker'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { orpc } from '@/lib/orpc'
import { cn, fromDateInput, toDateInput } from '@/lib/utils'
import { todayDay } from './labels'

// Asking for a shift change on one day: another shift (or off), or a swap with a colleague. The manager approves, then
// HR; only then does the roster change.
export function ShiftChangeDialog({ initialDate, onClose, onSent }: { initialDate?: Date; onClose: () => void; onSent?: (message: string) => void }) {
  const queryClient = useQueryClient()
  const shifts = useQuery(orpc.attendance.shifts.list.queryOptions({ input: {} }))
  const [startDate] = useState(() => toDateInput(initialDate && initialDate >= todayDay() ? initialDate : todayDay()))
  const [date, setDate] = useState(startDate)
  const [kind, setKind] = useState<'CHANGE' | 'SWAP'>('CHANGE')
  const [shift, setShift] = useState('')
  const [colleague, setColleague] = useState<PickedEmployee | null>(null)
  const [reason, setReason] = useState('')
  const create = useMutation(
    orpc.attendance.shiftChanges.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.attendance.key() })
        onSent?.('Shift change sent. It is with your manager.')
        onClose()
      },
    }),
  )
  const dirty = date !== startDate || kind !== 'CHANGE' || shift !== '' || !!colleague || !!reason.trim()
  const ready = !!date && reason.trim().length >= 3 && (kind === 'CHANGE' ? shift !== '' : !!colleague)
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={dirty} className="attendance-request-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask for a shift change</DialogTitle>
          <DialogDescription>Your manager approves it, then HR. Your roster changes once both have approved.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-0.5 rounded-full bg-surface-2 p-0.5">
            {(
              [
                ['CHANGE', 'Change my shift'],
                ['SWAP', 'Swap with a colleague'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={cn('rounded-full px-3 py-2.5 text-xs leading-4 font-medium sm:py-1.5', kind === value ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-date" className="text-xs text-muted-foreground">
              Day
            </Label>
            <Input id="sc-date" type="date" min={toDateInput(todayDay())} className="h-10 rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {kind === 'CHANGE' ? (
            <div className="space-y-1.5">
              <Label htmlFor="sc-shift" className="text-xs text-muted-foreground">
                Work this shift instead
              </Label>
              <NativeSelect id="sc-shift" className="w-full [&_select]:h-10 [&_select]:rounded-xl" value={shift} onChange={(e) => setShift(e.target.value)}>
                <NativeSelectOption value="">Choose…</NativeSelectOption>
                <NativeSelectOption value="off">Off (no work that day)</NativeSelectOption>
                {shifts.data?.map((s) => (
                  <NativeSelectOption key={s.id} value={String(s.id)}>
                    {s.name} ({s.start}–{s.end})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sc-colleague" className="text-xs text-muted-foreground">
                Swap my shift that day with
              </Label>
              <EmployeePicker id="sc-colleague" value={colleague?.employeeCode ?? ''} onChange={setColleague} placeholder="Type a colleague's name or code" />
              <p className="text-xs text-muted-foreground">They are told; both days change once approved.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="sc-reason" className="text-xs text-muted-foreground">
              Why
            </Label>
            <Textarea id="sc-reason" className="rounded-xl" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. covering for a colleague on leave" />
          </div>
        </div>
        <FormError error={create.error} />
        <DialogFooter>
          <DialogCancel />
          <Button
            variant="gold"
            disabled={!ready || create.isPending}
            onClick={() =>
              create.mutate({
                date: fromDateInput(date)!,
                kind,
                reason,
                ...(kind === 'CHANGE' ? { requestedShiftId: shift === 'off' ? null : Number(shift) } : { swapWithCode: colleague!.employeeCode }),
              })
            }
          >
            {create.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}
