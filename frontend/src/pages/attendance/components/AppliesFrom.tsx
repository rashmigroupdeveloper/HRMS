import { Pill } from '@/components/Pill'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, fromDateInput, todayDay } from '@/lib/utils'

// "Applies from" in an edit form of something dated (a shift's times, a pattern's days - 2026-11-23): the days before the
// date keep what they had; a date already passed works the days from it up to today out again
export function AppliesFrom({ id, what, value, onChange }: { id: string; what: string; value: string; onChange: (value: string) => void }) {
  const past = !!value && fromDateInput(value)! < todayDay()
  return (
    <div className="space-y-1 rounded-2xl bg-gold-soft/40 p-3">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        The new {what} apply from
      </Label>
      <Input id={id} type="date" className="h-9 w-48 rounded-xl" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">
        Days before this date keep the {what} they had.{past ? ' The days from this date up to today are worked out again now.' : ''}
      </p>
    </div>
  )
}

// on a list row: a change already set for a later date
export function UpcomingPill({ versions }: { versions: { effectiveFrom: Date; upcoming: boolean }[] }) {
  const next = versions.find((v) => v.upcoming)
  return next ? (
    <Pill tone="info" className="ml-2">
      Changes {formatDate(next.effectiveFrom)}
    </Pill>
  ) : null
}
