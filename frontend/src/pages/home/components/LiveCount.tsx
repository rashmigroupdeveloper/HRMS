import { useState } from 'react'
import { cn } from '@/lib/utils'

// A number on a home widget that glows once when a refresh changes it (2026-11-27) - "2 not in yet" becoming "1" is
// worth noticing; the first value just appears. (Reduced motion: no glow - index.css .home-changed.)
export function LiveCount({ value, className }: { value: number; className?: string }) {
  const [seen, setSeen] = useState(value)
  const [changes, setChanges] = useState(0)
  if (seen !== value) {
    setSeen(value)
    setChanges(changes + 1)
  }
  return (
    <span key={changes} className={cn(changes > 0 && 'home-changed', className)}>
      {value}
    </span>
  )
}
