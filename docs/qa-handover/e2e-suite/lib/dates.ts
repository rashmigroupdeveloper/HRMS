/** Date helpers so flows never depend on the calendar day the suite runs (IST business dates). */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export interface Day { iso: string; label: string; rx: string; date: Date }
function istToday(): Date {
  const t = new Date(Date.now() + 5.5 * 3600_000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}
function mk(d: Date): Day {
  return { date: d, iso: d.toISOString().slice(0, 10), label: `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    /** regex source matching the label with or without a leading zero ("2 Nov 2026" / "02 Nov 2026") */
    rx: `0?${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
}
const weekday = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
/** The n-th Mon–Fri strictly before today (n=1 → most recent past weekday). */
export function recentWeekday(n = 1): Day {
  const d = istToday();
  for (let k = 0; k < n; ) { d.setUTCDate(d.getUTCDate() - 1); if (weekday(d)) k++; }
  return mk(d);
}
/** First Mon–Fri at least `minDays` ahead; `plus` adds that many further weekdays (for ranges). */
export function futureWeekday(minDays = 7, plus = 0): Day {
  const d = istToday(); d.setUTCDate(d.getUTCDate() + minDays);
  while (!weekday(d)) d.setUTCDate(d.getUTCDate() + 1);
  for (let k = 0; k < plus; ) { d.setUTCDate(d.getUTCDate() + 1); if (weekday(d)) k++; }
  return mk(d);
}
