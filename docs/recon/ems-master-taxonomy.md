# EMS employee-master — taxonomy & schema recon (PII-free)

> **Source:** live  — read-only recon, **1066 documents**, snapshot **7 Jul 2026**.
> **This file contains ZERO PII.** No names, emails, phones, or password hashes were extracted — only
> the collection's field *names* and org-taxonomy *value counts*. Per docs/11 §0 and Stage 0.5, the
> actual seed load is a separate **sanctioned, snapshot-frozen** export done with IT (P0-T09), not this.
> Feeds: Stage 0.5 P0-T30 (entity master + dedupe), P0-T32a (department/designation normalization tables),
> and confirms the **login identifier = `userid` e-code** (docs/11 §0.1).

## 1. Document field schema (`users` collection)

`__v, company, created_at, department, designation, domestic_level, email, encrypted_password, gender, hod_id, hod_name, international_level, phone, phone_verified, reporting_manager, reporting_manager_id, role, updated_at, userid, username`

Maps 1:1 to the doc 11 §0.1 seed plan. `userid` = greytHR e-code = login id. `encrypted_password` = bcrypt
(users can log in day one). `reporting_manager_id` → RM link; `hod_id` → functional manager.

## 2. Roles

| employee | 1065 |
| admin | 1 |

⚠️ **Single admin for 1,065 employees** — single point of failure (also flagged in the server-context doc).

## 3. Legal entities (`company`) — the canonical 14

| Company (verbatim in EMS) | Headcount |
|---|---|
| Rashmi Metaliks Limited | 667 |
| Rashmi Green Hydrogen Steel Ltd | 174 |
| Reach Dredging Limited | 96 |
| Rashmi 6 Paradigm Limited | 57 |
| eHoome iOT Pvt. Limited | 19 |
| Koove iOT Pvt. Limited | 16 |
| Koove Organic Chemical Pvt. Limited | 14 |
| Rashmi Metalix Ltd | 6 |
| Rashmi Pipes And Fittings FZCO Dubai | 5 |
| Rashmi Metaliks UK Limited | 3 |
| Reach Mining Tz Limited | 3 |
| Rashmi Rare Earth Limited | 3 |
| Rashmi Metaliks Bahrain W.L.L | 2 |
| Rashmi Group | 1 |

**Flags for P0-T30 (entity master + dedupe):**
- **`Rashmi Metalix Ltd` (6)** — the known typo/dupe of Rashmi Metaliks; doc 11 §0.2 says **merge → RML**.
- **`Rashmi 6 Paradigm Limited` (57)** — doc 11 / P0-T08b flags this as a **suspected typo** in the legal name; confirm canonical name with HR.
- 5 foreign entities present (UK, Dubai FZCO, Tz Mining, Bahrain, + `Rashmi Group` holding row) → set `is_india_payroll = false`.

## 4. e-code prefixes (login-id format) — leading letters only

| Prefix | Count |
|---|---|
| RML | 739 |
| RGH | 121 |
| RDL | 95 |
| RPL | 29 |
| KIOL | 14 |
| EIPLL | 12 |
| KOL | 12 |
| RMLC | 10 |
| RREL | 6 |
| RMLS | 5 |
| RPF | 5 |
| EIPL | 4 |
| RMLUK | 3 |
| RMTZ | 3 |
| RMB | 2 |
| KOLC | 2 |
| RBS | 1 |
| RASPL | 1 |
| RDLC | 1 |
| RPLC | 1 |

**Notes:**
- Prefix ≠ company cleanly: RML-family splits into **RML / RMLC / RMLS / RMLUK** (cost-centre / entity variants).
  The e-code prefix is **not** a safe entity key on its own — join on the confirmed entity mapping, not the prefix.
- Prefix length runs **3–5 letters**; numeric tail runs **2–6 digits**.

## 5. Travel entitlement tiers (Yatra Avedan T&E)

**Domestic (`domestic_level`)** — 6 tiers · **International (`international_level`)** — 3 tiers.

| Domestic | n |
|---|---|
| Dom-F | 754 |
| Dom-E | 193 |
| Dom-D | 84 |
| Dom-C | 22 |
| Dom-A | 10 |
| Dom-B | 3 |

| International | n |
|---|---|
| Int-C | 1005 |
| Int-B | 48 |
| Int-A | 13 |

## 6. Departments — 112 distinct (needs a normalization map, P0-T32a)

Obvious merge candidates spotted (whitespace / case / abbreviation drift):
- `Maintenance-Electrical` **==** `Maintenance - Electrical` (spacing only)
- `Mechanical Maintenance` ⟵ `Maintenance-Mech` (abbreviation)
- `Production` vs `Production-Hotmill` (parent vs sub-unit — decide hierarchy)
- `FINISHING` vs `Finishing Line` (case / naming)

Full distinct list with headcounts:

| Department | n |
|---|---|
| Sales & Marketing | 80 |
| Finance & Accounts | 69 |
| Project | 63 |
| Production | 52 |
| Production-Hotmill | 50 |
| QA & QC | 43 |
| Mechanical Maintenance | 40 |
| Commercial | 29 |
| Stores | 29 |
| Operations | 26 |
| Plant Maintenance | 24 |
| Logistics | 23 |
| Administration | 22 |
| Finishing Line | 22 |
| Information Technology | 21 |
| Project E & I | 18 |
| Purchase | 18 |
| Project Mechanical | 17 |
| Hydraulics | 17 |
| Human Resource | 16 |
| FINISHING | 15 |
| Maintenance-Electrical | 15 |
| Maintenance - Electrical | 15 |
| Mining | 14 |
| Precast | 13 |
| Land | 13 |
| Liaison | 12 |
| Casting | 12 |
| Maintenance-Mech | 12 |
| MMD | 11 |
| Civil | 11 |
| MIS | 10 |
| Production-Cold Mill | 9 |
| Design & Drawing | 8 |
| PPC&Logistic | 8 |
| Survey | 7 |
| Tooling-Hotmill | 7 |
| CEO Cell | 7 |
| Dispatch | 7 |
| Order Management Cell | 7 |
| Mould Shop | 7 |
| Research & Development | 7 |
| Maintenance - Utility | 6 |
| Production Planning & Control | 6 |
| Annealing Furnace | 6 |
| Sales | 6 |
| Legal | 5 |
| Tender | 5 |
| Audit | 5 |
| E & I Maintenance | 5 |
| Project Utility | 5 |
| Production- Finishing | 4 |
| Coating Line | 4 |
| Heat Treatment | 4 |
| ERP-CELL | 4 |
| Core Shop | 3 |
| Operation | 3 |
| Melting | 3 |
| Tooling-ColdMill | 3 |
| CZ-ELE | 3 |
| Automobile Operations | 3 |
| Metallurgy | 3 |
| Maintenance | 3 |
| Project Civil | 3 |
| Hot Mould | 3 |
| Melting & refractory | 3 |
| Environment Health & Safety | 3 |
| Maintenance-Utility | 2 |
| ELECTRICAL | 2 |
| Project - Electrical | 2 |
| PROJECT-MECH | 2 |
| Store | 2 |
| Electrical Maintenance | 2 |
| BL LINES | 2 |
| Mechanical Maintenance-Hot Zone | 2 |
| Project-Purchase | 2 |
| Mechanical Operations | 2 |
| Fittings | 2 |
| Land Acquisition | 2 |
| Project Planning & Control | 2 |
| Cold Zone Mechanical Maintenance | 2 |
| PPC | 1 |
| Refractory | 1 |
| PGP | 1 |
| Production-Manhole Cover | 1 |
| Dredging | 1 |
| Tooling | 1 |
| Business Operations | 1 |
| Planning | 1 |
| Design | 1 |
| Cold Zone | 1 |
| Production-DIP | 1 |
| Project Hydraulic | 1 |
| Electrical Maintanance- ColdZone | 1 |
| HZ-ELE | 1 |
| SAND DRYER | 1 |
| Business Development | 1 |
| Rashmi Mind & Technologies | 1 |
| Mechanical (Seamless) | 1 |
| HZMM | 1 |
| CZMM | 1 |
| Electrical - Operations | 1 |
| Hydraulics Maintenance | 1 |
| Digital Marketing | 1 |
| ANNEALING | 1 |
| Utility Maint | 1 |
| IT&Networking | 1 |
| Maint MECH | 1 |
| Liasion | 1 |
| SAP | 1 |
| Common | 1 |
| EOT CRANE MAINTENANCE | 1 |

## 7. Designations — 176 distinct (needs a normalization map, P0-T32a)

Top 40 by headcount:

| Designation | n |
|---|---|
| Engineer | 121 |
| Junior Diploma Engineer | 87 |
| Executive | 78 |
| Junior Graduate Engineer | 70 |
| Assistant Engineer | 66 |
| Assistant Manager | 64 |
| Manager | 61 |
| Senior Engineer | 59 |
| Junior Engineer | 34 |
| Deputy Manager | 28 |
| Shift Incharge | 26 |
| Senior Manager | 25 |
| Senior Executive | 25 |
| Officer | 19 |
| Deputy General Manager | 19 |
| Assistant General Manager | 17 |
| Geologist | 9 |
| General Manager | 9 |
| Senior Officer | 8 |
| Surveyor | 8 |
| Consultant | 8 |
| DET | 7 |
| Incharge | 6 |
| Assistant | 6 |
| Sales Manager | 6 |
| Regional Sales Manager | 6 |
| Trainee | 5 |
| Store Executive | 5 |
| Junior Executive | 4 |
| Sr. Geologist | 4 |
| Supervisor | 4 |
| Advisor | 3 |
| CEO | 3 |
| Senior Inspector | 3 |
| Shift In Charge | 3 |
| DGM | 3 |
| Senior General Manager | 3 |
| Data Analyst | 2 |
| Manager - International Export Sales | 2 |
| Senior Accountant | 2 |

## 8. Data-quality counts (client-validation & import inputs)

| Check | Value |
|---|---|
| Total users | 1066 |
| `userid` matches `^[A-Z]{2,5}\d{3,}$` | 1061 |
| `userid` fails that (shape `AAAA99` = 4 letters + 2 digits) | 5 |
| Missing `reporting_manager_id` | 2 |
| Missing `email` | 0 |

→ **Login form implication:** the 5 short-tail e-codes mean client-side format validation must stay loose
(`/^[A-Z]{2,6}\d{2,}$/`), never hard-block. Applied in `frontend/src/pages/auth/LoginPage.tsx`.
→ **Import implication:** 2 employees have no RM — surface in the P0-T32a exception report.

---
*Regenerate: read-only `mongosh` aggregate over `ems_db.users` (leading-letter / masked-shape projections only). No PII leaves the server.*
