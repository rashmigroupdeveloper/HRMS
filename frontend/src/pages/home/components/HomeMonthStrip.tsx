import { HomeStripSkeleton } from '@/components/skeletons/home/HomeWidgetsSkeleton'
import type { Overview } from '@/pages/attendance/components/labels'
import { type Segment, SegmentStrip } from './HomeParts'
import { MONTH_STRIP, shortDay } from './home-labels'
import { useMyDays } from './useMyDays'

// The employee's attendance month as one strip under the greeting (2026-11-27, Crextio's segmented strip): days present,
// on leave, absent or missed, off (weekly offs and holidays) and still to come, each as wide as its share of the month.
export function HomeMonthStrip({ overview }: { overview: Overview | undefined }) {
  const my = useMyDays(overview)
  const month = my.month
  if (!overview || my.pending || !month) return <HomeStripSkeleton />
  const t = month.totals
  const toCome = month.days.filter((d) => d.employed && d.date > overview.today.date).length
  const values = [t.present + t.onDuty, t.leave, t.absent + t.missedPunch, t.weeklyOff + t.holiday, toCome]
  const tones: Segment['tone'][] = ['dark', 'gold', 'outline', 'grey', 'hatched']
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-muted-foreground">Your attendance month · {shortDay(month.from)} – {shortDay(month.to)}</p>
      <SegmentStrip label="Your attendance month in days" segments={MONTH_STRIP.map((label, i) => ({ label, value: values[i]!, tone: tones[i]! }))} />
    </div>
  )
}
