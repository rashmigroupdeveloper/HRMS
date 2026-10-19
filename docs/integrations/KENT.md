# Kent CamAttendance integration

_Rewritten 19 Oct 2026 after KENT_RESEARCH.md. Code: `backend/src/modules/attendance/kent-*.ts`._

## What Kent is at RML
RML uses **KENT CamAttendance**: Android face-recognition terminals that sync to the **Kent cloud**. Kent officially offers
five ways to get data out: **webhook push**, a **token-secured pull API** (often custom per client), **SFTP/FTP upload**,
**scheduled CSV/Excel jobs** to a share, and a **DB-integration exe** that writes rows into a client database.

Kent devices send **no in/out direction**, so HRMS uses first-in/last-out. ZKTeco/eSSL ADMS is not relevant.

**"Astra" is not Kent.** In the old `EmployeeSwipeDetails.xlsx`, "Swipe Type = Astra" is **Greytip Astra**, greytHR's on-prem
agent. The chain today is most likely Kent cloud → Kent DB-integration exe → a local SQL table → Astra → greytHR.
That local table is the DB-read source described below.

## Modes in HRMS
Every mode feeds the same pipeline (`ingestOnce`): plausibility quarantine, unmatched e-code exception queue,
de-duplication on (employee_no, swipe_ts, door_code), device heartbeat, and recompute of the affected days.
Re-sending or re-reading the same data never creates duplicates.

| Mode | Use it for | Enable with |
|---|---|---|
| **Webhook** (recommended, real time) | Kent portal → Settings → Webhooks → Add New, type **Recognition** | `KENT_WEBHOOK_TOKEN` |
| **API pull** | Daily catch-up behind the webhook, or the main feed if Kent gives API access | `KENT_MODE=api`, `KENT_BASE_URL` |
| **DB read** | Read the table the Kent exe writes (the one Astra reads). Lowest-risk cut-over; can run in parallel with greytHR | `KENT_MODE=db`, `KENT_DB_URL`, `KENT_DB_TABLE` |
| **CSV / SFTP drop** | Kent scheduled jobs or SFTP upload into a folder | `KENT_MODE=csv`, `KENT_CSV_DIR` |
| **Manual upload** | Bulk import page → "Attendance punches", for the greytHR/Kent export as-is | (always on) |

Only one pull mode runs at a time. The worker runs it every 5 minutes, and "Sync now" on the Devices page runs it on demand.
The webhook is independent and can run alongside any pull mode. Keep a pull/CSV/DB mode as the **catch-up**, because a
webhook that Kent fires while our server is down is lost unless Kent retries it (retry policy is undocumented).

### 1. Webhook
- URL to register in Kent: `https://<host>/api/integrations/kent/webhook/<KENT_WEBHOOK_TOKEN>`
  - The token must be at least 24 characters (`openssl rand -hex 24`). A wrong token returns 404.
  - HTTPS only (terminate TLS at the proxy).
- Optional `KENT_WEBHOOK_ALLOW_IPS`: comma-separated Kent egress IPs. Other addresses get 403.
- Optional `KENT_WEBHOOK_HEADER` and `KENT_WEBHOOK_HEADER_VALUE`: a shared header, if Kent agrees to send one. A wrong value gets 401.
- Body: Kent's JSON array. A single object is also accepted:
  `{empId, employeeName, time, type, imageUrl, accountId, companyId, mode, locationName, deviceName, departmentName, deviceId}`
- Processing:
  1. The raw body is stored first in `att.kent_webhook_batches`, with counts and any error. Invalid JSON returns 400 and the raw body is still kept.
  2. `type: 0` (unknown face) is never a swipe. It goes to `att.kent_unknown_faces` with its image URL, device and location.
  3. Recognised events are ingested with source `kent_webhook`. Received time is the **arrival time**.
  4. The door is `KENT_DEVICE_MAP[deviceId]`, else `KENT_DEVICE_MAP[deviceName]`, else deviceId, else deviceName.
- Responses:
  - 200 `{ok, batchId, received, accepted, inserted, unknownFaces, rejected}`
  - 500 means "stored but not processed". Kent can retry safely.

### 2. API pull (configurable, because Kent's API is per-client)
| Variable | Default | Meaning |
|---|---|---|
| `KENT_AUTH` | `header` | `header` (`KENT_API_KEY_HEADER`: `KENT_API_KEY`), `bearer`, `query` (`?KENT_API_KEY_QUERY=`), `login`, `none` |
| `KENT_LOGIN_PATH`, `KENT_LOGIN_BODY`, `KENT_LOGIN_TOKEN_PATH` | – / `{}` / `token` | For `login`: POST the JSON body, read the token at a dot path, and send it as Bearer. On a 401 the adapter logs in again once. |
| `KENT_PULL_PATH` | `/punches` | Recognition-log endpoint (may contain its own `?query`) |
| `KENT_Q_SINCE`, `KENT_Q_UNTIL`, `KENT_Q_LIMIT`, `KENT_Q_CURSOR`, `KENT_Q_PAGE` | `since`, –, `limit`, `cursor`, `page` | Query parameter names. Leave one empty to omit it. |
| `KENT_SINCE_FORMAT` | `iso` | `iso`, `epoch_s`, `epoch_ms`, or `local` (`YYYY-MM-DD HH:mm:ss` in `KENT_DEFAULT_OFFSET`) |
| `KENT_PAGING` | `cursor` | `cursor` (next value at `KENT_NEXT_CURSOR_PATH`), `page` (from `KENT_PAGE_START`, default 1), `offset` (row offset in the page parameter), `none` |
| `KENT_ITEMS_PATH` | `items` | Dot path to the record array (e.g. `data.records`; empty means the body itself) |
| `KENT_REREAD_DAYS` | `3` | Every pull re-reads at least this many days back, so late uploads from offline devices are caught even when the API filters by punch time (the PP-9 failure). Dedupe makes this free. |
| `KENT_DEVICES_PATH` | empty | Device list endpoint, if Kent has one. Empty means device health comes from the silent-door alert. |
| `KENT_FIELD_MAP` | Kent webhook names | JSON override of `{employeeNo:"empId", time:"time", device:"deviceId", deviceName:"deviceName", type:"type", card:"cardNo", direction:"direction", receivedAt:"receivedAt"}` |
| `KENT_PAGE_SIZE`, `KENT_TIMEOUT_MS`, `KENT_MAX_RETRIES` | 1000, 15000, 3 | 5xx and 429 responses are retried with backoff. Other 4xx responses fail at once. |

### 3. DB read
- Settings:
  - `KENT_DB_URL`: a read-only user.
  - `KENT_DB_TABLE`: may include the schema (`schema.table`).
  - `KENT_DB_COLUMNS`: JSON, `{"employeeNo","time","device","card?","direction?","receivedAt?"}`.
  - `KENT_DB_WATERMARK`: `time` (default; re-reads `KENT_REREAD_DAYS`) or `receivedAt` (when the table has an upload or insert time).
- The query is `SELECT … WHERE <watermark col> > $1 ORDER BY … LIMIT KENT_PAGE_SIZE`. Identifiers are validated, never interpolated raw.
- PostgreSQL is built in. If the RML table is on **MS SQL Server or MySQL**, add the driver (`mssql` or `mysql2`) behind the
  `KentDbClient` interface. That is about 20 lines, and it can only be done once IT confirms the engine (open question 1).

### 4. CSV / SFTP drop
- Settings:
  - `KENT_CSV_DIR` is the folder being watched.
  - `KENT_CSV_ARCHIVE_DIR` defaults to `<dir>/processed`.
- Files (`*.csv`, `*.txt`) are read in name order. The delimiter (`,`, `;` or tab) is auto-detected.
- Columns are matched by header alias. Defaults:
  - Employee: Employee No, EmpId, Ecode
  - Time: Swipe Date, Time, Punch Time
  - Device: Door/Address, Device Id, Device Name
  - Direction: Status, Direction
  - Received: Received On
- Add your own aliases with `KENT_CSV_ALIASES` (JSON per field).
- Files are archived **only after** the batch is committed. A crash in between re-reads the files, and dedupe makes that safe.

### 5. Manual bulk import (greytHR/Kent export)
| Export column | Used as |
|---|---|
| **Status** | Direction (IN/OUT). Blank means first-in/last-out. |
| **Swipe Type** | Kept as the source tag (e.g. `Astra`). It is not a direction. Older templates with IN/OUT here still work. |
| **Received On** | Stored as `received_at`, so the device-to-cloud lag is preserved. Blank means upload time. |

## Time handling (all modes)
- **Epoch numbers:** below 1e12 is read as **seconds**, otherwise as milliseconds.
- **ISO 8601** values are accepted with or without a zone.
- **Other formats:** `16 Jun 2025 15:03:40` (the export format), `16-Jun-2025 15:03` and `02/06/2026 09:00:00` (day first).
- **Missing zone:** `KENT_DEFAULT_OFFSET` is applied (default `+05:30`). Record the zone Kent confirms.

## Simulator
`npm run kent:simulator` (port `KENT_SIM_PORT`, default 5199) serves:
- **Style A:** `GET /punches` and `/devices` with `X-API-Key`, cursor paging, filtered on received time.
- **Style B:** `POST /api/login` → `{data:{token}}` (set `KENT_SIM_LOGIN=user:pass`), then `GET /api/recognition-logs?fromDate=<epoch s>&page&pageSize` with Bearer, returning `{data:{records}}` filtered on **punch time** with epoch-second times.
- **Webhook push:** `KENT_SIM_PUSH_TO=<webhook URL>` posts a sample Kent array. In tests, `sim.pushWebhook(url, events)` does the same.
- **Event loading:** `POST /_sim/punches` loads Kent-shaped events.
- **Fault injection:** `KENT_SIM_FAIL_EVERY=N` returns a 503 on every Nth call.

Example env for style B:
```
KENT_BASE_URL=http://127.0.0.1:5199 KENT_AUTH=login KENT_LOGIN_PATH=/api/login KENT_LOGIN_BODY={"username":"u","password":"p"}
KENT_LOGIN_TOKEN_PATH=data.token KENT_PULL_PATH=/api/recognition-logs KENT_PAGING=page KENT_Q_SINCE=fromDate
KENT_Q_LIMIT=pageSize KENT_SINCE_FORMAT=epoch_s KENT_ITEMS_PATH=data.records
```
Tests: `backend/tests/kent-adapter.integration.test.ts` covers the webhook gates, raw storage, unknown faces and retries; both API styles and every auth/paging option; DB mode; CSV mode through `runKentSync`; and time parsing.

## Open questions for Kent / RML IT (needed before go-live)
1. Which integration feeds greytHR today: API push to the greytHR Swipe API, or the DB-integration exe writing a local table read by Astra? Which DB engine, table name and columns?
2. Pull API:
   - Base URL and auth (token header name, expiry).
   - The recognition-log endpoint, and whether it can filter by **upload/received time** rather than punch time.
   - Pagination, maximum page size, rate limits, and the time format and zone.
3. Webhook:
   - Can it send a custom auth header or HMAC?
   - What is the retry policy on non-2xx responses?
   - Is `time` in epoch seconds or milliseconds, and in IST or UTC?
   - What are the possible `mode` values?
   - What are Kent's egress IPs, for the allow-list?
4. Is there a device-list API with last-sync time, for device health?
5. Is Kent `empId` exactly the RML e-code (e.g. RML033625 / RGH033256)? Please send one day of raw records as a sample.
6. SFTP/scheduled-job option: file naming, column layout and interval.

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

