# Phase 0 Stage 0.4 — authentication repair

NFR-03 / CORE-10 / P0-T20. Implements O09 and the sponsor-selected O10 policy; follows [pack24](24-READONLY-AUTHORITY-REPAIR.md).

- [x] Sponsor decision: single-use refresh tokens; logout immediately revokes this session, preserving other logins.
- [x] Account-row locking serializes login; failure/reset/session creation and audit commit together. Backoff is capped and the SMALLINT counter cannot overflow.
- [x] Materialize five existing auth policy values in editable settings; validate runtime bounds.
- [x] Reuse existing `sec.sessions`: stable sid and absolute expiry; current refresh hash is the single-use credential. Add only one justified field with a CHECK, migration and Kysely type.
- [x] Bind access tokens to a live, unrevoked session and active user on each authenticated request.
- [x] Concurrent refresh has one winner; the consumed token is rejected without revoking the winner. Rotation does not extend absolute expiry.
- [x] Logout supports cookie and bearer identity; expired/invalid cookies cannot defeat valid bearer logout. Login/rotation/revocation audits exclude tokens and hashes.
- [x] Browser API and session restoration share refresh work; supported Web Locks serialize tabs sharing the cookie. Logout waits for refresh and discards late results.
- [x] Nine native auth regressions plus three browser concurrency regressions. Five of the initial six native tests failed before repair; deactivation was already correct.
- [x] Final checks run: backend519/519 tests and static checks/build pass; frontend249 tests and full verify/build pass; migration recheck clean; native fixture cleanup checked.
- [ ] Full backend verify remains RED:76.73% lines/statements,72.09% branches versus80%. No threshold lowered and no gate advanced.
- [ ] ATS SSO/staging integration and signed acceptance. Legacy sid-less tokens require a fresh login after rollout.
- [ ] Prior payroll-core router human review remains outstanding from pack24.

[Evidence and actual verification](../../outputs/auth-session-repair-2026-10-16/REVIEW.md). H01/H03–H14, other-module O01–O08/O11–O12, production integrations and remaining SOW work stay open. Claims/budgets remain deferred. No other plan-stage was built in this increment.
