# HRMS data dictionary

Prepared 11 Nov 2026 · CORE-08 / NFR-04 · Phase 0, Stage 0.2 documentation deliverable.

Every observed database field has a definition: **1843 fields across 165 logical tables and views**. This includes 1840 application fields and three migration-bookkeeping fields. All current application type fields match the captured database. Physical child partitions inherit the parent definitions and are not repeated; PostgreSQL catalogs and the pg-boss vendor schema are excluded.

For nontechnical readers, start with [HRMS explained for everyone](plain-language/README.md). Every field includes an everyday explanation, why it is kept and an illustrative example. The same columns appear first in the CSV.

Start with the module files below, or open [all fields as CSV](all-fields.csv) in Excel and filter by field name. [Structured JSON](all-fields.json) preserves constraints and allowed-value sources; [coverage evidence](coverage.json) records counts and source hashes.

| Database schema | Tables/views | Defined fields |
|---|---|---|
| [ast](ast.md) | 3 | 36 |
| [att](att.md) | 24 | 245 |
| [cmp](cmp.md) | 3 | 38 |
| [core](core.md) | 43 | 589 |
| [doc](doc.md) | 1 | 11 |
| [eng](eng.md) | 5 | 46 |
| [hd](hd.md) | 3 | 36 |
| [ird](ird.md) | 6 | 41 |
| [lv](lv.md) | 5 | 54 |
| [med](med.md) | 2 | 22 |
| [pay](pay.md) | 30 | 340 |
| [prv](prv.md) | 14 | 104 |
| [public](public.md) | 1 | 3 |
| [reporting](reporting.md) | 2 | 36 |
| [sec](sec.md) | 7 | 62 |
| [te](te.md) | 10 | 126 |
| [wf](wf.md) | 6 | 54 |

## Reading an entry

Each field defines its business meaning, SQL type, whether NULL is permitted, database default, code declaration/source, available value meanings, full column-linked constraints and applicable units. Each table also lists indexes and triggers. A foreign key identifies the referenced authority; it does not prove that application access is authorized. NULL is distinct from zero, false, blank text and an empty JSON collection. Database required status does not necessarily mean an end user types the value: generated IDs and defaults are filled by the system.

Database CHECK value lists and TypeScript literal unions are labelled separately. Code declarations alone do not prove a database restriction. Other conditional CHECK literals are retained verbatim rather than misrepresented as unconditional allowed entries. Dynamic catalog IDs, configurable codes, free text and JSON maps do not have fabricated exhaustive lists. JSON declaration shapes are retained verbatim; event-specific payload schemas and runtime validators remain in their owning modules. This dictionary covers persisted database columns, not every HTTP DTO or arbitrary nested JSON key.

## Units, identity and sensitive values

- Monetary NUMERIC amounts use exact decimals. Fields ending `_paise` store integer paise; 100 paise equals INR 1. Rates, percentages, counts and durations are not money just because their SQL type is numeric. Scheme/parameter values require their named policy's units.
- DATE is a calendar date; timestamps with time zone represent instants and are presented in IST. A month field represents a payroll/report period rather than an arbitrary event date. Attendance cycle boundaries depend on configured policy.
- Employee `id`, display `ecode`, candidate ID, external ATS offer ID and login user ID are separate identities. Candidates remain separate until actual joining is confirmed. Relationships are documented without conflating those identities.
- This export reads catalog metadata only. It contains no employee records, bank details, statutory identifiers, health answers, secret values or credentials. Those field definitions do not authorize unrestricted viewing/export; role permissions and population scope still apply.

## Authority and lifecycle decisions

[Database specification](../03-DATABASE-SCHEMA.md) and [module specification](../04-MODULE-SPECS.md) govern intended behavior. Current catalog metadata governs the captured physical types/defaults/constraints. Definition bases distinguish explicit current comments from prior authored semantic explanations and the dictionary supplement. Historical semantic explanations were carried forward as documentation sources, not as proof that an old implementation gap still exists.

- Reimbursements are independent of salary payment. `pay.claims.reimbursement_batch_id` and reimbursement batch/items are current payment destinations; older payroll/bank links and `pay.inputs.claim_id` are retained for historical reconciliation. Do not infer repayment/backfill from old links.
- Leave, wallet and financial ledger balances must reconcile to immutable movements. A stored balance/cache is not independent proof of the ledger total.
- Attendance sessions preserve actual presence/absence. Separate penalty findings do not invent payable-day reductions. An empty evaluation array and NULL historical evaluation have different meanings.
- MFA tables are documented because they exist, but MFA remains outside current approved scope. Presence in this dictionary does not enable the feature.
- Statutory parameters describe stored configuration, not independently verified current legal rates. This documentation changes no policy value or payroll calculation.

## Snapshot and maintenance

The schema was read from the configured local HRMS database in a repeatable-read, read-only transaction at **2026-11-11T04:50:11.132Z**. No migrations or business writes were executed. This does not certify production parity, UAT acceptance or implementation completion.

To regenerate from the repository root:

```sh
cd backend
node scripts/run-local-check.mjs --import tsx scripts/export-data-dictionary-catalog.ts
node ../docs/data-dictionary/tools/index-types.mjs
cd ..
python3 docs/data-dictionary/tools/build.py
```

The existing local runner rejects non-loopback/non-HRMS targets. Regeneration fails when a new field lacks a definition or a typed field is missing in the database. Edit the scoped definitions in `tools/definitions.txt` when a meaning changes. Re-check new enum codes and structured payloads against the owning specification/service before publication. The generator verifies the type index against its source and output fingerprints before publishing; regenerate the index after changing declarations. The source hashes in coverage.json record the verified declaration snapshot.
