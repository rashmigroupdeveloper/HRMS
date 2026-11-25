import { DOCUMENT_UPLOAD_NOTE } from '@/pages/employees/components/document-labels'
import {
  Activity,
  AtSign,
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  Circle,
  ClipboardCheck,
  FileClock,
  FileText,
  GraduationCap,
  HandHeart,
  HeartPulse,
  History,
  House,
  IdCard,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PiggyBank,
  Plus,
  ShieldCheck,
  Siren,
  Smartphone,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { PillTabsList, PillTabsTrigger } from '@/components/PillTabs'
import { CardTitle, InfoCard } from '@/components/ProfileCards'
import { TimelineSkeleton } from '@/components/skeletons/common/TimelineSkeleton'
import { ChangeHistorySkeleton } from '@/components/skeletons/common/ChangeHistorySkeleton'
import { DocumentsSkeleton } from '@/components/skeletons/employees/DocumentsSkeleton'
import { LetterRowsSkeleton } from '@/components/skeletons/employees/LetterRowsSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type ProfileTab = { value: string; label: string; icon: LucideIcon; group: string }

const VALUE = ['w-24', 'w-32', 'w-20', 'w-28', 'w-36', 'w-16', 'w-24', 'w-28']
// a bar on the dark header
const DARK = 'bg-hero-foreground/10'

// Loading placeholder for an employee's profile page, drawn like the loaded page with only the data missing: the dark
// header (real icons, "Reports to", "My profile"; the edit button for the open tab - `edit`), the real tabs (`tabs` in
// their `groups`, the menu on the left on a wide screen; `active` open, `onTab` still switches) and the open tab's
// cards with their real titles and labels - the Job tab in full (Job & placement, Contact, Dates and terms, Job timeline).
export function EmployeeProfileSkeleton({
  tabs,
  groups,
  active,
  onTab,
  self = false,
  edit,
  hr = false,
  manageDocuments = false,
  uploadDocuments = false,
  label = 'Loading',
  className,
}: {
  tabs: ProfileTab[]
  groups: readonly string[]
  active: string
  onTab: (value: string) => void
  self?: boolean
  edit?: string | null
  // HR's view (Employees: View) - its own cards on the Record tab
  hr?: boolean
  // may add documents and issue letters - the buttons on those tabs
  manageDocuments?: boolean
  uploadDocuments?: boolean
  label?: string
  className?: string
}) {
  return (
    <div role="status" aria-label={label} className={cn('space-y-6', className)}>
      <header className="u-grain relative overflow-hidden rounded-3xl bg-hero px-4 py-4 text-hero-foreground shadow-card sm:px-5">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
          <Skeleton className={cn('size-12 shrink-0 rounded-2xl sm:size-14', DARK)} />
          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <div className="flex h-8 items-center sm:h-9">
                <Skeleton className={cn('h-6 w-48 rounded-lg sm:h-7', DARK)} />
              </div>
              <Skeleton className={cn('h-5 w-16 rounded-full', DARK)} />
              <Skeleton className={cn('h-5 w-24 rounded-full', DARK)} />
              {self && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-gold">My profile</span>}
            </div>
            <div className="mt-0.5 flex h-5 items-center">
              <Skeleton className={cn('h-3.5 w-52 max-w-full rounded-full', DARK)} />
            </div>
          </div>
          {edit && (
            <Button variant="gold" size="sm" className="shrink-0" disabled>
              <Pencil /> {edit}
            </Button>
          )}
        </div>
        <ul className="relative mt-3 flex flex-wrap gap-1.5 border-t border-hero-foreground/10 pt-3 text-xs text-hero-foreground/80">
          <Fact icon={Building2} width="w-36" />
          <Fact icon={MapPin} width="w-24" />
          <Fact icon={CalendarDays} width="w-40" />
          <Fact icon={UserRound} width="w-24">
            Reports to
          </Fact>
        </ul>
      </header>

      <Tabs value={active} onValueChange={(value) => onTab(String(value))} className="xl:grid xl:grid-cols-[13rem_minmax(0,1fr)] xl:items-start xl:gap-x-5">
        <PillTabsList className="xl:hidden">
          {tabs.map((t) => (
            <PillTabsTrigger key={t.value} value={t.value}>
              {t.label}
            </PillTabsTrigger>
          ))}
        </PillTabsList>
        <nav aria-label="Profile sections" className="sticky top-4 col-start-1 row-start-1 space-y-2 rounded-3xl bg-card p-2 shadow-card max-xl:hidden">
          {groups.map((group) => {
            const items = tabs.filter((t) => t.group === group)
            return (
              items.length > 0 && (
                <div key={group || 'top'}>
                  {group && items.length > 1 && <p className="px-3 pt-1 pb-1 text-xs font-medium text-muted-foreground">{group}</p>}
                  <ul className="space-y-0.5">
                    {items.map((t) => (
                      <li key={t.value}>
                        <button
                          type="button"
                          aria-current={active === t.value ? 'page' : undefined}
                          onClick={() => onTab(t.value)}
                          className={cn(
                            'flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-colors',
                            active === t.value ? 'bg-hero font-medium text-hero-foreground shadow-card' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                          )}
                        >
                          <t.icon className="size-4 shrink-0" />
                          <span className="truncate">{t.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )
          })}
        </nav>

        <div className="mt-4 xl:col-start-2 xl:row-start-1 xl:mt-0">{active === 'job' ? <JobTab /> : <OtherTab tab={active} hr={hr} manageDocuments={manageDocuments} uploadDocuments={uploadDocuments} />}</div>
      </Tabs>
    </div>
  )
}

// a header fact chip: its real icon (and words), the value a light bar
function Fact({ icon: Icon, width, children }: { icon: LucideIcon; width: string; children?: React.ReactNode }) {
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-hero-foreground/[0.07] px-2.5 py-1">
      <Icon aria-hidden className="size-3.5 shrink-0 text-gold" />
      {children}
      <span className="flex h-4 items-center">
        <Skeleton className={cn('h-3 rounded-full', DARK, width)} />
      </span>
    </li>
  )
}

// label / value lines like the profile's Lines: the real labels, the values bars
function Lines({ labels, columns = 1 }: { labels: string[]; columns?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-8', columns === 2 && 'sm:grid-cols-2')}>
      {labels.map((label, i) => (
        <div
          key={label}
          className={cn(
            'flex items-center justify-between gap-4 border-b border-dashed border-border/80 py-2 last:border-b-0',
            columns === 2 && 'sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0',
          )}
        >
          <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
          <dd className="flex h-5 min-w-0 items-center justify-end">
            <Skeleton className={cn('h-3.5 max-w-full rounded-full', VALUE[i % VALUE.length])} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

const JOB_LABELS = [
  'Employee code',
  'Company',
  'Plant',
  'Work location',
  'Region',
  'Location address',
  'Department',
  'Designation',
  'Grade',
  'Position',
  'Cost centre',
  // (2026-11-25)
  'Holiday list',
  'Reports to',
  'Functional manager',
  'HOD',
  'Joining type',
  'Employment type',
  'Workforce',
]
const CONTACTS: [LucideIcon, string][] = [
  [Mail, 'Work e-mail'],
  [AtSign, 'Personal e-mail'],
  [Phone, 'Mobile'],
  [Smartphone, 'Alternate mobile'],
]

// the Job tab as JobOverview + JobTimeline draw it (lay offs show only when there are some - left out)
function JobTab() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-5">
        <InfoCard icon={BriefcaseBusiness} title="Job & placement" className="lg:col-span-3">
          <Lines columns={2} labels={JOB_LABELS} />
        </InfoCard>
        <InfoCard icon={Mail} title="Contact" className="lg:col-span-2">
          <ul className="space-y-1">
            {CONTACTS.map(([Icon, label], i) => (
              <li key={label} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="flex h-5 items-center">
                    <Skeleton className={cn('h-3.5 rounded-full', ['w-44', 'w-40', 'w-28', 'w-24'][i])} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </InfoCard>
        <InfoCard
          icon={CalendarClock}
          title="Dates and terms"
          className="lg:col-span-5"
          aside={
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
              Notice period: <Skeleton className="h-3 w-14 rounded-full bg-card" />
            </span>
          }
        >
          <ol className="grid gap-x-3 gap-y-4 pt-1 sm:auto-cols-fr sm:grid-flow-col">
            {['Joined', 'Probation ends', 'Confirmed'].map((step, i, all) => (
              <li key={step} className="flex gap-3 sm:block">
                <div className="flex flex-col items-center sm:flex-row">
                  <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-border bg-card" />
                  {i < all.length - 1 && <span aria-hidden className="my-1 w-0.5 flex-1 rounded-full bg-border sm:mx-1.5 sm:my-0 sm:h-0.5 sm:w-auto" />}
                </div>
                <div className="min-w-0 pb-1 sm:pt-2">
                  <p className="text-xs text-muted-foreground">{step}</p>
                  <p className="flex h-5 items-center">
                    <Skeleton className="h-3.5 w-20 rounded-full" />
                  </p>
                  <p className="flex h-4 items-center">
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </InfoCard>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InfoCard
          icon={History}
          title="Job timeline"
          aside={
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">As of</span>
              <Input type="date" aria-label="As of" className="h-8 w-36 rounded-full text-xs" disabled />
            </span>
          }
        >
          <TimelineSkeleton rows={2} label="Loading the job timeline" />
        </InfoCard>
      </div>
    </>
  )
}

// the other tabs: their cards with the real titles and labels in the same grid - label / value cards keep their labels,
// lists of records (addresses, family...) get item rows of bars; the tabs that load their own list (documents, letters,
// history) show that list's skeleton
type Card = { icon: LucideIcon; title: string; labels?: string[]; className?: string }
const TAB_CARDS: Record<string, { grid: string; cards: Card[] }> = {
  personal: {
    grid: 'lg:grid-cols-3',
    cards: [
      { icon: UserRound, title: 'About', labels: ['Salutation', 'Gender', 'Date of birth', 'Place of birth', 'Nationality', 'Country of origin', 'Religion', 'Category'] },
      { icon: Users, title: 'Family', labels: ["Father's name", "Mother's name", 'Marital status', "Spouse's name", 'Date of marriage'] },
      { icon: HeartPulse, title: 'Physical and other', labels: ['Blood group', 'Height', 'Weight', 'Identification mark', 'Physically disabled', 'Hobbies'] },
    ],
  },
  contact: {
    grid: 'lg:grid-cols-2',
    cards: [
      { icon: House, title: 'Addresses' },
      { icon: Siren, title: 'Emergency contacts' },
    ],
  },
  ids: {
    grid: 'lg:grid-cols-2',
    cards: [
      { icon: IdCard, title: 'Identity documents' },
      { icon: Landmark, title: 'Bank accounts' },
    ],
  },
  statutory: {
    grid: 'lg:grid-cols-2',
    cards: [
      {
        icon: PiggyBank,
        title: 'EPF (Form 11)',
        labels: [
          'UAN',
          'PF member number',
          'Relative on EPF',
          'Mobile registered with Aadhaar',
          'International worker',
          'Earlier EPF / EPS member',
          'Previous PF number',
          'Previous exit date',
          'Scheme certificate / PPO',
        ],
      },
      { icon: ShieldCheck, title: 'ESIC (Form 1)', labels: ['IP number', 'Branch office / dispensary', 'Previous IP number', 'Previous employer'] },
    ],
  },
  background: {
    grid: 'lg:grid-cols-2',
    cards: [
      { icon: GraduationCap, title: 'Education' },
      { icon: Award, title: 'Additional certifications' },
      { icon: BriefcaseBusiness, title: 'Previous employment', className: 'lg:col-span-2' },
    ],
  },
  family: {
    grid: 'lg:grid-cols-2',
    cards: [
      { icon: Users, title: 'Family' },
      { icon: HandHeart, title: 'Nominees' },
    ],
  },
  medical: {
    grid: 'lg:grid-cols-3',
    cards: [
      {
        icon: HeartPulse,
        title: 'Medical history - self',
        labels: ['Conditions', 'Taking medication', 'Physical limitations', 'Surgery / major treatment (5 years)', 'Allergies', 'Height / weight'],
      },
      {
        icon: Users,
        title: 'Medical history - family',
        labels: [
          'Heart disease',
          'Diabetes',
          'High blood pressure',
          'Cancer',
          'Stroke',
          'Mental health disorder',
          'Genetic disorder',
          'Other',
          'Hereditary condition',
          'Unplanned health leave',
        ],
      },
      { icon: Activity, title: 'Lifestyle and care', labels: ['Smokes / tobacco', 'Alcohol', 'Exercises regularly', 'Emergency medical care', 'Sports', 'How often'] },
    ],
  },
}
const RECORD_LABELS = ['Created', 'Last changed', 'Joining completed', 'Joining form signed online', 'Pre-employment medical']
const OFFICE_CHECKS = ['Joining formalities completed', 'Payroll updated', 'ID card / access created', 'Induction']

function OtherTab({ tab, hr, manageDocuments, uploadDocuments }: { tab: string; hr: boolean; manageDocuments: boolean; uploadDocuments: boolean }) {
  if (tab === 'documents')
    return (
      <InfoCard
        icon={FileText}
        title="Documents"
        aside={
          uploadDocuments && (
            <Button variant="gold" size="sm" className="ml-1 h-9 sm:h-8" disabled>
              <Plus /> Add document
            </Button>
          )
        }
      >
        <div className="space-y-3">
          {uploadDocuments && <p className="text-xs text-muted-foreground">{DOCUMENT_UPLOAD_NOTE}</p>}
          <DocumentsSkeleton label="Loading the documents" />
        </div>
      </InfoCard>
    )
  if (tab === 'letters')
    return (
      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle icon={FileText}>Letters</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Kept exactly as issued - a later change of the template does not change them.</p>
          </div>
          {manageDocuments && (
            <Button variant="secondary" size="sm" disabled>
              <Plus /> Issue a letter
            </Button>
          )}
        </div>
        <LetterRowsSkeleton label="Loading the letters" />
      </section>
    )
  if (tab === 'history')
    return (
      <section className="rounded-3xl bg-card p-4 shadow-card sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <CardTitle icon={History}>Change history</CardTitle>
          <span className="text-xs font-medium text-muted-foreground">Open in Change history</span>
        </div>
        <ChangeHistorySkeleton label="Loading the change history" />
      </section>
    )
  if (tab === 'salary') return <SalaryTab />
  if (tab === 'record')
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={FileClock} title="Record">
          <Lines labels={hr ? [...RECORD_LABELS, 'Joined from offer'] : RECORD_LABELS} />
        </InfoCard>
        {/* the joining form's "For HR / Office Use Only" box - HR's view only */}
        {hr && (
          <InfoCard icon={ClipboardCheck} title="For HR / office use">
            <ul className="divide-y divide-border/70">
              {OFFICE_CHECKS.map((check) => (
                <li key={check} className="flex items-center gap-3 py-2 first:pt-0.5 last:pb-0">
                  <Circle aria-hidden className="size-4.5 shrink-0 text-border" />
                  <span className="flex-1 text-sm">{check}</span>
                  <Skeleton className="h-3 w-24 rounded-full" />
                </li>
              ))}
            </ul>
          </InfoCard>
        )}
      </div>
    )
  const { grid, cards } = TAB_CARDS[tab] ?? TAB_CARDS.personal
  return (
    <div className={cn('grid gap-4', grid)}>
      {cards.map((card) => (
        <InfoCard key={card.title} icon={card.icon} title={card.title} className={card.className}>
          {card.labels ? (
            <Lines labels={card.labels} />
          ) : (
            <ul className="divide-y divide-border/70">
              {[0, 1].map((i) => (
                <li key={i} className="flex items-start gap-3 py-2.5 first:pt-1 last:pb-0">
                  <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="flex h-5 items-center">
                      <Skeleton className={cn('h-3.5 rounded-full', ['w-32', 'w-40'][i])} />
                    </p>
                    <p className="mt-0.5 flex h-4 items-center">
                      <Skeleton className={cn('h-3 max-w-full rounded-full', ['w-56', 'w-48'][i])} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </InfoCard>
      ))}
    </div>
  )
}

const SALARY_TILES = ['Fixed CTC / year', 'Performance pay / year', 'Total CTC / year', 'Effective from']

// the Salary tab as SalaryCard draws it: the four CTC tiles, then the monthly breakup table with its real headings
function SalaryTab() {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 rounded-3xl bg-card p-3 shadow-card lg:grid-cols-4">
        {SALARY_TILES.map((tile, i) => (
          <div key={tile} className={cn('rounded-2xl px-3.5 py-3', i === 2 ? 'bg-gold/25' : 'bg-surface-2/70')}>
            <p className="text-xs text-muted-foreground">{tile}</p>
            <p className="mt-0.5 flex h-7 items-center">
              <Skeleton className="h-5 w-24 rounded-full bg-card" />
            </p>
          </div>
        ))}
      </section>
      <InfoCard icon={Wallet} title="Monthly breakup" aside={<Skeleton className="h-5 w-24 rounded-full" />}>
        <table className="w-full text-sm [&_td+td]:pl-3">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Component</th>
              <th className="py-1 text-right font-medium">Monthly</th>
              <th className="py-1 text-right font-medium">Annual</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Earnings
              </td>
            </tr>
            {['w-24', 'w-36', 'w-28', 'w-32'].map((width) => (
              <tr key={width} className="border-b border-dashed border-border/80">
                <td className="py-1.5">
                  <Skeleton className={cn('h-3.5 rounded-full', width)} />
                </td>
                <td className="py-1.5">
                  <Skeleton className="ml-auto h-3.5 w-16 rounded-full" />
                </td>
                <td className="py-1.5">
                  <Skeleton className="ml-auto h-3.5 w-20 rounded-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </InfoCard>
    </div>
  )
}

// The holiday list's name on the Job tab while it loads on its own (JobOverview - 2026-11-25)
export function HolidayListValueSkeleton() {
  return <Skeleton className="inline-block h-3.5 w-28 rounded-full align-middle" />
}
