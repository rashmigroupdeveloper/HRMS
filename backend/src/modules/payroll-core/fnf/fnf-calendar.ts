/**
 * SOW 10.2: two full-and-final cycles each month, and a 3-working-day
 * turnaround measured from tat_due_date.
 */
export interface FnfCycle {
  cycle: 1 | 2;
  opens: string;
  closes: string;
}

export type FnfTatState = 'on_track' | 'due_today' | 'overdue' | 'closed';

export function fnfCycles(month: string): FnfCycle[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error('Month must be YYYY-MM');
  const year = Number(match[1]);
  const mon = Number(match[2]);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const mm = match[2] ?? '01';
  return [
    { cycle: 1, opens: `${String(year)}-${mm}-01`, closes: `${String(year)}-${mm}-15` },
    { cycle: 2, opens: `${String(year)}-${mm}-16`, closes: `${String(year)}-${mm}-${String(last).padStart(2, '0')}` },
  ];
}

export function fnfCycleForDate(iso: string): 1 | 2 {
  return Number(iso.slice(8, 10)) <= 15 ? 1 : 2;
}

export function fnfTatState(due: string | null, today: string, status: string): FnfTatState {
  if (status === 'paid' || status === 'approved') return 'closed';
  if (!due) return 'on_track';
  if (today < due) return 'on_track';
  if (today === due) return 'due_today';
  return 'overdue';
}
