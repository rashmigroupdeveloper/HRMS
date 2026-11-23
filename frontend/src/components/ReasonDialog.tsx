import { useState } from 'react'
import { DialogCancel, FormDialog } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// Asks for a reason before a step (rejecting an approval, cancelling a request - 2026-11-20); `required`: the step needs
// one. The reason is sent to `onConfirm` (empty -> undefined).
export function ReasonDialog({
  title,
  description,
  label,
  confirm,
  required = false,
  destructive = true,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string
  description?: string
  label: string
  confirm: string
  required?: boolean
  destructive?: boolean
  pending?: boolean
  error?: string | null
  onConfirm: (reason: string | undefined) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <FormDialog onOpenChange={(open) => !open && onClose()} dirty={!!reason.trim()} className="rounded-3xl sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-1">
        <label htmlFor="reason-text" className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <Textarea id="reason-text" className="rounded-xl" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p className="text-sm text-negative-ink">{error}</p>}
      <DialogFooter>
        <DialogCancel />
        <Button variant={destructive ? 'destructive' : 'gold'} disabled={pending || (required && !reason.trim())} onClick={() => onConfirm(reason.trim() || undefined)}>
          {pending ? 'Saving…' : confirm}
        </Button>
      </DialogFooter>
    </FormDialog>
  )
}
