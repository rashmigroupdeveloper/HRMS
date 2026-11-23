import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Asks before a step that removes or undoes something (a lay off entered by mistake, a planned job change, a joining task
// marked done) - no input to lose, so a plain dialog. Used by several features.
export function ConfirmDialog({
  title,
  description,
  confirm,
  pending,
  onConfirm,
  onClose,
}: {
  title: string
  description?: string
  confirm: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="secondary" />}>Keep it</DialogClose>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
