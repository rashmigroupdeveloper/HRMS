/**
 * Bottom-bar tabs per role family (docs/08 §3 + docs/05 §7 adaptive nav).
 * Phones get the 3–4 destinations each role opens daily; everything else is
 * one tap away under More, and the centre button opens quick actions.
 */
import type { NavItem } from './nav-config';

const ORDERS: Record<string, readonly string[]> = {
  ceo: ['/executive', '/', '/reports', '/approvals', '/people'],
  ops: ['/', '/approvals', '/people', '/attendance', '/payroll', '/reports'],
  manager: ['/', '/approvals', '/my/team', '/my/attendance', '/my/leave'],
  ess: ['/', '/my/attendance', '/my/leave', '/my/pay', '/my/claims'],
};

function family(catalog: NavItem[]): keyof typeof ORDERS {
  if (catalog[0]?.to === '/executive') return 'ceo';
  if (catalog.some((item) => item.group !== undefined)) return 'ops';
  if (catalog.some((item) => item.to === '/my/team' || item.to === '/approvals')) return 'manager';
  return 'ess';
}

export function bottomTabs(catalog: NavItem[], max: number): NavItem[] {
  const order = ORDERS[family(catalog)] ?? [];
  const byTo = new Map(catalog.map((item) => [item.to, item]));
  const tabs: NavItem[] = [];
  for (const to of order) {
    const item = byTo.get(to);
    if (item && tabs.length < max) tabs.push(item);
  }
  for (const item of catalog) {
    if (tabs.length >= max) break;
    if (item.section !== 'secondary' && !tabs.includes(item)) tabs.push(item);
  }
  return tabs;
}

/** Short labels for the 11px bar ("My Attendance" → "Attendance"). */
export function tabLabel(item: NavItem): string {
  // Phone tabs get ≤ 9 characters so six slots fit at 360px without truncation.
  const short: Record<string, string> = {
    '/': 'Home',
    '/approvals': 'Inbox',
    '/my/team': 'Team',
    '/attendance': 'Muster',
    '/my/attendance': 'Punch',
    '/executive': 'Group',
    '/helpdesk': 'Help',
  };
  return short[item.to] ?? item.label.replace(/^My /, '');
}
