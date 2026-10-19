# Kent attendance feed: research and adapter gap analysis
_Written 19 Oct 2026 (IST). Research only. No code was changed._

## 1. What "Kent" is at RML (evidence)
- **Vendor/product:** **KENT CamAttendance** by KENT Cam Technologies (Noida; part of the KENT RO group). It uses Android face-recognition terminals (8"/5", Wi-Fi/4G/LAN) that sync in real time to the **CamAttendance Cloud**. Doors and turnstiles are driven by a Bluetooth relay. "KENT CamEye" is their CCTV/GPS product line, not the attendance feed.
  - https://www.kentcam.com/camattendance/biometric-attendance-system
  - https://www.kentcam.com/camattendance/standalone-hardware (Android 9 device; standalone mode keeps 90 days on the device, exported by FTP schedule or manual download)
  - Brochure PDF: https://5.imimg.com/data5/SELLER/Doc/2023/3/294147388/GX/LU/YP/124389957/kent-cam-attendance.pdf
- **RML's own documents (Documention_ProtiVity/PainPoint/Pain Point of RML's HR 02 Jul 2025.xlsx):** "Kent machines go offline … attendance not captured or captured late in **Kent cloud**", "IT runs **schedulers provided by Kent**", "**API Integration from Kent to GreytHR** not working smoothly", "Kent team … have to change the way they are sending the information to greytHR". This matches CamAttendance (cloud + scheduled jobs + API/webhook push).
- **The device is not ZKTeco/eSSL.** Nothing in Kent's documentation mentions ADMS/iClock PUSH, the ZK SDK, or a device TCP protocol. An **ADMS receiver would not help** with Kent CamAttendance.
- **Important finding: "Astra" is not Kent.** `EmployeeSwipeDetails.xlsx` (17 columns: Employee No, Employee Name, Access Card, Shift, Swipe Date, Door/Address, Longitude, Latitude, Location Type, Mobile Device Name, Mobile Device Id, **Swipe Type = "Astra"**, **Status** (blank), Remarks, Permission Reason, Signed In/Out By, Received On) is a **greytHR swipe export**. "Astra" is **Greytip Astra**, greytHR's on-prem Windows sync agent. It reads a biometric DB (MS SQL/MySQL/MS Access/CSV) and uploads the swipes to greytHR.
  - https://greythr.freshdesk.com/support/solutions/articles/1060000050283 (Astra resync; DB can be SQL/MS Access/CSV; service on localhost:9001)
  - https://greythr.freshdesk.com/support/solutions/articles/1060000049837 (Astra prerequisites: a DB table with Employee No, Name, Access Card, Date-Time, Door/Device, filled every 2–3 minutes)
  - Implication: today the chain is probably **Kent device → Kent cloud → (Kent "DB integration" exe or scheduler) → a local SQL/Access table → Greytip Astra → greytHR**. That local table is a ready-made **DB pull source** for us. Our schema mirrors the *greytHR* export, not Kent's native format.
  - In the sample export, Door/Address values look like `Seamless-Plant_S4`, `Seamless-Plant_G4-Copy`, `SEAMLESS-OFFICE` (Kent device/location names). Access Card equals Employee No. **Status (in/out) is blank on all 466 rows**, so direction is never provided and first-in/last-out inference is mandatory (ATT-18).

## 2. Kent CamAttendance integration options (official)
Source: https://support.camattendance.com/documentation/camattendance-integration/ and https://www.kentcam.com/camattendance/seamless-integration and https://www.kentcam.com/camattendance/time-and-attendance

| Mode | What Kent documents | Details NOT public |
|---|---|---|
| **Webhook (push)** | Configured in the portal: Settings → Webhooks → Add New. You give it a name, a type (**Recognition** or **Unknown**) and an endpoint URL, then press Validate. It sends a JSON **array** of events in real time. https://support.camattendance.com/documentation/camattendance-integration/webhooks/ | No auth header, HMAC or secret is documented. Retry behaviour, ordering and the time format are also undocumented. |
| **API pull** | "Data stored on CamAttendance Cloud … can be pulled using API calls … secured using **secret tokens**." "Standard and custom APIs". Case study: Kent *built a custom API* for iEnergizer (https://www.kentcam.com/camattendance/ienergizer-case-study). | Endpoint paths, auth header name, pagination, rate limits and response shape are not public. You have to get them from Kent (hello@kentcam.com, +91 95826-12345). |
| **SFTP/FTP upload** | The device or cloud uploads recognition data to the client's (S)FTP server. | File naming and column layout are not documented. |
| **Scheduled jobs (CSV/Excel)** | A scheduler copies Excel/CSV reports ("Recognition Logs", "Attendance Details by Date") to a client share path at a client-set interval (e.g. 15 or 30 min). | Columns are not documented. Ask for a sample. |
| **Database integration** | Kent ships an **exe integrator** that pulls from the Kent cloud DB and writes attendance/employee rows into the **client's DB**. The client provides the server IP, DB user/password, DB name and table name. | Table schema is defined by Kent/the client. This is most likely what feeds Astra today. |

**Webhook payload (documented sample):**
```
[{"empId":"9999999","employeeName":"First Last","time":<timestamp>,"type":1,   // 1 recognised, 0 unknown
  "imageUrl":"",            // for unknown faces
  "accountId":01,"companyId":"CO01","mode":"",   // mode: "system generated" (likely device/app/mobile)
  "locationName":"44",      // system id of location
  "deviceName":"ABC","departmentName":"","deviceId":"XXXXXXXX"}]
```
- **Fields:** employee code = `empId`; time = `time` (a "timestamp", unit and zone unspecified, possibly epoch); device = `deviceId`/`deviceName`; location = `locationName` (an id). **There is no in/out direction and no received-at field.** `type:0` marks unknown faces, which must not be ingested as swipes.
- **Timezone:** not documented. Kent operates in IST. greytHR's own vendor checklist asks for "timezone of the biometric server", so confirm it with Kent.
- **Rate limits/pagination:** not documented anywhere public.
- **Unknown:** whether Kent's API supports "since/received-after" queries. Devices buffer while offline (RML's main pain point), so a query by *punch time* would miss late uploads.

## 3. Our adapter today (docs/integrations/KENT.md, kent-http-connector.ts, kent-sync.job.ts, ingest.service.ts, kent-simulator.ts)
- It is **pull only**, against an *invented* contract: `GET {base}/punches?since&limit&cursor` → `{items,nextCursor}`, plus `GET /devices` → `{lastSeen, completeThrough}`, with an `X-API-Key` header.
- Field names can be remapped with `KENT_FIELD_MAP`. Devices map to doors with `KENT_DEVICE_MAP`. Zone-less times get `+05:30`.
- Dedupe is on (employee_no, swipe_ts, door_code, source). A watermark is kept on receivedAt.
- KENT.md says push is "not required" and suggests a relay for push-only setups.

## 4. Assumptions likely wrong
1. **The REST contract shape.** There is no evidence Kent offers `/punches?since=&cursor=` or `/devices` with `completeThrough`. Kent's API is token-based and often custom per client. `KENT_FIELD_MAP` only renames item fields. It cannot change the path, query parameter names, response envelope (`items`/`nextCursor`), pagination style (page/offset/date range), or auth scheme (bearer, token in body or query).
2. **`/devices` completeness watermark.** Kent publishes no device-health or completeness API. Expect `watermarkTs` to be absent, so device health must come from the silent-door heuristic.
3. **`receivedAt`.** Neither the webhook nor (probably) the API carries it. The fallback `now` is fine for push. For pull, "since" semantics on punch time would **lose buffered offline swipes**, which was exactly the PP-9 failure. We need a re-read overlap window over N days.
4. **Direction.** Kent does not send in/out (the greytHR export Status column is always blank). That part is fine, since direction is optional and FILO applies. Don't expect `direction`.
5. **Time format.** `parseTime` treats a number as epoch **milliseconds**. If Kent sends epoch **seconds** (common), punches land in 1970 and get quarantined.
6. **The field-name defaults** (`employeeNo`, `punchTime`, `cardNo`) match neither Kent's webhook (`empId`, `time`, `deviceId`) nor the greytHR/Astra table.
7. **ADMS/ZK PUSH.** Not relevant to Kent CamAttendance. Don't build it unless a plant also has ZKTeco/eSSL terminals.
8. **Bulk importer (`bulk/importers/punches.ts`).** It reads direction from the "Swipe Type" column, but in the real export that column holds "Astra". It ignores the **Status** and **Received On** columns and stamps received_at = now(), which loses the device→cloud lag signal ATT-01 asks us to preserve.

## 5. Recommended adapter changes (priority order)
1. **Add a Kent webhook receiver** (`POST /api/integrations/kent/webhook`). This is the officially documented, real-time path and needs no relay.
   - Accept a JSON array. Map `empId→employeeNo`, `time→swipeTs`, `deviceId→door` (through `KENT_DEVICE_MAP`, falling back to `deviceName`), and keep `locationName`, `deviceName` and `mode` in remarks/raw. Set `receivedAt` to the arrival time. **Drop `type:0`** (unknown faces) into a separate log or quarantine.
   - Auth: Kent documents none, so use a long random **secret path segment or query token**, optional **IP allow-list**, HTTPS only, plus a shared header if Kent agrees. Reply 2xx quickly. Write the raw body to a staging table, then reuse `ingestOnce` logic. Dedupe makes retries safe.
   - Pull stays as the **reconciliation backfill**. Webhooks can drop events while our server is down, so daily re-pull or CSV reconciliation is still needed.
2. **Make the pull connector request-configurable:** path template, query parameter names (since/from/to/page/limit), pagination mode (cursor / page number / date-range chunks), response item path (e.g. `data.records`), and auth mode (header key, `Authorization: Bearer`, or a login endpoint that returns a token). Also add an overlap re-read window (e.g. `KENT_REREAD_DAYS=3`) for when the API only filters by punch time.
3. **Add a DB pull mode (`KentDbConnector`).** Read the same SQL table that Kent's integrator writes and Greytip Astra reads today (MSSQL/MySQL; ask IT for the host, DB, table and columns). It is read-only, uses `WHERE <id or timestamp> > watermark`, and is the lowest-risk cut-over. It also lets us run in parallel with greytHR without touching Kent.
4. **Add an SFTP/CSV drop mode (`KentCsvDropConnector`)** for Kent scheduled jobs or SFTP upload. Watch a folder, parse the columns configured by header aliases, archive processed files, and dedupe makes re-drops safe.
5. **Time parsing:** auto-detect epoch seconds vs milliseconds (`< 1e12` means seconds). Support `DD MMM YYYY HH:mm:ss` (the export format) and `KENT_TIME_FORMAT`. Keep `+05:30` as the default, but record the zone Kent confirms.
6. **Bulk importer fixes:** take direction from **Status** (IN/OUT), keep Swipe Type as the source tag, and import **Received On** into `received_at` when present.
7. **Docs (KENT.md):** replace "webhook push not required" with the four real modes (Webhook, API, SFTP/CSV, DB). Explain that "Astra" in the old export is greytHR's agent. Add a vendor question list (below).

## 6. Questions to send Kent / RML IT before go-live
1. Which integration is enabled for RML today to feed greytHR: API push into the greytHR Swipe API, DB integration exe into a local table read by Astra, or something else? What are the table name and columns?
2. Pull API: base URL, auth (token header name, expiry), endpoint for recognition logs, filter by **upload/received time** vs punch time, pagination, max page size, rate limits, time format and zone.
3. Webhook: can it send a custom auth header or HMAC? What is the retry policy if we return non-2xx? Is the `time` unit epoch seconds or milliseconds, in IST or UTC? What are the possible `mode` values?
4. Device list API with last-sync time (for device-health)?
5. Is Kent `empId` exactly the RML e-code (e.g. RML033625 / RGH033256)? Sample: one day of raw records.
