import { ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// The role portal home's "Your role's pages" (ManageHomePage) while accounts.me loads: the real title and link, the
// shortcuts as icon + two bars in the same two-column grid - change both together
export function ManageWorkspaceSkeleton({ label }: { label: string }) {
  return (
    <section role="status" aria-label={label} className="home-panel min-w-0 space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium tracking-tight">Your role&apos;s pages</h2>
        <span className="flex min-h-9 items-center gap-1 text-sm underline underline-offset-4">People directory <ArrowRight aria-hidden className="size-3.5" /></span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex min-h-14 min-w-0 items-center gap-2 py-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2"><Skeleton className="h-3.5 w-24 max-w-full rounded" /><Skeleton className="h-3 w-28 max-w-full rounded" /></div>
          </div>
        ))}
      </div>
    </section>
  )
}
