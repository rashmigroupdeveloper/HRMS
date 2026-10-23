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

export interface BudgetCostParts {
  airfarePaise: number;
  hotelPerNightPaise: number;
  hotelNights: number;
  dailyAllowancePerDayPaise: number;
  travelDays: number;
  visaCostPaise: number;
}

function utcMidnight(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) throw new DomainError('Date must be YYYY-MM-DD');
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Inclusive day count. 1 Jul through 5 Jul is 5 days. */
export function inclusiveTravelDays(start: string, end: string): number {
  const from = utcMidnight(start);
  const to = utcMidnight(end);
  if (to < from) throw new DomainError('End date cannot be before the start date');
  return Math.round((to - from) / 86_400_000) + 1;
}

function assertWholePaise(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError(`${label} must be a non-negative whole number of paise`);
  }
  return value;
}

/**
 * EMS budget total: lowest-logical airfare + hotel/night × nights
 * + daily allowance × inclusive travel days + visa.
 * Hand-checked: ₹1,000 airfare + ₹2,000 × 2 nights + ₹500 × 5 days = ₹7,500.
 */
export function budgetEstimatePaise(parts: BudgetCostParts): number {
  const airfare = assertWholePaise(parts.airfarePaise, 'Airfare');
  const hotelPerNight = assertWholePaise(parts.hotelPerNightPaise, 'Hotel budget per night');
  if (!Number.isInteger(parts.hotelNights) || parts.hotelNights < 0) {
    throw new DomainError('Hotel nights must be a non-negative whole number');
  }
  if (hotelPerNight > 0 && parts.hotelNights < 1) {
    throw new DomainError('Number of nights is required when a hotel budget per night is entered');
  }
  if (parts.hotelNights > 0 && hotelPerNight === 0) {
    throw new DomainError('Hotel budget per night is required when the number of nights is entered');
  }
  const allowancePerDay = assertWholePaise(parts.dailyAllowancePerDayPaise, 'Daily allowance');
  if (!Number.isInteger(parts.travelDays) || parts.travelDays < 1) {
    throw new DomainError('Travel days must be at least 1');
  }
  const visa = assertWholePaise(parts.visaCostPaise, 'Visa cost');
  const total = airfare + hotelPerNight * parts.hotelNights + allowancePerDay * parts.travelDays + visa;
  if (!Number.isSafeInteger(total)) throw new DomainError('Budget total is too large');
  return total;
}

/** Dates on a budget request must sit inside the travel month the employee picked. */
export function assertTravelMonth(month: string, start: string, end: string): void {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new DomainError('Travel month must be YYYY-MM');
  if (!start.startsWith(month) || !end.startsWith(month)) {
    throw new DomainError('Travel dates must fall within the selected travel month');
  }
}
