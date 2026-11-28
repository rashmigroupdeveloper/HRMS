import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { ExportButton } from '@/components/ExportButton'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { BOARD_CAPTION, BOARD_TITLE, BREAKDOWN_LABELS, CLASS_GROUPS, COLUMNS, COUNT_NOTE, DEPARTMENT_CAPTION, DRILL_CAPTION, ROW, SPLIT_LABEL, SUMMARY_LABEL, VIEWS, GROUPINGS, MONTH_LABEL } from '@/pages/organisation/labels'

// The organisation board while its counts load: the real titles, labels and the split switch; bars where the numbers,
// names and splits go. `kind` matches the board this role will get. Change it with OrganisationBoard.
// `people` / `exports`: the header's "View people" link and Export button, as the loaded board will have them.
// `breakdowns`: the extra groups the board will show (gender only with personal details access; none on Master Control).
export function OrganisationBoardSkeleton({ kind, heading = 'h2', label = 'Loading the organisation', light = false, rows, people = false, exports = false, breakdowns = [] }: {
  kind: 'companies' | 'departments' | 'drill'
  heading?: 'h1' | 'h2'
  label?: string
  light?: boolean
  rows?: number
  people?: boolean
  exports?: boolean
  breakdowns?: readonly (keyof typeof BREAKDOWN_LABELS)[]
}) {
  const groups = [...CLASS_GROUPS, ...breakdowns.map((key) => ({ key, label: BREAKDOWN_LABELS[key] }))]
  const caption = kind === 'drill' ? DRILL_CAPTION : kind === 'departments' ? DEPARTMENT_CAPTION : BOARD_CAPTION
  const Title = heading
  const count = rows ?? (kind === 'companies' ? 3 : 5)
  const muted = light ? 'text-muted-foreground' : 'text-hero-muted'
  const bar = light ? undefined : 'bg-hero-foreground/10'
  return (
    <section role="status" aria-label={label} className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {kind === 'drill' && (
            <div className="mb-1.5 flex items-center gap-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-0.5 px-1"><ChevronLeft aria-hidden className="size-4" />{BOARD_TITLE}</span><span aria-hidden>/</span><Skeleton className="h-3.5 w-14 rounded" />
            </div>
          )}
          {kind === 'drill'
            ? <Skeleton className={cn('rounded', heading === 'h1' ? 'h-8 w-56' : 'h-6 w-44', 'max-w-full')} />
            : <Title className={cn('leading-tight font-light tracking-tight', heading === 'h1' ? 'text-[26px] sm:text-[30px]' : 'text-xl')}>{BOARD_TITLE}</Title>}
          <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
        </div>
        {(people || exports) && (
          <div className="flex items-center gap-2">
            {people && <span className="inline-flex h-10 items-center gap-1.5 px-3 text-sm text-muted-foreground">View people <ArrowRight aria-hidden className="size-4" /></span>}
            {exports && <ExportButton load={() => Promise.reject(new Error('loading'))} disabled />}
          </div>
        )}
      </header>

      <div className={cn('grid gap-5 rounded-3xl p-5 shadow-card sm:p-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-8', light ? 'bg-card' : 'bg-hero text-hero-foreground')}>
        <div>
          <p className={cn('text-xs', muted)}>{SUMMARY_LABEL}</p>
          <Skeleton className={cn('mt-1 h-11 w-24 rounded-lg', bar)} />
          <Skeleton className={cn('mt-2 h-3 w-32 rounded', bar)} />
          <p className={cn('mt-3 text-xs', muted)}>{MONTH_LABEL}</p>
          <p className="mt-1 flex h-5 items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1"><Skeleton className={cn('h-3.5 w-4 rounded', bar)} /> joined</span>
            <span className="inline-flex items-center gap-1"><Skeleton className={cn('h-3.5 w-4 rounded', bar)} /> left</span>
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-6">
        {groups.map((group) => (
          <div key={group.key} className="min-w-0">
            <p className={cn('text-xs', muted)}>{group.label}</p>
            <Skeleton className={cn('mt-3 h-2 w-full rounded-full', bar)} />
            <div className="mt-3 space-y-1.5">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="flex h-5 items-center gap-2">
                  <Skeleton className={cn('size-2 rounded-full', bar)} />
                  <Skeleton className={cn('h-3 rounded', bar, i === 0 ? 'w-24' : 'w-16')} />
                  <Skeleton className={cn('ml-auto h-3 w-10 rounded', bar)} />
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>

      <div className="rounded-3xl bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
          <h3 className="flex items-center gap-1.5 text-base font-normal">{kind === 'companies' ? 'Companies' : 'Departments'} <Skeleton className="h-4 w-5 rounded" /></h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{SPLIT_LABEL}</span>
            {[groups, ...(kind === 'companies' ? [] : [GROUPINGS]), VIEWS].map((options, n) => (
              <div key={n} className="inline-flex rounded-full bg-surface-2 p-0.5">
                {options.map((option, i) => <span key={option.key} className={cn('rounded-full px-3 py-1 text-xs', i === 0 ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{option.label}</span>)}
              </div>
            ))}
          </div>
        </div>
        <div className={cn(ROW, 'hidden border-y border-border/60 py-2 text-[11px] text-muted-foreground md:grid')}>
          <span>{kind === 'companies' ? COLUMNS.companies : COLUMNS.departments}</span>
          <span className="text-right">{COLUMNS.people}</span>
          <span>{CLASS_GROUPS[0].label}</span>
          <span />
        </div>
        <ul className="divide-y divide-border/60 border-t border-border/60 md:border-t-0">
          {Array.from({ length: count }, (_, i) => (
            <li key={i} className={cn(ROW, 'py-3.5')}>
              <span className="min-w-0">
                <Skeleton className={cn('h-4 rounded', i % 2 ? 'w-32' : 'w-44', 'max-w-full')} />
                <Skeleton className="mt-1.5 h-3 w-20 rounded" />
              </span>
              <span className="flex flex-col items-end">
                <Skeleton className="h-[18px] w-8 rounded" />
                <Skeleton className="mt-1 h-3 w-12 rounded" />
              </span>
              <span className="col-span-2 min-w-0 md:col-span-1">
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-40 max-w-full rounded" />
              </span>
              <span className="hidden justify-end md:flex"><ChevronRight aria-hidden className="size-4 text-muted-foreground/50" /></span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border/60 px-5 py-3 sm:px-6">
          <p className="text-[11px] text-muted-foreground">{COUNT_NOTE}</p>
        </div>
      </div>
    </section>
  )
}
