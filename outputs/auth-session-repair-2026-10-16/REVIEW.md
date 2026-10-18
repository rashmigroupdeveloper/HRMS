# Authentication and session repair — 16 October 2026

Phase0 Stage0.4, NFR-03 / CORE-10 / P0-T20. Sponsor selected **single-use refresh tokens and immediate current-session logout**. No deployment or complete-SOW acceptance is claimed.

## Behavior and relationships

`core.users.id → sec.sessions.user_id` owns one login. Its UUID `sid` is signed into both token types. `api/orpc.ts` checks active user and live/unrevoked/unexpired session on every authenticated request. A valid signature alone is insufficient. Logout ends the matching session; another independent login survives. Legacy sid-less tokens require a fresh login. ATS-side SSO validation remains an external integration gate.

One new field, `sec.sessions.refresh_token_hash`, stores SHA-256 of the current refresh credential, with a64-hex CHECK. It is read by rotation and replaced under an account-first/session-row lock in one transaction; concurrent redemption has exactly one winner. A rejected replay does not invalidate the winning credential. `expires_at` remains the absolute login expiry; neither refresh nor cookie rotation extends it. No raw token/hash is audited or returned in API data. Existing revocation fields carry logout reason/user/time. No new session-family or token-history table.

Login takes the user row lock before checking status, lockout and password. Counter/reset, session creation and audit commit together. Five failures and15→30→60→120 minute defaults are now editable settings, together with900-second access and604800-second absolute session lifetimes. Bounds are validated. Counter saturation at SMALLINT max is a storage-safety bound, not a new policy. Credential failure responses are uniform.

Browser `session.ts` and `api.ts` share a refresh promise and reuse an already-refreshed access token for stale401s. Web Locks, where available, serialize shared-cookie work between tabs. Logout waits for in-flight refresh and invalidates late results before clearing local state. Offline sign-out clears local state but cannot prove server revocation without a reachable API.

## Verification

Final backend: **519/519 tests,67 files, zero skips**; typecheck, lint, knip, dependency boundaries and separate build pass. Backend verify exits1 solely on unchanged coverage thresholds: lines/statements76.73%, branches72.09%, functions81.42%, required80% each. Final frontend verify exits0: **249 tests/27 files** and build pass; existing bundle-size warning remains advisory. Migration recheck exits0 with no migrations to run. Cleanup: zero active new auth accounts, zero unrevoked auth fixture sessions, zero committed authority fixture users. Inactive audited accounts/revoked sessions are retained by convention. `verification.json` and raw logs contain the results. Initial native suite: five failures and one existing deactivation control passed. Repaired native suite: nine cases cover concurrency, replay, logout isolation, sid-less access, deactivation, backoff/cap/reset, rollback when audit fails, editable policy and absolute expiry. Browser tests cover shared redemption, stale401 reuse and logout versus late refresh. No live browser walkthrough or multi-browser acceptance is claimed.

Fresh catalog comparison:132 relations,1,380 columns; only `sec.sessions.refresh_token_hash` added, no removed or changed existing columns. Normal migration discovery also recorded the pre-existing budget/claim contract reconciliation migration; comparison confirms no additional budget/claim column changes. Its source and domain logic were not edited; claims and budgets remain deferred. The new auth migration was assigned unique timestamp1752290000000, with the local test migration record aligned before final checks.

## Remaining acceptance

The global backend80% coverage gate remains binding; thresholds were not lowered. ATS/staging SSO, real delivery/integration proof and signed acceptance remain open. The prior payroll-core authorization annotation diff still needs human review. H01/H03–H14 and remaining O findings stay open in their owning stages. All176 SOW row values, statuses, source text and deferrals are retained unchanged.
