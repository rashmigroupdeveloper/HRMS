# HRMS Execution Plans

This folder is the **live execution tracker** for the Rashmi HRMS build. The specs live in `docs/` (what to build and why); these files track **in what order and what's done**.

| Phase file | Scope | Duration | Gate |
|---|---|---|---|
| [phase-0-foundations.md](phase-0-foundations.md) | Repo, tooling, auth/RBAC, employee master, de-risk spikes | 3 wk | G0 |
| [phase-1-attendance-leave-workflows.md](phase-1-attendance-leave-workflows.md) | Biometric ingestion, attendance, leave, approvals, core reports, ESS | 6–8 wk | G1 |
| [phase-2-payroll-statutory.md](phase-2-payroll-statutory.md) | Full India payroll engine, statutory outputs, loans, claims, parallel run | 8–10 wk | G2 |
| [phase-3-lifecycle-assets-executive.md](phase-3-lifecycle-assets-executive.md) | Onboarding, separation/F&F, transfers, assets, helpdesk, engagement, CEO dashboard | 5–6 wk | G3 |
| [phase-3.5-travel-expense.md](phase-3.5-travel-expense.md) | T&E module (M13) — absorb & supersede Yatra Avedan | 4–6 wk | G3.5 |
| [phase-4-ats-absorption.md](phase-4-ats-absorption.md) | ATS absorption, contract workers, PWA rollout | scoped later | — |

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
2. **CI gates all green (blocking):** typecheck (max-strict) → eslint (type-aware) → knip → dependency-cruiser (module boundaries) → unit/property tests → integration tests (real Postgres via Testcontainers) → golden-master payroll diff (Phase 2+) → Playwright smoke.
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

Product routes live in `frontend/src/app/router.tsx`. Surfaces not yet built render `PlaceholderPage` so deep links and per-role nav work.

| Path | Status | Phase |
|---|---|---|
| `/login`, `/` (role home) | live | 0 |
| `/people`, `/people/:ecode` | live (P0-T33) | 0 |
| `/approvals`, `/my/*`, `/attendance/*`, `/leave` | placeholder | 1 |
| `/payroll/*`, `/loans`, `/claims`, `/my/pay`, `/my/claims` | placeholder | 2 |
| `/lifecycle/*`, `/assets`, `/helpdesk`, `/engagement`, `/executive` | placeholder | 3 |
| `/travel/*` | placeholder | 3.5 |
| `/recruitment/*` | placeholder | 4 |
| `/dev/gallery` | live (super_admin) | 0 |

**Next UI stage after P0-T33:** Approvals inbox (P1-T12 UI) — do not start until sponsor announces Stage 1.x.
