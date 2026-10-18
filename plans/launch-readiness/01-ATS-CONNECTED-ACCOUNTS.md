# ATS connected accounts and separate application deployment

Sponsor, 17 Oct 2026: ATS lives beside HRMS on the same server, in separate application locations; connected people must move between apps smoothly. Actual local source is `/Users/anooppratapsingh/Documents/interview_scheduling` (the space/misspelled path in the reply does not exist).

Requirement anchors: D4, NFR-03, CORE-10; docs02 §3, docs08, P0-T20/G0. Keep independent frontends/backends/databases. This is the integration increment, not Phase4 ATS absorption. Both working trees already contain substantial unrelated changes: preserve them.

## Source facts inspected

- ATS `backend/src/models/User.js`: local numeric `id`; `employee_id` is text, not HRMS's numeric FK; email, `is_active`, `token_version`; public profile omits password hash.
- ATS `backend/src/middleware/auth.js`: JWT verification with ATS key, then active-account/token-version DB check on every request. Read-only account preview changes `req.user`; identity handoff must reject preview rather than impersonate the previewed person.
- ATS `backend/src/routes/auth.js`: existing authenticated `/api/auth/profile`; login/signup issue ATS-local tokens. No current federated login/SSO endpoints found in these files.
- HRMS `backend/src/api/orpc.ts`: active local account + `sec.sessions` required on every protected request. HRMS access token subject is HRMS user ID; numeric IDs between databases are unrelated.
- HRMS `backend/src/modules/auth/auth.sessions.ts`: fixed-duration, single-use refresh sessions and immediate current-session logout. Preserve these semantics across any federated adapter.
- ATS `backend/src/models/Offer.js`: internal approval stage/status and compensation text, plus `loi_custom_fields`. Internal offer approval does not prove candidate acceptance; candidate conversion or no-show cannot supply a missing LOI acceptance/rejection event. Source-contract reconciliation remains required before importing these outcomes.

## Required implementation and data contract (not yet implemented)

1. HRMS remains canonical issuer (docs02). Use an authorization-code handoff with S256 PKCE, exact registered callback URI and caller-generated state. Never place access/refresh tokens in navigation URLs or copy credentials between apps. Access tokens for one app are not accepted as arbitrary role assertions in the other.
2. Persist an explicit, audited link between HRMS `core.users.id` and ATS `users.id` under one configured ATS client identity. Admin verifies the person using employee e-code and email; neither email matching nor numeric-ID coincidence silently provisions a link. Unique client+ATS subject and client+HRMS user prevent ambiguous mapping. Disabling/unlinking must deny subsequent exchanges. No automatic HR/payroll role creation.
3. A dedicated one-use grant row has only: code digest, client, exact callback, S256 challenge, linked user/session, expiry and consumption evidence. Atomically consume under a row lock; bind redemption to the original client/callback/verifier. Do not store plaintext codes, JWTs, passwords or verifier. FK session/user/link; checks on digest/challenge/timestamps; purpose and retention documented in docs03 before migration. Grant lifetime is an explicit editable setting, not an invented employment/payroll policy.
4. ATS validates issuer, audience, signature/expiry and current HRMS session state via a restricted backchannel or equivalent issuer endpoint. It then loads its own mapped, active user and uses its own permissions. ATS token-version revocation remains effective. Unknown/inactive/unlinked users get a useful denial; no fallback to a default account or super-admin.
5. UI: a named app switch in each existing shell, available only for linked accounts; first canonical login can be required. Preserve a validated relative destination. Session-expired/unlinked/config-unavailable states must be explicit; no open redirects, iframe token passing, localStorage copying or preview impersonation. Read docs05/12 and compose existing primitives for HRMS UI.
6. Separate server folders/processes/ports and databases remain. Reverse proxy maps the two configured HTTPS application origins; callbacks, credentialed CORS and host-only cookies use those exact origins. Browser callbacks must work with the actual path prefixes. No blanket cookie Domain or wildcard CORS. Rotation/deployment must invalidate legacy tokens lacking required session identity in a controlled rollout.

## Acceptance cases

Connected user moves both directions; unlinked user gets no implicit account; employee cannot become HR/payroll; revoked/inactive HRMS/ATS account fails; refresh/logout policy still holds; wrong client, wrong callback, wrong verifier, expired code, replay, parallel redemption and forged state fail; exactly one concurrent redemption succeeds; preview cannot issue a handoff. Test separate origins and path prefixes in browser, refresh at expiry, multiple tabs, back button and preserved destination. Inspect actual DB/audit effects without exposing credentials. Run both projects' prescribed verification gates.

## Missing launch inputs

Actual HTTPS origins/callback paths, authorized account-link population/owner, and production process/proxy details remain unspecified. Do not fabricate them or enable a partially configured integration. No ATS DB connection, secrets, migrations or application files were changed during this source inspection. The SSO gate remains open.
