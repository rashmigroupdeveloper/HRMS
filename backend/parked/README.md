# Parked work

Files here are **not** part of the build: they sit outside `migrations/` so `npm run migrate` cannot
apply them, and outside the `tsconfig`/eslint globs so they cannot fail a gate.

Currently empty.

## Removed

| File | Why |
|---|---|
| `1752080000000_clb-contract-labour.ts.parked` | Contract-labour schema, written for the former Phase 6 Stage 6.1. **Deleted 3 Sep 2026:** sponsor settled decision D8 — contract labour is a separate product (CLMS), so HRMS will never own this schema. Its timestamp had also been taken by `1752080000000_shift-micro-scheduling.ts`, so it could not have been restored as-was. |
