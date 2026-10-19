import { describe, expect, it } from 'vitest';
import { assertCtcBreakup, renderOfferLetter, type OfferPayload } from '../src/modules/lifecycle/offers/offer.service.js';

const offer: OfferPayload = {
  kind: 'offer',
  fullName: 'Asha Sen',
  personalEmail: 'asha@example.com',
  mobile: '9876543210',
  positionTitle: 'Engineer',
  offeredCtc: 600000,
  breakupAnnual: [
    { code: 'BASIC', annualRupees: 300000 },
    { code: 'HRA', annualRupees: 300000 },
  ],
  proposedDoj: '2026-11-01',
  offerDate: '2026-10-19',
};

describe('offer letter', () => {
  it('refuses a CTC that does not match the breakup', () => {
    expect(() => { assertCtcBreakup(600000, [{ annualRupees: 100000 }]); }).toThrow(/does not match/);
  });

  it('renders the offer with the breakup', () => {
    assertCtcBreakup(offer.offeredCtc, offer.breakupAnnual);
    expect(renderOfferLetter(offer)).toContain('Annual CTC: 600000.00');
    expect(renderOfferLetter(offer)).toContain('BASIC: 300000.00');
  });
});
