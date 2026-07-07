# Database migrations (node-pg-migrate)

Numbered, forward-only migrations. Conventions (docs/03, docs/14 §6.5):

- `npm run migrate:create -- <name>` → new timestamped `.sql` migration here.
- Rollback SQL for migration 0001 lives in `scripts/rollback/` (manual / `migrate:down` TBD when paired down files are wired).
- **Every DDL migration starts with `SET lock_timeout = '5s';`** — a blocked
  migration must fail fast, never queue behind traffic and freeze production.
- `CREATE INDEX CONCURRENTLY` for indexes on populated tables.
- **Expand/contract only** for renames/drops: the previous app version must run
  against the new schema (keeps `pm2 deploy revert` viable).
- Schemas per module domain: `core`, `att`, `lv`, `pay`, `wf`, `ast`, `hd`, `eng`
  (docs/03 conventions).
- Constraints are the spec: NOT NULL by default, CHECK/FK/UNIQUE/EXCLUDE per
  docs/03 §10 and docs/14 §6 — never "we'll validate in the app".

**Note:** Migrations are **SQL files** (`.up.sql` / `.down.sql`) so `node-pg-migrate` works with the backend's `"type": "module"` package — TypeScript migration files are not supported by the runner without a custom loader.
