import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Loading placeholder for the candidate's offer page (OfferResponsePage): the offer card as it loads - the company and
// offer number, "Dear ...", the letter's sentence, the joining date and answer-by tiles and the button that opens the
// PDF (disabled) - and below it the card for the answer, which depends on the offer, as bars.
// The bars on the tinted tiles and in the button are darker, or they would not show.
export function OfferCardSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <section className="rounded-3xl bg-card p-6 shadow-float sm:p-8">
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-48 rounded-full" />
        </div>
        <div className="mt-1 flex h-9 items-center gap-2 text-3xl font-light tracking-tight">
          Dear <Skeleton className="h-7 w-40 rounded-lg" />
        </div>
        <div className="mt-3 space-y-2 py-1">
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3.5 w-2/3 rounded-full" />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          {['Joining date', 'Answer by'].map((name) => (
            <div key={name} className="rounded-2xl bg-surface-2/70 px-4 py-3">
              <dt className="text-xs text-muted-foreground">{name}</dt>
              <dd className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-24 rounded-full bg-foreground/10" />
              </dd>
            </div>
          ))}
        </dl>
        <Button variant="secondary" className="mt-5 w-full" disabled>
          <FileText /> <Skeleton className="h-3.5 w-44 rounded-full bg-foreground/15" />
        </Button>
      </section>
      <section className="rounded-3xl bg-card p-6 shadow-float sm:p-8">
        <div className="flex h-7 items-center">
          <Skeleton className="h-5 w-32 rounded-lg" />
        </div>
        <div className="mt-1 flex h-5 items-center">
          <Skeleton className="h-3.5 w-80 max-w-full rounded-full" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-11 rounded-full" />
          <Skeleton className="h-11 rounded-full" />
        </div>
      </section>
    </div>
  )
}
