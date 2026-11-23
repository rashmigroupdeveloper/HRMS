import { ShieldCheck } from 'lucide-react'

// The sign-in pages' frame (sign in, forgot password): the charcoal brand panel and the form card. Layout taken from
// the old HRMS.
export function AuthLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="u-grain relative hidden flex-col justify-between overflow-hidden bg-hero px-12 py-14 text-hero-foreground lg:flex">
        <BrandMark onDark />
        <div className="max-w-lg">
          <p className="text-sm font-medium text-hero-muted">People · onboarding · attendance</p>
          <h1 className="mt-5 text-5xl leading-[1.12] font-light tracking-tight">
            <span className="block">From offer letter</span>
            <span className="block">to first day,</span>
            <span className="relative mt-2 inline-block pb-1">
              in one place.
              <span aria-hidden className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-gold" />
            </span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-hero-muted">
            Sign in with your employee code to see your profile and the pages your role gives you.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-hero-muted">
          <ShieldCheck className="size-4" aria-hidden />
          You stay signed in for a set time (7 days unless HR changed it).
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-float sm:p-10">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
          {children}
        </div>
      </main>
    </div>
  )
}

function BrandMark({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={
          onDark
            ? 'relative grid size-9 place-items-center rounded-full bg-gold text-sm font-bold text-gold-foreground'
            : 'relative grid size-9 place-items-center rounded-full bg-hero text-sm font-bold text-hero-foreground'
        }
      >
        H
      </span>
      <span className="text-sm font-semibold">HRMS</span>
    </div>
  )
}
