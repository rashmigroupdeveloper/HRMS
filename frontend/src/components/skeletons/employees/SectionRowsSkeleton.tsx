import { Award, Briefcase, GraduationCap, HeartHandshake, HeartPulse, IdCard, Landmark, type LucideIcon, MapPin, Phone, ScrollText, ShieldCheck, UserRound, Users } from 'lucide-react'
import { type JoiningFormSection, joiningSectionTitles } from '@/components/JoiningFormSections'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// each section's icon, as the joining form draws it; `list` = several items (an item card under the title)
const SECTION: Partial<Record<JoiningFormSection, { icon: LucideIcon; list?: boolean }>> = {
  personal: { icon: UserRound },
  addresses: { icon: MapPin, list: true },
  emergencyContacts: { icon: Phone, list: true },
  identityDocuments: { icon: IdCard, list: true },
  bankAccount: { icon: Landmark },
  statutory: { icon: ShieldCheck },
  qualifications: { icon: GraduationCap, list: true },
  certifications: { icon: Award, list: true },
  previousJobs: { icon: Briefcase, list: true },
  familyMembers: { icon: Users, list: true },
  nominees: { icon: HeartHandshake, list: true },
  gratuity: { icon: ScrollText },
  medical: { icon: HeartPulse },
}
const TITLE = joiningSectionTitles()

// Loading placeholder for the sections of an employee's records being edited (EmployeeSectionsDrawer): the one card of
// section rows JoiningFormSections draws, each with its real icon and title; its status pill, the Edit button and the
// saved answers (label / value pairs, or an item card for a list) are bars
export function SectionRowsSkeleton({ sections, label = 'Loading', className }: { sections: JoiningFormSection[]; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('divide-y divide-border/70 overflow-hidden rounded-3xl bg-card shadow-card', className)}>
      {sections.map((key) => {
        const { icon: Icon, list } = SECTION[key] ?? { icon: UserRound }
        return (
          <section key={key}>
            <header className="flex items-start gap-4 px-5 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-[15px] font-medium tracking-tight">{TITLE[key]}</h3>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-8 w-16 shrink-0 rounded-full max-sm:w-9" />
            </header>
            <div className="px-5 pb-4 sm:pl-19">
              {list ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-surface-2/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-5 rounded-full" />
                      <Skeleton className="h-3.5 w-28 rounded-full" />
                    </div>
                    <Pairs count={2} />
                  </div>
                </div>
              ) : (
                <Pairs count={key === 'personal' ? 8 : 4} />
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// label / value pairs as the summary draws them (a label line over a value line)
function Pairs({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="min-w-0">
          <div className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-16 rounded-full" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className={cn('h-3.5 max-w-full rounded-full', ['w-24', 'w-20', 'w-28', 'w-16'][i % 4])} />
          </div>
        </div>
      ))}
    </div>
  )
}
