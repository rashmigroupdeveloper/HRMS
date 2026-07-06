# Feature modules

Every business capability is a module here, following the proven Yatra Avedan pattern (docs/02 §1, docs/11 §3):

```
modules/<name>/
├── index.ts              ← the module's ONLY public surface
├── <name>.routes.ts      ← route/RPC procedure definitions
├── <name>.controller.ts  ← request handling, zod validation at the boundary
├── <name>.service.ts     ← business logic (pure where possible)
└── <name>.repository.ts  ← all database access (Kysely; no SQL elsewhere)
```

**Rules (machine-enforced by `.dependency-cruiser.cjs` — the build fails otherwise):**
1. Cross-module imports go through `modules/<x>/index.ts` only — never deep imports.
2. `core/` never imports from `modules/`.
3. Policy numbers come from the settings store, never hardcoded (docs/04 §8).

Planned modules land by stage (see `plans/`): `auth`, `rbac`, `audit`, `settings`,
`notifications` (Stage 0.4) → `org`, `employees`, `documents`, `import` (0.5) →
`attendance`, `workflows`, `leave` (Phase 1) → `payroll-core`, `loans`, `claims`
(Phase 2) → `lifecycle`, `assets`, `helpdesk`, `engagement` (Phase 3) → `travel` (3.5).
