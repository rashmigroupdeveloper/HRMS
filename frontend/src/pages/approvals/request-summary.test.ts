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
