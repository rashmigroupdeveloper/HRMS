# Wave-0 recovery checkpoint —19 October 2026

**Verdict: keep `remediation/wave-0`; no deployment-ready claim.** Reviewed source tip `940e23f2051f371e2e16bc394d500d2d444a9fc2` remains unchanged. Sponsor approved implemented branch features as added scope, then excluded MFA. Claims/reimbursement/budget work remains deferred. No bulk merge/cherry-pick or branch deletion was performed.

## Implemented repairs

- Enable exactly one production worker; evaluate week-close/roster reminder cron in IST. No PM2 deployment proof yet.
- Scope HR letter list/content independently of wider directory permission; ESS issued letters only.
- Persist notification receipts per message; concurrent drains skip locked/sent rows; production missing SMTP fails delivery, and email content is escaped. An SMTP-accepted message followed by its own DB commit failure remains an ambiguous external outcome.
- Remove the tracked design token file and ignore its runtime directory. This does not prove credential invalidation or remove Git-history exposure.
- SEC-04 password re-entry protects runtime role/permission changes using the existing live session. No MFA implementation is enabled.
- Repair verification findings in role/HOD insertion, canonical gender, settings seed, workflow lock order, holiday uniqueness/atomic recompute and rollback-only test isolation. Preserve concurrent travel/migration edits.

## Phase5 Stage5.4 — recovered document core

The active catalog and employee file registry now serve ESS and scoped HR routes and screens. Existing columns carry ownership, private storage key, filename/MIME/size, SHA256, expiry, status and provenance; no parallel employee-document table or spare business fields were added. The permission migration adds only permission/default-grant rows.

Uploads validate canonical base64, configured size, MIME magic and expiry. Expiring types require the date on the server. Employee locking serializes identical content/type/expiry retries so a retry returns the existing document ID without another object. New registry rows and audit share the DB transaction. Private object writes are external: rollback may leave an orphan object; there is no false storage-ACID guarantee.

Reads recheck current document ownership/status under a document lock, after locking the employee in the same order as uploads/lifecycle. HR population scope and configured identity-field permission both apply. Non-owner catalog filenames are redacted. A content download requires a purpose, writes audit before response and sets private/no-store. Runtime permission revocation and out-of-scope attempts have native HTTP regressions. Expiry calculations use IST calendar days.

The UI preserves failed upload drafts, clears selected files when changing employee, supports employee-code/expiry filtering, bounded pagination and purpose-stamped downloads. Page, upload and file list are separate small components. Six component tests include upload retry, wrong-person draft reset and axe in both themes. No browser/UAT proof is claimed; the browser inventory had no active authenticated tab.

**Full Stage5.4 acceptance stays open:** real SeaweedFS/S3, AV, version lifecycle, watermarking, coverage/bulk requests/reminder delivery, e-sign/certificates/statutory forms, sandbox masking/config promotion and UAT. These were also incomplete or stubs in the source. Expiry classification does not itself deliver reminders or block an employee.

## Evidence and limitations

Read `plans/wave-0-recovery.md` for the final gate results and log paths. Frontend full verification after the component split passed331 tests/43 files plus static/build gates. Final backend full verification **after** lock/expiry hardening passed881 tests/121 files plus typecheck/lint/knip/dependency-cruiser/build, with lines86.8%, branches81.84%, functions90.75%. No global coverage floor was lowered.

Full React Doctor remains red on pre-existing issues (142 findings including a render-time ref mutation in OT decisions). Large/complex vault component findings were resolved by decomposition. Its remaining loading-state finding is a false positive: cleanup is inside `finally` and intentionally guarded against unmount. No diagnostic was suppressed and no app-wide clean UI claim is made.

## Branch retirement

`retirement-comparison.json` records337 changed paths with source/working blob IDs and no contents:30 byte-equal/same-absence,183 different,124 source-only. These are **mechanical comparisons, not semantic acceptance counts**. Many source-only paths are tests, documentation, excluded MFA or implementations rebuilt under different filenames. Each unique useful delta still needs classification and proof. Scheduling, confidential cases and compliance cores have since been recovered in working files (see latest tracker); full acceptance and privacy remain open.

Recovery includes untracked files and uncommitted changes. Preserve this working tree and other editors' work; reviewed durable commits/archives are required before deleting the source branch. No .md was deleted. Real Kent raw data, production configuration, SMTP/storage delivery, target-PG16/fresh-clone/staging deployment, independent payroll acceptance and signed UAT remain outstanding external/release gates.


## Later scheduling/field checkpoint

See `outputs/schema-relevance-2026-10-19/REVIEW.md` for147 manual field reviews within the1,813-field inventory and explicit unresolved consumers. Separate penalty snapshots preserve P/A, policy boundaries and history; no deduction formula is inferred. The shift editor preserves custom rules on unrelated saves. Swap approval rejects exited participants as well as stale/out-of-scope counterparts. The document vault now uses canonical doc_type with legacy kind fallback and separate statutory/medical/compensation authority. KPI snapshot queries group attendance once across companies; formulas were not changed. These later changes supersede the earlier vault-only counts and “no new fields” checkpoint, not the outstanding release gates.

Latest full gates: backend971 tests/132 files, frontend365 tests/51 files; static/build gates pass. Backend branches81.44%, lines86.28%. Exact evidence and limits are in `verification.json`; full acceptance remains open.
