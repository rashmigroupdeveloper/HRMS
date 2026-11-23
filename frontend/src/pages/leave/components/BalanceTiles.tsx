import { cn } from '@/lib/utils'
import type { Balance } from './labels'

// One tile per leave type: what can still be asked for (the balance less what waits for approval), with the balance, what
// waits and what was taken in the year beneath; leave without pay has no balance - its tile shows the days taken. A click
// picks the type (e.g. to apply for it).
export const TILES_GRID = 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6'

export function BalanceTiles({ balances, year, onPick }: { balances: Balance[]; year: number; onPick?: (typeId: number) => void }) {
  return (
    <div className={TILES_GRID}>
      {balances.map((b) => {
        const paid = b.available !== null
        const low = paid && b.available! <= 0
        return (
          <button
            key={b.leaveType.id}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(b.leaveType.id)}
            className="min-w-0 rounded-2xl bg-surface-2/60 px-3 py-2.5 text-left transition-shadow enabled:hover:shadow-card disabled:cursor-default"
          >
            <p className="flex items-baseline gap-1.5 text-xs">
              <span className="font-semibold">{b.leaveType.code}</span>
              <span className="truncate text-muted-foreground">{b.leaveType.name}</span>
            </p>
            <p className={cn('mt-0.5 text-2xl leading-8 font-light tabular-nums', low && 'text-muted-foreground')}>
              {paid ? b.available : b.taken}
              <span className="ml-1 text-xs text-muted-foreground">{paid ? 'available' : `taken in ${year}`}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {paid ? [`${b.balance} balance`, b.pending ? `${b.pending} waiting` : null, b.taken ? `${b.taken} taken` : null].filter(Boolean).join(' · ') : 'No balance - unpaid'}
            </p>
          </button>
        )
      })}
    </div>
  )
}
