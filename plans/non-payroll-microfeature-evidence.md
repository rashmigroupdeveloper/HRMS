# Non-payroll microfeature evidence register

**Scope update — 5 September 2026:** sponsor deferred payroll for a payroll specialist. This does not waive payroll-dependent settlement, F&F, statutory-output or cut-over gates. Kent remains an external integration dependency.

**This is an evidence backlog, not a completion certificate.** The source inventory labels are copied verbatim and are stale in places; they must not be presented as measured completion. For example, identity hardening and password reset now have implementation and integration tests despite older gap labels. A page, table, route, or passing aggregate suite does not prove every microfeature.

The numbered module inventory contains **438 rows**. Role narratives and unnumbered supplemental tables remain in [the source inventory](../docs/16-MICROFEATURE-INVENTORY.md); [coverage-closeout](coverage-closeout.md) owns their stage mapping. No source requirement is deleted or silently reclassified as complete.

Before marking a row proven, attach its implementation path, positive/negative API or UI test, database invariant where applicable, role-scope test, and staging/UAT evidence when required. Payroll-associated parts of mixed rows remain deferred, even where their non-money parts can be tested.

| Source label (unverified) | Rows |
|---|---:|
| **B** | 113 |
| **B** (balance) / **G** (projection) | 1 |
| **B** (request) / **S** (payout) | 1 |
| **B**/**P** | 3 |
| **B**/**S** | 1 |
| **G** | 143 |
| **P** | 65 |
| **S** | 87 |
| **X** | 17 |
| **X→revisit** | 7 |

## Per-item backlog


### 1. Identity, access & security

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [1.1](../docs/16-MICROFEATURE-INVENTORY.md#L25) | Login by employee code (e-code / greytHR `userid`) | **B** | Needs item-level evidence |
| [1.2](../docs/16-MICROFEATURE-INVENTORY.md#L26) | JWT access + refresh token rotation, logout | **B** | Needs item-level evidence |
| [1.3](../docs/16-MICROFEATURE-INVENTORY.md#L27) | Password hashing (bcrypt), failed-attempt lockout counter | **B** | Needs item-level evidence |
| [1.4](../docs/16-MICROFEATURE-INVENTORY.md#L28) | Password policy object (length, complexity, reuse history, rotation, breached-password check) | **G** | Needs item-level evidence |
| [1.5](../docs/16-MICROFEATURE-INVENTORY.md#L29) | Forgot password / self-service reset with verified channel | **P** | Needs item-level evidence |
| [1.6](../docs/16-MICROFEATURE-INVENTORY.md#L30) | First-login forced password change + T&C/privacy-notice acceptance | **G** | Needs item-level evidence |
| [1.7](../docs/16-MICROFEATURE-INVENTORY.md#L31) | **MFA / TOTP / OTP** for privileged roles | **G** | Needs item-level evidence |
| [1.8](../docs/16-MICROFEATURE-INVENTORY.md#L32) | **Step-up re-authentication** before salary / statutory-ID / payroll-finalize actions | **G** | Needs item-level evidence |
| [1.9](../docs/16-MICROFEATURE-INVENTORY.md#L33) | **SSO — SAML 2.0 / OIDC** against corporate IdP | **G** | Needs item-level evidence |
| [1.10](../docs/16-MICROFEATURE-INVENTORY.md#L34) | **SCIM provisioning / de-provisioning** | **G** | Needs item-level evidence |
| [1.11](../docs/16-MICROFEATURE-INVENTORY.md#L35) | Active session list + remote revoke + idle timeout + concurrent-session policy | **G** | Needs item-level evidence |
| [1.12](../docs/16-MICROFEATURE-INVENTORY.md#L36) | Device registration / binding for mobile punch | **P** | Needs item-level evidence |
| [1.13](../docs/16-MICROFEATURE-INVENTORY.md#L37) | IP allow-list / network restriction per role | **G** | Needs item-level evidence |
| [1.14](../docs/16-MICROFEATURE-INVENTORY.md#L38) | Role catalog (10 roles) + additive role holding | **B** | Needs item-level evidence |
| [1.15](../docs/16-MICROFEATURE-INVENTORY.md#L39) | Permission catalog, one permission code per procedure | **B** | Needs item-level evidence |
| [1.16](../docs/16-MICROFEATURE-INVENTORY.md#L40) | Role↔permission grant/revoke at runtime, effective next request | **B** | Needs item-level evidence |
| [1.17](../docs/16-MICROFEATURE-INVENTORY.md#L41) | User↔role assign/remove with org-unit scope | **B** | Needs item-level evidence |
| [1.18](../docs/16-MICROFEATURE-INVENTORY.md#L42) | Data scoping: own / subtree / org-unit / entity / all | **B** | Needs item-level evidence |
| [1.19](../docs/16-MICROFEATURE-INVENTORY.md#L43) | Field-level masking (PAN/Aadhaar/UAN/ESIC/bank) by permission | **B** | Needs item-level evidence |
| [1.20](../docs/16-MICROFEATURE-INVENTORY.md#L44) | Separation of duties (it_admin ≠ compensation; two-person payroll finalize) | **S** | Needs item-level evidence |
| [1.21](../docs/16-MICROFEATURE-INVENTORY.md#L45) | Hash-chained append-only audit log + verify + export + facets | **B** | Needs item-level evidence |
| [1.22](../docs/16-MICROFEATURE-INVENTORY.md#L46) | **Purpose-of-access capture** on sensitive reads | **G** | Needs item-level evidence |
| [1.23](../docs/16-MICROFEATURE-INVENTORY.md#L47) | **Employee-visible "who accessed my record" log** | **G** | Needs item-level evidence |
| [1.24](../docs/16-MICROFEATURE-INVENTORY.md#L48) | Break-glass / emergency access with mandatory reason + alert | **G** | Needs item-level evidence |
| [1.25](../docs/16-MICROFEATURE-INVENTORY.md#L49) | Quarterly access review / recertification campaign | **G** | Needs item-level evidence |
| [1.26](../docs/16-MICROFEATURE-INVENTORY.md#L50) | Rate limiting on auth + all endpoints | **S** | Needs item-level evidence |
| [1.27](../docs/16-MICROFEATURE-INVENTORY.md#L51) | Service accounts / API keys / machine clients with scoped permissions | **G** | Needs item-level evidence |
| [1.28](../docs/16-MICROFEATURE-INVENTORY.md#L52) | Encryption at rest for biometric templates & sensitive columns | **P** | Needs item-level evidence |

### 2. Core HR — employee master

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [2.1](../docs/16-MICROFEATURE-INVENTORY.md#L58) | Single master record: personal, employment, statutory, financial | **B** | Needs item-level evidence |
| [2.2](../docs/16-MICROFEATURE-INVENTORY.md#L59) | E-code generation per entity series, sequence-enforced, duplicate-proof | **S** | Needs item-level evidence |
| [2.3](../docs/16-MICROFEATURE-INVENTORY.md#L60) | Reporting Manager **and** Functional Reporting Manager | **B** | Needs item-level evidence |
| [2.4](../docs/16-MICROFEATURE-INVENTORY.md#L61) | Cost centre / plant code on every employee | **B** | Needs item-level evidence |
| [2.5](../docs/16-MICROFEATURE-INVENTORY.md#L62) | Employment category (white/blue collar, trainee, consultant, contract-reserved) | **B** | Needs item-level evidence |
| [2.6](../docs/16-MICROFEATURE-INVENTORY.md#L63) | **Fixed-term employment category** with its own benefit rules | **G** | Needs item-level evidence |
| [2.7](../docs/16-MICROFEATURE-INVENTORY.md#L64) | Grade / band / designation / department / division / location | **B** | Needs item-level evidence |
| [2.8](../docs/16-MICROFEATURE-INVENTORY.md#L65) | Personal: DOB, gender, marital status, blood group, emergency contact, addresses | **B** | Needs item-level evidence |
| [2.9](../docs/16-MICROFEATURE-INVENTORY.md#L66) | Family / dependants (name, relation, DOB) for insurance + nominations + statutory | **P** | Needs item-level evidence |
| [2.10](../docs/16-MICROFEATURE-INVENTORY.md#L67) | Education, prior experience, certifications | **G** | Needs item-level evidence |
| [2.11](../docs/16-MICROFEATURE-INVENTORY.md#L68) | Statutory IDs: PAN, Aadhaar, UAN, PF no, ESIC IP, bank + IFSC | **B** | Needs item-level evidence |
| [2.12](../docs/16-MICROFEATURE-INVENTORY.md#L69) | Photo / ID card issue | **P** | Needs item-level evidence |
| [2.13](../docs/16-MICROFEATURE-INVENTORY.md#L70) | Multi-entity employment + inter-entity transfer preserving service continuity | **S** | Needs item-level evidence |
| [2.14](../docs/16-MICROFEATURE-INVENTORY.md#L71) | Effective-dated attribute history (every change is a dated row, not an overwrite) | **S** | Needs item-level evidence |
| [2.15](../docs/16-MICROFEATURE-INVENTORY.md#L72) | Employee status machine: pre-joining → probation → confirmed → exited → alumni | **P** | Needs item-level evidence |
| [2.16](../docs/16-MICROFEATURE-INVENTORY.md#L73) | Never hard-delete (FK from append-only audit) | **B** | Needs item-level evidence |
| [2.17](../docs/16-MICROFEATURE-INVENTORY.md#L74) | Bulk import with validation report + dry run | **P** | Needs item-level evidence |
| [2.18](../docs/16-MICROFEATURE-INVENTORY.md#L75) | Bulk edit / mass update (transfers, cost-centre re-map, grade revision) | **G** | Needs item-level evidence |
| [2.19](../docs/16-MICROFEATURE-INVENTORY.md#L76) | Directory search with facets + filters | **B** | Needs item-level evidence |
| [2.20](../docs/16-MICROFEATURE-INVENTORY.md#L77) | Employee profile page with tabbed sections + edit-request workflow (employee proposes, HR approves) | **P** | Needs item-level evidence |
| [2.21](../docs/16-MICROFEATURE-INVENTORY.md#L78) | **Interactive org chart** (browse, search, span of control, dotted line) | **G** | Needs item-level evidence |
| [2.22](../docs/16-MICROFEATURE-INVENTORY.md#L79) | **Position / establishment management** (sanctioned posts, vacancy, budget) | **G** | Needs item-level evidence |
| [2.23](../docs/16-MICROFEATURE-INVENTORY.md#L80) | Probation / confirmation due date on the record | **B** | Needs item-level evidence |
| [2.24](../docs/16-MICROFEATURE-INVENTORY.md#L81) | Notice period, retirement date, contract end date + expiry alerts | **P** | Needs item-level evidence |
| [2.25](../docs/16-MICROFEATURE-INVENTORY.md#L82) | Attendance mode per employee (biometric / mobile / exempt) | **B** | Needs item-level evidence |
| [2.26](../docs/16-MICROFEATURE-INVENTORY.md#L83) | Custom fields / extensible attributes without a migration | **G** | Needs item-level evidence |

### 3. Documents, letters & e-signature

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [3.1](../docs/16-MICROFEATURE-INVENTORY.md#L89) | Letter templates, versioned, per entity | **B** | Needs item-level evidence |
| [3.2](../docs/16-MICROFEATURE-INVENTORY.md#L90) | Letter issuance with merge fields + signatory approval chain | **B** | Needs item-level evidence |
| [3.3](../docs/16-MICROFEATURE-INVENTORY.md#L91) | Employee letter inbox + HR letter history | **B** | Needs item-level evidence |
| [3.4](../docs/16-MICROFEATURE-INVENTORY.md#L92) | Absence / show-cause case letters | **B** | Needs item-level evidence |
| [3.5](../docs/16-MICROFEATURE-INVENTORY.md#L93) | **Mandatory appointment letter coverage report** ("who has none on file") | **G** | Needs item-level evidence |
| [3.6](../docs/16-MICROFEATURE-INVENTORY.md#L94) | **Employee document vault** — categorised uploads, mandatory-doc checklist per category | **G** | Needs item-level evidence |
| [3.7](../docs/16-MICROFEATURE-INVENTORY.md#L95) | **Document expiry tracking + alerts** (contract, medical fitness, licence, visa, apprentice cert) | **G** | Needs item-level evidence |
| [3.8](../docs/16-MICROFEATURE-INVENTORY.md#L96) | Bulk document request ("collect PAN from these 40 people") | **G** | Needs item-level evidence |
| [3.9](../docs/16-MICROFEATURE-INVENTORY.md#L97) | **Aadhaar eSign / DSC** on offers, appointment letters, F&F, Form 16 | **G** | Needs item-level evidence |
| [3.10](../docs/16-MICROFEATURE-INVENTORY.md#L98) | Digitally-signed payslip & Form 16 PDFs | **S** | Needs item-level evidence |
| [3.11](../docs/16-MICROFEATURE-INVENTORY.md#L99) | Watermarking / access-controlled download of sensitive letters | **G** | Needs item-level evidence |
| [3.12](../docs/16-MICROFEATURE-INVENTORY.md#L100) | Document retention + purge per class, with legal hold | **G** | Needs item-level evidence |

### 4. Policies & acknowledgement

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [4.1](../docs/16-MICROFEATURE-INVENTORY.md#L106) | Policy catalog, publish, versioning, body + summary | **B** | Needs item-level evidence |
| [4.2](../docs/16-MICROFEATURE-INVENTORY.md#L107) | Targeted audience (entity / department / grade / location) | **B** | Needs item-level evidence |
| [4.3](../docs/16-MICROFEATURE-INVENTORY.md#L108) | Employee acknowledgement with timestamp | **B** | Needs item-level evidence |
| [4.4](../docs/16-MICROFEATURE-INVENTORY.md#L109) | Pending-acknowledgement nag + coverage report + Excel | **B** | Needs item-level evidence |
| [4.5](../docs/16-MICROFEATURE-INVENTORY.md#L110) | Re-acknowledge on new version | **P** | Needs item-level evidence |
| [4.6](../docs/16-MICROFEATURE-INVENTORY.md#L111) | Mandatory-read gating (cannot proceed until acknowledged) | **P** | Needs item-level evidence |
| [4.7](../docs/16-MICROFEATURE-INVENTORY.md#L112) | **Multi-language policy body** (Hindi / Odia / Bengali) | **X→revisit** | Needs item-level evidence |
| [4.8](../docs/16-MICROFEATURE-INVENTORY.md#L113) | Policy quiz / comprehension check | **G** | Needs item-level evidence |

### 5. Attendance & time

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [5.1](../docs/16-MICROFEATURE-INVENTORY.md#L119) | Kent biometric ingestion behind a connector interface + mock | **B** | Needs item-level evidence |
| [5.2](../docs/16-MICROFEATURE-INVENTORY.md#L120) | Per-device sync watermark, monotonic, gap detection | **B** | Needs item-level evidence |
| [5.3](../docs/16-MICROFEATURE-INVENTORY.md#L121) | Device health: last-seen, silent doors, pending doors, alerts | **B** | Needs item-level evidence |
| [5.4](../docs/16-MICROFEATURE-INVENTORY.md#L122) | Swipe quarantine for unmatched / malformed records + re-ingest | **B** | Needs item-level evidence |
| [5.5](../docs/16-MICROFEATURE-INVENTORY.md#L123) | Monthly partitioned swipe tables | **B** | Needs item-level evidence |
| [5.6](../docs/16-MICROFEATURE-INVENTORY.md#L124) | Day-status algorithm (P / A / WO / HD / OD / L) with shift window & midnight crossing | **B** | Needs item-level evidence |
| [5.7](../docs/16-MICROFEATURE-INVENTORY.md#L125) | Late-in / early-exit minutes, grace, thresholds — all from `core.settings` | **B** | Needs item-level evidence |
| [5.8](../docs/16-MICROFEATURE-INVENTORY.md#L126) | Week-off eligibility rules | **B** | Needs item-level evidence |
| [5.9](../docs/16-MICROFEATURE-INVENTORY.md#L127) | Overtime detection, 48-hour approval SLA, lapse sweep | **B** | Needs item-level evidence |
| [5.10](../docs/16-MICROFEATURE-INVENTORY.md#L128) | **Statutory OT ceilings** (daily/weekly/quarterly caps, spread-over) enforced at roster & approval time | **G** | Needs item-level evidence |
| [5.11](../docs/16-MICROFEATURE-INVENTORY.md#L129) | Regularization (AR) request + approval | **B** | Needs item-level evidence |
| [5.12](../docs/16-MICROFEATURE-INVENTORY.md#L130) | On-Duty (OD) incl. future-dated | **B** | Needs item-level evidence |
| [5.13](../docs/16-MICROFEATURE-INVENTORY.md#L131) | Short-leave / "Permission" request | **B** | Needs item-level evidence |
| [5.14](../docs/16-MICROFEATURE-INVENTORY.md#L132) | Permission/short-leave **quota & entitlement engine** (n per month, max minutes) | **P** | Needs item-level evidence |
| [5.15](../docs/16-MICROFEATURE-INVENTORY.md#L133) | Comp-off credit from week-off/holiday work, with expiry sweep | **B** | Needs item-level evidence |
| [5.16](../docs/16-MICROFEATURE-INVENTORY.md#L134) | Absenteeism engine: case creation, stages, escalation, show-cause letters | **B** | Needs item-level evidence |
| [5.17](../docs/16-MICROFEATURE-INVENTORY.md#L135) | Manual override by HR (managers explicitly barred) | **B** | Needs item-level evidence |
| [5.18](../docs/16-MICROFEATURE-INVENTORY.md#L136) | Recompute on demand / on late-arriving swipes | **B** | Needs item-level evidence |
| [5.19](../docs/16-MICROFEATURE-INVENTORY.md#L137) | Month lock, lock checklist, finalization holds, immutability triggers | **B** | Needs item-level evidence |
| [5.20](../docs/16-MICROFEATURE-INVENTORY.md#L138) | Manager month approval ledger | **B** | Needs item-level evidence |
| [5.21](../docs/16-MICROFEATURE-INVENTORY.md#L139) | Muster build + list + export | **B** | Needs item-level evidence |
| [5.22](../docs/16-MICROFEATURE-INVENTORY.md#L140) | Cross-plant punching vs cost centre flag | **B** | Needs item-level evidence |
| [5.23](../docs/16-MICROFEATURE-INVENTORY.md#L141) | Mobile / geo check-in with GPS coordinates (PWA) | **S** | Needs item-level evidence |
| [5.24](../docs/16-MICROFEATURE-INVENTORY.md#L142) | **Geofence definition object** (site polygon/radius, per-site allow-list, validation) | **G** | Needs item-level evidence |
| [5.25](../docs/16-MICROFEATURE-INVENTORY.md#L143) | **Selfie + face match + liveness / anti-spoof** (buddy-punch prevention) | **G** | Needs item-level evidence |
| [5.26](../docs/16-MICROFEATURE-INVENTORY.md#L144) | **Offline punch queue + background sync** | **G** | Needs item-level evidence |
| [5.27](../docs/16-MICROFEATURE-INVENTORY.md#L145) | Attendance for **contract workers / third parties** | **X→revisit** | Needs item-level evidence |
| [5.28](../docs/16-MICROFEATURE-INVENTORY.md#L146) | Attendance-vs-swipe reconciliation report for auditors | **P** | Needs item-level evidence |
| [5.29](../docs/16-MICROFEATURE-INVENTORY.md#L147) | Attendance correction audit (who changed what, before/after) | **B** | Needs item-level evidence |
| [5.30](../docs/16-MICROFEATURE-INVENTORY.md#L148) | **Form 12 register of adult workers** derived from roster+master | **G** | Needs item-level evidence |

### 6. Shift & roster / workforce management

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [6.1](../docs/16-MICROFEATURE-INVENTORY.md#L154) | Shift master: start/end, break, min full/half-day hours, grace, crosses-midnight | **B** | Needs item-level evidence |
| [6.2](../docs/16-MICROFEATURE-INVENTORY.md#L155) | Roster read/write per team, per date | **B** | Needs item-level evidence |
| [6.3](../docs/16-MICROFEATURE-INVENTORY.md#L156) | Roster no-op approval guard (prevent silent overwrite) | **B** | Needs item-level evidence |
| [6.4](../docs/16-MICROFEATURE-INVENTORY.md#L157) | Holiday calendar per location/entity | **B** | Needs item-level evidence |
| [6.5](../docs/16-MICROFEATURE-INVENTORY.md#L158) | Restricted / floating holiday publish + employee selection | **B** | Needs item-level evidence |
| [6.6](../docs/16-MICROFEATURE-INVENTORY.md#L159) | Rotating shift patterns / cyclic templates applied in bulk | **P** | Needs item-level evidence |
| [6.7](../docs/16-MICROFEATURE-INVENTORY.md#L160) | **Auto-rostering** from demand/coverage rules | **G** | Needs item-level evidence |
| [6.8](../docs/16-MICROFEATURE-INVENTORY.md#L161) | **Shift swap / shift bid between employees** with approval | **G** | Needs item-level evidence |
| [6.9](../docs/16-MICROFEATURE-INVENTORY.md#L162) | **Fatigue rules**: max consecutive nights, min rest between shifts, no double shift | **G** | Needs item-level evidence |
| [6.10](../docs/16-MICROFEATURE-INVENTORY.md#L163) | **Women night-shift consent + transport evidence** gate | **G** | Needs item-level evidence |
| [6.11](../docs/16-MICROFEATURE-INVENTORY.md#L164) | Coverage / shortfall view vs planned manpower per line/section | **G** | Needs item-level evidence |
| [6.12](../docs/16-MICROFEATURE-INVENTORY.md#L165) | Roster publish + notify + deadline nag to managers | **P** | Needs item-level evidence |
| [6.13](../docs/16-MICROFEATURE-INVENTORY.md#L166) | Roster change history & effective-dated audit | **B** | Needs item-level evidence |

### 7. Leave & absence

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [7.1](../docs/16-MICROFEATURE-INVENTORY.md#L172) | Leave type catalog with per-type rules (accrual, carry-forward cap, encashable, half-day, service-months gate) | **B** | Needs item-level evidence |
| [7.2](../docs/16-MICROFEATURE-INVENTORY.md#L173) | Monthly fractional accrual job | **B** | Needs item-level evidence |
| [7.3](../docs/16-MICROFEATURE-INVENTORY.md#L174) | Immutable leave **ledger** (balance = SUM of rows) | **B** | Needs item-level evidence |
| [7.4](../docs/16-MICROFEATURE-INVENTORY.md#L175) | Apply / cancel / approve with workflow + ledger reversal on cancel | **B** | Needs item-level evidence |
| [7.5](../docs/16-MICROFEATURE-INVENTORY.md#L176) | Half-day + session (first/second half) | **B** | Needs item-level evidence |
| [7.6](../docs/16-MICROFEATURE-INVENTORY.md#L177) | Sandwich rule (weekend/holiday inside a span) per type | **B** | Needs item-level evidence |
| [7.7](../docs/16-MICROFEATURE-INVENTORY.md#L178) | Encashment request → approval → payroll | **B** (request) / **S** (payout) | Needs item-level evidence |
| [7.8](../docs/16-MICROFEATURE-INVENTORY.md#L179) | HR adjustment with reason + audit | **B** | Needs item-level evidence |
| [7.9](../docs/16-MICROFEATURE-INVENTORY.md#L180) | Year-end run: carry-forward / lapse / encash | **B** | Needs item-level evidence |
| [7.10](../docs/16-MICROFEATURE-INVENTORY.md#L181) | Comp-off apply + expiry | **B** | Needs item-level evidence |
| [7.11](../docs/16-MICROFEATURE-INVENTORY.md#L182) | Restricted holiday quota per calendar per grade | **P** | Needs item-level evidence |
| [7.12](../docs/16-MICROFEATURE-INVENTORY.md#L183) | **Statutory leave types**: paternity, adoption, bereavement, marriage, quarantine, sabbatical | **P** | Needs item-level evidence |
| [7.13](../docs/16-MICROFEATURE-INVENTORY.md#L184) | **Maternity Benefit Act mechanics**: 26 weeks, medical bonus, post-natal WFH, no-dismissal protection, register | **P** | Needs item-level evidence |
| [7.14](../docs/16-MICROFEATURE-INVENTORY.md#L185) | **Crèche facility register (50+ employees)** | **G** | Needs item-level evidence |
| [7.15](../docs/16-MICROFEATURE-INVENTORY.md#L186) | **Leave planner / team calendar** with blackout dates & minimum-coverage rules | **G** | Needs item-level evidence |
| [7.16](../docs/16-MICROFEATURE-INVENTORY.md#L187) | Negative balance / advance leave policy object | **G** | Needs item-level evidence |
| [7.17](../docs/16-MICROFEATURE-INVENTORY.md#L188) | Leave donation / leave bank | **G** | Needs item-level evidence |
| [7.18](../docs/16-MICROFEATURE-INVENTORY.md#L189) | LOP computation feeding payroll paid-days | **S** | Needs item-level evidence |
| [7.19](../docs/16-MICROFEATURE-INVENTORY.md#L190) | **Form 15 register of leave with wages** | **G** | Needs item-level evidence |
| [7.20](../docs/16-MICROFEATURE-INVENTORY.md#L191) | Leave balance visible in ESS with projection to a future date | **B** (balance) / **G** (projection) | Needs item-level evidence |

### 8. Workflow engine

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [8.1](../docs/16-MICROFEATURE-INVENTORY.md#L197) | Named chains per request type, sequence of role/person steps | **B** | Needs item-level evidence |
| [8.2](../docs/16-MICROFEATURE-INVENTORY.md#L198) | Actions: approve / reject / **send_back** | **B** | Needs item-level evidence |
| [8.3](../docs/16-MICROFEATURE-INVENTORY.md#L199) | Per-step SLA + escalation on breach | **B** | Needs item-level evidence |
| [8.4](../docs/16-MICROFEATURE-INVENTORY.md#L200) | **`notified_at` receipt per step** (the "approver never notified" bug made impossible) | **B** | Needs item-level evidence |
| [8.5](../docs/16-MICROFEATURE-INVENTORY.md#L201) | Delegation window with `delegated_from` preserved | **B** | Needs item-level evidence |
| [8.6](../docs/16-MICROFEATURE-INVENTORY.md#L202) | Approval inbox with badge counts + SLA countdown | **B** | Needs item-level evidence |
| [8.7](../docs/16-MICROFEATURE-INVENTORY.md#L203) | Request timeline visible to the requester | **B** | Needs item-level evidence |
| [8.8](../docs/16-MICROFEATURE-INVENTORY.md#L204) | Resubmit after send-back | **B** | Needs item-level evidence |
| [8.9](../docs/16-MICROFEATURE-INVENTORY.md#L205) | Auto-approve at cutoff (restricted holiday) / lapse (OT 48h) | **B** | Needs item-level evidence |
| [8.10](../docs/16-MICROFEATURE-INVENTORY.md#L206) | Chains span entities (manager in another company can approve) | **B** | Needs item-level evidence |
| [8.11](../docs/16-MICROFEATURE-INVENTORY.md#L207) | **No-code chain builder UI for hr_head** | **P** | Needs item-level evidence |
| [8.12](../docs/16-MICROFEATURE-INVENTORY.md#L208) | **Conditional routing on data attributes** (amount, grade, entity, plant) | **P** | Needs item-level evidence |
| [8.13](../docs/16-MICROFEATURE-INVENTORY.md#L209) | **Parallel / quorum approval steps** | **G** | Needs item-level evidence |
| [8.14](../docs/16-MICROFEATURE-INVENTORY.md#L210) | **Approve from email / push deep-link** | **G** | Needs item-level evidence |
| [8.15](../docs/16-MICROFEATURE-INVENTORY.md#L211) | Bulk approve across request types | **P** | Needs item-level evidence |
| [8.16](../docs/16-MICROFEATURE-INVENTORY.md#L212) | Out-of-office auto-delegation trigger | **P** | Needs item-level evidence |
| [8.17](../docs/16-MICROFEATURE-INVENTORY.md#L213) | Withdrawal by requester before first action | **P** | Needs item-level evidence |
| [8.18](../docs/16-MICROFEATURE-INVENTORY.md#L214) | Chain simulation / "who will approve this?" preview | **G** | Needs item-level evidence |
| [8.19](../docs/16-MICROFEATURE-INVENTORY.md#L215) | No hidden date cutoffs in chains (PP-v2-20 regression test) | **S** | Needs item-level evidence |

### 9. Payroll engine (M4 — Phase 2, nothing built yet)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [9.1](../docs/16-MICROFEATURE-INVENTORY.md#L221) | Salary structure / CTC builder with components, formulas, effective dates | **S** | Payroll specialist — deferred |
| [9.2](../docs/16-MICROFEATURE-INVENTORY.md#L222) | **Wage-definition conformance check (basic+DA ≥ 50%)** at structure save | **G** | Payroll specialist — deferred |
| [9.3](../docs/16-MICROFEATURE-INVENTORY.md#L223) | Grade-wise structure templates + bulk assignment | **P** | Payroll specialist — deferred |
| [9.4](../docs/16-MICROFEATURE-INVENTORY.md#L224) | Salary revision with reason (`annual_increment` / `promotion` / `confirmation` / `correction`) | **S** | Payroll specialist — deferred |
| [9.5](../docs/16-MICROFEATURE-INVENTORY.md#L225) | Integer-paise branded `Money` type; floats never touch money | **S** | Payroll specialist — deferred |
| [9.6](../docs/16-MICROFEATURE-INVENTORY.md#L226) | One rounding-policy file (PF → nearest rupee, ESIC → round up) | **S** | Payroll specialist — deferred |
| [9.7](../docs/16-MICROFEATURE-INVENTORY.md#L227) | Payroll run stepper: create → inputs → compute → review → finalize | **S** | Payroll specialist — deferred |
| [9.8](../docs/16-MICROFEATURE-INVENTORY.md#L228) | Chunked compute per cost centre as a background job | **S** | Payroll specialist — deferred |
| [9.9](../docs/16-MICROFEATURE-INVENTORY.md#L229) | **Input freeze / cut-off calendar** with per-source status | **P** | Payroll specialist — deferred |
| [9.10](../docs/16-MICROFEATURE-INVENTORY.md#L230) | Attendance/LOP, leave, OT, comp-off, claims, loans as declared inputs | **S** | Payroll specialist — deferred |
| [9.11](../docs/16-MICROFEATURE-INVENTORY.md#L231) | Review grid with exceptions (negative net, missing salary, ESIC boundary crossing) | **S** | Payroll specialist — deferred |
| [9.12](../docs/16-MICROFEATURE-INVENTORY.md#L232) | **Variance vs prior month dashboard** (the pre-finalize control) | **P** | Payroll specialist — deferred |
| [9.13](../docs/16-MICROFEATURE-INVENTORY.md#L233) | Two-person finalize (payroll_admin + hr_head co-sign) | **S** | Payroll specialist — deferred |
| [9.14](../docs/16-MICROFEATURE-INVENTORY.md#L234) | Month immutability after lock; reopen only by super_admin, audited | **S** | Payroll specialist — deferred |
| [9.15](../docs/16-MICROFEATURE-INVENTORY.md#L235) | **Retro = recompute + delta** (closed periods never edited) | **S** | Payroll specialist — deferred |
| [9.16](../docs/16-MICROFEATURE-INVENTORY.md#L236) | Arrears generation & propagation across statutory bases | **S** | Payroll specialist — deferred |
| [9.17](../docs/16-MICROFEATURE-INVENTORY.md#L237) | **Off-cycle / supplementary run type** | **P** | Payroll specialist — deferred |
| [9.18](../docs/16-MICROFEATURE-INVENTORY.md#L238) | **Salary hold / withheld payment + release workflow** | **G** | Payroll specialist — deferred |
| [9.19](../docs/16-MICROFEATURE-INVENTORY.md#L239) | Mid-month joiner / exit proration | **S** | Payroll specialist — deferred |
| [9.20](../docs/16-MICROFEATURE-INVENTORY.md#L240) | Payslip with `calc_note` per line (explainable numbers) | **S** | Payroll specialist — deferred |
| [9.21](../docs/16-MICROFEATURE-INVENTORY.md#L241) | Payslip publish + email + ESS download + reissue | **S** | Payroll specialist — deferred |
| [9.22](../docs/16-MICROFEATURE-INVENTORY.md#L242) | **Bank advice files per bank/entity** + payment status reconciliation (returns/failures) | **P** | Payroll specialist — deferred |
| [9.23](../docs/16-MICROFEATURE-INVENTORY.md#L243) | **GL / JV posting to SAP** with cost-centre map, posting status, re-post | **P** | Payroll specialist — deferred |
| [9.24](../docs/16-MICROFEATURE-INVENTORY.md#L244) | Payroll registers: gross, deduction, net, component-wise, cost-centre-wise | **S** | Payroll specialist — deferred |
| [9.25](../docs/16-MICROFEATURE-INVENTORY.md#L245) | Parallel run: 2 cycles minimum, tolerances agreed up front, gross-before-net reconciliation | **S** | Payroll specialist — deferred |
| [9.26](../docs/16-MICROFEATURE-INVENTORY.md#L246) | Golden-file tests to the rupee, hand-computed (G1–G10) | **S** | Payroll specialist — deferred |
| [9.27](../docs/16-MICROFEATURE-INVENTORY.md#L247) | 100% branch coverage on payroll-core | **S** | Payroll specialist — deferred |
| [9.28](../docs/16-MICROFEATURE-INVENTORY.md#L248) | Annual bonus true-up (8.33–20% band, set-on/set-off) | **S** | Payroll specialist — deferred |
| [9.29](../docs/16-MICROFEATURE-INVENTORY.md#L249) | Increment processing with effective dates | **S** | Payroll specialist — deferred |
| [9.30](../docs/16-MICROFEATURE-INVENTORY.md#L250) | F&F: notice recovery, encashment, gratuity, dues, clearance gate | **S** | Payroll specialist — deferred |
| [9.31](../docs/16-MICROFEATURE-INVENTORY.md#L251) | **F&F SLA clock (48h / 2 working days) + breach alert** | **P** | Payroll specialist — deferred |
| [9.32](../docs/16-MICROFEATURE-INVENTORY.md#L252) | **Fixed-term gratuity at 1 year** | **G** | Payroll specialist — deferred |

### 10. Statutory & compliance (India)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [10.1](../docs/16-MICROFEATURE-INVENTORY.md#L258) | Statutory rates as **versioned data** (`statutory_rates`), not code | **S** | Payroll specialist — deferred |
| [10.2](../docs/16-MICROFEATURE-INVENTORY.md#L259) | PF: wage base, 12%, EPS split, VPF, rounding | **S** | Payroll specialist — deferred |
| [10.3](../docs/16-MICROFEATURE-INVENTORY.md#L260) | ESIC: 0.75/3.25%, ₹21k threshold, contribution-period boundary rule | **S** | Payroll specialist — deferred |
| [10.4](../docs/16-MICROFEATURE-INVENTORY.md#L261) | PT (West Bengal + other states), LWF | **S** | Payroll specialist — deferred |
| [10.5](../docs/16-MICROFEATURE-INVENTORY.md#L262) | TDS: old vs new regime, slabs, surcharge, cess, projection, 12BB proofs | **S** | Payroll specialist — deferred |
| [10.6](../docs/16-MICROFEATURE-INVENTORY.md#L263) | **Regime election capture per employee per FY, with lock date + change audit** | **P** | Payroll specialist — deferred |
| [10.7](../docs/16-MICROFEATURE-INVENTORY.md#L264) | Investment declaration + proof upload + HR verification | **S** | Payroll specialist — deferred |
| [10.8](../docs/16-MICROFEATURE-INVENTORY.md#L265) | **Perquisites beyond loans (car, accommodation, ESOP) + Form 12BA** | **G** | Payroll specialist — deferred |
| [10.9](../docs/16-MICROFEATURE-INVENTORY.md#L266) | Loan perquisite at SBI rate | **S** | Payroll specialist — deferred |
| [10.10](../docs/16-MICROFEATURE-INVENTORY.md#L267) | Portal-ready outputs: **ECR**, ESIC, PT challan, **24Q** data, LWF, challan registers | **S** | Payroll specialist — deferred |
| [10.11](../docs/16-MICROFEATURE-INVENTORY.md#L268) | **Form 16 Part A + B assembly, bulk digital signing, distribution, reissue** | **P** | Payroll specialist — deferred |
| [10.12](../docs/16-MICROFEATURE-INVENTORY.md#L269) | Apprentice / trainee statutory exemptions | **S** | Payroll specialist — deferred |
| [10.13](../docs/16-MICROFEATURE-INVENTORY.md#L270) | **NAPS/NATS apprentice registration, stipend, completion certificates, returns** | **P** | Needs item-level evidence |
| [10.14](../docs/16-MICROFEATURE-INVENTORY.md#L271) | Gratuity engine (5y / 240d decision) | **S** | Payroll specialist — deferred |
| [10.15](../docs/16-MICROFEATURE-INVENTORY.md#L272) | **Statutory nomination forms**: EPF Form 2, Form 11, ESIC Form 1, **Gratuity Form F**, with e-sign + coverage report | **P** | Needs item-level evidence |
| [10.16](../docs/16-MICROFEATURE-INVENTORY.md#L273) | **Statutory registration & licence master** per entity/plant with expiry + renewal owner + T-30/15/7 alerts | **G** | Needs item-level evidence |
| [10.17](../docs/16-MICROFEATURE-INVENTORY.md#L274) | **Compliance calendar** — all due dates, owner, evidence upload, missed-filing alarm | **P** | Needs item-level evidence |
| [10.18](../docs/16-MICROFEATURE-INVENTORY.md#L275) | **Factories Act registers**: Form 12 (adult workers), Form 15 (leave with wages), **Form 22 (muster-cum-wages)**, overtime register, accident register, Form 4 general register, annual return | **G** | Needs item-level evidence |
| [10.19](../docs/16-MICROFEATURE-INVENTORY.md#L276) | **State-configurable register/return layout generator** (14 entities, multiple states) | **G** | Needs item-level evidence |
| [10.20](../docs/16-MICROFEATURE-INVENTORY.md#L277) | **Labour-Codes conformance pack**: wage definition, 48h F&F, appointment letters, FTE benefits, single registration/return, standing orders (300+) | **P** | Needs item-level evidence |
| [10.21](../docs/16-MICROFEATURE-INVENTORY.md#L278) | Minimum-wage master by state / skill category with revision alerts | **G** | Needs item-level evidence |
| [10.22](../docs/16-MICROFEATURE-INVENTORY.md#L279) | Bonus register (Payment of Bonus Act), eligibility ₹21k | **S** | Payroll specialist — deferred |
| [10.23](../docs/16-MICROFEATURE-INVENTORY.md#L280) | Statutory audit evidence pack export (inspector-ready bundle) | **G** | Needs item-level evidence |

### 11. Data protection & privacy operations (DPDP) — entirely new

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [11.1](../docs/16-MICROFEATURE-INVENTORY.md#L286) | Versioned **privacy notice** at collection, per data-principal class (employee / candidate / contractor worker / dependant) | **G** | Needs item-level evidence |
| [11.2](../docs/16-MICROFEATURE-INVENTORY.md#L287) | **Consent registry** for non-employment processing, with granular purposes + withdrawal | **G** | Needs item-level evidence |
| [11.3](../docs/16-MICROFEATURE-INVENTORY.md#L288) | **Rights-request workflow**: access, correction, erasure — identity verification, statutory clock, outcome, refusal reasons, register | **G** | Needs item-level evidence |
| [11.4](../docs/16-MICROFEATURE-INVENTORY.md#L289) | **Retention schedule per data class** + automated purge job + legal-hold override | **G** | Needs item-level evidence |
| [11.5](../docs/16-MICROFEATURE-INVENTORY.md#L290) | **Breach register + Data Protection Board notification runbook** + affected-principal notice | **G** | Needs item-level evidence |
| [11.6](../docs/16-MICROFEATURE-INVENTORY.md#L291) | **Processor register + DPA tracking** (storage host, SMTP, Kent vendor, booking provider, BSP) | **G** | Needs item-level evidence |
| [11.7](../docs/16-MICROFEATURE-INVENTORY.md#L292) | Cross-border transfer record (if any vendor is offshore) | **G** | Needs item-level evidence |
| [11.8](../docs/16-MICROFEATURE-INVENTORY.md#L293) | Published **grievance officer / DPO** contact + response SLA | **G** | Needs item-level evidence |
| [11.9](../docs/16-MICROFEATURE-INVENTORY.md#L294) | Purpose-stamped access log + employee-visible access history | **G** | Needs item-level evidence |
| [11.10](../docs/16-MICROFEATURE-INVENTORY.md#L295) | Data-minimisation review per field ("why do we hold this?") | **G** | Needs item-level evidence |
| [11.11](../docs/16-MICROFEATURE-INVENTORY.md#L296) | Full **data-export pack** for a data principal | **G** | Needs item-level evidence |
| [11.12](../docs/16-MICROFEATURE-INVENTORY.md#L297) | Biometric template encryption + retention limit + no raw export | **P** | Needs item-level evidence |

### 12. Loans & advances (M11 — Phase 2)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [12.1](../docs/16-MICROFEATURE-INVENTORY.md#L303) | Loan type config: diminishing / flat / EMI-without-interest | **S** | Payroll specialist — deferred |
| [12.2](../docs/16-MICROFEATURE-INVENTORY.md#L304) | Eligibility policy (grade, tenure, multiple-of-basic), **not open to all** | **S** | Payroll specialist — deferred |
| [12.3](../docs/16-MICROFEATURE-INVENTORY.md#L305) | ESS application + approval chain (RM → HR head → payroll) | **S** | Payroll specialist — deferred |
| [12.4](../docs/16-MICROFEATURE-INVENTORY.md#L306) | EMI schedule generation + auto-deduction in payroll | **S** | Payroll specialist — deferred |
| [12.5](../docs/16-MICROFEATURE-INVENTORY.md#L307) | Perquisite valuation at SBI lending rate | **S** | Payroll specialist — deferred |
| [12.6](../docs/16-MICROFEATURE-INVENTORY.md#L308) | Legacy SAP loan balance import | **S** | Payroll specialist — deferred |
| [12.7](../docs/16-MICROFEATURE-INVENTORY.md#L309) | Balance + schedule visible in ESS | **S** | Payroll specialist — deferred |
| [12.8](../docs/16-MICROFEATURE-INVENTORY.md#L310) | Foreclosure / part-prepayment / moratorium / EMI pause | **G** | Payroll specialist — deferred |
| [12.9](../docs/16-MICROFEATURE-INVENTORY.md#L311) | Recovery on exit through F&F | **S** | Payroll specialist — deferred |
| [12.10](../docs/16-MICROFEATURE-INVENTORY.md#L312) | Salary advance (distinct from loan) with monthly deduction | **S** | Payroll specialist — deferred |

### 13. Claims & reimbursements (M12) + Travel & Expense (M13 — Phase 3.5)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [13.1](../docs/16-MICROFEATURE-INVENTORY.md#L318) | Claim types with entitlement per grade, bill-required flag, taxability rule | **S** | Needs item-level evidence |
| [13.2](../docs/16-MICROFEATURE-INVENTORY.md#L319) | ESS submission with running entitlement balance shown pre-submit | **S** | Needs item-level evidence |
| [13.3](../docs/16-MICROFEATURE-INVENTORY.md#L320) | Approval chain RM → HR verify → payroll batch, partial approval | **S** | Needs item-level evidence |
| [13.4](../docs/16-MICROFEATURE-INVENTORY.md#L321) | Payout via payroll or off-cycle batch + reimbursement payslip | **S** | Needs item-level evidence |
| [13.5](../docs/16-MICROFEATURE-INVENTORY.md#L322) | Year-end TDS on unclaimed entitlement; lapse/carry rules | **S** | Needs item-level evidence |
| [13.6](../docs/16-MICROFEATURE-INVENTORY.md#L323) | Trip request with itinerary segments, visa flag, attachments | **S** | Needs item-level evidence |
| [13.7](../docs/16-MICROFEATURE-INVENTORY.md#L324) | Booking connector (MakeMyTrip Corporate) behind an interface; own-arrangement path | **S** | Needs item-level evidence |
| [13.8](../docs/16-MICROFEATURE-INVENTORY.md#L325) | Budget engine: air class, lowest-logical-fare, flying-hours, hotel/night, DA, visa cost, grade entitlements | **S** | Needs item-level evidence |
| [13.9](../docs/16-MICROFEATURE-INVENTORY.md#L326) | Over-budget flagged for higher approval, not blocked | **S** | Needs item-level evidence |
| [13.10](../docs/16-MICROFEATURE-INVENTORY.md#L327) | Travel advance + approval chain incl. CHRO stage for global | **S** | Needs item-level evidence |
| [13.11](../docs/16-MICROFEATURE-INVENTORY.md#L328) | **Employee wallet as an immutable transaction ledger** | **S** | Needs item-level evidence |
| [13.12](../docs/16-MICROFEATURE-INVENTORY.md#L329) | Settlement: claimed vs advance → net payable / recoverable → payroll | **S** | Needs item-level evidence |
| [13.13](../docs/16-MICROFEATURE-INVENTORY.md#L330) | Multi-currency with exchange-rate capture | **S** | Needs item-level evidence |
| [13.14](../docs/16-MICROFEATURE-INVENTORY.md#L331) | Yatra Avedan data migration + decommission | **S** | Needs item-level evidence |
| [13.15](../docs/16-MICROFEATURE-INVENTORY.md#L332) | **OCR receipt capture / auto-fill from bill image** | **G** | Needs item-level evidence |
| [13.16](../docs/16-MICROFEATURE-INVENTORY.md#L333) | **GST input-credit capture** (GSTIN, invoice no, tax split) on expense lines | **G** | Needs item-level evidence |
| [13.17](../docs/16-MICROFEATURE-INVENTORY.md#L334) | **Corporate card feed + statement reconciliation** | **G** | Needs item-level evidence |
| [13.18](../docs/16-MICROFEATURE-INVENTORY.md#L335) | **Per-diem/DA auto-computation by city slab + half-day rule** | **P** | Needs item-level evidence |
| [13.19](../docs/16-MICROFEATURE-INVENTORY.md#L336) | Duplicate-receipt / duplicate-claim detection | **G** | Needs item-level evidence |
| [13.20](../docs/16-MICROFEATURE-INVENTORY.md#L337) | Mileage / own-vehicle claim with rate master | **G** | Needs item-level evidence |

### 14. Benefits administration — entirely new

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [14.1](../docs/16-MICROFEATURE-INVENTORY.md#L343) | Group mediclaim / GPA / GTLI policy master per entity | **G** | Needs item-level evidence |
| [14.2](../docs/16-MICROFEATURE-INVENTORY.md#L344) | Enrolment + dependants + mid-year additions/deletions + endorsement file to insurer | **G** | Needs item-level evidence |
| [14.3](../docs/16-MICROFEATURE-INVENTORY.md#L345) | Sum-insured by grade, top-up / voluntary parental cover with payroll deduction | **G** | Needs item-level evidence |
| [14.4](../docs/16-MICROFEATURE-INVENTORY.md#L346) | Claim intimation & status assist (TPA hand-off) | **G** | Needs item-level evidence |
| [14.5](../docs/16-MICROFEATURE-INVENTORY.md#L347) | Superannuation scheme + NPS (employer/employee contribution, PRAN) | **G** | Needs item-level evidence |
| [14.6](../docs/16-MICROFEATURE-INVENTORY.md#L348) | Gratuity fund / LIC trust reconciliation vs computed liability | **G** | Needs item-level evidence |
| [14.7](../docs/16-MICROFEATURE-INVENTORY.md#L349) | Flexi-benefit plan declaration + lock window + payroll effect | **P** | Needs item-level evidence |
| [14.8](../docs/16-MICROFEATURE-INVENTORY.md#L350) | Benefit statement / total-rewards statement per employee | **G** | Needs item-level evidence |
| [14.9](../docs/16-MICROFEATURE-INVENTORY.md#L351) | **Annual health check-up campaign + occupational health record** | **G** | Needs item-level evidence |

### 15. Employee lifecycle (M5 — Phase 3)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [15.1](../docs/16-MICROFEATURE-INVENTORY.md#L357) | Pre-joining link: candidate fills own data before day 1 | **S** | Needs item-level evidence |
| [15.2](../docs/16-MICROFEATURE-INVENTORY.md#L358) | Onboarding task fan-out (IT / HR / admin / plant queues) with owners + due dates | **S** | Needs item-level evidence |
| [15.3](../docs/16-MICROFEATURE-INVENTORY.md#L359) | Joining document checklist + collection status | **P** | Needs item-level evidence |
| [15.4](../docs/16-MICROFEATURE-INVENTORY.md#L360) | **Statutory joining forms (Form 2/11/F/ESIC 1/12BB) e-signed** | **P** | Needs item-level evidence |
| [15.5](../docs/16-MICROFEATURE-INVENTORY.md#L361) | Convert candidate → employee with e-code allocation | **S** | Needs item-level evidence |
| [15.6](../docs/16-MICROFEATURE-INVENTORY.md#L362) | **Daily boarding/exit email to HR/BH/CEO** | **B** | Needs item-level evidence |
| [15.7](../docs/16-MICROFEATURE-INVENTORY.md#L363) | **Buddy assignment, 30/60/90 check-ins, onboarding feedback survey** | **G** | Needs item-level evidence |
| [15.8](../docs/16-MICROFEATURE-INVENTORY.md#L364) | Probation tracking + reminders + confirmation workflow | **S** | Needs item-level evidence |
| [15.9](../docs/16-MICROFEATURE-INVENTORY.md#L365) | Probation **extension** path with letter | **P** | Needs item-level evidence |
| [15.10](../docs/16-MICROFEATURE-INVENTORY.md#L366) | Confirmation appraisal instrument (the input to the decision) | **G** | Needs item-level evidence |
| [15.11](../docs/16-MICROFEATURE-INVENTORY.md#L367) | Salary switch on confirmation (probation % → full) | **S** | Needs item-level evidence |
| [15.12](../docs/16-MICROFEATURE-INVENTORY.md#L368) | Transfer / deputation / promotion — incl. **inter-entity** with service continuity | **S** | Needs item-level evidence |
| [15.13](../docs/16-MICROFEATURE-INVENTORY.md#L369) | Resignation in ESS → chain → LWD → clearance fan-out → status timeline | **S** | Needs item-level evidence |
| [15.14](../docs/16-MICROFEATURE-INVENTORY.md#L370) | Absconding / HR-initiated separation via the disciplinary path | **P** | Needs item-level evidence |
| [15.15](../docs/16-MICROFEATURE-INVENTORY.md#L371) | Clearance matrix (IT, assets, finance, library, quarters, canteen, transport) | **P** | Needs item-level evidence |
| [15.16](../docs/16-MICROFEATURE-INVENTORY.md#L372) | **Exit interview instrument + attrition reason taxonomy** | **G** | Needs item-level evidence |
| [15.17](../docs/16-MICROFEATURE-INVENTORY.md#L373) | **Knowledge-transfer / handover checklist** | **G** | Needs item-level evidence |
| [15.18](../docs/16-MICROFEATURE-INVENTORY.md#L374) | **Rehire-eligibility flag + blacklist** | **G** | Needs item-level evidence |
| [15.19](../docs/16-MICROFEATURE-INVENTORY.md#L375) | Exit day: status/DOL set once, removed from lists/rosters/approvals, open items reassigned | **S** | Needs item-level evidence |
| [15.20](../docs/16-MICROFEATURE-INVENTORY.md#L376) | Alumni mode ESS (payslip / Form 16 only) | **S** | Needs item-level evidence |
| [15.21](../docs/16-MICROFEATURE-INVENTORY.md#L377) | **Alumni engagement / referral network** | **G** | Needs item-level evidence |
| [15.22](../docs/16-MICROFEATURE-INVENTORY.md#L378) | Retirement pipeline + superannuation processing | **G** | Needs item-level evidence |

### 16. Recruitment / ATS (M14 — Phase 4 = "absorption" only)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [16.1](../docs/16-MICROFEATURE-INVENTORY.md#L384) | **Manpower requisition (MRF) with headcount-budget check** + approval chain | **G** | Needs item-level evidence |
| [16.2](../docs/16-MICROFEATURE-INVENTORY.md#L385) | Job description library + requisition→JD link | **G** | Needs item-level evidence |
| [16.3](../docs/16-MICROFEATURE-INVENTORY.md#L386) | Job posting to career site / boards / internal | **P** | Needs item-level evidence |
| [16.4](../docs/16-MICROFEATURE-INVENTORY.md#L387) | Resume parsing + candidate database + de-duplication | **P** | Needs item-level evidence |
| [16.5](../docs/16-MICROFEATURE-INVENTORY.md#L388) | Pipeline stages, tags, notes, collaboration | **P** | Needs item-level evidence |
| [16.6](../docs/16-MICROFEATURE-INVENTORY.md#L389) | Interview scheduling + panel + **scorecards** | **G** | Needs item-level evidence |
| [16.7](../docs/16-MICROFEATURE-INVENTORY.md#L390) | Offer modelling (CTC breakup preview) + **LOI approval chain** | **S** | Needs item-level evidence |
| [16.8](../docs/16-MICROFEATURE-INVENTORY.md#L391) | Offer letter generation + **e-sign** + acceptance tracking | **P** | Needs item-level evidence |
| [16.9](../docs/16-MICROFEATURE-INVENTORY.md#L392) | **Background verification (BGV)** order + status + adverse-action handling | **G** | Needs item-level evidence |
| [16.10](../docs/16-MICROFEATURE-INVENTORY.md#L393) | Candidate portal + status communication | **P** | Needs item-level evidence |
| [16.11](../docs/16-MICROFEATURE-INVENTORY.md#L394) | **Referral programme** with payout via payroll | **G** | Needs item-level evidence |
| [16.12](../docs/16-MICROFEATURE-INVENTORY.md#L395) | **Internal job posting / internal mobility** | **G** | Needs item-level evidence |
| [16.13](../docs/16-MICROFEATURE-INVENTORY.md#L396) | Joined-candidate → onboarding handoff | **S** | Needs item-level evidence |
| [16.14](../docs/16-MICROFEATURE-INVENTORY.md#L397) | Recruitment analytics: time-to-fill, source-of-hire, offer-drop, funnel | **P** | Needs item-level evidence |
| [16.15](../docs/16-MICROFEATURE-INVENTORY.md#L398) | Candidate data privacy: notice, consent, retention/purge | **G** | Needs item-level evidence |

### 17. Performance management — non-goal today (docs 01 §11)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [17.1](../docs/16-MICROFEATURE-INVENTORY.md#L404) | Goal / KRA / KPI setting with weightings | **X** | Recorded exclusion — review decision reference |
| [17.2](../docs/16-MICROFEATURE-INVENTORY.md#L405) | OKR cascade org→dept→individual with auto-rollup + alignment view | **X** | Recorded exclusion — review decision reference |
| [17.3](../docs/16-MICROFEATURE-INVENTORY.md#L406) | Review cycles: annual, mid-year, quarterly, **probation (30/60/90)**, project-based | **X** | Recorded exclusion — review decision reference |
| [17.4](../docs/16-MICROFEATURE-INVENTORY.md#L407) | Self / manager / peer / skip-level assessment | **X** | Recorded exclusion — review decision reference |
| [17.5](../docs/16-MICROFEATURE-INVENTORY.md#L408) | **360° feedback** with reviewer nomination, weighting, anonymity | **X** | Recorded exclusion — review decision reference |
| [17.6](../docs/16-MICROFEATURE-INVENTORY.md#L409) | Competency framework + gap analysis | **X** | Recorded exclusion — review decision reference |
| [17.7](../docs/16-MICROFEATURE-INVENTORY.md#L410) | Rating scales (3/4/5-point, custom) | **X** | Recorded exclusion — review decision reference |
| [17.8](../docs/16-MICROFEATURE-INVENTORY.md#L411) | **Calibration sessions + bell-curve normalisation + audit trail of adjustments** | **X** | Recorded exclusion — review decision reference |
| [17.9](../docs/16-MICROFEATURE-INVENTORY.md#L412) | **9-box performance/potential matrix** | **X** | Recorded exclusion — review decision reference |
| [17.10](../docs/16-MICROFEATURE-INVENTORY.md#L413) | PIP with milestones and review | **X** | Recorded exclusion — review decision reference |
| [17.11](../docs/16-MICROFEATURE-INVENTORY.md#L414) | Continuous feedback / kudos / 1:1 notes | **X** | Recorded exclusion — review decision reference |
| [17.12](../docs/16-MICROFEATURE-INVENTORY.md#L415) | Rating → increment / bonus hand-off to compensation | **X** | Recorded exclusion — review decision reference |
| [17.13](../docs/16-MICROFEATURE-INVENTORY.md#L416) | Performance analytics: distribution, reviewer consistency, bias flags | **X** | Recorded exclusion — review decision reference |

### 18. Learning, training & skills — non-goal today

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [18.1](../docs/16-MICROFEATURE-INVENTORY.md#L422) | **Training matrix: role → mandatory training map** | **X→revisit** | Needs item-level evidence |
| [18.2](../docs/16-MICROFEATURE-INVENTORY.md#L423) | **Certification & validity tracking with expiry alerts** | **X→revisit** | Needs item-level evidence |
| [18.3](../docs/16-MICROFEATURE-INVENTORY.md#L424) | **Mandatory-training register**: safety induction, POSH, fire, first-aid, ISO/IATF | **X→revisit** | Needs item-level evidence |
| [18.4](../docs/16-MICROFEATURE-INVENTORY.md#L425) | Training calendar, nomination, attendance capture, feedback | **X** | Recorded exclusion — review decision reference |
| [18.5](../docs/16-MICROFEATURE-INVENTORY.md#L426) | Training effectiveness / post-assessment | **X** | Recorded exclusion — review decision reference |
| [18.6](../docs/16-MICROFEATURE-INVENTORY.md#L427) | Courseware delivery (SCORM/video) | **X** | Recorded exclusion — review decision reference |
| [18.7](../docs/16-MICROFEATURE-INVENTORY.md#L428) | **Skill inventory + proficiency + gap by role/line** | **G** | Needs item-level evidence |
| [18.8](../docs/16-MICROFEATURE-INVENTORY.md#L429) | Multi-language training content | **X→revisit** | Needs item-level evidence |
| [18.9](../docs/16-MICROFEATURE-INVENTORY.md#L430) | Training cost & budget tracking | **X** | Recorded exclusion — review decision reference |
| [18.10](../docs/16-MICROFEATURE-INVENTORY.md#L431) | **Career paths / IDP / succession & bench strength** | **G** | Needs item-level evidence |

### 19. Compensation planning — partial today

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [19.1](../docs/16-MICROFEATURE-INVENTORY.md#L437) | Increment processing with effective dates | **S** | Needs item-level evidence |
| [19.2](../docs/16-MICROFEATURE-INVENTORY.md#L438) | **Merit / increment cycle** with budget pot per unit | **G** | Needs item-level evidence |
| [19.3](../docs/16-MICROFEATURE-INVENTORY.md#L439) | **Manager proposal worksheet** with guidelines & guardrails | **G** | Needs item-level evidence |
| [19.4](../docs/16-MICROFEATURE-INVENTORY.md#L440) | Pay bands / ranges / compa-ratio / range penetration | **G** | Needs item-level evidence |
| [19.5](../docs/16-MICROFEATURE-INVENTORY.md#L441) | Multi-level cycle approval + freeze + publish | **G** | Needs item-level evidence |
| [19.6](../docs/16-MICROFEATURE-INVENTORY.md#L442) | **Increment / promotion letter generation from the cycle** | **P** | Needs item-level evidence |
| [19.7](../docs/16-MICROFEATURE-INVENTORY.md#L443) | Variable pay / incentive plan definition + payout computation | **P** | Needs item-level evidence |
| [19.8](../docs/16-MICROFEATURE-INVENTORY.md#L444) | Pay-equity / parity analysis | **G** | Needs item-level evidence |
| [19.9](../docs/16-MICROFEATURE-INVENTORY.md#L445) | Total-rewards statement | **G** | Needs item-level evidence |

### 20. Engagement, communication & recognition (M10)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [20.1](../docs/16-MICROFEATURE-INVENTORY.md#L451) | Announcements publish / withdraw with targeted audience | **B** | Needs item-level evidence |
| [20.2](../docs/16-MICROFEATURE-INVENTORY.md#L452) | Employee announcement feed | **B** | Needs item-level evidence |
| [20.3](../docs/16-MICROFEATURE-INVENTORY.md#L453) | Opinion polls: create, respond, results, close, anonymous + dedupe | **B** | Needs item-level evidence |
| [20.4](../docs/16-MICROFEATURE-INVENTORY.md#L454) | **Structured pulse surveys with response analytics** | **S** | Needs item-level evidence |
| [20.5](../docs/16-MICROFEATURE-INVENTORY.md#L455) | **eNPS + driver analysis + manager-level heatmap + action plans** | **G** | Needs item-level evidence |
| [20.6](../docs/16-MICROFEATURE-INVENTORY.md#L456) | Policy acknowledgement tracking | **B** | Needs item-level evidence |
| [20.7](../docs/16-MICROFEATURE-INVENTORY.md#L457) | **Rewards & recognition**: spot award, peer kudos, nomination→approval, points/budget, payout | **G** | Needs item-level evidence |
| [20.8](../docs/16-MICROFEATURE-INVENTORY.md#L458) | Birthdays / work anniversaries / milestones feed | **G** | Needs item-level evidence |
| [20.9](../docs/16-MICROFEATURE-INVENTORY.md#L459) | **Wellness programmes / EAP (confidential referral)** | **G** | Needs item-level evidence |
| [20.10](../docs/16-MICROFEATURE-INVENTORY.md#L460) | Read-receipt + reach analytics on announcements | **P** | Needs item-level evidence |
| [20.11](../docs/16-MICROFEATURE-INVENTORY.md#L461) | **Multi-channel delivery (push / WhatsApp / SMS) for the frontline** | **G** | Needs item-level evidence |
| [20.12](../docs/16-MICROFEATURE-INVENTORY.md#L462) | Multi-language announcements | **X→revisit** | Needs item-level evidence |
| [20.13](../docs/16-MICROFEATURE-INVENTORY.md#L463) | Suggestion box / idea management | **G** | Needs item-level evidence |

### 21. Helpdesk & knowledge (M9)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [21.1](../docs/16-MICROFEATURE-INVENTORY.md#L469) | Category catalog + auto-assignment | **B** | Needs item-level evidence |
| [21.2](../docs/16-MICROFEATURE-INVENTORY.md#L470) | Raise / my tickets / agent queue / threaded replies | **B** | Needs item-level evidence |
| [21.3](../docs/16-MICROFEATURE-INVENTORY.md#L471) | Ticket numbering sequence | **B** | Needs item-level evidence |
| [21.4](../docs/16-MICROFEATURE-INVENTORY.md#L472) | SLA per category, escalation matrix, breach tracking | **B** | Needs item-level evidence |
| [21.5](../docs/16-MICROFEATURE-INVENTORY.md#L473) | Status lifecycle + resolution + monthly performance report + Excel | **B** | Needs item-level evidence |
| [21.6](../docs/16-MICROFEATURE-INVENTORY.md#L474) | "HRMS platform" category from day one (adoption feedback loop) | **S** | Needs item-level evidence |
| [21.7](../docs/16-MICROFEATURE-INVENTORY.md#L475) | **Knowledge base / FAQ with deflection at ticket creation** | **G** | Needs item-level evidence |
| [21.8](../docs/16-MICROFEATURE-INVENTORY.md#L476) | **Confidential / sensitive ticket class** with restricted visibility | **G** | Needs item-level evidence |
| [21.9](../docs/16-MICROFEATURE-INVENTORY.md#L477) | **CSAT on resolution** | **G** | Needs item-level evidence |
| [21.10](../docs/16-MICROFEATURE-INVENTORY.md#L478) | Attachments on tickets | **P** | Needs item-level evidence |
| [21.11](../docs/16-MICROFEATURE-INVENTORY.md#L479) | Re-open window + linked/duplicate tickets | **G** | Needs item-level evidence |
| [21.12](../docs/16-MICROFEATURE-INVENTORY.md#L480) | **AI auto-triage + suggested answer** | **G** | Needs item-level evidence |

### 22. Assets (M8)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [22.1](../docs/16-MICROFEATURE-INVENTORY.md#L486) | Asset registry + search (asset no, type, holder) with trigram index | **B** | Needs item-level evidence |
| [22.2](../docs/16-MICROFEATURE-INVENTORY.md#L487) | Warranty date accepting past dates | **B** | Needs item-level evidence |
| [22.3](../docs/16-MICROFEATURE-INVENTORY.md#L488) | Allocation to employees **and third-party/contract persons** | **B** | Needs item-level evidence |
| [22.4](../docs/16-MICROFEATURE-INVENTORY.md#L489) | Return recording + resigned-employee holdings view | **B** | Needs item-level evidence |
| [22.5](../docs/16-MICROFEATURE-INVENTORY.md#L490) | Non-returned / outstanding dashboard + export | **B** | Needs item-level evidence |
| [22.6](../docs/16-MICROFEATURE-INVENTORY.md#L491) | Maintenance log + add maintenance | **B** | Needs item-level evidence |
| [22.7](../docs/16-MICROFEATURE-INVENTORY.md#L492) | Incident / damage / lost-asset handling with recovery to payroll | **P** | Needs item-level evidence |
| [22.8](../docs/16-MICROFEATURE-INVENTORY.md#L493) | Asset request by employee (ESS) with approval | **G** | Needs item-level evidence |
| [22.9](../docs/16-MICROFEATURE-INVENTORY.md#L494) | Depreciation / book value / finance-asset-register reconciliation | **G** | Needs item-level evidence |
| [22.10](../docs/16-MICROFEATURE-INVENTORY.md#L495) | **Uniform & PPE issue/return with entitlement cycle and size** | **G** | Needs item-level evidence |
| [22.11](../docs/16-MICROFEATURE-INVENTORY.md#L496) | Barcode / QR / RFID tagging + scan-based audit | **G** | Needs item-level evidence |

### 24. Notifications & channels (M6)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [24.1](../docs/16-MICROFEATURE-INVENTORY.md#L580) | Event subscription model — recipients are **data**, not code | **B** | Needs item-level evidence |
| [24.2](../docs/16-MICROFEATURE-INVENTORY.md#L581) | `notified_at` receipt per workflow step | **B** | Needs item-level evidence |
| [24.3](../docs/16-MICROFEATURE-INVENTORY.md#L582) | Email delivery + queue + dead letters | **B**/**P** | Needs item-level evidence |
| [24.4](../docs/16-MICROFEATURE-INVENTORY.md#L583) | In-app notification centre | **P** | Needs item-level evidence |
| [24.5](../docs/16-MICROFEATURE-INVENTORY.md#L584) | Digest / daily summary emails (boarding-exit at 07:00) | **B** | Needs item-level evidence |
| [24.6](../docs/16-MICROFEATURE-INVENTORY.md#L585) | **Mobile push** | **G** | Needs item-level evidence |
| [24.7](../docs/16-MICROFEATURE-INVENTORY.md#L586) | **WhatsApp Business API** | **P** | Needs item-level evidence |
| [24.8](../docs/16-MICROFEATURE-INVENTORY.md#L587) | **SMS fallback** | **G** | Needs item-level evidence |
| [24.9](../docs/16-MICROFEATURE-INVENTORY.md#L588) | Teams / Slack connector | **G** | Needs item-level evidence |
| [24.10](../docs/16-MICROFEATURE-INVENTORY.md#L589) | Per-user notification preferences + quiet hours | **G** | Needs item-level evidence |
| [24.11](../docs/16-MICROFEATURE-INVENTORY.md#L590) | Template management with localisation | **P** | Needs item-level evidence |
| [24.12](../docs/16-MICROFEATURE-INVENTORY.md#L591) | Delivery-failure visibility to the sender ("this approver's email bounced") | **P** | Needs item-level evidence |

### 25. Reports, dashboards & analytics (M7)

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [25.1](../docs/16-MICROFEATURE-INVENTORY.md#L597) | Muster (R1) build/list/export with RM, e-code, cost centre, dept columns | **B** | Needs item-level evidence |
| [25.2](../docs/16-MICROFEATURE-INVENTORY.md#L598) | R2–R6 + exports (attendance/AR/OD/absence family) | **B** | Needs item-level evidence |
| [25.3](../docs/16-MICROFEATURE-INVENTORY.md#L599) | R24, R27 + exports | **B** | Needs item-level evidence |
| [25.4](../docs/16-MICROFEATURE-INVENTORY.md#L600) | R7–R23, R25–R26, R28–R31 | **S** | Needs item-level evidence |
| [25.5](../docs/16-MICROFEATURE-INVENTORY.md#L601) | HR dashboard | **B** | Needs item-level evidence |
| [25.6](../docs/16-MICROFEATURE-INVENTORY.md#L602) | Business-unit / plant dashboard | **B** | Needs item-level evidence |
| [25.7](../docs/16-MICROFEATURE-INVENTORY.md#L603) | Executive/CEO KPIs + trend from precomputed snapshots | **B** | Needs item-level evidence |
| [25.8](../docs/16-MICROFEATURE-INVENTORY.md#L604) | ESS + my-attendance + team-grid views | **B** | Needs item-level evidence |
| [25.9](../docs/16-MICROFEATURE-INVENTORY.md#L605) | Every KPI tile links to its underlying list (explainable numbers) | **S** | Needs item-level evidence |
| [25.10](../docs/16-MICROFEATURE-INVENTORY.md#L606) | **Ad-hoc report builder** (pick fields, filter, group, save) | **G** | Needs item-level evidence |
| [25.11](../docs/16-MICROFEATURE-INVENTORY.md#L607) | **Saved views per user + shared views** | **G** | Needs item-level evidence |
| [25.12](../docs/16-MICROFEATURE-INVENTORY.md#L608) | **Scheduled report subscriptions** ("email me R6 every Monday 07:00") | **G** | Needs item-level evidence |
| [25.13](../docs/16-MICROFEATURE-INVENTORY.md#L609) | Export to Excel / PDF / CSV with the same numbers as the screen | **B** | Needs item-level evidence |
| [25.14](../docs/16-MICROFEATURE-INVENTORY.md#L610) | **Data dictionary / metric definitions** so two dashboards can't disagree on "headcount" | **G** | Needs item-level evidence |
| [25.15](../docs/16-MICROFEATURE-INVENTORY.md#L611) | Drill-down from aggregate to row level with scope enforcement | **P** | Needs item-level evidence |
| [25.16](../docs/16-MICROFEATURE-INVENTORY.md#L612) | Reporting reads isolated from OLTP (replica-ready), precomputed snapshots | **B**/**S** | Needs item-level evidence |
| [25.17](../docs/16-MICROFEATURE-INVENTORY.md#L613) | Market-standard KPI set: attrition (voluntary/involuntary, new-hire 3/6/12mo), absenteeism %, OT hours & cost, span of control, cost per hire, time to fill, headcount by category/entity/cost-centre, manpower cost | **P** | Needs item-level evidence |
| [25.18](../docs/16-MICROFEATURE-INVENTORY.md#L614) | **Budget vs actual headcount and manpower cost** | **G** | Needs item-level evidence |
| [25.19](../docs/16-MICROFEATURE-INVENTORY.md#L615) | **Attrition prediction / flight-risk model** | **G** | Needs item-level evidence |
| [25.20](../docs/16-MICROFEATURE-INVENTORY.md#L616) | Report access fully scope-aware (S/P/O scoping enforced in every report) | **B** | Needs item-level evidence |

### 26. Integrations & APIs

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [26.1](../docs/16-MICROFEATURE-INVENTORY.md#L622) | oRPC procedures with zod input **and** output, OpenAPI generated | **B** | Needs item-level evidence |
| [26.2](../docs/16-MICROFEATURE-INVENTORY.md#L623) | Frontend client generated from OpenAPI | **B** | Needs item-level evidence |
| [26.3](../docs/16-MICROFEATURE-INVENTORY.md#L624) | Kent biometric connector behind an interface, with mock | **B** | Needs item-level evidence |
| [26.4](../docs/16-MICROFEATURE-INVENTORY.md#L625) | Sync watermark + job queue + dead-letter visibility | **B**/**P** | Needs item-level evidence |
| [26.5](../docs/16-MICROFEATURE-INVENTORY.md#L626) | **SAP posting (payroll JV, cost centres, vendor)** | **S** | Needs item-level evidence |
| [26.6](../docs/16-MICROFEATURE-INVENTORY.md#L627) | ATS integration (read offers/recruitment for R21/R22) then absorption | **S** | Needs item-level evidence |
| [26.7](../docs/16-MICROFEATURE-INVENTORY.md#L628) | Travel-booking connector (MakeMyTrip Corporate) behind an interface | **S** | Needs item-level evidence |
| [26.8](../docs/16-MICROFEATURE-INVENTORY.md#L629) | **Outbound webhooks with retry, signing, replay** | **G** | Needs item-level evidence |
| [26.9](../docs/16-MICROFEATURE-INVENTORY.md#L630) | **Service accounts / API keys / scoped machine permissions** | **G** | Needs item-level evidence |
| [26.10](../docs/16-MICROFEATURE-INVENTORY.md#L631) | **Idempotency-key contract on write endpoints** | **G** | Needs item-level evidence |
| [26.11](../docs/16-MICROFEATURE-INVENTORY.md#L632) | Bank API / bank-file exchange per entity | **P** | Needs item-level evidence |
| [26.12](../docs/16-MICROFEATURE-INVENTORY.md#L633) | Insurer / TPA file exchange | **G** | Needs item-level evidence |
| [26.13](../docs/16-MICROFEATURE-INVENTORY.md#L634) | Email (SMTP) + BSP (WhatsApp) + SMS gateway adapters | **P** | Needs item-level evidence |
| [26.14](../docs/16-MICROFEATURE-INVENTORY.md#L635) | Integration health dashboard for it_admin | **B** | Needs item-level evidence |
| [26.15](../docs/16-MICROFEATURE-INVENTORY.md#L636) | S3-compatible object storage adapter (SeaweedFS) | **S** | Needs item-level evidence |

### 27. Administration & configuration

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [27.1](../docs/16-MICROFEATURE-INVENTORY.md#L642) | `core.settings` for **every** policy number, typed get/set, audited | **B** | Needs item-level evidence |
| [27.2](../docs/16-MICROFEATURE-INVENTORY.md#L643) | Setting scope: global / entity / plant / grade | **P** | Needs item-level evidence |
| [27.3](../docs/16-MICROFEATURE-INVENTORY.md#L644) | Setting change history + effective dates + who changed it | **B** | Needs item-level evidence |
| [27.4](../docs/16-MICROFEATURE-INVENTORY.md#L645) | Workflow definition seeding + runtime edit by hr_head | **B**/**P** | Needs item-level evidence |
| [27.5](../docs/16-MICROFEATURE-INVENTORY.md#L646) | RBAC admin API (grant/revoke/assign) with next-request effect | **B** | Needs item-level evidence |
| [27.6](../docs/16-MICROFEATURE-INVENTORY.md#L647) | Entity / org-unit / cost-centre / location masters | **B** | Needs item-level evidence |
| [27.7](../docs/16-MICROFEATURE-INVENTORY.md#L648) | **Per-entity branding on letters, payslips, portal** (14 legal entities) | **P** | Needs item-level evidence |
| [27.8](../docs/16-MICROFEATURE-INVENTORY.md#L649) | **Per-entity statutory registration numbers** | **G** | Needs item-level evidence |
| [27.9](../docs/16-MICROFEATURE-INVENTORY.md#L650) | Per-entity approval matrices | **B** | Needs item-level evidence |
| [27.10](../docs/16-MICROFEATURE-INVENTORY.md#L651) | **Config promotion dev→prod** (settings, chains, templates) | **G** | Needs item-level evidence |
| [27.11](../docs/16-MICROFEATURE-INVENTORY.md#L652) | **Sandbox / UAT tenant with masked production data** | **G** | Needs item-level evidence |
| [27.12](../docs/16-MICROFEATURE-INVENTORY.md#L653) | Feature flags / phased rollout per entity | **G** | Needs item-level evidence |
| [27.13](../docs/16-MICROFEATURE-INVENTORY.md#L654) | In-app contextual help + teaching empty states + role quick-guides | **S** | Needs item-level evidence |
| [27.14](../docs/16-MICROFEATURE-INVENTORY.md#L655) | System health endpoint + job monitoring | **B** | Needs item-level evidence |
| [27.15](../docs/16-MICROFEATURE-INVENTORY.md#L656) | Backup / PITR / restore drill | **S** | Needs item-level evidence |
| [27.16](../docs/16-MICROFEATURE-INVENTORY.md#L657) | **Archival of exited-employee data + restore path** | **G** | Needs item-level evidence |

### 28. AI capabilities — no position recorded anywhere

| ID | Microfeature | Source label | Evidence disposition |
|---|---|---|---|
| [28.1](../docs/16-MICROFEATURE-INVENTORY.md#L663) | **Anomaly detection** on payroll & attendance (outlier net pay, impossible punches, duplicate bank accounts, ghost workers) | **G** | Needs item-level evidence |
| [28.2](../docs/16-MICROFEATURE-INVENTORY.md#L664) | **HR copilot / assistant** over policies + own data | **G** | Needs item-level evidence |
| [28.3](../docs/16-MICROFEATURE-INVENTORY.md#L665) | Payslip explainer ("why is my net lower?") | **G** | Needs item-level evidence |
| [28.4](../docs/16-MICROFEATURE-INVENTORY.md#L666) | Ticket auto-triage + suggested KB answer | **G** | Needs item-level evidence |
| [28.5](../docs/16-MICROFEATURE-INVENTORY.md#L667) | Attrition / flight-risk prediction | **G** | Needs item-level evidence |
| [28.6](../docs/16-MICROFEATURE-INVENTORY.md#L668) | Resume screening & candidate matching | **G** | Needs item-level evidence |
| [28.7](../docs/16-MICROFEATURE-INVENTORY.md#L669) | Document data extraction (OCR on bills, certificates, IDs) | **G** | Needs item-level evidence |
| [28.8](../docs/16-MICROFEATURE-INVENTORY.md#L670) | **AI governance position + employee disclosure** | **G** | Needs item-level evidence |
