import type { QueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, CalendarDays, CalendarPlus, Clock3, Fingerprint, type LucideIcon } from 'lucide-react'
import { type client, orpc } from '@/lib/orpc'

// The Approvals page's kind tabs and the look of each kind of request (the user, 2026-11-22: "add tabs for different
// approvals") - one per approval feature, in the order HR meets them. Shared with the page's skeleton.

// a request of any of the page's lists - "Decided by me" adds the viewer's own decision
export type ApprovalRow = Awaited<ReturnType<typeof client.approvals.listToDecide>>[number] & {
  decision?: Awaited<ReturnType<typeof client.approvals.listDecided>>[number]['decision']
}
export type ApprovalFeature = ApprovalRow['feature']
// which tab a list is on: decide (Waiting for me - with Approve / Reject), decided (Decided by me), mine (Raised by me), held
export type ListMode = 'decide' | 'decided' | 'mine' | 'held'

// the grid of a request row (RequestList) - its skeleton draws the same
export const ROW_GRID = 'lg:grid-cols-[minmax(0,16.5rem)_minmax(0,1fr)_minmax(0,13rem)_7.5rem_auto]'

export const REQUEST_KINDS: { feature: ApprovalFeature; tab: string; icon: LucideIcon; tint: string }[] = [
  { feature: 'LEAVE', tab: 'Leave', icon: CalendarDays, tint: 'bg-positive/15 text-positive-ink' },
  { feature: 'REGULARIZATION', tab: 'Regularization & OD', icon: Fingerprint, tint: 'bg-info/15 text-info-ink' },
  { feature: 'COMP_OFF', tab: 'Comp off', icon: CalendarPlus, tint: 'bg-gold-soft text-foreground' },
  { feature: 'SHIFT_CHANGE', tab: 'Shift change', icon: Clock3, tint: 'bg-warning/15 text-warning-ink' },
  { feature: 'JOB_CHANGE', tab: 'Job & salary', icon: BriefcaseBusiness, tint: 'bg-surface-2 text-foreground' },
]

export const kindOf = (feature: ApprovalFeature) => REQUEST_KINDS.find((k) => k.feature === feature) ?? REQUEST_KINDS[0]

// A decision changes the feature's own records too - every list that shows them loads again
export function refreshAfterDecision(queryClient: QueryClient) {
  for (const key of [orpc.approvals.key(), orpc.jobChanges.key(), orpc.leave.key(), orpc.attendance.key(), orpc.employees.key()]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}
