/**
 * Phase 3.5 Stage T2 — the approval chain, ported rule-for-rule from the live
 * EMS `approvalChain.buildApprovalChain()`
 * (docs/recon/ems-claims-live-schema.md §3).
 *
 * Why this is a pure function with its own test file: the chain decides who is
 * allowed to release someone else's money. Every rule below exists in the live
 * system because a real edge case produced it — a manager who is also the head
 * of their own department, an admin filing their own claim — and porting the
 * happy path alone would quietly change who can approve what.
 *
 * The chain is built UP FRONT, not resolved step by step, because the applicant
 * is entitled to see the whole route their request will take before they send it.
 */
import { describe, expect, it } from 'vitest';
import {
  buildApprovalChain,
  type ChainInput,
  type ChainPerson,
} from '../src/modules/claims/approval-chain.js';

const person = (id: number, ecode: string, isAdmin = false): ChainPerson => ({
  id,
  ecode,
  isAdmin,
});

const applicant = person(1, 'RML001');
const rm = person(2, 'RML002');
const hod = person(3, 'RML003');
const admin = person(9, 'RML000435', true);

const base: ChainInput = {
  applicant,
  reportingManager: rm,
  hod,
  admin,
};

const roles = (input: ChainInput): string[] => {
  const result = buildApprovalChain(input);
  return result.ok ? result.steps.map((s) => s.role) : [`ERROR:${result.reason}`];
};

describe('buildApprovalChain — the happy path', () => {
  it('routes reporting manager, then HOD, then admin', () => {
    const result = buildApprovalChain(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toEqual([
      { personId: 2, ecode: 'RML002', role: 'reporting_manager' },
      { personId: 3, ecode: 'RML003', role: 'hod' },
      { personId: 9, ecode: 'RML000435', role: 'admin' },
    ]);
    expect(result.autoApprove).toBe(false);
  });
});

describe('buildApprovalChain — skips', () => {
  it('skips a missing reporting manager and starts at the HOD', () => {
    expect(roles({ ...base, reportingManager: null })).toEqual(['hod', 'admin']);
  });

  it('skips a missing HOD and goes reporting manager then admin', () => {
    expect(roles({ ...base, hod: null })).toEqual(['reporting_manager', 'admin']);
  });

  it('falls back to the admin alone when neither RM nor HOD is on file', () => {
    // A record with no hierarchy must still be approvable by somebody, or the
    // request is unroutable and simply sits there — the live system's own
    // reason for always appending the admin.
    expect(roles({ ...base, reportingManager: null, hod: null })).toEqual(['admin']);
  });
});

describe('buildApprovalChain — self-approval guards', () => {
  it('never makes the applicant their own approver, by id', () => {
    expect(roles({ ...base, reportingManager: person(1, 'RML001') })).toEqual(['hod', 'admin']);
  });

  it('never makes the applicant their own approver, by e-code', () => {
    // The live guard compares userid case-insensitively as well as by id,
    // because the two can disagree in imported data.
    expect(roles({ ...base, hod: person(99, 'rml001') })).toEqual(['reporting_manager', 'admin']);
  });

  it('drops the admin step when the applicant IS the admin', () => {
    const adminApplicant = person(9, 'RML000435', true);
    expect(roles({ ...base, applicant: adminApplicant })).toEqual(['reporting_manager', 'hod']);
  });
});

describe('buildApprovalChain — deduplication', () => {
  it('collapses to one step when the reporting manager is also the HOD', () => {
    // The rule the sponsor brief did not mention: one person must never be
    // asked to approve the same request twice.
    const result = buildApprovalChain({ ...base, hod: rm });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toEqual([
      { personId: 2, ecode: 'RML002', role: 'reporting_manager' },
      { personId: 9, ecode: 'RML000435', role: 'admin' },
    ]);
  });

  it('keeps the FIRST role when one person occupies two stages', () => {
    const result = buildApprovalChain({ ...base, hod: rm });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps[0]?.role).toBe('reporting_manager');
  });

  it('does not add the admin twice when the HOD is also the admin', () => {
    expect(roles({ ...base, hod: admin })).toEqual(['reporting_manager', 'hod']);
  });
});

describe('buildApprovalChain — terminal cases', () => {
  it('auto-approves when the admin files a claim with no RM or HOD', () => {
    // Nobody senior to the admin exists, so the chain is legitimately empty.
    // This is an APPROVAL, not an error — the distinction matters because the
    // other empty-chain case is a data fault.
    const result = buildApprovalChain({
      applicant: person(9, 'RML000435', true),
      reportingManager: null,
      hod: null,
      admin,
    });
    expect(result).toEqual({ ok: true, steps: [], autoApprove: true });
  });

  it('refuses a non-admin applicant with no approver anywhere', () => {
    // An unroutable request must fail loudly at submission rather than sit in
    // a queue nobody owns.
    const result = buildApprovalChain({
      applicant,
      reportingManager: null,
      hod: null,
      admin: null,
    });
    expect(result).toEqual({ ok: false, reason: 'no_approver' });
  });

  it('does not auto-approve a non-admin just because the chain came out empty', () => {
    const result = buildApprovalChain({
      applicant,
      reportingManager: person(1, 'RML001'),
      hod: person(1, 'RML001'),
      admin: null,
    });
    expect(result.ok).toBe(false);
  });
});
