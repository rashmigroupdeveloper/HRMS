import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type Option<T extends string> = { value: T; label: ReactNode }

// A segmented switch: the open chip travels from the option you were on. The words stay put - a second copy of the
// row is clipped to the chip, so the open label takes the chip's colour and the others stay muted. `cream` is the
// second-level switch on a grey track (SEGMENTS); `hero` is the charcoal pill used on Employee records.
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  tone = 'cream',
}: {
  value: T
  onChange: (value: T) => void
  options: readonly Option<T>[]
  label: string
  className?: string
  tone?: 'cream' | 'hero'
}) {
  const track = useRef<HTMLDivElement>(null)
  const buttons = useRef<Partial<Record<string, HTMLButtonElement>>>({})
  const [clip, setClip] = useState<string | null>(null)
  const [travel, setTravel] = useState(false)
  const hero = tone === 'hero'

  useLayoutEffect(() => {
    const root = track.current
    if (!root || !buttons.current[value]) return
    const measure = () => {
      const button = buttons.current[value]
      if (!button || !track.current) return
      const trackBox = track.current.getBoundingClientRect()
      const buttonBox = button.getBoundingClientRect()
      const top = buttonBox.top - trackBox.top
      const right = trackBox.right - buttonBox.right
      const bottom = trackBox.bottom - buttonBox.bottom
      const left = buttonBox.left - trackBox.left
      setClip(`inset(${top}px ${right}px ${bottom}px ${left}px round 999px)`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [value, options])

  useEffect(() => {
    if (!clip || travel) return
    const id = requestAnimationFrame(() => setTravel(true))
    return () => cancelAnimationFrame(id)
  }, [clip, travel])

  const chip = hero
    ? 'rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap'
    : 'rounded-full px-3 py-2.5 text-xs leading-4 font-medium whitespace-nowrap sm:py-1.5'

  return (
    <div
      ref={track}
      role="group"
      aria-label={label}
      className={cn(
        'relative flex w-fit max-w-full overflow-x-auto rounded-full bg-surface-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        hero ? 'gap-1 p-1' : 'gap-0.5 p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          ref={(node) => {
            if (node) buttons.current[option.value] = node
          }}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn('relative shrink-0 text-muted-foreground hover:text-foreground', chip)}
        >
          {option.label}
        </button>
      ))}
      {clip && (
        <div
          aria-hidden
          className={cn(
            'segment-thumb pointer-events-none absolute inset-0 flex font-medium',
            hero ? 'gap-1 bg-hero p-1 text-xs text-hero-foreground' : 'gap-0.5 bg-card p-0.5 text-xs leading-4 text-foreground',
          )}
          style={{ clipPath: clip, transition: travel ? 'clip-path 320ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }}
        >
          {options.map((option) => (
            <span key={option.value} className={cn('flex shrink-0 items-center justify-center', chip)}>
              {option.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
