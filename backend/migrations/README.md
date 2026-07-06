# Database migrations (node-pg-migrate)

Numbered, forward-only migrations. Conventions (docs/03, docs/14 §6.5):

- `npm run migrate:create -- <name>` → new timestamped file here.
- **Every DDL migration starts with `SET lock_timeout = '5s';`** — a blocked
  migration must fail fast, never queue behind traffic and freeze production.
- `CREATE INDEX CONCURRENTLY` for indexes on populated tables.
- **Expand/contract only** for renames/drops: the previous app version must run
  against the new schema (keeps `pm2 deploy revert` viable).
- Schemas per module domain: `core`, `att`, `lv`, `pay`, `wf`, `ast`, `hd`, `eng`
  (docs/03 conventions).
- Constraints are the spec: NOT NULL by default, CHECK/FK/UNIQUE/EXCLUDE per
  docs/03 §10 and docs/14 §6 — never "we'll validate in the app".

First real migrations arrive in Stage 0.4 (auth/RBAC tables).
