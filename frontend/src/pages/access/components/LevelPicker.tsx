import { useId } from 'react'
import type { AccessLevel } from '@/hooks/useAccess'
import { cn } from '@/lib/utils'
import { LEVEL_LABEL } from './labels'

const CHOICES: (AccessLevel | 'NONE')[] = ['NONE', 'READ', 'WRITE']

// No access / View / Edit as one pill-shaped radio group. Used in the access grid and in the role dialog.
export function LevelPicker({
  label,
  value,
  onChange,
  isAllowed = () => true,
  disabled = false,
  size = 'md',
  choices = CHOICES,
}: {
  // what the group is for, read out by screen readers (e.g. "Onboarding")
  label: string
  value: AccessLevel | 'NONE'
  onChange: (level: AccessLevel | 'NONE') => void
  // false = this person may not give that level (shown greyed out)
  isAllowed?: (level: AccessLevel | 'NONE') => boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  // the choices shown (default: No access / View / Edit) - e.g. only View / Edit for a data-access row
  choices?: (AccessLevel | 'NONE')[]
}) {
  const name = useId()
  return (
    // sm (the access grid): 32 px tall in all, 40 px on a phone
    <div role="radiogroup" aria-label={label} className={cn('inline-flex gap-0.5 rounded-full bg-card shadow-card', size === 'sm' ? 'p-0.5' : 'p-1')}>
      {choices.map((choice) => {
        const allowed = isAllowed(choice)
        return (
          <label key={choice} title={allowed ? undefined : 'You can only give access you have yourself'} className="relative cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-40">
            <input className="peer sr-only" type="radio" name={name} value={choice} checked={value === choice} disabled={disabled || !allowed} onChange={() => onChange(choice)} />
            <span className={cn('flex min-h-9 items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
              'rounded-full whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'h-9 px-3 text-xs md:h-7 md:px-2' : 'px-3.5 py-1.5 text-xs',
              value === choice
                ? cn(
                    'font-medium',
                    choice === 'WRITE'
                      ? 'bg-positive/25 text-positive-ink'
                      : choice === 'READ'
                        ? 'bg-info/25 text-info-ink'
                        : size === 'sm'
                          ? 'bg-foreground/10 text-foreground'
                          : 'bg-hero text-hero-foreground',
                  )
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {size === 'sm' && choice === 'NONE' ? 'None' : LEVEL_LABEL[choice]}
            </span>
          </label>
        )
      })}
    </div>
  )
}
