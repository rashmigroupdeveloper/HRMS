import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

// Keep field labels/layout in sync with MovementReportSettings.
export function MovementSettingsSkeleton({ label = 'Loading email settings' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-4">
    <div className="space-y-1.5"><Label>HR Head role</Label><Skeleton className="h-9 w-full" /><p className="text-xs text-muted-foreground">Requires Employee directory &amp; job View access. Selecting a role does not grant access.</p></div>
    <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Send time · IST</Label><Skeleton className="h-9 w-full" /></div><div className="space-y-1.5"><Label>Report covers</Label><Skeleton className="h-9 w-full" /></div></div>
    <div className="flex min-h-9 items-center gap-2"><Skeleton className="size-4" /><p className="text-sm">Send a summary on days with no movements</p></div>
  </div>
}
