/**
 * Copy for the leave-apply sandwich preview (docs/05 §4.4).
 * Day counts themselves come from GET /leave/preview — never from the browser.
 */
export interface LeaveSkip {
  date: string;
  reason: 'holiday' | 'week_off';
}

export function sandwichPreviewCopy(
  sandwichRule: 'include' | 'exclude',
  skipped: readonly LeaveSkip[],
): string {
  if (sandwichRule === 'include') {
    return 'Sundays and holidays inside the span count (sandwich include)';
  }
  const holidays = skipped.filter((row) => row.reason === 'holiday').length;
  const weekOffs = skipped.filter((row) => row.reason === 'week_off').length;
  const parts: string[] = [];
  if (weekOffs > 0) {
    parts.push(`${String(weekOffs)} week-off${weekOffs === 1 ? '' : 's'} skipped`);
  }
  if (holidays > 0) {
    parts.push(`${String(holidays)} holiday${holidays === 1 ? '' : 's'} skipped`);
  }
  if (parts.length === 0) return 'Sundays and holidays inside the span are skipped';
  return parts.join(' · ');
}
