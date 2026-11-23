import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// the org chart's colour per level (the cards' left edge) - the same as OrgChartView
const LEVEL = ['border-l-gold', 'border-l-info', 'border-l-positive', 'border-l-warning']
// the joining lines of a team member - the same classes as the chart's branches (the classic CSS tree)
const BRANCH =
  'relative flex flex-col items-center px-2 pt-5 before:absolute before:top-0 before:right-1/2 before:h-5 before:w-1/2 before:border-t before:border-border after:absolute after:top-0 after:left-1/2 after:h-5 after:w-1/2 after:border-t after:border-l after:border-border first:before:border-0 last:after:border-0 last:before:border-r only:pt-5 only:before:hidden only:after:block only:after:border-t-0 only:after:border-l'
const NAME = ['w-32', 'w-28', 'w-36', 'w-24']
const ROLE = ['w-24', 'w-32', 'w-20', 'w-28']

// Loading placeholder for the org chart, drawn with the chart's own cards and lines: a person's card on top (`root`) with
// its team count and the line down to a row of `team` cards - or, without `root`, only the row (a team opening under a
// card already drawn, `depth` = the team's level for the cards' coloured edge).
export function OrgChartSkeleton({
  team = 3,
  root = true,
  depth = 0,
  label = 'Loading',
  className,
}: {
  team?: number
  root?: boolean
  depth?: number
  label?: string
  className?: string
}) {
  const row = (
    <ul className="flex justify-center">
      {Array.from({ length: team }, (_, i) => (
        <li key={i} className={BRANCH}>
          <Card level={root ? depth + 1 : depth} index={i} />
        </li>
      ))}
    </ul>
  )
  return (
    <div role="status" aria-label={label} className={cn(root && 'inline-block min-w-full', className)}>
      {root ? (
        <div className="mx-auto flex w-max flex-col items-center px-2">
          <Card level={depth} index={0} />
          <span aria-hidden className="h-2 w-px bg-border" />
          <span className="flex h-4.5 min-w-7 items-center justify-center rounded-md border bg-card px-1.5 shadow-card">
            <Skeleton className="h-2.5 w-3 rounded-full" />
          </span>
          <span aria-hidden className="h-5 w-px bg-border" />
          {row}
        </div>
      ) : (
        row
      )}
    </div>
  )
}

// a person's card: the round initials, the name, the designation and the code - as the chart draws them
function Card({ level, index }: { level: number; index: number }) {
  return (
    <div className={cn('flex w-60 items-center gap-2.5 rounded-xl border border-l-4 bg-card px-3 py-2 shadow-card', LEVEL[level % LEVEL.length])}>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <span className="flex h-5 items-center">
          <Skeleton className={cn('h-3.5 rounded-full', NAME[index % NAME.length])} />
        </span>
        <span className="flex h-4 items-center">
          <Skeleton className={cn('h-3 rounded-full', ROLE[index % ROLE.length])} />
        </span>
        <span className="flex h-4 items-center">
          <Skeleton className="h-3 w-16 rounded-full" />
        </span>
      </div>
    </div>
  )
}
