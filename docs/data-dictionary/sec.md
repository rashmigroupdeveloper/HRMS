# sec — field dictionary

62 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## sec.access_events

Records access to protected employee information.

sec.access_events — who read whose sensitive data and WHY (SEC-10/11).

Relation kind: partitioned parent table.

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

- `access_events_pkey`: `PRIMARY KEY (id, occurred_at)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_events_pkey`: `PRIMARY KEY (id, occurred_at)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_events_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

### session_sid

**In everyday language:** main login-session identifier associated with this access/grant event.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Canonical login-session identifier associated with this access/grant event.

| Property | Definition |
|---|---|
| SQL type | `uuid` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `session_sid: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### subject_employee_id

**In everyday language:** Employee whose data was accessed; distinct from the user who performed the access.

**Why it is kept:** Keeps this record connected to the correct subject employee, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Employee whose data was accessed; distinct from the user who performed the access.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `subject_employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### resource

**In everyday language:** Resource/table/document identifier describing what was accessed.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the resource.

Technical definition: Resource/table/document identifier describing what was accessed.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `resource: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### field_class

**In everyday language:** Sensitivity class of the accessed fields.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the field class.

Technical definition: Sensitivity class of the accessed fields.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `field_class: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_events_purpose_stated`: `CHECK ((length(btrim(purpose)) >= 3))`

### record_count

**In everyday language:** Number of records represented or accessed in this batch/event.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Number of records represented or accessed in this batch/event.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 1 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `record_count: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `access_events_count_positive`: `CHECK ((record_count > 0))`

### ip

**In everyday language:** Client IP address captured as access or submission where the information came from; personal/security descriptive information.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A saved browser or connection detail can help an authorized administrator investigate which sign-in or submission produced the event.

Technical definition: Client IP address captured as access or submission provenance; personal/security metadata.

| Property | Definition |
|---|---|
| SQL type | `inet` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `ip: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `access_events_actor_idx`: `CREATE INDEX access_events_actor_idx ON ONLY sec.access_events USING btree (actor_user_id, occurred_at DESC)`
- Index `access_events_pkey`: `CREATE UNIQUE INDEX access_events_pkey ON ONLY sec.access_events USING btree (id, occurred_at)`
- Index `access_events_subject_idx`: `CREATE INDEX access_events_subject_idx ON ONLY sec.access_events USING btree (subject_employee_id, occurred_at DESC)`
- Trigger `access_events_immutable` → `sec.access_events_immutable` (enabled flag `O`).

## sec.app_links

Connects an HRMS login account to a verified account in another approved application.

D4/NFR-03: identities are immutable; nonce rotates to prevent relink resurrecting old sessions.

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
| Code declaration | `id:Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `app_links_pkey`: `PRIMARY KEY (id)`

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
| Code declaration | `user_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `app_links_client_id_user_id_key`: `UNIQUE (client_id, user_id)`
- `app_links_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

### client_id

**In everyday language:** Configured external application/client identifier participating in linked sign-in.

**Why it is kept:** Keeps this record connected to the correct client, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Configured external application/client identifier participating in linked sign-in.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `client_id:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `app_links_client_id_check`: `CHECK ((length(btrim(client_id)) > 0))`
- `app_links_client_id_external_subject_key`: `UNIQUE (client_id, external_subject)`
- `app_links_client_id_user_id_key`: `UNIQUE (client_id, user_id)`

### external_subject

**In everyday language:** External application's account identifier; not an HRMS employee code or role.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the external subject shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: External application's account identifier; not an HRMS employee code or role.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `external_subject:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `app_links_client_id_external_subject_key`: `UNIQUE (client_id, external_subject)`
- `app_links_external_subject_check`: `CHECK ((external_subject ~ '^[1-9][0-9]*$'::text))`

### is_active

**In everyday language:** Whether this list of available choices or account record is currently available for use; historical references remain.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether this catalog or account record is currently available for use; historical references remain.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `is_active:Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### link_nonce

**In everyday language:** Random link-version identifier rotated on unlink/re-enable to invalidate earlier grants.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Random link-version identifier rotated on unlink/re-enable to invalidate earlier grants.

| Property | Definition |
|---|---|
| SQL type | `uuid` |
| Required | Yes |
| Default | gen_random_uuid() |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `link_nonce:Generated<string>;` |
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
| Code declaration | `created_by:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `app_links_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

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
| Code declaration | `created_at:Generated<Date>` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `app_links_client_id_external_subject_key`: `CREATE UNIQUE INDEX app_links_client_id_external_subject_key ON sec.app_links USING btree (client_id, external_subject)`
- Index `app_links_client_id_user_id_key`: `CREATE UNIQUE INDEX app_links_client_id_user_id_key ON sec.app_links USING btree (client_id, user_id)`
- Index `app_links_pkey`: `CREATE UNIQUE INDEX app_links_pkey ON sec.app_links USING btree (id)`
- Trigger `app_link_guard` → `sec.app_link_guard` (enabled flag `O`).

## sec.mfa_enrolments

Retains extra sign-in verification setup for compatibility; this feature is outside the current approved scope.

sec.mfa_enrolments — one active TOTP enrolment per user (SEC-02/03).

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
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mfa_enrolments_pkey`: `PRIMARY KEY (id)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mfa_enrolments_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

### secret

**In everyday language:** Retained MFA enrolment secret material; MFA is excluded from the approved current scope. Restrict access; never export values.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Retained MFA enrolment secret material; MFA is excluded from the approved current scope. Restrict access; never export values.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `secret: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### disabled_at

**In everyday language:** Date and time of disabled for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of disabled for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `disabled_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### disabled_by_user_id

**In everyday language:** Identifies disabled by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct disabled by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s disabled by user id to FOREIGN KEY (disabled_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `disabled_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mfa_enrolments_disabled_by_user_id_fkey`: `FOREIGN KEY (disabled_by_user_id) REFERENCES core.users(id)`

### last_used_step

**In everyday language:** Replay guard — a TOTP step may be spent exactly once.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Replay guard — a TOTP step may be spent exactly once.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:1883 |
| Code declaration | `last_used_step: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

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
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

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
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `mfa_enrolments_pkey`: `CREATE UNIQUE INDEX mfa_enrolments_pkey ON sec.mfa_enrolments USING btree (id)`
- Index `mfa_one_active_per_user`: `CREATE UNIQUE INDEX mfa_one_active_per_user ON sec.mfa_enrolments USING btree (user_id) WHERE (disabled_at IS NULL)`
- Trigger `mfa_enrolments_updated_at` → `core.set_updated_at` (enabled flag `O`).

## sec.mfa_recovery_codes

Retains recovery-code information for extra sign-in verification; this feature is outside the current approved scope.

sec.mfa_recovery_codes — hashed, single-use.

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
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mfa_recovery_codes_pkey`: `PRIMARY KEY (id)`

### enrolment_id

**In everyday language:** Identifies enrolment connected to this record.

**Why it is kept:** Keeps this record connected to the correct enrolment, so related details can be checked together.

**Example:** This record points to an existing entry in mfa enrolments instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s enrolment id to FOREIGN KEY (enrolment_id) REFERENCES sec.mfa_enrolments(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `enrolment_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `mfa_recovery_codes_enrolment_id_fkey`: `FOREIGN KEY (enrolment_id) REFERENCES sec.mfa_enrolments(id) ON DELETE CASCADE`

### code_hash

**In everyday language:** Hash of a one-time credential/code; plaintext credentials must not be exposed.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Hash of a one-time credential/code; plaintext credentials must not be exposed.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `code_hash: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### used_at

**In everyday language:** Date and time of used for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of used for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `used_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

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
| Scope | Retained compatibility schema; MFA excluded from current sponsor scope |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `mfa_recovery_codes_pkey`: `CREATE UNIQUE INDEX mfa_recovery_codes_pkey ON sec.mfa_recovery_codes USING btree (id)`
- Index `mfa_recovery_enrolment_idx`: `CREATE INDEX mfa_recovery_enrolment_idx ON sec.mfa_recovery_codes USING btree (enrolment_id)`

## sec.password_history

Keeps password fingerprints needed to check password history without exposing previous passwords.

sec.password_history — hashes only, so reuse is refusable (SEC-01).

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

- `password_history_pkey`: `PRIMARY KEY (id)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `password_history_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

### password_hash

**In everyday language:** Stored password digital fingerprint; never a recoverable password and never returned in normal APIs or logs.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Stored password digest; never a recoverable password and never returned in normal APIs or logs.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `password_hash: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### changed_at

**In everyday language:** Date and time of changed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of changed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `changed_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### changed_by_user_id

**In everyday language:** Identifies changed by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct changed by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s changed by user id to FOREIGN KEY (changed_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `changed_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `password_history_changed_by_user_id_fkey`: `FOREIGN KEY (changed_by_user_id) REFERENCES core.users(id)`

Table indexes and lifecycle triggers:

- Index `password_history_pkey`: `CREATE UNIQUE INDEX password_history_pkey ON sec.password_history USING btree (id)`
- Index `password_history_user_idx`: `CREATE INDEX password_history_user_idx ON sec.password_history USING btree (user_id, changed_at DESC)`

## sec.sessions

Tracks individual sign-ins, their expiry and whether access has been ended.

sec.sessions — a session is a ROW, so revoke takes effect next request.

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

- `sessions_pkey`: `PRIMARY KEY (id)`

### sid

**In everyday language:** Unique main login-session identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Unique canonical login-session identifier.

| Property | Definition |
|---|---|
| SQL type | `uuid` |
| Required | Yes |
| Default | gen_random_uuid() |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `sid: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_sid_key`: `UNIQUE (sid)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

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

Database rules (including conditions shared with other fields):

- `sessions_expiry_after_start`: `CHECK ((expires_at > created_at))`

### last_seen_at

**In everyday language:** Date and time of last seen for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of last seen for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `last_seen_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### expires_at

**In everyday language:** Date and time of expires for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of expires for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `expires_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_expiry_after_start`: `CHECK ((expires_at > created_at))`

### revoked_at

**In everyday language:** Date and time of revoked for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of revoked for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `revoked_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_revoke_pairs`: `CHECK ((((revoked_at IS NULL) AND (revoke_reason IS NULL)) OR ((revoked_at IS NOT NULL) AND (revoke_reason IS NOT NULL))))`

### revoked_by_user_id

**In everyday language:** Identifies revoked by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct revoked by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s revoked by user id to FOREIGN KEY (revoked_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `revoked_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_revoked_by_user_id_fkey`: `FOREIGN KEY (revoked_by_user_id) REFERENCES core.users(id)`

### revoke_reason

**In everyday language:** Reason this session was terminated before expiry.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Reason this session was terminated before expiry.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `revoke_reason: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_revoke_pairs`: `CHECK ((((revoked_at IS NULL) AND (revoke_reason IS NULL)) OR ((revoked_at IS NOT NULL) AND (revoke_reason IS NOT NULL))))`

### ip

**In everyday language:** Client IP address captured as access or submission where the information came from; personal/security descriptive information.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A saved browser or connection detail can help an authorized administrator investigate which sign-in or submission produced the event.

Technical definition: Client IP address captured as access or submission provenance; personal/security metadata.

| Property | Definition |
|---|---|
| SQL type | `inet` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `ip: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### device_label

**In everyday language:** Human-readable device/browser label for session administration.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A saved browser or connection detail can help an authorized administrator investigate which sign-in or submission produced the event.

Technical definition: Human-readable device/browser label for session administration.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `device_label: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### stepped_up_at

**In everyday language:** Date and time of stepped up for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of stepped up for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `stepped_up_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_stepup_pairs`: `CHECK ((((stepped_up_at IS NULL) AND (stepped_up_until IS NULL)) OR ((stepped_up_at IS NOT NULL) AND (stepped_up_until IS NOT NULL) AND (stepped_up_until > stepped_up_at))))`

### stepped_up_until

**In everyday language:** Expiry of elevated session assurance retained for compatibility; MFA is excluded from current scope.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This retains the end time of extra sign-in assurance for compatibility; it does not enable the excluded MFA feature.

Technical definition: Expiry of elevated session assurance retained for compatibility; MFA is excluded from current scope.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `stepped_up_until: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_stepup_pairs`: `CHECK ((((stepped_up_at IS NULL) AND (stepped_up_until IS NULL)) OR ((stepped_up_at IS NOT NULL) AND (stepped_up_until IS NOT NULL) AND (stepped_up_until > stepped_up_at))))`

### refresh_token_hash

**In everyday language:** a digital fingerprint used to check that information matches digital fingerprint of the currently redeemable refresh token; replaced atomically on redemption. not recorded legacy rows cannot refresh.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: SHA-256 digest of the currently redeemable refresh token; replaced atomically on redemption. NULL legacy rows cannot refresh.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `refresh_token_hash: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sessions_refresh_token_hash_check`: `CHECK ((refresh_token_hash ~ '^[0-9a-f]{64}$'::text))`

Table indexes and lifecycle triggers:

- Index `sessions_pkey`: `CREATE UNIQUE INDEX sessions_pkey ON sec.sessions USING btree (id)`
- Index `sessions_sid_key`: `CREATE UNIQUE INDEX sessions_sid_key ON sec.sessions USING btree (sid)`
- Index `sessions_sid_live_idx`: `CREATE INDEX sessions_sid_live_idx ON sec.sessions USING btree (sid) WHERE (revoked_at IS NULL)`
- Index `sessions_user_idx`: `CREATE INDEX sessions_user_idx ON sec.sessions USING btree (user_id, last_seen_at DESC)`

## sec.sso_grants

Keeps short-lived proof used to sign into an approved linked application.

One-use authorization credential; plaintext code/verifier/tokens never persist.

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
| Code declaration | `id:Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_pkey`: `PRIMARY KEY (id)`

### code_hash

**In everyday language:** Hash of a one-time credential/code; plaintext credentials must not be exposed.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Hash of a one-time credential/code; plaintext credentials must not be exposed.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `code_hash:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_code_hash_check`: `CHECK ((code_hash ~ '^[a-f0-9]{64}$'::text))`
- `sso_grants_code_hash_key`: `UNIQUE (code_hash)`

### link_id

**In everyday language:** Identifies link connected to this record.

**Why it is kept:** Keeps this record connected to the correct link, so related details can be checked together.

**Example:** This record points to an existing entry in app links instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s link id to FOREIGN KEY (link_id) REFERENCES sec.app_links(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `link_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_link_id_fkey`: `FOREIGN KEY (link_id) REFERENCES sec.app_links(id)`

### link_nonce

**In everyday language:** Random link-version identifier rotated on unlink/re-enable to invalidate earlier grants.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: Random link-version identifier rotated on unlink/re-enable to invalidate earlier grants.

| Property | Definition |
|---|---|
| SQL type | `uuid` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `link_nonce:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### session_sid

**In everyday language:** main login-session identifier associated with this access/grant event.

**Why it is kept:** Keeps this record connected to the correct session sid, so related details can be checked together.

**Example:** This record points to an existing entry in sessions instead of copying all of that entry’s details.

Technical definition: Canonical login-session identifier associated with this access/grant event.

| Property | Definition |
|---|---|
| SQL type | `uuid` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `session_sid:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_session_sid_fkey`: `FOREIGN KEY (session_sid) REFERENCES sec.sessions(sid)`

### redirect_uri

**In everyday language:** Exact registered redirect destination bound to the one-time sign-in shared with an approved application grant.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An authorized process follows this reference to find the associated file or destination. The reference alone does not grant access.

Technical definition: Exact registered redirect destination bound to the one-time SSO grant.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `redirect_uri:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_redirect_uri_check`: `CHECK ((length(btrim(redirect_uri)) > 0))`

### challenge

**In everyday language:** S256 a security check linking the sign-in request to the same requesting application challenge bound to the sign-in shared with an approved application grant, verified against the redeemer's verifier.

**Why it is kept:** Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.

**Example:** The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.

Technical definition: S256 PKCE challenge bound to the SSO grant, verified against the redeemer's verifier.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `challenge:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_challenge_check`: `CHECK ((challenge ~ '^[A-Za-z0-9_-]{43}$'::text))`

### expires_at

**In everyday language:** Date and time of expires for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of expires for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `expires_at:Date;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_check`: `CHECK ((expires_at > created_at))`

### consumed_at

**In everyday language:** Date and time of consumed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of consumed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `consumed_at:Date\|null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_check1`: `CHECK (((consumed_at IS NULL) OR (consumed_at >= created_at)))`

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
| Code declaration | `created_at:Generated<Date>` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `sso_grants_check`: `CHECK ((expires_at > created_at))`
- `sso_grants_check1`: `CHECK (((consumed_at IS NULL) OR (consumed_at >= created_at)))`

Table indexes and lifecycle triggers:

- Index `sso_grants_code_hash_key`: `CREATE UNIQUE INDEX sso_grants_code_hash_key ON sec.sso_grants USING btree (code_hash)`
- Index `sso_grants_expiry_idx`: `CREATE INDEX sso_grants_expiry_idx ON sec.sso_grants USING btree (expires_at)`
- Index `sso_grants_pkey`: `CREATE UNIQUE INDEX sso_grants_pkey ON sec.sso_grants USING btree (id)`
- Trigger `sso_grant_guard` → `sec.sso_grant_guard` (enabled flag `O`).

