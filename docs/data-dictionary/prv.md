# prv — field dictionary

104 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## prv.breach_register

Breach register records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `breach_register_pkey`: `PRIMARY KEY (id)`

### discovered_at

Instant of discovered for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `discovered_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### summary

Recorded summary of the privacy breach incident.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `summary: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notified_board_at

Instant of notified board for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `notified_board_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notified_principals_at

Instant of notified principals for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `notified_principals_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### recorded_by

Reference linking this record’s recorded by to FOREIGN KEY (recorded_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `recorded_by: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `breach_register_recorded_by_fkey`: `FOREIGN KEY (recorded_by) REFERENCES core.users(id)`

Table indexes and lifecycle triggers:

- Index `breach_register_pkey`: `CREATE UNIQUE INDEX breach_register_pkey ON prv.breach_register USING btree (id)`
- Trigger `breach_register_immutable` → `prv.breach_register_immutable` (enabled flag `O`).

## prv.consent_events

Consent events records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `consent_events_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

- `consent_events_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### purpose

Declared business purpose of this request, processing activity or consent.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `purpose: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### action

Operation or decision recorded by this event; permitted codes are listed with the field constraints.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `action: 'grant' \| 'withdraw';` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `grant` | Grant classification for action. | DB CHECK: consent_events_action_check |
| `withdraw` | Withdraw classification for action. | DB CHECK: consent_events_action_check |

Database rules (including conditions shared with other fields):

- `consent_events_action_check`: `CHECK ((action = ANY (ARRAY['grant'::text, 'withdraw'::text])))`

### actor_user_id

Reference linking this record’s actor user id to FOREIGN KEY (actor_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `actor_user_id: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `consent_events_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### occurred_at

Instant of occurred for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `occurred_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `consent_events_pkey`: `CREATE UNIQUE INDEX consent_events_pkey ON prv.consent_events USING btree (id)`
- Trigger `consent_events_immutable` → `prv.consent_events_immutable` (enabled flag `O`).

## prv.consents

Consents records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `consents_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

- `consents_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `consents_employee_id_purpose_key`: `UNIQUE (employee_id, purpose)`

### purpose

Declared business purpose of this request, processing activity or consent.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `purpose: ConsentPurpose;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `photograph` | Photograph. | DB CHECK: consents_purpose_check |
| `wellness` | Wellness. | DB CHECK: consents_purpose_check |
| `bgv` | Background verification | DB CHECK: consents_purpose_check |
| `family` | Family. | DB CHECK: consents_purpose_check |
| `alumni` | Alumni. | DB CHECK: consents_purpose_check |

Database rules (including conditions shared with other fields):

- `consents_employee_id_purpose_key`: `UNIQUE (employee_id, purpose)`
- `consents_purpose_check`: `CHECK ((purpose = ANY (ARRAY['photograph'::text, 'wellness'::text, 'bgv'::text, 'family'::text, 'alumni'::text])))`

### granted

Whether consent is currently recorded as granted for the stated purpose.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `granted: boolean;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `consents_employee_id_purpose_key`: `CREATE UNIQUE INDEX consents_employee_id_purpose_key ON prv.consents USING btree (employee_id, purpose)`
- Index `consents_pkey`: `CREATE UNIQUE INDEX consents_pkey ON prv.consents USING btree (id)`

## prv.declaration_texts

Declaration texts records; consult the field definitions and governing module specification.

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

- `declaration_texts_pkey`: `PRIMARY KEY (id)`

### kind

Classification of this record; exact accepted codes and conditions are listed in its database rules.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `kind: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `declaration_texts_kind_version_key`: `UNIQUE (kind, version)`

### version

Version identifier of the published notice or declaration wording.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `version: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `declaration_texts_kind_version_key`: `UNIQUE (kind, version)`
- `declaration_texts_version_check`: `CHECK ((version > 0))`

### title

Human-readable title of this request or published content.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `title: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### body

Full text/content of the notice or declaration.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `body: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sha256

SHA-256 digest of the associated content, used to identify the exact version or bytes.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `sha256: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_current

Whether this is the current published version; does not erase older acknowledgments.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `is_current: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

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
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `declaration_texts_kind_version_key`: `CREATE UNIQUE INDEX declaration_texts_kind_version_key ON prv.declaration_texts USING btree (kind, version)`
- Index `declaration_texts_one_current`: `CREATE UNIQUE INDEX declaration_texts_one_current ON prv.declaration_texts USING btree (kind) WHERE is_current`
- Index `declaration_texts_pkey`: `CREATE UNIQUE INDEX declaration_texts_pkey ON prv.declaration_texts USING btree (id)`

## prv.declarations

Declarations records; consult the field definitions and governing module specification.

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

- `declarations_pkey`: `PRIMARY KEY (id)`

### text_id

Reference linking this record’s text id to FOREIGN KEY (text_id) REFERENCES prv.declaration_texts(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `text_id: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `declarations_text_id_fkey`: `FOREIGN KEY (text_id) REFERENCES prv.declaration_texts(id)`

### kind

Classification of this record; exact accepted codes and conditions are listed in its database rules.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `kind: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### text_version

Version of the declaration wording accepted by the signatory.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `text_version: number;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### text_sha256

SHA-256 digest binding acceptance to the exact declaration wording.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `text_sha256: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

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

- `declarations_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL`
- `declarations_subject`: `CHECK (((candidate_id IS NOT NULL) OR (employee_id IS NOT NULL)))`

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

- `declarations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `declarations_subject`: `CHECK (((candidate_id IS NOT NULL) OR (employee_id IS NOT NULL)))`

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

- `declarations_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### accepted

Whether the declaration was accepted by the signatory.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `accepted: boolean;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### signature_kind

Form of signature/acknowledgment captured with the declaration.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `signature_kind: 'typed' \| 'drawn';` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `typed` | Typed classification for signature kind. | DB CHECK: declarations_signature_kind_check |
| `drawn` | Drawn classification for signature kind. | DB CHECK: declarations_signature_kind_check |

Database rules (including conditions shared with other fields):

- `declarations_drawn_has_image`: `CHECK (((signature_kind <> 'drawn'::text) OR (signature_document_id IS NOT NULL)))`
- `declarations_signature_kind_check`: `CHECK ((signature_kind = ANY (ARRAY['typed'::text, 'drawn'::text])))`

### signed_name

Name entered by the person signing or acknowledging the declaration.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `signed_name: string;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### signature_document_id

Reference linking this record’s signature document id to FOREIGN KEY (signature_document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `signature_document_id: number \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `declarations_drawn_has_image`: `CHECK (((signature_kind <> 'drawn'::text) OR (signature_document_id IS NOT NULL)))`
- `declarations_signature_document_id_fkey`: `FOREIGN KEY (signature_document_id) REFERENCES core.documents(id)`

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

### user_agent

Client/browser user-agent captured as submission or session provenance.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `user_agent: string \| null;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### accepted_at

Instant of accepted for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `accepted_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.joining.ts](../../backend/src/core/db/types.joining.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `declarations_candidate_idx`: `CREATE INDEX declarations_candidate_idx ON prv.declarations USING btree (candidate_id) WHERE (candidate_id IS NOT NULL)`
- Index `declarations_employee_idx`: `CREATE INDEX declarations_employee_idx ON prv.declarations USING btree (employee_id, kind) WHERE (employee_id IS NOT NULL)`
- Index `declarations_pkey`: `CREATE UNIQUE INDEX declarations_pkey ON prv.declarations USING btree (id)`
- Trigger `declarations_guard` → `prv.declarations_guard` (enabled flag `O`).

## prv.legal_holds

Legal holds records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `legal_holds_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

- `legal_holds_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### data_class

Classification of personal data subject to processing, retention, hold or purge handling.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `data_class: string \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### reason

Recorded business justification for the operation or decision.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `reason: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### placed_by

Reference linking this record’s placed by to FOREIGN KEY (placed_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `placed_by: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `legal_holds_placed_by_fkey`: `FOREIGN KEY (placed_by) REFERENCES core.users(id)`

### released_at

Instant of released for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `released_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `legal_holds_pkey`: `CREATE UNIQUE INDEX legal_holds_pkey ON prv.legal_holds USING btree (id)`

## prv.notice_acks

Notice acks records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `notice_acks_pkey`: `PRIMARY KEY (id)`

### notice_id

Reference linking this record’s notice id to FOREIGN KEY (notice_id) REFERENCES prv.notices(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `notice_id: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `notice_acks_notice_id_fkey`: `FOREIGN KEY (notice_id) REFERENCES prv.notices(id)`
- `notice_acks_notice_id_user_id_key`: `UNIQUE (notice_id, user_id)`

### user_id

Reference linking this record’s user id to FOREIGN KEY (user_id) REFERENCES core.users(id).

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

- `notice_acks_notice_id_user_id_key`: `UNIQUE (notice_id, user_id)`
- `notice_acks_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

### acknowledged_at

Instant of acknowledged for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `acknowledged_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `notice_acks_notice_id_user_id_key`: `CREATE UNIQUE INDEX notice_acks_notice_id_user_id_key ON prv.notice_acks USING btree (notice_id, user_id)`
- Index `notice_acks_pkey`: `CREATE UNIQUE INDEX notice_acks_pkey ON prv.notice_acks USING btree (id)`

## prv.notices

Notices records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `notices_pkey`: `PRIMARY KEY (id)`

### version

Version identifier of the published notice or declaration wording.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `version: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `notices_principal_class_version_key`: `UNIQUE (principal_class, version)`

### principal_class

Class of individuals to whom the privacy notice applies.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `principal_class: PrincipalClass;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `employee` | Employee. | DB CHECK: notices_principal_class_check |
| `candidate` | Candidate. | DB CHECK: notices_principal_class_check |
| `contractor_worker` | Contractor worker. | DB CHECK: notices_principal_class_check |
| `dependant` | Dependant. | DB CHECK: notices_principal_class_check |

Database rules (including conditions shared with other fields):

- `notices_principal_class_check`: `CHECK ((principal_class = ANY (ARRAY['employee'::text, 'candidate'::text, 'contractor_worker'::text, 'dependant'::text])))`
- `notices_principal_class_version_key`: `UNIQUE (principal_class, version)`

### title

Human-readable title of this request or published content.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `title: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### body

Full text/content of the notice or declaration.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `body: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### effective_from

Date from which this version or rule applies.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `effective_from: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_current

Whether this is the current published version; does not erase older acknowledgments.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `is_current: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `notices_pkey`: `CREATE UNIQUE INDEX notices_pkey ON prv.notices USING btree (id)`
- Index `notices_principal_class_version_key`: `CREATE UNIQUE INDEX notices_principal_class_version_key ON prv.notices USING btree (principal_class, version)`

## prv.processing_register

Processing register records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `processing_register_pkey`: `PRIMARY KEY (id)`

### data_class

Classification of personal data subject to processing, retention, hold or purge handling.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `data_class: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `processing_register_data_class_key`: `UNIQUE (data_class)`

### purpose

Declared business purpose of this request, processing activity or consent.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `purpose: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### lawful_basis

Recorded legal basis for the processing activity; documentation does not validate legal sufficiency.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `lawful_basis: LawfulBasis;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `employment` | Employment. | DB CHECK: processing_register_lawful_basis_check |
| `consent` | Consent. | DB CHECK: processing_register_lawful_basis_check |
| `legal_obligation` | Legal obligation. | DB CHECK: processing_register_lawful_basis_check |

Database rules (including conditions shared with other fields):

- `processing_register_lawful_basis_check`: `CHECK ((lawful_basis = ANY (ARRAY['employment'::text, 'consent'::text, 'legal_obligation'::text])))`

### retention_days

Configured retention duration in days for the associated data class/activity.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `retention_days: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `processing_register_retention_days_check`: `CHECK ((retention_days > 0))`

### recipients

Recorded recipients or recipient categories for the processing activity.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `recipients: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `processing_register_data_class_key`: `CREATE UNIQUE INDEX processing_register_data_class_key ON prv.processing_register USING btree (data_class)`
- Index `processing_register_pkey`: `CREATE UNIQUE INDEX processing_register_pkey ON prv.processing_register USING btree (id)`
- Trigger `processing_register_updated_at` → `core.set_updated_at` (enabled flag `O`).

## prv.processors

Processors records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `processors_pkey`: `PRIMARY KEY (id)`

### name

Human-readable display name of this catalog record.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### purpose

Declared business purpose of this request, processing activity or consent.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `purpose: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### dpa_status

Status of the processor's data-processing agreement.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `dpa_status: 'active' \| 'expired' \| 'missing';` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `active` | Active. | DB CHECK: processors_dpa_status_check |
| `expired` | Expired. | DB CHECK: processors_dpa_status_check |
| `missing` | Missing. | DB CHECK: processors_dpa_status_check |

Database rules (including conditions shared with other fields):

- `processors_dpa_status_check`: `CHECK ((dpa_status = ANY (ARRAY['active'::text, 'expired'::text, 'missing'::text])))`

### dpa_expires_on

Expiry date of the processor's data-processing agreement.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `dpa_expires_on: DateOnly \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### owner_email

Contact email of the person responsible for this processor record.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `owner_email: string \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `processors_pkey`: `CREATE UNIQUE INDEX processors_pkey ON prv.processors USING btree (id)`
- Trigger `processors_updated_at` → `core.set_updated_at` (enabled flag `O`).

## prv.purge_log

Purge log records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `purge_log_pkey`: `PRIMARY KEY (id)`

### proposal_id

Reference linking this record’s proposal id to FOREIGN KEY (proposal_id) REFERENCES prv.purge_proposals(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `proposal_id: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `purge_log_proposal_id_fkey`: `FOREIGN KEY (proposal_id) REFERENCES prv.purge_proposals(id)`

### data_class

Classification of personal data subject to processing, retention, hold or purge handling.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `data_class: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### row_count

Number of rows included in the proposed or completed purge.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `row_count: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rule

Snapshot/reference of the retention rule used for the completed purge.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `rule: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### executed_at

Instant of executed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `executed_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `purge_log_pkey`: `CREATE UNIQUE INDEX purge_log_pkey ON prv.purge_log USING btree (id)`
- Trigger `purge_log_immutable` → `prv.purge_log_immutable` (enabled flag `O`).

## prv.purge_proposals

Purge proposals records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `purge_proposals_pkey`: `PRIMARY KEY (id)`

### data_class

Classification of personal data subject to processing, retention, hold or purge handling.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `data_class: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### row_count

Number of rows included in the proposed or completed purge.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `row_count: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `purge_proposals_row_count_check`: `CHECK ((row_count >= 0))`

### excluded_holds

Number of records excluded from this purge proposal because legal holds apply.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `excluded_holds: Generated<number>;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### proposed_by

Reference linking this record’s proposed by to FOREIGN KEY (proposed_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `proposed_by: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `purge_proposals_check`: `CHECK (((confirmed_by IS NULL) OR (confirmed_by <> proposed_by)))`
- `purge_proposals_proposed_by_fkey`: `FOREIGN KEY (proposed_by) REFERENCES core.users(id)`

### proposed_at

Instant of proposed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `proposed_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### confirmed_by

Reference linking this record’s confirmed by to FOREIGN KEY (confirmed_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `confirmed_by: number \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `purge_proposals_check`: `CHECK (((confirmed_by IS NULL) OR (confirmed_by <> proposed_by)))`
- `purge_proposals_confirmed_by_fkey`: `FOREIGN KEY (confirmed_by) REFERENCES core.users(id)`

### confirmed_at

Instant of confirmed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `confirmed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `purge_proposals_pkey`: `CREATE UNIQUE INDEX purge_proposals_pkey ON prv.purge_proposals USING btree (id)`

## prv.retention_rules

Retention rules records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `retention_rules_pkey`: `PRIMARY KEY (id)`

### data_class

Classification of personal data subject to processing, retention, hold or purge handling.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `data_class: string;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `retention_rules_data_class_fkey`: `FOREIGN KEY (data_class) REFERENCES prv.processing_register(data_class)`
- `retention_rules_data_class_key`: `UNIQUE (data_class)`

### retention_days

Configured retention duration in days for the associated data class/activity.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `retention_days: number;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `retention_rules_retention_days_check`: `CHECK ((retention_days > 0))`

### created_at

Instant this record was created.

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

- Index `retention_rules_data_class_key`: `CREATE UNIQUE INDEX retention_rules_data_class_key ON prv.retention_rules USING btree (data_class)`
- Index `retention_rules_pkey`: `CREATE UNIQUE INDEX retention_rules_pkey ON prv.retention_rules USING btree (id)`

## prv.rights_requests

Rights requests records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `rights_requests_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

- `rights_requests_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### kind

Classification of this record; exact accepted codes and conditions are listed in its database rules.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `kind: RightsKind;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `access` | Access classification for kind. | DB CHECK: rights_requests_kind_check |
| `correction` | Correction classification for kind. | DB CHECK: rights_requests_kind_check |
| `erasure` | Erasure classification for kind. | DB CHECK: rights_requests_kind_check |

Database rules (including conditions shared with other fields):

- `rights_requests_kind_check`: `CHECK ((kind = ANY (ARRAY['access'::text, 'correction'::text, 'erasure'::text])))`

### status

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'open'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `status: Generated<RightsStatus>;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `open` | Record is open in this lifecycle. | DB CHECK: rights_requests_status_check |
| `in_progress` | Record is in progress in this lifecycle. | DB CHECK: rights_requests_status_check |
| `fulfilled` | Record is fulfilled in this lifecycle. | DB CHECK: rights_requests_status_check |
| `refused` | Record is refused in this lifecycle. | DB CHECK: rights_requests_status_check |

Database rules (including conditions shared with other fields):

- `rights_requests_status_check`: `CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'fulfilled'::text, 'refused'::text])))`

### reason

Recorded business justification for the operation or decision.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `reason: string \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### refusal_reason

Recorded explanation for refusing the privacy-rights request.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `refusal_reason: string \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### workflow_request_id

Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database FK is present.

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

- `rights_requests_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

### due_at

Instant of due for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `due_at: Timestamp;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### closed_at

Instant of closed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `closed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `rights_requests_pkey`: `CREATE UNIQUE INDEX rights_requests_pkey ON prv.rights_requests USING btree (id)`

