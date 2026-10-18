# Other module bug audit 16 October 2026

**Audit completed; repairs remain open.** Seven new specific bug groups, three reconfirmed issues and two policy/metric questions are recorded in the [current review](../../outputs/other-module-review-2026-10-16/REVIEW.md) and [structured findings](../../outputs/other-module-review-2026-10-16/findings.json). No application code, tests, configuration or migrations changed in this increment. No gate advances.

- [x] Native loopback HTTP/PostgreSQL diagnostic run:20 observations reproduced; four positive controls passed. All fixtures rolled back and cleanup checked.
- [x] Fresh catalog parity:132 parent relations /1,379 columns; no column changes. All505 application/config/migration/test source hashes match pack21’s final source inventory.
- [x] Preserve all176 SOW rows with additional issue links; claims/budgets remain deferred.
- [ ] Phase3 Stage3.4 O01: enforce company audience for announcements, polls and surveys.
- [ ] Phase3 Stage3.4 O02/O03: unique survey question IDs and exact response/choice/type validation.
- [ ] Phase3 Stage3.4 O04/O05: policy content/ack/tile population and helpdesk category/organization boundaries.
- [ ] Phase3 Stage3.4 O06/O07: complete reopen transition rules, idempotent closure and historical resolution time.
- [ ] Phase3 Stage3.4 O11/O12: repair survey create/read/respond/results contracts and helpdesk performance DTO; prove actual screen journeys.
- [ ] Phase3 Stage3.4 O08: define whether first response means first internal handling or customer-visible reply before changing the metric.
- [ ] Phase0 Stage0.4 O09: atomic login failure/backoff/reset; O10: resolve the existing refresh/logout/replay guarantee before persistence design.
- [ ] Prior asset custody/maintenance and all pack21/19 financial/lifecycle/scope/coverage/integration obligations remain open.

[Native evidence](../../outputs/other-module-review-2026-10-16/native-results.json) · [reproduction source](../../outputs/other-module-review-2026-10-16/native-probes.mts) · [all SOW rows](../../outputs/other-module-review-2026-10-16/sow-scope-current.json) · [verification](../../outputs/other-module-review-2026-10-16/verification.json). The probe’s exit0 confirms diagnostics/cleanup, not correct business behavior. Earlier full tests still pass on identical source; backend full verify remains red on coverage. Execute one announced owning stage, use existing authoritative relationships, and do not add unsupported fields.
