/**
 * Pure date and validation utilities for Travel & Expense (M13).
 * Kept in a dedicated utility module to avoid circular dependency cycles between
 * travel.service and settlement.service under ESM/bundler module evaluation.
 */
import { DomainError } from '../../core/errors/index.js';

export function isoDay(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function assertDate(value: string, label: string): string {
  const d = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new DomainError(`${label} must be a valid date in YYYY-MM-DD format`);
  return d;
}

export function assertWithinTrip(trip: { start_date: Date | string; end_date: Date | string }, day: string, label: string): void {
  if (day < isoDay(trip.start_date) || day > isoDay(trip.end_date)) {
    throw new DomainError(`${label} must fall within the trip dates (${isoDay(trip.start_date)} to ${isoDay(trip.end_date)})`);
  }
}
