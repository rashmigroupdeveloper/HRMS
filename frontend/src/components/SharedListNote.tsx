import { type AccessArea, useAccess } from '@/hooks/useAccess'
import { cn } from '@/lib/utils'

// One line on a list shared by every company (shifts, joining task types, letter templates, roles...) for someone whose
// Edit covers only part of the group: why the list is view only for them (B13, 2026-11-21 - the pages offered buttons the
// backend refused). Nothing for everyone else. `label` is the area's name as the Roles page shows it.
export function SharedListNote({ area, label, what = 'changing it', className }: { area: AccessArea; label: string; what?: string; className?: string }) {
  const { can, coversGroup } = useAccess()
  if (!can(area, 'WRITE') || coversGroup(area)) return null
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Shared by every company - {what} needs {label}: Edit for all companies.
    </p>
  )
}
