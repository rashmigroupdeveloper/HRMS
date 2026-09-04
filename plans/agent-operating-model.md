# Agent operating model

This is the **squad runbook**. Phase specs stay in `plans/phase-*.md`. This file is how agents execute a stage without inventing process.

**This session override (3 Sep 2026, sponsor via chat):** work every remaining `plans/` stage in parallel; the one-stage-at-a-time wave is lifted for implementation. Still do **not** invent PF/ESIC/TDS rates, Finance MIS codes, IdP URLs, or Kent protocol. `wages.basic_da_min_pct` default 50 is the Code floor from Stage 5.1's own spec.

---

**Design law:** `docs/05` + `docs/12` win. Compose from `frontend/src/ui`. No MUI, no hardcoded hex, no new nav pills. Policy numbers live in `core.settings`. Every mutation calls `writeAudit()`. Every business procedure declares **one** permission code.

---

## 1. Squad (launch in one message)

| Role | Subagent | Owns | Done when |
|---|---|---|---|
| **Lead** | parent session | Announce stage; write the brief; merge; tick `plans/`; stop | Stage checkboxes ticked; report posted |
| **Schema** | `generalPurpose` then `database-reviewer` | Migration (`SET lock_timeout = '5s'`), `core/db/types.ts` same commit, CHECKs, append-only triggers | Reviewer green |
| **TDD backend** | `tdd-guide` then implementer | Tests **first**; oRPC `.input()` + `.output()`; one permission; `writeAudit()`; settings for policy | `npm run verify` in `backend/` |
| **UI** | implementer bound to 05/12 | Pages from `ui/*` only; both themes; axe; never fake data | `npm run verify` in `frontend/` + browser path |
| **Logging** | same backend agent | Hash-chained audit; purpose-stamped sensitive reads; `notified_at` NOT NULL; pino redaction; **no `console.log`** | Integration test proves the receipt |
| **Security** | `security-reviewer` | After first green: injection, masking, step-up, POSH isolation | Findings fixed or recorded |
| **TS review** | `typescript-reviewer` | After UI + API | No `any`; max-strict |
| **E2E** | `e2e-runner` | One Playwright journey per stage | Journey listed in the PR |
| **Docs** | `doc-updater` | Tick the host stage in the **same PR** | Checkbox matches merged code |

Hard split: frontend never imports backend source. Contract = OpenAPI / oRPC only.

Money stages (2.1–2.7, 5.1 wage check): golden fixtures **hand-computed first**; human review mandatory on `payroll-core/`.

---

## 2. Stage factory (copy into every agent prompt)

1. Read `docs/00`, the host `plans/phase-*.md` stage, `plans/coverage-closeout.md` if the task is listed there, `docs/05`+`12` for UI, `docs/03` for schema. Payroll: `docs/04` + `docs/10` in full.
2. Cite requirement IDs in the PR title (`feat: ORG-05 …`).
3. Backend: `modules/<x>/{router,service,repository}.ts`; register in `backend/src/api/router.ts`. Public API only via `modules/<x>/index.ts`.
4. Tests: unit + integration (`fileParallelism: false` if audit chain); 80% floor; payroll-core 100% branch.
5. `npm run verify` green in the project touched.
6. Browser: exercise the daily path (not a screenshot-only).
7. Tick the plan checkbox in the same PR. Do not mark a Gate passed without its criteria.

### UX gate (frontend agent checklist)

- Warm Editorial only; reject any new primitive invented in a page
- Tokens / `color-mix` only; screenshot both themes
- One gold accent + at most one `DarkCard` hero per screen
- 7 interactive states; contrast ≥ 4.5:1 both themes; colour never the only signal
- Motion: `transform`/`opacity` only; reduced-motion gentler, not zero
- ≤ 2 clicks for daily actions; state preservation; autosave; skeleton; error recovery
- Never fake data — pending panels name the phase + task
- Signature moment: exactly one per surface, called out in the PR
- No new pill; ESS additions = More + home card when it matters
- A blocked action names the **rule**, the fail, and who can override

### Logging gate (backend agent checklist)

- Every mutation: `writeAudit()` with before/after, actor, org scope
- Sensitive reads: `sec.access_events` + purpose
- Workflow steps: `notified_at` NOT NULL (the receipt is structural)
- Statutory IDs never in logs or audit `new_value`
- Users with audit history: deactivate + detach, never hard-delete

---

## 3. Wave 0 — human blockers (no money / wage-definition code until signed)

Read from `plans/phase-0-foundations.md` Stage 0.1. Status as of 3 Sep 2026:

| ID | What | Blocks | Status |
|---|---|---|---|
| **P0-T01** | Kent/Astra access method (DB view / REST / SFTP-CSV) | Real attendance vs mock; G1 Kent day | **Open — IT** |
| **P0-T02** | greytHR admin recon (structures, FPR, bank file, statutory formats, master) | Real master enrich; payroll golden from live | **Open — HR/IT** |
| **P0-T03** | Bank bulk-upload format from Finance | Stage 2.4 bank file | **Open — Finance** |
| **P0-T04** | Payslip template sign-off | Stage 2.4 | **Open — sponsor** |
| **P0-T05** | Per-entity headcount (1,066 EMS vs ~3k) | Capacity / G0 | **Part-answered** |
| **P0-T06** | Nine statutory decisions (10 §15) + 2026 Labour Codes (F&F TAT, wages ≥50% CTC) | **Stage 5.1 arithmetic, all of Phase 2 money** | **Unsigned — stop** |
| **P0-T08** | Entity-scope (which India entities payroll; RPL name; foreign master-only) | 2.0 / 2.8 | **Open — HR** |
| **P0-T09** | Sanctioned EMS users snapshot + freeze date | Real 1,066 load | **Taxonomy done; snapshot pending IT** |
| **P0-T11/T13** | Staging vhost, PgBouncer, OTel, GlitchTip | G0 deploy | **Server access** |

**Proposed sponsor decisions D8–D14** (docs/15 §9.3 + coverage-closeout). Agents must not invent these:

| D | Topic | Effect if unsigned |
|---|---|---|
| D8 | Contract labour in-scope? | Phase 6.1–6.3 stays proposed |
| D9 | POSH IC process owner | Stage 5.5 |
| D10 | Performance / forced ranking | Stage 7.1–7.2 |
| D11 | Training / LMS depth (SCORM stays X) | Stage 7.3 |
| D12 | Frontline app vs PWA-only | Phase 8.1 |
| D13 | Plant ops (canteen/transport/EHS) | Phase 6.4–6.7 |
| **D14** | Foreign local/WPS payroll (not India statutory) | **Stage 2.8** — not a G2 gate |

**Agent-doable without those signatures:** Stage 1.11 (this wave), remaining 5.2b only when an IdP exists, P0-T13 observability if server access exists.

**Hard stop:** do **not** write wage-definition, PF/ESIC/TDS rates, LOP divisor, OT money base, or payroll-core until P0-T06 is signed into `core.settings` seed notes.

---

## 4. Wave map (execute in this order)

```
Wave 1  Stage 1.11 (SHF)  →  G1 UAT (human)
Wave 2  5.1 → 5.3 → 5.4   →  G5a          [5.1 blocked on P0-T06]
Wave 3  2.0 then 2.1–2.7  →  G2           [2.8 after D14, not a G2 gate]
Wave 4  Phase 3 remaining + 3.5 + amendments C/D
Wave 5  5.5–5.8 + G5b     (5.2b when IdP exists)
Wave 6  Phase 6           (needs G2 + G5b)
Wave 7  Phase 7           (needs G3 + G5a)
Wave 8  Phase 8           (needs G6)
```

Phase 4 ATS: keep the documented split (HRMS owns MRF/offer/BGV; ATS keeps sourcing) until D-ATS is signed.

---

## 5. Playbooks for later waves (launch only after the prior gate)

Copy the stage factory. Then add the stage-specific brief below. **Do not start these in the same session that just closed another stage.**

### Wave 2 — G5a (5.1 → 5.3 → 5.4)

**Launch only after G1 UAT residue is owned and P0-T06 is signed into seed notes.** This playbook is ready; **do not write wage-definition or payroll-core in the same session as Stage 1.11.**

Host: `plans/phase-5-compliance-and-trust.md`. Squad: schema (`cmp` / `prv` / vault) · TDD backend · UI (`/compliance` hub, More menu only) · logging · security (masking) · TS review.

| Stage | Announce as | Blocked on | First tests |
|---|---|---|---|
| **5.1** Labour Codes CMP-01..07 | Stage 5.1 — Labour Codes wage definition | **P0-T06 unsigned → stop** | Hand-compute 6 RML goldens (2 must fail) *before* `assertWageDefinition`. Replace 1.11 OT-cap defaults with signed Code values + named override permission. |
| **5.3** DPDP PRV-01..12 | Stage 5.3 — DPDP notice, consent, rights | 5.1 (order) | Rights queue + retention jobs; purpose-stamped reads already exist (5.2a). `/my/privacy` already hosts access history. |
| **5.4** Vault + e-sign + sandbox | Stage 5.4 — vault, e-sign, sandbox masking | 5.3 | Sandbox masking tests *are* the product: a payroll rehearsal must not leak PAN/Aadhaar/bank. Config promotion audited. Interface, not a vendor. |

**5.2a is shipped.** 5.2b (SSO/SCIM/IP/break-glass) waits on a real IdP URL — do not invent one.

### Wave 3 — Phase 2 payroll

**Launch only after G5a.** Host: `plans/phase-2-payroll-statutory.md` + `docs/04` + `docs/10` in full. Human review mandatory on `payroll-core/`.

| Stage | Announce as | Notes |
|---|---|---|
| **2.0** ORG/MIS spine | Stage 2.0 — company / plant / MIS filter contract | Shared predicate on every list: `companyCode[]`, `plantCode[]`, `misCode[]`, `departmentId[]`, `costCenterCode[]`. Cost centre ≠ plant. EMS “MIS” department ≠ MIS code. Finance list is human-owned — **do not invent codes**. |
| **2.1–2.6** | one stage at a time as written | Golden fixtures hand-computed first. Chunked compute. `pay.inputs` only for later recoveries. Two-person finalize. |
| **2.7** completeness | Stage 2.7 — holds, off-cycle, multi-bank, Form 16 | PAY-18..24. |
| **2.8** foreign | Stage 2.8 — local/WPS | **D14 only.** Not a G2 gate. |

### Wave 4 — Lifecycle / T&E

**Launch after G2** (overlap with G5b allowed per the DAG). Hosts: `plans/phase-3-lifecycle-assets-executive.md`, `plans/phase-3.5-travel-expense.md`, `plans/amendments-existing-phases.md` C/D.

- Remaining Phase 3 tasks (16) + amendments C (KB, confidential tickets, CSAT, exit taxonomy seed).
- Phase 3.5 T&E rebuilt in Warm Editorial — **no MUI**. GST/OCR/mileage from amendments D.

### Wave 5 — G5b + 5.5–5.8

**Launch after 5.4.** Host: `plans/phase-5-compliance-and-trust.md`.

- 5.5 POSH/grievance — access-negative suite *is* the product (D9 for IC owner).
- 5.6 registers Form 12/15/22.
- 5.7 licences/calendar (partially present).
- **5.8** forgot-password / profile-change / custom fields.
- 5.2b SCIM when IdP exists.

### Waves 6–8

Copy the stage factory. **Do not start in the session that closed the previous wave.**

| Wave | Needs | Host | First announce |
|---|---|---|---|
| 6 plant | G2 + G5b; D8/D13 | `phase-6-plant-operations.md` | Stage 6.1 — then 6.8 FAT-01/NAPS/ID card. Gate console chrome-free. |
| 7 talent | G3 + G5a; D10/D11 | `phase-7-talent-and-growth.md` | Stage 7.1 — include REC-13, LC-08, ENG-01..05 in 7.6–7.8. |
| 8 frontline | G6; D12 | `phase-8-frontline-and-intelligence.md` | Stage 8.1 native/offline — AI governance *then* anomalies. |

Phase 4 ATS: keep the documented split (HRMS owns MRF/offer/BGV; ATS keeps sourcing) until D-ATS is signed.

---

## 6. Issue clearance (stage exit)

Stage exit = host exit criteria + `verify` green in every project touched + one Playwright journey + axe on new pages + plan checkbox ticked.

Do not mark G1, G5a, G2, G3, G5b, G6, G7, G8 passed without the gate's own criteria.
