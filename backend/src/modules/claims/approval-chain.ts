/**
 * Phase 3.5 Stage T2 — who approves a claim, and in what order.
 *
 * A faithful port of the live EMS `buildApprovalChain()`
 * (docs/recon/ems-claims-live-schema.md §3). The rules are not arbitrary: each
 * one exists because a real organisation produced the edge case. A manager who
 * heads their own department must not approve twice. An admin filing their own
 * claim has nobody above them. A record with no hierarchy must still be
 * approvable by someone, or the request is unroutable and silently rots.
 *
 * Two deliberate differences from the original, neither of which changes who
 * approves what:
 *
 *  · **Pure.** The original queries Mongo inside the builder; this takes the
 *    people it needs as arguments, so every rule is testable without a database
 *    and the resolution strategy can change without touching the logic.
 *  · **Returns a result, never throws.** An unroutable request is a data fault
 *    the caller must surface to a human, not an exception to bubble.
 *
 * The chain is built UP FRONT rather than resolved a step at a time, so the
 * applicant can be shown the whole route before they commit to sending it.
 */

export type ApproverRole = 'reporting_manager' | 'hod' | 'admin';

export interface ChainPerson {
  id: number;
  /** Employee code. Compared case-insensitively, as the original does. */
  ecode: string;
  isAdmin?: boolean;
}

export interface ChainInput {
  applicant: ChainPerson;
  reportingManager: ChainPerson | null;
  hod: ChainPerson | null;
  /** The organisation's final approver. Null only in broken configuration. */
  admin: ChainPerson | null;
}

export interface ChainStep {
  personId: number;
  ecode: string;
  role: ApproverRole;
}

export type ChainResult =
  | { ok: true; steps: ChainStep[]; autoApprove: boolean }
  | { ok: false; reason: 'no_approver' };

const sameEcode = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export function buildApprovalChain(input: ChainInput): ChainResult {
  const { applicant } = input;
  const steps: ChainStep[] = [];

  const add = (candidate: ChainPerson | null, role: ApproverRole): void => {
    if (candidate === null) return;

    // Self-approval guard. Checked by id AND by e-code because imported data
    // can disagree between the two, and either match means the same human.
    if (candidate.id === applicant.id) return;
    if (sameEcode(candidate.ecode, applicant.ecode)) return;

    // Duplicate guard — one person is never asked to approve the same request
    // twice. The FIRST role they occupy wins, so an RM who also heads the
    // department stays the RM step rather than being promoted to HOD.
    if (steps.some((step) => step.personId === candidate.id)) return;

    steps.push({ personId: candidate.id, ecode: candidate.ecode, role });
  };

  add(input.reportingManager, 'reporting_manager');
  add(input.hod, 'hod');

  // The admin terminates every chain except their own. Nobody sits above them,
  // so their own request has no third stage to add.
  if (applicant.isAdmin !== true) add(input.admin, 'admin');

  if (steps.length === 0) {
    // An empty chain means two very different things, and conflating them would
    // either auto-approve a claim nobody checked, or block the one person who
    // legitimately has no approver.
    return applicant.isAdmin === true
      ? { ok: true, steps: [], autoApprove: true }
      : { ok: false, reason: 'no_approver' };
  }

  return { ok: true, steps, autoApprove: false };
}

/*
 * NOT ported: `currentPendingIndex`, `stageLabel` and `canActOnStep`.
 *
 * The live system builds and walks its own chain, so it needs all three. We
 * delegate the walk to `modules/workflows`, which already owns the pending
 * step, the "is it your turn" check (including the role-queue rule that lets
 * any holder act), the SLA clock and the notified_at receipt. Re-implementing
 * them here would create a second source of truth for who may approve what —
 * which is precisely the class of bug this port exists to avoid.
 */
