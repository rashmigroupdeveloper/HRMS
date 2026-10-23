# Pack37 — KENT native export mapping and canteen evidence

Phase 0, Stage 0.6 · 22 Oct 2026 · ATT-01/02/03/18, P0-T01/T40; payroll-input boundary SOW-5.1.1.

- [x] Inspect five native KENT exports without source changes; retain source hashes.
- [x] Map all supplied columns and distinguish daily summaries, raw recognitions and financial food bookings.
- [x] Join 885 bookings / 470 employees to 6,920 employee/date observations / 3,460 codes; validate monetary arithmetic using Decimal.
- [x] Compare daily/muster and both employee snapshots; save source-row evidence and review exceptions.
- [x] Check official KENT integration, canteen, report, exception and device-mode documentation; correct universal no-direction claim in integration guide.
- [x] Document existing CANTEEN input boundary and conditional risk of canteen recognitions entering attendance.
- [ ] Reconcile KENT codes and effective entities with the HRMS employee master.
- [x] Obtain and inspect raw Recognition Logs in the 23 Oct follow-up; see [native mapping](../../docs/integrations/KENT-RECOGNITION-LOGS-2026-10-23.md).
- [ ] Obtain device-purpose master, confirmed shifts/timezone and a verified real adapter/completeness contract; G0 remains open.
- [ ] Confirm canteen transaction IDs, price definitions, settlement/refunds and Finance recovery policy before implementing or posting deductions.
- [ ] Implement separate canteen transaction ingestion and mixed-device routing after the contract/schema/policy is established.

[Mapping](../../docs/integrations/KENT-REPORT-MAPPING-2026-10-22.md) · [Evidence](../../outputs/kent-mapping-2026-10-22/summary.json).

Research and documentation only. No application code, live data, policy, source workbook or payroll input changed. Application verification suites were not run; reproducible export checks passed. No real-day ingestion or payroll acceptance gate was marked complete.
