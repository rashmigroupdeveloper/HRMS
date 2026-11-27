import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

export type Shortcut = { to: string; icon: LucideIcon; title: string; text: string }

// A shortcut on a home page. The role home uses plain (name, line, arrow). Self-service keeps the icon.
export function QuickLink({ to, icon: Icon, title, text, plain = false }: Shortcut & { plain?: boolean }) {
  if (plain) {
    return (
      <Link to={to} className="group flex min-h-14 min-w-0 items-center justify-between gap-3 border-b border-border/60 py-2 outline-none transition-[background-color,scale] duration-100 hover:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985] motion-reduce:active:scale-100">
        <span className="min-w-0"><span className="block text-base font-medium tracking-tight">{title}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
        <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
      </Link>
    )
  }
  return (
    <Link to={to} className="group flex min-h-14 min-w-0 items-center gap-2 rounded-xl py-2 transition-colors outline-none hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2"><Icon aria-hidden className="size-4" /></span>
      <span className="min-w-0"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
    </Link>
  )
}
