# prv — field dictionary

104 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## prv.breach_register

Records incidents involving possible loss or misuse of personal information.

Breach register records; consult the field definitions and governing module specification.

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

- `breach_register_pkey`: `PRIMARY KEY (id)`

### discovered_at

**In everyday language:** Date and time of discovered for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of discovered for this record.

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

**In everyday language:** Recorded summary of the privacy breach incident.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Recorded summary of the privacy breach incident.

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

**In everyday language:** Date and time of notified board for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of notified board for this record.

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

**In everyday language:** Date and time of notified principals for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of notified principals for this record.

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

**In everyday language:** Identifies recorded by connected to this record.

**Why it is kept:** Keeps this record connected to the correct recorded by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s recorded by to FOREIGN KEY (recorded_by) REFERENCES core.users(id).

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

Keeps the history of changes to a person’s recorded consent.

Consent events records; consult the field definitions and governing module specification.

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

- `consent_events_pkey`: `PRIMARY KEY (id)`

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

- `consent_events_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### purpose

**In everyday language:** Declared business purpose of this request, processing activity or consent.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A privacy or travel record explains the particular reason information is used or a trip is requested.

Technical definition: Declared business purpose of this request, processing activity or consent.

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

**In everyday language:** Operation or decision recorded by this event; permitted codes are listed with the field constraints.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “grant” means Grant classification for action.

Technical definition: Operation or decision recorded by this event; permitted codes are listed with the field constraints.

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

**In everyday language:** Identifies actor user connected to this record.

**Why it is kept:** Keeps this record connected to the correct actor user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s actor user id to FOREIGN KEY (actor_user_id) REFERENCES core.users(id).

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `consent_events_pkey`: `CREATE UNIQUE INDEX consent_events_pkey ON prv.consent_events USING btree (id)`
- Trigger `consent_events_immutable` → `prv.consent_events_immutable` (enabled flag `O`).

## prv.consents

Records whether a person has given consent for a stated use of information.

Consents records; consult the field definitions and governing module specification.

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

- `consents_pkey`: `PRIMARY KEY (id)`

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

- `consents_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `consents_employee_id_purpose_key`: `UNIQUE (employee_id, purpose)`

### purpose

**In everyday language:** Declared business purpose of this request, processing activity or consent.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “photograph” means Photograph.

Technical definition: Declared business purpose of this request, processing activity or consent.

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

**In everyday language:** Whether consent is currently recorded as granted for the stated purpose.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether consent is currently recorded as granted for the stated purpose.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `consents_employee_id_purpose_key`: `CREATE UNIQUE INDEX consents_employee_id_purpose_key ON prv.consents USING btree (employee_id, purpose)`
- Index `consents_pkey`: `CREATE UNIQUE INDEX consents_pkey ON prv.consents USING btree (id)`

## prv.declaration_texts

Keeps the exact versions of declaration wording.

Declaration texts records; consult the field definitions and governing module specification.

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

- `declaration_texts_pkey`: `PRIMARY KEY (id)`

### kind

**In everyday language:** Classification of this record; exact accepted codes and conditions are listed in its database rules.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the kind.

Technical definition: Classification of this record; exact accepted codes and conditions are listed in its database rules.

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

**In everyday language:** Version identifier of the published notice or declaration wording.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Version identifier of the published notice or declaration wording.

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

**In everyday language:** Human-readable title of this request or published content.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the title shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Human-readable title of this request or published content.

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

**In everyday language:** Full text/content of the notice or declaration.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Full text/content of the notice or declaration.

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

**In everyday language:** a digital fingerprint used to check that information matches digital fingerprint of the associated content, used to identify the exact version or bytes.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The actual security value is omitted. The system compares it to check the correct credential or exact information.

Technical definition: SHA-256 digest of the associated content, used to identify the exact version or bytes.

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

**In everyday language:** Whether this is the current published version; does not erase older acknowledgments.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether this is the current published version; does not erase older acknowledgments.

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

Table indexes and lifecycle triggers:

- Index `declaration_texts_kind_version_key`: `CREATE UNIQUE INDEX declaration_texts_kind_version_key ON prv.declaration_texts USING btree (kind, version)`
- Index `declaration_texts_one_current`: `CREATE UNIQUE INDEX declaration_texts_one_current ON prv.declaration_texts USING btree (kind) WHERE is_current`
- Index `declaration_texts_pkey`: `CREATE UNIQUE INDEX declaration_texts_pkey ON prv.declaration_texts USING btree (id)`

## prv.declarations

Records which declaration wording a person accepted and how they signed.

Declarations records; consult the field definitions and governing module specification.

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

- `declarations_pkey`: `PRIMARY KEY (id)`

### text_id

**In everyday language:** Identifies text connected to this record.

**Why it is kept:** Keeps this record connected to the correct text, so related details can be checked together.

**Example:** This record points to an existing entry in declaration texts instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s text id to FOREIGN KEY (text_id) REFERENCES prv.declaration_texts(id).

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

**In everyday language:** Classification of this record; exact accepted codes and conditions are listed in its database rules.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the kind.

Technical definition: Classification of this record; exact accepted codes and conditions are listed in its database rules.

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

**In everyday language:** Version of the declaration wording accepted by the signatory.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Version of the declaration wording accepted by the signatory.

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

**In everyday language:** a digital fingerprint used to check that information matches digital fingerprint binding acceptance to the exact declaration wording.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The actual security value is omitted. The system compares it to check the correct credential or exact information.

Technical definition: SHA-256 digest binding acceptance to the exact declaration wording.

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

- `declarations_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES core.onboarding_candidates(id) ON DELETE SET NULL`
- `declarations_subject`: `CHECK (((candidate_id IS NOT NULL) OR (employee_id IS NOT NULL)))`

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

- `declarations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `declarations_subject`: `CHECK (((candidate_id IS NOT NULL) OR (employee_id IS NOT NULL)))`

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

- `declarations_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### accepted

**In everyday language:** Whether the declaration was accepted by the signatory.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether the declaration was accepted by the signatory.

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

**In everyday language:** Form of signature/acknowledgment captured with the declaration.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “typed” means Typed classification for signature kind.

Technical definition: Form of signature/acknowledgment captured with the declaration.

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

**In everyday language:** Name entered by the person signing or acknowledging the declaration.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the signed name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Name entered by the person signing or acknowledging the declaration.

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

**In everyday language:** Identifies signature document connected to this record.

**Why it is kept:** Keeps this record connected to the correct signature document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s signature document id to FOREIGN KEY (signature_document_id) REFERENCES core.documents(id).

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

### user_agent

**In everyday language:** Client/browser user-agent captured as submission or session where the information came from.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A saved browser or connection detail can help an authorized administrator investigate which sign-in or submission produced the event.

Technical definition: Client/browser user-agent captured as submission or session provenance.

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

**In everyday language:** Date and time of accepted for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of accepted for this record.

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

Records instructions to preserve information that would otherwise be eligible for deletion.

Legal holds records; consult the field definitions and governing module specification.

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

- `legal_holds_pkey`: `PRIMARY KEY (id)`

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

- `legal_holds_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### data_class

**In everyday language:** Classification of personal data subject to processing, how long information is kept, hold or purge handling.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the data class.

Technical definition: Classification of personal data subject to processing, retention, hold or purge handling.

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

**In everyday language:** Recorded business justification for the operation or decision.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Recorded business justification for the operation or decision.

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

**In everyday language:** Identifies placed by connected to this record.

**Why it is kept:** Keeps this record connected to the correct placed by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s placed by to FOREIGN KEY (placed_by) REFERENCES core.users(id).

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

**In everyday language:** Date and time of released for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of released for this record.

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

- Index `legal_holds_pkey`: `CREATE UNIQUE INDEX legal_holds_pkey ON prv.legal_holds USING btree (id)`

## prv.notice_acks

Records acknowledgments of privacy notices.

Notice acks records; consult the field definitions and governing module specification.

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

- `notice_acks_pkey`: `PRIMARY KEY (id)`

### notice_id

**In everyday language:** Identifies notice connected to this record.

**Why it is kept:** Keeps this record connected to the correct notice, so related details can be checked together.

**Example:** This record points to an existing entry in notices instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s notice id to FOREIGN KEY (notice_id) REFERENCES prv.notices(id).

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

- `notice_acks_notice_id_user_id_key`: `UNIQUE (notice_id, user_id)`
- `notice_acks_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

### acknowledged_at

**In everyday language:** Date and time of acknowledged for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of acknowledged for this record.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `notice_acks_notice_id_user_id_key`: `CREATE UNIQUE INDEX notice_acks_notice_id_user_id_key ON prv.notice_acks USING btree (notice_id, user_id)`
- Index `notice_acks_pkey`: `CREATE UNIQUE INDEX notice_acks_pkey ON prv.notice_acks USING btree (id)`

## prv.notices

Keeps published privacy notices and their versions.

Notices records; consult the field definitions and governing module specification.

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

- `notices_pkey`: `PRIMARY KEY (id)`

### version

**In everyday language:** Version identifier of the published notice or declaration wording.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Version identifier of the published notice or declaration wording.

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

**In everyday language:** Class of individuals to whom the privacy notice applies.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “employee” means Employee.

Technical definition: Class of individuals to whom the privacy notice applies.

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

**In everyday language:** Human-readable title of this request or published content.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the title shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Human-readable title of this request or published content.

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

**In everyday language:** Full text/content of the notice or declaration.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Full text/content of the notice or declaration.

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

**In everyday language:** Date from which this version or rule applies.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A time such as 9 AM describes the timing of this particular activity; whether a calendar date is also stored depends on the field.

Technical definition: Date from which this version or rule applies.

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

**In everyday language:** Whether this is the current published version; does not erase older acknowledgments.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether this is the current published version; does not erase older acknowledgments.

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

- Index `notices_pkey`: `CREATE UNIQUE INDEX notices_pkey ON prv.notices USING btree (id)`
- Index `notices_principal_class_version_key`: `CREATE UNIQUE INDEX notices_principal_class_version_key ON prv.notices USING btree (principal_class, version)`

## prv.processing_register

Describes what personal information is used, for what purpose and for how long.

Processing register records; consult the field definitions and governing module specification.

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

- `processing_register_pkey`: `PRIMARY KEY (id)`

### data_class

**In everyday language:** Classification of personal data subject to processing, how long information is kept, hold or purge handling.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the data class.

Technical definition: Classification of personal data subject to processing, retention, hold or purge handling.

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

**In everyday language:** Declared business purpose of this request, processing activity or consent.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A privacy or travel record explains the particular reason information is used or a trip is requested.

Technical definition: Declared business purpose of this request, processing activity or consent.

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

**In everyday language:** Recorded legal basis for the processing activity; documentation does not validate legal sufficiency.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “employment” means Employment.

Technical definition: Recorded legal basis for the processing activity; documentation does not validate legal sufficiency.

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

**In everyday language:** Configured how long information is kept duration in days for the associated data class/activity.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured retention duration in days for the associated data class/activity.

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

**In everyday language:** Recorded recipients or recipient categories for the processing activity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recipients shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Recorded recipients or recipient categories for the processing activity.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `processing_register_data_class_key`: `CREATE UNIQUE INDEX processing_register_data_class_key ON prv.processing_register USING btree (data_class)`
- Index `processing_register_pkey`: `CREATE UNIQUE INDEX processing_register_pkey ON prv.processing_register USING btree (id)`
- Trigger `processing_register_updated_at` → `core.set_updated_at` (enabled flag `O`).

## prv.processors

Lists outside organizations that process personal information for the company.

Processors records; consult the field definitions and governing module specification.

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

- `processors_pkey`: `PRIMARY KEY (id)`

### name

**In everyday language:** Human-readable display name of this list of available choices record.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Human-readable display name of this catalog record.

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

**In everyday language:** Declared business purpose of this request, processing activity or consent.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A privacy or travel record explains the particular reason information is used or a trip is requested.

Technical definition: Declared business purpose of this request, processing activity or consent.

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

**In everyday language:** Status of the processor's data-processing agreement.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “active” means Active.

Technical definition: Status of the processor's data-processing agreement.

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

**In everyday language:** Expiry date of the processor's data-processing agreement.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Expiry date of the processor's data-processing agreement.

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

**In everyday language:** Contact email of the person responsible for this processor record.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An invented contact such as sample@example.com shows an email address; use only the authorized contact for the purpose described above.

Technical definition: Contact email of the person responsible for this processor record.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `processors_pkey`: `CREATE UNIQUE INDEX processors_pkey ON prv.processors USING btree (id)`
- Trigger `processors_updated_at` → `core.set_updated_at` (enabled flag `O`).

## prv.purge_log

Keeps the record of completed personal-data deletion operations.

Purge log records; consult the field definitions and governing module specification.

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

- `purge_log_pkey`: `PRIMARY KEY (id)`

### proposal_id

**In everyday language:** Identifies proposal connected to this record.

**Why it is kept:** Keeps this record connected to the correct proposal, so related details can be checked together.

**Example:** This record points to an existing entry in purge proposals instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s proposal id to FOREIGN KEY (proposal_id) REFERENCES prv.purge_proposals(id).

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

**In everyday language:** Classification of personal data subject to processing, how long information is kept, hold or purge handling.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the data class.

Technical definition: Classification of personal data subject to processing, retention, hold or purge handling.

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

**In everyday language:** Number of rows included in the proposed or completed purge.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Number of rows included in the proposed or completed purge.

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

**In everyday language:** copy saved at that point in time/reference of the how long information is kept rule used for the completed purge.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the rule.

Technical definition: Snapshot/reference of the retention rule used for the completed purge.

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

**In everyday language:** Date and time of executed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of executed for this record.

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

Tracks proposed data deletions for review before execution.

Purge proposals records; consult the field definitions and governing module specification.

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

- `purge_proposals_pkey`: `PRIMARY KEY (id)`

### data_class

**In everyday language:** Classification of personal data subject to processing, how long information is kept, hold or purge handling.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the data class.

Technical definition: Classification of personal data subject to processing, retention, hold or purge handling.

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

**In everyday language:** Number of rows included in the proposed or completed purge.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Number of rows included in the proposed or completed purge.

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

**In everyday language:** Number of records excluded from this purge proposal because legal holds apply.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Number of records excluded from this purge proposal because legal holds apply.

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

**In everyday language:** Identifies proposed by connected to this record.

**Why it is kept:** Keeps this record connected to the correct proposed by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s proposed by to FOREIGN KEY (proposed_by) REFERENCES core.users(id).

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

**In everyday language:** Date and time of proposed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of proposed for this record.

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

**In everyday language:** Identifies confirmed by connected to this record.

**Why it is kept:** Keeps this record connected to the correct confirmed by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s confirmed by to FOREIGN KEY (confirmed_by) REFERENCES core.users(id).

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

**In everyday language:** Date and time of confirmed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of confirmed for this record.

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

Defines how long each category of personal information should be kept.

Retention rules records; consult the field definitions and governing module specification.

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

- `retention_rules_pkey`: `PRIMARY KEY (id)`

### data_class

**In everyday language:** Classification of personal data subject to processing, how long information is kept, hold or purge handling.

**Why it is kept:** Keeps this record connected to the correct data class, so related details can be checked together.

**Example:** This record points to an existing entry in processing register instead of copying all of that entry’s details.

Technical definition: Classification of personal data subject to processing, retention, hold or purge handling.

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

**In everyday language:** Configured how long information is kept duration in days for the associated data class/activity.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured retention duration in days for the associated data class/activity.

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

- Index `retention_rules_data_class_key`: `CREATE UNIQUE INDEX retention_rules_data_class_key ON prv.retention_rules USING btree (data_class)`
- Index `retention_rules_pkey`: `CREATE UNIQUE INDEX retention_rules_pkey ON prv.retention_rules USING btree (id)`

## prv.rights_requests

Tracks requests by people to exercise their privacy rights.

Rights requests records; consult the field definitions and governing module specification.

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

- `rights_requests_pkey`: `PRIMARY KEY (id)`

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

- `rights_requests_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### kind

**In everyday language:** Classification of this record; exact accepted codes and conditions are listed in its database rules.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “access” means Access classification for kind.

Technical definition: Classification of this record; exact accepted codes and conditions are listed in its database rules.

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

**In everyday language:** Current progress from creation to closure state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “open” means Record is open in this progress from creation to closure.

Technical definition: Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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
| Code source | [backend/src/core/db/types.prv.ts](../../backend/src/core/db/types.prv.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### refusal_reason

**In everyday language:** Recorded explanation for refusing the privacy-rights request.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Recorded explanation for refusing the privacy-rights request.

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

- `rights_requests_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

### due_at

**In everyday language:** Date and time of due for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of due for this record.

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

**In everyday language:** Date and time of closed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of closed for this record.

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

- Index `rights_requests_pkey`: `CREATE UNIQUE INDEX rights_requests_pkey ON prv.rights_requests USING btree (id)`

