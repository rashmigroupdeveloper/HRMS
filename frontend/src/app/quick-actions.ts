/**
 * The top mobile jobs (docs/05 §4.9 PWA surface, §6 kill-list #1: daily
 * actions ≤ 2 taps). Permission-driven like the nav — never role-hardcoded.
 * Each action deep-links with `?action=` so the target page opens the right
 * drawer directly (one tap from anywhere, a second to submit).
 */
import type { LucideIcon } from 'lucide-react';
import { CalendarCheck, CheckCheck, Fingerprint, LifeBuoy, Palmtree, ReceiptText, Wallet } from 'lucide-react';
import type { SessionUser } from '../lib/session';
import { hasAnyPermission, hasPermission, hasRole } from '../lib/session';

export interface QuickAction {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: LucideIcon;
  /** The one gold action in the sheet (docs/05 §1 rule 2). */
  primary?: boolean;
}

const APPROVAL_PERMS = ['leave.approve', 'ar.approve', 'od.approve', 'ot.approve', 'claims.approve'] as const;

export function quickActionsFor(user: SessionUser): QuickAction[] {
  const actions: QuickAction[] = [];
  const isOps = ['hr_ops', 'hr_head', 'payroll_admin', 'plant_head', 'super_admin', 'ceo_cell'].some((role) =>
    hasRole(user, role),
  );
  const canApprove = hasAnyPermission(user, APPROVAL_PERMS);
  const ess = hasPermission(user, 'attendance.own') && !isOps;

  if (canApprove) {
    actions.push({ id: 'approve', label: 'Approve requests', hint: 'Leave, regularisation, OT, claims', to: '/approvals', icon: CheckCheck, primary: true });
  }
  if (ess) {
    actions.push({ id: 'punch', label: 'Today’s attendance', hint: 'Swipes, shift and status', to: '/my/attendance', icon: Fingerprint, primary: !canApprove });
    actions.push({ id: 'leave', label: 'Apply leave', hint: 'Live balance as you pick dates', to: '/my/leave?action=apply', icon: Palmtree });
    actions.push({ id: 'regularise', label: 'Regularise a day', hint: 'Missed swipe or official duty', to: '/my/attendance?action=request', icon: CalendarCheck });
  }
  if (hasPermission(user, 'employee.compensation.read') && !isOps) {
    actions.push({ id: 'payslip', label: 'View payslip', hint: 'This month and YTD tax', to: '/my/pay', icon: Wallet });
  }
  if (ess && !hasRole(user, 'it_admin')) {
    actions.push({ id: 'claim', label: 'Raise a claim', hint: 'Snap the bill with your camera', to: '/my/claims?action=new', icon: ReceiptText });
  }
  if (!isOps || hasPermission(user, 'helpdesk.agent')) {
    actions.push({ id: 'ticket', label: 'Ask HR / IT', hint: 'Raise a helpdesk ticket', to: '/helpdesk', icon: LifeBuoy });
  }
  return actions;
}
