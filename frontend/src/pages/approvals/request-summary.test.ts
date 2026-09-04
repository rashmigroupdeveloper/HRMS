import { describe, expect, it } from 'vitest';
import { payloadAsJson, summarizeRequest } from './request-summary';

describe('summarizeRequest', () => {
  it('renders a leave window the way a manager reads it, not as JSON keys', () => {
    const summary = summarizeRequest('leave', {
      leaveType: 'CL',
      fromDate: '2026-08-03',
      toDate: '2026-08-05',
      days: 3,
      reason: 'Family function',
      applicationId: 441,
    });
    expect(summary.rows).toEqual([
      { label: 'Leave type', value: 'CL' },
      { label: 'From', value: '03 Aug 2026' },
      { label: 'To', value: '05 Aug 2026' },
      { label: 'Days', value: '3' },
      { label: 'Reason', value: 'Family function' },
    ]);
    expect(summary.preview).toBe('CL · 03 Aug 2026 · 05 Aug 2026');
    expect(summary.consequence).toBe(
      'Approving grants 3 days of CL (03 Aug 2026 to 05 Aug 2026).',
    );
  });

  it('formats detected OT minutes against the work date', () => {
    const summary = summarizeRequest('overtime', {
      workDate: '2026-08-01',
      detectedMinutes: 90,
    });
    expect(summary.rows).toEqual([
      { label: 'Work date', value: '01 Aug 2026' },
      { label: 'Detected', value: '1h 30m' },
    ]);
    expect(summary.consequence).toBe('Approving records 1h 30m for 01 Aug 2026.');
  });

  it('names AR/OD kinds in plant language', () => {
    const ar = summarizeRequest('regularization', {
      kind: 'AR',
      fromDate: '2026-08-01',
      toDate: '2026-08-01',
      reason: 'Kent door S4 offline',
    });
    expect(ar.rows[0]).toEqual({ label: 'Kind', value: 'Attendance regularisation' });
    expect(ar.consequence).toBe('Approving marks 01 Aug 2026 as present.');

    const od = summarizeRequest('od', {
      kind: 'OD',
      fromDate: '2026-08-22',
      toDate: '2026-08-22',
      site: 'DIP-6',
    });
    expect(od.consequence).toBe('Approving marks 22 Aug 2026 as on duty.');
    expect(od.preview).toContain('DIP-6');
  });

  it('still labels unknown keys instead of dumping the object', () => {
    const summary = summarizeRequest('letter_signature', { templateCode: 'offer' });
    expect(summary.rows).toEqual([{ label: 'Template', value: 'offer' }]);
    expect(summary.consequence).toContain('Approving grants this request');
  });

  it('names a coverage warning and a shift swap', () => {
    const leave = summarizeRequest('leave', {
      leaveType: 'CL',
      fromDate: '2026-09-08',
      toDate: '2026-09-08',
      days: 1,
      coverageWarning: 'GEN on 08 Sep would leave 3 against sanctioned 4',
    });
    expect(leave.rows.some((row) => row.label === 'Coverage')).toBe(true);

    const swap = summarizeRequest('shift_swap', {
      kind: 'swap',
      workDate: '2026-11-10',
      counterpartEmployeeId: 41,
      reason: 'Trade the night',
    });
    expect(swap.rows[0]).toEqual({ label: 'Kind', value: 'Shift swap' });
    expect(swap.consequence).toContain('swaps the rostered day');
  });

  it('shows a claim as money, its budget, and the lines it is made of', () => {
    // The manager decides on the LINES, not the total. A total-only view is
    // how a ₹6,000 claim with a fabricated hotel bill gets waved through.
    const claim = summarizeRequest('claim', {
      claimId: 12,
      reference: 'CLM-2026-0012',
      amount: '6000.00',
      budgetTitle: 'Kolkata plant visit',
      budgetAllowance: '25000.00',
      budgetRemaining: '19000.00',
      periodFrom: '2026-09-10',
      periodTo: '2026-09-12',
      lines: [
        { type: 'Hotel', description: 'Taj', spentOn: '2026-09-10', billNo: 'H/991', amount: '4000.00' },
        { type: 'Local travel', description: null, spentOn: '2026-09-11', billNo: null, amount: '2000.00' },
      ],
    });

    // Money reads in rupees with Indian grouping, never as a bare NUMERIC.
    expect(claim.rows[0]).toEqual({ label: 'Claim', value: 'CLM-2026-0012' });
    expect(claim.rows[1]).toEqual({ label: 'Amount', value: '₹6,000' });
    expect(claim.rows.some((r) => r.label === 'Left on budget' && r.value === '₹19,000')).toBe(true);
    // Internal ids never surface as rows.
    expect(claim.rows.some((r) => r.label === 'Claim id')).toBe(false);

    expect(claim.lines).toHaveLength(2);
    expect(claim.lines[0]?.billNo).toBe('H/991');
    expect(claim.lines[1]?.description).toBeNull();

    // The commitment already exists; approving confirms it, rejecting returns it.
    expect(claim.consequence).toContain('₹6,000');
    expect(claim.consequence).toContain('Kolkata plant visit');
    expect(claim.consequence).toContain('already committed');
  });

  it('leaves lines empty for every request type that has none', () => {
    expect(summarizeRequest('leave', { days: 1 }).lines).toEqual([]);
    expect(summarizeRequest('claim', { amount: '10.00', lines: 'not-an-array' }).lines).toEqual([]);
  });

  it('handles empty or non-object payloads without throwing', () => {
    expect(summarizeRequest('leave', null).rows).toEqual([]);
    expect(summarizeRequest('leave', 'oops').rows).toEqual([]);
    expect(summarizeRequest('leave', {}).preview).toBe('');
  });
});

describe('payloadAsJson', () => {
  it('keeps the audit dump available behind the human view', () => {
    expect(payloadAsJson({ days: 1 })).toBe('{\n  "days": 1\n}');
  });
});
