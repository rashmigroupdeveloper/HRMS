# Phase 4 — ATS integration (ATS stays a separate product)

**Status:** scope CHANGED 3 Sep 2026 by sponsor direction. **Supersedes `phase-4-ats-absorption.md`.**
**Gate:** G4 · **Depends on:** G3 (lifecycle — onboarding is where a hire lands)

> **The decision.** The in-house ATS (`interview_scheduling` — React + Vite frontend, Node backend,
> its own migrations and Postgres) **remains a separate product**. It is not absorbed, its schema is
> not migrated into `hrms`, and it is not retired. HRMS integrates with it.
>
> This retracts the docs/07 end-state sentence *"the standalone ATS is retired"* and cancels former
> Phase 4A/4B entirely. What replaces them is below.

---

## Why this is the right call, and what it costs

**What it buys.** The ATS already works and is in use by recruiters. Absorbing it means re-testing a
working hiring pipeline for no functional gain, and its natural users (recruiters) are not the same
population as HRMS's (HR ops, payroll, managers, the frontline).

**What it costs — and these are the pieces Phase 4 has to buy back:**

1. **The employee master must still be born in one place.** A hire that exists in the ATS and is
   typed again into HRMS is the classic two-systems failure — a mismatched name, a wrong DOJ, a
   missing e-code. The handoff has to be a machine contract, not a person re-keying.
2. **The offer approval chain is now split.** docs/08 §4 lists Offer/LOI (Initiator → Plant Head/GM →
   HR Head → CEO) as an HRMS workflow, and PP-20 records the offer-approval process as a live pain
   point. **It cannot live in both systems.** See the open decision below.
3. **R21 Offer / R22 Recruitment reports read foreign data.** They stay cross-system reads, which
   means they inherit the ATS's availability and its definition of "offer".
4. **Candidate personal data is DPDP-relevant and sits outside our `prv` schema.** Notice, consent,
   retention and erasure obligations do not stop at a system boundary — a rights request covering a
   candidate has to reach the ATS too.

---

## Stage 4.1 — Hire handoff   `[ ☐ ]`
**Goal:** a candidate marked joined in the ATS becomes an HRMS pre-joiner exactly once, with no re-keying.
**Requirement IDs:** `ATS-01..04`

- [ ] `P4-T01` **ATS-01 handoff contract.** A versioned payload (candidate identity, offered grade/
      designation, company + plant + cost centre + MIS code, DOJ, offered CTC reference, offer
      document id). Defined as a zod schema in HRMS and published — the ATS conforms to it, not the
      reverse, because HRMS owns the employee master.
- [ ] `P4-T02` **ATS-02 idempotent intake.** Delivery is at-least-once (webhook or poll), so intake
      is keyed on the ATS candidate id: a replayed hire updates the pre-joiner, never creates a
      second one. This is the single highest-risk mechanic in the phase.
- [ ] `P4-T03` **ATS-03 pre-joiner creation** feeding LC-01 (pre-joining link) and LC-02 (task
      fan-out). E-code allocation stays HRMS's (CORE-02) — the ATS never invents one.
- [ ] `P4-T04` **ATS-04 reconciliation report.** Hires in the ATS with no HRMS employee, and HRMS
      employees with no ATS origin, for a period. Without this the integration fails silently, which
      is how the greytHR/Kent 200-employee mismatch (PP-9) happened.

**Tests:** replay of the same hire produces one employee; a hire with an unknown plant/cost centre is
quarantined with a readable reason rather than half-created; reconciliation catches an injected gap.

## Stage 4.2 — Identity & access across two products   `[ ☐ ]`
**Goal:** one login, and an exit that closes both doors.
**Requirement IDs:** `ATS-05..07`

- [ ] `P4-T05` **ATS-05 SSO** — the ATS becomes a relying party of the same IdP as HRMS (Phase 5
      Stage 5.2b, SEC-08). Two separate password estates for the same people is the thing that makes
      an offboarding miss inevitable.
- [ ] `P4-T06` **ATS-06 deprovisioning on exit.** LC-07 already revokes HRMS sessions on exit day;
      it must also signal the ATS. A recruiter who left last month must not still hold a candidate
      database.
- [ ] `P4-T07` **ATS-07 service account** for the handoff, scoped to exactly the two procedures it
      needs (SEC-09 API keys).

## Stage 4.3 — Reporting & requisition   `[ ☐ ]`
**Goal:** the numbers reconcile, and hiring cannot outrun the sanctioned headcount.
**Requirement IDs:** `ATS-08..10`

- [ ] `P4-T08` **ATS-08 R21/R22** as cross-system reads with an explicit freshness stamp on screen.
      A report that silently shows yesterday's ATS data is worse than one that says so.
- [ ] `P4-T09` **ATS-09 manpower requisition stays in HRMS.** The budget check needs the position/
      establishment master, the org spine (company/plant/MIS/cost centre) and the approval chain —
      all HRMS-side. The ATS receives an *approved, funded* requisition; it does not create one.
      *(This is the one former Phase-7 REC-01/02 item that survives the split, and it survives
      because the data it validates against lives here.)*
- [ ] `P4-T10` **ATS-10 candidate data under DPDP.** The `prv` processing register records the ATS
      as a system holding candidate personal data; a rights request (PRV-04) fans out to it; the
      retention schedule covers candidates, not only employees.

---

## Decision — where does the offer/LOI approval chain live? **Recommendation: HRMS (Option B)**

Read-only survey of `~/Documents/interview_scheduling` on 3 Sep 2026. The ATS has **two** approval
mechanisms, and they are not equally built:

| | Vacancy approval | Offer approval |
|---|---|---|
| Shape | `vacancies.approval_chain` **JSONB** `[{role, approved, approver_id, approved_at}]` + `approval_current_step` + `is_custom_approval` | **Flat columns** on `offers`: `hr_approver_name/at`, `dept_head_approver_name/at`, `hr_head_approver_name/at`, `final_approver_name/at` |
| Configurable | Yes, per vacancy | **No — a fixed 4 stages.** A fifth approver is a migration |
| SLA / escalation | none | none |
| `notified_at` receipt | **none** | **none** |
| Send-back | not modelled | not modelled |

**Why that settles it.** PP-20 logs offer approval as a live pain point and docs/13 rule 8 makes
"prove the notification" non-negotiable — *the approver-never-notified bug must be impossible*.
Neither ATS chain records that a step was notified, and the offer chain cannot grow a stage without
a schema change. HRMS's `wf` engine already has per-step SLA, escalation on breach, delegation,
send-back and a `notified_at` receipt, and it is already carrying eighteen request types. The
approvers in this chain — Plant Head / GM, HR Head, CEO — are **HRMS roles on the HRMS reporting
tree**, not ATS users.

**The honest cost:** the ATS loses a feature that works today, and gains a round-trip. A defensible
alternative is to leave the chain in the ATS and build SLA + escalation + notification receipts
there — but that is rebuilding the engine we already hardened, in a second codebase, for one
workflow. Recommend against.

**If the sponsor picks Option A (ATS keeps it)** the minimum bar is: convert the offer chain to the
same JSONB shape as the vacancy chain, and add `notified_at` per step. Without those two, the
docs/13 rule-8 guarantee is simply not met anywhere in the group.

## 🔴 Blocker found — the ATS offer record cannot produce the handoff payload today

The `offers` model carries: `candidate_id`, `candidate_name`, `date_initiated`, `dept_head`,
`designated`, `expected_start_date`, `location_of_work`, `status`, approver fields.

It does **not** carry the org spine that Phase 2 Stage 2.0 has just made the universal filter
contract (ORG-01..05): **company code, plant, cost centre, MIS code**, nor grade/designation ids, nor
an offered CTC structure, nor an actual DOJ (only *expected* start date).

So `ATS-01` cannot be satisfied by reading the current record. One of:

- **(a)** the ATS adds those fields at offer creation — correct, because the recruiter knows the
  vacancy's plant and cost centre at that moment; or
- **(b)** HRMS resolves them at intake from the vacancy — only works if the vacancy carries them,
  which needs checking; or
- **(c)** HR completes them on the pre-joiner — re-keying, i.e. the failure this integration exists
  to prevent.

**Recommend (a).** Add to `P4-T01` before the handoff contract is frozen.

## Gate G4
- [ ] A real hire flows ATS → HRMS pre-joiner → onboarding with no re-keying, and a replay creates no duplicate
- [ ] Reconciliation report clean for a full month
- [ ] One login across both products; an exit closes both
- [ ] R21/R22 reconcile against the ATS, with freshness visible
- [ ] The offer-chain decision is recorded in docs/00 as a locked decision
- [ ] The ATS offer record carries company / plant / cost centre / MIS code, so the handoff needs no re-keying
