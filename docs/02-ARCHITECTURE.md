# 02 — System Architecture

## 1. Stack (frontend + DB from the proven ATS; backend adopts Yatra Avedan's TypeScript module pattern)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 | Same as ATS; design tokens already exist (`@theme inline` in ATS `index.css`) |
| UI libs | Framer Motion, Lucide icons, Recharts, sonner (toasts), react-select, react-datepicker, SWR | All already in the ATS `package.json` — zero new UI dependencies |
| Backend | Node.js (LTS) + Express 5 + **TypeScript** | ATS layout + the proven **Yatra Avedan module pattern** (`modules/<x>/x.controller|service|routes|repository.ts`, `core/{models,middleware,services,utils}`, zod validation) — the team already builds this way (doc 11) |
| Database | PostgreSQL 16 | Same as ATS; one instance serves both apps (separate databases: `ats`, `hrms`) |
| Auth | JWT access (15 min) + refresh (7 d, httpOnly cookie), bcrypt | Extends the ATS auth model into an SSO issuer |
| Jobs | `pg-boss` (Postgres-backed job queue) + `node-cron` | No Redis needed on the WHM box; queue state survives restarts; retries built in |
| Files | **S3-compatible object store via a storage adapter — SeaweedFS** (bucket pattern from Yatra Avedan's `storage.service.ts`); receipts, documents, letters, payslip PDFs | **Amended by doc 14 §4:** MinIO OSS entered maintenance mode (Dec 2025) — dead for new builds. The running EMS MinIO becomes a Phase-3.5 migration source, not the HRMS store |
| Booking | Pluggable travel-booking connector — **MakeMyTrip Corporate** (port from Yatra Avedan `mmt` module) behind an interface | T&E module (M13); provider swappable |
| SMS/OTP | Twilio (phone verification) + Resend/nodemailer email | Yatra Avedan already uses these; reuse |
| Documents | `docx` templating (letters/LOI — already used in ATS), ExcelJS (exports), `pdf-lib`/headless Chrome for payslip PDFs | Reuse ATS letter-generation code |
| Process manager | PM2 (cluster mode for API, fork for workers) | Standard on WHM/cPanel Node hosting |
| Testing | Vitest + Testing Library (frontend), Vitest + supertest (API), pgTAP-style SQL fixtures for payroll math | Payroll engine requires golden-file tests (see 04-MODULE-SPECS §6.9) |

> **⚠ Amended by 14-TECH-STACK-AND-RELIABILITY.md (6 Jul 2026, research-verified):** pin **Node 24 LTS**; add **Kysely** as the query layer (no string-built SQL); add **typed RPC contracts (oRPC/tRPC) with zod input+output schemas** (REST envelope kept only for external endpoints); add integer-paise **Money module** + single rounding-policy file; **max-strict tsconfig** + knip + dependency-cruiser (machine-enforced module boundaries); **SeaweedFS** replaces MinIO; fast-check property tests + Stryker mutation testing on payroll-core; hash-chained audit log (MCA edit-log rule). Doc 14 is the decision record — where it conflicts with this table, doc 14 wins.

**Monorepo layout** (new repo `rashmi-hrms`; ATS remains in its repo until Phase 4):

```
rashmi-hrms/
├── apps/
│   ├── web/            # React app (Vite)
│   └── api/            # Express app
│       ├── src/routes | controllers | services | models | validators | middleware | jobs
│       └── migrations/ # numbered SQL migrations (node-pg-migrate)
├── packages/
│   ├── ui/             # Warm Editorial primitives: Card, DarkCard, Pill, StatusBadge,
│   │                   # KpiNumber, DataTable, FilterPanel, Drawer, EmptyState, Timeline
│   ├── tokens/         # design tokens (single source; ATS consumes in Phase 4)
│   └── shared/         # zod schemas shared by web+api (validation at both boundaries)
├── docs/               # this documentation set travels with the code
└── ecosystem.config.js # PM2: hrms-api (cluster), hrms-worker (jobs), hrms-scheduler (cron)
```

Rules: files ≤ 400 lines typical; feature-folder organization (`attendance/`, `payroll/`…), not type folders at app level; every API response uses the envelope `{ success, data, error, meta }` (matches user's global patterns rule and the ATS convention).

## 2. Deployment topology (WHM server, full root)

```
                    ┌──────────────────────── WHM/cPanel server ───────────────────────┐
 users ── HTTPS ──▶ │ Apache/LiteSpeed vhosts (AutoSSL)                                 │
                    │   hrms.rashmigroup.com  ──proxy──▶ 127.0.0.1:5100 (hrms-api PM2)  │
                    │   (web static from apps/web/dist served by vhost)                 │
                    │   ats.<domain>          ──proxy──▶ 127.0.0.1:5000 (existing ATS)  │
                    │ PostgreSQL 16 (localhost only)  ── databases: hrms, ats           │
                    │ PM2: hrms-api ×2 · hrms-worker ×1 · hrms-scheduler ×1 · ats ×1    │
                    │ S3-compatible object store (SeaweedFS — doc 14 §4) — receipts, letters,   │
                    │   payslip PDFs (DB holds keys)                                    │
                    └───────────────────────────────────────────────────────────────────┘
        nightly: pg_dump (hrms, ats) + object-store bucket mirror → encrypted → OFF-BOX destination
        continuous: WAL archiving to off-box for point-in-time recovery of payroll months
```

Operational hard rules:
1. PostgreSQL listens on localhost only; no phpPgAdmin exposure.
2. `.env` files outside web roots, `600` perms; secrets never in the repo (user global security rule).
3. Deploys via a script (build → migrate → `pm2 reload`); **frozen during payroll run days**.
4. UFW/CSF: only 80/443/SSH open; SSH key-only.
5. Off-box backup destination is mandatory before payroll go-live (another server, or object storage); a backup on the same disk is not a backup.
6. Monitoring: PM2 monit + a cron that alerts (email) on disk >80%, failed jobs, and biometric-ingestion gaps (see §4).

## 3. Integration: ATS (SSO now, absorption later)

**Phase 1 (SSO + read):**
- HRMS becomes the JWT issuer; ATS validates the same signed tokens (shared public key / secret). One login for users of both.
- HRMS exposes `GET /api/v1/integration/ats/joined-candidates?since=` **or** reads the ATS DB directly (same Postgres instance, read-only role `hrms_ro` on `ats` DB — simplest and transactional). Chosen: **direct read-only cross-DB access** via `postgres_fdw` or a nightly sync job; no HTTP hop on the same box.

**Phase 2 (onboarding handoff):** ATS "Joined List" entries create `onboarding_candidates` rows in HRMS (LC-01), carrying the complete LOI payload (candidate details, position, compensation incl. probation %, documents). The offer report (RPT-02) reads LOI data from ATS until Phase 4.

**Phase 4 (absorption):** ATS frontend mounts under the HRMS shell (`/recruitment`), consumes `packages/ui` + `packages/tokens`; candidates/vacancies/offers tables migrate into the `hrms` database under a `recruit` schema. Until then the ATS codebase is not touched except for JWT validation.

## 4. Integration: Kent/Astra biometric (the make-or-break one)

Evidence from documents: swipes live in a Kent cloud ("Astra" swipe type; "Kent cloud"; IT "runs schedulers provided by Kent"). The export schema is known (EmployeeSwipeDetails.xlsx, 17 columns). Exact access method (DB view, REST API, or SFTP/CSV drop) **must be confirmed with RML IT in week 1** — the connector is built behind an interface so the fetch strategy is swappable:

```
KentConnector (interface)
 ├── fetchSince(deviceOrSite, watermarkTs) → RawSwipe[]
 ├── listDevices() → health/last-seen per device/door
 └── implementations: KentDbView | KentRestApi | KentCsvDrop
```

Pipeline (every 5 min, `hrms-scheduler` → `pg-boss` job):
1. Pull swipes since per-source watermark (overlap window 30 min to catch late arrivals).
2. Upsert into `attendance.swipe_events` (idempotent on natural key: employee_no + swipe_ts + door). Raw rows are **never updated or deleted**.
3. Advance watermark only after commit.
4. Gap detection: if a device/door that averages N swipes/hour reports zero for a configurable window during working hours → alert IT + HR ops dashboard tile (ATT-02). This is the failure that produced the 200-employee muster mismatch — it must page someone, not silently under-count.
5. Day-status recompute job marks affected employee-dates dirty; processor recomputes them (ATT-03).

Mobile/geo check-in (ATT-14, sales staff): PWA `POST /check-in` with GPS; stored in the same `swipe_events` table with `source='mobile'`, longitude/latitude filled — the Kent export schema already has these columns, so processing is uniform.

## 5. Integration: email, SAP, payroll bank files

- **Email:** Nodemailer via RML SMTP (same as ATS). All sends go through the `notifications` queue with retry + dead-letter; templates in DB with merge fields. Daily digests (boarding/exit report LC-03) are scheduled jobs that render ExcelJS attachments.
- **SAP (finance):** payroll JV report exported in the SAP-consumable format Protiviti produced (columnar Excel/CSV per cost center + GL mapping table `payroll.gl_accounts`). Legacy loan balances (pre-May-2025, PP-11/SOW-5.5) imported once via Excel loader.
- **Bank transfer:** per-run generated file in the bank's bulk-upload format (confirm format with finance — greytHR produced one; replicate columns). Stored against the run, downloadable by payroll role only.
- **EPFO/ESIC/PT/TDS:** generate portal-ready files (ECR text for EPFO, ESIC upload excel, PT register, 24Q data for the TDS utility). Filing remains manual on govt portals (PRD §11).

## 6. Background jobs catalog

| Job | Schedule | Requirement |
|---|---|---|
| kent-sync | */5 min | ATT-01/02 |
| attendance-recompute | on dirty-flag, batched | ATT-03 |
| daily-boarding-exit-email | daily 07:00 | LC-03 |
| ot-pending-reminder / ot-lapse | hourly / daily | ATT-08 |
| absentee-scan (7-day UAB → show-cause queue) | daily 06:00 | ATT-10 |
| late/early/UAB alerts | daily post-shift | ATT-11 |
| leave-monthly-credit | 1st, 00:05 | LV-02 |
| comp-off-expiry, leave-lapse/carry-forward | daily / year-end | LV-04/01 |
| probation-reminders | daily | LC-04 |
| roster-deadline-reminder | monthly (config, ~5th) | ATT-04 |
| approval-sla-escalation | hourly | WF-03 |
| policy-ack-nag | weekly | CORE-13 |
| notification-queue drain | continuous (pg-boss) | WF-02 |
| nightly-backup + backup-verify | daily 01:30 | NFR-05 |
| payroll jobs (draft compute, finalize, payslip render) | on demand | PAY-03 |

## 7. Open-source adoption (what, exactly, and how)

| Source | License | What we take | How |
|---|---|---|---|
| [Frappe HR](https://github.com/frappe/hrms) | MIT (GPLv3 for framework — we take *designs*, and MIT parts only if code is copied) | Salary Structure / Salary Component formula model; income-tax slab + HRA exemption + marginal relief computation flow; leave-ledger (allocation/encashment ledger) pattern; auto-attendance-from-checkins algorithm | Port data model + algorithms to our PostgreSQL schema (03-DATABASE §6) and services; do not run Frappe |
| frappe/biometric-attendance-sync-tool | GPLv3 | Architecture pattern only (poll device → push with watermark) | Reimplement as KentConnector (§4); no code copied |
| [Horilla](https://github.com/horilla-opensource/horilla) | LGPL | Reference for Indian statutory config UX (PF/ESI/TDS setting screens) | Design reference only |
| node-pg-migrate, pg-boss, ExcelJS, docx/docxtemplater, Recharts, zod | MIT | Direct dependencies | npm |
| india-tax data (slabs/PT rates) | n/a | Maintain our own versioned `statutory_rates` tables (03-DATABASE §6.8) seeded from official EPFO/ESIC/WB-PT/IT notifications | Rates are data, not code — reviewed each Budget/notification |

**Verdict repeated for clarity:** adopt patterns and libraries, not platforms. The UI/UX bar (Warm Editorial) and the one-platform goal (D4) rule out embedding a foreign app.

## 8. Security architecture (summary — detail in module specs)

- RBAC: `roles`, `permissions` (module × action), `role_permissions`, per-user role grants; manager scope resolved via the reporting tree closure table (CORE-10, KQ multi-level case).
- Data classification: `restricted` columns (salary, bank, PAN, Aadhaar, UAN) served only to `payroll.*`/`hr.compensation.read` permission holders; masked (`XXXX1234`) elsewhere; never logged.
- All inputs validated with shared zod schemas at API boundary (user global rule: validate at boundaries; fail fast).
- Audit: `audit_log` append-only (03-DATABASE §2.7); auth events (login, failed login, password reset) logged with IP.
- Rate limits: 5/min on auth, 100/min general per user; account lockout with backoff.
- Payroll immutability: finalized `payroll_runs` rows are guarded by a DB trigger rejecting UPDATE/DELETE unless run status is reopened by a permission-gated, audited action.
