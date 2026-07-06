# 10 — India Payroll & Statutory Reference (FY 2025-26)

**Purpose:** Authoritative statutory rates, calculation pseudocode, RML policy flags, and golden-test fixtures for the payroll engine (PAY-09..17). Supplements **04-MODULE-SPECS §3/§6** and **03-DATABASE-SCHEMA §6** with external law context. Where this doc conflicts with **09-GREYTHR-RECON-FINDINGS.md**, live RML config wins until payroll admin confirms otherwise.

**Scope:** West Bengal manufacturing (~2,000 on-roll employees). FY **2025-26** (AY 2026-27). Research date: 3 Jul 2026.

**Non-goal (unchanged from PRD §11):** statutory e-filing automation — the HRMS generates portal-ready files; humans upload to govt portals.

---

## 1. Applicability matrix (RML)

| Statute | Applies? | Threshold | RML note |
|---|---|---|---|
| EPF Act | Yes | ≥20 employees | RML deducts PF on **full basic** (see §2.3) |
| ESIC Act | Yes (notified areas) | Factory ≥10; wage ≤₹21k at period start | High earners excluded; period state machine required |
| WB Professional Tax | Yes | All salaried >₹10k gross | Top slab ₹200/mo confirmed live (09-RECON §2) |
| WB LWF | Yes | ≥10 employees | Half-yearly; employer ₹30 / employee ₹3 |
| Payment of Bonus Act | Yes | ≥20 employees | RML pays **monthly advance** at 8.33% of Basic |
| Payment of Gratuity Act | Yes | ≥10 employees | F&F pipeline (PAY-15) |
| Income Tax (TDS u/s 192) | Yes | All salaried | New regime default; SD ₹75k confirmed live |
| Apprentices Act exclusions | Per employee | Apprentice contract | No PF/ESIC/bonus for true apprentices (PAY-14) |

---

## 2. EPF / Provident Fund (PAY-09)

### 2.1 Rates (FY 2025-26 — unchanged in Budget 2025/2026)

| Component | Rate | Wage base | Paid by |
|---|---|---|---|
| Employee EPF | **12%** | EPF wages | Employee |
| Employer EPS | **8.33%** | min(EPF wages, **₹15,000**) → max **₹1,250**/mo | Employer |
| Employer EPF (balance) | **12% − EPS share** | EPF wages | Employer |
| EDLI | **0.50%** | min(EPF wages, **₹15,000**) → max **₹75**/mo | Employer |
| EPF admin | **0.50%** | EPF wages; min **₹500**/establishment/mo | Employer |

**EPF wages definition:** Basic + DA + allowances paid universally/necessarily/ordinarily to all in a grade (SC *Vivekananda Vidyamandir*, 2019). **Excluded:** HRA, OT, variable bonus/commission, reimbursements.

### 2.2 Calculation pseudocode

```
function compute_pf(employee, month):
  pf_wages = sum(components where part_of_pf_wages = true) × proration_factor

  // RML policy flag (core.settings 'pay.pf_wage_base')
  if settings.pf_wage_base == 'CEILING_15000':
    ee_pf_base = min(pf_wages, 15000)
  else if settings.pf_wage_base == 'ACTUAL':          // RML live default (09-RECON §2)
    ee_pf_base = pf_wages

  ee_pf = round(0.12 × ee_pf_base)

  eps_wages = min(pf_wages, 15000)                    // EPS always capped
  er_eps = round(0.0833 × eps_wages, cap=1250)
  er_epf = round(0.12 × pf_wages) − er_eps            // ER total 12% on actual pf_wages
  edli = round(0.005 × min(pf_wages, 15000), cap=75)
  admin = max(round(0.005 × pf_wages), 500/headcount) // establishment min ₹500

  ncp_days = lop_days + unpaid_weekoff_days            // ECR field

  return { ee_pf, er_eps, er_epf, edli, admin, pf_wages, ncp_days }
```

**Example — RML live employee (Basic = ₹32,286, `pf_wage_base = ACTUAL`):**

| Line | Amount |
|---|---|
| EE PF (12% × 32,286) | **₹3,874** |
| ER EPS (8.33% × 15,000) | ₹1,250 |
| ER EPF (12% × 32,286 − 1,250) | ₹2,624 |
| EDLI | ₹75 |

### 2.3 RML policy flag — critical

| Setting | Value today (greytHR) | Legal context |
|---|---|---|
| `pay.pf_wage_base` | **`ACTUAL`** — 12% on full Basic | Pre–EPF Scheme 2026: common for covered employees |
| EPS cap | Always **₹15,000** wage ceiling | Statutory — unchanged |
| EPF Scheme 2026 (notified 29 Jun 2026) | **Pending RML decision** | Mandatory EE/ER capped at 12% × ₹15,000 = **₹1,800** each; above = voluntary (VPF) |

> **Gate before Phase 2:** Confirm with payroll admin (Subhasis) whether RML continues full-basic PF or adopts Scheme 2026 split (mandatory ₹1,800 + voluntary line on payslip).

### 2.4 ECR output (compute in HRMS → file for portal)

HRMS computes all fields; human uploads ECR to [EPFO Unified Portal](https://unifiedportal-emp.epfindia.gov.in) by **15th** of following month.

Fields per employee: UAN, gross wages, EPF wages, EPS wages, EDLI wages, EE share, ER EPF, ER EPS, EDLI, **NCP days**.

---

## 3. ESIC (PAY-10)

### 3.1 Rates (unchanged since 1 Jul 2019)

| Contributor | Rate | Base |
|---|---|---|
| Employee | **0.75%** | Gross wages (excl. OT) |
| Employer | **3.25%** | Gross wages (excl. OT) |

**Eligibility ceiling:** gross ≤ **₹21,000**/month at **contribution-period start** (Apr–Sep or Oct–Mar).

### 3.2 Contribution-period state machine (HRMS-critical)

```
periods:
  H1: Apr 1 – Sep 30  →  benefits Jan 1 – Jun 30 (next year)
  H2: Oct 1 – Mar 31  →  benefits Jul 1 – Dec 31 (same year)

on period_start(employee):
  if gross_at_start <= 21000:
    employee.esic_member = true for entire period
  else:
    employee.esic_member = false

mid_period_salary_increase above 21000:
  // NO change — stay covered until period end

on period_end(employee):
  re_evaluate for next period
```

**Rounding:** round **up** to next rupee (ESIC rule).

### 3.3 Calculation pseudocode

```
function compute_esic(employee, month):
  if not employee.esic_applicable_for_period:
    return { ee: 0, er: 0 }

  gross = sum(components where part_of_gross = true) × proration
  ee = ceil(gross × 0.0075)
  er = ceil(gross × 0.0325)
  return { ee, er, gross }
```

---

## 4. Professional Tax — West Bengal (PAY-11)

**Act:** WB State Tax on Professions, Trades, Callings and Employments Act, 1979. Constitutional cap: **₹2,500/year**.

### 4.1 Monthly slabs (salaried employees)

| Monthly gross salary | PT/month |
|---|---|
| Up to ₹10,000 | Nil |
| ₹10,001 – ₹15,000 | ₹110 |
| ₹15,001 – ₹25,000 | ₹130 |
| ₹25,001 – ₹40,000 | ₹150 |
| Above ₹40,000 | **₹200** |

**Basis:** monthly **gross salary** (not Basic alone). Employer deducts and remits within 15 days of following month.

### 4.2 Seed data (`pay.pt_slabs`, state_code = 'WB')

```sql
-- effective_from 2025-04-01
(0,      10000,  0)
(10001,  15000,  110)
(15001,  25000,  130)
(25001,  40000,  150)
(40001,  999999999, 200)
```

**RML live:** gross ₹64,573 → PT **₹200** ✓ (09-RECON §2).

---

## 5. Labour Welfare Fund — West Bengal (PAY-12)

| Contributor | Amount | Frequency |
|---|---|---|
| Employee | **₹3** | Half-yearly |
| Employer | **₹30**/employee | Half-yearly |

**Due dates:** 15 Jul (Jan–Jun period) · 15 Jan (Jul–Dec period). Employer rate revised **₹15 → ₹30** w.e.f. 1 Jan 2024.

**HRMS:** accrue/deduct per company policy (half-yearly lump or monthly spread — confirm with payroll). Generate Form D payment data; filing on [lwf.wblabour.gov.in](https://lwf.wblabour.gov.in).

---

## 6. Income Tax / TDS (PAY-13)

**Default regime:** New (Section 115BAC) unless employee opts out at FY start.

### 6.1 New regime slabs (Budget 2025 — effective 1 Apr 2025)

| Taxable income (₹) | Rate |
|---|---|
| Up to 4,00,000 | Nil |
| 4,00,001 – 8,00,000 | 5% |
| 8,00,001 – 12,00,000 | 10% |
| 12,00,001 – 16,00,000 | 15% |
| 16,00,001 – 20,00,000 | 20% |
| 20,00,001 – 24,00,000 | 25% |
| Above 24,00,000 | 30% |

**Standard deduction:** **₹75,000** (new regime, FY 2025-26 — confirmed live, 09-RECON §3).

**Section 87A rebate (new regime):** max **₹60,000** if taxable income ≤ **₹12,00,000** (Budget 2025). Apply **marginal relief** if income slightly exceeds ₹12L.

**Cess:** 4% on (tax + surcharge). **Surcharge:** 10% (>₹50L), 15% (>₹1Cr), 25% (>₹2Cr); capped at 25% for new regime above ₹5Cr.

### 6.2 IT statement layout (A→R — match greytHR ESS)

Live greytHR IT statement lines (09-RECON §3) — HRMS ESS tax view and report R15 must reproduce:

```
A  Income
B  Deductions (pre-tax)
C  Perquisites
D  Income Excluded From Tax
E  Gross Salary (A + C − D)
F  Exemption u/s 10                    // HRA min-of-three (old regime only)
G  Income From Previous Employer      // Form 12B
H  Income After Exemption (E − F + G)
I  Less Deduction u/s 16              // standard deduction (₹75k new / ₹50k old)
J  Income Chargeable under Salaries (H − I)
K  Income From Other Sources / House Property
L  Gross Total Income (J + K)
M  Deduction under Chapter VI-A       // old regime; declared → verified
N  Taxable Income (L − M)
O  Annual Tax
P  Tax Paid Till Date
Q  Balance Payable
R  TDS Recovered in Current Month
```

### 6.3 Monthly TDS projection pseudocode

```
function compute_monthly_tds(employee, month, fy):
  ytd_taxable = sum_taxable_earnings_ytd(employee, fy)
  ytd_tds     = sum_tds_deducted_ytd(employee, fy)

  remaining_months = months_left_in_fy(month)
  projected = ytd_taxable + (monthly_taxable_run_rate × remaining_months)

  if employee.tax_regime == 'old':
    projected -= hra_exemption_min_of_three(employee)   // §10(13A)
    projected -= chapter_vi_a(employee, declared_or_verified)
  projected -= standard_deduction(regime)               // ₹75k new / ₹50k old

  projected += previous_employer_income(employee)       // Form 12B

  tax = slab_tax(projected, regime)
  tax = apply_87a_rebate(tax, projected, regime)
  tax = apply_surcharge(tax, projected, regime)
  tax = tax × 1.04                                    // cess

  monthly_tds = max(0, (tax − ytd_tds) / remaining_months)
  return round(monthly_tds)
```

### 6.4 HRA exemption (old regime only — location-aware)

Kharagpur is **non-metro** for HRA u/s 10(13A). Metro cities (FY 2025-26): Delhi, Mumbai, Kolkata, Chennai.

```
hra_exempt = min(
  actual_hra_received,
  rent_paid − 0.10 × (basic + da),
  hra_cap_pct × (basic + da)     // 0.40 non-metro | 0.50 metro
)
```

**RML pay policy:** HRA = **50% of Basic** (09-RECON). **Tax cap at Kharagpur:** 40% of Basic+DA. Store both:

| Setting | Staff @ Kharagpur |
|---|---|
| `pay.hra_pay_pct` | 0.50 |
| `pay.hra_tax_cap_pct` | 0.40 |

New-regime employees: HRA fully taxable — cap irrelevant for TDS.

---

## 7. Payment of Bonus Act (PAY-17)

| Parameter | Value |
|---|---|
| Establishment threshold | ≥20 employees |
| Eligibility wage ceiling | Basic + DA ≤ **₹21,000**/month |
| Minimum bonus | **8.33%** of qualifying wages |
| Maximum bonus | **20%** |
| Calculation ceiling | **₹7,000**/month **or** applicable state minimum wage, **whichever is higher** |
| Min service | 30 working days in accounting year |
| Payment deadline | Within 8 months of accounting year close |

### 7.1 RML live pattern — monthly statutory bonus advance

```
STATUTORY_BONUS (monthly) = BASIC × 0.0833    // RML live: 32,286 × 8.33% ≈ ₹2,689
```

**Label on payslip:** "Statutory Bonus (Advance)" — not performance bonus.

**Year-end job:** true-up against 8.33–20% of (₹7,000 or min wage) × eligible months; adjust set-on/set-off per Sec 15.

> **Gate:** Confirm accounting year (Apr–Mar vs calendar) and year-end settlement rules with Finance.

---

## 8. Payment of Gratuity Act (PAY-15 / F&F)

```
gratuity = (last_drawn_basic + last_drawn_da) × 15/26 × completed_years

completed_years:
  if months_in_final_year >= 6: round up to next full year
  else: truncate

cap: ₹20,00,000 (private sector, 2018 amendment)
```

**Eligibility:** 5 years continuous service on exit. **4 years 240 days:** supported by several HCs, no definitive SC ruling — configurable:

| Setting | Behavior |
|---|---|
| `pay.gratuity_eligibility_mode` | `STRICT_5Y` (default) \| `LIBERAL_4Y240D` |

**Death/disability:** no minimum service.

**F&F additional heads** (04-MODULE-SPECS §6.7): EL encashment, notice recovery `(Basic/30 × shortfall days)`, held salary release, asset damage from clearances.

**⚠️ 2026 Labour Codes — VERIFY before go-live:** practitioner sources report the new Codes tighten F&F to **~2 working days of exit** (Protiviti SOW said 3) and broaden the **"wages" definition to ≥50% of CTC** (widening the PF/gratuity base, with arrears propagation). Commencement has been staggered — confirm the currently-in-force FFS deadline and wages rule with the payroll admin. RML's live Basic is already ≈50% of gross, so exposure is limited, but re-validate. Set `fnf_tat_working_days` in `core.settings` (default 3 → change when confirmed). Owner: payroll admin, Phase 0/2.

---

## 9. Apprentices & trainees (PAY-14)

| Employee type | PF | ESIC | Bonus | PT | TDS |
|---|---|---|---|---|---|
| Apprentice (Apprentices Act contract) | No | No | No | If gross > slab | If taxable |
| Trainee (not under Apprentices Act) | Yes* | Yes* | Yes* | Yes | Yes |

*Subject to normal thresholds. Flag: `core.employees.category = 'trainee'` + `contract_type` distinguishes apprentice vs general trainee.

---

## 10. Salary structure design (RML + industry)

### 10.1 RML live template — STAFF_STANDARD (09-RECON §2)

**Earnings (evaluation order):**

| Code | Formula / amount | Flags |
|---|---|---|
| `BASIC` | CTC anchor (~50% of gross) | `part_of_pf_wages`, `part_of_gross`, `prorate_on_lop` |
| `HRA` | `BASIC × hra_pay_pct` (0.50) | `part_of_gross`, taxable |
| `MEDICAL_ALLOW` | Fixed **₹1,250**/mo | Taxable (exemption removed Budget 2018) |
| `SPECIAL_ALLOW` | Balancing: CTC − sum(other) | `part_of_gross` |
| `EDUCATION_ALLOW` | min(children × limit, cap); limit **₹100** (→ **₹3,000** from FY 2026-27 old regime) | Old-regime exempt |
| `STATUTORY_BONUS` | `BASIC × 0.0833` | `part_of_gross`, monthly advance |

**Deductions:**

| Code | Rule |
|---|---|
| `PF_EE` | 12% × pf_wage_base (see §2.3) |
| `PT` | WB slab on gross |
| `TDS` | Monthly projection (§6.3) |
| `RECOVERY_*` | Per-employee via `pay.inputs` (e.g. GUEST_HOUSE ₹2,500) |

**Employer contributions (CTC / JV only — not employee payslip deductions):**

`PF_ER`, `ESI_ER`, `GRATUITY_ACCRUAL` (~4.81% of Basic), `EDLI`, `PF_ADMIN`.

### 10.2 Additional templates (not yet captured live)

| Template | Audience | Key difference |
|---|---|---|
| `WORKS_UNION` | Shop-floor / union grades | Basic + **DA/VDA** (CPI-linked); min-wage validation |
| `WORKS_CONTRACT` | Fixed-term labour | Min wage floor; gratuity after 1 yr under Social Security Code |

### 10.3 Structure templates — compliance gates (pre-finalize)

1. **Wage rule:** (Basic + DA) / total recurring remuneration ≥ **50%** (Code on Wages direction)
2. **Min wage (works only):** Basic (+ DA) ≥ WB scheduled rate for skill band + zone (Kharagpur ≈ Zone A: ₹10,558–₹14,054/mo by skill, Jul–Dec 2026)
3. **ESIC gate:** auto on gross ≤ ₹21,000 at period start
4. **PF split display:** mandatory vs voluntary (post-EPF Scheme 2026)
5. **Bonus eligibility:** Basic+DA ≤ ₹21,000

### 10.4 LOP proration

| Setting | Formula | RML default |
|---|---|---|
| `pay.lop_divisor` | `CALENDAR` → gross × (payable_days / days_in_month) | **Confirm with payroll** |
| | `FIXED_30` → gross × (payable_days / 30) | |
| | `WORKING_DAYS` → gross × (payable_days / working_days) | |

**OT hourly rate (separate from LOP):** use **26 × 8 = 208** divisor per Factories Act practice:

```
ot_hourly = (BASIC + DA + ot_base_allowances) / 208
ot_pay    = ot_hourly × ot_multiplier × approved_hours    // multiplier default 2.0
```

> **Gate:** Confirm `pay.ot_base_components` with payroll — SC requires Basic + compensatory allowances, not Basic alone.

---

## 11. Three payslip types (hard requirement — 09-RECON §2)

| Type | Contents | When |
|---|---|---|
| **Regular** | Fixed monthly earnings + statutory deductions + LOP + leave balance footer | Every month |
| **Reimbursement** | Approved claims only (CLM-04); taxability per claim type | On payout batch |
| **Overtime** | OT hours × rate; Factories Act base | When OT approved for month |

All three share PAY-06 header block (PAN, UAN, PF No, bank, work days).

---

## 12. Seed data — `pay.statutory_rates` (FY 2025-26)

```sql
-- PF / EPS / EDLI / admin
('pf',     'ee_rate',           0.12,    '2025-04-01', 'EPF Act — unchanged FY25-26')
('pf',     'er_rate',           0.12,    '2025-04-01', 'EPF Act')
('eps',    'rate',              0.0833,  '2025-04-01', 'EPS')
('eps',    'wage_ceiling',      15000,   '2025-04-01', 'S.O. 2702(E) May 2026')
('edli',   'rate',              0.005,   '2025-04-01', 'EDLI')
('edli',   'wage_ceiling',      15000,   '2025-04-01', 'EDLI cap')
('pf_admin','rate',             0.005,   '2025-04-01', 'Admin charges')
('pf_admin','min_monthly',      500,     '2025-04-01', 'Per establishment')

-- ESIC
('esic_ee','rate',              0.0075,  '2019-07-01', 'Unchanged since Jul 2019')
('esic_er','rate',              0.0325,  '2019-07-01', 'Unchanged since Jul 2019')
('esic',   'wage_ceiling',      21000,   '2019-07-01', 'Contribution period eligibility')

-- LWF WB
('lwf_wb_ee','amount',          3,       '2024-01-01', 'WB LWF employee half-yearly')
('lwf_wb_er','amount',          30,      '2024-01-01', 'WB LWF employer half-yearly (revised Jan 2024)')

-- Bonus / Gratuity
('bonus',  'min_rate',          0.0833,  '1965-01-01', 'Payment of Bonus Act')
('bonus',  'max_rate',          0.20,    '1965-01-01', 'Payment of Bonus Act')
('bonus',  'eligibility_ceiling',21000,  '1965-01-01', 'Basic+DA ceiling')
('bonus',  'calc_ceiling',      7000,    '1965-01-01', 'Or state min wage if higher')
('gratuity','cap',              2000000, '2018-03-29', 'Payment of Gratuity Act amendment')
```

---

## 13. Golden-test fixtures (04-MODULE-SPECS §6.9)

Every fixture asserts **to-the-rupee** outputs. Store as JSON under `backend/tests/fixtures/payroll/golden/`.

### G1 — RML staff baseline (live greytHR parity)

| Field | Value |
|---|---|
| Basic | ₹32,286 |
| HRA | ₹16,143 (50%) |
| Medical | ₹1,250 |
| Special | ₹12,005 |
| Education | ₹200 |
| Bonus | ₹2,689 (8.33% × Basic) |
| **Gross** | **₹64,573** |
| PF EE (`ACTUAL` base) | **₹3,874** |
| PT (WB) | **₹200** |
| Guest house recovery | ₹2,500 |
| **Net (excl. TDS)** | **₹57,999** |
| ESIC | ₹0 (above ceiling) |

### G2 — PF ceiling crosser (`CEILING_15000` mode)

Basic ₹22,000 → EE PF = **₹1,800** (12% × 15,000); ER EPS = ₹1,250; ER EPF = ₹1,390.

### G3 — ESIC boundary

| Case | Gross at period start | ESIC for period |
|---|---|---|
| G3a | ₹20,999 | EE + ER applicable all 6 months |
| G3b | ₹21,001 | Not applicable |
| G3c | Joins at ₹20,500; revision to ₹25,000 in month 2 | **Stays in** until period end |

### G4 — WB PT slabs

| Gross | PT |
|---|---|
| ₹9,999 | ₹0 |
| ₹12,000 | ₹110 |
| ₹20,000 | ₹130 |
| ₹35,000 | ₹150 |
| ₹45,000 | ₹200 |

### G5 — TDS new regime (FY 2025-26)

| Annual taxable (after ₹75k SD) | Expected tax (incl. 87A) |
|---|---|
| ₹7,00,000 | ₹0 (below ₹12L rebate band) |
| ₹12,00,000 | ₹0 (87A full rebate) |
| ₹12,50,000 | Marginal relief applies — assert ≤ ₹50,000 |
| ₹18,00,000 | Slab calc + cess — golden value from spreadsheet |

### G6 — Probation 80%

CTC ₹10L → probation gross = 80% of confirmed component amounts; PF/PT from day 1.

### G7 — Mid-month join (15th)

Calendar LOP: payable_days = 17/31; all `prorate_on_lop` components scaled.

### G8 — F&F with gratuity

Basic ₹32,286, DA ₹0, service 8y 7m → years = 9 (≥6mo fraction rounds up):

```
gratuity = 32,286 × 15/26 × 9 = ₹1,67,638.85 → ₹1,67,639
```

> *Corrected 6 Jul 2026: this fixture originally printed ₹1,67,007.69 — an arithmetic slip (32,286 × 15 × 9 = 43,58,610; ÷ 26 = 1,67,638.846). Caught by the Money-module golden test (backend/tests/money.test.ts) — the test-first discipline working as designed.*

Plus EL encashment, notice recovery, partial-month pay.

### G9 — Apprentice

Stipend ₹15,000 → PF ₹0, ESIC ₹0, bonus ₹0; PT per slab if applicable.

### G10 — OT payslip (Factories Act)

Basic ₹20,000, DA ₹5,000, OT base allowances ₹3,000 → hourly = 28,000/208 = **₹134.62**; 4 hrs OT @ 2× = **₹1,076.92** → round per policy.

---

## 14. Compute vs filing checklist

| Component | Monthly compute | Periodic filing (HRMS generates file) |
|---|---|---|
| PF (EE/ER/EPS/EDLI/admin) | ✅ | ECR by 15th → EPFO portal |
| ESIC (0.75% / 3.25%) | ✅ | Challan by 15th; half-yearly return |
| WB PT | ✅ | Monthly PTRC remittance |
| WB LWF | Accrue half-yearly | Form D — 15 Jul / 15 Jan |
| TDS | ✅ | Form 24Q quarterly; Form 16 annual |
| Bonus accrual | ✅ (monthly advance + year-end) | Forms A–D |
| Gratuity | On exit / provision | Form F/J/K |
| Bank transfer | ✅ | Finance uploads to bank |
| JV / GL | ✅ | Finance → SAP |

---

## 15. Open policy decisions (Phase 0 — chase payroll admin)

From 09-RECON §8 + this research. **Do not code statutory logic until signed off.**

| # | Decision | Owner | Blocks |
|---|---|---|---|
| 1 | PF on full basic vs ₹15k ceiling (+ EPF Scheme 2026) | Payroll / HR Head | PF engine, ECR |
| 2 | Monthly bonus advance + year-end true-up rules | Finance | Bonus component |
| 3 | LOP divisor (calendar / 30 / working days) | Payroll | All proration |
| 4 | OT ordinary-rate components | Payroll + HR | OT payslip |
| 5 | DA/VDA for works grades + CPI revision | HR Ops | WORKS_UNION template |
| 6 | Penalty days → payroll impact | HR Ops | Attendance → pay |
| 7 | Gratuity eligibility: strict 5y vs 4y240d | HR Head / Legal | F&F |
| 8 | Grade-wise salary structures (all categories) | Payroll admin | Structure seed |
| 9 | Bank file + JV + ECR sample formats | Finance | Output generators |

---

## 16. Cross-references

| Topic | Primary doc |
|---|---|
| Requirement IDs PAY-* | 01-REQUIREMENTS-PRD §6 |
| Table definitions | 03-DATABASE-SCHEMA §6 |
| Calculation order + pipeline | 04-MODULE-SPECS §3 |
| Live RML config | 09-GREYTHR-RECON-FINDINGS.md |
| Reports R7–R20, R15 | 06-REPORTS-AND-DASHBOARDS.md |
| Phase 2 gate + parallel run | 07-ROADMAP §Phase 2 |
| Payroll role permissions | 08-ROLES-AND-PERMISSIONS §2 |

---

## 17. Change log

| Date | Change |
|---|---|
| 3 Jul 2026 | Initial document from statutory research + greytHR recon cross-check |
| 6 Jul 2026 | **G8 gratuity fixture corrected** (₹1,67,007.69 → ₹1,67,638.85/₹1,67,639) — arithmetic slip caught by the Money-module test suite |

**Review trigger:** Union Budget each February; EPFO/ESIC notifications; WB PT/LWF amendments; RML policy sign-off on §15 items.
