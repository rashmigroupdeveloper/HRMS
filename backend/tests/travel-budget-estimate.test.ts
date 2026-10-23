import { describe, expect, it } from 'vitest';
import { assertTravelMonth, budgetEstimatePaise, inclusiveTravelDays } from '../src/modules/travel/travel-utils.js';

describe('EMS budget estimate', () => {
  it('counts inclusive travel days', () => {
    expect(inclusiveTravelDays('2026-07-01', '2026-07-05')).toBe(5);
    expect(inclusiveTravelDays('2026-07-01', '2026-07-01')).toBe(1);
  });

  it('sums airfare, hotel nights, daily allowance and visa in paise', () => {
    // ₹1,000 + ₹2,000 × 2 nights + ₹500 × 5 days + ₹0 visa = ₹7,500
    expect(budgetEstimatePaise({
      airfarePaise: 100_000,
      hotelPerNightPaise: 200_000,
      hotelNights: 2,
      dailyAllowancePerDayPaise: 50_000,
      travelDays: 5,
      visaCostPaise: 0,
    })).toBe(750_000);
  });

  it('rejects a hotel rate without nights', () => {
    expect(() => budgetEstimatePaise({
      airfarePaise: 0,
      hotelPerNightPaise: 200_000,
      hotelNights: 0,
      dailyAllowancePerDayPaise: 0,
      travelDays: 1,
      visaCostPaise: 0,
    })).toThrow(/nights is required/);
  });

  it('keeps travel dates inside the selected month', () => {
    expect(() => { assertTravelMonth('2026-07', '2026-07-01', '2026-08-01'); }).toThrow(/travel month/);
    expect(() => { assertTravelMonth('2026-07', '2026-07-01', '2026-07-05'); }).not.toThrow();
  });
});
