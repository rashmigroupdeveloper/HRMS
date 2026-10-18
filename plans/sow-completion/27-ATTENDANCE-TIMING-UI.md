# Phase 1 Stage 1.4 — configured attendance timing UI

ATT-04/05/06/07. Sponsor decision, 16 Oct 2026: use configured half timings automatically. This extends [pack26](26-HALF-WISE-ATTENDANCE-REQUESTS.md); one attended half remains half-day present.

- [x] Own schedule GET resolves roster → employee scheme → default shift through the existing attendance resolver; employee identity comes from authentication. Zod input/output and attendance.own permission are declared.
- [x] Day detail displays separate first/second-half results and IST windows; missing results remain unknown rather than inferred present/absent.
- [x] Regularisation, OD and sent-back correction use whole-day/first-half/second-half choices annotated with configured times. Half selection remains the authoritative transaction input; clock times are derived display data.
- [x] Overnight windows show next day. No midpoint, editable AR/OD clock hours, timing column, table or migration added.
- [x] Date changes discard stale options; loading, failed and unavailable timing states block unverified submission. A range beginning on an off day previews its first working date and identifies the preview date; other dates follow their own rosters.
- [x] Employee summary distinguishes full days present/on duty from half days.
- [x] Native schedule API assertion, five new UI cases including both themes/axe, overnight labels, stale-date loading and off-day range start. Browser check confirmed AR/OD choices with a synthetic employee; no request submitted.
- [x] Final test/build evidence is in [review](../../outputs/attendance-timing-ui-2026-10-16/REVIEW.md).
- [ ] Global backend coverage still below the unchanged 80% floor; backend verify remains red.
- [ ] Real Kent reconciliation, configured disjoint split-shift policy, leave/off-half reconciliation, manager adoption and remaining SOW/G1 acceptance stay open. Claims and budgets remain deferred.

All 176 SOW source rows are preserved in the evidence copy; this increment does not close unrelated rows or advance a gate. Existing earlier payroll review requirements remain unchanged.
