import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// "Nothing here" - the same on every page: a hatched block with what is missing and, when it helps, what to do next
// (a line of text, or a button as `children`).
export function EmptyState({ title, hint, children, className }: { title: string; hint?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('u-hatch rounded-2xl px-4 py-10 text-center', className)}>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>}
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  )
}
