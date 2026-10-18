# Attendance half timings — Phase 1 Stage 1.4

16 Oct 2026 · ATT-04/05/06/07 · sponsor choice: configured half timings automatically.

The employee day detail now shows each half's result and assigned IST window. Regularisation, OD and sent-back correction show whole-day/first-half/second-half choices with their configured times. Overnight boundaries explicitly say next day. The month summary separates full present/on-duty days from half days, so P:A does not appear as no attendance.

## Contract and data flow

`GET /api/attendance/requests/schedule?date=YYYY-MM-DD` uses `attendance.own`, authenticated employee identity, zod input/output and the existing `resolveDay` service. It resolves date-specific roster, employee scheme and default shift, recognizing holidays/week offs. Existing shift start/end/session_split/crosses_midnight fields produce display windows. No extra column, table, migration or stored duplicate timing value was introduced.

AR/OD mutations still send the selected `dayPortion`, dates and reason through their existing workflow. Configured hours are display data; arbitrary edited hours are not accepted by this UI. Bounded short permission remains separate. Approval/transaction protections from pack26 are preserved. No new monetary calculation was introduced.

A changed date clears stale timing options. Loading/error/missing timings prevent an unverified submission. Date ranges beginning on an off day seek the first working date and identify that preview date; each subsequent date remains subject to its own roster and backend validation. Day detail with no stored session result stays explicitly unknown.

## Verification

- Backend: **529 tests in 68 files passed, no skips**; typecheck, lint, knip, dependency boundaries and separate build passed.
- Backend full verify **exit 1**: unchanged 80% global coverage requirement is unmet (76.85% lines/statements, 72.45% branches; functions 81.54%). No threshold was lowered.
- Frontend: **262 tests in 28 files passed**; complete verify and build **exit 0**. Five added cases cover two themes/axe, overnight labels, stale dates and off-day range starts; existing request/resubmit tests exercise the schedule call.
- React Doctor: 74/100, two form maintainability advisories. Existing large frontend bundle warning remains.
- Live local browser: synthetic P:A day showed first-half Present 09:00–13:30 IST and second-half Absent 13:30–18:00 IST. AR first-half and OD second-half choices displayed their matching configured G5 windows and other-half preservation copy. This confirms rendering and schedule retrieval; no attendance request was submitted during the browser check. Native integration tests cover submission/approval separately.
- Synthetic account disabled/detached, employee exited, session revoked, temporary browser tab closed. Isolated synthetic facts and immutable audit retained. Zero fixture workflow requests.
- `git diff --check` passed. Raw logs and structured verification are adjacent. Preview servers were left on loopback ports 5100/5173 for local review.

## Remaining acceptance

This completes the timing UI increment, not all SOW work. All 176 source rows remain in `sow-scope-current.json`; no unrelated row or phase gate was marked complete. Backend coverage, real Kent/HR UAT, disjoint split-shift policy, leave/off-half reconciliation and remaining G1/SOW acceptance stay open. Claims and budgets remain deferred. Prior payroll human review requirements are unchanged.
