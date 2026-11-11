# med — field dictionary

22 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## med.access_log

Access log records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_log_pkey`: `PRIMARY KEY (id)`

### questionnaire_id

Reference linking this record’s questionnaire id to FOREIGN KEY (questionnaire_id) REFERENCES med.questionnaires(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `questionnaire_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_log_questionnaire_id_fkey`: `FOREIGN KEY (questionnaire_id) REFERENCES med.questionnaires(id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_log_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### actor_user_id

Reference linking this record’s actor user id to FOREIGN KEY (actor_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `actor_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_log_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### action

Operation or decision recorded by this event; permitted codes are listed with the field constraints.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `action: 'read' \| 'write' \| 'withdraw' \| 'denied';` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `read` | Read classification for action. | DB CHECK: access_log_action_check |
| `write` | Write classification for action. | DB CHECK: access_log_action_check |
| `withdraw` | Withdraw classification for action. | DB CHECK: access_log_action_check |
| `denied` | Denied classification for action. | DB CHECK: access_log_action_check |

Database rules (including conditions shared with other fields):

- `access_log_action_check`: `CHECK ((action = ANY (ARRAY['read'::text, 'write'::text, 'withdraw'::text, 'denied'::text])))`

### reason

Recorded business justification for the operation or decision.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `reason: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ip

Client IP address captured as access or submission provenance; personal/security metadata.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `ip: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### occurred_at

Instant of occurred for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `occurred_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `access_log_pkey`: `CREATE UNIQUE INDEX access_log_pkey ON med.access_log USING btree (id)`
- Index `med_access_log_emp_idx`: `CREATE INDEX med_access_log_emp_idx ON med.access_log USING btree (employee_id, occurred_at DESC)`
- Trigger `access_log_immutable` → `med.access_log_immutable` (enabled flag `O`).

## med.questionnaires

Questionnaires records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `questionnaires_subject`: `CHECK (((candidate_id IS NOT NULL) OR (employee_id IS NOT NULL)))`

### candidate_id

Reference linking this record’s candidate id to FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `candidate_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL`
- `questionnaires_subject`: `CHECK (((candidate_id IS NOT NULL) OR (employee_id IS NOT NULL)))`

### consent_declaration_id

Reference linking this record’s consent declaration id to FOREIGN KEY (consent_declaration_id) REFERENCES prv.declarations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `consent_declaration_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_consent_declaration_id_fkey`: `FOREIGN KEY (consent_declaration_id) REFERENCES prv.declarations(id)`

### answers

Submitted questionnaire answers keyed by the questionnaire's question definitions; sensitive medical information here.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `answers: ColumnType<Record<string, unknown>, string, string>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_withdrawn_erased`: `CHECK (((status <> 'withdrawn'::text) OR ((answers = '{}'::jsonb) AND (height_cm IS NULL) AND (weight_kg IS NULL))))`

### height_cm

Declared height in centimetres.

| Property | Definition |
|---|---|
| SQL type | `numeric(5,1)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `height_cm: Num;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_height_cm_check`: `CHECK (((height_cm IS NULL) OR ((height_cm >= (50)::numeric) AND (height_cm <= (250)::numeric))))`
- `questionnaires_withdrawn_erased`: `CHECK (((status <> 'withdrawn'::text) OR ((answers = '{}'::jsonb) AND (height_cm IS NULL) AND (weight_kg IS NULL))))`

### weight_kg

Declared weight in kilograms.

| Property | Definition |
|---|---|
| SQL type | `numeric(5,1)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `weight_kg: Num;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_weight_kg_check`: `CHECK (((weight_kg IS NULL) OR ((weight_kg >= (20)::numeric) AND (weight_kg <= (300)::numeric))))`
- `questionnaires_withdrawn_erased`: `CHECK (((status <> 'withdrawn'::text) OR ((answers = '{}'::jsonb) AND (height_cm IS NULL) AND (weight_kg IS NULL))))`

### bmi

Body mass index recorded with the medical questionnaire; sensitive health information.

| Property | Definition |
|---|---|
| SQL type | `numeric(5,1)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | <br>CASE<br>    WHEN ((height_cm > (0)::numeric) AND (weight_kg > (0)::numeric)) THEN round((weight_kg / ((height_cm / (100)::numeric) * (height_cm / (100)::numeric))), 1)<br>    ELSE NULL::numeric<br>END |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `bmi: ColumnType<string \| null, never, never>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### retention_class

Data-retention policy class used to determine retention handling.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'health'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `retention_class: Generated<string>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'active'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `status: Generated<'active' \| 'withdrawn'>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `active` | Record is active in this lifecycle. | DB CHECK: questionnaires_status_check |
| `withdrawn` | Record/request withdrawn | DB CHECK: questionnaires_status_check |

Database rules (including conditions shared with other fields):

- `questionnaires_status_check`: `CHECK ((status = ANY (ARRAY['active'::text, 'withdrawn'::text])))`
- `questionnaires_withdrawn_erased`: `CHECK (((status <> 'withdrawn'::text) OR ((answers = '{}'::jsonb) AND (height_cm IS NULL) AND (weight_kg IS NULL))))`

### withdrawn_at

Instant of withdrawn for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `withdrawn_at: ColumnType<Date \| null, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### submitted_by_user_id

Reference linking this record’s submitted by user id to FOREIGN KEY (submitted_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `submitted_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_submitted_by_user_id_fkey`: `FOREIGN KEY (submitted_by_user_id) REFERENCES core.users(id)`

### created_at

Instant this record was created.

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

Instant this record was last updated; not a complete change history.

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

- Index `questionnaires_one_active_emp`: `CREATE UNIQUE INDEX questionnaires_one_active_emp ON med.questionnaires USING btree (employee_id) WHERE ((status = 'active'::text) AND (employee_id IS NOT NULL))`
- Index `questionnaires_pkey`: `CREATE UNIQUE INDEX questionnaires_pkey ON med.questionnaires USING btree (id)`
- Trigger `questionnaires_updated_at` → `core.set_updated_at` (enabled flag `O`).

