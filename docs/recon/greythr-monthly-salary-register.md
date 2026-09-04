# Recon — greytHR **Monthly Salary Report** (the Final Pay Register, R7)

**Artifact:** `MONTHLY SALARY REPORT.xlsx` — sponsor-supplied, 4 Sep 2026. One employee, **Jun 2026**, company **RML**.
**Answers:** `09-RECON §8` item 2 (payroll-register column format) — the *register* half. Bank file / JV / ECR formats are still outstanding.
**Status:** ground truth. This is the exact sheet Finance receives each month; **R7 must reproduce it column-for-column, in this order.**

> **PII:** the source workbook carries a real name, UAN, bank account and IFSC. It is **not committed**. Identifiers below are masked; only the money and the structure are recorded.

---

## 1. Sheet shape

Single sheet `Report`. Row 1 = header, rows 2..n = one row per employee, final row = **Grand Total** with the label `Grand Total` in the *IFSC* column (`U`) and `=SUM(...)` over **every numeric column from `V` (FULL BASIC) to `BL` (NET PAY)** — including `MONH DAYS` and `PAID DAYS`, which are summed even though a day-count total is meaningless. Reproduce it anyway: Finance diffs this row.

## 2. The 64 columns (exact header text, exact order)

### 2a. Identity & posting keys (A–U)

| Col | Header | Source | Note |
|---|---|---|---|
| A | `Sl No` | sequence | 1-based within the run, **not** the employee id |
| B | `EmployeeNo` | `core.employees.ecode` | `RML0336xx` — the greytHR join key (docs/11 §0.1) |
| C | `Name` | | |
| D | `Join Date` | | text `DD MMM YYYY` (`20 Sep 2024`), **not** an Excel date serial |
| E | `Leaving Date` | | blank for active |
| F | `PAYROLL MONTH` | run period | text `MMM YYYY` (`Jun 2026`) |
| G | `DEPTMIS` | `core.departments.mis_code_id` → `core.mis_codes.code` | ORG-03 — department-level MIS |
| H | **`OUMIS`** | **`core.cost_centers.code`** | `RML1` — **this is the real cost centre** (sponsor, 4 Sep 2026). Despite the header, it is not an "OU MIS" — it is the accounting cost centre the employee is booked against. **This is the JV/GL key.** |
| I | `OU` | **`core.companies.code`** | `RML` — the OU *is* the legal entity; `companies.code` already holds exactly this (`RML`, `RGH`, `EIPL`, `RPL`, `RDL`, `RPF`). `core.org_units` is unrelated and stays out of the register |
| J | `Company` | `core.companies.name` | legal name (`Rashmi Metaliks Limited`) |
| K | `PT Location` | `stateName(locations.state_code)` | `West Bengal` — drives the PT slab. Rendered via `core/org/states.ts`; **distinct from `WorkLocation`**, though both derive from the same `location_id` unless PT state can differ from work state (§5.8) |
| L | `Department` | | |
| M | `Designation` | | |
| N | `Grade` | | `Junior Grade` — the salary-structure key (PAY-01) |
| O | `WorkLocation` | | `Kharagpur` — physical site, **not** the PT key |
| P | `Cost Center` | **not the cost centre** | `ERP-CELL` — a department label (identical to `Department` and `DEPTMIS` in the sample). greytHR's header is misleading; the cost centre is `OUMIS`. Source column unconfirmed — see §5.5 |
| Q | `UAN` | masked | PF |
| R | `ESI Number` | masked | blank when `esic_applicable=false` |
| S | `BankName` · T `BANK ACCOUNT NO` · U `IFSC Code` | masked | feeds R8 |

**ORG-05 consequence:** the register slices on `Company / OU / OUMIS / DEPTMIS / Cost Center / PT Location / WorkLocation` — **seven** keys, not the four in `P2-T24`. `OU` and `PT Location` are the genuine additions.

> ### ⚠ The cost-centre trap (sponsor correction, 4 Sep 2026)
>
> **`OUMIS` holds the cost centre. The column named `Cost Center` does not.**
>
> In the sample row `DEPTMIS`, `Department` and `Cost Center` all read `ERP-CELL`, while `OUMIS` reads `RML1`. The header names invert the meaning: `RML1` is the accounting cost centre; `ERP-CELL` is a department label repeated three times.
>
> **Therefore `pay.gl_accounts.cost_center_code` must be fed `OUMIS`** (`core.employees.cost_center_id → core.cost_centers.code`), never the `Cost Center` column. Keying the JV on `ERP-CELL` would post every one of those employees' salary cost to the wrong GL account, and the error would surface only in SAP, after finalize. (`P2-T27` / ORG-08)

### 2b. Full (un-prorated) monthly structure — V–AD

`FULL BASIC` · `FULL STIPEND` · `FULL HRA` · `FULL EDUCATION ALLOWANCE` · `FULL MEDICAL ALLOWANCE` · `FULL BONUS` · `FULL SPECIAL ALLOWANCE` · `FULL PROJECT ALLOWANCE` → **`FIXED MONTHLY GROSS`** (AD).

> **The structural rule this artifact establishes:** exactly **eight** components carry a `FULL …` twin. Those eight — and only those — are the LOP-proratable fixed structure (`prorate_on_lop = true`). Everything from `INCENTIVE` (AP) onward is a monthly variable input with no full-month counterpart and is **never** prorated.
> `FIXED MONTHLY GROSS` = Σ(the eight FULL columns) and is the pre-LOP contractual gross.

### 2c. Days — AE–AG

`MONH DAYS` *(sic — header is misspelled in the live file; reproduce verbatim)* · `LOP` · `PAID DAYS`, with `PAID DAYS = MONH DAYS − LOP`.

### 2d. Earned (post-LOP) components — AH–AW

Prorated eight: `BASIC` · `STIPEND` · `HRA` · `EDUCATION ALLOWANCE` · `MEDICAL ALLOWANCE` · `BONUS` · `SPECIAL ALLOWANCE` · `PROJECT ALLOWANCE`
Variable inputs: `INCENTIVE` · `OTHER EARNINGS` · `GRATUITY` · `LEAVE ENCASHMENT` · `OVERTIME` · `EX-GRATIA` · `HOLD SALARY` · `Performance-Linked Earnings` *(the only mixed-case header — keep it)*

### 2e. Gross — AX–AY

`GROSS` (AX) = Σ(AH:AW) · **`ESI GROSS SALARY` (AY) is a separate column** — its own wage base, equal to `GROSS` for this row but not by definition.

### 2f. Deductions — AZ–BK

`PF` · `ESI` · `PROF TAX` · `INCOME TAX` · `LOAN` · **`LOAN2`** · `MISCELLANEOUS RECOVERY` · `CANTEEN RECOVERY` · `GUEST HOUSE DEDUCTION` · `TRAVEL ADVANCE RECOVERY` · `NOTICE PERIOD RECOVERY` → **`TOTAL DEDUCTIONS`** (BK).

> **`TOTAL DEDUCTIONS` is written NEGATIVE** (`-5449` for a `5,449` deduction) while every individual deduction column is positive. `NET PAY = GROSS + TOTAL DEDUCTIONS`. This sign convention is not cosmetic — the Grand-Total row sums it — so R7 must emit it, even though the internal `Money` ledger keeps deductions positive.

### 2g. `NET PAY` — BL

---

## 3. Components this artifact adds to the master (not in 09 §2 / 10 §10.1)

| New | Class | Prorated | Note |
|---|---|---|---|
| `STIPEND` | earning | **yes** | apprentices/trainees (10 §9) sit in the *same* register and structure, with `BASIC = 0` |
| `PROJECT_ALLOWANCE` | earning | **yes** | eighth fixed component |
| `INCENTIVE` · `OTHER_EARNINGS` · `EX_GRATIA` · `PERFORMANCE_LINKED` | earning | no | `pay.inputs` |
| `GRATUITY` · `LEAVE_ENCASHMENT` | earning | no | **F&F settles inside the monthly register**, not a separate document (PAY-15) |
| `OVERTIME` | earning | no | OT lands as a register line *and* on the separate OT payslip (10 §11) |
| `HOLD_SALARY` | earning | no | **ambiguous — see §5.1** |
| `INCOME TAX` | deduction | — | TDS on the register (PAY-13) |
| `LOAN` + **`LOAN2`** | deduction | — | **two concurrent loan slots**, not one; M11 must model ≥2 parallel EMIs |
| `MISCELLANEOUS_RECOVERY` · `CANTEEN_RECOVERY` · `TRAVEL_ADVANCE_RECOVERY` · `NOTICE_PERIOD_RECOVERY` | deduction | — | `CANTEEN` and `TRAVEL_ADVANCE` are new; **`TRAVEL ADVANCE RECOVERY` is the T&E→payroll coupling the scope decision named** |

`GUEST HOUSE DEDUCTION` (09 §2) is confirmed as a **named column**, not a generic `RECOVERY_*`. The recovery components are a **fixed catalog with reserved columns**, not free-form — the register width is stable month to month.

---

## 4. The sample row — reconciled to the rupee

Employee `RML0336xx`, Grade *Junior Grade*, DOJ 20 Sep 2024, PT location West Bengal, **Jun 2026**, `MONH DAYS 30 · LOP 0 · PAID DAYS 30`.

| Line | ₹ | Derivation — verified |
|---|---:|---|
| FULL/earned `BASIC` | 32,286 | ⌊64,573 / 2⌋ = ⌊32,286.5⌋ → **floor, not round** |
| `HRA` | 16,143 | `BASIC × 0.50` exactly ✔ (09 §2 rule 1) |
| `EDUCATION ALLOWANCE` | 200 | fixed ✔ |
| `MEDICAL ALLOWANCE` | 1,250 | fixed ✔ |
| `BONUS` | 2,689 | `32,286 × 0.0833 = 2,689.42` → 2,689 ✔ (monthly statutory bonus) |
| `SPECIAL ALLOWANCE` | 12,005 | balancing: `64,573 − 32,286 − 16,143 − 200 − 1,250 − 2,689` ✔ |
| `STIPEND` / `PROJECT ALLOWANCE` | 0 | |
| **`FIXED MONTHLY GROSS`** | **64,573** | Σ eight FULL ✔ |
| **`GROSS`** | **64,573** | LOP 0 → equals fixed gross ✔ |
| `ESI GROSS SALARY` | 64,573 | |
| `PF` | 3,874 | `12% × 32,286 = 3,874.32` → 3,874. **On full basic — the ₹15k ceiling is NOT applied** ✔ (09 §2 rule 2; 10 §15 decision 1 now has live evidence in a second month) |
| `ESI` | 0 | gross > ₹21,000 ✔ |
| `PROF TAX` | 200 | WB top slab, keyed on **`PT Location`** ✔ |
| `INCOME TAX` | 0 | |
| `CANTEEN RECOVERY` | 1,375 | |
| **`TOTAL DEDUCTIONS`** | **−5,449** | `−(3,874 + 200 + 1,375)` ✔ |
| **`NET PAY`** | **59,124** | `64,573 − 5,449` ✔ |

Same structure and identical component values as the May-2026 payslip in 09 §2 (a different employee on the same grade), which is corroboration across **two employees and two months**: the STAFF_STANDARD template is stable.

---

## 5. What this does **not** settle

1. **`HOLD SALARY` semantics.** Positioned as an *earning*. Is it (a) the **release** of previously held salary, with the hold itself shown as a negative earning or an absent line, or (b) a negative number that withholds this month? A held employee's row is needed. Blocks `pay.salary_holds` (PAY-08 / P2-T04).
2. **LOP divisor (10 §15 decision 3) — still open.** `MONH DAYS = 30` for **June, which has 30 calendar days**, so `CALENDAR` and `FIXED_30` are indistinguishable here. **Get a February or a 31-day month.** A `MONH DAYS` of 28 proves `CALENDAR`; 30 in a 31-day month proves `FIXED_30`.
3. **Proration rounding.** LOP is 0 in this row, so `FULL × PAID/MONTH` was never exercised. Need a mid-month joiner or an LOP row to fix per-component rounding (round each component, or prorate gross then re-split).
4. **`ESI GROSS SALARY` definition.** Equal to `GROSS` here only because every ESI-excludable line (OT, ex-gratia, encashment) is zero. Needs an ESI-covered employee with OT.
5. **What column P (`Cost Center`) actually holds.** `OUMIS` is settled (it is the cost centre). Column P equals `Department`/`DEPTMIS` in the one sample row — is it always the department, or does it vary independently? Two or three rows from different departments settle it. Until then R7 sources it from the department and flags the assumption.
6. **Basic-from-gross anchoring.** `BASIC = ⌊gross/2⌋` fits this grade, but the direction (is gross the anchor and basic derived, or basic the anchor?) is a grade-structure question — 10 §15 decision 8, still unsigned.
7. Bank file, JV and ECR formats (09 §8 item 2, remainder) — **still not supplied.**
8. **Can PT state differ from work state?** Today both `PT Location` and `WorkLocation` derive from the employee's single `location_id`. If an employee can be PT-registered in a state other than the one they work in, PT location becomes a real stored field, not a derivation.
