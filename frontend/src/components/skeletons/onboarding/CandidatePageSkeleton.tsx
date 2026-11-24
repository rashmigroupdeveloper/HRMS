import { BriefcaseBusiness, Building2, CalendarDays, History, type LucideIcon, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { DetailCard } from '@/pages/onboarding/components/DetailCard'
import { BackgroundChecksTableSkeleton } from './BackgroundChecksTableSkeleton'
import { DocumentsTableSkeleton } from './DocumentsTableSkeleton'
import { JoiningFormSkeleton } from './JoiningFormSkeleton'

const VALUE = ['w-36', 'w-44', 'w-28', 'w-40', 'w-32', 'w-24']

// a card of the offer tab as the page describes it (the values are not used here)
type Group = { title: string; icon: LucideIcon; columns: string; rows: readonly (readonly [label: string, value: unknown, wide?: boolean])[] }

// Loading placeholder for a candidate's page (CandidatePage): the dark header - the initials tile, the name and status,
// the line of details with its icons, the onboarding steps (`steps`) - and the real stage tabs along its bottom (usable:
// `onTab` opens another one), then the open tab's body: the offer's cards with their real titles and labels and bars for
// the values (`groups`, `pay`, `timeline`), the joining form's sections, the documents, the medical or the background
// checks. `back` is the real link above it.
export function CandidatePageSkeleton({
  back,
  tabs,
  tab,
  onTab,
  groups,
  pay,
  timeline,
  steps,
  medical = true,
  label = 'Loading',
}: {
  back?: React.ReactNode
  tabs: readonly (readonly [value: string, label: string, icon: LucideIcon])[]
  tab: string
  onTab?: (value: string) => void
  // the offer tab's cards (their titles, icons, columns and labels), the pay figures' labels and the timeline's steps
  groups: Group[]
  pay: readonly string[]
  timeline: readonly string[]
  // the onboarding steps of the header's progress bar
  steps: readonly string[]
  // the viewer may see the joining form's medical section
  medical?: boolean
  label?: string
}) {
  // on the dark header the bars are a light tint, not the page's grey
  const light = 'bg-hero-foreground/10'
  // an offer-tab card: its real title and labels, a bar for each value
  const groupCard = ({ title, icon, columns, rows }: Group) => (
    <DetailCard key={title} title={title} icon={icon}>
      <dl className={cn('grid gap-x-6 gap-y-3', columns)}>
        {rows.map(([field, , wide], i) => (
          <div key={field} className={cn('flex min-w-0 flex-col gap-0.5', wide && 'col-span-full')}>
            <dt className="text-xs text-muted-foreground">{field}</dt>
            <dd className="flex h-5 items-center">
              <Skeleton className={cn('h-3.5 max-w-full rounded-full', VALUE[i % VALUE.length])} />
            </dd>
          </div>
        ))}
      </dl>
    </DetailCard>
  )
  return (
    <Tabs role="status" aria-label={label} value={tab} onValueChange={(value) => onTab?.(String(value))} className="gap-4">
      {back}
      <header className="u-grain relative space-y-3 overflow-hidden rounded-3xl bg-hero px-5 pt-4 text-hero-foreground shadow-card sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span aria-hidden className="size-12 shrink-0 rounded-2xl bg-hero-foreground/10" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 items-center">
                <Skeleton className={cn('h-6 w-56 max-w-full rounded-lg', light)} />
              </div>
              <Skeleton className={cn('h-6 w-20 rounded-full', light)} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-hero-foreground/75">
              <Skeleton className={cn('h-3 w-6 rounded-full', light)} />
              <span className="flex h-4 items-center gap-1">
                <BriefcaseBusiness className="size-3.5" /> <Skeleton className={cn('h-3 w-24 rounded-full', light)} />
              </span>
              <span className="flex h-4 items-center gap-1">
                <Building2 className="size-3.5" /> <Skeleton className={cn('h-3 w-36 rounded-full', light)} />
              </span>
              <span className="flex h-4 items-center gap-1">
                <CalendarDays className="size-3.5" /> Joining <Skeleton className={cn('h-3 w-20 rounded-full', light)} />
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pt-1">
          <ol className="grid min-w-0 flex-1 grid-cols-5 gap-1.5">
            {steps.map((step) => (
              <li key={step} className="min-w-0">
                <span className="block h-1.5 rounded-full bg-hero-foreground/15" />
                <span className="mt-1.5 block truncate text-xs text-hero-foreground/50">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex h-5 items-center">
            <Skeleton className={cn('h-3.5 w-32 rounded-full', light)} />
          </div>
        </div>
        <TabsList
          variant="line"
          className="-mx-5 flex h-auto w-[calc(100%+2.5rem)] group-data-horizontal/tabs:h-auto flex-nowrap justify-start gap-0 overflow-x-auto border-t border-hero-foreground/10 px-2 py-0 [scrollbar-width:none] sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-3 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(([value, name, Icon]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-auto flex-none gap-2 rounded-none px-3 py-3 whitespace-nowrap text-hero-foreground/75 group-data-horizontal/tabs:after:bottom-0 after:h-[3px] after:rounded-full after:bg-gold hover:text-hero-foreground data-active:text-hero-foreground"
            >
              <Icon className="size-4" />
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
      </header>

      {tab === 'joining' ? (
        <JoiningFormSkeleton medical={medical} />
      ) : tab === 'documents' ? (
        <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
          <Title title="Documents" detail />
          <DocumentsTableSkeleton />
        </section>
      ) : tab === 'medical' ? (
        <div className="space-y-4">
          <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
            <Title title="Pre-employment medical" detail />
            <Skeleton className="h-12 rounded-2xl" />
          </section>
          <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
            <Title title="Joining confirmation" detail />
            <Skeleton className="h-6 w-36 rounded-full" />
          </section>
        </div>
      ) : tab === 'bgv' ? (
        <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
          <Title title="Background checks" />
          <BackgroundChecksTableSkeleton />
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-4">
            {groupCard(groups[0]!)}
            <div className="grid items-start gap-4 md:grid-cols-2">{groups.slice(1).map(groupCard)}</div>
            <DetailCard title="Pay" icon={Wallet}>
              <dl className="grid grid-cols-3 gap-4">
                {pay.map((label) => (
                  <div key={label} className="flex min-w-0 flex-col-reverse">
                    <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
                    <dd className="flex h-8 items-center sm:h-9">
                      <Skeleton className="h-6 w-28 max-w-full rounded-lg" />
                    </dd>
                  </div>
                ))}
              </dl>
            </DetailCard>
          </div>
          <DetailCard title="Timeline" icon={History}>
            <ol>
              {timeline.map((step, i) => (
                <li key={step} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < timeline.length - 1 && <span aria-hidden className="absolute top-5 bottom-0 left-[7px] w-px bg-border" />}
                  <span aria-hidden className="mt-0.5 size-[15px] shrink-0 rounded-full border-2 border-border bg-card" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{step}</p>
                    <div className="flex h-4 items-center">
                      <Skeleton className="h-3 w-36 rounded-full" />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex h-[1.875rem] items-end border-t border-dashed">
              <Skeleton className="h-3 w-44 rounded-full" />
            </div>
          </DetailCard>
        </div>
      )}
    </Tabs>
  )
}

// A card's title as SectionTitle draws it; `detail`: its line under the title (it depends on the candidate) as a bar
function Title({ title, detail = false }: { title: string; detail?: boolean }) {
  return (
    <div>
      <h3 className="text-lg font-light tracking-tight">{title}</h3>
      {detail && (
        <div className="mt-0.5 flex h-5 items-center">
          <Skeleton className="h-3.5 w-96 max-w-full rounded-full" />
        </div>
      )}
    </div>
  )
}
