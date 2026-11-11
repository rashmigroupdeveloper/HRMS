# ird — field dictionary

41 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## ird.grievances

ird.grievances — IR Code redressal cases (separate from POSH).

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `grievances_pkey`: `PRIMARY KEY (id)`

### case_ref

Human grievance reference derived from inserted identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `case_ref: string;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `grievances_ref_present`: `CHECK ((length(btrim(case_ref)) > 0))`

### status

Grievance lifecycle; current implementation primarily intake/list

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'submitted'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<GrievanceStatus>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `submitted` | Record is submitted in this lifecycle. | DB CHECK: grievances_status_check |
| `under_review` | Record is under review in this lifecycle. | DB CHECK: grievances_status_check |
| `escalated` | Record is escalated in this lifecycle. | DB CHECK: grievances_status_check |
| `resolved` | Record is resolved in this lifecycle. | DB CHECK: grievances_status_check |
| `closed` | Record is closed in this lifecycle. | DB CHECK: grievances_status_check |

Database rules (including conditions shared with other fields):

- `grievances_status_check`: `CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'escalated'::text, 'resolved'::text, 'closed'::text])))`

### filed_at

Grievance filing instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `filed_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### filed_by_user_id

Reference linking this record’s filed by user id to FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `filed_by_user_id: number;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `grievances_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

### summary

Restricted grievance content

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `summary: string;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `grievances_summary_present`: `CHECK ((length(btrim(summary)) >= 10))`

### created_at

Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `grievances_pkey`: `CREATE UNIQUE INDEX grievances_pkey ON ird.grievances USING btree (id)`
- Index `grievances_ref_uq`: `CREATE UNIQUE INDEX grievances_ref_uq ON ird.grievances USING btree (case_ref)`

## ird.ic_members

POSH Internal Committee. Seed ZERO members — sponsor appoints (do not invent).

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ic_members_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ic_members_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### role

Presiding officer/member/external membership designation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `role: IcMemberRole;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `presiding_officer` | Presiding officer. | DB CHECK: ic_members_role_check |
| `member` | Member. | DB CHECK: ic_members_role_check |
| `external` | External. | DB CHECK: ic_members_role_check |

Database rules (including conditions shared with other fields):

- `ic_members_role_check`: `CHECK ((role = ANY (ARRAY['presiding_officer'::text, 'member'::text, 'external'::text])))`

### active

Current membership flag

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### appointed_on

Appointment calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `appointed_on: DateOnly;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `ic_members_active_idx`: `CREATE INDEX ic_members_active_idx ON ird.ic_members USING btree (active) WHERE active`
- Index `ic_members_pkey`: `CREATE UNIQUE INDEX ic_members_pkey ON ird.ic_members USING btree (id)`

## ird.posh_case_access_log

ird.posh_case_access_log — append-only; every case open is recorded.

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_case_access_log_pkey`: `PRIMARY KEY (id)`

### case_id

Reference linking this record’s case id to FOREIGN KEY (case_id) REFERENCES ird.posh_cases(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `case_id: number;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_case_access_log_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES ird.posh_cases(id)`

### actor_user_id

Reference linking this record’s actor user id to FOREIGN KEY (actor_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `actor_user_id: number;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_case_access_log_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### opened_at

Append-only access-attempt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `opened_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ip

Attempt network provenance

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ip: string \| null;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### outcome

Opened versus refused result

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'opened'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `outcome: Generated<PoshAccessOutcome>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `opened` | Record is opened in this lifecycle. | DB CHECK: posh_case_access_log_outcome_check |
| `refused` | Record is refused in this lifecycle. | DB CHECK: posh_case_access_log_outcome_check |

Database rules (including conditions shared with other fields):

- `posh_case_access_log_outcome_check`: `CHECK ((outcome = ANY (ARRAY['opened'::text, 'refused'::text])))`

Table indexes and lifecycle triggers:

- Index `posh_case_access_log_pkey`: `CREATE UNIQUE INDEX posh_case_access_log_pkey ON ird.posh_case_access_log USING btree (id)`
- Trigger `posh_access_log_immutable` → `ird.posh_access_log_immutable` (enabled flag `O`).

## ird.posh_case_assignments

Assigned-case isolation for POSH inquiries — non-assigned handlers receive 403.

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_case_assignments_pkey`: `PRIMARY KEY (id)`

### case_id

Reference linking this record’s case id to FOREIGN KEY (case_id) REFERENCES ird.posh_cases(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `case_id: number;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_case_assignments_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES ird.posh_cases(id) ON DELETE CASCADE`
- `posh_case_assignments_uq`: `UNIQUE (case_id, user_id)`

### user_id

Reference linking this record’s user id to FOREIGN KEY (user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `user_id: number;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_case_assignments_uq`: `UNIQUE (case_id, user_id)`
- `posh_case_assignments_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

### role

Assigned case-handling role

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'investigator'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `role: Generated<PoshCaseAssignmentRole>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `presiding_officer` | Presiding officer. | DB CHECK: posh_case_assignments_role_check |
| `investigator` | Investigator. | DB CHECK: posh_case_assignments_role_check |
| `member` | Member. | DB CHECK: posh_case_assignments_role_check |

Database rules (including conditions shared with other fields):

- `posh_case_assignments_role_check`: `CHECK ((role = ANY (ARRAY['presiding_officer'::text, 'investigator'::text, 'member'::text])))`

### assigned_by_user_id

Reference linking this record’s assigned by user id to FOREIGN KEY (assigned_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `assigned_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_case_assignments_assigned_by_user_id_fkey`: `FOREIGN KEY (assigned_by_user_id) REFERENCES core.users(id)`

### assigned_at

Case assignment creation instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `assigned_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### active

Current case-access grant flag

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `posh_case_assignments_pkey`: `CREATE UNIQUE INDEX posh_case_assignments_pkey ON ird.posh_case_assignments USING btree (id)`
- Index `posh_case_assignments_uq`: `CREATE UNIQUE INDEX posh_case_assignments_uq ON ird.posh_case_assignments USING btree (case_id, user_id)`
- Index `posh_case_assignments_user_idx`: `CREATE INDEX posh_case_assignments_user_idx ON ird.posh_case_assignments USING btree (user_id) WHERE active`

## ird.posh_cases

ird.posh_cases — confidential POSH intake.
`summary_encrypted_or_text` is plain text for v1; encryption is a follow-up.

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_cases_pkey`: `PRIMARY KEY (id)`

### case_ref

Human confidential case reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `case_ref: string;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_cases_ref_present`: `CHECK ((length(btrim(case_ref)) > 0))`

### status

Confidential POSH complaint lifecycle state; access remains restricted independently of the state.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'submitted'::text |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `status: Generated<PoshCaseStatus>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `submitted` | Record is submitted in this lifecycle. | DB CHECK: posh_cases_status_check |
| `under_inquiry` | Record is under inquiry in this lifecycle. | DB CHECK: posh_cases_status_check |
| `closed` | Record is closed in this lifecycle. | DB CHECK: posh_cases_status_check |
| `withdrawn` | Record/request withdrawn | DB CHECK: posh_cases_status_check |

Database rules (including conditions shared with other fields):

- `posh_cases_status_check`: `CHECK ((status = ANY (ARRAY['submitted'::text, 'under_inquiry'::text, 'closed'::text, 'withdrawn'::text])))`

### filed_at

Case submission instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `filed_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### filed_by_user_id

Reference linking this record’s filed by user id to FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `filed_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_cases_anonymous_pair`: `CHECK ((((is_anonymous = false) AND (filed_by_user_id IS NOT NULL)) OR ((is_anonymous = true) AND (filed_by_user_id IS NULL) AND (anonymous_token_hash IS NOT NULL))))`
- `posh_cases_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

### is_anonymous

Whether a filer account may be retained

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_anonymous: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules (including conditions shared with other fields):

- `posh_cases_anonymous_pair`: `CHECK ((((is_anonymous = false) AND (filed_by_user_id IS NOT NULL)) OR ((is_anonymous = true) AND (filed_by_user_id IS NULL) AND (anonymous_token_hash IS NOT NULL))))`

### summary_encrypted_or_text

Restricted complaint text; current implementation is plaintext, not encryption

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `summary_encrypted_or_text: string;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_cases_summary_present`: `CHECK ((length(btrim(summary_encrypted_or_text)) >= 10))`

### anonymous_token_hash

Hash of opaque bearer receipt used for anonymous status lookup

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `anonymous_token_hash: string \| null;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `posh_cases_anonymous_pair`: `CHECK ((((is_anonymous = false) AND (filed_by_user_id IS NOT NULL)) OR ((is_anonymous = true) AND (filed_by_user_id IS NULL) AND (anonymous_token_hash IS NOT NULL))))`

### created_at

Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `posh_cases_anon_token_uq`: `CREATE UNIQUE INDEX posh_cases_anon_token_uq ON ird.posh_cases USING btree (anonymous_token_hash) WHERE (anonymous_token_hash IS NOT NULL)`
- Index `posh_cases_pkey`: `CREATE UNIQUE INDEX posh_cases_pkey ON ird.posh_cases USING btree (id)`
- Index `posh_cases_ref_uq`: `CREATE UNIQUE INDEX posh_cases_ref_uq ON ird.posh_cases USING btree (case_ref)`

## ird.whistleblower_reports

Anonymous whistleblower intake. No PII columns — only a token hash for claim-code follow-up.

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | GENERATED ALWAYS AS IDENTITY |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `whistleblower_reports_pkey`: `PRIMARY KEY (id)`

### anonymous_token_hash

Opaque receipt hash; never store plaintext receipt token

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `anonymous_token_hash: string;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `whistle_token_present`: `CHECK ((length(btrim(anonymous_token_hash)) = 64))`

### status

Lifecycle state of the confidential whistleblower report.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'submitted'::text |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `status: Generated<WhistleStatus>;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `submitted` | Record is submitted in this lifecycle. | DB CHECK: whistleblower_reports_status_check |
| `triaged` | Record is triaged in this lifecycle. | DB CHECK: whistleblower_reports_status_check |
| `investigating` | Record is investigating in this lifecycle. | DB CHECK: whistleblower_reports_status_check |
| `closed` | Record is closed in this lifecycle. | DB CHECK: whistleblower_reports_status_check |

Database rules (including conditions shared with other fields):

- `whistleblower_reports_status_check`: `CHECK ((status = ANY (ARRAY['submitted'::text, 'triaged'::text, 'investigating'::text, 'closed'::text])))`

### filed_at

Report receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `filed_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### summary

Restricted whistleblower report content

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `summary: string;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `whistle_summary_present`: `CHECK ((length(btrim(summary)) >= 10))`

### created_at

Instant this record was created.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ird.ts](../../backend/src/core/db/types.ird.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `whistle_token_uq`: `CREATE UNIQUE INDEX whistle_token_uq ON ird.whistleblower_reports USING btree (anonymous_token_hash)`
- Index `whistleblower_reports_pkey`: `CREATE UNIQUE INDEX whistleblower_reports_pkey ON ird.whistleblower_reports USING btree (id)`

