import { cn, initialsOf } from '@/lib/utils'

// An HOD's initials in a round tile. Each HOD keeps the same soft tint everywhere on the tab (picked from their code), so
// "AK" on the places map is the same "AK" as in the list. Neutral tints only - amber and green mean "needs an HOD" and
// "complete" on this tab. `inverted`: on a dark (selected) row.
const TINTS = ['bg-info/15 text-info-ink', 'bg-foreground/10 text-foreground', 'bg-surface-2 text-muted-foreground']
const SIZES = { xs: 'size-6 text-xs tracking-tighter', sm: 'size-8 text-xs', md: 'size-10 text-sm' }

function tintOf(code: string) {
  let hash = 0
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TINTS[hash % TINTS.length]
}

export function HodAvatar({ name, code, size = 'sm', inverted, className }: { name: string; code: string; size?: keyof typeof SIZES; inverted?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold tracking-tight',
        SIZES[size],
        inverted ? 'bg-hero-foreground/10 text-hero-foreground' : tintOf(code),
        className,
      )}
    >
      {initialsOf(name) || '?'}
    </span>
  )
}
