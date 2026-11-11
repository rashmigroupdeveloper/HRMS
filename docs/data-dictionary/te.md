# te — field dictionary

126 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## te.advances

Tracks money requested or provided before business travel.

Advances records; consult the field definitions and governing module specification.

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

- `advances_pkey`: `PRIMARY KEY (id)`

### trip_id

**In everyday language:** Identifies trip connected to this record.

**Why it is kept:** Keeps this record connected to the correct trip, so related details can be checked together.

**Example:** This record points to an existing entry in trips instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s trip id to FOREIGN KEY (trip_id) REFERENCES te.trips(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `trip_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `advances_trip_id_fkey`: `FOREIGN KEY (trip_id) REFERENCES te.trips(id)`

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

- `advances_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### amount_paise

**In everyday language:** Monetary amount stored as whole numbers of paise (100 paise = one Indian rupee).

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Monetary amount stored as integer paise (100 paise = one Indian rupee).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `advances_amount_paise_check`: `CHECK ((amount_paise > 0))`

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

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Current progress from creation to closure state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “requested” means Record is requested in this progress from creation to closure.

Technical definition: Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'requested'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `status: ColumnType<'requested' \| 'approved' \| 'rejected' \| 'sent_back' \| 'disbursed' \| 'cancelled', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `requested` | Record is requested in this lifecycle. | DB CHECK: advances_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: advances_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: advances_status_check |
| `sent_back` | Returned to requester for correction and resubmission | DB CHECK: advances_status_check |
| `disbursed` | Record is disbursed in this lifecycle. | DB CHECK: advances_status_check |
| `cancelled` | Request cancelled | DB CHECK: advances_status_check |

Database rules (including conditions shared with other fields):

- `advances_status_check`: `CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'sent_back'::text, 'disbursed'::text, 'cancelled'::text])))`

### workflow_request_id

**In everyday language:** Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database link to another record is present.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

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

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### disbursed_at

**In everyday language:** Date and time of disbursed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of disbursed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `disbursed_at: Timestamp \| null;` |
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

- Index `advances_pkey`: `CREATE UNIQUE INDEX advances_pkey ON te.advances USING btree (id)`
- Index `idx_te_advances_employee`: `CREATE INDEX idx_te_advances_employee ON te.advances USING btree (employee_id)`
- Index `idx_te_advances_trip`: `CREATE INDEX idx_te_advances_trip ON te.advances USING btree (trip_id)`

## te.budget_reservations

Tracks amounts reserved against or released back to travel budgets.

Budget reservations records; consult the field definitions and governing module specification.

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

- `budget_reservations_pkey`: `PRIMARY KEY (id)`

### trip_id

**In everyday language:** Identifies trip connected to this record.

**Why it is kept:** Keeps this record connected to the correct trip, so related details can be checked together.

**Example:** This record points to an existing entry in trips instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s trip id to FOREIGN KEY (trip_id) REFERENCES te.trips(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `trip_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_reservations_trip_id_fkey`: `FOREIGN KEY (trip_id) REFERENCES te.trips(id)`

### claim_id

**In everyday language:** Identifies the expense claim connected to this record.

**Why it is kept:** Keeps this record connected to the correct expense claim, so related details can be checked together.

**Example:** This record points to an existing entry in claims instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES te.claims(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_reservations_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES te.claims(id)`

### movement

**In everyday language:** history of additions and deductions movement classification controlling reservation or release; permitted codes are listed in the database rules.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “reserve” means Reserve classification for movement.

Technical definition: Ledger movement classification controlling reservation or release; permitted codes are listed in the database rules.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `movement: 'reserve' \| 'release';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `reserve` | Reserve classification for movement. | DB CHECK: budget_reservations_movement_check |
| `release` | Release classification for movement. | DB CHECK: budget_reservations_movement_check |

Database rules (including conditions shared with other fields):

- `budget_reservations_movement_check`: `CHECK ((movement = ANY (ARRAY['reserve'::text, 'release'::text])))`

### amount_paise

**In everyday language:** Monetary amount stored as whole numbers of paise (100 paise = one Indian rupee).

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Monetary amount stored as integer paise (100 paise = one Indian rupee).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_reservations_amount_paise_check`: `CHECK ((amount_paise > 0))`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

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

- `budget_reservations_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

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

- Index `budget_reservations_pkey`: `CREATE UNIQUE INDEX budget_reservations_pkey ON te.budget_reservations USING btree (id)`
- Index `idx_te_budget_reservations_claim`: `CREATE INDEX idx_te_budget_reservations_claim ON te.budget_reservations USING btree (claim_id)`
- Index `idx_te_budget_reservations_trip`: `CREATE INDEX idx_te_budget_reservations_trip ON te.budget_reservations USING btree (trip_id)`
- Trigger `trg_no_update_delete_budget_reservations` → `te.reject_budget_reservation_mutation` (enabled flag `O`).

## te.budgets

Defines travel entitlement limits by grade and travel category.

Budgets records; consult the field definitions and governing module specification.

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

- `budgets_pkey`: `PRIMARY KEY (id)`

### grade_level

**In everyday language:** Employee grade selector used for travel entitlement limits.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the grade level shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Employee grade selector used for travel entitlement limits.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `grade_level: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `uq_te_budget_grade_type`: `UNIQUE (grade_level, travel_type)`

### travel_type

**In everyday language:** Domestic or international travel classification used for entitlement and routing.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “domestic” means Domestic classification for travel type.

Technical definition: Domestic or international travel classification used for entitlement and routing.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `travel_type: 'domestic' \| 'international';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `domestic` | Domestic classification for travel type. | DB CHECK: budgets_travel_type_check |
| `international` | International classification for travel type. | DB CHECK: budgets_travel_type_check |

Database rules (including conditions shared with other fields):

- `budgets_travel_type_check`: `CHECK ((travel_type = ANY (ARRAY['domestic'::text, 'international'::text])))`
- `uq_te_budget_grade_type`: `UNIQUE (grade_level, travel_type)`

### flight_class

**In everyday language:** Permitted flight cabin class under the travel entitlement rule.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the flight class.

Technical definition: Permitted flight cabin class under the travel entitlement rule.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'economy'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `flight_class: ColumnType<string, string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### hotel_per_night_paise

**In everyday language:** Hotel allowance/budget per night in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Hotel allowance/budget per night in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 400000 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `hotel_per_night_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### daily_allowance_paise

**In everyday language:** Daily allowance entitlement in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Daily allowance entitlement in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 150000 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `daily_allowance_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### local_conveyance_paise

**In everyday language:** Local conveyance entitlement in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Local conveyance entitlement in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 100000 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `local_conveyance_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

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
| Code declaration | `is_active: ColumnType<boolean, boolean \| undefined, boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `budgets_pkey`: `CREATE UNIQUE INDEX budgets_pkey ON te.budgets USING btree (id)`
- Index `uq_te_budget_grade_type`: `CREATE UNIQUE INDEX uq_te_budget_grade_type ON te.budgets USING btree (grade_level, travel_type)`

## te.claim_items

Keeps individual expenses submitted in a travel claim.

Claim items records; consult the field definitions and governing module specification.

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

- `claim_items_pkey`: `PRIMARY KEY (id)`

### claim_id

**In everyday language:** Identifies the expense claim connected to this record.

**Why it is kept:** Keeps this record connected to the correct expense claim, so related details can be checked together.

**Example:** This record points to an existing entry in claims instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES te.claims(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_items_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES te.claims(id) ON DELETE CASCADE`

### category

**In everyday language:** Business classification used by this record/report; its allowed values are table-specific.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “flight” means Flight classification for category.

Technical definition: Business classification used by this record/report; its allowed values are table-specific.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `category: 'flight' \| 'train' \| 'bus' \| 'hotel' \| 'daily_allowance' \| 'local_travel' \| 'visa' \| 'food' \| 'misc';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `flight` | Flight classification for category. | DB CHECK: claim_items_category_check |
| `train` | Train classification for category. | DB CHECK: claim_items_category_check |
| `bus` | Bus classification for category. | DB CHECK: claim_items_category_check |
| `hotel` | Hotel classification for category. | DB CHECK: claim_items_category_check |
| `daily_allowance` | Daily allowance classification for category. | DB CHECK: claim_items_category_check |
| `local_travel` | Local travel classification for category. | DB CHECK: claim_items_category_check |
| `visa` | Visa classification for category. | DB CHECK: claim_items_category_check |
| `food` | Food classification for category. | DB CHECK: claim_items_category_check |
| `misc` | Misc classification for category. | DB CHECK: claim_items_category_check |

Database rules (including conditions shared with other fields):

- `claim_items_category_check`: `CHECK ((category = ANY (ARRAY['flight'::text, 'train'::text, 'bus'::text, 'hotel'::text, 'daily_allowance'::text, 'local_travel'::text, 'visa'::text, 'food'::text, 'misc'::text])))`

### item_date

**In everyday language:** Calendar date on which the travel expense was incurred.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date on which the travel expense was incurred.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `item_date: ColumnType<Date, Date \| string, Date \| string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### amount_paise

**In everyday language:** Monetary amount stored as whole numbers of paise (100 paise = one Indian rupee).

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Monetary amount stored as integer paise (100 paise = one Indian rupee).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### currency

**In everyday language:** Currency code in which the associated original amount is expressed.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** INR denotes Indian rupees. Other currencies require their own configured treatment.

Technical definition: Currency code in which the associated original amount is expressed.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'INR'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `currency: ColumnType<string, string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### fx_rate_to_inr

**In everyday language:** Conversion multiplier from one unit of the original currency to Indian rupees; monetary conversion uses exact decimal arithmetic.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Illustration only: at ₹80 per currency unit, 10 units convert to ₹800 before any applicable rounding.

Technical definition: Conversion multiplier from one unit of the original currency to Indian rupees; monetary conversion uses exact decimal arithmetic.

| Property | Definition |
|---|---|
| SQL type | `numeric(10,4)` |
| Required | Yes |
| Default | 1.0000 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fx_rate_to_inr: ColumnType<string \| number, string \| number \| undefined, string \| number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### inr_amount_paise

**In everyday language:** Converted Indian-rupee value of the expense, stored in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Converted Indian-rupee value of the expense, stored in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `inr_amount_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### receipt_document_id

**In everyday language:** Document-register identity of the supporting receipt; inspect constraints for link to another record enforcement.

**Why it is kept:** Keeps this record connected to the correct receipt document, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Document-registry identity of the supporting receipt; inspect constraints for FK enforcement.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `receipt_document_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### receipt_url

**In everyday language:** Stored receipt reference; presence does not establish that access is public or that bytes are archived.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A claim can refer to a supporting receipt; the existence of a reference does not make the receipt public.

Technical definition: Stored receipt reference; presence does not establish that access is public or that bytes are archived.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `receipt_url: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### description

**In everyday language:** Human-readable description of this record.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Human-readable description of this record.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `description: string \| null;` |
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

Table indexes and lifecycle triggers:

- Index `claim_items_pkey`: `CREATE UNIQUE INDEX claim_items_pkey ON te.claim_items USING btree (id)`
- Index `idx_te_claim_items_claim`: `CREATE INDEX idx_te_claim_items_claim ON te.claim_items USING btree (claim_id)`

## te.claims

Tracks travel reimbursement claims and adjustment of advances.

Claims records; consult the field definitions and governing module specification.

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

- `claims_pkey`: `PRIMARY KEY (id)`

### reference_no

**In everyday language:** Human-readable travel request/claim reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Human-readable travel request/claim reference.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `reference_no: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_reference_no_key`: `UNIQUE (reference_no)`

### trip_id

**In everyday language:** Identifies trip connected to this record.

**Why it is kept:** Keeps this record connected to the correct trip, so related details can be checked together.

**Example:** This record points to an existing entry in trips instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s trip id to FOREIGN KEY (trip_id) REFERENCES te.trips(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `trip_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_trip_id_fkey`: `FOREIGN KEY (trip_id) REFERENCES te.trips(id)`

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

- `claims_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### total_claimed_paise

**In everyday language:** Aggregate claimed travel expense in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Aggregate claimed travel expense in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `total_claimed_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### approved_amount_paise

**In everyday language:** Approved travel expense amount in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Approved travel expense amount in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `approved_amount_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### advance_adjusted_paise

**In everyday language:** Travel advance amount offset against this claim in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Travel advance amount offset against this claim in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `advance_adjusted_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### net_payable_paise

**In everyday language:** Net amount payable to the employee in whole numbers of paise after advance adjustment.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Net amount payable to the employee in integer paise after advance adjustment.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `net_payable_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### net_recoverable_paise

**In everyday language:** Net amount recoverable from the employee in whole numbers of paise after settlement.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Net amount recoverable from the employee in integer paise after settlement.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `net_recoverable_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Current progress from creation to closure state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “draft” means Editable draft before submission/preparation.

Technical definition: Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'draft'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `status: ColumnType<'draft' \| 'submitted' \| 'approved' \| 'rejected' \| 'sent_back' \| 'settled', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: claims_status_check |
| `submitted` | Record is submitted in this lifecycle. | DB CHECK: claims_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: claims_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: claims_status_check |
| `sent_back` | Returned to requester for correction and resubmission | DB CHECK: claims_status_check |
| `settled` | Record is settled in this lifecycle. | DB CHECK: claims_status_check |

Database rules (including conditions shared with other fields):

- `claims_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'sent_back'::text, 'settled'::text])))`

### settlement_status

**In everyday language:** State of financial settlement, separate from approval status.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “unsettled” means Record is unsettled in this progress from creation to closure.

Technical definition: State of financial settlement, separate from approval status.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'unsettled'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `settlement_status: ColumnType<'unsettled' \| 'settled', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `unsettled` | Record is unsettled in this lifecycle. | DB CHECK: claims_settlement_status_check |
| `settled` | Record is settled in this lifecycle. | DB CHECK: claims_settlement_status_check |

Database rules (including conditions shared with other fields):

- `claims_settlement_status_check`: `CHECK ((settlement_status = ANY (ARRAY['unsettled'::text, 'settled'::text])))`

### workflow_request_id

**In everyday language:** Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database link to another record is present.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

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

### summary_document_id

**In everyday language:** Identifies summary document connected to this record.

**Why it is kept:** Keeps this record connected to the correct summary document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s summary document id to FOREIGN KEY (summary_document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `summary_document_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_summary_document_id_fkey`: `FOREIGN KEY (summary_document_id) REFERENCES core.documents(id)`

### summary_document_url

**In everyday language:** Reference to the generated claim summary document.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Reference to the generated claim summary document.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `summary_document_url: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### period_from

**In everyday language:** First calendar date of the covered period.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First calendar date of the covered period.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `period_from: ColumnType<Date \| null, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### period_to

**In everyday language:** Last calendar date of the covered period; see constraints and service for boundary validation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Last calendar date of the covered period; see constraints and service for boundary validation.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `period_to: ColumnType<Date \| null, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `claims_pkey`: `CREATE UNIQUE INDEX claims_pkey ON te.claims USING btree (id)`
- Index `claims_reference_no_key`: `CREATE UNIQUE INDEX claims_reference_no_key ON te.claims USING btree (reference_no)`
- Index `idx_te_claims_employee`: `CREATE INDEX idx_te_claims_employee ON te.claims USING btree (employee_id)`
- Index `idx_te_claims_trip`: `CREATE INDEX idx_te_claims_trip ON te.claims USING btree (trip_id)`

## te.settlements

Records the final travel amount payable to or recoverable from an employee.

Settlements records; consult the field definitions and governing module specification.

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

- `settlements_pkey`: `PRIMARY KEY (id)`

### claim_id

**In everyday language:** Identifies the expense claim connected to this record.

**Why it is kept:** Keeps this record connected to the correct expense claim, so related details can be checked together.

**Example:** This record points to an existing entry in claims instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES te.claims(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `settlements_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES te.claims(id)`

### trip_id

**In everyday language:** Identifies trip connected to this record.

**Why it is kept:** Keeps this record connected to the correct trip, so related details can be checked together.

**Example:** This record points to an existing entry in trips instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s trip id to FOREIGN KEY (trip_id) REFERENCES te.trips(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `trip_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `settlements_trip_id_fkey`: `FOREIGN KEY (trip_id) REFERENCES te.trips(id)`

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

- `settlements_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### settlement_mode

**In everyday language:** Configured payment or recovery method for settling the claim.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “AUTO” means Auto.

Technical definition: Configured payment or recovery method for settling the claim.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'AUTO'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `settlement_mode: ColumnType<'AUTO' \| 'MANUAL', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `AUTO` | Auto. | DB CHECK: settlements_settlement_mode_check |
| `MANUAL` | Manual. | DB CHECK: settlements_settlement_mode_check |

Database rules (including conditions shared with other fields):

- `settlements_settlement_mode_check`: `CHECK ((settlement_mode = ANY (ARRAY['AUTO'::text, 'MANUAL'::text])))`

### claimed_amount_paise

**In everyday language:** Expense amount used in settlement, in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Expense amount used in settlement, in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `claimed_amount_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### advance_amount_paise

**In everyday language:** Advance amount used in settlement, in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Advance amount used in settlement, in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `advance_amount_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### net_payable_paise

**In everyday language:** Net amount payable to the employee in whole numbers of paise after advance adjustment.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Net amount payable to the employee in integer paise after advance adjustment.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `net_payable_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### net_recoverable_paise

**In everyday language:** Net amount recoverable from the employee in whole numbers of paise after settlement.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Net amount recoverable from the employee in integer paise after settlement.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `net_recoverable_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### recovery_channel

**In everyday language:** Configured channel through which excess advance is to be recovered.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “payroll_deduction” means Recover through authorized payroll deduction.

Technical definition: Configured channel through which excess advance is to be recovered.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | 'payroll_deduction'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `recovery_channel: ColumnType<'payroll_deduction' \| 'wallet_carry_forward' \| 'direct_refund', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `payroll_deduction` | Recover through authorized payroll deduction | DB CHECK: settlements_recovery_channel_check |
| `wallet_carry_forward` | Retain settlement balance in travel wallet | DB CHECK: settlements_recovery_channel_check |
| `direct_refund` | Employee refunds excess advance directly | DB CHECK: settlements_recovery_channel_check |

Database rules (including conditions shared with other fields):

- `settlements_recovery_channel_check`: `CHECK ((recovery_channel = ANY (ARRAY['payroll_deduction'::text, 'wallet_carry_forward'::text, 'direct_refund'::text])))`

### settled_by

**In everyday language:** Identifies settled by connected to this record.

**Why it is kept:** Keeps this record connected to the correct settled by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s settled by to FOREIGN KEY (settled_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `settled_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `settlements_settled_by_fkey`: `FOREIGN KEY (settled_by) REFERENCES core.users(id)`

### settled_at

**In everyday language:** Date and time of settled for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of settled for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | timestamp field convention |
| Code declaration | `settled_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** Current progress from creation to closure state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'settled'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `status: ColumnType<'pending' \| 'settled' \| 'payroll_posted', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: settlements_status_check |
| `settled` | Record is settled in this lifecycle. | DB CHECK: settlements_status_check |
| `payroll_posted` | Posted into the payroll process | DB CHECK: settlements_status_check |

Database rules (including conditions shared with other fields):

- `settlements_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'settled'::text, 'payroll_posted'::text])))`

Table indexes and lifecycle triggers:

- Index `idx_te_settlements_claim`: `CREATE INDEX idx_te_settlements_claim ON te.settlements USING btree (claim_id)`
- Index `idx_te_settlements_employee`: `CREATE INDEX idx_te_settlements_employee ON te.settlements USING btree (employee_id)`
- Index `settlements_pkey`: `CREATE UNIQUE INDEX settlements_pkey ON te.settlements USING btree (id)`

## te.trip_itineraries

Keeps travel segments, bookings and accommodation arrangements.

Trip itineraries records; consult the field definitions and governing module specification.

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

- `trip_itineraries_pkey`: `PRIMARY KEY (id)`

### trip_id

**In everyday language:** Identifies trip connected to this record.

**Why it is kept:** Keeps this record connected to the correct trip, so related details can be checked together.

**Example:** This record points to an existing entry in trips instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s trip id to FOREIGN KEY (trip_id) REFERENCES te.trips(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `trip_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `trip_itineraries_trip_id_fkey`: `FOREIGN KEY (trip_id) REFERENCES te.trips(id) ON DELETE CASCADE`

### segment_type

**In everyday language:** Transport/accommodation category of the itinerary segment.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “flight” means Flight.

Technical definition: Transport/accommodation category of the itinerary segment.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `segment_type: 'flight' \| 'train' \| 'bus' \| 'hotel' \| 'car' \| 'other';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `flight` | Flight. | DB CHECK: trip_itineraries_segment_type_check |
| `train` | Train. | DB CHECK: trip_itineraries_segment_type_check |
| `bus` | Bus. | DB CHECK: trip_itineraries_segment_type_check |
| `hotel` | Hotel. | DB CHECK: trip_itineraries_segment_type_check |
| `car` | Car. | DB CHECK: trip_itineraries_segment_type_check |
| `other` | Other. | DB CHECK: trip_itineraries_segment_type_check |

Database rules (including conditions shared with other fields):

- `trip_itineraries_segment_type_check`: `CHECK ((segment_type = ANY (ARRAY['flight'::text, 'train'::text, 'bus'::text, 'hotel'::text, 'car'::text, 'other'::text])))`

### origin

**In everyday language:** Departure location for this itinerary segment.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Kolkata could be the departure city of an illustrative travel segment.

Technical definition: Departure location for this itinerary segment.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `origin: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### destination

**In everyday language:** Arrival location for this itinerary segment.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Delhi could be the destination city of an illustrative travel segment.

Technical definition: Arrival location for this itinerary segment.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `destination: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### departure_date

**In everyday language:** Planned departure date of the itinerary segment.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A time such as 9 AM describes the timing of this particular activity; whether a calendar date is also stored depends on the field.

Technical definition: Planned departure date of the itinerary segment.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `departure_date: ColumnType<Date, Date \| string, Date \| string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### arrival_date

**In everyday language:** Planned arrival date of the itinerary segment.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A time such as 9 AM describes the timing of this particular activity; whether a calendar date is also stored depends on the field.

Technical definition: Planned arrival date of the itinerary segment.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `arrival_date: ColumnType<Date, Date \| string \| null \| undefined, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### provider

**In everyday language:** Airline, hotel or other service provider for the itinerary segment.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This could identify an airline for a flight segment or a hotel for accommodation.

Technical definition: Airline, hotel or other service provider for the itinerary segment.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `provider: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### booking_reference

**In everyday language:** Supplier's reservation or booking confirmation reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A reservation reference connects an itinerary segment to the provider’s booking.

Technical definition: Supplier's reservation or booking confirmation reference.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `booking_reference: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### estimated_cost_paise

**In everyday language:** Estimated itinerary cost in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Estimated itinerary cost in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `estimated_cost_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### actual_cost_paise

**In everyday language:** Actual itinerary cost in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Actual itinerary cost in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `actual_cost_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

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

Table indexes and lifecycle triggers:

- Index `idx_te_itineraries_trip`: `CREATE INDEX idx_te_itineraries_trip ON te.trip_itineraries USING btree (trip_id)`
- Index `trip_itineraries_pkey`: `CREATE UNIQUE INDEX trip_itineraries_pkey ON te.trip_itineraries USING btree (id)`

## te.trips

Tracks business-trip requests, plans, budgets and approvals.

Trips records; consult the field definitions and governing module specification.

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

- `trips_pkey`: `PRIMARY KEY (id)`

### reference_no

**In everyday language:** Human-readable travel request/claim reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Human-readable travel request/claim reference.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `reference_no: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `trips_reference_no_key`: `UNIQUE (reference_no)`

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

- `trips_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

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

- `trips_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### trip_name

**In everyday language:** Human-readable title of the proposed trip.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the trip name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Human-readable title of the proposed trip.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `trip_name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### travel_type

**In everyday language:** Domestic or international travel classification used for entitlement and routing.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “domestic” means Domestic classification for travel type.

Technical definition: Domestic or international travel classification used for entitlement and routing.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `travel_type: 'domestic' \| 'international';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `domestic` | Domestic classification for travel type. | DB CHECK: trips_travel_type_check |
| `international` | International classification for travel type. | DB CHECK: trips_travel_type_check |

Database rules (including conditions shared with other fields):

- `trips_travel_type_check`: `CHECK ((travel_type = ANY (ARRAY['domestic'::text, 'international'::text])))`

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

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### destination_country

**In everyday language:** Destination country used for travel classification and entitlement.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the destination country shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Destination country used for travel classification and entitlement.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'India'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `destination_country: ColumnType<string, string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### destination_city

**In everyday language:** Destination city of the proposed trip.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Delhi could be the destination city of an illustrative business trip.

Technical definition: Destination city of the proposed trip.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `destination_city: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### start_date

**In everyday language:** First date of the proposed trip.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First date of the proposed trip.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `start_date: ColumnType<Date, Date \| string, Date \| string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### end_date

**In everyday language:** Last date of the proposed trip.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Last date of the proposed trip.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `end_date: ColumnType<Date, Date \| string, Date \| string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### visa_required

**In everyday language:** Whether the journey requires visa arrangements.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether the journey requires visa arrangements.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `visa_required: ColumnType<boolean, boolean \| undefined, boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### visa_status

**In everyday language:** Recorded visa-processing state for the trip.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “not_applicable” means Record is not applicable in this progress from creation to closure.

Technical definition: Recorded visa-processing state for the trip.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | 'not_applicable'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `visa_status: ColumnType<'not_applicable' \| 'applied' \| 'approved' \| 'rejected', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `not_applicable` | Record is not applicable in this lifecycle. | DB CHECK: trips_visa_status_check |
| `applied` | Record is applied in this lifecycle. | DB CHECK: trips_visa_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: trips_visa_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: trips_visa_status_check |

Database rules (including conditions shared with other fields):

- `trips_visa_status_check`: `CHECK ((visa_status = ANY (ARRAY['not_applicable'::text, 'applied'::text, 'approved'::text, 'rejected'::text])))`

### status

**In everyday language:** Current progress from creation to closure state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “draft” means Editable draft before submission/preparation.

Technical definition: Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'draft'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `status: ColumnType<'draft' \| 'submitted' \| 'approved' \| 'rejected' \| 'in_progress' \| 'completed' \| 'cancelled', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: trips_status_check |
| `submitted` | Record is submitted in this lifecycle. | DB CHECK: trips_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: trips_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: trips_status_check |
| `in_progress` | Record is in progress in this lifecycle. | DB CHECK: trips_status_check |
| `completed` | Record is completed in this lifecycle. | DB CHECK: trips_status_check |
| `cancelled` | Request cancelled | DB CHECK: trips_status_check |

Database rules (including conditions shared with other fields):

- `trips_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))`

### estimated_budget_paise

**In everyday language:** Proposed total trip budget in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Proposed total trip budget in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `estimated_budget_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### approved_budget_paise

**In everyday language:** Authorized total trip budget in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Authorized total trip budget in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `approved_budget_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### cancellation_reason

**In everyday language:** Recorded explanation for cancelling the trip.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Recorded explanation for cancelling the trip.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `cancellation_reason: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### cancellation_cost_paise

**In everyday language:** Cost incurred due to cancellation, in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Cost incurred due to cancellation, in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `cancellation_cost_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### workflow_request_id

**In everyday language:** Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database link to another record is present.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

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

### destination_region

**In everyday language:** Destination region used to select travel entitlement limits.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “domestic” means Domestic.

Technical definition: Destination region used to select travel entitlement limits.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'domestic'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `destination_region: ColumnType<'domestic' \| 'sea' \| 'africa' \| 'middle_east' \| 'europe' \| 'americas' \| 'other', string \| undefined, string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `domestic` | Domestic. | DB CHECK: trips_destination_region_check |
| `sea` | Sea. | DB CHECK: trips_destination_region_check |
| `africa` | Africa. | DB CHECK: trips_destination_region_check |
| `middle_east` | Middle east. | DB CHECK: trips_destination_region_check |
| `europe` | Europe. | DB CHECK: trips_destination_region_check |
| `americas` | Americas. | DB CHECK: trips_destination_region_check |
| `other` | Other. | DB CHECK: trips_destination_region_check |

Database rules (including conditions shared with other fields):

- `trips_destination_region_check`: `CHECK ((destination_region = ANY (ARRAY['domestic'::text, 'sea'::text, 'africa'::text, 'middle_east'::text, 'europe'::text, 'americas'::text, 'other'::text])))`

### travel_month

**In everyday language:** Travel period key used for reporting and entitlement/budget allocation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the travel month.

Technical definition: Travel period key used for reporting and entitlement/budget allocation.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `travel_month: ColumnType<string \| null, string \| null \| undefined, string \| null>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `te_trips_travel_month_check`: `CHECK (((travel_month IS NULL) OR (travel_month ~ '^[0-9]{4}-[0-9]{2}$'::text)))`

### origin_city

**In everyday language:** Starting city of the proposed trip.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Kolkata could be the starting city of an illustrative business trip.

Technical definition: Starting city of the proposed trip.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `origin_city: ColumnType<string \| null, string \| null \| undefined, string \| null>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### airfare_paise

**In everyday language:** Budgeted airfare in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Budgeted airfare in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `airfare_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `te_trips_budget_lines_nonnegative`: `CHECK (((airfare_paise >= 0) AND (hotel_per_night_paise >= 0) AND (hotel_nights >= 0) AND (daily_allowance_per_day_paise >= 0) AND (visa_cost_paise >= 0)))`

### hotel_per_night_paise

**In everyday language:** Hotel allowance/budget per night in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Hotel allowance/budget per night in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `hotel_per_night_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `te_trips_budget_lines_nonnegative`: `CHECK (((airfare_paise >= 0) AND (hotel_per_night_paise >= 0) AND (hotel_nights >= 0) AND (daily_allowance_per_day_paise >= 0) AND (visa_cost_paise >= 0)))`

### hotel_nights

**In everyday language:** Number of hotel nights included in the trip estimate.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Number of hotel nights included in the trip estimate.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `hotel_nights: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `te_trips_budget_lines_nonnegative`: `CHECK (((airfare_paise >= 0) AND (hotel_per_night_paise >= 0) AND (hotel_nights >= 0) AND (daily_allowance_per_day_paise >= 0) AND (visa_cost_paise >= 0)))`

### daily_allowance_per_day_paise

**In everyday language:** Budgeted allowance per travel day in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Budgeted allowance per travel day in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `daily_allowance_per_day_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `te_trips_budget_lines_nonnegative`: `CHECK (((airfare_paise >= 0) AND (hotel_per_night_paise >= 0) AND (hotel_nights >= 0) AND (daily_allowance_per_day_paise >= 0) AND (visa_cost_paise >= 0)))`

### visa_cost_paise

**In everyday language:** Budgeted visa cost in whole numbers of paise.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Budgeted visa cost in integer paise.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `visa_cost_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `te_trips_budget_lines_nonnegative`: `CHECK (((airfare_paise >= 0) AND (hotel_per_night_paise >= 0) AND (hotel_nights >= 0) AND (daily_allowance_per_day_paise >= 0) AND (visa_cost_paise >= 0)))`

### over_limit_justification

**In everyday language:** Business justification for travel costs above the normal entitlement.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An explanation such as “required meeting location has limited accommodation” can support review; it does not itself approve an exception.

Technical definition: Business justification for travel costs above the normal entitlement.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `over_limit_justification: ColumnType<string \| null, string \| null \| undefined, string \| null>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `idx_te_trips_employee`: `CREATE INDEX idx_te_trips_employee ON te.trips USING btree (employee_id)`
- Index `idx_te_trips_status`: `CREATE INDEX idx_te_trips_status ON te.trips USING btree (status)`
- Index `trips_pkey`: `CREATE UNIQUE INDEX trips_pkey ON te.trips USING btree (id)`
- Index `trips_reference_no_key`: `CREATE UNIQUE INDEX trips_reference_no_key ON te.trips USING btree (reference_no)`

## te.wallet_transactions

Keeps individual travel-wallet movements so balances can be checked.

Wallet transactions records; consult the field definitions and governing module specification.

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

- `wallet_transactions_pkey`: `PRIMARY KEY (id)`

### wallet_id

**In everyday language:** Identifies wallet connected to this record.

**Why it is kept:** Keeps this record connected to the correct wallet, so related details can be checked together.

**Example:** This record points to an existing entry in wallets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s wallet id to FOREIGN KEY (wallet_id) REFERENCES te.wallets(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `wallet_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `wallet_transactions_wallet_id_fkey`: `FOREIGN KEY (wallet_id) REFERENCES te.wallets(id)`

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

- `wallet_transactions_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### trip_id

**In everyday language:** Identifies trip connected to this record.

**Why it is kept:** Keeps this record connected to the correct trip, so related details can be checked together.

**Example:** This record points to an existing entry in trips instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s trip id to FOREIGN KEY (trip_id) REFERENCES te.trips(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `trip_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `wallet_transactions_trip_id_fkey`: `FOREIGN KEY (trip_id) REFERENCES te.trips(id)`

### source

**In everyday language:** Origin system or process supplying this record; exact accepted values depend on the table.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “ADVANCE” means Advance classification for source.

Technical definition: Origin system or process supplying this record; exact accepted values depend on the table.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `source: 'ADVANCE' \| 'CLAIM_SETTLEMENT' \| 'RECOVERY' \| 'ADJUSTMENT';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `ADVANCE` | Advance classification for source. | DB CHECK: wallet_transactions_source_check |
| `CLAIM_SETTLEMENT` | Claim settlement classification for source. | DB CHECK: wallet_transactions_source_check |
| `RECOVERY` | Recovery classification for source. | DB CHECK: wallet_transactions_source_check |
| `ADJUSTMENT` | Adjustment classification for source. | DB CHECK: wallet_transactions_source_check |

Database rules (including conditions shared with other fields):

- `wallet_transactions_source_check`: `CHECK ((source = ANY (ARRAY['ADVANCE'::text, 'CLAIM_SETTLEMENT'::text, 'RECOVERY'::text, 'ADJUSTMENT'::text])))`

### type

**In everyday language:** Wallet movement category determining the financial meaning of this transaction.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “credit” means Credit movement; sign and amount are governed by the history of additions and deductions rules.

Technical definition: Wallet movement category determining the financial meaning of this transaction.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `type: 'credit' \| 'debit';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `credit` | Credit movement; sign and amount are governed by the ledger rules | DB CHECK: wallet_transactions_type_check |
| `debit` | Debit movement; sign and amount are governed by the ledger rules | DB CHECK: wallet_transactions_type_check |

Database rules (including conditions shared with other fields):

- `wallet_transactions_type_check`: `CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text])))`

### amount_paise

**In everyday language:** Monetary amount stored as whole numbers of paise (100 paise = one Indian rupee).

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Monetary amount stored as integer paise (100 paise = one Indian rupee).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `wallet_transactions_amount_paise_check`: `CHECK ((amount_paise > 0))`

### balance_after_paise

**In everyday language:** Stored wallet balance after this movement in whole numbers of paise; reconcile against protected against later changes transaction history.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Stored wallet balance after this movement in integer paise; reconcile against immutable transaction history.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `balance_after_paise: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `wallet_transactions_balance_after_paise_check`: `CHECK ((balance_after_paise >= 0))`

### transaction_reference

**In everyday language:** External/source transaction reference used to identify the wallet movement.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: External/source transaction reference used to identify the wallet movement.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `transaction_reference: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `wallet_transactions_transaction_reference_key`: `UNIQUE (transaction_reference)`

### notes

**In everyday language:** Free-text business context associated with this record.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Free-text business context associated with this record.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
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

Table indexes and lifecycle triggers:

- Index `idx_te_wallet_tx_employee`: `CREATE INDEX idx_te_wallet_tx_employee ON te.wallet_transactions USING btree (employee_id)`
- Index `idx_te_wallet_tx_wallet`: `CREATE INDEX idx_te_wallet_tx_wallet ON te.wallet_transactions USING btree (wallet_id)`
- Index `wallet_transactions_pkey`: `CREATE UNIQUE INDEX wallet_transactions_pkey ON te.wallet_transactions USING btree (id)`
- Index `wallet_transactions_transaction_reference_key`: `CREATE UNIQUE INDEX wallet_transactions_transaction_reference_key ON te.wallet_transactions USING btree (transaction_reference)`
- Trigger `trg_no_update_delete_wallet_transactions` → `te.reject_wallet_tx_mutation` (enabled flag `O`).

## te.wallets

Keeps the employee’s travel-wallet record and stored balance.

Wallets records; consult the field definitions and governing module specification.

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

- `wallets_pkey`: `PRIMARY KEY (id)`

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

- `wallets_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `wallets_employee_id_key`: `UNIQUE (employee_id)`

### balance_paise

**In everyday language:** Stored current wallet balance in whole numbers of paise; transaction history of additions and deductions is the reconciliation authority.

**Why it is kept:** Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.

**Example:** 10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.

Technical definition: Stored current wallet balance in integer paise; transaction ledger is the reconciliation authority.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `balance_paise: ColumnType<number, number \| undefined, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Integer paise; 100 paise = INR 1.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `wallets_balance_paise_check`: `CHECK ((balance_paise >= 0))`

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

- Index `idx_te_wallets_employee`: `CREATE INDEX idx_te_wallets_employee ON te.wallets USING btree (employee_id)`
- Index `wallets_employee_id_key`: `CREATE UNIQUE INDEX wallets_employee_id_key ON te.wallets USING btree (employee_id)`
- Index `wallets_pkey`: `CREATE UNIQUE INDEX wallets_pkey ON te.wallets USING btree (id)`

