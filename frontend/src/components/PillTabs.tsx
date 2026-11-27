import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type TriggerProps = { className?: string; children?: ReactNode; value?: string }
type Box = { left: number; top: number; width: number; height: number }
type Frame = { clip: string; width: number; height: number; boxes: Box[] }

// The open tab is a charcoal pill that travels from the tab you were on. The words stay put: a light copy of the
// same row is clipped to the pill, so the open label is light and the others stay dark. Always ONE line - when the
// tabs do not fit (a phone, a profile with twelve tabs) the pill scrolls sideways: the open tab is brought into
// view (when the page opens on it, when the screen changes width, and when you pick one) and the side with more
// tabs fades out, so it is clear there are more. It never wraps (wrapped rows fell outside the pill and over the page).
// Only sideways: with overflow-x alone the browser also let it scroll up and down by a pixel or two (2026-11-17).
export function PillTabsList({ className, children, ...props }: ComponentProps<typeof TabsList>) {
  const list = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ left: false, right: false })
  const [frame, setFrame] = useState<Frame | null>(null)
  const [travel, setTravel] = useState(false)
  const triggers = Children.toArray(children).filter((child): child is ReactElement<TriggerProps> => isValidElement<TriggerProps>(child) && child.props.value !== undefined)

  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const measure = () => {
      const left = el.scrollLeft > 2
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
      setMore((was) => (was.left === left && was.right === right ? was : { left, right }))
      const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')]
      const active = tabs.find((tab) => tab.hasAttribute('data-active'))
      if (!active || tabs.length === 0) return
      const boxes = tabs.map((tab) => ({ left: tab.offsetLeft, top: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight }))
      const contentWidth = boxes[boxes.length - 1]!.left + boxes[boxes.length - 1]!.width
      const clip = `inset(${active.offsetTop}px ${contentWidth - active.offsetLeft - active.offsetWidth}px ${el.clientHeight - active.offsetTop - active.offsetHeight}px ${active.offsetLeft}px round 999px)`
      const height = el.clientHeight
      setFrame((was) => (was && was.clip === clip && was.width === contentWidth && was.height === height ? was : { clip, width: contentWidth, height, boxes }))
    }
    // scroll the pill, never the page
    const showActive = () => {
      const active = el.querySelector<HTMLElement>('[data-active]')
      if (active && el.scrollWidth > el.clientWidth) el.scrollLeft = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
      measure()
    }
    showActive()
    const observer = new ResizeObserver(showActive)
    observer.observe(el)
    const changes = new MutationObserver(measure)
    changes.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-active'] })
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      changes.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [])

  useEffect(() => {
    if (!frame || travel) return
    const id = requestAnimationFrame(() => setTravel(true))
    return () => cancelAnimationFrame(id)
  }, [frame, travel])

  const fade = more.left || more.right ? `linear-gradient(to right, ${more.left ? 'transparent, #000 2rem' : '#000'}, ${more.right ? '#000 calc(100% - 2rem), transparent' : '#000'})` : undefined
  return (
    <div className={cn('inline-flex max-w-full rounded-full bg-card p-1 shadow-card', className)}>
      <TabsList
        ref={list}
        style={{ maskImage: fade }}
        className="relative max-w-full justify-start gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-full bg-transparent p-0 [scrollbar-width:none] group-data-horizontal/tabs:h-auto [&::-webkit-scrollbar]:hidden"
        {...props}
      >
        {children}
        {frame && frame.boxes.length === triggers.length && (
          <div
            aria-hidden
            className="segment-thumb pointer-events-none absolute top-0 left-0 bg-hero text-sm font-medium text-hero-foreground"
            style={{ width: frame.width, height: frame.height, clipPath: frame.clip, transition: travel ? 'clip-path 320ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }}
          >
            {triggers.map((child, index) => (
              <span key={child.key ?? index} className={cn('absolute flex items-center justify-center gap-1.5 whitespace-nowrap [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4', child.props.className)} style={frame.boxes[index]}>
                {child.props.children}
              </span>
            ))}
          </div>
        )}
      </TabsList>
    </div>
  )
}

export function PillTabsTrigger({ className, onClick, ...props }: ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        // after:hidden - the base tab's hidden underline sits 5px below the tab and made the pill scroll up and down.
        // The black is the traveling pill in PillTabsList, so the tab itself stays clear.
        'h-auto flex-none rounded-full bg-transparent px-4 py-2 after:hidden sm:py-1.5 data-active:bg-transparent data-active:shadow-none',
        className,
      )}
      onClick={(event) => {
        event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        onClick?.(event)
      }}
      {...props}
    />
  )
}
