import {
  Award,
  Briefcase,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  IdCard,
  Landmark,
  type LucideIcon,
  MapPin,
  Phone,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { type JoiningFormSection, type JoiningPack, joiningSectionTitles } from '@/components/JoiningFormSections'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// The joining form's groups and sections in page order, as JoiningFormReview lists them (the titles come from the
// form's own list). `described`: it has a line under its title; `regular`: only in the Regular pack; the medical section only with the medical access and not for Overseas.
const GROUPS: { name: string; icon: LucideIcon; sections: { key: JoiningFormSection; icon: LucideIcon; described?: boolean; regular?: boolean }[] }[] = [
  {
    name: 'Personal',
    icon: UserRound,
    sections: [
      { key: 'personal', icon: UserRound },
      { key: 'addresses', icon: MapPin, described: true },
      { key: 'emergencyContacts', icon: Phone },
    ],
  },
  {
    name: 'Identity & pay',
    icon: Landmark,
    sections: [
      { key: 'identityDocuments', icon: IdCard, described: true },
      { key: 'bankAccount', icon: Landmark, described: true },
      { key: 'statutory', icon: ShieldCheck, described: true, regular: true },
    ],
  },
  {
    name: 'Background',
    icon: GraduationCap,
    sections: [
      { key: 'qualifications', icon: GraduationCap, described: true },
      { key: 'certifications', icon: Award, described: true },
      { key: 'previousJobs', icon: Briefcase, described: true },
    ],
  },
  {
    name: 'Family',
    icon: Users,
    sections: [
      { key: 'familyMembers', icon: Users, described: true },
      { key: 'nominees', icon: HeartHandshake, described: true },
      { key: 'gratuity', icon: ScrollText, described: true, regular: true },
    ],
  },
  { name: 'Health', icon: HeartPulse, sections: [{ key: 'medical', icon: HeartPulse, described: true }] },
]

const TITLE = joiningSectionTitles()
const DETAIL = ['w-80', 'w-64', 'w-96', 'w-72']

// Loading placeholder for HR's view of the joining form (JoiningFormReview): the side index of sections on a computer
// and a card per group - its band, then one row per section with its icon and title. Only how far each part is (the
// pills, counts) is a bar; the saved answers under each title are left out, as an empty form has none. `pack` /
// `medical` leave out the sections the loaded form leaves out; `editable` keeps room for each row's Edit / Add button.
export function JoiningFormSkeleton({
  pack,
  medical = true,
  editable = false,
  label = 'Loading',
}: {
  pack?: JoiningPack
  medical?: boolean
  editable?: boolean
  label?: string
}) {
  const regular = !pack || pack === 'REGULAR'
  const groups = GROUPS.map((g) => ({
    ...g,
    sections: g.sections.filter((s) => (regular || !s.regular) && (s.key !== 'medical' || (medical && pack !== 'OVERSEAS'))),
  })).filter((g) => g.sections.length > 0)
  const count = groups.reduce((n, g) => n + g.sections.length, 0)

  return (
    <div role="status" aria-label={label} className="flex items-start gap-6">
      <div className="hidden w-64 shrink-0 overflow-hidden rounded-3xl bg-card shadow-card lg:block">
        <div className="space-y-2.5 border-b bg-surface-2/40 px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Sections</p>
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: count }, (_, i) => (
              <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
            ))}
          </div>
        </div>
        <div className="space-y-3 p-3">
          {groups.map((group) => (
            <div key={group.name} className="space-y-0.5">
              <div className="flex items-center justify-between px-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {group.name}
                <Skeleton className="h-3 w-6 rounded-full" />
              </div>
              {group.sections.map((s) => (
                <div key={s.key} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-foreground/75">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                    <s.icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">{TITLE[s.key]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-5">
        {groups.map((group, g) => (
          <div key={group.name} className="overflow-hidden rounded-3xl bg-card shadow-card">
            <div className="flex items-center gap-3 border-b bg-surface-2/40 px-5 py-2.5">
              <group.icon className="size-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group.name}</h2>
              <Skeleton className="ml-auto h-3 w-16 rounded-full" />
            </div>
            <div className="divide-y divide-border/70">
              {group.sections.map((s, r) => (
                <section key={s.key}>
                  <header className="flex items-start gap-4 px-5 py-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
                      <s.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-[15px] font-medium tracking-tight">{TITLE[s.key]}</h3>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      {s.described && (
                        <div className="mt-0.5 flex h-4 items-center">
                          <Skeleton className={cn('h-3 max-w-full rounded-full', DETAIL[(g + r) % DETAIL.length])} />
                        </div>
                      )}
                    </div>
                    {editable && <Skeleton className="h-8 w-16 shrink-0 rounded-full max-sm:w-9" />}
                  </header>
                </section>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
