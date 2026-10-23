import type { StatusTone } from '../../ui';

export type TravelSection = 'budgets' | 'create' | 'claims' | 'claim' | 'advances' | 'advance' | 'wallet';

export interface BudgetItem {
  id: number;
  referenceNo: string;
  tripName: string;
  travelType: 'domestic' | 'international';
  destinationRegion?: string;
  purpose: string;
  destinationCity: string;
  originCity?: string | null;
  travelMonth?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  estimatedBudgetPaise: number;
  approvedBudgetPaise: number;
  airfarePaise?: number;
  hotelPerNightPaise?: number;
  hotelNights?: number;
  dailyAllowancePerDayPaise?: number;
  visaCostPaise?: number;
}

export interface AdvanceItem {
  id: number;
  tripId: number;
  amountPaise: number;
  purpose: string;
  status: string;
  createdAt: string;
}

export interface ClaimItem {
  id: number;
  referenceNo: string;
  tripId: number;
  totalClaimedPaise: number;
  netPayablePaise: number;
  netRecoverablePaise: number;
  status: string;
  settlementStatus: string;
  createdAt: string;
}

export interface WalletLedgerItem {
  id: number;
  source: string;
  type: 'credit' | 'debit';
  amountPaise: number;
  balanceAfterPaise: number;
  transactionReference: string;
  createdAt: string;
}

export const SECTIONS: { id: TravelSection; label: string; to: string }[] = [
  { id: 'create', label: 'Create Budget', to: '/travel/budgets/new' },
  { id: 'budgets', label: 'My Budgets', to: '/travel/budgets' },
  { id: 'claim', label: 'Claim Expense', to: '/travel/claims/new' },
  { id: 'claims', label: 'My Claims', to: '/travel/claims' },
  { id: 'advance', label: 'Claim Advance', to: '/travel/advances/new' },
  { id: 'advances', label: 'My Advances', to: '/travel/advances' },
  { id: 'wallet', label: 'Wallet', to: '/travel/wallet' },
];

export function sectionFromPath(path: string): TravelSection {
  if (path.startsWith('/travel/budgets/new')) return 'create';
  if (path.startsWith('/travel/claims/new')) return 'claim';
  if (path.startsWith('/travel/claims')) return 'claims';
  if (path.startsWith('/travel/advances/new')) return 'advance';
  if (path.startsWith('/travel/advances')) return 'advances';
  if (path.startsWith('/travel/wallet')) return 'wallet';
  return 'budgets';
}

export function dayOf(value: string): string {
  return value.slice(0, 10);
}

/** Rupee text to integer paise. Empty is 0. Rejects more than two decimals. */
export function rupeesToPaise(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ''] = text.split('.');
  const paise = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return Number.isSafeInteger(paise) ? paise : null;
}

export function formatPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}₹${rupees.toLocaleString('en-IN')}.${frac}`;
}

export function inclusiveDays(start: string, end: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 0;
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (ys === undefined || ms === undefined || ds === undefined || ye === undefined || me === undefined || de === undefined) return 0;
  const from = Date.UTC(ys, ms - 1, ds);
  const to = Date.UTC(ye, me - 1, de);
  if (to < from) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
}

export function monthBounds(month: string): { min: string; max: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { min: `${month}-01`, max: `${month}-${String(last).padStart(2, '0')}` };
}

export function monthOptions(now = new Date()): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let offset = -1; offset <= 11; offset += 1) {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
    const value = `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
    options.push({ value, label });
  }
  return options;
}

export function statusTone(status: string): StatusTone {
  if (status === 'approved' || status === 'disbursed' || status === 'settled') return 'positive';
  if (status === 'rejected' || status === 'cancelled') return 'negative';
  return 'warning';
}

export function budgetLabel(budget: BudgetItem): string {
  const from = budget.originCity ? `${budget.originCity} to ` : '';
  const when = budget.travelMonth ?? dayOf(budget.startDate);
  return `${budget.referenceNo} · ${from}${budget.destinationCity} · ${when}`;
}

export function isApprovedBudget(budget: BudgetItem): boolean {
  return budget.status === 'approved' && budget.approvedBudgetPaise > 0;
}
