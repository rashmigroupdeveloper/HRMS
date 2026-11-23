import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  FileText,
  FolderOpen,
  History,
  IdCard,
  ListChecks,
  type LucideIcon,
  ShieldCheck,
  UserPlus,
  Users,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { TodayCardSkeleton } from '@/components/skeletons/common/TodayCardSkeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/useAccess'
import { TodayCard } from '@/components/TodayCard'
import { orpc } from '@/lib/orpc'
import { formatDate } from '@/lib/utils'

// The employee's own home after signing in: who they are and where they work, quick links into their profile, and
// the areas their roles give them, and today's attendance.
export function HomePage() {
  const { me, can } = useAccess()
  // read once when the page opens
  const [now] = useState(() => new Date())
  const profile = useQuery({ ...orpc.employees.getByCode.queryOptions({ input: { employeeCode: me?.employeeCode ?? '' } }), enabled: !!me })
  const overview = useQuery({ ...orpc.attendance.overview.queryOptions(), enabled: !!me })
  const firstName = me?.name.split(' ')[0] ?? ''
  const e = profile.data
  // the employee's own profile (and one of its tabs)
  const mine = (tab: string) => `/me${tab ? `?tab=${tab}` : ''}`

  // the areas this person's roles open (none for most employees)
  const work = [
    can('ONBOARDING') && { to: '/onboarding', icon: UserPlus, title: 'Onboarding', text: 'Offers, joining forms, documents' },
    can('EMPLOYEES') && { to: '/employees?view=records', icon: Users, title: 'People', text: 'Employee records and profiles' },
    can('ORGANIZATION') && { to: '/organization', icon: Building2, title: 'Organization', text: 'Companies, locations, departments' },
    can('JOINING_TASKS') && { to: '/joining-tasks', icon: ListChecks, title: 'Joining checklist', text: 'Tasks for new employees' },
    can('LETTER_TEMPLATES') && { to: '/letter-templates', icon: FileText, title: 'Letter templates', text: 'The wording of letters' },
    can('ACCESS') && { to: '/access', icon: ShieldCheck, title: 'Roles & access', text: 'Roles, logins and who can see what' },
    can('CHANGE_HISTORY') && { to: '/change-history', icon: History, title: 'History', text: 'Who changed what and when' },
  ].filter(Boolean) as Shortcut[]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <p className="text-sm text-muted-foreground">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-3xl font-light tracking-tight sm:text-4xl">
          {greeting(now)}
          {firstName && `, ${firstName}`}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground max-sm:hidden">Your attendance, your profile, your documents and the pages your role gives you.</p>
        </div>
        {/* today's attendance, opening the attendance page */}
        {overview.isPending ? (
          <TodayCardSkeleton label="Loading today's attendance" />
        ) : overview.data && (
          <Link to="/attendance" title="Open my attendance" className="inline-block max-w-full transition-transform hover:-translate-y-0.5">
            <TodayCard today={overview.data.today} />
          </Link>
        )}
      </header>

      <section className="u-grain relative overflow-hidden rounded-3xl bg-hero p-5 text-hero-foreground shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-hero-foreground/10 text-base font-semibold">{initials(me?.name ?? '')}</span>
            <div className="min-w-0">
              <p className="text-xs text-hero-foreground/75">My profile · {me?.employeeCode}</p>
              <h2 className="truncate text-2xl font-light tracking-tight">{me?.name}</h2>
              {e || profile.isError ? (
                <p className="mt-1 text-sm text-hero-muted">
                  {e ? [e.designation?.name, e.department?.name, e.company.name, e.workLocation?.name].filter(Boolean).join(' · ') : 'Open your profile to see your details.'}
                </p>
              ) : (
                // the work line and the joining date, in the same lines as the loaded ones
                <div role="status" aria-label="Loading your details" className="text-sm text-hero-muted">
                  <p className="mt-1 flex h-5 items-center">
                    <Skeleton className="h-3.5 w-72 max-w-full rounded-full bg-hero-foreground/10" />
                  </p>
                  <p className="mt-0.5 flex h-5 items-center gap-1">
                    Joined <Skeleton className="h-3.5 w-20 rounded-full bg-hero-foreground/10" />
                  </p>
                </div>
              )}
              {e && <p className="mt-0.5 text-sm text-hero-muted">Joined {formatDate(e.dateOfJoining)}</p>}
            </div>
          </div>
          <Button variant="gold" nativeButton={false} render={<Link to={mine('')} />}>
            Open my profile <ArrowRight />
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-light tracking-tight">Quick links</h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <QuickLink to={mine('personal')} icon={UserRound} title="Personal details" text="Name, family, contacts" />
          <QuickLink to={mine('ids')} icon={IdCard} title="IDs & bank" text="Aadhaar, PAN, salary account" />
          <QuickLink to={mine('documents')} icon={FolderOpen} title="My documents" text="Copies you gave when joining" />
          {profile.isPending ? (
            // salary or PF & ESIC - known once the profile is in
            <div role="status" aria-label="Loading your links" className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-card p-2.5 shadow-card sm:gap-3 sm:p-3">
              <Skeleton className="size-9 shrink-0 rounded-xl sm:size-10" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24 rounded-full" />
                <Skeleton className="h-3 w-36 max-w-full rounded-full max-sm:hidden" />
              </span>
            </div>
          ) : e?.salary ? (
            <QuickLink to={mine('salary')} icon={Wallet} title="My salary" text="CTC and monthly breakup" />
          ) : (
            <QuickLink to={mine('statutory')} icon={ShieldCheck} title="PF & ESIC" text="UAN, PF and ESIC numbers" />
          )}
        </div>
      </section>

      {work.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-light tracking-tight">Your work</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {work.map((s) => (
              <QuickLink key={s.to} {...s} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

type Shortcut = { to: string; icon: LucideIcon; title: string; text: string }

function QuickLink({ to, icon: Icon, title, text }: Shortcut) {
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-2.5 rounded-2xl bg-card p-2.5 shadow-card sm:gap-3 sm:p-3 transition-shadow hover:shadow-float">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground sm:size-10">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground max-sm:hidden" title={text}>{text}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden" />
    </Link>
  )
}

function greeting(now: Date) {
  const hour = now.getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?'
}
