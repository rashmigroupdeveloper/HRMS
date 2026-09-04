/**
 * PRV-06 — pure retention predicate.
 *
 * A row is purgeable only when it is past its retention window AND no active
 * legal hold covers it. Holds already scoped to the employee (and optionally
 * the data class) are passed in; this function never talks to the database.
 */
export interface HoldFlag {
  /** null = still active */
  releasedAt: Date | null;
}

/** Calendar-day age of `rowDate` relative to `asOf` (UTC midnight of each). */
function ageDays(rowDate: Date, asOf: Date): number {
  const row = Date.UTC(rowDate.getUTCFullYear(), rowDate.getUTCMonth(), rowDate.getUTCDate());
  const now = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.floor((now - row) / 86_400_000);
}

/**
 * @returns true when the row may be removed under the given retention rule
 *          and hold set. Active holds (releasedAt === null) always win.
 */
export function wouldPurge(
  rowDate: Date,
  retentionDays: number,
  holds: readonly HoldFlag[],
  asOf: Date = new Date(),
): boolean {
  if (retentionDays <= 0) return false;
  if (holds.some((h) => h.releasedAt === null)) return false;
  return ageDays(rowDate, asOf) > retentionDays;
}
