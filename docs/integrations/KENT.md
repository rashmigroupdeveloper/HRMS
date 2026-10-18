# Kent attendance feed — adapter interface and runbook

The HRMS pulls punches from Kent over HTTP every 5 minutes (pg-boss job `kent-sync`, also
`POST /api/attendance/sync` for "Sync now"). Code: `backend/src/modules/attendance/kent-http-connector.ts`.
Everything after the fetch — dedupe, plausibility quarantine, unmatched e-code log, device health,
watermarks, day-status recompute → muster → payroll — is the shared pipeline (`ingest.service.ts`),
so attaching the real API is configuration, plus at most a field map.

## Configuration (backend env)
| Variable | Default | Meaning |
|---|---|---|
| `KENT_BASE_URL` | unset → sync is skipped (worker) / fails closed with 503 (Sync now) | Kent API root |
| `KENT_API_KEY` | required when base URL set | API key |
| `KENT_API_KEY_HEADER` | `X-API-Key` | header carrying the key |
| `KENT_PAGE_SIZE` | 1000 | page size for `/punches` |
| `KENT_TIMEOUT_MS` | 15000 | per request |
| `KENT_MAX_RETRIES` | 3 | retries on network errors, HTTP 5xx and 429 (exponential backoff 0.5s→30s). 4xx (bad key) is not retried. |
| `KENT_DEFAULT_OFFSET` | `+05:30` | zone applied to device times that carry none |
| `KENT_DEVICE_MAP` | `{}` | JSON: Kent device id → HRMS door code (`att.devices.door_code`, which carries the plant/location) |
| `KENT_FIELD_MAP` | see below | JSON override of field names if the real API differs |

## Contract the adapter expects
`GET {base}/punches?since=<ISO instant>&limit=<n>[&cursor=<c>]` → `{"items":[...], "nextCursor": "<c>"|null}`
Each item (default field names; override with `KENT_FIELD_MAP`):
`employeeNo` (e-code; upper-cased), `cardNo` (optional), `punchTime` (ISO; zone-less = default offset),
`deviceId`, `direction` (`in`/`out`, optional), `receivedAt` (when Kent received it; optional, defaults to now).
`since` is compared with **receivedAt** (devices buffer offline swipes).

`GET {base}/devices` → `{"items":[{"deviceId","lastSeen","completeThrough"}]}` — `completeThrough` is
trusted only with `lastSeen` and only when ≤ `lastSeen` (never claims completeness it has not proved).

## Behaviour
- **Dedupe**: unique (employee_no, swipe_ts, door_code, source); the fetch window overlaps the watermark, so re-reads are harmless.
- **Backfill**: move the `att.ingest_watermarks` row for source `kent` back (or delete it) and run Sync now; dedupe keeps it idempotent. Day records recompute automatically.
- **Errors**: unknown e-codes are returned as `unmatched` and logged; implausible times go to `att.quarantined_swipes`; HTTP failures are logged (`kent-sync`) and the cycle is retried next tick; silent doors raise device-health alerts.
- **Webhook push**: not required — polling every 5 minutes meets ATT-01 (≤5 min). If Kent can only push, point it at a small relay that stores punches and exposes the contract above (the simulator is such a relay).

## Simulator (test before the real API exists)
```
cd backend && KENT_API_KEY=dev KENT_SIM_PORT=5199 npm run kent:simulator
# backend env: KENT_BASE_URL=http://127.0.0.1:5199 KENT_API_KEY=dev
curl -XPOST localhost:5199/_sim/punches -d '[{"employeeNo":"RML033625","punchTime":"2026-10-19 09:02:00","deviceId":"G1","direction":"in","receivedAt":"2026-10-19T03:33:00Z"}]'
```
`KENT_SIM_FAIL_EVERY=3` makes every third call return 503 to exercise retries. Tests:
`backend/tests/kent-adapter.integration.test.ts` (paging, retry, auth, device map, ingest, dedupe, unmatched).

## From punches to payroll (month close)
- A swipe dirties its own day (and the previous day, for night-shift attribution); `kent-sync` recomputes them.
- Days with **no** swipe (absence, week-off, holiday) are created by the hourly `attendance-materialize` job
  (last `att.materialize_lookback_days`, default 45, up to yesterday) or on demand with
  `POST /api/attendance/recompute {"companyId", "from", "until"}` (≤ 62 days, entity-scoped).
- An absence is final only when every active door of the employee's location is complete through shift end
  (`completeThrough` from `/devices`); until then the day is held. A door without a location in
  Admin → Attendance masters holds every absence at that location and blocks the month lock.
- Week close (Monday 02:00) decides paid/forfeited week-offs; month lock freezes the attendance window
  (`att.cycle_start_day`); muster LOP equals the payroll deduction.
- Proven end to end by scenario-matrix cases K01–K03 (`docs/qa-handover/attendance-payroll/scripts`).

## Go-live checklist with the real API
1. Get base URL, key, field names, device list from Kent/IT. 2. Fill `KENT_DEVICE_MAP` so every device maps to a door in Admin → Attendance masters. 3. Point at a staging DB, run Sync now, compare one day's muster with Kent's own report. 4. Backfill the current month. 5. Enable in production.
