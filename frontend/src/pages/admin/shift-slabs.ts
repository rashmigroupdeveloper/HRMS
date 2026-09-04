/**
 * SHF-01 late / early-exit slabs from two operator numbers, not a JSON blob.
 * Empty thresholds keep the shift on existing half/full-hour rules only.
 */
export interface TimeSlabDraft {
  fromMin: number;
  toMin: number | null;
  effect: 'none' | 'late' | 'half_day';
}

export function slabsFromThresholds(lateUntilMin: number, halfDayAfterMin: number): TimeSlabDraft[] {
  const lateUntil = Math.max(0, Math.floor(lateUntilMin));
  const halfAfter = Math.max(0, Math.floor(halfDayAfterMin));
  if (lateUntil === 0 && halfAfter === 0) return [];

  const slabs: TimeSlabDraft[] = [];
  if (lateUntil > 0) {
    slabs.push({ fromMin: 0, toMin: lateUntil, effect: 'late' });
  }
  if (halfAfter > lateUntil) {
    slabs.push({ fromMin: lateUntil + 1, toMin: halfAfter, effect: 'late' });
    slabs.push({ fromMin: halfAfter + 1, toMin: null, effect: 'half_day' });
  } else if (halfAfter > 0) {
    slabs.push({ fromMin: halfAfter, toMin: null, effect: 'half_day' });
  }
  return slabs;
}

export function thresholdsFromSlabs(slabs: TimeSlabDraft[]): { lateUntil: number; halfDayAfter: number } {
  const firstLate = slabs.find((slab) => slab.effect === 'late' && slab.fromMin === 0 && slab.toMin !== null);
  const half = slabs.find((slab) => slab.effect === 'half_day');
  return {
    lateUntil: firstLate?.toMin ?? 0,
    halfDayAfter: half === undefined ? 0 : Math.max(0, half.fromMin - 1),
  };
}
