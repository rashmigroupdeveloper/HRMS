# hd — field dictionary

36 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## hd.categories

Defines helpdesk categories and their handling rules.

HD-01 routing + SLA as runtime data; includes the HRMS-platform channel (docs/07 §4b)

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

- `categories_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Stable helpdesk routing category.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable helpdesk routing category

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

- `categories_code_key`: `UNIQUE (code)`

### name

**In everyday language:** Category display label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Category display label

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

### assignee_role_code

**In everyday language:** Configured initial agent role name; no link to another record to role code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the assignee role code shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Configured initial agent role name; no FK to role code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `assignee_role_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sla_hours

**In everyday language:** Category response/resolution deadline baseline.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Category response/resolution deadline baseline

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 24 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sla_hours: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `categories_sla_hours_check`: `CHECK ((sla_hours > 0))`

### escalate_after_hours

**In everyday language:** Interval between subsequent escalation attempts.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Interval between subsequent escalation attempts

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `escalate_after_hours: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `categories_escalate_after_hours_check`: `CHECK (((escalate_after_hours IS NULL) OR (escalate_after_hours > 0)))`

### is_active

**In everyday language:** Category available for new tickets.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Category available for new tickets

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

### escalate_to_role_code

**In everyday language:** Configured higher escalation role; no link to another record to role code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the escalate to role code shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Configured higher escalation role; no FK to role code

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | 'hr_head'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `escalate_to_role_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `categories_code_key`: `CREATE UNIQUE INDEX categories_code_key ON hd.categories USING btree (code)`
- Index `categories_pkey`: `CREATE UNIQUE INDEX categories_pkey ON hd.categories USING btree (id)`

## hd.ticket_messages

Keeps the conversation and attachments within a helpdesk request.

SOW-9.4 append-only query log

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

- `ticket_messages_pkey`: `PRIMARY KEY (id)`

### ticket_id

**In everyday language:** Identifies ticket connected to this record.

**Why it is kept:** Keeps this record connected to the correct ticket, so related details can be checked together.

**Example:** This record points to an existing entry in tickets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s ticket id to FOREIGN KEY (ticket_id) REFERENCES hd.tickets(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `ticket_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ticket_messages_ticket_id_fkey`: `FOREIGN KEY (ticket_id) REFERENCES hd.tickets(id)`

### author_user_id

**In everyday language:** Identifies author user connected to this record.

**Why it is kept:** Keeps this record connected to the correct author user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s author user id to FOREIGN KEY (author_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `author_user_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ticket_messages_author_user_id_fkey`: `FOREIGN KEY (author_user_id) REFERENCES core.users(id)`

### body

**In everyday language:** protected against later changes reply/internal note content.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Immutable reply/internal note content

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `body: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_internal

**In everyday language:** Agent-only note choice that tells the system which kind this is; requester must not read internal notes.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Agent-only note discriminator; requester must not read internal notes

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_internal: Generated<boolean>;` |
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

Table indexes and lifecycle triggers:

- Index `ticket_messages_pkey`: `CREATE UNIQUE INDEX ticket_messages_pkey ON hd.ticket_messages USING btree (id)`
- Index `ticket_messages_thread_idx`: `CREATE INDEX ticket_messages_thread_idx ON hd.ticket_messages USING btree (ticket_id, created_at)`
- Trigger `ticket_messages_append_only` → `hd.reject_message_mutation` (enabled flag `O`).

## hd.tickets

Tracks employee helpdesk requests from opening to closure.

HD-01 tickets; sla_due_at NOT NULL so every ticket has a clock

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

- `tickets_pkey`: `PRIMARY KEY (id)`

### ticket_no

**In everyday language:** Human sequence-generated reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Human sequence-generated reference

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `ticket_no: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_ticket_no_key`: `UNIQUE (ticket_no)`

### raised_by

**In everyday language:** Identifies raised by connected to this record.

**Why it is kept:** Keeps this record connected to the correct raised by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s raised by to FOREIGN KEY (raised_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `raised_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_raised_by_fkey`: `FOREIGN KEY (raised_by) REFERENCES core.users(id)`

### category_id

**In everyday language:** Identifies category connected to this record.

**Why it is kept:** Keeps this record connected to the correct category, so related details can be checked together.

**Example:** This record points to an existing entry in categories instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s category id to FOREIGN KEY (category_id) REFERENCES hd.categories(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `category_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_category_id_fkey`: `FOREIGN KEY (category_id) REFERENCES hd.categories(id)`

### subject

**In everyday language:** Ticket summary.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the subject shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Ticket summary

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `subject: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### body

**In everyday language:** Original issue description.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Original issue description

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `body: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### assignee_user_id

**In everyday language:** Identifies assignee user connected to this record.

**Why it is kept:** Keeps this record connected to the correct assignee user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s assignee user id to FOREIGN KEY (assignee_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `assignee_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_assignee_user_id_fkey`: `FOREIGN KEY (assignee_user_id) REFERENCES core.users(id)`

### status

**In everyday language:** Open/pending/resolved/closed state.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “open” means Record is open in this progress from creation to closure.

Technical definition: Open/pending/resolved/closed state

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'open'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<TicketStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `open` | Record is open in this lifecycle. | DB CHECK: tickets_status_check |
| `pending` | Awaiting the required decision or next action | DB CHECK: tickets_status_check |
| `resolved` | Record is resolved in this lifecycle. | DB CHECK: tickets_status_check |
| `closed` | Record is closed in this lifecycle. | DB CHECK: tickets_status_check |

Database rules (including conditions shared with other fields):

- `tickets_resolution_complete`: `CHECK (((status <> ALL (ARRAY['resolved'::text, 'closed'::text])) OR ((resolved_at IS NOT NULL) AND (resolution IS NOT NULL))))`
- `tickets_status_check`: `CHECK ((status = ANY (ARRAY['open'::text, 'pending'::text, 'resolved'::text, 'closed'::text])))`

### priority

**In everyday language:** Urgency classification currently feeding hardcoded target time for completing the action multipliers.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “low” means Low.

Technical definition: Urgency classification currently feeding hardcoded SLA multipliers

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'normal'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `priority: Generated<TicketPriority>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `low` | Low. | DB CHECK: tickets_priority_check |
| `normal` | Normal. | DB CHECK: tickets_priority_check |
| `high` | High. | DB CHECK: tickets_priority_check |
| `urgent` | Urgent. | DB CHECK: tickets_priority_check |

Database rules (including conditions shared with other fields):

- `tickets_priority_check`: `CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])))`

### sla_due_at

**In everyday language:** Persisted deadline from category/priority policy.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Persisted deadline from category/priority policy

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sla_due_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### escalated_level

**In everyday language:** Escalation progression marker, not permission authority.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Escalation progression marker, not permission authority

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `escalated_level: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_escalated_level_check`: `CHECK ((escalated_level >= 0))`

### escalated_at

**In everyday language:** Last escalation attempt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Last escalation attempt instant

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

### acknowledged_at

**In everyday language:** Ticket acknowledgement enqueue instant; not proof of SMTP delivery.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Ticket acknowledgement enqueue instant; not proof of SMTP delivery

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `acknowledged_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### resolved_at

**In everyday language:** Resolution/closure instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Resolution/closure instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `resolved_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_resolution_complete`: `CHECK (((status <> ALL (ARRAY['resolved'::text, 'closed'::text])) OR ((resolved_at IS NOT NULL) AND (resolution IS NOT NULL))))`

### resolution

**In everyday language:** Required resolution explanation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A reviewer reads the saved explanation to understand the particular case before taking the next action.

Technical definition: Required resolution explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `resolution: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_resolution_complete`: `CHECK (((status <> ALL (ARRAY['resolved'::text, 'closed'::text])) OR ((resolved_at IS NOT NULL) AND (resolution IS NOT NULL))))`

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

### first_response_at

**In everyday language:** First agent response instant for target time for completing the action reporting.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: First agent response instant for SLA reporting

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `first_response_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### reopen_count

**In everyday language:** Count of recorded reopen transitions; event/audit must agree.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Count of recorded reopen transitions; event/audit must agree

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reopen_count: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### escalated_to_user_id

**In everyday language:** Identifies escalated to user connected to this record.

**Why it is kept:** Keeps this record connected to the correct escalated to user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s escalated to user id to FOREIGN KEY (escalated_to_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `escalated_to_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tickets_escalated_to_user_id_fkey`: `FOREIGN KEY (escalated_to_user_id) REFERENCES core.users(id)`

Table indexes and lifecycle triggers:

- Index `tickets_assignee_idx`: `CREATE INDEX tickets_assignee_idx ON hd.tickets USING btree (assignee_user_id) WHERE (status = ANY (ARRAY['open'::text, 'pending'::text]))`
- Index `tickets_escalated_to_idx`: `CREATE INDEX tickets_escalated_to_idx ON hd.tickets USING btree (escalated_to_user_id) WHERE (escalated_to_user_id IS NOT NULL)`
- Index `tickets_first_response_idx`: `CREATE INDEX tickets_first_response_idx ON hd.tickets USING btree (first_response_at) WHERE (first_response_at IS NOT NULL)`
- Index `tickets_pkey`: `CREATE UNIQUE INDEX tickets_pkey ON hd.tickets USING btree (id)`
- Index `tickets_queue_idx`: `CREATE INDEX tickets_queue_idx ON hd.tickets USING btree (status, sla_due_at)`
- Index `tickets_raiser_idx`: `CREATE INDEX tickets_raiser_idx ON hd.tickets USING btree (raised_by, created_at DESC)`
- Index `tickets_ticket_no_key`: `CREATE UNIQUE INDEX tickets_ticket_no_key ON hd.tickets USING btree (ticket_no)`

