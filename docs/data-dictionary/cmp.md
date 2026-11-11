# cmp — field dictionary

38 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## cmp.calendar_items

Tracks compliance obligations and their due dates.

cmp.calendar_items — every recurring statutory obligation, with an owner.

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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_items_pkey`: `PRIMARY KEY (id)`

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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_items_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### obligation_code

**In everyday language:** Configured obligation identity, not evidence law was verified.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Configured obligation identity, not evidence law was verified

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `obligation_code: string;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### title

**In everyday language:** Filing task label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the title shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Filing task label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `title: string;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### frequency

**In everyday language:** Recurrence category; rows do not themselves generate subsequent periods.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “monthly” means Monthly.

Technical definition: Recurrence category; rows do not themselves generate subsequent periods

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `frequency: CalendarFrequency;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `monthly` | Monthly. | DB CHECK: calendar_items_frequency_check |
| `quarterly` | Quarterly. | DB CHECK: calendar_items_frequency_check |
| `half_yearly` | Half yearly. | DB CHECK: calendar_items_frequency_check |
| `annual` | Annual. | DB CHECK: calendar_items_frequency_check |
| `one_off` | One off. | DB CHECK: calendar_items_frequency_check |

Database rules (including conditions shared with other fields):

- `calendar_items_frequency_check`: `CHECK ((frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'half_yearly'::text, 'annual'::text, 'one_off'::text])))`

### period_label

**In everyday language:** Human filing-period label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the period label.

Technical definition: Human filing-period label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `period_label: string;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### due_on

**In everyday language:** Required filing calendar deadline.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Required filing calendar deadline

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `due_on: DateOnly;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### owner_user_id

**In everyday language:** Identifies owner user connected to this record.

**Why it is kept:** Keeps this record connected to the correct owner user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s owner user id to FOREIGN KEY (owner_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `owner_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_items_owner_user_id_fkey`: `FOREIGN KEY (owner_user_id) REFERENCES core.users(id)`

### status

**In everyday language:** Due/filed/waived state; overdue is worked out from other saved information.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “due” means Record is due in this progress from creation to closure.

Technical definition: Due/filed/waived state; overdue is derived

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'due'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<CalendarStatus>;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `due` | Record is due in this lifecycle. | DB CHECK: calendar_items_status_check |
| `filed` | Record is filed in this lifecycle. | DB CHECK: calendar_items_status_check |
| `waived` | Record is waived in this lifecycle. | DB CHECK: calendar_items_status_check |

Database rules (including conditions shared with other fields):

- `calendar_filed_pairs`: `CHECK (((status <> 'filed'::text) OR ((filed_at IS NOT NULL) AND (filed_by_user_id IS NOT NULL))))`
- `calendar_items_status_check`: `CHECK ((status = ANY (ARRAY['due'::text, 'filed'::text, 'waived'::text])))`
- `calendar_waived_pairs`: `CHECK (((status <> 'waived'::text) OR ((waived_at IS NOT NULL) AND (waived_by_user_id IS NOT NULL) AND (waived_reason IS NOT NULL) AND (length(btrim(waived_reason)) >= 3))))`

### registration_id

**In everyday language:** Identifies registration connected to this record.

**Why it is kept:** Keeps this record connected to the correct registration, so related details can be checked together.

**Example:** This record points to an existing entry in registrations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s registration id to FOREIGN KEY (registration_id) REFERENCES cmp.registrations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `registration_id: number \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_items_registration_id_fkey`: `FOREIGN KEY (registration_id) REFERENCES cmp.registrations(id)`

### filed_at

**In everyday language:** Recorded filing instant; must agree with evidence and status.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Recorded filing instant; must agree with evidence and status

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `filed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_filed_pairs`: `CHECK (((status <> 'filed'::text) OR ((filed_at IS NOT NULL) AND (filed_by_user_id IS NOT NULL))))`

### filed_by_user_id

**In everyday language:** Identifies filed by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct filed by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s filed by user id to FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `filed_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_filed_pairs`: `CHECK (((status <> 'filed'::text) OR ((filed_at IS NOT NULL) AND (filed_by_user_id IS NOT NULL))))`
- `calendar_items_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

### waived_reason

**In everyday language:** Explicit reason an obligation was waived.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Explicit reason an obligation was waived

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `waived_reason: string \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_waived_pairs`: `CHECK (((status <> 'waived'::text) OR ((waived_at IS NOT NULL) AND (waived_by_user_id IS NOT NULL) AND (waived_reason IS NOT NULL) AND (length(btrim(waived_reason)) >= 3))))`

### waived_by_user_id

**In everyday language:** Identifies waived by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct waived by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s waived by user id to FOREIGN KEY (waived_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `waived_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_items_waived_by_user_id_fkey`: `FOREIGN KEY (waived_by_user_id) REFERENCES core.users(id)`
- `calendar_waived_pairs`: `CHECK (((status <> 'waived'::text) OR ((waived_at IS NOT NULL) AND (waived_by_user_id IS NOT NULL) AND (waived_reason IS NOT NULL) AND (length(btrim(waived_reason)) >= 3))))`

### waived_at

**In everyday language:** Waiver receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Waiver receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `waived_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `calendar_waived_pairs`: `CHECK (((status <> 'waived'::text) OR ((waived_at IS NOT NULL) AND (waived_by_user_id IS NOT NULL) AND (waived_reason IS NOT NULL) AND (length(btrim(waived_reason)) >= 3))))`

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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `calendar_due_idx`: `CREATE INDEX calendar_due_idx ON cmp.calendar_items USING btree (due_on, status)`
- Index `calendar_items_pkey`: `CREATE UNIQUE INDEX calendar_items_pkey ON cmp.calendar_items USING btree (id)`
- Index `calendar_period_unique`: `CREATE UNIQUE INDEX calendar_period_unique ON cmp.calendar_items USING btree (company_id, obligation_code, period_label)`
- Trigger `calendar_items_updated_at` → `core.set_updated_at` (enabled flag `O`).

## cmp.filing_evidence

Links compliance filings to the evidence of submission.

cmp.filing_evidence — append-only proof that a filing actually happened.

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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `filing_evidence_pkey`: `PRIMARY KEY (id)`

### calendar_item_id

**In everyday language:** Identifies calendar item connected to this record.

**Why it is kept:** Keeps this record connected to the correct calendar item, so related details can be checked together.

**Example:** This record points to an existing entry in calendar items instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s calendar item id to FOREIGN KEY (calendar_item_id) REFERENCES cmp.calendar_items(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `calendar_item_id: number;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `filing_evidence_calendar_item_id_fkey`: `FOREIGN KEY (calendar_item_id) REFERENCES cmp.calendar_items(id)`

### reference

**In everyday language:** External filing acknowledgement/reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: External filing acknowledgement/reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reference: string;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `evidence_reference_present`: `CHECK ((length(btrim(reference)) >= 2))`

### document_path

**In everyday language:** Optional evidence-object reference; not validated document ownership by link to another record.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A bill can be linked to a privately stored receipt so the authorized reviewer can inspect its evidence.

Technical definition: Optional evidence-object reference; not validated document ownership by FK

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `document_path: string \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### remark

**In everyday language:** Filing explanation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A reviewer reads the saved explanation to understand the particular case before taking the next action.

Technical definition: Filing explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `remark: string \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### filed_by_user_id

**In everyday language:** Identifies filed by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct filed by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s filed by user id to FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `filed_by_user_id: number;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `filing_evidence_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

### recorded_at

**In everyday language:** kept as history, with new entries added rather than old entries overwritten evidence receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Append-only evidence receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `recorded_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `evidence_item_idx`: `CREATE INDEX evidence_item_idx ON cmp.filing_evidence USING btree (calendar_item_id, recorded_at DESC)`
- Index `filing_evidence_pkey`: `CREATE UNIQUE INDEX filing_evidence_pkey ON cmp.filing_evidence USING btree (id)`
- Trigger `filing_evidence_immutable` → `cmp.filing_evidence_immutable` (enabled flag `O`).

## cmp.registrations

Keeps the company’s statutory registrations and licence details.

cmp.registrations — what we are registered/licensed for, and until when.

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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `registrations_pkey`: `PRIMARY KEY (id)`

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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `registrations_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### location_id

**In everyday language:** not recorded = held at entity level (a provident fund code); set = belongs to one plant.

**Why it is kept:** Keeps this record connected to the correct location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: NULL = held at entity level (a PF code); set = belongs to one plant.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.cmp.ts:29 |
| Code declaration | `location_id: number \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `registrations_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

### kind

**In everyday language:** Registration/licence class.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “pf” means Provident fund.

Technical definition: Registration/licence class

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `kind: RegistrationKind;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pf` | Provident fund | DB CHECK: registrations_kind_check |
| `esic` | Employees State Insurance | DB CHECK: registrations_kind_check |
| `pt` | Professional tax | DB CHECK: registrations_kind_check |
| `lwf` | Labour welfare fund | DB CHECK: registrations_kind_check |
| `factory_licence` | Factory licence classification for kind. | DB CHECK: registrations_kind_check |
| `clra_licence` | Contract Labour Regulation and Abolition licence | DB CHECK: registrations_kind_check |
| `shops` | Shops classification for kind. | DB CHECK: registrations_kind_check |
| `single_registration` | Single registration classification for kind. | DB CHECK: registrations_kind_check |
| `other` | Other classification for kind. | DB CHECK: registrations_kind_check |

Database rules (including conditions shared with other fields):

- `registrations_kind_check`: `CHECK ((kind = ANY (ARRAY['pf'::text, 'esic'::text, 'pt'::text, 'lwf'::text, 'factory_licence'::text, 'clra_licence'::text, 'shops'::text, 'single_registration'::text, 'other'::text])))`

### registration_no

**In everyday language:** Establishment registration identifier.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Establishment registration identifier

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `registration_no: string;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `registrations_number_present`: `CHECK ((length(btrim(registration_no)) > 0))`

### issuing_authority

**In everyday language:** Source authority label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the issuing authority shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Source authority label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `issuing_authority: string \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### valid_from

**In everyday language:** Registration validity beginning.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Registration validity beginning

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `valid_from: DateOnly;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `registrations_validity_ordered`: `CHECK (((valid_to IS NULL) OR (valid_to > valid_from)))`

### valid_to

**In everyday language:** not recorded = perpetual. Never measure a perpetual registration against a threshold.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: NULL = perpetual. Never measure a perpetual registration against a threshold.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.cmp.ts:35 |
| Code declaration | `valid_to: DateOnly \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `registrations_validity_ordered`: `CHECK (((valid_to IS NULL) OR (valid_to > valid_from)))`

### renewal_owner_user_id

**In everyday language:** Identifies renewal owner user connected to this record.

**Why it is kept:** Keeps this record connected to the correct renewal owner user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s renewal owner user id to FOREIGN KEY (renewal_owner_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `renewal_owner_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `registrations_renewal_owner_user_id_fkey`: `FOREIGN KEY (renewal_owner_user_id) REFERENCES core.users(id)`

### document_path

**In everyday language:** Licence document reference; storage integrity/ownership not proven by this text.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A bill can be linked to a privately stored receipt so the authorized reviewer can inspect its evidence.

Technical definition: Licence document reference; storage integrity/ownership not proven by this text

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `document_path: string \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notes

**In everyday language:** Renewal/operator context.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Renewal/operator context

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `notes: string \| null;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_active

**In everyday language:** Retired-versus-current registration flag.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Retired-versus-current registration flag

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
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
| Code source | [backend/src/core/db/types.cmp.ts](../../backend/src/core/db/types.cmp.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `registrations_expiry_idx`: `CREATE INDEX registrations_expiry_idx ON cmp.registrations USING btree (valid_to) WHERE (is_active AND (valid_to IS NOT NULL))`
- Index `registrations_pkey`: `CREATE UNIQUE INDEX registrations_pkey ON cmp.registrations USING btree (id)`
- Index `registrations_unique_live`: `CREATE UNIQUE INDEX registrations_unique_live ON cmp.registrations USING btree (company_id, COALESCE(location_id, (0)::bigint), kind, registration_no) WHERE is_active`
- Trigger `registrations_updated_at` → `core.set_updated_at` (enabled flag `O`).

