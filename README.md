# Rashmi HRMS

Single web platform for Rashmi Group HR: attendance (biometric), leave, approvals, full India payroll & statutory, lifecycle, reports/dashboards, T&E and (later) recruitment.

- **Specs:** [`docs/`](docs/00-EXECUTIVE-SUMMARY.md) — read `00` → `07`, then `13` (master plan) and `14` (tech decisions).
- **Execution tracker:** [`plans/`](plans/README.md) — one file per phase, stages with checkboxes and gates.

## Structure — two fully independent projects (separate teams)

```
frontend/   React 19 + Vite + Tailwind v4 — own package.json, node_modules, configs
backend/    Express 5 + TypeScript + Kysely + PostgreSQL — own package.json, node_modules, configs
docs/       the specification set
plans/      the execution tracker
```

Each project installs, tests, and builds on its own; CI runs them as separate jobs. The contract between them is the HTTP API (typed, OpenAPI-emitting — docs/14 §3). Frontend never imports backend source, and vice versa.

Full decision record: [`docs/14`](docs/14-TECH-STACK-AND-RELIABILITY.md). Design system: docs/05 (Warm Editorial — the only UI language allowed).

## Getting started

**One-shot local setup** (Postgres must be running on `:5432`):
```bash
bash scripts/setup-local-env.sh
```
Creates the `hrms` database user/db, writes `backend/.env`, installs deps, and runs migrations.

**Backend**
```bash
cd backend
npm install
# Or: cp .env.example .env and set DATABASE_URL manually
npm run dev               # http://localhost:5100/health
```

**Frontend**
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxies /api → :5100)
```

## Quality gates — `npm run verify` in each project

Backend: typecheck → lint (type-aware) → knip → depcruise (module boundaries) → tests → build.
Frontend: typecheck → lint → knip → build.
Definition of done for every PR: [`plans/README.md`](plans/README.md).
