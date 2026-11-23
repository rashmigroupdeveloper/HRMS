import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// The frame of the candidate's own pages (the offer page and the joining-form page): no app menu, just the logo,
// the page's name and a reminder not to forward the secret link.
// `wide`: the signed-in joining form (steps beside the form; room for 4 columns of fields on a laptop)
export function CandidatePageFrame({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background px-4 py-10 sm:py-16">
      <div className={cn('mx-auto w-full space-y-6', wide ? 'max-w-6xl' : 'max-w-xl')}>
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="relative grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-foreground">
            H
            <span className="absolute right-1.5 bottom-1.5 size-1.5 rounded-full bg-gold" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">{title}</span>
        </div>
        {children}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden /> This page is only for you - please do not forward the link.
        </p>
      </div>
    </div>
  )
}

export function CandidateCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-3xl bg-card p-6 shadow-float sm:p-8', className)}>{children}</section>
}
