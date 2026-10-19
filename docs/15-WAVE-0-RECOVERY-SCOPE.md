# Wave-0 recovery — sponsor amendment, 19 October 2026

The sponsor explicitly approved **all branch features as added scope** in response to the recovery question. The source is `remediation/wave-0` at `940e23f2051f371e2e16bc394d500d2d444a9fc2`. This authorizes recovery of the implemented branch features, including password step-up (MFA subsequently excluded), employee document vault and e-sign records, shift swaps and coverage, POSH/grievance/whistleblower intake, compliance calendar/registers, and privacy/DPDP operations. Future proposals merely listed in an inventory are not evidence that they have been implemented or accepted.

Branch specifications and plans are preserved verbatim under `outputs/wave-0-recovery-2026-10-19/spec-snapshots/`. Their checkmarks and legal/rate assertions are historical evidence, **not current-main acceptance or verified legal advice**. Existing docs 00–14 and current sponsor decisions continue to govern conflicts. Rebuilt payroll, claims budgets, password reset, SSO and audit-chain implementations must be compared before any replacement. The earlier claims/reimbursement deferral remains in place.

## SEC-02/03 — second factor excluded by sponsor

The sponsor subsequently stated **“I dont need mfa”**. This overrides the earlier all-features recovery approval for MFA: do not recover TOTP enrollment, second-factor login, recovery codes or MFA administration. Existing inherited database tables are not a reason to enable the feature or destructively drop schema. Remove the newly started implementation; retain the original branch for traceability.

## SEC-04 — password step-up

Reuse `sec.sessions.stepped_up_at` and `stepped_up_until`. A successful password challenge elevates only the authenticated live session for the configured window. Revalidate its live row at each sensitive operation. Role grants/revocations and user-role changes require this proof in addition to the existing runtime permission and delegation ceiling. Failed challenges are rate-limited and audited without recording credentials. The modal explains the protected action and preserves the interrupted form. Expired/revoked sessions cannot be elevated.

## Remaining recovery contracts

For each document, scheduling, confidential-case, compliance and privacy feature: read its preserved branch specification and code, map every existing table/column to behavior, retain current-main invariants, verify authorization and scope at every read and mutation, and test transaction/retry behavior before enabling the route. Anonymous intake is an explicitly approved exception to public login/health-only procedures; it requires opaque receipt tokens, rate limiting and no public case disclosure. POSH case access must be assigned-case scoped and must not become general HR visibility. No destructive privacy purge may bypass statutory retention or immutable audit/ledger rules. Storage and signature/provider connections require actual configured delivery evidence before acceptance.

The execution checklist is `plans/wave-0-recovery.md`. Do not merge or delete the source branch while any implemented feature remains unaccounted for or a required gate is red.

## SHF-01 — penalty policy confirmed

Sponsor selected “Preserve attendance facts; show penalty separately.” Docs04 §1.1 defines snapshot, grace, half-approval and historical-unknown behavior. A half-day finding does not authorize changing attendance or automatically deducting pay. No late+early stacking/cap rule has been approved.
