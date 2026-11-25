import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

export type Shortcut = { to: string; icon: LucideIcon; title: string; text: string }

// A shortcut on a home page: an icon, a title and a line - both homes (/ess and /manage)
export function QuickLink({ to, icon: Icon, title, text }: Shortcut) {
  return (
    <Link to={to} className="group flex min-h-14 min-w-0 items-center gap-2 rounded-xl py-2 transition-colors outline-none hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2"><Icon aria-hidden className="size-4" /></span>
      <span className="min-w-0"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
    </Link>
  )
}
