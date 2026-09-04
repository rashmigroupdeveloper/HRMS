# HRMS Execution Plans

This folder is the **live execution tracker** for the Rashmi HRMS build. The specs live in `docs/` (what to build and why); these files track **in what order and what's done**.

| Phase file | Scope | Duration | Gate |
|---|---|---|---|
| [phase-0-foundations.md](phase-0-foundations.md) | Repo, tooling, auth/RBAC, employee master, de-risk spikes | 3 wk | G0 |
| [phase-1-attendance-leave-workflows.md](phase-1-attendance-leave-workflows.md) | Biometric ingestion, attendance, leave, approvals, core reports, ESS · **Stage 1.11 shift micro / scheduling** | 6–8 wk | G1 |
| [phase-2-payroll-statutory.md](phase-2-payroll-statutory.md) | Full India payroll · **2.0 org/MIS spine · 2.7 completeness · 2.8 foreign (D14)** | 8–10 wk | G2 |
| [phase-3-lifecycle-assets-executive.md](phase-3-lifecycle-assets-executive.md) | Onboarding, separation/F&F, transfers, assets, helpdesk, engagement, CEO dashboard | 5–6 wk | G3 |
| [phase-3.5-travel-expense.md](phase-3.5-travel-expense.md) | T&E module (M13) — absorb & supersede Yatra Avedan | 4–6 wk | G3.5 |
| [phase-4-ats-integration.md](phase-4-ats-integration.md) | **ATS stays a separate product** — hire handoff, SSO, requisition, cross-system reporting | 3–4 wk | G4 |

### Extension — Phases 5–8 (proposed, closing the doc-15 gap register)

| Phase file | Scope | Duration | Gate |
|---|---|---|---|
| [extended-roadmap.md](extended-roadmap.md) | **Architecture of the extension** — new ID prefixes, schemas, roles, **navigation placement**, UX contract, test program, gate model. **Read before any Phase 5–8 work.** | — | — |
| [phase-5-compliance-and-trust.md](phase-5-compliance-and-trust.md) | Labour Codes, DPDP, POSH/grievance, statutory registers, licences, identity hardening, document vault + e-sign, sandbox | 7–9 wk | **G5a** 🔒 then G5b |
| [phase-6-plant-operations.md](phase-6-plant-operations.md) | Gate pass, canteen, transport, PPE, EHS/safety, IR & discipline · **CLMS integration only** (contract labour is a separate product) | 7–9 wk | G6 |
| [phase-7-talent-and-growth.md](phase-7-talent-and-growth.md) | Performance, training matrix & skills, compensation review, benefits, recruitment depth, exit intelligence | 8–10 wk | G7 |
| [phase-8-frontline-and-intelligence.md](phase-8-frontline-and-intelligence.md) | Native mobile + offline punch, push/WhatsApp/SMS, localisation, report builder, integrations, AI | 7–9 wk | G8 |
| [amendments-existing-phases.md](amendments-existing-phases.md) | The 30 depth gaps folded back into Phases 1–4 — **Section B is blocking for Phase 2** | inline | existing gates |
| [coverage-closeout.md](coverage-closeout.md) | **Holes from the 5–8 review, now tasked:** org/MIS spine, payroll completeness, foreign entity (D14), shift micro-controls, SCIM, ESS daily, fatigue, NAPS, R&R/eNPS, smart features | inline | host phase gates |
| [agent-operating-model.md](agent-operating-model.md) | **How agents execute a stage** — squad, factory, UX/logging gates, Wave 0 human blockers, later-wave playbooks | — | — |

> **Scope settled 3 Sep 2026 (sponsor):** the **ATS stays a separate product** (integration, not absorption —
> `phase-4-ats-integration.md`), **contract labour / CLMS is a separate product** (former Phase 6 Stages 6.1 and
> 6.3 cancelled), and **Travel & Expense stays IN scope** (Phase 3.5), as does **claims** — both rebuilt in the
> HRMS design system rather than merged as-is.
>
> 🔒 **Sequencing exception.** Phases run in order *except* **Phase 5 Stages 5.1–5.4 (Gate G5a), which must land
> before Phase 2 payroll starts.** Wage-definition conformance, MFA + step-up, the DPDP retention/consent baseline
> and a masked sandbox are all cheaper before payroll exists and two of them change the engine's arithmetic.
> **Stage 2.0 (company / plant / MIS spine) also blocks 2.2.** Phases 5–8 are **proposed** and await sponsor
> decisions **D8–D14** (docs/15 §9.3 + coverage-closeout D14 foreign payroll).

## How these plans work

- **Phases run in order.** A phase does not start until the previous phase's **Gate** is signed off (sponsor + named UAT users). Gates are listed at the bottom of each file.
- **Stages** are the ordered chunks inside a phase — each stage is roughly a PR-train / 2–5 working days of work with its own exit criteria. A stage isn't "done" until every exit criterion passes.
- **Checkboxes are the state.** Tick tasks as they merge; update the stage status marker. Commit the plan file change *in the same PR* that completes the work.
- Stages within a phase may overlap where dependencies allow (each stage lists `Depends on`), but exit criteria are never waived.

## Stage template

```
## Stage N.M — <name>   `[ ☐ not started | ◐ in progress | ☑ done ]`
**Goal:** one sentence.
**Depends on:** stage refs.
**Tasks:** - [ ] checkbox list, tagged with plan task ID (P1-T05) + requirement IDs (ATT-03)
**Modules/files:** indicative monorepo paths
**Tests required:** per docs/14 §10 program
**Exit criteria:** verifiable checks
```

## Definition of done (every task, every stage — from docs/14)

1. **Traceability:** the PR title cites a requirement ID (`feat: ATT-08 OT 48h lapse job`). No orphan features.
2. **CI gates all green (blocking):** typecheck (max-strict) → eslint (type-aware) → knip → dependency-cruiser (module boundaries) → unit/property tests → integration tests (real Postgres) → golden-master payroll diff (Phase 2+) → Playwright smoke.
   *Status 1 Sep 2026:* backend `verify` runs typecheck · lint · knip · dependency-cruiser · **162 tests** · build. Frontend `verify` runs typecheck · lint · knip · **156 tests (Vitest + Testing Library + axe, 82% coverage)** · build. **Playwright E2E smoke is still the one missing gate.**
3. **Tests written per the doc 14 §10 program** — statutory logic is test-FIRST with hand-computed expected values; 80% coverage floor, payroll-core 100% branch.
4. **No hardcoded policy values** — every policy number reads from `core.settings` (docs/04 §8).
5. **Design firewall respected** — Warm Editorial only (docs/05 §0.1); accessibility bar (docs/05 §7) is part of done.
6. **Human review is mandatory** on any diff touching `payroll-core/` or statutory seed data.
7. **Money paths:** golden/property tests updated; shadow-run comparison where logic changed (Phase 2+).

## Key spec references

- `docs/13-MASTER-BUILD-PLAN.md` — the master plan these files decompose (task IDs P0-T01…P2-T12)
- `docs/14-TECH-STACK-AND-RELIABILITY.md` — stack decision record + reliability program (wins over doc 02 on conflict)
- `docs/03-DATABASE-SCHEMA.md` — every table/column · `docs/04-MODULE-SPECS.md` — exact behavior
- `docs/08-ROLES-AND-PERMISSIONS.md` — RBAC seed + per-role shells · `docs/10-INDIA-PAYROLL-STATUTORY-REFERENCE.md` — rates + golden fixtures

## Frontend route map (locked 11 Jul 2026 — P0-T33 shell)

Product routes live in `frontend/src/app/router.tsx`. **Every route now resolves to a real page** — `PlaceholderPage` is gone. Surfaces whose *backend* lands in a later phase render their real layout plus an honest pending panel naming the phase and task, and never invented data (docs/05 §4.8: *"never fake data"*).

| Path | Status | Phase |
|---|---|---|
| `/login`, `/` (role home) | live | 0 |
| `/people`, `/people/:ecode` | live (P0-T33) | 0 |
| `/approvals`, `/my/*`, `/attendance/*`, `/leave` | live (Stage 1.3–1.7) | 1 |
| `/team`, `/reports/*`, `/policies`, `/letters` | live (Stage 1.7) | 1 |
| `/admin/users`, `/admin/settings`, `/admin/workflows`, `/admin/masters`, `/admin/audit` | live (Stage 1.8) | 1 |
| `/payroll/*`, `/loans`, `/claims`, `/my/pay`, `/my/claims` | UI live · backend Phase 2 | 2 |
| `/lifecycle/*`, `/assets`, `/helpdesk`, `/engagement`, `/executive` | UI live · backend Phase 3 | 3 |
| `/travel/*` | UI live · backend Phase 3.5 | 3.5 |
| `/recruitment/*` | UI live · backend Phase 4 | 4 |
| `/dev/gallery` | live (super_admin) | 0 |

**Next UI stage:** Phase 2 payroll console (P2-T08) — **blocked** until the 9 statutory policy decisions (P0-T06) are signed; no money code starts before that.
