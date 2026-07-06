# Phase 4 — ATS absorption + contract workers (placeholder — scoped later)

**Status:** NOT YET SCOPED. Per docs/07 §Phase-4 and D3/D4, this phase gets its own detailed PRD + stage breakdown when RML prioritizes it — after Gate G3.5. This file reserves the scope so nothing is forgotten.

## Known scope (from docs 00 D4, 01 §11, 07 Phase 4)

### 4A — ATS absorption
- ATS frontend mounts under the HRMS shell (`/recruitment`), consuming the frontend design system (`frontend/src/ui` + `frontend/src/tokens`)
- `recruit` schema migration: candidates/vacancies/offers move into the `hrms` database
- Offer/LOI approval chain live on the workflow engine (Initiator → Plant Head/GM → HR Head → CEO → issue) *(PP-20, LOI flowchart)*
- R21 Offer report + R22 Recruitment report become fully internal (no cross-DB read)
- Standalone ATS retired

### 4B — Contract-worker module *(D3 deferral — separate PRD when prioritized)*
- Contractor entities, gate-pass linkage, contractor muster & compliance registers
- Schema already reserves `employment_category='contract'`; CEO-dashboard Contract column activates

### 4C — Mobile/geo check-in PWA rollout
- Sales/field staff (ATT-14) — pull forward into an earlier phase if demand appears; schema + `source='mobile'` path already exist from Phase 1

## Preconditions to scoping this phase
- [ ] Gate G3.5 passed (one-platform consolidation proven for T&E)
- [ ] Sponsor prioritization of 4A vs 4B vs 4C
- [ ] Contract-worker requirements workshop with HR/plant ops (new PRD document)

> **End state after Phase 4 (docs/07):** the HRMS is the single platform — payroll/attendance/leave/lifecycle + T&E + recruitment — owning the employee master; greytHR, Yatra Avedan, and the standalone ATS all retired.
