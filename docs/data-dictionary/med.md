# med — field dictionary

22 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## med.access_log

Records access to sensitive employee medical information.

Access log records; consult the field definitions and governing module specification.

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

- `access_log_pkey`: `PRIMARY KEY (id)`

### questionnaire_id

**In everyday language:** Identifies questionnaire connected to this record.

**Why it is kept:** Keeps this record connected to the correct questionnaire, so related details can be checked together.

**Example:** This record points to an existing entry in questionnaires instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s questionnaire id to FOREIGN KEY (questionnaire_id) REFERENCES med.questionnaires(id).

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
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_log_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

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
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_log_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### action

**In everyday language:** Operation or decision recorded by this event; permitted codes are listed with the field constraints.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “read” means Read classification for action.

Technical definition: Operation or decision recorded by this event; permitted codes are listed with the field constraints.

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

**In everyday language:** Recorded business justification for the operation or decision.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Recorded business justification for the operation or decision.

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

**In everyday language:** Client IP address captured as access or submission where the information came from; personal/security descriptive information.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A saved browser or connection detail can help an authorized administrator investigate which sign-in or submission produced the event.

Technical definition: Client IP address captured as access or submission provenance; personal/security metadata.

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

**In everyday language:** Date and time of occurred for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of occurred for this record.

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

Keeps submitted medical questionnaires and their consent information.

Questionnaires records; consult the field definitions and governing module specification.

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

- `questionnaires_pkey`: `PRIMARY KEY (id)`

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
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `questionnaires_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `questionnaires_subject`: `CHECK (((candidate_id IS NOT NULL) OR (employee_id IS NOT NULL)))`

### candidate_id

**In everyday language:** Identifies the candidate connected to this record.

**Why it is kept:** Keeps this record connected to the correct candidate, so related details can be checked together.

**Example:** This record points to an existing entry in onboarding candidates instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s candidate id to FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL.

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

**In everyday language:** Identifies consent declaration connected to this record.

**Why it is kept:** Keeps this record connected to the correct consent declaration, so related details can be checked together.

**Example:** This record points to an existing entry in declarations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s consent declaration id to FOREIGN KEY (consent_declaration_id) REFERENCES prv.declarations(id).

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

**In everyday language:** Submitted questionnaire answers keyed by the questionnaire's question definitions; sensitive medical information here.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the answers.

Technical definition: Submitted questionnaire answers keyed by the questionnaire's question definitions; sensitive medical information here.

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

**In everyday language:** Declared height in centimetres.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** 170 means a height of 170 centimetres; it is sensitive medical information.

Technical definition: Declared height in centimetres.

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

**In everyday language:** Declared weight in kilograms.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** 65 means a weight of 65 kilograms; it is sensitive medical information.

Technical definition: Declared weight in kilograms.

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

**In everyday language:** Body mass index recorded with the medical questionnaire; sensitive health information.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a recorded body-mass index figure; it is not a medical conclusion or fitness decision by itself.

Technical definition: Body mass index recorded with the medical questionnaire; sensitive health information.

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

**In everyday language:** Data-how long information is kept policy class used to determine how long information is kept handling.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the retention class.

Technical definition: Data-retention policy class used to determine retention handling.

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

**In everyday language:** Current progress from creation to closure state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “active” means Record is active in this progress from creation to closure.

Technical definition: Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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

**In everyday language:** Date and time of withdrawn for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of withdrawn for this record.

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

**In everyday language:** Identifies submitted by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct submitted by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s submitted by user id to FOREIGN KEY (submitted_by_user_id) REFERENCES core.users(id).

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

- Index `questionnaires_one_active_emp`: `CREATE UNIQUE INDEX questionnaires_one_active_emp ON med.questionnaires USING btree (employee_id) WHERE ((status = 'active'::text) AND (employee_id IS NOT NULL))`
- Index `questionnaires_pkey`: `CREATE UNIQUE INDEX questionnaires_pkey ON med.questionnaires USING btree (id)`
- Trigger `questionnaires_updated_at` → `core.set_updated_at` (enabled flag `O`).

