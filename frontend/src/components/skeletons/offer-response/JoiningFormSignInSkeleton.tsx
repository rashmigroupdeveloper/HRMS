import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

// Loading placeholder for the candidate's joining-form page (JoiningFormPage, JoiningFormPortal) while the link and the
// sign-in are checked: the sign-in card most candidates see next - its title, the text with their e-mail as bars, the
// one-time code field with "Send code" and "Open my joining form" (all disabled). The page is still narrow then: the
// wide form only opens once the candidate is known to be signed in. `known` false: the link itself is still being
// checked and the card may turn out to be a message instead - the same card shape, with bars for its texts and controls.
export function JoiningFormSignInSkeleton({ known = true, label = 'Loading' }: { known?: boolean; label?: string }) {
  if (!known) {
    return (
      <section role="status" aria-label={label} className="rounded-3xl bg-card p-6 shadow-float sm:p-8">
        <div className="flex h-8 items-center">
          <Skeleton className="h-6 w-48 rounded-lg" />
        </div>
        <div className="mt-1 space-y-1.5 py-1">
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3.5 w-3/4 rounded-full" />
        </div>
        <Skeleton className="mt-5 h-11 rounded-full" />
      </section>
    )
  }
  return (
    <section role="status" aria-label={label} className="rounded-3xl bg-card p-6 shadow-float sm:p-8">
      <h1 className="text-2xl font-light tracking-tight">Your joining form</h1>
      <div className="mt-1 space-y-1.5 py-1">
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-3/4 rounded-full" />
      </div>
      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">One-time code</Label>
          <div className="flex gap-2">
            <Input disabled placeholder="6 digits" className="h-11 rounded-xl text-center font-mono text-lg tracking-[0.3em]" />
            <Button variant="secondary" className="h-11" disabled>
              Send code
            </Button>
          </div>
        </div>
        <Button variant="gold" size="lg" className="w-full" disabled>
          Open my joining form
        </Button>
      </div>
    </section>
  )
}
