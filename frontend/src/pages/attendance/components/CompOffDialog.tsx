import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { orpc } from '@/lib/orpc'
import { formatDate } from '@/lib/utils'
import { compOffDays, hours, type MonthDay } from './labels'

// Claiming comp-off for work on a weekly off / holiday (the user, 2026-11-22): the day's punches decide (compOffDays).
// Approved by the manager, the comp-off is credited and used later like any leave; it expires 90 days after the day worked.

export function CompOffDialog({ day, onClose }: { day: MonthDay; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const claim = useMutation(
    orpc.leave.compOff.claim.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.leave.key() })
        onClose()
      },
    }),
  )
  const days = compOffDays(day.workedMinutes)
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!reason.trim()} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Claim comp-off</DialogTitle>
        <DialogDescription>Your manager approves it; then use it like any leave within 90 days.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
          {formatDate(day.date)} ({day.holiday ?? 'weekly off'}) · worked <strong>{hours(day.workedMinutes)}</strong>
          {day.inAt && ` (${day.inAt}–${day.outAt ?? '?'})`} → <strong>{days === 1 ? '1 day' : 'half a day'}</strong> comp-off
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="co-reason" className="text-xs text-muted-foreground">
            What was the work (required)
          </Label>
          <Textarea id="co-reason" className="rounded-xl" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. month-end stock count" />
        </div>
      </div>
      <FormError error={claim.error} />
      <DialogFooter>
        <DialogCancel />
        <Button variant="gold" disabled={reason.trim().length < 3 || claim.isPending} onClick={() => claim.mutate({ workDate: day.date, reason })}>
          {claim.isPending ? 'Sending…' : 'Send claim'}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
