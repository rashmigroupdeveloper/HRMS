# Pack31 — remove automatic fake Kent punches

Phase0 Stage0.6 ·17 Oct2026 · ATT-01/02/03, P0-T01/T40.

- [x] Normal sync fails before writes without a verified adapter; no generated employee-master punches.
- [x] Authorized manual API503; anonymous401; unauthorized403; no raw/watermark/recompute changes.
- [x] Explicit tagged fixture feed idempotence;561 tests and static checks pass; separate build passes.
- [ ] Global coverage80 gate:77.58% lines/statements,73.54% branches.
- [ ] Real Kent access contract/adapter, delayed delivery/completeness and one real day acceptance. G0 remains open.

[Evidence](../../outputs/kent-sync-safety-2026-10-17/REVIEW.md). No added schema or policy fields. Next: routing-hold recovery UI, then remaining source/data/role-flow gaps. Continuous sponsor instruction remains in effect.
