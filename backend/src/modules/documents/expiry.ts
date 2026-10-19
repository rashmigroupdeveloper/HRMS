/** DOC-03/CMP-16: DATE values are UTC calendar dates; today's business day is IST. */
import { istDateString } from '../../core/dates.js';
export interface ExpiryView {
  state: 'perpetual' | 'valid' | 'expiring' | 'expired';
  daysRemaining: number | null;
  stage: number | null;
}
export function parseAlertStages(raw: string): number[] {
  const parts = raw.split(',').map((value) => Number(value.trim()));
  if (parts.some((value) => !Number.isInteger(value) || value <= 0))
    throw new Error('Invalid document expiry alert stages');
  return [...new Set(parts)].sort((a, b) => b - a);
}
export function documentExpiry(
  expires: Date | null,
  today: Date,
  stages: readonly number[],
): ExpiryView {
  if (!expires) return { state: 'perpetual', daysRemaining: null, stage: null };
  const expiryDay = expires.toISOString().slice(0, 10);
  const daysRemaining = Math.round(
    (Date.parse(expiryDay) - Date.parse(istDateString(today))) / 86_400_000,
  );
  if (daysRemaining < 0) return { state: 'expired', daysRemaining, stage: null };
  const stage = [...stages].sort((a, b) => a - b).find((days) => daysRemaining <= days) ?? null;
  return { state: stage === null ? 'valid' : 'expiring', daysRemaining, stage };
}
