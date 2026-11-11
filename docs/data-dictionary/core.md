# core — field dictionary

589 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## core.ats_acceptance_receipts

Keeps evidence that an offer was accepted in the recruitment system; this does not itself create an employee.

LC-01: immutable accepted-offer receipt; external subject is not a local user ID.

Relation kind: table.

### event_id

**In everyday language:** External protected against later changes event UUID used for replay identity.

**Why it is kept:** Keeps this record connected to the correct event, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: External immutable event UUID used for replay identity

| Property | Definition |
|---|---|
| SQL type | `uuid` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `event_id:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_pkey`: `PRIMARY KEY (event_id)`

### ats_offer_id

**In everyday language:** External accepted-offer identity, distinct from candidate/account ID.

**Why it is kept:** Keeps this record connected to the correct ats offer, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: External accepted-offer identity, distinct from candidate/account ID

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ats_offer_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_ats_offer_id_check`: `CHECK ((ats_offer_id > 0))`
- `ats_acceptance_receipts_ats_offer_id_key`: `UNIQUE (ats_offer_id)`

### candidate_id

**In everyday language:** Identifies the candidate connected to this record.

**Why it is kept:** Keeps this record connected to the correct candidate, so related details can be checked together.

**Example:** This record points to an existing entry in onboarding candidates instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s candidate id to FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `candidate_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id)`
- `ats_acceptance_receipts_candidate_id_key`: `UNIQUE (candidate_id)`

### source_digest

**In everyday language:** digital fingerprint of accepted offer copy saved at that point in time detecting changed retries.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The actual security value is omitted. The system compares it to check the correct credential or exact information.

Technical definition: Digest of accepted offer snapshot detecting changed retries

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `source_digest:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_source_digest_check`: `CHECK ((source_digest ~ '^[a-f0-9]{64}$'::text))`

### accepted_at

**In everyday language:** Candidate acceptance instant reported by ATS.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Candidate acceptance instant reported by ATS

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `accepted_at:Date;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_check`: `CHECK ((accepted_at <= received_at))`

### accepted_by_subject

**In everyday language:** External HR actor identifier; intentionally not HRMS user link to another record.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the accepted by subject shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: External HR actor identifier; intentionally not HRMS user FK

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `accepted_by_subject:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_accepted_by_subject_check`: `CHECK ((accepted_by_subject ~ '^[1-9][0-9]*$'::text))`

### evidence_ref

**In everyday language:** Acceptance evidence/reference supplied by ATS HR.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Acceptance evidence/reference supplied by ATS HR

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `evidence_ref:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_evidence_ref_check`: `CHECK (((length(btrim(evidence_ref)) >= 1) AND (length(btrim(evidence_ref)) <= 2000)))`

### received_at

**In everyday language:** HRMS receipt commit-time where the information came from.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: HRMS receipt commit-time provenance

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `received_at:Generated<Date>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ats_acceptance_receipts_check`: `CHECK ((accepted_at <= received_at))`

Table indexes and lifecycle triggers:

- Index `ats_acceptance_receipts_ats_offer_id_key`: `CREATE UNIQUE INDEX ats_acceptance_receipts_ats_offer_id_key ON core.ats_acceptance_receipts USING btree (ats_offer_id)`
- Index `ats_acceptance_receipts_candidate_id_key`: `CREATE UNIQUE INDEX ats_acceptance_receipts_candidate_id_key ON core.ats_acceptance_receipts USING btree (candidate_id)`
- Index `ats_acceptance_receipts_pkey`: `CREATE UNIQUE INDEX ats_acceptance_receipts_pkey ON core.ats_acceptance_receipts USING btree (event_id)`
- Trigger `ats_receipt_immutable` → `core.ats_receipt_immutable` (enabled flag `O`).

## core.audit_log

Keeps the history of important actions so authorized reviewers can trace who did what.

core.audit_log — append-only, hash-chained (CORE-11, doc 14 §7.4). INSERT only.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `audit_log_pkey`: `PRIMARY KEY (id)`

### actor_user_id

**In everyday language:** Identifies actor user connected to this record.

**Why it is kept:** Keeps this record connected to the correct actor user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s actor user id to FOREIGN KEY (actor_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `actor_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `audit_log_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### action

**In everyday language:** Operation category recorded in protected against later changes audit.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An event can record that a person viewed or changed something; the allowed action depends on this register.

Technical definition: Operation category recorded in immutable audit

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `action: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### entity

**In everyday language:** Audited table/domain name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A history entry can say that the action concerned an employee record rather than a leave request.

Technical definition: Audited table/domain name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `entity: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### entity_id

**In everyday language:** Polymorphic target identifier; no single table link to another record is appropriate.

**Why it is kept:** Keeps this record connected to the correct entity, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Polymorphic target identifier; no single table FK is appropriate

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `entity_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### field

**In everyday language:** Changed field or bounded operation label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A change-history entry can identify “work email” as the detail that changed.

Technical definition: Changed field or bounded operation label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `field: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### old_value

**In everyday language:** Masked before-image; caller must never include raw statutory credentials.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If a permitted detail changes, this preserves what it was before the change.

Technical definition: Masked before-image; caller must never include raw statutory credentials

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `old_value: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### new_value

**In everyday language:** Masked after-image/explanation; caller masking is load-bearing.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If a permitted detail changes, this preserves what was saved after the change.

Technical definition: Masked after-image/explanation; caller masking is load-bearing

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `new_value: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ip

**In everyday language:** Operation source network address.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A saved browser or connection detail can help an authorized administrator investigate which sign-in or submission produced the event.

Technical definition: Operation source network address

| Property | Definition |
|---|---|
| SQL type | `inet` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ip: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### at

**In everyday language:** Audit event instant.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A time such as 9 AM describes the timing of this particular activity; whether a calendar date is also stored depends on the field.

Technical definition: Audit event instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prev_hash

**In everyday language:** Set by the DB trigger — never write from the app.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Set by the DB trigger — never write from the app.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:135 |
| Code declaration | `prev_hash: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### row_hash

**In everyday language:** Set by the DB trigger — never write from the app.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Set by the DB trigger — never write from the app.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:137 |
| Code declaration | `row_hash: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### scope_org_unit_id

**In everyday language:** Historical data scope captured when the event is written (CORE-10).

**Why it is kept:** Keeps this record connected to the correct scope org unit, so related details can be checked together.

**Example:** This record points to an existing entry in org units instead of copying all of that entry’s details.

Technical definition: Historical data scope captured when the event is written (CORE-10).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:131 |
| Code declaration | `scope_org_unit_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `audit_log_scope_org_unit_id_fkey`: `FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id)`

### hash_version

**In everyday language:** V1 predates scoped audit rows; V2 commits scope_org_unit_id into row_hash.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: V1 predates scoped audit rows; V2 commits scope_org_unit_id into row_hash.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 2 |
| Definition basis | backend/src/core/db/types.ts:133 |
| Code declaration | `hash_version: Generated<1 \| 2>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `audit_log_hash_version_check`: `CHECK ((hash_version = ANY (ARRAY[1, 2])))`

### chain_seq

**In everyday language:** Hashing order, assigned INSIDE the chain trigger's advisory lock. id
comes from a sequence evaluated before that lock, so under concurrency the
two disagree — the chain is ordered by this, never by id.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A sequence such as 101 followed by 102 helps place protected history entries in their recorded order.

Technical definition: Hashing order, assigned INSIDE the chain trigger's advisory lock. `id`
comes from a sequence evaluated before that lock, so under concurrency the
two disagree — the chain is ordered by this, never by id.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:145 |
| Code declaration | `chain_seq: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `audit_log_chain_seq_idx`: `CREATE UNIQUE INDEX audit_log_chain_seq_idx ON core.audit_log USING btree (chain_seq)`
- Index `audit_log_entity_idx`: `CREATE INDEX audit_log_entity_idx ON core.audit_log USING btree (entity, entity_id, at)`
- Index `audit_log_pkey`: `CREATE UNIQUE INDEX audit_log_pkey ON core.audit_log USING btree (id)`
- Index `audit_log_scope_idx`: `CREATE INDEX audit_log_scope_idx ON core.audit_log USING btree (scope_org_unit_id, at DESC, id DESC)`
- Trigger `audit_log_chain` → `core.audit_log_chain` (enabled flag `O`).
- Trigger `audit_log_immutable` → `core.audit_log_immutable` (enabled flag `O`).

## core.bulk_jobs

Tracks file imports and exports, their progress and errors.

Bulk jobs records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bulk_jobs_pkey`: `PRIMARY KEY (id)`

### importer

**In everyday language:** Registered importer type defining row semantics.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the importer.

Technical definition: Registered importer type defining row semantics

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `importer: string;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### context

**In everyday language:** Validated import target/options copy saved at that point in time; can include sensitive context.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the context.

Technical definition: Validated import target/options snapshot; can include sensitive context

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | '{}'::jsonb |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `context: ColumnType<unknown, string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### context_key

**In everyday language:** Normalized target identity used for duplicate/commit coordination.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Normalized target identity used for duplicate/commit coordination

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `context_key: string;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number \| null;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bulk_jobs_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### filename

**In everyday language:** Original workbook where the information came from.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A source file might be called employee-import.xlsx so staff can recognize which import was processed.

Technical definition: Original workbook provenance

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `filename: string;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### file_sha256

**In everyday language:** Uploaded byte digital fingerprint for retry identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Two files with the same name can contain different data; their digital fingerprints help distinguish the bytes.

Technical definition: Uploaded byte digest for retry identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `file_sha256: string;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Preview/commit/failure progress from creation to closure.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “previewed” means Record is previewed in this progress from creation to closure.

Technical definition: Preview/commit/failure lifecycle

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'previewed'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'previewed' \| 'committing' \| 'committed' \| 'failed' \| 'discarded'>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `previewed` | Record is previewed in this lifecycle. | DB CHECK: bulk_jobs_status_check |
| `committing` | Record is committing in this lifecycle. | DB CHECK: bulk_jobs_status_check |
| `committed` | Record is committed in this lifecycle. | DB CHECK: bulk_jobs_status_check |
| `failed` | Operation/delivery attempt failed | DB CHECK: bulk_jobs_status_check |
| `discarded` | Record is discarded in this lifecycle. | DB CHECK: bulk_jobs_status_check |

Database rules (including conditions shared with other fields):

- `bulk_jobs_status_check`: `CHECK ((status = ANY (ARRAY['previewed'::text, 'committing'::text, 'committed'::text, 'failed'::text, 'discarded'::text])))`

### total_rows

**In everyday language:** Previewed row count.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Previewed row count

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `total_rows: Generated<number>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### error_rows

**In everyday language:** Rejected row count.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** A reviewer reads the saved explanation to understand the particular case before taking the next action.

Technical definition: Rejected row count

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `error_rows: Generated<number>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### warning_rows

**In everyday language:** Rows with nonfatal validation warnings.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Rows with nonfatal validation warnings

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `warning_rows: Generated<number>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### processed_rows

**In everyday language:** Committed/processed progress count, not authoritative financial amount.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Committed/processed progress count, not authoritative financial amount

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `processed_rows: Generated<number>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rows

**In everyday language:** Staged normalized row data; may contain personal/statutory/pay values.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the rows.

Technical definition: Staged normalized row data; may contain personal/statutory/pay values

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | '[]'::jsonb |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `rows: ColumnType<unknown, string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### report

**In everyday language:** Per-row validation report.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the report.

Technical definition: Per-row validation report

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | '[]'::jsonb |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `report: ColumnType<unknown, string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### result

**In everyday language:** Import completion summary.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the result.

Technical definition: Import completion summary

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `result: ColumnType<unknown, string \| null \| undefined, string \| null>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### error

**In everyday language:** Bounded job failure explanation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A message explaining which import step failed helps staff correct the source rather than retry blindly.

Technical definition: Bounded job failure explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `error: string \| null;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_by

**In everyday language:** User who created this record.

**Why it is kept:** Keeps this record connected to the correct person who created the record, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: User who created this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_by: number;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bulk_jobs_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: Generated<Date>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### committed_by

**In everyday language:** Identifies committed by connected to this record.

**Why it is kept:** Keeps this record connected to the correct committed by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s committed by to FOREIGN KEY (committed_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `committed_by: number \| null;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bulk_jobs_committed_by_fkey`: `FOREIGN KEY (committed_by) REFERENCES core.users(id)`

### committed_at

**In everyday language:** Successful commit receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Successful commit receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `committed_at: Stamp \| null;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: Generated<Date>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `bulk_jobs_created_by_idx`: `CREATE INDEX bulk_jobs_created_by_idx ON core.bulk_jobs USING btree (created_by, created_at DESC)`
- Index `bulk_jobs_idempotency_uq`: `CREATE UNIQUE INDEX bulk_jobs_idempotency_uq ON core.bulk_jobs USING btree (importer, context_key, file_sha256) WHERE (status = ANY (ARRAY['committing'::text, 'committed'::text]))`
- Index `bulk_jobs_importer_created_idx`: `CREATE INDEX bulk_jobs_importer_created_idx ON core.bulk_jobs USING btree (importer, created_at DESC)`
- Index `bulk_jobs_pkey`: `CREATE UNIQUE INDEX bulk_jobs_pkey ON core.bulk_jobs USING btree (id)`
- Trigger `bulk_jobs_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.clearances

Tracks departmental clearances required when an employee leaves.

core.clearances — LC-06 / AST-04 departmental clearance checklist.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `clearances_pkey`: `PRIMARY KEY (id)`

### separation_id

**In everyday language:** Identity of the separation case for which final settlement is calculated.

**Why it is kept:** Keeps this record connected to the correct separation, so related details can be checked together.

**Example:** This record points to an existing entry in separations instead of copying all of that entry’s details.

Technical definition: Identity of the separation case for which final settlement is calculated.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `separation_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `clearances_separation_id_fkey`: `FOREIGN KEY (separation_id) REFERENCES core.separations(id) ON DELETE CASCADE`
- `uq_separation_department`: `UNIQUE (separation_id, department)`

### department

**In everyday language:** IT/Admin/Finance/HR clearance responsibility.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “IT” means It.

Technical definition: IT/Admin/Finance/HR clearance responsibility

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `department: 'IT' \| 'Admin' \| 'Finance' \| 'HR';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `IT` | It. | DB CHECK: clearances_department_check |
| `Admin` | Admin. | DB CHECK: clearances_department_check |
| `Finance` | Finance. | DB CHECK: clearances_department_check |
| `HR` | Hr. | DB CHECK: clearances_department_check |

Database rules (including conditions shared with other fields):

- `clearances_department_check`: `CHECK ((department = ANY (ARRAY['IT'::text, 'Admin'::text, 'Finance'::text, 'HR'::text])))`
- `uq_separation_department`: `UNIQUE (separation_id, department)`

### status

**In everyday language:** Pending/cleared/flagged clearance state.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Pending/cleared/flagged clearance state

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'pending'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'pending' \| 'cleared' \| 'flagged'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: clearances_status_check |
| `cleared` | Record is cleared in this lifecycle. | DB CHECK: clearances_status_check |
| `flagged` | Record is flagged in this lifecycle. | DB CHECK: clearances_status_check |

Database rules (including conditions shared with other fields):

- `clearances_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'cleared'::text, 'flagged'::text])))`

### remarks

**In everyday language:** Clearance explanation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A reviewer reads the saved explanation to understand the particular case before taking the next action.

Technical definition: Clearance explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `remarks: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### unreturned_assets

**In everyday language:** Captured unresolved asset details supporting exit review, not replacement custody authority.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the unreturned assets.

Technical definition: Captured unresolved asset details supporting exit review, not replacement custody authority

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `unreturned_assets: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### recovery_amount

**In everyday language:** Proposed clearance-related recovery amount; requires approved downstream consumption.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Proposed clearance-related recovery amount; requires approved downstream consumption

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `recovery_amount: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### cleared_by

**In everyday language:** Identifies cleared by connected to this record.

**Why it is kept:** Keeps this record connected to the correct cleared by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s cleared by to FOREIGN KEY (cleared_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `cleared_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `clearances_cleared_by_fkey`: `FOREIGN KEY (cleared_by) REFERENCES core.users(id)`

### cleared_at

**In everyday language:** Department sign-off instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Department sign-off instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `cleared_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `clearances_pkey`: `CREATE UNIQUE INDEX clearances_pkey ON core.clearances USING btree (id)`
- Index `idx_clearances_separation`: `CREATE INDEX idx_clearances_separation ON core.clearances USING btree (separation_id)`
- Index `uq_separation_department`: `CREATE UNIQUE INDEX uq_separation_department ON core.clearances USING btree (separation_id, department)`

## core.companies

Lists the separate legal companies covered by HRMS.

core.companies — canonical entity master (doc 11 §0.2; 13 canonical of 14 raw).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** main legal-entity code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Canonical legal-entity code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_code_key`: `UNIQUE (code)`

### name

**In everyday language:** Legal entity display/letterhead name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Legal entity display/letterhead name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_name_key`: `UNIQUE (name)`

### ecode_prefix

**In everyday language:** Configured entity employee-code prefix; differs from removed doc ecode_format description.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A company can use a configured prefix to distinguish the employee codes it issues.

Technical definition: Configured entity employee-code prefix; differs from removed doc ecode_format description

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ecode_prefix: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_ecode_prefix_key`: `UNIQUE (ecode_prefix)`

### ecode_next_seq

**In everyday language:** Locked allocation sequence, not employee count.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The next employee-code number is advanced under controlled allocation so two joiners do not receive the same code.

Technical definition: Locked allocation sequence, not employee count

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 1 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ecode_next_seq: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_india_payroll

**In everyday language:** Explicit India statutory-engine eligibility gate.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Explicit India statutory-engine eligibility gate

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_india_payroll: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gstin

**In everyday language:** Entity GST registration printed on documents where required.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This identifies the company for GST-related records; an actual tax identifier is omitted from this guide.

Technical definition: Entity GST registration printed on documents where required

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `gstin: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### pan

**In everyday language:** Legal entity PAN, distinct from individual employee PAN.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a tax identifier, not an employee number. An actual identifier is omitted from this guide.

Technical definition: Legal entity PAN, distinct from individual employee PAN

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pan: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### pf_establishment_code

**In everyday language:** Legal establishment provident fund filing identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Legal establishment PF filing identifier

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pf_establishment_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### esic_code

**In everyday language:** Employer Employees’ State Insurance registration identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Employer ESIC registration identifier

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### pt_registration_no

**In everyday language:** Employer professional-tax registration identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Employer professional-tax registration identifier

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pt_registration_no: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### tan

**In everyday language:** income tax deducted from salary deductor identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Finance uses the company’s tax-deduction registration reference; an actual registration number is omitted.

Technical definition: TDS deductor identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `tan: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### address

**In everyday language:** Legal letterhead/return address.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An address tells staff the place associated with this particular person or organization; it is not automatically a work location.

Technical definition: Legal letterhead/return address

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `address: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sap_company_code

**In everyday language:** External SAP payer mapping.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: External SAP payer mapping

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sap_company_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_sap_company_code_key`: `UNIQUE (sap_company_code)`

### pf_wage_basis

**In everyday language:** Entity default provident fund wage-base policy; employee override precedence must be explicit.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “ACTUAL” means provident fund calculation on actual configured eligible wages.

Technical definition: Entity default PF wage-base policy; employee override precedence must be explicit

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pf_wage_basis: PfWageBasisColumn \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `ACTUAL` | PF calculation on actual configured eligible wages | DB CHECK: companies_pf_wage_basis_check |
| `CEILING_15000` | PF wage basis capped at the configured ceiling; code retains the legacy 15000 label | DB CHECK: companies_pf_wage_basis_check |

Database rules (including conditions shared with other fields):

- `companies_pf_wage_basis_check`: `CHECK ((pf_wage_basis = ANY (ARRAY['ACTUAL'::text, 'CEILING_15000'::text])))`

### country_code

**In everyday language:** Entity jurisdiction.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the country code shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Entity jurisdiction

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'IN'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `country_code: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_country_code_check`: `CHECK ((country_code ~ '^[A-Z]{2}$'::text))`

### currency_code

**In everyday language:** Entity reporting/pay currency; India money engine is still INR-scoped.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** INR denotes Indian rupees; the saved currency describes the associated amounts.

Technical definition: Entity reporting/pay currency; India money engine is still INR-scoped

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'INR'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `currency_code: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_currency_code_check`: `CHECK ((currency_code ~ '^[A-Z]{3}$'::text))`

### timezone

**In everyday language:** Entity local time context; not permission to ignore locked IST business rules.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the timezone.

Technical definition: Entity local time context; not permission to ignore locked IST business rules

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'Asia/Kolkata'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `timezone: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_timezone_check`: `CHECK ((timezone ~ '^[A-Za-z_]+(/[A-Za-z_+-]+)*$'::text))`

### locale

**In everyday language:** Entity display localization.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the locale.

Technical definition: Entity display localization

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'en-IN'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `locale: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `companies_locale_check`: `CHECK ((locale ~ '^[a-z]{2}(-[A-Z]{2})?$'::text))`

Table indexes and lifecycle triggers:

- Index `companies_code_key`: `CREATE UNIQUE INDEX companies_code_key ON core.companies USING btree (code)`
- Index `companies_ecode_prefix_key`: `CREATE UNIQUE INDEX companies_ecode_prefix_key ON core.companies USING btree (ecode_prefix)`
- Index `companies_name_key`: `CREATE UNIQUE INDEX companies_name_key ON core.companies USING btree (name)`
- Index `companies_pkey`: `CREATE UNIQUE INDEX companies_pkey ON core.companies USING btree (id)`
- Index `companies_sap_company_code_key`: `CREATE UNIQUE INDEX companies_sap_company_code_key ON core.companies USING btree (sap_company_code)`
- Trigger `companies_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.cost_centers

Lists the accounting groups to which employee costs are assigned.

Cost centers records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `cost_centers_id_company_uk`: `UNIQUE (id, company_id)`
- `cost_centers_pkey`: `PRIMARY KEY (id)`

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `cost_centers_company_id_code_key`: `UNIQUE (company_id, code)`
- `cost_centers_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `cost_centers_id_company_uk`: `UNIQUE (id, company_id)`
- `cost_centers_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`

### code

**In everyday language:** External payroll/SAP cost-center code scoped by company.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: External payroll/SAP cost-center code scoped by company

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `cost_centers_company_id_code_key`: `UNIQUE (company_id, code)`

### name

**In everyday language:** Cost-center display label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Cost-center display label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### plant_id

**In everyday language:** Identifies plant connected to this record.

**Why it is kept:** Keeps this record connected to the correct plant, so related details can be checked together.

**Example:** This record points to an existing entry in plants instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s plant id to FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id); FOREIGN KEY (plant_id) REFERENCES core.plants(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `plant_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `cost_centers_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`
- `cost_centers_plant_id_fkey`: `FOREIGN KEY (plant_id) REFERENCES core.plants(id)`

Table indexes and lifecycle triggers:

- Index `cost_centers_company_id_code_key`: `CREATE UNIQUE INDEX cost_centers_company_id_code_key ON core.cost_centers USING btree (company_id, code)`
- Index `cost_centers_id_company_uk`: `CREATE UNIQUE INDEX cost_centers_id_company_uk ON core.cost_centers USING btree (id, company_id)`
- Index `cost_centers_pkey`: `CREATE UNIQUE INDEX cost_centers_pkey ON core.cost_centers USING btree (id)`
- Trigger `cost_centers_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.department_heads

Records which people head each department.

core.department_heads — designated HODs per department (migration 1752500000300).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `department_heads_pkey`: `PRIMARY KEY (id)`

### department_id

**In everyday language:** Identifies department connected to this record.

**Why it is kept:** Keeps this record connected to the correct department, so related details can be checked together.

**Example:** This record points to an existing entry in departments instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s department id to FOREIGN KEY (department_id) REFERENCES core.departments(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `department_id: number;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `department_heads_department_id_fkey`: `FOREIGN KEY (department_id) REFERENCES core.departments(id) ON DELETE CASCADE`

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number \| null;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `department_heads_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id) ON DELETE CASCADE`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `department_heads_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`

### created_by

**In everyday language:** User who created this record.

**Why it is kept:** Keeps this record connected to the correct person who created the record, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: User who created this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_by: number \| null;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `department_heads_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: Generated<Date>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: Generated<Date>;` |
| Code source | [backend/src/core/db/types.bulk.ts](../../backend/src/core/db/types.bulk.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `department_heads_employee_idx`: `CREATE INDEX department_heads_employee_idx ON core.department_heads USING btree (employee_id)`
- Index `department_heads_entity_uq`: `CREATE UNIQUE INDEX department_heads_entity_uq ON core.department_heads USING btree (department_id, company_id, employee_id) WHERE (company_id IS NOT NULL)`
- Index `department_heads_group_uq`: `CREATE UNIQUE INDEX department_heads_group_uq ON core.department_heads USING btree (department_id, employee_id) WHERE (company_id IS NULL)`
- Index `department_heads_pkey`: `CREATE UNIQUE INDEX department_heads_pkey ON core.department_heads USING btree (id)`
- Trigger `department_heads_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.departments

Lists departments used to organize employees.

Departments records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `departments_pkey`: `PRIMARY KEY (id)`

### name

**In everyday language:** Department display label; current master is globally named.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Department display label; current master is globally named

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `departments_name_key`: `UNIQUE (name)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### mis_code_id

**In everyday language:** Identifies mis code connected to this record.

**Why it is kept:** Keeps this record connected to the correct mis code, so related details can be checked together.

**Example:** This record points to an existing entry in mis codes instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s mis code id to FOREIGN KEY (mis_code_id) REFERENCES core.mis_codes(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `mis_code_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `departments_mis_code_id_fkey`: `FOREIGN KEY (mis_code_id) REFERENCES core.mis_codes(id)`

Table indexes and lifecycle triggers:

- Index `departments_name_key`: `CREATE UNIQUE INDEX departments_name_key ON core.departments USING btree (name)`
- Index `departments_pkey`: `CREATE UNIQUE INDEX departments_pkey ON core.departments USING btree (id)`
- Trigger `departments_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.designations

Lists employee job titles.

Designations records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `designations_pkey`: `PRIMARY KEY (id)`

### name

**In everyday language:** Validated designation label used by main employee register.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Validated designation label used by employee master

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `designations_name_key`: `UNIQUE (name)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `designations_name_key`: `CREATE UNIQUE INDEX designations_name_key ON core.designations USING btree (name)`
- Index `designations_pkey`: `CREATE UNIQUE INDEX designations_pkey ON core.designations USING btree (id)`
- Trigger `designations_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.documents

Lists stored employee or candidate documents and their ownership and verification details.

Documents records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Registry row identity used by download/audit references.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `documents_pkey`: `PRIMARY KEY (id)`

### owner_employee_id

**In everyday language:** Employee whose live HR scope controls employee-vault access; not recorded while only candidate-owned.

**Why it is kept:** Keeps this record connected to the correct owner employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee whose live HR scope controls employee-vault access; NULL while only candidate-owned.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `owner_employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `documents_owner_employee_id_fkey`: `FOREIGN KEY (owner_employee_id) REFERENCES core.employees(id)`

### kind

**In everyday language:** Generic file/storage category, such as letter, policy, joining or employee_document.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the kind.

Technical definition: Generic file/storage category, such as letter, policy, joining or employee_document.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `kind: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### path

**In everyday language:** Private object-storage key, not a public download URL.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A private storage reference lets an authorized process find a file; it should not be treated as an openly accessible web address.

Technical definition: Private object-storage key, not a public download URL.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `path: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### original_name

**In everyday language:** Original client filename; potentially sensitive and redacted from non-owner list of available choices lists.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A document named joining-letter.pdf can keep that recognizable name even if stored under a private system key.

Technical definition: Original client filename; potentially sensitive and redacted from non-owner catalog lists.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `original_name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### mime

**In everyday language:** Stored content type, checked against accepted file signatures for vault uploads.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A PDF file can have the file type application/pdf, which helps the system handle the file correctly.

Technical definition: Stored content type, checked against accepted file signatures for vault uploads.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `mime: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### size_bytes

**In everyday language:** Byte size of stored content, separate from business policy limits.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A file size of 1,024 bytes describes storage size; it is not the number of pages.

Technical definition: Byte size of stored content, separate from business policy limits.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `size_bytes: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### uploaded_by

**In everyday language:** Account responsible for submitting the file.

**Why it is kept:** Keeps this record connected to the correct uploaded by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Account responsible for submitting the file.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `uploaded_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `documents_uploaded_by_fkey`: `FOREIGN KEY (uploaded_by) REFERENCES core.users(id)`

### created_at

**In everyday language:** Creation where the information came from timestamp.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Creation provenance timestamp.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** descriptive information modification where the information came from timestamp.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Metadata modification provenance timestamp.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### expires_on

**In everyday language:** not recorded = no expiry (PAN / appointment letter). DOC-03 colour language.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: NULL = no expiry (PAN / appointment letter). DOC-03 colour language.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:484 |
| Code declaration | `expires_on: Date \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** register progress from creation to closure: active, superseded or withdrawn; downloads require active.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “active” means Record is active in this progress from creation to closure.

Technical definition: Registry lifecycle: active, superseded or withdrawn; downloads require active.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'active'::text |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `status: Generated<DocumentVaultStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `active` | Record is active in this lifecycle. | DB CHECK: documents_status_check |
| `superseded` | Record is superseded in this lifecycle. | DB CHECK: documents_status_check |
| `withdrawn` | Record/request withdrawn | DB CHECK: documents_status_check |

Database rules (including conditions shared with other fields):

- `documents_status_check`: `CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text, 'withdrawn'::text])))`

### candidate_id

**In everyday language:** Pre-joining candidate where the information came from; does not itself make a person an employee.

**Why it is kept:** Keeps this record connected to the correct candidate, so related details can be checked together.

**Example:** This record points to an existing entry in onboarding candidates instead of copying all of that entry’s details.

Technical definition: Pre-joining candidate provenance; does not itself make a person an employee.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `candidate_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `documents_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL`

### doc_type

**In everyday language:** Existing link to another record to doc.types.code; main list of available choices classification for joining and new employee-vault files.

**Why it is kept:** Keeps this record connected to the correct doc type, so related details can be checked together.

**Example:** This record points to an existing entry in types instead of copying all of that entry’s details.

Technical definition: Existing FK to doc.types.code; canonical catalog classification for joining and new employee-vault files.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `doc_type: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `documents_doc_type_fkey`: `FOREIGN KEY (doc_type) REFERENCES doc.types(code)`

### verification_status

**In everyday language:** Joining-document HR verification state; not the same as register active/withdrawn status. Verification workflow is not complete.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Joining-document HR verification state; not the same as registry active/withdrawn status. Verification workflow is not complete.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `verification_status: 'pending' \| 'verified' \| 'rejected' \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: documents_verification_status_check |
| `verified` | Verified. | DB CHECK: documents_verification_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: documents_verification_status_check |

Database rules (including conditions shared with other fields):

- `documents_rejection_reason`: `CHECK (((verification_status IS DISTINCT FROM 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)))`
- `documents_verification_status_check`: `CHECK (((verification_status IS NULL) OR (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]))))`

### verified_by

**In everyday language:** Account recording the joining-document verification decision.

**Why it is kept:** Keeps this record connected to the correct verified by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Account recording the joining-document verification decision.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `verified_by: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `documents_verified_by_fkey`: `FOREIGN KEY (verified_by) REFERENCES core.users(id)`

### verified_at

**In everyday language:** Time of verification decision.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Time of verification decision.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `verified_at: ColumnType<Date \| null, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rejection_reason

**In everyday language:** Reason an HR verifier rejected the evidence; not a file deletion flag.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Reason an HR verifier rejected the evidence; not a file deletion flag.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `rejection_reason: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `documents_rejection_reason`: `CHECK (((verification_status IS DISTINCT FROM 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)))`

### sha256

**In everyday language:** digital fingerprint of bytes; now stored on creation and used for identical-upload retry identity. Read-time integrity verification remains separate work.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The actual security value is omitted. The system compares it to check the correct credential or exact information.

Technical definition: Digest of bytes; now stored on creation and used for identical-upload retry identity. Read-time integrity verification remains separate work.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `sha256: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### document_number

**In everyday language:** Permission-sensitive identifier printed on evidence; do not infer it from a filename or log it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This identifies the document itself, where applicable; it is different from the system’s document-record number.

Technical definition: Permission-sensitive identifier printed on evidence; do not infer it from a filename or log it.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `document_number: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `documents_candidate_idx`: `CREATE INDEX documents_candidate_idx ON core.documents USING btree (candidate_id) WHERE (candidate_id IS NOT NULL)`
- Index `documents_doc_type_idx`: `CREATE INDEX documents_doc_type_idx ON core.documents USING btree (owner_employee_id, doc_type) WHERE (doc_type IS NOT NULL)`
- Index `documents_expires_idx`: `CREATE INDEX documents_expires_idx ON core.documents USING btree (expires_on) WHERE ((expires_on IS NOT NULL) AND (status = 'active'::text))`
- Index `documents_owner_kind_idx`: `CREATE INDEX documents_owner_kind_idx ON core.documents USING btree (owner_employee_id, kind) WHERE (owner_employee_id IS NOT NULL)`
- Index `documents_pkey`: `CREATE UNIQUE INDEX documents_pkey ON core.documents USING btree (id)`
- Trigger `documents_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.employee_addresses

Keeps employees’ address details.

Employee addresses records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_addresses_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_addresses_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`
- `employee_addresses_employee_id_kind_key`: `UNIQUE (employee_id, kind)`

### kind

**In everyday language:** Present/permanent address authority choice that tells the system which kind this is.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “present” means Present classification for kind.

Technical definition: Present/permanent address authority discriminator

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `kind: 'present' \| 'permanent';` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `present` | Present classification for kind. | DB CHECK: employee_addresses_kind_check |
| `permanent` | Permanent classification for kind. | DB CHECK: employee_addresses_kind_check |

Database rules (including conditions shared with other fields):

- `employee_addresses_employee_id_kind_key`: `UNIQUE (employee_id, kind)`
- `employee_addresses_kind_check`: `CHECK ((kind = ANY (ARRAY['present'::text, 'permanent'::text])))`

### house

**In everyday language:** House/flat/address line.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A house or flat number helps distinguish the address within a street or building.

Technical definition: House/flat/address line

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `house: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### locality

**In everyday language:** Local area or village.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A locality describes the neighborhood within the address.

Technical definition: Local area or village

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `locality: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### city

**In everyday language:** City/village name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A city such as Kolkata identifies the city portion of the address or journey.

Technical definition: City/village name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `city: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### post_office

**In everyday language:** Postal administrative office.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This names the post office serving the address.

Technical definition: Postal administrative office

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `post_office: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### police_station

**In everyday language:** Thana/police administrative area.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This names the police-station area associated with the address, where collected.

Technical definition: Thana/police administrative area

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `police_station: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sub_division

**In everyday language:** Administrative sub-division.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the administrative subdivision within the address.

Technical definition: Administrative sub-division

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sub_division: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### district

**In everyday language:** Administrative district.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The district is a separate administrative address detail from the city.

Technical definition: Administrative district

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `district: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### state_code

**In everyday language:** Structured state code; tax jurisdiction still needs approved work/residence precedence.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A stored state code selects the applicable state or address jurisdiction; it does not represent a company code.

Technical definition: Structured state code; tax jurisdiction still needs approved work/residence precedence

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `state_code: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### country_code

**In everyday language:** Address country jurisdiction.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the country code shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Address country jurisdiction

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'IN'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `country_code: Generated<string>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_addresses_country`: `CHECK ((country_code ~ '^[A-Z]{2}$'::text))`
- `employee_addresses_in_pin`: `CHECK (((country_code <> 'IN'::text) OR (pin ~ '^[1-9][0-9]{5}$'::text)))`

### pin

**In everyday language:** Postal code validated for declared country/policy.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The postal PIN identifies the delivery area; no employee’s actual address is used here.

Technical definition: Postal code validated for declared country/policy

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pin: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_addresses_in_pin`: `CHECK (((country_code <> 'IN'::text) OR (pin ~ '^[1-9][0-9]{5}$'::text)))`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_addresses_employee_id_kind_key`: `CREATE UNIQUE INDEX employee_addresses_employee_id_kind_key ON core.employee_addresses USING btree (employee_id, kind)`
- Index `employee_addresses_pkey`: `CREATE UNIQUE INDEX employee_addresses_pkey ON core.employee_addresses USING btree (id)`
- Trigger `employee_addresses_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.employee_certifications

Keeps employees’ professional qualifications and certificates.

Employee certifications records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_certifications_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_certifications_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`

### name

**In everyday language:** Certificate/qualification title.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Certificate/qualification title

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### issuer

**In everyday language:** Issuing organization.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This identifies the organization that issued the certificate.

Technical definition: Issuing organization

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `issuer: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### issued_on

**In everyday language:** Certificate issue date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Certificate issue date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `issued_on: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `certification_dates`: `CHECK (((expires_on IS NULL) OR (issued_on IS NULL) OR (expires_on > issued_on)))`

### expires_on

**In everyday language:** Certificate expiry for validity/reminder work.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Certificate expiry for validity/reminder work

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `expires_on: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `certification_dates`: `CHECK (((expires_on IS NULL) OR (issued_on IS NULL) OR (expires_on > issued_on)))`

### specialization

**In everyday language:** Certificate specialization.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This records the subject area, such as mechanical engineering, within a qualification.

Technical definition: Certificate specialization

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `specialization: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### grade

**In everyday language:** Reported certificate grade.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the grade shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Reported certificate grade

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `grade: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sort_order

**In everyday language:** Presentation order within employee qualifications.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An entry with order 1 can be shown before an entry with order 2.

Technical definition: Presentation order within employee qualifications

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sort_order: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_certifications_emp_idx`: `CREATE INDEX employee_certifications_emp_idx ON core.employee_certifications USING btree (employee_id)`
- Index `employee_certifications_expiry_idx`: `CREATE INDEX employee_certifications_expiry_idx ON core.employee_certifications USING btree (expires_on) WHERE (expires_on IS NOT NULL)`
- Index `employee_certifications_pkey`: `CREATE UNIQUE INDEX employee_certifications_pkey ON core.employee_certifications USING btree (id)`

## core.employee_education

Keeps employees’ education history.

Employee education records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_education_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_education_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`

### qualification

**In everyday language:** Degree/qualification label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A qualification such as a bachelor’s degree describes the course completed.

Technical definition: Degree/qualification label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `qualification: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### institute

**In everyday language:** Educational institution name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This identifies the school, college or institute awarding the qualification.

Technical definition: Educational institution name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `institute: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### year_of_passing

**In everyday language:** Completion year.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** 2020 would identify the year a qualification was completed, not the year the employee joined.

Technical definition: Completion year

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `year_of_passing: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_education_year_of_passing_check`: `CHECK (((year_of_passing IS NULL) OR ((year_of_passing >= 1950) AND (year_of_passing <= 2100))))`

### specialization

**In everyday language:** Subject/specialization.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This records the subject area, such as mechanical engineering, within a qualification.

Technical definition: Subject/specialization

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `specialization: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### score

**In everyday language:** Reported percentage or CGPA numeric value.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This keeps the qualification result using its recorded scoring basis; a percentage and a grade-point score are different measures.

Technical definition: Reported percentage or CGPA numeric value

| Property | Definition |
|---|---|
| SQL type | `numeric(6,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `score: Num;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `education_score_range`: `CHECK (((score IS NULL) OR ((score_type = 'percent'::text) AND (score <= (100)::numeric)) OR ((score_type = 'cgpa'::text) AND (score <= (10)::numeric))))`
- `employee_education_score_check`: `CHECK (((score IS NULL) OR (score >= (0)::numeric)))`

### score_type

**In everyday language:** Units/interpretation of score.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “percent” means Percent.

Technical definition: Units/interpretation of score

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `score_type: 'percent' \| 'cgpa' \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `percent` | Percent. | DB CHECK: employee_education_score_type_check |
| `cgpa` | Cumulative grade point average | DB CHECK: employee_education_score_type_check |

Database rules (including conditions shared with other fields):

- `education_score_range`: `CHECK (((score IS NULL) OR ((score_type = 'percent'::text) AND (score <= (100)::numeric)) OR ((score_type = 'cgpa'::text) AND (score <= (10)::numeric))))`
- `employee_education_score_type_check`: `CHECK (((score_type IS NULL) OR (score_type = ANY (ARRAY['percent'::text, 'cgpa'::text]))))`

### sort_order

**In everyday language:** Stable education-grid order.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An entry with order 1 can be shown before an entry with order 2.

Technical definition: Stable education-grid order

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sort_order: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_education_emp_idx`: `CREATE INDEX employee_education_emp_idx ON core.employee_education USING btree (employee_id)`
- Index `employee_education_pkey`: `CREATE UNIQUE INDEX employee_education_pkey ON core.employee_education USING btree (id)`

## core.employee_experience

Keeps employees’ previous employment experience.

Employee experience records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_experience_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_experience_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`

### employer

**In everyday language:** Former employing organization.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the employer shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Former employing organization

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `employer: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### designation

**In everyday language:** Prior job designation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the designation shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Prior job designation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `designation: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### from_date

**In everyday language:** Prior employment beginning.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Prior employment beginning

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `from_date: ColumnType<Date, Date \| string, Date \| string>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `experience_dates`: `CHECK (((to_date IS NULL) OR (to_date >= from_date)))`

### to_date

**In everyday language:** Prior employment ending; not recorded while unspecified/current per validated form.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Prior employment ending; NULL while unspecified/current per validated form

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `to_date: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `experience_dates`: `CHECK (((to_date IS NULL) OR (to_date >= from_date)))`

### reason_for_leaving

**In everyday language:** Candidate-supplied prior separation reason.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Candidate-supplied prior separation reason

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reason_for_leaving: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### last_ctc

**In everyday language:** Prior-employer cost to company (the total employment cost), not current payroll entitlement.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Prior-employer CTC, not current payroll entitlement

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `last_ctc: Num;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_experience_last_ctc_check`: `CHECK (((last_ctc IS NULL) OR (last_ctc >= (0)::numeric)))`

### sort_order

**In everyday language:** Stable employment-history presentation order.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An entry with order 1 can be shown before an entry with order 2.

Technical definition: Stable employment-history presentation order

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sort_order: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_experience_emp_idx`: `CREATE INDEX employee_experience_emp_idx ON core.employee_experience USING btree (employee_id)`
- Index `employee_experience_pkey`: `CREATE UNIQUE INDEX employee_experience_pkey ON core.employee_experience USING btree (id)`

## core.employee_family

Keeps employees’ family and dependant details.

Employee family records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_family_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_family_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### name

**In everyday language:** Family member name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Family member name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### relation

**In everyday language:** Relationship to employee.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This distinguishes how the listed person is related to the employee, such as parent or spouse.

Technical definition: Relationship to employee

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `relation: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### dob

**In everyday language:** Family member birth date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Family member birth date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `dob: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### aadhaar

**In everyday language:** Restricted family member statutory identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a sensitive personal identity number. An actual number is omitted from this guide.

Technical definition: Restricted family member statutory identifier

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `aadhaar: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_esic_dependent

**In everyday language:** Employees’ State Insurance declaration eligibility flag.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: ESIC declaration eligibility flag

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_esic_dependent: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_nominee

**In everyday language:** Legacy generic nomination flag; cannot replace scheme/version-specific nomination.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Legacy generic nomination flag; cannot replace scheme/version-specific nomination

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_nominee: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### nominee_share_pct

**In everyday language:** Legacy generic nomination share; reconcile with scheme-specific share authority.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A 50% share describes the person’s nominated share of that benefit; it is not a salary deduction.

Technical definition: Legacy generic nomination share; reconcile with scheme-specific share authority

| Property | Definition |
|---|---|
| SQL type | `numeric(5,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `nominee_share_pct: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gender

**In everyday language:** Family member gender for statutory declaration.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “Male” means Male.

Technical definition: Family member gender for statutory declaration

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `gender: GenderCode \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `Male` | Male. | DB CHECK: employee_family_gender_check |
| `Female` | Female. | DB CHECK: employee_family_gender_check |
| `Transgender` | Transgender. | DB CHECK: employee_family_gender_check |

Database rules (including conditions shared with other fields):

- `employee_family_gender_check`: `CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Transgender'::text]))))`

### address

**In everyday language:** Family member residential address.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An address tells staff the place associated with this particular person or organization; it is not automatically a work location.

Technical definition: Family member residential address

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `address: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### residing_with_employee

**In everyday language:** Whether member shares employee residence.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether member shares employee residence

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `residing_with_employee: boolean \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### residing_town

**In everyday language:** Separate residing town when applicable.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Separate residing town when applicable

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `residing_town: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### residing_state_code

**In everyday language:** Separate residence state.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Separate residence state

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `residing_state_code: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### occupation

**In everyday language:** Family member occupation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This records the family member’s occupation where the form asks for it.

Technical definition: Family member occupation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `occupation: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_dependent

**In everyday language:** General dependency flag, distinct from Employees’ State Insurance scheme eligibility.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: General dependency flag, distinct from ESIC scheme eligibility

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_dependent: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_family_pkey`: `CREATE UNIQUE INDEX employee_family_pkey ON core.employee_family USING btree (id)`
- Trigger `employee_family_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.employee_history

Keeps a history of changes to employee information.

Employee history records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_history_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_history_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### effective_date

**In everyday language:** Business effective date of recorded master movement.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Business effective date of recorded master movement

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `effective_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### change_type

**In everyday language:** Transfer/promotion/confirmation/change category.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the change type.

Technical definition: Transfer/promotion/confirmation/change category

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `change_type: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### field

**In everyday language:** Historical master field name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A change-history entry can identify “work email” as the detail that changed.

Technical definition: Historical master field name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `field: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### old_value

**In everyday language:** Historical before-image; restricted fields must be masked appropriately.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If a permitted detail changes, this preserves what it was before the change.

Technical definition: Historical before-image; restricted fields must be masked appropriately

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `old_value: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### new_value

**In everyday language:** Historical after-image; not a second editable master.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If a permitted detail changes, this preserves what was saved after the change.

Technical definition: Historical after-image; not a second editable master

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `new_value: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### reference_id

**In everyday language:** Polymorphic originating workflow/reference.

**Why it is kept:** Keeps this record connected to the correct reference, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Polymorphic originating workflow/reference

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reference_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_history_pkey`: `CREATE UNIQUE INDEX employee_history_pkey ON core.employee_history USING btree (id)`
- Index `idx_employee_history_lookup`: `CREATE INDEX idx_employee_history_lookup ON core.employee_history USING btree (employee_id, effective_date)`
- Trigger `employee_history_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.employee_nominations

Records people nominated to receive specified employee benefits.

Employee nominations records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_nominations_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_nominations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`

### scheme

**In everyday language:** provident fund/Employees’ Pension Scheme/gratuity/Employees’ State Insurance/insurance nomination context.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “pf” means Provident fund.

Technical definition: PF/EPS/gratuity/ESIC/insurance nomination context

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `scheme: NominationScheme;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pf` | Provident fund | DB CHECK: employee_nominations_scheme_check |
| `eps` | Employees Pension Scheme | DB CHECK: employee_nominations_scheme_check |
| `gratuity` | Gratuity. | DB CHECK: employee_nominations_scheme_check |
| `esic` | Employees State Insurance | DB CHECK: employee_nominations_scheme_check |
| `gpa` | Group personal accident cover | DB CHECK: employee_nominations_scheme_check |
| `gmc` | Group medical cover | DB CHECK: employee_nominations_scheme_check |
| `gtli` | Group term life insurance | DB CHECK: employee_nominations_scheme_check |

Database rules (including conditions shared with other fields):

- `employee_nominations_scheme_check`: `CHECK ((scheme = ANY (ARRAY['pf'::text, 'eps'::text, 'gratuity'::text, 'esic'::text, 'gpa'::text, 'gmc'::text, 'gtli'::text])))`

### version

**In everyday language:** Whole nomination-set version, not individual edit counter.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Whole nomination-set version, not individual edit counter

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `version: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_nominations_version_check`: `CHECK ((version > 0))`

### status

**In everyday language:** Active versus superseded nomination set member.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “active” means Record is active in this progress from creation to closure.

Technical definition: Active versus superseded nomination set member

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'active'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'active' \| 'superseded'>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `active` | Record is active in this lifecycle. | DB CHECK: employee_nominations_status_check |
| `superseded` | Record is superseded in this lifecycle. | DB CHECK: employee_nominations_status_check |

Database rules (including conditions shared with other fields):

- `employee_nominations_status_check`: `CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text])))`

### family_member_id

**In everyday language:** Identifies family member connected to this record.

**Why it is kept:** Keeps this record connected to the correct family member, so related details can be checked together.

**Example:** This record points to an existing entry in employee family instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s family member id to FOREIGN KEY (family_member_id) REFERENCES core.employee_family(id) ON DELETE SET NULL.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `family_member_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_nominations_family_member_id_fkey`: `FOREIGN KEY (family_member_id) REFERENCES core.employee_family(id) ON DELETE SET NULL`

### nominee_name

**In everyday language:** Nominee name copy saved at that point in time supporting signed form history.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the nominee name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Nominee name snapshot supporting signed form history

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `nominee_name: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### relation

**In everyday language:** Nominee relationship copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This distinguishes how the listed person is related to the employee, such as parent or spouse.

Technical definition: Nominee relationship snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `relation: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### dob

**In everyday language:** Nominee birth date copy saved at that point in time.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Nominee birth date snapshot

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `dob: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gender

**In everyday language:** Nominee gender copy saved at that point in time.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “Male” means Male.

Technical definition: Nominee gender snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `gender: GenderCode \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `Male` | Male. | DB CHECK: employee_nominations_gender_check |
| `Female` | Female. | DB CHECK: employee_nominations_gender_check |
| `Transgender` | Transgender. | DB CHECK: employee_nominations_gender_check |

Database rules (including conditions shared with other fields):

- `employee_nominations_gender_check`: `CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Transgender'::text]))))`

### address

**In everyday language:** Nominee address copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An address tells staff the place associated with this particular person or organization; it is not automatically a work location.

Technical definition: Nominee address snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `address: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### share_pct

**In everyday language:** Scheme/version-specific allocation percentage.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A 50% nomination share means half of the relevant nominated benefit, subject to the benefit’s nomination rules.

Technical definition: Scheme/version-specific allocation percentage

| Property | Definition |
|---|---|
| SQL type | `numeric(5,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `share_pct: ColumnType<string, string \| number, string \| number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_nominations_share_pct_check`: `CHECK (((share_pct > (0)::numeric) AND (share_pct <= (100)::numeric)))`

### guardian_name

**In everyday language:** Minor nominee's guardian name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If a nominee needs a guardian, this names the recorded guardian rather than the nominee.

Technical definition: Minor nominee's guardian name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `guardian_name: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### guardian_relation

**In everyday language:** Guardian relationship.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This explains how the guardian is related to the nominee.

Technical definition: Guardian relationship

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `guardian_relation: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### guardian_address

**In everyday language:** Guardian address copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the guardian address.

Technical definition: Guardian address snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `guardian_address: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_by

**In everyday language:** User who created this record.

**Why it is kept:** Keeps this record connected to the correct person who created the record, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: User who created this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_by: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_nominations_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_nominations_active_idx`: `CREATE INDEX employee_nominations_active_idx ON core.employee_nominations USING btree (employee_id, scheme) WHERE (status = 'active'::text)`
- Index `employee_nominations_pkey`: `CREATE UNIQUE INDEX employee_nominations_pkey ON core.employee_nominations USING btree (id)`

## core.employee_statutory_profile

Keeps employee information needed for statutory declarations and benefits.

Employee statutory profile records; consult the field definitions and governing module specification.

Relation kind: table.

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_statutory_profile_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`
- `employee_statutory_profile_pkey`: `PRIMARY KEY (employee_id)`

### epf_prev_member

**In everyday language:** Joining declaration of prior Employees’ Provident Fund membership.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Joining declaration of prior EPF membership

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `epf_prev_member: boolean \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### eps_prev_member

**In everyday language:** Joining declaration of prior Employees’ Pension Scheme membership.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Joining declaration of prior EPS membership

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `eps_prev_member: boolean \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prev_pf_number

**In everyday language:** Previous employer provident fund member identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Previous employer PF member identifier

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prev_pf_number: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prev_exit_date

**In everyday language:** Previous employment exit date for transfer declaration.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Previous employment exit date for transfer declaration

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prev_exit_date: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### scheme_certificate_no

**In everyday language:** Existing Employees’ Pension Scheme scheme certificate reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Existing EPS scheme certificate reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `scheme_certificate_no: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ppo_no

**In everyday language:** Pension payment-order reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Pension payment-order reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ppo_no: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### epf_withdrawn

**In everyday language:** Prior Employees’ Provident Fund withdrawal declaration.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Prior EPF withdrawal declaration

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `epf_withdrawn: boolean \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### eps_withdrawn

**In everyday language:** Prior Employees’ Pension Scheme withdrawal declaration.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Prior EPS withdrawal declaration

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `eps_withdrawn: boolean \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### eps_withdrawn_after_sep2014

**In everyday language:** Timing-sensitive Employees’ Pension Scheme withdrawal fact for eligibility review.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Timing-sensitive EPS withdrawal fact for eligibility review

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `eps_withdrawn_after_sep2014: boolean \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### kyc_status

**In everyday language:** Statutory-profile verification workflow status.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “not_uploaded” means Not uploaded.

Technical definition: Statutory-profile verification workflow status

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `kyc_status: 'not_uploaded' \| 'uploaded_pending' \| 'approved' \| 'rejected' \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `not_uploaded` | Not uploaded. | DB CHECK: employee_statutory_profile_kyc_status_check |
| `uploaded_pending` | Uploaded pending. | DB CHECK: employee_statutory_profile_kyc_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: employee_statutory_profile_kyc_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: employee_statutory_profile_kyc_status_check |

Database rules (including conditions shared with other fields):

- `employee_statutory_profile_kyc_status_check`: `CHECK (((kyc_status IS NULL) OR (kyc_status = ANY (ARRAY['not_uploaded'::text, 'uploaded_pending'::text, 'approved'::text, 'rejected'::text]))))`

### transfer_request_status

**In everyday language:** Prior provident fund transfer application progress.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “not_needed” means Not needed.

Technical definition: Prior PF transfer application progress

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `transfer_request_status: 'not_needed' \| 'pending' \| 'submitted' \| 'completed' \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `not_needed` | Not needed. | DB CHECK: employee_statutory_profile_transfer_request_status_check |
| `pending` | Awaiting the required decision or next action | DB CHECK: employee_statutory_profile_transfer_request_status_check |
| `submitted` | Submitted. | DB CHECK: employee_statutory_profile_transfer_request_status_check |
| `completed` | Completed. | DB CHECK: employee_statutory_profile_transfer_request_status_check |

Database rules (including conditions shared with other fields):

- `employee_statutory_profile_transfer_request_status_check`: `CHECK (((transfer_request_status IS NULL) OR (transfer_request_status = ANY (ARRAY['not_needed'::text, 'pending'::text, 'submitted'::text, 'completed'::text]))))`

### esic_prev_ip_number

**In everyday language:** Prior Employees’ State Insurance insured-person identifier; reconcile with current retained IP.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Prior ESIC insured-person identifier; reconcile with current retained IP

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_prev_ip_number: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `statprof_esic_prev`: `CHECK (((esic_prev_ip_number IS NULL) OR (esic_prev_ip_number ~ '^[0-9]{10}$'::text)))`

### esic_prev_employer_code

**In everyday language:** Previous Employees’ State Insurance employer registration code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the esic prev employer code shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Previous ESIC employer registration code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_prev_employer_code: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### esic_prev_employer_name

**In everyday language:** Previous employer declaration name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the esic prev employer name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Previous employer declaration name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_prev_employer_name: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### esic_prev_employer_address

**In everyday language:** Previous employer declaration address.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the esic prev employer address shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Previous employer declaration address

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_prev_employer_address: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### esic_branch_office

**In everyday language:** Designated Employees’ State Insurance office.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the esic branch office.

Technical definition: Designated ESIC office

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_branch_office: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### esic_dispensary

**In everyday language:** Designated Employees’ State Insurance medical dispensary.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the esic dispensary.

Technical definition: Designated ESIC medical dispensary

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_dispensary: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employee_statutory_profile_pkey`: `CREATE UNIQUE INDEX employee_statutory_profile_pkey ON core.employee_statutory_profile USING btree (employee_id)`
- Trigger `employee_statutory_profile_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.employees

Keeps the main employment record for each person who has actually joined.

core.employees — THE master record (docs/03 §3).

Relation kind: table.

### id

**In everyday language:** A number the system uses to recognize this employee internally. It is separate from the employee code HR normally quotes.

**Why it is kept:** Keeps this person’s attendance, leave and salary connected to the same employee.

**Example:** An attendance entry linked to employee 123 belongs to that employee, even if the display name changes.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_hod_not_self`: `CHECK (((hod_employee_id IS NULL) OR (hod_employee_id <> id)))`
- `employees_pkey`: `PRIMARY KEY (id)`

### ecode

**In everyday language:** The employee code used by HR and employees to identify a person.

**Why it is kept:** Helps staff find the right employee and match records across approved systems.

**Example:** HR searches using the employee’s assigned company code rather than relying on the name alone.

Technical definition: Permanent entity-series employee code allocated only on actual-joining confirmation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ecode: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_ecode_key`: `UNIQUE (ecode)`

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `employees_cost_center_company_fk`: `FOREIGN KEY (cost_center_id, company_id) REFERENCES core.cost_centers(id, company_id)`
- `employees_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`
- `employees_org_unit_company_fk`: `FOREIGN KEY (org_unit_id, company_id) REFERENCES core.org_units(id, company_id)`
- `employees_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`

### first_name

**In everyday language:** Employee given/display first name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** In the invented name “Sample Employee”, “Sample” is the first name.

Technical definition: Employee given/display first name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `first_name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### last_name

**In everyday language:** Employee family/remaining name; may be absent for single-token names.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** In the invented name “Sample Employee”, “Employee” is the last name.

Technical definition: Employee family/remaining name; may be absent for single-token names

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `last_name: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### photo_path

**In everyday language:** Employee portrait object reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An authorized process follows this reference to find the associated file or destination. The reference alone does not grant access.

Technical definition: Employee portrait object reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `photo_path: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gender

**In everyday language:** Recorded gender for HR/statutory/demographic outputs.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “Male” means Male.

Technical definition: Recorded gender for HR/statutory/demographic outputs

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `gender: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `Male` | Male. | DB CHECK: employees_gender_check |
| `Female` | Female. | DB CHECK: employees_gender_check |
| `Transgender` | Transgender. | DB CHECK: employees_gender_check |

Database rules (including conditions shared with other fields):

- `employees_gender_check`: `CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Transgender'::text]))))`

### dob

**In everyday language:** Birth date for age/eligibility checks and reporting.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Birth date for age/eligibility checks and reporting

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `dob: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### marital_status

**In everyday language:** Declared marital classification for forms.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “single” means Single.

Technical definition: Declared marital classification for forms

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `marital_status: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `single` | Single. | DB CHECK: employees_marital_status_check |
| `married` | Married. | DB CHECK: employees_marital_status_check |
| `widowed` | Widowed. | DB CHECK: employees_marital_status_check |
| `divorced` | Divorced. | DB CHECK: employees_marital_status_check |
| `separated` | Separated. | DB CHECK: employees_marital_status_check |

Database rules (including conditions shared with other fields):

- `employees_marital_status_check`: `CHECK (((marital_status IS NULL) OR (marital_status = ANY (ARRAY['single'::text, 'married'::text, 'widowed'::text, 'divorced'::text, 'separated'::text]))))`

### blood_group

**In everyday language:** Safety/identity-card blood-group data.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the blood group.

Technical definition: Safety/identity-card blood-group data

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `blood_group: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### personal_email

**In everyday language:** Personal/prejoin/alumni communication address.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A personal address such as sample@example.com is separate from the person’s company email.

Technical definition: Personal/prejoin/alumni communication address

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `personal_email: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### work_email

**In everyday language:** Work communication/login identity reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A company-issued email is used for work correspondence; it should not be confused with the personal email used before joining.

Technical definition: Work communication/login identity reference

| Property | Definition |
|---|---|
| SQL type | `citext` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `work_email: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_work_email_key`: `UNIQUE (work_email)`

### mobile

**In everyday language:** Employee contact telephone.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A phone contact allows an authorized HR process to reach the person; no actual phone number is shown.

Technical definition: Employee contact telephone

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `mobile: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### emergency_contact_name

**In everyday language:** Emergency contact person.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** HR can identify whom to contact in an emergency, such as the employee’s nominated family contact.

Technical definition: Emergency contact person

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `emergency_contact_name: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### emergency_contact_phone

**In everyday language:** Primary emergency telephone.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The nominated emergency contact’s phone number can differ from the employee’s own phone number.

Technical definition: Primary emergency telephone

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `emergency_contact_phone: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### present_address

**In everyday language:** Legacy formatted present address; specified worked out from other saved information copy once structured address authority is implemented.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An employee may currently live in one town while their permanent home is elsewhere.

Technical definition: Legacy formatted present address; specified derived copy once structured address authority is implemented

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `present_address: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### permanent_address

**In everyday language:** Legacy formatted permanent address; not a second editable structured authority.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An employee’s permanent home can differ from their current place of residence.

Technical definition: Legacy formatted permanent address; not a second editable structured authority

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `permanent_address: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### category

**In everyday language:** Employment category controlling population and permitted payroll rules.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The saved category helps a reviewer group similar records; its meaning depends on the register being viewed.

Technical definition: Employment category controlling population and permitted payroll rules

| Property | Definition |
|---|---|
| SQL type | `core.employment_category` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `category: EmploymentCategory \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### contract_type

**In everyday language:** Employment terms classification; distinct from employee category.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the contract type.

Technical definition: Employment terms classification; distinct from employee category

| Property | Definition |
|---|---|
| SQL type | `core.contract_type` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `contract_type: ContractType \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### contract_end_date

**In everyday language:** Fixed-term/consultant contract end date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Fixed-term/consultant contract end date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `contract_end_date: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### doj

**In everyday language:** The date the employee actually joined.

**Why it is kept:** Establishes when employment starts for the processes that use joining date.

**Example:** A joining date of 11 Nov 2026 means employment starts on that date.

Technical definition: Confirmed actual joining date for service/attendance/pay

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `doj: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### dol

**In everyday language:** The recorded date the employee left employment.

**Why it is kept:** Keeps exit-related records and employment dates consistent.

**Example:** Once an exit is completed, the leaving date tells HR when employment ended.

Technical definition: Employment exit date; required when exited

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `dol: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_check`: `CHECK (((status <> 'exited'::core.employee_status) OR (dol IS NOT NULL)))`

### status

**In everyday language:** Employment progress from creation to closure, distinct from login/session activity.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** Staff read the saved stage to see where this particular record has reached.

Technical definition: Employment lifecycle, distinct from login/session activity

| Property | Definition |
|---|---|
| SQL type | `core.employee_status` |
| Required | Yes |
| Default | 'onboarding'::core.employee_status |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<EmployeeStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_check`: `CHECK (((status <> 'exited'::core.employee_status) OR (dol IS NOT NULL)))`

### exit_reason

**In everyday language:** Recorded separation cause; restricted HR information.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Recorded separation cause; restricted HR information

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `exit_reason: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### designation_id

**In everyday language:** Identifies designation connected to this record.

**Why it is kept:** Keeps this record connected to the correct designation, so related details can be checked together.

**Example:** This record points to an existing entry in designations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s designation id to FOREIGN KEY (designation_id) REFERENCES core.designations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `designation_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_designation_id_fkey`: `FOREIGN KEY (designation_id) REFERENCES core.designations(id)`

### department_id

**In everyday language:** Identifies department connected to this record.

**Why it is kept:** Keeps this record connected to the correct department, so related details can be checked together.

**Example:** This record points to an existing entry in departments instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s department id to FOREIGN KEY (department_id) REFERENCES core.departments(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `department_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_department_id_fkey`: `FOREIGN KEY (department_id) REFERENCES core.departments(id)`

### org_unit_id

**In everyday language:** Identifies org unit connected to this record.

**Why it is kept:** Keeps this record connected to the correct org unit, so related details can be checked together.

**Example:** This record points to an existing entry in org units instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s org unit id to FOREIGN KEY (org_unit_id, company_id) REFERENCES core.org_units(id, company_id); FOREIGN KEY (org_unit_id) REFERENCES core.org_units(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `org_unit_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_org_unit_company_fk`: `FOREIGN KEY (org_unit_id, company_id) REFERENCES core.org_units(id, company_id)`
- `employees_org_unit_id_fkey`: `FOREIGN KEY (org_unit_id) REFERENCES core.org_units(id)`

### location_id

**In everyday language:** Identifies location connected to this record.

**Why it is kept:** Keeps this record connected to the correct location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s location id to FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id); FOREIGN KEY (location_id) REFERENCES core.locations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `location_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`
- `employees_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

### cost_center_id

**In everyday language:** Identifies cost center connected to this record.

**Why it is kept:** Keeps this record connected to the correct cost center, so related details can be checked together.

**Example:** This record points to an existing entry in cost centers instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s cost center id to FOREIGN KEY (cost_center_id, company_id) REFERENCES core.cost_centers(id, company_id); FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `cost_center_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_cost_center_company_fk`: `FOREIGN KEY (cost_center_id, company_id) REFERENCES core.cost_centers(id, company_id)`
- `employees_cost_center_id_fkey`: `FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id)`

### grade_id

**In everyday language:** Identifies grade connected to this record.

**Why it is kept:** Keeps this record connected to the correct grade, so related details can be checked together.

**Example:** This record points to an existing entry in grades instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s grade id to FOREIGN KEY (grade_id) REFERENCES core.grades(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `grade_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_grade_id_fkey`: `FOREIGN KEY (grade_id) REFERENCES core.grades(id)`

### reporting_manager_id

**In everyday language:** Identifies reporting manager connected to this record.

**Why it is kept:** Keeps this record connected to the correct reporting manager, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s reporting manager id to FOREIGN KEY (reporting_manager_id) REFERENCES core.employees(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `reporting_manager_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_reporting_manager_id_fkey`: `FOREIGN KEY (reporting_manager_id) REFERENCES core.employees(id)`

### functional_manager_id

**In everyday language:** Identifies functional manager connected to this record.

**Why it is kept:** Keeps this record connected to the correct functional manager, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s functional manager id to FOREIGN KEY (functional_manager_id) REFERENCES core.employees(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `functional_manager_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_functional_manager_id_fkey`: `FOREIGN KEY (functional_manager_id) REFERENCES core.employees(id)`

### probation_months

**In everyday language:** Agreed probation duration.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Agreed probation duration

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `probation_months: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### probation_salary_pct

**In everyday language:** Agreed probation pay percentage; source must match effective salary assignment.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An illustrative 80% means the configured proportion of confirmed salary during probation; it is not a policy recommendation.

Technical definition: Agreed probation pay percentage; source must match effective salary assignment

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `probation_salary_pct: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### probation_due_date

**In everyday language:** worked out from other saved information/current probation review deadline.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Derived/current probation review deadline

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `probation_due_date: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### confirmation_date

**In everyday language:** Effective confirmation date used by salary/probation progress from creation to closure.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Effective confirmation date used by salary/probation lifecycle

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `confirmation_date: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### pan

**In everyday language:** Restricted employee income-tax identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a tax identifier, not an employee number. An actual identifier is omitted from this guide.

Technical definition: Restricted employee income-tax identifier

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pan: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### aadhaar

**In everyday language:** Restricted employee identity number.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a sensitive personal identity number. An actual number is omitted from this guide.

Technical definition: Restricted employee identity number

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `aadhaar: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### uan

**In everyday language:** Restricted Employees’ Provident Fund universal account number.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This identifies the person’s provident-fund account relationship across employment; it is not their company employee code.

Technical definition: Restricted EPF universal account number

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `uan: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### pf_number

**In everyday language:** Restricted provident fund member number.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The provident-fund membership reference supports the employee’s statutory records; no actual number is shown here.

Technical definition: Restricted PF member number

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pf_number: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### esic_ip_number

**In everyday language:** Restricted current insured-person number.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The insurance-person reference connects the employee to Employees’ State Insurance records.

Technical definition: Restricted current insured-person number

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_ip_number: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### pf_applicable

**In everyday language:** Master provident fund coverage fact; run-specific approved freeze is separate work.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Master PF coverage fact; run-specific approved freeze is separate work

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pf_applicable: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### esic_applicable

**In everyday language:** Master Employees’ State Insurance coverage fact; contribution-period freeze must govern pay.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Master ESIC coverage fact; contribution-period freeze must govern pay

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `esic_applicable: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### pt_applicable

**In everyday language:** Master PT applicability flag.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Master PT applicability flag

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pt_applicable: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### lwf_applicable

**In everyday language:** Master welfare-fund applicability flag.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Master welfare-fund applicability flag

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `lwf_applicable: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### tax_regime

**In everyday language:** Current old/new tax election; effective fiscal-year history remains required.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “old” means Old income-tax regime.

Technical definition: Current old/new tax election; effective fiscal-year history remains required

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'new'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `tax_regime: Generated<'old' \| 'new'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `old` | Old income-tax regime | DB CHECK: employees_tax_regime_check |
| `new` | New income-tax regime | DB CHECK: employees_tax_regime_check |

Database rules (including conditions shared with other fields):

- `employees_tax_regime_check`: `CHECK ((tax_regime = ANY (ARRAY['old'::text, 'new'::text])))`

### bank_name

**In everyday language:** Salary beneficiary bank name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A bank name identifies the institution holding the account; it is not enough on its own to make a payment.

Technical definition: Salary beneficiary bank name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `bank_name: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bank_account

**In everyday language:** Restricted salary beneficiary account number.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Restricted salary beneficiary account number

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `bank_account: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bank_ifsc

**In everyday language:** Restricted beneficiary routing code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The bank branch code helps direct a transfer to the correct branch; it must match the employee’s verified bank details.

Technical definition: Restricted beneficiary routing code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `bank_ifsc: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### payment_mode

**In everyday language:** Bank/cheque/payment-hold routing selection.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “bank” means Bank.

Technical definition: Bank/cheque/payment-hold routing selection

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'bank'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `payment_mode: Generated<'bank' \| 'cheque' \| 'hold'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `bank` | Bank. | DB CHECK: employees_payment_mode_check |
| `cheque` | Cheque. | DB CHECK: employees_payment_mode_check |
| `hold` | Hold. | DB CHECK: employees_payment_mode_check |

Database rules (including conditions shared with other fields):

- `employees_payment_mode_check`: `CHECK ((payment_mode = ANY (ARRAY['bank'::text, 'cheque'::text, 'hold'::text])))`

### access_card_no

**In everyday language:** Current source card mapping; does not rewrite protected against later changes external events.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A biometric or access-card reference may help match punches; it is different from the payroll employee code.

Technical definition: Current source card mapping; does not rewrite immutable external events

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `access_card_no: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### biometric_registered

**In everyday language:** Confirmed enrollment fact; cannot be inferred from ordinary checklist completion.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Confirmed enrollment fact; cannot be inferred from ordinary checklist completion

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `biometric_registered: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### attendance_mode

**In everyday language:** Biometric/mobile/manual attendance source expectation.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “biometric” means Biometric.

Technical definition: Biometric/mobile/manual attendance source expectation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'biometric'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `attendance_mode: Generated<'biometric' \| 'mobile' \| 'manual'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `biometric` | Biometric. | DB CHECK: employees_attendance_mode_check |
| `mobile` | Mobile. | DB CHECK: employees_attendance_mode_check |
| `manual` | Manual. | DB CHECK: employees_attendance_mode_check |

Database rules (including conditions shared with other fields):

- `employees_attendance_mode_check`: `CHECK ((attendance_mode = ANY (ARRAY['biometric'::text, 'mobile'::text, 'manual'::text])))`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### plant_id

**In everyday language:** Identifies plant connected to this record.

**Why it is kept:** Keeps this record connected to the correct plant, so related details can be checked together.

**Example:** This record points to an existing entry in plants instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s plant id to FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id); FOREIGN KEY (plant_id) REFERENCES core.plants(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `plant_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`
- `employees_plant_id_fkey`: `FOREIGN KEY (plant_id) REFERENCES core.plants(id)`

### hod_employee_id

**In everyday language:** Head of Department — the SECOND approver on claims, budgets and advances.

**Why it is kept:** Keeps this record connected to the correct hod employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Head of Department — the SECOND approver on claims, budgets and advances.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:397 |
| Code declaration | `hod_employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_hod_employee_id_fkey`: `FOREIGN KEY (hod_employee_id) REFERENCES core.employees(id)`
- `employees_hod_not_self`: `CHECK (((hod_employee_id IS NULL) OR (hod_employee_id <> id)))`

### pf_wage_basis

**In everyday language:** Employee-specific provident fund wage-base policy override.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “ACTUAL” means provident fund calculation on actual configured eligible wages.

Technical definition: Employee-specific PF wage-base policy override

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `pf_wage_basis: PfWageBasisColumn \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `ACTUAL` | PF calculation on actual configured eligible wages | DB CHECK: employees_pf_wage_basis_check |
| `CEILING_15000` | PF wage basis capped at the configured ceiling; code retains the legacy 15000 label | DB CHECK: employees_pf_wage_basis_check |

Database rules (including conditions shared with other fields):

- `employees_pf_wage_basis_check`: `CHECK ((pf_wage_basis = ANY (ARRAY['ACTUAL'::text, 'CEILING_15000'::text])))`

### epf_member_before_sep2014

**In everyday language:** REQ-003 Employees’ Provident Fund Form 11 facts (Employees’ Pension Scheme membership).

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: REQ-003 EPF Form 11 facts (EPS membership).

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:373 |
| Code declaration | `epf_member_before_sep2014: boolean \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### epf_first_enrolled_on

**In everyday language:** First Employees’ Provident Fund enrollment date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First EPF enrollment date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `epf_first_enrolled_on: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### epf_first_wages

**In everyday language:** Historical first enrollment wage fact for Employees’ Pension Scheme review.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Historical first enrollment wage fact for EPS review

| Property | Definition |
|---|---|
| SQL type | `numeric(12,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `epf_first_wages: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_epf_first_wages_check`: `CHECK (((epf_first_wages IS NULL) OR (epf_first_wages >= (0)::numeric)))`

### international_worker

**In everyday language:** International-worker provident fund eligibility fact, not nationality inference.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: International-worker PF eligibility fact, not nationality inference

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `international_worker: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### eps_eligible

**In everyday language:** Approved Employees’ Pension Scheme membership eligibility fact; requires effective/closed to ordinary changes source ownership.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Approved EPS membership eligibility fact; requires effective/frozen source ownership

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `eps_eligible: boolean \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### father_name

**In everyday language:** Joining-form paternal identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the father name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Joining-form paternal identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `father_name: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### spouse_name

**In everyday language:** Joining-form spouse identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the spouse name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Joining-form spouse identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `spouse_name: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### form11_relative

**In everyday language:** Father/spouse selection for statutory relative field.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “father” means Father.

Technical definition: Father/spouse selection for statutory relative field

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'father'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `form11_relative: Generated<'father' \| 'spouse'>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `father` | Father. | DB CHECK: employees_form11_relative_check |
| `spouse` | Spouse. | DB CHECK: employees_form11_relative_check |

Database rules (including conditions shared with other fields):

- `employees_form11_relative_check`: `CHECK ((form11_relative = ANY (ARRAY['father'::text, 'spouse'::text])))`

### marriage_date

**In everyday language:** Declared marriage calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Declared marriage calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `marriage_date: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### nationality

**In everyday language:** Declared nationality.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the nationality.

Technical definition: Declared nationality

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `nationality: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### country_of_origin

**In everyday language:** Declared origin country, distinct from payroll company jurisdiction.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the country of origin shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Declared origin country, distinct from payroll company jurisdiction

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `country_of_origin: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### religion

**In everyday language:** Optional restricted joining-form demographic data.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the religion.

Technical definition: Optional restricted joining-form demographic data

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `religion: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### caste

**In everyday language:** Optional restricted joining-form demographic data.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the caste.

Technical definition: Optional restricted joining-form demographic data

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `caste: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### height_cm

**In everyday language:** Joining/master physical measurement; distinguish from dated medical examination.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** 170 means a height of 170 centimetres; it is sensitive medical information.

Technical definition: Joining/master physical measurement; distinguish from dated medical examination

| Property | Definition |
|---|---|
| SQL type | `numeric(5,1)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `height_cm: Num;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_height_cm_check`: `CHECK (((height_cm IS NULL) OR ((height_cm >= (50)::numeric) AND (height_cm <= (250)::numeric))))`

### weight_kg

**In everyday language:** Joining/master physical measurement; distinguish from dated medical examination.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** 65 means a weight of 65 kilograms; it is sensitive medical information.

Technical definition: Joining/master physical measurement; distinguish from dated medical examination

| Property | Definition |
|---|---|
| SQL type | `numeric(5,1)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `weight_kg: Num;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_weight_kg_check`: `CHECK (((weight_kg IS NULL) OR ((weight_kg >= (20)::numeric) AND (weight_kg <= (300)::numeric))))`

### is_pwd

**In everyday language:** Declared disability status.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Declared disability status

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_pwd: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### disability_type

**In everyday language:** Declared disability classification.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the disability type.

Technical definition: Declared disability classification

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `disability_type: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### disability_pct

**In everyday language:** Declared assessed disability percentage.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Declared assessed disability percentage

| Property | Definition |
|---|---|
| SQL type | `numeric(5,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `disability_pct: Num;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_disability_pct_check`: `CHECK (((disability_pct IS NULL) OR ((disability_pct >= (0)::numeric) AND (disability_pct <= (100)::numeric))))`

### identification_mark

**In everyday language:** Physical identification description.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the identification mark.

Technical definition: Physical identification description

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `identification_mark: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### passport_no

**In everyday language:** Restricted passport identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Restricted passport identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `passport_no: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### passport_valid_until

**In everyday language:** Passport expiry calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Passport expiry calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `passport_valid_until: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### driving_licence_no

**In everyday language:** Restricted driving-licence identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Restricted driving-licence identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `driving_licence_no: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### driving_licence_valid_until

**In everyday language:** Licence expiry calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Licence expiry calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `driving_licence_valid_until: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### name_as_per_aadhaar

**In everyday language:** Statutory identity-matching name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name as per aadhaar shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Statutory identity-matching name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name_as_per_aadhaar: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### aadhaar_linked_mobile

**In everyday language:** Whether Aadhaar has a linked mobile; not a second stored phone number.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether Aadhaar has a linked mobile; not a second stored phone number

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `aadhaar_linked_mobile: boolean \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### emergency_contact_relation

**In everyday language:** Emergency person's relationship.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the emergency contact relation.

Technical definition: Emergency person's relationship

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `emergency_contact_relation: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### emergency_contact_alt_phone

**In everyday language:** Alternate emergency telephone.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the emergency contact alt phone.

Technical definition: Alternate emergency telephone

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `emergency_contact_alt_phone: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### emergency_contact_address

**In everyday language:** Emergency person's address.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the emergency contact address.

Technical definition: Emergency person's address

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `emergency_contact_address: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bank_branch

**In everyday language:** Beneficiary bank branch descriptor.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the bank branch.

Technical definition: Beneficiary bank branch descriptor

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `bank_branch: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bank_account_holder

**In everyday language:** Verified account beneficiary name; bank output must choose this rather than infer employee name.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Verified account beneficiary name; bank output must choose this rather than infer employee name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `bank_account_holder: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bank_account_type

**In everyday language:** Savings/current beneficiary account classification.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “savings” means Savings.

Technical definition: Savings/current beneficiary account classification

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `bank_account_type: 'savings' \| 'current' \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `savings` | Savings. | DB CHECK: employees_bank_account_type_check |
| `current` | Current. | DB CHECK: employees_bank_account_type_check |

Database rules (including conditions shared with other fields):

- `employees_bank_account_type_check`: `CHECK (((bank_account_type IS NULL) OR (bank_account_type = ANY (ARRAY['savings'::text, 'current'::text]))))`

### joining_form_date

**In everyday language:** Joining application execution date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Joining application execution date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `joining_form_date: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bgv_status

**In everyday language:** Background-verification process status.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “not_started” means Not started.

Technical definition: Background-verification process status

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `bgv_status: 'not_started' \| 'initiated' \| 'cleared' \| 'failed' \| 'not_applicable' \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `not_started` | Not started. | DB CHECK: employees_bgv_status_check |
| `initiated` | Initiated. | DB CHECK: employees_bgv_status_check |
| `cleared` | Cleared. | DB CHECK: employees_bgv_status_check |
| `failed` | Operation/delivery attempt failed | DB CHECK: employees_bgv_status_check |
| `not_applicable` | Not applicable. | DB CHECK: employees_bgv_status_check |

Database rules (including conditions shared with other fields):

- `employees_bgv_status_check`: `CHECK (((bgv_status IS NULL) OR (bgv_status = ANY (ARRAY['not_started'::text, 'initiated'::text, 'cleared'::text, 'failed'::text, 'not_applicable'::text]))))`

### induction_date

**In everyday language:** Completed induction calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Completed induction calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `induction_date: DateCol;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### joining_signed_off_by

**In everyday language:** Identifies joining signed off by connected to this record.

**Why it is kept:** Keeps this record connected to the correct joining signed off by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s joining signed off by to FOREIGN KEY (joining_signed_off_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `joining_signed_off_by: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employees_joining_signed_off_by_fkey`: `FOREIGN KEY (joining_signed_off_by) REFERENCES core.users(id)`

### joining_signed_off_at

**In everyday language:** HR joining-form sign-off receipt, distinct from actual date of joining.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: HR joining-form sign-off receipt, distinct from actual DOJ

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `joining_signed_off_at: ColumnType<Date \| null, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `employees_ecode_key`: `CREATE UNIQUE INDEX employees_ecode_key ON core.employees USING btree (ecode)`
- Index `employees_ecode_trgm`: `CREATE INDEX employees_ecode_trgm ON core.employees USING gin (lower(ecode) gin_trgm_ops)`
- Index `employees_fullname_trgm`: `CREATE INDEX employees_fullname_trgm ON core.employees USING gin (lower(((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text))) gin_trgm_ops)`
- Index `employees_hod_idx`: `CREATE INDEX employees_hod_idx ON core.employees USING btree (hod_employee_id) WHERE (hod_employee_id IS NOT NULL)`
- Index `employees_pkey`: `CREATE UNIQUE INDEX employees_pkey ON core.employees USING btree (id)`
- Index `employees_rm_idx`: `CREATE INDEX employees_rm_idx ON core.employees USING btree (reporting_manager_id)`
- Index `employees_status_company_idx`: `CREATE INDEX employees_status_company_idx ON core.employees USING btree (status, company_id)`
- Index `employees_work_email_key`: `CREATE UNIQUE INDEX employees_work_email_key ON core.employees USING btree (work_email)`
- Trigger `employees_reporting_tree` → `core.rebuild_reporting_tree` (enabled flag `O`).
- Trigger `employees_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.grades

Lists employee grades used for employment and policy classification.

Grades records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `grades_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Stable grade/pay-band code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable grade/pay-band code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `grades_code_key`: `UNIQUE (code)`

### name

**In everyday language:** Grade display name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Grade display name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rank

**In everyday language:** Grade ordering for leadership/eligibility thresholds.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Grade ordering for leadership/eligibility thresholds

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `rank: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `grades_code_key`: `CREATE UNIQUE INDEX grades_code_key ON core.grades USING btree (code)`
- Index `grades_pkey`: `CREATE UNIQUE INDEX grades_pkey ON core.grades USING btree (id)`
- Trigger `grades_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.letter_templates

Keeps reusable wording and layouts for HR letters.

core.letter_templates — CORE-09; body is runtime-editable data.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letter_templates_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Stable letter type/template identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable letter type/template identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letter_templates_code_key`: `UNIQUE (code)`

### name

**In everyday language:** HR-facing template name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: HR-facing template name

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### body_template

**In everyday language:** Text merge template, alternative representation to stored DOCX source requiring renderer selection.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Text merge template, alternative representation to stored DOCX source requiring renderer selection

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `body_template: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### body_docx_document_id

**In everyday language:** Identifies body docx document connected to this record.

**Why it is kept:** Keeps this record connected to the correct body docx document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s body docx document id to FOREIGN KEY (body_docx_document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `body_docx_document_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letter_templates_body_docx_document_id_fkey`: `FOREIGN KEY (body_docx_document_id) REFERENCES core.documents(id)`

### merge_fields

**In everyday language:** Declared allowed merge-field contract.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the merge fields.

Technical definition: Declared allowed merge-field contract

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `merge_fields: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_active

**In everyday language:** Template availability for new issuance.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Template availability for new issuance

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `letter_templates_code_key`: `CREATE UNIQUE INDEX letter_templates_code_key ON core.letter_templates USING btree (code)`
- Index `letter_templates_pkey`: `CREATE UNIQUE INDEX letter_templates_pkey ON core.letter_templates USING btree (id)`
- Trigger `letter_templates_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.letters

Records HR letters issued to employees.

core.letters — issued letters; NULL issued_at = awaiting signature (PP-14).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letters_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letters_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### template_code

**In everyday language:** Letter template identity used at rendering; historical rendered body must remain closed to ordinary changes.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Letter template identity used at rendering; historical rendered body must remain frozen

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `template_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### document_id

**In everyday language:** Identifies document connected to this record.

**Why it is kept:** Keeps this record connected to the correct document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s document id to FOREIGN KEY (document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `document_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letters_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES core.documents(id)`

### issued_by

**In everyday language:** Identifies issued by connected to this record.

**Why it is kept:** Keeps this record connected to the correct issued by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s issued by to FOREIGN KEY (issued_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `issued_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letters_issued_by_fkey`: `FOREIGN KEY (issued_by) REFERENCES core.users(id)`

### issued_at

**In everyday language:** Formal issuance instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Formal issuance instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `issued_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### workflow_request_id

**In everyday language:** Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database link to another record is present.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This record points to an existing entry in requests instead of copying all of that entry’s details.

Technical definition: Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database FK is present.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `workflow_request_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `letters_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### body_rendered

**In everyday language:** Rendered letter content copy saved at that point in time; distinct from reusable template and exported object.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Rendered letter content snapshot; distinct from reusable template and exported object

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `body_rendered: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Draft/issued/withdrawn progress from creation to closure controlling ESS visibility.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “draft” means Editable draft before submission/preparation.

Technical definition: Draft/issued/withdrawn lifecycle controlling ESS visibility

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'issued'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'draft' \| 'pending_signature' \| 'issued'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: letters_status_check |
| `pending_signature` | Record is pending signature in this lifecycle. | DB CHECK: letters_status_check |
| `issued` | Record is issued in this lifecycle. | DB CHECK: letters_status_check |

Database rules (including conditions shared with other fields):

- `letters_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'pending_signature'::text, 'issued'::text])))`

Table indexes and lifecycle triggers:

- Index `letters_emp_idx`: `CREATE INDEX letters_emp_idx ON core.letters USING btree (employee_id)`
- Index `letters_pkey`: `CREATE UNIQUE INDEX letters_pkey ON core.letters USING btree (id)`
- Index `letters_wf_idx`: `CREATE UNIQUE INDEX letters_wf_idx ON core.letters USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL)`
- Trigger `letters_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.locations

Lists work locations.

Locations records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `locations_id_company_uk`: `UNIQUE (id, company_id)`
- `locations_pkey`: `PRIMARY KEY (id)`

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `locations_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `locations_company_id_name_key`: `UNIQUE (company_id, name)`
- `locations_id_company_uk`: `UNIQUE (id, company_id)`

### name

**In everyday language:** Physical site label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Physical site label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `locations_company_id_name_key`: `UNIQUE (company_id, name)`

### state_code

**In everyday language:** Work-location state selecting configured state statutory rules.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A stored state code selects the applicable state or address jurisdiction; it does not represent a company code.

Technical definition: Work-location state selecting configured state statutory rules

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `state_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### timezone

**In everyday language:** Location timezone descriptive information; current attendance business-date contract is IST.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the timezone.

Technical definition: Location timezone metadata; current attendance business-date contract is IST

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'Asia/Kolkata'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `timezone: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `locations_company_id_name_key`: `CREATE UNIQUE INDEX locations_company_id_name_key ON core.locations USING btree (company_id, name)`
- Index `locations_id_company_uk`: `CREATE UNIQUE INDEX locations_id_company_uk ON core.locations USING btree (id, company_id)`
- Index `locations_pkey`: `CREATE UNIQUE INDEX locations_pkey ON core.locations USING btree (id)`
- Trigger `locations_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.mis_codes

Lists management-reporting codes used to classify employees or organizational costs.

Mis codes records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mis_codes_id_company_uk`: `UNIQUE (id, company_id)`
- `mis_codes_pkey`: `PRIMARY KEY (id)`

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mis_codes_company_id_code_key`: `UNIQUE (company_id, code)`
- `mis_codes_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `mis_codes_id_company_uk`: `UNIQUE (id, company_id)`
- `mis_codes_parent_company_fk`: `FOREIGN KEY (parent_id, company_id) REFERENCES core.mis_codes(id, company_id)`

### code

**In everyday language:** Company-scoped MIS reporting code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Company-scoped MIS reporting code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mis_codes_code_check`: `CHECK ((length(btrim(code)) > 0))`
- `mis_codes_company_id_code_key`: `UNIQUE (company_id, code)`

### name

**In everyday language:** MIS rollup label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: MIS rollup label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### parent_id

**In everyday language:** Identifies the parent entry connected to this record.

**Why it is kept:** Keeps this record connected to the correct parent entry, so related details can be checked together.

**Example:** This record points to an existing entry in mis codes instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s parent id to FOREIGN KEY (parent_id, company_id) REFERENCES core.mis_codes(id, company_id); FOREIGN KEY (parent_id) REFERENCES core.mis_codes(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `parent_id: number \| null;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mis_codes_parent_company_fk`: `FOREIGN KEY (parent_id, company_id) REFERENCES core.mis_codes(id, company_id)`
- `mis_codes_parent_id_fkey`: `FOREIGN KEY (parent_id) REFERENCES core.mis_codes(id)`

### is_active

**In everyday language:** Master availability without deleting historical references.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Master availability without deleting historical references

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `mis_codes_company_id_code_key`: `CREATE UNIQUE INDEX mis_codes_company_id_code_key ON core.mis_codes USING btree (company_id, code)`
- Index `mis_codes_id_company_uk`: `CREATE UNIQUE INDEX mis_codes_id_company_uk ON core.mis_codes USING btree (id, company_id)`
- Index `mis_codes_pkey`: `CREATE UNIQUE INDEX mis_codes_pkey ON core.mis_codes USING btree (id)`
- Trigger `mis_codes_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.nomination_declarations

Keeps employees’ declarations supporting their benefit nominations.

Nomination declarations records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `nomination_declarations_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `nomination_declarations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id) ON DELETE CASCADE`
- `nomination_declarations_employee_id_scheme_version_key`: `UNIQUE (employee_id, scheme, version)`

### scheme

**In everyday language:** Scheme to which signed declaration applies.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “pf” means Provident fund.

Technical definition: Scheme to which signed declaration applies

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `scheme: NominationScheme;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pf` | Provident fund | DB CHECK: nomination_declarations_scheme_check |
| `eps` | Employees Pension Scheme | DB CHECK: nomination_declarations_scheme_check |
| `gratuity` | Gratuity. | DB CHECK: nomination_declarations_scheme_check |
| `esic` | Employees State Insurance | DB CHECK: nomination_declarations_scheme_check |
| `gpa` | Group personal accident cover | DB CHECK: nomination_declarations_scheme_check |
| `gmc` | Group medical cover | DB CHECK: nomination_declarations_scheme_check |
| `gtli` | Group term life insurance | DB CHECK: nomination_declarations_scheme_check |

Database rules (including conditions shared with other fields):

- `nomination_declarations_employee_id_scheme_version_key`: `UNIQUE (employee_id, scheme, version)`
- `nomination_declarations_scheme_check`: `CHECK ((scheme = ANY (ARRAY['pf'::text, 'eps'::text, 'gratuity'::text, 'esic'::text, 'gpa'::text, 'gmc'::text, 'gtli'::text])))`

### version

**In everyday language:** Nomination-set version bound to declaration.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Nomination-set version bound to declaration

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `version: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `nomination_declarations_employee_id_scheme_version_key`: `UNIQUE (employee_id, scheme, version)`
- `nomination_declarations_version_check`: `CHECK ((version > 0))`

### status

**In everyday language:** Active/superseded signed declaration version.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “active” means Record is active in this progress from creation to closure.

Technical definition: Active/superseded signed declaration version

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'active'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'active' \| 'superseded'>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `active` | Record is active in this lifecycle. | DB CHECK: nomination_declarations_status_check |
| `superseded` | Record is superseded in this lifecycle. | DB CHECK: nomination_declarations_status_check |

Database rules (including conditions shared with other fields):

- `nomination_declarations_status_check`: `CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text])))`

### statements

**In everyday language:** Scheme-specific signed assertions copy saved at that point in time.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the statements.

Technical definition: Scheme-specific signed assertions snapshot

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | '{}'::jsonb |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `statements: ColumnType<Record<string, unknown>, string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### witness1_name

**In everyday language:** First witness identity copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the witness1 name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: First witness identity snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `witness1_name: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### witness1_address

**In everyday language:** First witness address copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the witness1 address.

Technical definition: First witness address snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `witness1_address: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### witness2_name

**In everyday language:** Second witness identity copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the witness2 name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Second witness identity snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `witness2_name: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### witness2_address

**In everyday language:** Second witness address copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the witness2 address.

Technical definition: Second witness address snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `witness2_address: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### declared_at

**In everyday language:** Declaration execution instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Declaration execution instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `declared_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### declared_by

**In everyday language:** Identifies declared by connected to this record.

**Why it is kept:** Keeps this record connected to the correct declared by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s declared by to FOREIGN KEY (declared_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `declared_by: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `nomination_declarations_declared_by_fkey`: `FOREIGN KEY (declared_by) REFERENCES core.users(id)`

### employer_verified_by

**In everyday language:** Identifies employer verified by connected to this record.

**Why it is kept:** Keeps this record connected to the correct employer verified by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s employer verified by to FOREIGN KEY (employer_verified_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `employer_verified_by: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `nomination_declarations_employer_verified_by_fkey`: `FOREIGN KEY (employer_verified_by) REFERENCES core.users(id)`

### employer_verified_at

**In everyday language:** Employer verification receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Employer verification receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `employer_verified_at: ColumnType<Date \| null, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### employer_reference_no

**In everyday language:** Employer declaration/form reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the employer reference no shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Employer declaration/form reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `employer_reference_no: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### employer_signatory_designation

**In everyday language:** Authorized signatory's title copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the employer signatory designation shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Authorized signatory's title snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `employer_signatory_designation: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### employee_acknowledged_at

**In everyday language:** Employee acknowledgement receipt.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Employee acknowledgement receipt

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `employee_acknowledged_at: ColumnType<Date \| null, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `nomination_declarations_employee_id_scheme_version_key`: `CREATE UNIQUE INDEX nomination_declarations_employee_id_scheme_version_key ON core.nomination_declarations USING btree (employee_id, scheme, version)`
- Index `nomination_declarations_one_active`: `CREATE UNIQUE INDEX nomination_declarations_one_active ON core.nomination_declarations USING btree (employee_id, scheme) WHERE (status = 'active'::text)`
- Index `nomination_declarations_pkey`: `CREATE UNIQUE INDEX nomination_declarations_pkey ON core.nomination_declarations USING btree (id)`
- Trigger `nomination_declarations_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.onboarding_candidates

Keeps accepted-offer candidates separate from employees until actual joining is confirmed.

core.onboarding_candidates — LC-01 candidate intake bridge.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_candidates_pkey`: `PRIMARY KEY (id)`

### ats_candidate_id

**In everyday language:** External ATS candidate identity, intentionally not cross-database link to another record.

**Why it is kept:** Keeps this record connected to the correct ats candidate, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: External ATS candidate identity, intentionally not cross-database FK

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ats_candidate_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### loi_reference

**In everyday language:** Source offer/LOI reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Source offer/LOI reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `loi_reference: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### full_name

**In everyday language:** Accepted-offer candidate name before employee creation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An invented display name such as “Sample Employee” lets staff read the person’s name in full.

Technical definition: Accepted-offer candidate name before employee creation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `full_name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### personal_email

**In everyday language:** Prejoin delivery/contact address.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A personal address such as sample@example.com is separate from the person’s company email.

Technical definition: Prejoin delivery/contact address

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `personal_email: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### mobile

**In everyday language:** Candidate contact telephone.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A phone contact allows an authorized HR process to reach the person; no actual phone number is shown.

Technical definition: Candidate contact telephone

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `mobile: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### dob

**In everyday language:** Candidate birth date for validated conversion.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Candidate birth date for validated conversion

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `dob: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### address

**In everyday language:** Candidate contact address copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An address tells staff the place associated with this particular person or organization; it is not automatically a work location.

Technical definition: Candidate contact address snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `address: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### total_experience_years

**In everyday language:** Declared experience used in offer report.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Declared experience used in offer report

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `total_experience_years: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### previous_company

**In everyday language:** Prior employer offer-history copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the previous company.

Technical definition: Prior employer offer-history snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `previous_company: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### current_salary

**In everyday language:** Candidate's prior/current offered-against salary, not HRMS pay authority.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A candidate’s reported current salary describes their earlier employment, not the company’s approved offer.

Technical definition: Candidate's prior/current offered-against salary, not HRMS pay authority

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `current_salary: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### expected_salary

**In everyday language:** Candidate expectation, not approved payroll entitlement.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The candidate’s salary expectation is a request, not a promised salary.

Technical definition: Candidate expectation, not approved payroll entitlement

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `expected_salary: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### position_title

**In everyday language:** Requisition/offer title.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the position title shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Requisition/offer title

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `position_title: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### department

**In everyday language:** Prejoin department label requiring main master resolution.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the department shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Prejoin department label requiring canonical master resolution

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `department: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### org_unit

**In everyday language:** Prejoin organization label requiring main resolution.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the org unit.

Technical definition: Prejoin organization label requiring canonical resolution

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `org_unit: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### designation

**In everyday language:** Prejoin designation label requiring main resolution.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the designation shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Prejoin designation label requiring canonical resolution

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `designation: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_candidates_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### category

**In everyday language:** Offered employment category.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The saved category helps a reviewer group similar records; its meaning depends on the register being viewed.

Technical definition: Offered employment category

| Property | Definition |
|---|---|
| SQL type | `core.employment_category` |
| Required | Yes |
| Default | 'white_collar'::core.employment_category |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `category: EmploymentCategory;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### replacement_of_ecode

**In everyday language:** Replaced employee's source code/reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Replaced employee's source code/reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `replacement_of_ecode: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### offered_ctc

**In everyday language:** Accepted annual offer cost to company (the total employment cost) used to establish approved joining salary.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Accepted annual offer CTC used to establish approved joining salary

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `offered_ctc: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### probation_months

**In everyday language:** Offer probation duration.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Offer probation duration

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | 6 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `probation_months: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### probation_salary_pct

**In everyday language:** Offer probation pay ratio.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An illustrative 80% means the configured proportion of confirmed salary during probation; it is not a policy recommendation.

Technical definition: Offer probation pay ratio

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | 100 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `probation_salary_pct: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### proposed_doj

**In everyday language:** Planned joining date; does not authorize permanent employee creation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Planned joining date; does not authorize permanent employee creation

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `proposed_doj: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### offer_date

**In everyday language:** Offer issuance calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Offer issuance calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `offer_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### work_location

**In everyday language:** Source offered location label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the work location shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Source offered location label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `work_location: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prejoin_link_token

**In everyday language:** Legacy column constrained not recorded; plaintext bearer credentials forbidden.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Legacy column constrained NULL; plaintext bearer credentials forbidden

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prejoin_link_token: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_candidates_prejoin_link_token_key`: `UNIQUE (prejoin_link_token)`
- `prejoin_raw_token_forbidden`: `CHECK ((prejoin_link_token IS NULL))`

### prejoin_token_hash

**In everyday language:** a digital fingerprint used to check that information matches authorization digital fingerprint for finite-lived prejoin link.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: SHA256 authorization digest for finite-lived prejoin link

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prejoin_token_hash: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prejoin_token_expires_at

**In everyday language:** Configured link expiration.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Configured link expiration

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prejoin_token_expires_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prejoin_link_sent_at

**In everyday language:** Actual delivery receipt; generation/enqueue alone must not imply delivery.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Actual delivery receipt; generation/enqueue alone must not imply delivery

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prejoin_link_sent_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prejoin_completed_at

**In everyday language:** Accepted one-time form submission instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Accepted one-time form submission instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prejoin_completed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prejoin_submitted_data

**In everyday language:** Submitted application copy saved at that point in time awaiting HR acceptance/actual joining.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the prejoin submitted data.

Technical definition: Submitted application snapshot awaiting HR acceptance/actual joining

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prejoin_submitted_data: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Separate preboarding/waiting/submitted/converted/no-show state.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “awaiting_prejoin” means Accepted-offer candidate awaiting pre-joining completion; no permanent employee created.

Technical definition: Separate preboarding/waiting/submitted/converted/no-show state

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'awaiting_prejoin'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'awaiting_prejoin' \| 'link_sent' \| 'prejoin_done' \| 'converted' \| 'no_show'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `awaiting_prejoin` | Accepted-offer candidate awaiting pre-joining completion; no permanent employee created | DB CHECK: onboarding_candidates_status_check |
| `link_sent` | Record is link sent in this lifecycle. | DB CHECK: onboarding_candidates_status_check |
| `prejoin_done` | Pre-joining information completed; joining confirmation still required | DB CHECK: onboarding_candidates_status_check |
| `converted` | Candidate converted to an employee after joining confirmation | DB CHECK: onboarding_candidates_status_check |
| `no_show` | Candidate did not join | DB CHECK: onboarding_candidates_status_check |

Database rules (including conditions shared with other fields):

- `onboarding_candidates_status_check`: `CHECK ((status = ANY (ARRAY['awaiting_prejoin'::text, 'link_sent'::text, 'prejoin_done'::text, 'converted'::text, 'no_show'::text])))`

### employee_id

**In everyday language:** The employee record created after this candidate’s actual joining is confirmed, if conversion has occurred.

**Why it is kept:** Links the earlier candidate information to the person’s employment record without treating every accepted offer as a joining.

**Example:** A candidate who accepts an offer but never joins does not receive a permanent employee record through this link.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_candidates_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prejoin_draft_data

**In everyday language:** Autosaved mutable candidate form before submission; not current main employee register.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the prejoin draft data.

Technical definition: Autosaved mutable candidate form before submission; not current employee master

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `prejoin_draft_data: unknown;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gender

**In everyday language:** Candidate gender to preserve on conversion.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “Male” means Male.

Technical definition: Candidate gender to preserve on conversion

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `gender: GenderCode \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `Male` | Male. | DB CHECK: onboarding_candidates_gender_check |
| `Female` | Female. | DB CHECK: onboarding_candidates_gender_check |
| `Transgender` | Transgender. | DB CHECK: onboarding_candidates_gender_check |

Database rules (including conditions shared with other fields):

- `onboarding_candidates_gender_check`: `CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Transgender'::text]))))`

Table indexes and lifecycle triggers:

- Index `onboarding_candidates_company_idx`: `CREATE INDEX onboarding_candidates_company_idx ON core.onboarding_candidates USING btree (company_id)`
- Index `onboarding_candidates_pkey`: `CREATE UNIQUE INDEX onboarding_candidates_pkey ON core.onboarding_candidates USING btree (id)`
- Index `onboarding_candidates_prejoin_link_token_key`: `CREATE UNIQUE INDEX onboarding_candidates_prejoin_link_token_key ON core.onboarding_candidates USING btree (prejoin_link_token)`
- Index `onboarding_candidates_status_idx`: `CREATE INDEX onboarding_candidates_status_idx ON core.onboarding_candidates USING btree (status)`

## core.onboarding_tasks

Tracks joining tasks assigned to HR, IT, Admin and Payroll.

core.onboarding_tasks — LC-02 post-conversion task checklist.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_tasks_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_tasks_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### candidate_id

**In everyday language:** Identifies the candidate connected to this record.

**Why it is kept:** Keeps this record connected to the correct candidate, so related details can be checked together.

**Example:** This record points to an existing entry in onboarding candidates instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s candidate id to FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `candidate_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_tasks_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id)`

### task_code

**In everyday language:** Stable checklist obligation identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable checklist obligation identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `task_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### task_name

**In everyday language:** Stakeholder-readable obligation label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the task name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Stakeholder-readable obligation label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `task_name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### department

**In everyday language:** Responsible stakeholder function.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “IT” means It.

Technical definition: Responsible stakeholder function

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `department: 'IT' \| 'Admin' \| 'HR' \| 'Payroll';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `IT` | It. | DB CHECK: onboarding_tasks_department_check |
| `Admin` | Admin. | DB CHECK: onboarding_tasks_department_check |
| `HR` | Hr. | DB CHECK: onboarding_tasks_department_check |
| `Payroll` | Payroll. | DB CHECK: onboarding_tasks_department_check |

Database rules (including conditions shared with other fields):

- `onboarding_tasks_department_check`: `CHECK ((department = ANY (ARRAY['IT'::text, 'Admin'::text, 'HR'::text, 'Payroll'::text])))`

### owner_role

**In everyday language:** Configured routing role name; not a stored resolved assignee.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the owner role shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Configured routing role name; not a stored resolved assignee

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `owner_role: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### due_date

**In everyday language:** Obligation deadline calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Obligation deadline calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `due_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sla_hours

**In everyday language:** Configured escalation duration.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured escalation duration

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 48 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sla_hours: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Open/done/escalated checklist state.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “open” means Record is open in this progress from creation to closure.

Technical definition: Open/done/escalated checklist state

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'open'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'open' \| 'completed' \| 'escalated'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `open` | Record is open in this lifecycle. | DB CHECK: onboarding_tasks_status_check |
| `completed` | Record is completed in this lifecycle. | DB CHECK: onboarding_tasks_status_check |
| `escalated` | Record is escalated in this lifecycle. | DB CHECK: onboarding_tasks_status_check |

Database rules (including conditions shared with other fields):

- `onboarding_tasks_status_check`: `CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text, 'escalated'::text])))`

### escalated_at

**In everyday language:** Escalation attempt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Escalation attempt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `escalated_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### done_by

**In everyday language:** Identifies done by connected to this record.

**Why it is kept:** Keeps this record connected to the correct done by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s done by to FOREIGN KEY (done_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `done_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `onboarding_tasks_done_by_fkey`: `FOREIGN KEY (done_by) REFERENCES core.users(id)`

### done_at

**In everyday language:** Task-completion receipt.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Task-completion receipt

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `done_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notes

**In everyday language:** Stakeholder execution explanation.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Stakeholder execution explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `notes: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `onboarding_tasks_emp_idx`: `CREATE INDEX onboarding_tasks_emp_idx ON core.onboarding_tasks USING btree (employee_id)`
- Index `onboarding_tasks_pkey`: `CREATE UNIQUE INDEX onboarding_tasks_pkey ON core.onboarding_tasks USING btree (id)`
- Index `onboarding_tasks_status_idx`: `CREATE INDEX onboarding_tasks_status_idx ON core.onboarding_tasks USING btree (status, due_date)`

## core.org_units

Lists organizational units and their reporting hierarchy.

Org units records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `org_units_id_company_uk`: `UNIQUE (id, company_id)`
- `org_units_pkey`: `PRIMARY KEY (id)`

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `org_units_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `org_units_id_company_uk`: `UNIQUE (id, company_id)`

### parent_id

**In everyday language:** Identifies the parent entry connected to this record.

**Why it is kept:** Keeps this record connected to the correct parent entry, so related details can be checked together.

**Example:** This record points to an existing entry in org units instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s parent id to FOREIGN KEY (parent_id) REFERENCES core.org_units(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `parent_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `org_units_parent_id_fkey`: `FOREIGN KEY (parent_id) REFERENCES core.org_units(id)`

### name

**In everyday language:** Company organization hierarchy label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Company organization hierarchy label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `org_units_id_company_uk`: `CREATE UNIQUE INDEX org_units_id_company_uk ON core.org_units USING btree (id, company_id)`
- Index `org_units_pkey`: `CREATE UNIQUE INDEX org_units_pkey ON core.org_units USING btree (id)`
- Trigger `org_units_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.password_reset_tokens

Keeps temporary password-reset proof without storing a usable reset link in plain text.

Password reset tokens records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `password_reset_tokens_pkey`: `PRIMARY KEY (id)`

### user_id

**In everyday language:** Identifies the login account connected to this record.

**Why it is kept:** Keeps this record connected to the correct login account, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s user id to FOREIGN KEY (user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `user_id: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `password_reset_tokens_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

### token_hash

**In everyday language:** digital fingerprint of opaque one-time reset credential, never its plaintext.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Digest of opaque one-time reset credential, never its plaintext

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `token_hash: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `password_reset_tokens_token_hash_key`: `UNIQUE (token_hash)`

### expires_at

**In everyday language:** Reset credential cutoff.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Reset credential cutoff

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `expires_at: Timestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### used_at

**In everyday language:** One-way redemption marker.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: One-way redemption marker

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `used_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `password_reset_tokens_open`: `CREATE INDEX password_reset_tokens_open ON core.password_reset_tokens USING btree (user_id) WHERE (used_at IS NULL)`
- Index `password_reset_tokens_pkey`: `CREATE UNIQUE INDEX password_reset_tokens_pkey ON core.password_reset_tokens USING btree (id)`
- Index `password_reset_tokens_token_hash_key`: `CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON core.password_reset_tokens USING btree (token_hash)`
- Index `password_reset_tokens_user`: `CREATE INDEX password_reset_tokens_user ON core.password_reset_tokens USING btree (user_id, created_at DESC)`

## core.permissions

Lists the individual actions that access administrators can allow.

core.permissions — module.action grid (CORE-10).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `permissions_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Runtime business capability identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Runtime business capability identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `permissions_code_key`: `UNIQUE (code)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `permissions_code_key`: `CREATE UNIQUE INDEX permissions_code_key ON core.permissions USING btree (code)`
- Index `permissions_pkey`: `CREATE UNIQUE INDEX permissions_pkey ON core.permissions USING btree (id)`
- Trigger `permissions_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.plants

Lists plants within the group.

Plants records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `plants_id_company_uk`: `UNIQUE (id, company_id)`
- `plants_pkey`: `PRIMARY KEY (id)`

### company_id

**In everyday language:** Legal entity that owns or scopes this record.

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Legal entity that owns or scopes this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `company_id: number;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `plants_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `plants_company_id_plant_code_key`: `UNIQUE (company_id, plant_code)`
- `plants_id_company_uk`: `UNIQUE (id, company_id)`
- `plants_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`

### plant_code

**In everyday language:** Company plant identity, distinct from cost-center code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Company plant identity, distinct from cost-center code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `plant_code: string;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `plants_company_id_plant_code_key`: `UNIQUE (company_id, plant_code)`
- `plants_plant_code_check`: `CHECK ((length(btrim(plant_code)) > 0))`

### name

**In everyday language:** Plant display label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Plant display label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### location_id

**In everyday language:** Identifies location connected to this record.

**Why it is kept:** Keeps this record connected to the correct location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s location id to FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id); FOREIGN KEY (location_id) REFERENCES core.locations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `location_id: number \| null;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `plants_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`
- `plants_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

### is_active

**In everyday language:** Plant availability for assignment.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Plant availability for assignment

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.org.ts](../../backend/src/core/db/types.org.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `plants_company_id_plant_code_key`: `CREATE UNIQUE INDEX plants_company_id_plant_code_key ON core.plants USING btree (company_id, plant_code)`
- Index `plants_id_company_uk`: `CREATE UNIQUE INDEX plants_id_company_uk ON core.plants USING btree (id, company_id)`
- Index `plants_pkey`: `CREATE UNIQUE INDEX plants_pkey ON core.plants USING btree (id)`
- Trigger `plants_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.policies

Keeps published company policies and their versions.

core.policies + acknowledgments — CORE-13 repository and live ack tracking.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `policies_pkey`: `PRIMARY KEY (id)`

### title

**In everyday language:** Policy publication headline.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the title shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Policy publication headline

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `title: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### document_id

**In everyday language:** Identifies document connected to this record.

**Why it is kept:** Keeps this record connected to the correct document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s document id to FOREIGN KEY (document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `document_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `policies_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES core.documents(id)`
- `policies_has_content`: `CHECK (((document_id IS NOT NULL) OR (body_summary IS NOT NULL)))`

### effective_date

**In everyday language:** Policy applicability date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Policy applicability date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `effective_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### requires_acknowledgment

**In everyday language:** Whether audience members owe a receipt.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether audience members owe a receipt

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `requires_acknowledgment: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### audience

**In everyday language:** Configured policy population selection.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the audience.

Technical definition: Configured policy population selection

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `audience: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_active

**In everyday language:** Publication withdrawal flag.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Publication withdrawal flag

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_by

**In everyday language:** User who created this record.

**Why it is kept:** Keeps this record connected to the correct person who created the record, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: User who created this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `policies_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### body_summary

**In everyday language:** Human-readable summary, not replacement for signed/stored policy document.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Human-readable summary, not replacement for signed/stored policy document

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `body_summary: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `policies_has_content`: `CHECK (((document_id IS NOT NULL) OR (body_summary IS NOT NULL)))`

Table indexes and lifecycle triggers:

- Index `policies_pkey`: `CREATE UNIQUE INDEX policies_pkey ON core.policies USING btree (id)`
- Trigger `policies_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.policy_acknowledgments

Records employees’ acknowledgment of published policies.

Policy acknowledgments records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `policy_acknowledgments_pkey`: `PRIMARY KEY (id)`

### policy_id

**In everyday language:** Identifies policy connected to this record.

**Why it is kept:** Keeps this record connected to the correct policy, so related details can be checked together.

**Example:** This record points to an existing entry in policies instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s policy id to FOREIGN KEY (policy_id) REFERENCES core.policies(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `policy_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `policy_acknowledgments_policy_id_employee_id_key`: `UNIQUE (policy_id, employee_id)`
- `policy_acknowledgments_policy_id_fkey`: `FOREIGN KEY (policy_id) REFERENCES core.policies(id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `policy_acknowledgments_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `policy_acknowledgments_policy_id_employee_id_key`: `UNIQUE (policy_id, employee_id)`

### acknowledged_at

**In everyday language:** Employee receipt of this exact policy record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Employee receipt of this exact policy record

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `acknowledged_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `policy_acknowledgments_pkey`: `CREATE UNIQUE INDEX policy_acknowledgments_pkey ON core.policy_acknowledgments USING btree (id)`
- Index `policy_acknowledgments_policy_id_employee_id_key`: `CREATE UNIQUE INDEX policy_acknowledgments_policy_id_employee_id_key ON core.policy_acknowledgments USING btree (policy_id, employee_id)`

## core.probation_reviews

Tracks probation review dates, recommendations and decisions.

core.probation_reviews — LC-04 probation review and confirmation.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `probation_reviews_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `probation_reviews_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### due_date

**In everyday language:** Review due date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Review due date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `due_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### manager_recommendation

**In everyday language:** Manager's proposed confirm/extend/terminate outcome.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “confirm” means Confirm.

Technical definition: Manager's proposed confirm/extend/terminate outcome

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `manager_recommendation: 'confirm' \| 'extend' \| 'separate' \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `confirm` | Confirm. | DB CHECK: probation_reviews_manager_recommendation_check |
| `extend` | Extend. | DB CHECK: probation_reviews_manager_recommendation_check |
| `separate` | Separate. | DB CHECK: probation_reviews_manager_recommendation_check |

Database rules (including conditions shared with other fields):

- `probation_reviews_manager_recommendation_check`: `CHECK ((manager_recommendation = ANY (ARRAY['confirm'::text, 'extend'::text, 'separate'::text])))`

### extension_months

**In everyday language:** Recommended/approved extension duration.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Recommended/approved extension duration

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `extension_months: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `probation_reviews_extension_months_check`: `CHECK (((extension_months >= 1) AND (extension_months <= 6)))`

### review_notes

**In everyday language:** Review explanation.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Review explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `review_notes: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ratings

**In everyday language:** Review assessment saved request or message details; require a defined validation schema.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the ratings.

Technical definition: Review assessment payload; require a defined validation schema

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ratings: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Review workflow state.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Review workflow state

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'pending'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'pending' \| 'under_review' \| 'completed'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: probation_reviews_status_check |
| `under_review` | Record is under review in this lifecycle. | DB CHECK: probation_reviews_status_check |
| `completed` | Record is completed in this lifecycle. | DB CHECK: probation_reviews_status_check |

Database rules (including conditions shared with other fields):

- `probation_reviews_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'under_review'::text, 'completed'::text])))`

### outcome

**In everyday language:** Final confirmed/extended/separated decision.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “confirmed” means Record is confirmed in this progress from creation to closure.

Technical definition: Final confirmed/extended/separated decision

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `outcome: 'confirmed' \| 'extended' \| 'separated' \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `confirmed` | Record is confirmed in this lifecycle. | DB CHECK: probation_reviews_outcome_check |
| `extended` | Record is extended in this lifecycle. | DB CHECK: probation_reviews_outcome_check |
| `separated` | Record is separated in this lifecycle. | DB CHECK: probation_reviews_outcome_check |

Database rules (including conditions shared with other fields):

- `probation_reviews_outcome_check`: `CHECK ((outcome = ANY (ARRAY['confirmed'::text, 'extended'::text, 'separated'::text])))`

### decided_by

**In everyday language:** Identifies decided by connected to this record.

**Why it is kept:** Keeps this record connected to the correct decided by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s decided by to FOREIGN KEY (decided_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `decided_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `probation_reviews_decided_by_fkey`: `FOREIGN KEY (decided_by) REFERENCES core.users(id)`

### decided_at

**In everyday language:** Decision receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Decision receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `decided_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### confirmation_date

**In everyday language:** Chosen effective confirmation date, distinct from decision time.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Chosen effective confirmation date, distinct from decision time

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `confirmation_date: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `probation_reviews_due_idx`: `CREATE INDEX probation_reviews_due_idx ON core.probation_reviews USING btree (due_date, status)`
- Index `probation_reviews_emp_idx`: `CREATE INDEX probation_reviews_emp_idx ON core.probation_reviews USING btree (employee_id)`
- Index `probation_reviews_pkey`: `CREATE UNIQUE INDEX probation_reviews_pkey ON core.probation_reviews USING btree (id)`

## core.profile_change_requests

Tracks employee requests to change personal information.

Profile change requests records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `profile_change_requests_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `profile_change_requests_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### field

**In everyday language:** Master change category, currently family requests.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A change-history entry can identify “work email” as the detail that changed.

Technical definition: Master change category, currently family requests

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `field: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### old_value

**In everyday language:** Before-image if captured; current family submission leaves it not recorded.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If a permitted detail changes, this preserves what it was before the change.

Technical definition: Before-image if captured; current family submission leaves it NULL

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `old_value: string \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### new_value

**In everyday language:** Requested master change a set of related details/text; may contain raw sensitive identifiers.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If a permitted detail changes, this preserves what was saved after the change.

Technical definition: Requested master change JSON/text; may contain raw sensitive identifiers

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `new_value: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Pending/approved/rejected change disposition.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Pending/approved/rejected change disposition

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'pending'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'pending' \| 'approved' \| 'rejected'>;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: profile_change_requests_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: profile_change_requests_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: profile_change_requests_status_check |

Database rules (including conditions shared with other fields):

- `profile_change_requests_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))`

### workflow_request_id

**In everyday language:** Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database link to another record is present.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This record points to an existing entry in requests instead of copying all of that entry’s details.

Technical definition: Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database FK is present.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `workflow_request_id: number \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `profile_change_requests_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

### decided_by

**In everyday language:** Identifies decided by connected to this record.

**Why it is kept:** Keeps this record connected to the correct decided by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s decided by to FOREIGN KEY (decided_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `decided_by: number \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `profile_change_requests_decided_by_fkey`: `FOREIGN KEY (decided_by) REFERENCES core.users(id)`

### decided_at

**In everyday language:** HR decision receipt.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: HR decision receipt

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `decided_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `profile_change_requests_emp_status`: `CREATE INDEX profile_change_requests_emp_status ON core.profile_change_requests USING btree (employee_id, field, status)`
- Index `profile_change_requests_pkey`: `CREATE UNIQUE INDEX profile_change_requests_pkey ON core.profile_change_requests USING btree (id)`
- Index `profile_change_requests_wf_uq`: `CREATE UNIQUE INDEX profile_change_requests_wf_uq ON core.profile_change_requests USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL)`

## core.reporting_tree

Connects employees to their management hierarchy for authorized team views.

core.reporting_tree — closure table, rebuilt by trigger (CORE-10).

Relation kind: table.

### manager_id

**In everyday language:** worked out from other saved information ancestor manager identity; no live link to another record.

**Why it is kept:** Keeps this record connected to the correct manager, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Derived ancestor manager identity; no live FK

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `manager_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reporting_tree_pkey`: `PRIMARY KEY (manager_id, employee_id)`

### employee_id

**In everyday language:** worked out from other saved information descendant identity; no live link to another record.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Derived descendant identity; no live FK

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reporting_tree_pkey`: `PRIMARY KEY (manager_id, employee_id)`

### depth

**In everyday language:** Number of reporting hops; self depth0 versus direct depth1 distinguishes scope.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Depth distinguishes direct from more distant reporting relationships; it is not employee seniority.

Technical definition: Number of reporting hops; self depth0 versus direct depth1 distinguishes scope

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `depth: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `reporting_tree_pkey`: `CREATE UNIQUE INDEX reporting_tree_pkey ON core.reporting_tree USING btree (manager_id, employee_id)`

## core.role_permissions

Records which actions are allowed for each access role.

Role permissions records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `role_permissions_pkey`: `PRIMARY KEY (id)`

### role_id

**In everyday language:** Identifies role connected to this record.

**Why it is kept:** Keeps this record connected to the correct role, so related details can be checked together.

**Example:** This record points to an existing entry in roles instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s role id to FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `role_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `role_permissions_role_id_fkey`: `FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE`
- `role_permissions_role_id_permission_id_key`: `UNIQUE (role_id, permission_id)`

### permission_id

**In everyday language:** Identifies permission connected to this record.

**Why it is kept:** Keeps this record connected to the correct permission, so related details can be checked together.

**Example:** This record points to an existing entry in permissions instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s permission id to FOREIGN KEY (permission_id) REFERENCES core.permissions(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `permission_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `role_permissions_permission_id_fkey`: `FOREIGN KEY (permission_id) REFERENCES core.permissions(id) ON DELETE CASCADE`
- `role_permissions_role_id_permission_id_key`: `UNIQUE (role_id, permission_id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### scope

**In everyday language:** Grant population/mutability class: all/org/subtree/own/readonly; central read/write resolution owns interpretation.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “all” means All records within the enclosing permission scope.

Technical definition: Grant population/mutability class: all/org/subtree/own/readonly; central read/write resolution owns interpretation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'all'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `scope: Generated<'all' \| 'subtree' \| 'own' \| 'org_unit' \| 'readonly' \| 'department'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `all` | All records within the enclosing permission scope | DB CHECK: role_permissions_scope_check |
| `subtree` | Organization node plus its descendants | DB CHECK: role_permissions_scope_check |
| `own` | Current user’s own population | DB CHECK: role_permissions_scope_check |
| `org_unit` | Org unit. | DB CHECK: role_permissions_scope_check |
| `readonly` | Readonly. | DB CHECK: role_permissions_scope_check |
| `department` | Department. | DB CHECK: role_permissions_scope_check |

Database rules (including conditions shared with other fields):

- `role_permissions_scope_check`: `CHECK ((scope = ANY (ARRAY['all'::text, 'subtree'::text, 'own'::text, 'org_unit'::text, 'readonly'::text, 'department'::text])))`

Table indexes and lifecycle triggers:

- Index `role_permissions_pkey`: `CREATE UNIQUE INDEX role_permissions_pkey ON core.role_permissions USING btree (id)`
- Index `role_permissions_role_id_permission_id_key`: `CREATE UNIQUE INDEX role_permissions_role_id_permission_id_key ON core.role_permissions USING btree (role_id, permission_id)`
- Trigger `role_permissions_keep_one_super_admin_del` → `core.assert_super_admin_remains` (enabled flag `O`).
- Trigger `role_permissions_keep_one_super_admin_upd` → `core.assert_super_admin_remains` (enabled flag `O`).
- Trigger `role_permissions_serialize_admin_changes` → `core.serialize_admin_changes` (enabled flag `O`).
- Trigger `role_permissions_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.roles

Lists access roles used to group permitted actions.

core.roles — role catalog (docs/08 §1).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roles_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Stable configurable role identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable configurable role identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roles_code_key`: `UNIQUE (code)`

### name

**In everyday language:** Administration display label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Administration display label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `roles_code_key`: `CREATE UNIQUE INDEX roles_code_key ON core.roles USING btree (code)`
- Index `roles_pkey`: `CREATE UNIQUE INDEX roles_pkey ON core.roles USING btree (id)`
- Trigger `roles_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.separations

Tracks resignations and other exits, including approved last working dates.

core.separations — LC-06 resignation and separation records.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `separations_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `separations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### initiated_at

**In everyday language:** Separation request receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Separation request receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `initiated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### initiated_by

**In everyday language:** Employee/HR initiation mode, not a user link to another record.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “employee” means Employee.

Technical definition: Employee/HR initiation mode, not a user FK

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `initiated_by: 'employee' \| 'hr';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `employee` | Employee. | DB CHECK: separations_initiated_by_check |
| `hr` | Hr. | DB CHECK: separations_initiated_by_check |

Database rules (including conditions shared with other fields):

- `separations_initiated_by_check`: `CHECK ((initiated_by = ANY (ARRAY['employee'::text, 'hr'::text])))`

### reason

**In everyday language:** Employee/HR separation explanation.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Employee/HR separation explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reason: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### resignation_date

**In everyday language:** Business resignation date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Business resignation date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `resignation_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notice_period_days

**In everyday language:** Configured/agreed notice requirement.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured/agreed notice requirement

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `notice_period_days: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### requested_lwd

**In everyday language:** Requested last working date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Requested last working date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `requested_lwd: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### approved_lwd

**In everyday language:** Approved last working date controlling exit effect.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Approved last working date controlling exit effect

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `approved_lwd: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### shortfall_days

**In everyday language:** Notice shortfall quantity requiring approved recovery policy.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Notice shortfall quantity requiring approved recovery policy

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `shortfall_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### workflow_request_id

**In everyday language:** Approval instance link; live link to another record absent.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Approval instance link; live FK absent

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `workflow_request_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Pending/approved/completed/withdrawn/rejected progress from creation to closure.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Pending/approved/completed/withdrawn/rejected lifecycle

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'pending'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'pending' \| 'approved' \| 'withdrawn' \| 'rejected' \| 'completed'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: separations_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: separations_status_check |
| `withdrawn` | Record/request withdrawn | DB CHECK: separations_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: separations_status_check |
| `completed` | Record is completed in this lifecycle. | DB CHECK: separations_status_check |

Database rules (including conditions shared with other fields):

- `separations_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'withdrawn'::text, 'rejected'::text, 'completed'::text])))`

### fnf_id

**In everyday language:** Settlement link; cyclic domain reference lacks live link to another record.

**Why it is kept:** Keeps this record connected to the correct fnf, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Settlement link; cyclic domain reference lacks live FK

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `fnf_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### exit_type

**In everyday language:** Classification of the employee's exit used by separation and final settlement.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “resignation” means Resignation.

Technical definition: Classification of the employee's exit used by separation and final settlement.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'resignation'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `exit_type: Generated<'resignation' \| 'retirement' \| 'death' \| 'contract_end' \| 'termination'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `resignation` | Resignation. | DB CHECK: separations_exit_type_check |
| `retirement` | Retirement. | DB CHECK: separations_exit_type_check |
| `death` | Death. | DB CHECK: separations_exit_type_check |
| `contract_end` | Contract end. | DB CHECK: separations_exit_type_check |
| `termination` | Termination. | DB CHECK: separations_exit_type_check |

Database rules (including conditions shared with other fields):

- `separations_exit_type_check`: `CHECK ((exit_type = ANY (ARRAY['resignation'::text, 'retirement'::text, 'death'::text, 'contract_end'::text, 'termination'::text])))`

Table indexes and lifecycle triggers:

- Index `idx_separations_employee`: `CREATE INDEX idx_separations_employee ON core.separations USING btree (employee_id)`
- Index `idx_separations_status`: `CREATE INDEX idx_separations_status ON core.separations USING btree (status)`
- Index `separations_pkey`: `CREATE UNIQUE INDEX separations_pkey ON core.separations USING btree (id)`

## core.settings

Keeps configurable system and policy choices.

core.settings — typed policy store; nothing policy-like is hardcoded (docs/04 §8).

Relation kind: table.

### key

**In everyday language:** Stable runtime configuration identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable runtime configuration identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `key: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `settings_pkey`: `PRIMARY KEY (key)`

### value

**In everyday language:** Typed policy/configuration value serialized as text.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** Read this together with the named parameter: a rate, a wage ceiling and a rupee cap can all be numbers but have different meanings.

Technical definition: Typed policy/configuration value serialized as text

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `value: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### value_type

**In everyday language:** choice that tells the system which kind this is for runtime parsing.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “number” means Number.

Technical definition: Discriminator for runtime parsing

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `value_type: 'number' \| 'string' \| 'boolean' \| 'json';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `number` | Number. | TypeScript declaration only |
| `string` | String. | TypeScript declaration only |
| `boolean` | Boolean. | TypeScript declaration only |
| `json` | Json. | TypeScript declaration only |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### description

**In everyday language:** Operator-facing purpose of setting; not enforcement.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Operator-facing purpose of setting; not enforcement

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `description: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_by

**In everyday language:** User who last updated this record.

**Why it is kept:** Keeps this record connected to the correct person who last changed the record, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: User who last updated this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `settings_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES core.users(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `settings_pkey`: `CREATE UNIQUE INDEX settings_pkey ON core.settings USING btree (key)`
- Trigger `settings_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.transfers

Tracks proposed and approved changes in employee placement or employment assignment.

Transfers records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### transfer_type

**In everyday language:** Promotion/department/location/entity movement class.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “department” means Department.

Technical definition: Promotion/department/location/entity movement class

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `transfer_type: TransferType;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `department` | Department. | DB CHECK: transfers_transfer_type_check |
| `location` | Location. | DB CHECK: transfers_transfer_type_check |
| `inter_entity` | Inter entity. | DB CHECK: transfers_transfer_type_check |
| `promotion` | Promotion. | DB CHECK: transfers_transfer_type_check |

Database rules (including conditions shared with other fields):

- `transfers_transfer_type_check`: `CHECK ((transfer_type = ANY (ARRAY['department'::text, 'location'::text, 'inter_entity'::text, 'promotion'::text])))`

### effective_date

**In everyday language:** Business effective date, distinct from approval instant.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Business effective date, distinct from approval instant

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `effective_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Pending/approved/applied/rejected/cancelled progression.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Pending/approved/applied/rejected/cancelled progression

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'pending'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<TransferStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: transfers_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: transfers_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: transfers_status_check |
| `completed` | Record is completed in this lifecycle. | DB CHECK: transfers_status_check |
| `cancelled` | Request cancelled | DB CHECK: transfers_status_check |

Database rules (including conditions shared with other fields):

- `transfers_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text])))`

### current_company_id

**In everyday language:** Identifies current company connected to this record.

**Why it is kept:** Keeps this record connected to the correct current company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s current company id to FOREIGN KEY (current_company_id) REFERENCES core.companies(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `current_company_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_current_company_id_fkey`: `FOREIGN KEY (current_company_id) REFERENCES core.companies(id)`

### current_department_id

**In everyday language:** Identifies current department connected to this record.

**Why it is kept:** Keeps this record connected to the correct current department, so related details can be checked together.

**Example:** This record points to an existing entry in departments instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s current department id to FOREIGN KEY (current_department_id) REFERENCES core.departments(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `current_department_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_current_department_id_fkey`: `FOREIGN KEY (current_department_id) REFERENCES core.departments(id)`

### current_location_id

**In everyday language:** Identifies current location connected to this record.

**Why it is kept:** Keeps this record connected to the correct current location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s current location id to FOREIGN KEY (current_location_id) REFERENCES core.locations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `current_location_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_current_location_id_fkey`: `FOREIGN KEY (current_location_id) REFERENCES core.locations(id)`

### current_designation_id

**In everyday language:** Identifies current designation connected to this record.

**Why it is kept:** Keeps this record connected to the correct current designation, so related details can be checked together.

**Example:** This record points to an existing entry in designations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s current designation id to FOREIGN KEY (current_designation_id) REFERENCES core.designations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `current_designation_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_current_designation_id_fkey`: `FOREIGN KEY (current_designation_id) REFERENCES core.designations(id)`

### current_grade_id

**In everyday language:** Identifies current grade connected to this record.

**Why it is kept:** Keeps this record connected to the correct current grade, so related details can be checked together.

**Example:** This record points to an existing entry in grades instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s current grade id to FOREIGN KEY (current_grade_id) REFERENCES core.grades(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `current_grade_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_current_grade_id_fkey`: `FOREIGN KEY (current_grade_id) REFERENCES core.grades(id)`

### current_reporting_manager_id

**In everyday language:** Identifies current reporting manager connected to this record.

**Why it is kept:** Keeps this record connected to the correct current reporting manager, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s current reporting manager id to FOREIGN KEY (current_reporting_manager_id) REFERENCES core.employees(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `current_reporting_manager_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_current_reporting_manager_id_fkey`: `FOREIGN KEY (current_reporting_manager_id) REFERENCES core.employees(id)`

### current_ecode

**In everyday language:** Before-movement code copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Before-movement code snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `current_ecode: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### target_company_id

**In everyday language:** Identifies target company connected to this record.

**Why it is kept:** Keeps this record connected to the correct target company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s target company id to FOREIGN KEY (target_company_id) REFERENCES core.companies(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `target_company_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_target_company_id_fkey`: `FOREIGN KEY (target_company_id) REFERENCES core.companies(id)`

### target_department_id

**In everyday language:** Identifies target department connected to this record.

**Why it is kept:** Keeps this record connected to the correct target department, so related details can be checked together.

**Example:** This record points to an existing entry in departments instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s target department id to FOREIGN KEY (target_department_id) REFERENCES core.departments(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `target_department_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_target_department_id_fkey`: `FOREIGN KEY (target_department_id) REFERENCES core.departments(id)`

### target_location_id

**In everyday language:** Identifies target location connected to this record.

**Why it is kept:** Keeps this record connected to the correct target location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s target location id to FOREIGN KEY (target_location_id) REFERENCES core.locations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `target_location_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_target_location_id_fkey`: `FOREIGN KEY (target_location_id) REFERENCES core.locations(id)`

### target_designation_id

**In everyday language:** Identifies target designation connected to this record.

**Why it is kept:** Keeps this record connected to the correct target designation, so related details can be checked together.

**Example:** This record points to an existing entry in designations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s target designation id to FOREIGN KEY (target_designation_id) REFERENCES core.designations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `target_designation_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_target_designation_id_fkey`: `FOREIGN KEY (target_designation_id) REFERENCES core.designations(id)`

### target_grade_id

**In everyday language:** Identifies target grade connected to this record.

**Why it is kept:** Keeps this record connected to the correct target grade, so related details can be checked together.

**Example:** This record points to an existing entry in grades instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s target grade id to FOREIGN KEY (target_grade_id) REFERENCES core.grades(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `target_grade_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_target_grade_id_fkey`: `FOREIGN KEY (target_grade_id) REFERENCES core.grades(id)`

### target_reporting_manager_id

**In everyday language:** Identifies target reporting manager connected to this record.

**Why it is kept:** Keeps this record connected to the correct target reporting manager, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s target reporting manager id to FOREIGN KEY (target_reporting_manager_id) REFERENCES core.employees(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `target_reporting_manager_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_target_reporting_manager_id_fkey`: `FOREIGN KEY (target_reporting_manager_id) REFERENCES core.employees(id)`

### target_ecode

**In everyday language:** After-movement allocated entity code copy saved at that point in time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: After-movement allocated entity code snapshot

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `target_ecode: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### salary_revision_amount

**In everyday language:** Proposed compensation revision requiring approved effective salary transaction.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Proposed compensation revision requiring approved effective salary transaction

| Property | Definition |
|---|---|
| SQL type | `numeric(12,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `salary_revision_amount: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### leave_treatment

**In everyday language:** Policy selection for carrying or settling leave in entity move.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “transfer” means Transfer.

Technical definition: Policy selection for carrying or settling leave in entity move

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'transfer'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `leave_treatment: Generated<'transfer' \| 'encash'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `transfer` | Transfer. | DB CHECK: transfers_leave_treatment_check |
| `encash` | Leave converted to cash | DB CHECK: transfers_leave_treatment_check |

Database rules (including conditions shared with other fields):

- `transfers_leave_treatment_check`: `CHECK ((leave_treatment = ANY (ARRAY['transfer'::text, 'encash'::text])))`

### reason

**In everyday language:** Movement justification.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Movement justification

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reason: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### remarks

**In everyday language:** Additional movement context.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A reviewer reads the saved explanation to understand the particular case before taking the next action.

Technical definition: Additional movement context

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `remarks: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### approved_by

**In everyday language:** Identifies approved by connected to this record.

**Why it is kept:** Keeps this record connected to the correct approved by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s approved by to FOREIGN KEY (approved_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `approved_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_approved_by_fkey`: `FOREIGN KEY (approved_by) REFERENCES core.users(id)`

### approved_at

**In everyday language:** Workflow approval instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Workflow approval instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `approved_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notified_at

**In everyday language:** Transfer notification enqueue/receipt marker, must not imply external delivery without proof.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Transfer notification enqueue/receipt marker, must not imply external delivery without proof

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `notified_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_by

**In everyday language:** User who created this record.

**Why it is kept:** Keeps this record connected to the correct person who created the record, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: User who created this record.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### workflow_request_id

**In everyday language:** Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database link to another record is present.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This record points to an existing entry in requests instead of copying all of that entry’s details.

Technical definition: Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database FK is present.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `workflow_request_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `transfers_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

Table indexes and lifecycle triggers:

- Index `idx_transfers_effective_date`: `CREATE INDEX idx_transfers_effective_date ON core.transfers USING btree (effective_date)`
- Index `idx_transfers_employee`: `CREATE INDEX idx_transfers_employee ON core.transfers USING btree (employee_id)`
- Index `idx_transfers_status`: `CREATE INDEX idx_transfers_status ON core.transfers USING btree (status)`
- Index `transfers_due_idx`: `CREATE INDEX transfers_due_idx ON core.transfers USING btree (effective_date) WHERE (status = 'approved'::text)`
- Index `transfers_pkey`: `CREATE UNIQUE INDEX transfers_pkey ON core.transfers USING btree (id)`
- Index `transfers_workflow_request_uq`: `CREATE UNIQUE INDEX transfers_workflow_request_uq ON core.transfers USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL)`

## core.user_roles

Records the access roles assigned to each login account.

User roles records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `user_roles_pkey`: `PRIMARY KEY (id)`

### user_id

**In everyday language:** Identifies the login account connected to this record.

**Why it is kept:** Keeps this record connected to the correct login account, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s user id to FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `user_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `user_roles_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE`

### role_id

**In everyday language:** Identifies role connected to this record.

**Why it is kept:** Keeps this record connected to the correct role, so related details can be checked together.

**Example:** This record points to an existing entry in roles instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s role id to FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `role_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `user_roles_role_id_fkey`: `FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE`

### scope_org_unit_id

**In everyday language:** Identifies scope org unit connected to this record.

**Why it is kept:** Keeps this record connected to the correct scope org unit, so related details can be checked together.

**Example:** This record points to an existing entry in org units instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s scope org unit id to FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `scope_org_unit_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `user_roles_scope_fk`: `FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id)`

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `user_roles_pkey`: `CREATE UNIQUE INDEX user_roles_pkey ON core.user_roles USING btree (id)`
- Index `user_roles_user_id_role_id_scope_not_null_uq`: `CREATE UNIQUE INDEX user_roles_user_id_role_id_scope_not_null_uq ON core.user_roles USING btree (user_id, role_id, scope_org_unit_id) WHERE (scope_org_unit_id IS NOT NULL)`
- Index `user_roles_user_id_role_id_scope_null_uq`: `CREATE UNIQUE INDEX user_roles_user_id_role_id_scope_null_uq ON core.user_roles USING btree (user_id, role_id) WHERE (scope_org_unit_id IS NULL)`
- Trigger `user_roles_keep_one_super_admin_del` → `core.assert_super_admin_remains` (enabled flag `O`).
- Trigger `user_roles_keep_one_super_admin_upd` → `core.assert_super_admin_remains` (enabled flag `O`).
- Trigger `user_roles_serialize_admin_changes` → `core.serialize_admin_changes` (enabled flag `O`).
- Trigger `user_roles_updated_at` → `core.set_updated_at` (enabled flag `O`).

## core.users

Keeps login accounts; a login account and an employee record are different things.

core.users — auth accounts (docs/03 §1).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `users_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee to whom this record belongs; references the permanent main employee register.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `users_employee_fk`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### email

**In everyday language:** Unique login principal identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An illustrative address is sample@example.com. Its purpose depends on whether this is a login or contact record.

Technical definition: Unique login principal identifier

| Property | Definition |
|---|---|
| SQL type | `citext` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `email: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `users_email_key`: `UNIQUE (email)`

### password_hash

**In everyday language:** Bcrypt authentication secret digital fingerprint.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Bcrypt authentication secret digest

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `password_hash: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_active

**In everyday language:** Login authorization availability, distinct from employee/alumni progress from creation to closure.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Login authorization availability, distinct from employee/alumni lifecycle

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### last_login_at

**In everyday language:** Last successful login instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Last successful login instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `last_login_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### failed_attempts

**In everyday language:** Serialized authentication failure count.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Serialized authentication failure count

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `failed_attempts: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### locked_until

**In everyday language:** Authentication backoff cutoff.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If sign-in is locked until a recorded time, access remains restricted under the account rules until the restriction is cleared or expires.

Technical definition: Authentication backoff cutoff

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `locked_until: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Date and time this record was created.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Date and time this record was last updated; not a complete change history.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant this record was last updated; not a complete change history.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### must_change_password

**In everyday language:** Mandatory password-change gate.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Mandatory password-change gate

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `must_change_password: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### password_changed_at

**In everyday language:** Current password version/effective instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Current password version/effective instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `password_changed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### deactivated_at

**In everyday language:** Account disable where the information came from; reactivation semantics need consistency with is_active.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Account disable provenance; reactivation semantics need consistency with is_active

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `deactivated_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `users_email_key`: `CREATE UNIQUE INDEX users_email_key ON core.users USING btree (email)`
- Index `users_employee_unique`: `CREATE UNIQUE INDEX users_employee_unique ON core.users USING btree (employee_id) WHERE (employee_id IS NOT NULL)`
- Index `users_pkey`: `CREATE UNIQUE INDEX users_pkey ON core.users USING btree (id)`
- Trigger `users_keep_one_super_admin` → `core.assert_super_admin_remains` (enabled flag `O`).
- Trigger `users_serialize_admin_changes` → `core.serialize_admin_changes` (enabled flag `O`).
- Trigger `users_updated_at` → `core.set_updated_at` (enabled flag `O`).

