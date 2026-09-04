/** Shared YYYY-MM helpers for the manager team workspace. */

export function moveMonth(month: string, delta: number): string {
  const [year = 0, number = 1] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthDays(month: string): string[] {
  const [year = 0, number = 1] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
  );
}

export function monthTitle(month: string): string {
  const [year = 0, number = 1] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

/** Monday–Sunday ISO dates for the IST calendar week containing `today` (YYYY-MM-DD). */
export function istWeekDates(today: string): string[] {
  const [year, month, day] = today.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return [];
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utc.getTime())) return [];
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  });
}

export function monthRange(month: string): { from: string; to: string } {
  const days = monthDays(month);
  const from = days[0];
  const to = days[days.length - 1];
  return { from: from ?? `${month}-01`, to: to ?? `${month}-01` };
}
