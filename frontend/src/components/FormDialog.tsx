import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// A small centred dialog with a form in it (a reason, a note, a shift, a holiday...) - the same rule as FormDrawer
// (2026-11-17): a click outside does NOT close it, so typed input is never lost by accident; closing with X / Esc /
// Cancel asks "Discard your changes?" first (in place of the buttons) when the form is `dirty`.
// Use it instead of <Dialog><DialogContent> for any dialog that has inputs; use <DialogCancel /> for its Cancel button.
// Plain confirmations ("Remove this?") with no input can stay a normal Dialog.

export function FormDialog({
  open = true,
  onOpenChange,
  dirty = false,
  className,
  children,
}: {
  open?: boolean
  // called with false to close - after the discard check
  onOpenChange: (open: boolean) => void
  // the form has unsaved input - closing asks first
  dirty?: boolean
  // for the popup (width, rounding)
  className?: string
  children: React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const close = () => {
    setConfirming(false)
    onOpenChange(false)
  }
  return (
    <Dialog open={open} disablePointerDismissal onOpenChange={(next) => (next ? onOpenChange(true) : dirty ? setConfirming(true) : close())}>
      {/* while asking, the form's own buttons are hidden - the question takes their place */}
      <DialogContent className={cn(className, confirming && '[&_[data-slot=dialog-footer]]:hidden')}>
        {children}
        {confirming && (
          <div role="alertdialog" aria-label="Discard changes" className="-mx-4 -mb-4 flex flex-wrap items-center justify-between gap-3 rounded-b-[inherit] border-t bg-gold-soft p-4">
            <p className="text-sm font-medium">Discard your changes?</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Keep editing
              </Button>
              <Button variant="destructive" onClick={close}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Cancel button for a FormDialog: closes it the same way as X (with the discard check)
export function DialogCancel({ children = 'Cancel', disabled }: { children?: React.ReactNode; disabled?: boolean }) {
  return (
    // type="button": inside a <form> it must not submit it
    <DialogClose disabled={disabled} render={<Button type="button" variant="secondary" />}>
      {children}
    </DialogClose>
  )
}
