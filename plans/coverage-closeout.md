# Coverage close-out — holes folded into Phases 1–8

**Status:** proposed · **Source:** the 2 Sep 2026 review of Phases 5–8 vs docs 15/16, plus sponsor ask to own payroll completeness, shift micro-controls, scheduling, foreign entities, org/MIS slicing, and smart features.
**Rule:** this file is the *catalog*. Each item is executed in the host phase file (task IDs below). Tick here when the host stage absorbs it.

> **D3 is not silently overridden.** Foreign-entity *India-statutory* payroll stays out. What this file adds is **D14 (proposed):** foreign entities stay in the master and get **local payroll / WPS / attendance / MIS**, not PF/ESIC/TDS. Sponsor must sign D14 before Stage 2.8 starts.
>
> **Promote** new prefixes into `docs/01` at the start of the host phase: `ORG-`, `SHF-`, `FGN-`, `ESS-`, `ENG-`, `NAP-`, plus `SEC-15` (SCIM) and `PAY-18..24`.

---

## 0. Map — every hole → a stage

| Hole | Feature / tool | Host stage | Task IDs |
|---|---|---|---|
| Org slice | Company code, plant code, MIS code, department hierarchy; every report/payroll/muster filterable company × plant × MIS × dept × cost centre | **2.0** | ORG-01..08 |
| Payroll depth | Salary hold, off-cycle, multi-bank, SAP JV, regime lock, Form 16, perquisites, variance, input freeze, loan life-cycle, MIS-wise registers | **2.7** | PAY-18..24, E12–E20 |
| Foreign entity | UAE WPS, TZ/UK/BH local pay, FX, local calendar — **not** India statutory | **2.8** (needs **D14**) | FGN-01..08 |
| Shift micro | Per-shift grace/break/OT/late slabs/allowance/split/overlap block | **1.11** | SHF-01..08 |
| Scheduling | Cyclic templates, publish, coverage, auto-fill, shift bid, fatigue at save | **1.11** + **6.8** | SHF-09..15, FAT-01 |
| SCIM | IdP provision / de-provision on join and exit | **5.2b** | SEC-15 |
| Forgot password | Self-service reset on verified channel | **5.8** | ESS-01 |
| Profile-change request | Employee proposes, HR approves, effective-dated | **5.8** | ESS-02 |
| Custom fields | Extensible master attributes, no migration | **5.8** | ESS-03 |
| ID / badge print | Photo ID from master, tied to gate pass | **6.8** | FAC-15 |
| Fatigue rules | Max nights, min rest, no double shift — **hard block at roster** | **6.8** | FAT-01 |
| NAPS / NATS | Apprentice register, stipend, completion, returns | **6.8** | NAP-01..04 |
| Retirement pipeline | 60/90-day runway, superannuation, clearance | **7.7** | LC-08 |
| Workforce scenarios | Headcount + manpower-cost what-if | **7.6** | REC-13 |
| R&R | Spot award, kudos, nomination, payroll payout | **7.8** | ENG-01 |
| eNPS + pulse | Recurring pulse, driver heatmap, action plans | **7.8** | ENG-02 |
| Birthdays / anniversaries | Home feed | **7.8** | ENG-03 |
| Wellness / EAP | Confidential counselling referral | **7.8** | ENG-04 |
| Education / experience | Structured profile history | **7.8** | ENG-05 |
| Chain preview | “Who will approve this?” before submit | **1.11** (WF) | SHF-16 |
| In-app notification centre | Bell + unread, not only push | **8.2** | FRT-15 |
| Auto-rostering | Demand → suggested roster, human confirms | **8.4** | FRT-17 |
| Feature flags + branding | Per-entity rollout + letterhead/payslip chrome | **8.7** | PLT-13..15 |
| Smart features | Roster conflict, leave clash, OT-cost, MIS copilot, local-language assistant | **8.6** | AIX-08..14 |

Deliberate **X** (do not build; already recorded or hereby recorded): SCORM LMS · forced bell-curve · AI writing money/statutory/disciplinary fields · Teams/Slack (WhatsApp is the channel) · policy quiz · suggestion box.

---

## Tracking

- [x] 2.0 Org & MIS spine absorbed into `phase-2-payroll-statutory.md`
- [x] 2.7 Payroll completeness absorbed
- [x] 2.8 Foreign entity absorbed (blocked on D14)
- [x] 1.11 Shift micro + scheduling absorbed into `phase-1-attendance-leave-workflows.md`
- [x] 5.2b SCIM + 5.8 ESS daily absorbed
- [x] 6.8 Fatigue + NAPS + ID card absorbed
- [x] 7.6 scenario + 7.7 retirement + 7.8 engagement absorbed
- [x] 8.2 bell + 8.4 auto-roster + 8.6 smart + 8.7 flags absorbed
- [x] Prefixes listed in `extended-roadmap.md` §1
