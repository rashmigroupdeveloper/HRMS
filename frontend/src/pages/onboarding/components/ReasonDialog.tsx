import { useState } from 'react'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// "Are you sure?" with a reason - used to close a candidate and to reject a document.
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  reasonLabel = 'Reason',
  reasonRequired,
  destructive,
  pending,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  reasonLabel?: string
  reasonRequired: boolean
  destructive?: boolean
  pending: boolean
  error: unknown
  onConfirm: (reason: string | undefined) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <FormDialog
      open={open}
      dirty={!!reason.trim()}
      className="rounded-3xl sm:max-w-md"
      onOpenChange={(next) => {
        if (!next) setReason('')
        onOpenChange(next)
      }}
    >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-xs text-muted-foreground">
            {reasonLabel}
            {reasonRequired ? <span className="text-negative-ink">*</span> : ' (optional)'}
          </Label>
          <Textarea id="reason" className="rounded-xl" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <FormError error={error} />
        <DialogFooter>
          <DialogCancel />
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending || (reasonRequired && !reason.trim())}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {pending ? 'Saving…' : confirmLabel}
          </Button>
        </DialogFooter>
    </FormDialog>
  )
}
