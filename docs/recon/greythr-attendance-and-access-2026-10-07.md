# greytHR attendance sessions and continuing access — 07 Oct 2026

Read-only recon requested by the account holder. References: ATT-03/04/05, docs 03/04/09/14; P0-T02 evidence. No attendance was marked, overridden, regularized or imported. No account or API user was created. Credentials are excluded from this report.

## Continuing authorized access

Revoking a credential must end access through that credential. No cookie, copied token or alternative session was retained to evade revocation. Authentication for this recon was held in process memory only.

greytHR supports a separately authorized API user at **Settings > My Account > API users**, with selected roles and its own credentials. An HRMS integration could obtain expiring OAuth tokens using that API user's active credentials; revoking the personal token would then not affect that separately authorized integration. Revoking the API user's own access must stop it. API enablement and read permissions require tenant-administrator confirmation; this integration is not configured by this review.

For new integrations, the official API documentation specifies the gateway token endpoint `https://api.greythr.com/oauth2/v2/client-token`; the older tenant token endpoint is marked for future deprecation. Store credentials in a secret store, obtain tokens on demand, and stop on an authorization failure. The Attendance Swipe API key described in a separate guide is for uploading punches and is not a substitute for read access.

Sources: [Create API users](https://www.greythr.com/greythr-help/admin/answers/123842254/), [API authentication](https://api-docs.greythr.com/), [Attendance swipe API key](https://www.greythr.com/help-admin/attendance-management/generate-api-key-attendance-swipe/).

## What the inspection established

- Existing tenant recon in docs 09 §4 recorded `G5_Custom_2 (G5)`, 09:00–18:00, with Session 1 09:00–13:30 and Session 2 13:31–18:00, plus a different Saturday scheme. These are **July observations**, not newly verified October configuration for every employee.
- The current public admin client represents `session1Status`, `session2Status`, `session1Label`, `session2Label`, `session1hLabel` and `session2hLabel`. Its muster display combines differing session labels with a colon, while equal labels collapse to one label. Therefore `A:P` represents different first/second-session results, rather than contradictory whole-day statuses.
- The current client supports calendar, day-details, swipes, exceptions, permission, scheme history, override history and monthly insights. UI fields include session in/out times, first/last swipes, work hours, actual work hours and penalties. Availability in client code does not establish account permissions or the tenant's active policy.

Interpretation for ordinary two-session presence:

| Session 1 | Session 2 | Meaning |
|---|---|---|
| P | P | Both sessions present; commonly displayed as P |
| A | P | First session absent, second present |
| P | A | First session present, second absent |
| A | A | Both sessions absent; commonly displayed as A |
| P | O | One session present, other off; not equivalent to absent |

Paid days and deductions cannot be calculated from this legend alone. Leave, holidays, weekly/rest off, approved permissions, regularizations and the assigned attendance scheme must also be considered.

Official greytHR guidance says minimum worked-hour settings, shift/session timings, grace periods and swipe margins affect processing. Attendance can show absence when actual hours fall below the assigned shift policy, even when an employee has punches. The exact Rashmi minimum hours, actual-hours calculation and penalties were not recovered in this inspection.

Sources: [Shift configuration](https://www.greythr.com/greythr-help/admin/answers/143353717/), [Actual-hours absence explanation](https://greythr.freshdesk.com/support/solutions/articles/1060000050258-why-is-an-employee-s-attendance-status-is-displaying-as-half-full-day-absent-for-a-specific-or-multip), [Regularization](https://www.greythr.com/greythr-help/employee-portal/answers/40862637/).

The vendor's newer **split-shift** guide requires a two-hour gap. The July tenant observation is adjacent morning/afternoon sessions with a one-minute boundary; it must not automatically be treated as that newer split-shift feature or evidence that the tenant meets those feature-specific rules.

## Live-read limitations

Normal token sign-in and same-origin redirects completed successfully (HTTP 204 session setup; HTTP 200 portal bootstrap). Attendance requests were then:

| GET endpoint | Result |
|---|---|
| `/latte/v3/attendance/info/period/current` | 500, generic SERVER-EXCEPTION |
| `/v3/api/attendance/muster/legends` | 403 |
| `/v3/api/attendance/shifts` | 403 |
| `/v3/api/attendance/schemes` | 403 |

The results repeated after normal portal bootstrap. These responses prevented verification of live attendance rules and employee-day examples. They do not prove the token is revoked or identify whether the cause is permission, employee context or service configuration. No unauthorized alternative account, employee ID enumeration or write endpoint was attempted.

## HRMS comparison: strengths and unresolved problems

In `backend/src/modules/attendance/day-status.service.ts`, the current HRMS implementation resolves calendar/roster/employee scheme, attributes punches to a shift date, and stores session statuses separately from the daily status. For a two-session day, it uses overlap of the first-to-last swipe span with each session, compared with `att.session_present_fraction`. Two passing sessions yield P, one yields HD, zero yield A. For an unsplit day, worked minutes minus configured break are compared with the shift's full/half-day thresholds.

Strengths:

- Raw punches and processed days are separate, allowing traceable recomputation.
- Manual, regularized and locked records are protected from ordinary automatic recomputation.
- Whole-day A is held until attendance-device sync readiness passes, reducing false absence from delayed data.

Problems to resolve before claiming parity with greytHR:

1. **Session thresholds are an assumption, not verified tenant rules.** The split-session branch uses a fraction and bypasses full/half-day worked-hour thresholds; first-to-last overlap does not measure actual IN/OUT pairs or intermediate absences. docs 04 describes worked-hour thresholds while docs 09 requires session detail without establishing this fractional rule.
2. **Partial absence is not gated like whole-day absence.** `recomputeDay` checks sync readiness only when the daily result is A. An HD day can persist with an absent session while device data is still incomplete. It needs review against the docs 14 rule that attendance/absence is finalized only after relevant device watermarks pass shift end.
3. **Regularization can leave conflicting session labels.** `applyRegularizationOnFinal` updates daily `status`, `source` and `computed_at`, but does not update or clear existing `session_statuses`. A previously A:P day regularized to P can retain its old session labels. The displayed result and daily result may then disagree.

These are source-review findings, not changes or confirmed payroll outcomes. No integration tests were run against the shared application database, and no build gate is claimed by this recon.

## Remaining evidence needed

An administrator-authorized attendance view or read-only API/export must show the assigned shift/scheme's minimum full-day and half-day hours, per-session criteria, actual-hours method, break policy, grace/penalty rules and effective dates. A few anonymized punch → session → daily-result examples can then establish parity without importing employee personal information.
