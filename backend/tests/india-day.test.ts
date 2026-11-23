import { today } from '#shared/utils/dates'
import { describe, expect, it } from 'vitest'

// "Today" is India's calendar day whatever the server's time zone (found in the 2026-11-23 review: on a UTC server every
// date rule was a day behind from 00:00 to 05:30 IST)
describe("India's day", () => {
  it('turns at midnight IST, not at midnight UTC', () => {
    // 23 Nov 18:29 UTC = 23:59 IST; 18:30 UTC = 00:00 IST on the 24th
    expect(today(new Date('2026-11-23T18:29:00Z')).toISOString().slice(0, 10)).toBe('2026-11-23')
    expect(today(new Date('2026-11-23T18:30:00Z')).toISOString().slice(0, 10)).toBe('2026-11-24')
    // 1 January after midnight IST is the new year while UTC is still 31 December
    expect(today(new Date('2026-12-31T20:00:00Z')).toISOString().slice(0, 10)).toBe('2027-01-01')
  })
})
