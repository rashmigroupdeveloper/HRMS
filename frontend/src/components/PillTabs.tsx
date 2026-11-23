import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// The tabs of a page: a white pill, the open tab dark. Always ONE line - when the tabs do not fit (a phone, a
// profile with twelve tabs) the pill scrolls sideways: the open tab is brought into view (when the page opens on it,
// when the screen changes width, and when you pick one) and the side with more tabs fades out, so it is clear there
// are more. It never wraps (wrapped rows fell outside the pill and over the page).
// Only sideways: with overflow-x alone the browser also let it scroll up and down by a pixel or two (2026-11-17).
export function PillTabsList({ className, ...props }: ComponentProps<typeof TabsList>) {
  const list = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ left: false, right: false })

  useEffect(() => {
    const el = list.current
    if (!el) return
    const measure = () => {
      const left = el.scrollLeft > 2
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
      setMore((was) => (was.left === left && was.right === right ? was : { left, right }))
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
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [])

  const fade = more.left || more.right ? `linear-gradient(to right, ${more.left ? 'transparent, #000 2rem' : '#000'}, ${more.right ? '#000 calc(100% - 2rem), transparent' : '#000'})` : undefined
  return (
    <div className={cn('inline-flex max-w-full rounded-full bg-card p-1 shadow-card', className)}>
      <TabsList
        ref={list}
        style={{ maskImage: fade }}
        className="relative max-w-full justify-start gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-full bg-transparent p-0 [scrollbar-width:none] group-data-horizontal/tabs:h-auto [&::-webkit-scrollbar]:hidden"
        {...props}
      />
    </div>
  )
}

export function PillTabsTrigger({ className, onClick, ...props }: ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        // after:hidden - the base tab's hidden underline sits 5px below the tab and made the pill scroll up and down
        'h-auto flex-none rounded-full px-4 py-2 after:hidden sm:py-1.5 data-active:bg-hero data-active:text-hero-foreground data-active:hover:text-hero-foreground',
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
