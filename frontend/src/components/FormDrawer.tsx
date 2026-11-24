import { XIcon } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// Where every add / edit form opens - as in the old HRMS: a panel sliding in from the right, floating 12px from the
// screen edges with rounded corners; a bottom sheet on phones. Title + close on top, the form scrolls, the buttons
// stay at the bottom. (Confirmations stay small centred dialogs.)
// - It slides in and out with the iOS sheet curve (out a little faster than in).
// - A click outside does NOT close it, so a half-filled form is never lost by accident. Closing with X / Esc /
//   Cancel asks "Discard your changes?" first when the form is `dirty`.
// - Render it when the form opens; `onClose` runs after the slide-out (unmount it there). To close after saving,
//   set `closed` - it slides out, then calls `onClose`.

const PHONE = '(max-width: 639px)'
function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
function useIsPhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false)
}

// The iOS sheet curve; leaving uses a quick ease-in
const MOTION =
  'duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:duration-[280ms] data-ending-style:ease-[cubic-bezier(0.4,0,1,1)] data-starting-style:opacity-100 data-ending-style:opacity-100 motion-reduce:duration-0'

export function FormDrawer({
  onClose,
  closed = false,
  dirty = false,
  title,
  description,
  footer,
  width = 460,
  bodyClassName,
  children,
}: {
  // runs after the drawer has slid out
  onClose: () => void
  // true = close now (e.g. after a successful save), with the slide-out
  closed?: boolean
  // the form has unsaved input - closing asks first
  dirty?: boolean
  title: React.ReactNode
  description?: React.ReactNode
  // the buttons (use <DrawerCancel /> for Cancel), kept visible at the bottom
  footer?: React.ReactNode
  // desktop width in px (wide forms: 640-720)
  width?: number
  // extra classes for the scrolling body (e.g. a tinted background behind section cards)
  bodyClassName?: string
  children?: React.ReactNode
}) {
  const phone = useIsPhone()
  // starts closed and opens on the next frame - the slide-in only plays on a closed -> open change
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOpen(true)
      setOpened(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  const [confirming, setConfirming] = useState(false)
  const requestClose = () => (dirty ? setConfirming(true) : setOpen(false))

  return (
    <Sheet
      open={open && !closed}
      disablePointerDismissal
      onOpenChange={(next) => !next && requestClose()}
      // only after it has been open (not for the closed first frame)
      onOpenChangeComplete={(isOpen) => !isOpen && opened && onClose()}
    >
      <SheetContent
        side={phone ? 'bottom' : 'right'}
        showCloseButton={false}
        className={cn(
          'gap-0 overflow-hidden bg-card p-0 shadow-float will-change-transform',
          MOTION,
          phone
            ? 'max-h-[92dvh] rounded-t-3xl data-[side=bottom]:border-t-0 data-[side=bottom]:data-starting-style:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full'
            : 'rounded-3xl data-[side=right]:inset-y-3 data-[side=right]:right-3 data-[side=right]:h-auto data-[side=right]:border-l-0 data-[side=right]:sm:max-w-none data-[side=right]:data-starting-style:translate-x-[calc(100%+24px)] data-[side=right]:data-ending-style:translate-x-[calc(100%+24px)]',
        )}
        style={phone ? undefined : { width: `min(${width}px, calc(100vw - 24px))` }}
      >
        {phone && <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-border" />}
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <SheetTitle className="text-2xl font-light tracking-tight">{title}</SheetTitle>
            {description && <SheetDescription className="mt-1">{description}</SheetDescription>}
          </div>
          <SheetClose render={<Button variant="ghost" size="icon" />}>
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>
        {/* grows with the form and scrolls when the panel is full (min-h-0 lets it shrink inside the flex column) */}
        {children ? <div className={cn('min-h-0 flex-auto space-y-4 overflow-y-auto overscroll-contain px-6 pb-6', bodyClassName)}>{children}</div> : <div className="flex-auto" />}
        {confirming ? (
          <div role="alertdialog" aria-label="Discard changes" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-gold-soft px-6 py-4">
            <p className="text-sm font-medium">Discard your changes?</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Keep editing
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirming(false)
                  setOpen(false)
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : (
          footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-surface-2/60 px-6 py-4">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Cancel button for a drawer footer: closes the drawer the same way as X (slide-out, discard check)
export function DrawerCancel({ children = 'Cancel' }: { children?: React.ReactNode }) {
  return <SheetClose render={<Button variant="secondary" />}>{children}</SheetClose>
}
