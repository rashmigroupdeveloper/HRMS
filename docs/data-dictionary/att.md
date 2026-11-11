# att — field dictionary

245 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## att.absence_cases

Tracks extended unexplained absence and the follow-up needed from HR.

att.absence_cases — ATT-10 continuous-absence engine; one open case per employee.

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

- `absence_cases_pkey`: `PRIMARY KEY (id)`

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

- `absence_cases_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### start_date

**In everyday language:** First date in the continuous absence case.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First date in the continuous absence case

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `start_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### days_absent

**In everyday language:** worked out from other saved information streak length for case progression, not a leave/pay balance.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Derived streak length for case progression, not a leave/pay balance

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `days_absent: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### stage

**In everyday language:** Configured disciplinary monitoring stage.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “watch” means Record is watch in this progress from creation to closure.

Technical definition: Configured disciplinary monitoring stage

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'watch'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `stage: Generated<'watch' \| 'show_cause' \| 'warning' \| 'termination_review'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `watch` | Record is watch in this lifecycle. | DB CHECK: absence_cases_stage_check |
| `show_cause` | Record is show cause in this lifecycle. | DB CHECK: absence_cases_stage_check |
| `warning` | Record is warning in this lifecycle. | DB CHECK: absence_cases_stage_check |
| `termination_review` | Record is termination review in this lifecycle. | DB CHECK: absence_cases_stage_check |

Database rules (including conditions shared with other fields):

- `absence_cases_stage_check`: `CHECK ((stage = ANY (ARRAY['watch'::text, 'show_cause'::text, 'warning'::text, 'termination_review'::text])))`

### letter_id

**In everyday language:** Identifies letter connected to this record.

**Why it is kept:** Keeps this record connected to the correct letter, so related details can be checked together.

**Example:** This record points to an existing entry in letters instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s letter id to FOREIGN KEY (letter_id) REFERENCES core.letters(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `letter_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `absence_cases_letter_id_fkey`: `FOREIGN KEY (letter_id) REFERENCES core.letters(id)`

### hr_owner_id

**In everyday language:** Identifies hr owner connected to this record.

**Why it is kept:** Keeps this record connected to the correct hr owner, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s hr owner id to FOREIGN KEY (hr_owner_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `hr_owner_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `absence_cases_hr_owner_id_fkey`: `FOREIGN KEY (hr_owner_id) REFERENCES core.users(id)`

### resolution

**In everyday language:** Case closure cause: returned, regularized or exited.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “returned” means Returned.

Technical definition: Case closure cause: returned, regularized or exited

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `resolution: 'returned' \| 'regularized' \| 'exited' \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `returned` | Returned. | DB CHECK: absence_cases_resolution_check |
| `regularized` | Regularized. | DB CHECK: absence_cases_resolution_check |
| `exited` | Exited. | DB CHECK: absence_cases_resolution_check |

Database rules (including conditions shared with other fields):

- `absence_cases_check`: `CHECK (((resolution IS NULL) = (closed_at IS NULL)))`
- `absence_cases_resolution_check`: `CHECK ((resolution = ANY (ARRAY['returned'::text, 'regularized'::text, 'exited'::text])))`

### closed_at

**In everyday language:** Case closure instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Case closure instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `closed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `absence_cases_check`: `CHECK (((resolution IS NULL) = (closed_at IS NULL)))`

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

- Index `absence_cases_one_open`: `CREATE UNIQUE INDEX absence_cases_one_open ON att.absence_cases USING btree (employee_id) WHERE (closed_at IS NULL)`
- Index `absence_cases_pkey`: `CREATE UNIQUE INDEX absence_cases_pkey ON att.absence_cases USING btree (id)`
- Trigger `absence_cases_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.coverage_targets

Records how many people are needed for each staffing group and shift.

Coverage targets records; consult the field definitions and governing module specification.

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

- `coverage_targets_pkey`: `PRIMARY KEY (id)`

### location_id

**In everyday language:** Identifies location connected to this record.

**Why it is kept:** Keeps this record connected to the correct location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s location id to FOREIGN KEY (location_id) REFERENCES core.locations(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `location_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `coverage_targets_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

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

- `coverage_targets_department_id_fkey`: `FOREIGN KEY (department_id) REFERENCES core.departments(id)`

### shift_id

**In everyday language:** Identifies shift connected to this record.

**Why it is kept:** Keeps this record connected to the correct shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s shift id to FOREIGN KEY (shift_id) REFERENCES att.shifts(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `shift_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `coverage_targets_shift_id_fkey`: `FOREIGN KEY (shift_id) REFERENCES att.shifts(id)`

### weekday

**In everyday language:** Day-of-week selector for sanctioned staffing.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A staffing requirement can apply to Monday while a different requirement applies to Sunday; the stored weekday code selects the day.

Technical definition: Day-of-week selector for sanctioned staffing

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `weekday: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `coverage_targets_weekday_check`: `CHECK (((weekday >= 0) AND (weekday <= 6)))`

### sanctioned

**In everyday language:** Configured required headcount for location/department/shift coverage.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A required staffing count of 5 means five people are planned for that coverage group.

Technical definition: Configured required headcount for location/department/shift coverage

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `sanctioned: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `coverage_targets_sanctioned_check`: `CHECK ((sanctioned >= 0))`

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

- `coverage_targets_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES core.users(id)`

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

- Index `coverage_targets_pkey`: `CREATE UNIQUE INDEX coverage_targets_pkey ON att.coverage_targets USING btree (id)`
- Index `coverage_targets_scope`: `CREATE UNIQUE INDEX coverage_targets_scope ON att.coverage_targets USING btree (location_id, weekday, shift_id, COALESCE(department_id, (0)::bigint))`
- Trigger `coverage_targets_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.day_records

Keeps the processed attendance result for one employee on one working date.

att.day_records — PROCESSED attendance; recomputable until locked (ATT-03/05/15).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Processed attendance row identity for read/audit/lock operations.

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

- `day_records_pkey`: `PRIMARY KEY (id)`

### employee_id

**In everyday language:** Employee whose attendance facts are represented.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Employee whose attendance facts are represented.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_records_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `day_records_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

### work_date

**In everyday language:** Shift-attribution date, including overnight shifts; not necessarily a swipe calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Shift-attribution date, including overnight shifts; not necessarily a swipe calendar date.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `work_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_records_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

### shift_id

**In everyday language:** Resolved shift used for calculation.

**Why it is kept:** Keeps this record connected to the correct shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Resolved shift used for calculation.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `shift_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_records_shift_id_fkey`: `FOREIGN KEY (shift_id) REFERENCES att.shifts(id)`

### status

**In everyday language:** Whole-day attendance summary, separate from ordered half-session detail.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** Staff read the saved stage to see where this particular record has reached.

Technical definition: Whole-day attendance summary, separate from ordered half-session detail.

| Property | Definition |
|---|---|
| SQL type | `att.day_status` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `status: DayStatus;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### leave_type_id

**In everyday language:** Approved leave where the information came from; prevents recomputation from overwriting leave-owned attendance.

**Why it is kept:** Keeps this record connected to the correct leave type, so related details can be checked together.

**Example:** This record points to an existing entry in leave types instead of copying all of that entry’s details.

Technical definition: Approved leave provenance; prevents recomputation from overwriting leave-owned attendance.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `leave_type_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_records_leave_type_fk`: `FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id)`

### first_in

**In everyday language:** The first qualifying entry punch selected for the employee’s working date.

**Why it is kept:** Shows which arrival time was used to work out attendance.

**Example:** A first qualifying entry might be 9:02 AM; the original punches remain available separately.

Technical definition: Selected earliest explicit IN, with unknown-direction fallback only when needed.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `first_in: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### last_out

**In everyday language:** The last qualifying exit punch selected for the employee’s working date.

**Why it is kept:** Shows which departure time was used to work out attendance.

**Example:** A final qualifying exit might be 6:07 PM; it is an actual selected punch, not an assumed departure.

Technical definition: Selected latest explicit OUT after the selected IN; not any later IN.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `last_out: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### worked_minutes

**In everyday language:** worked out from other saved information worked duration from owned swipes and configured windows/breaks; not a mutable running counter.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Derived worked duration from owned swipes and configured windows/breaks; not a mutable running counter.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `worked_minutes: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_records_minutes_nonnegative`: `CHECK (((worked_minutes IS NULL) OR (worked_minutes >= 0))) NOT VALID` **NOT VALIDATED**

### late_minutes

**In everyday language:** worked out from other saved information arrival delay beyond configured grace.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Derived arrival delay beyond configured grace.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `late_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### early_exit_minutes

**In everyday language:** worked out from other saved information departure shortfall beyond configured grace.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Derived departure shortfall beyond configured grace.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `early_exit_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ot_minutes

**In everyday language:** Detected overtime minutes; does not by itself mean approved or payable overtime.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Detected overtime minutes; does not by itself mean approved or payable OT.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `ot_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### weekoff_paid

**In everyday language:** Whether this weekly off qualifies as paid under the applicable attendance rules.

**Why it is kept:** Lets payroll distinguish a paid weekly off from one that counts as loss of pay.

**Example:** Two weekly-off dates may have different payment treatment because the qualifying attendance differs.

Technical definition: Week-close eligibility result; does not invent a new attendance/payable policy.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `weekoff_paid: boolean \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### session_statuses

**In everyday language:** Ordered first/second-half facts; preserve P/A/O/approved on-duty time and mixed-half display.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the session statuses.

Technical definition: Ordered first/second-half facts; preserve P/A/O/OD and mixed-half display.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `session_statuses: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_records_session_statuses_valid`: `CHECK (
CASE
    WHEN (session_statuses IS NULL) THEN true
    WHEN (jsonb_typeof(session_statuses) <> 'array'::text) THEN false
    ELSE COALESCE(((jsonb_array_length(session_statuses) = 2) AND (((session_statuses -> 0) -> 'session'::text) = '1'::jsonb) AND (((session_statuses -> 1) -> 'session'::text) = '2'::jsonb) AND (((session_statuses -> 0) ->> 'status'::text) = ANY (ARRAY['P'::text, 'A'::text, 'O'::text, 'OD'::text])) AND (((session_statuses -> 1) ->> 'status'::text) = ANY (ARRAY['P'::text, 'A'::text, 'O'::text, 'OD'::text]))), false)
END)`

### scheme_code

**In everyday language:** Resolved scheme/shift label stored with the processed result.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Resolved scheme/shift label stored with the processed result.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `scheme_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### penalty_flag

**In everyday language:** Compatibility indicator for any recorded penalty finding, not a day quantity. When copy saved at that point in time exists, DB requires flag=(findings nonempty). Legacy true without copy saved at that point in time is explicitly unexplained.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Compatibility indicator for any recorded penalty finding, not a day quantity. When snapshot exists, DB requires flag=(findings nonempty). Legacy true without snapshot is explicitly unexplained.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `penalty_flag: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules (including conditions shared with other fields):

- `day_penalty_flag_matches_evaluation`: `CHECK (((penalty_evaluation IS NULL) OR (penalty_flag = (jsonb_array_length(penalty_evaluation) > 0))))`

### source

**In everyday language:** Auto/manual/regularized where the information came from that controls safe recomputation.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “auto” means Auto classification for source.

Technical definition: Auto/manual/regularized provenance that controls safe recomputation.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'auto'::text |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `source: Generated<'auto' \| 'regularized' \| 'manual'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `auto` | Auto classification for source. | DB CHECK: day_records_source_check |
| `regularized` | Regularized classification for source. | DB CHECK: day_records_source_check |
| `manual` | Manual classification for source. | DB CHECK: day_records_source_check |

Database rules (including conditions shared with other fields):

- `day_records_check`: `CHECK (((source <> 'manual'::text) OR (override_reason IS NOT NULL)))`
- `day_records_source_check`: `CHECK ((source = ANY (ARRAY['auto'::text, 'regularized'::text, 'manual'::text])))`

### override_reason

**In everyday language:** Required explanation for HR manual correction.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Required explanation for HR manual correction.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `override_reason: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_records_check`: `CHECK (((source <> 'manual'::text) OR (override_reason IS NOT NULL)))`

### is_locked

**In everyday language:** Payroll attendance lock, enforced at the database as well as the API.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Payroll attendance lock, enforced at the database as well as the API.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `is_locked: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### computed_at

**In everyday language:** Time this worked out from other saved information result was calculated.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Time this derived result was calculated.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `computed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Creation where the information came from.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Creation provenance.

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

**In everyday language:** Last modification where the information came from.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Last modification provenance.

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

### penalty_evaluation

**In everyday language:** The saved details of any late-arrival or early-leaving rule that matched that day.

**Why it is kept:** Explains a separate attendance finding without changing the actual presence or absence result.

**Example:** A person can remain marked present while a separate late-arrival finding is shown. This field alone does not reduce salary.

Technical definition: SHF-01: frozen rule findings, separate from attendance/pay. NULL = not evaluated.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:781 |
| Code declaration | `penalty_evaluation: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `day_penalty_evaluation_valid`: `CHECK (att.valid_penalty_evaluation(penalty_evaluation))`
- `day_penalty_flag_matches_evaluation`: `CHECK (((penalty_evaluation IS NULL) OR (penalty_flag = (jsonb_array_length(penalty_evaluation) > 0))))`

Table indexes and lifecycle triggers:

- Index `day_records_date_status_idx`: `CREATE INDEX day_records_date_status_idx ON att.day_records USING btree (work_date, status)`
- Index `day_records_employee_id_work_date_key`: `CREATE UNIQUE INDEX day_records_employee_id_work_date_key ON att.day_records USING btree (employee_id, work_date)`
- Index `day_records_pkey`: `CREATE UNIQUE INDEX day_records_pkey ON att.day_records USING btree (id)`
- Trigger `day_records_invalidate_manager_approval` → `att.invalidate_manager_month_approval` (enabled flag `O`).
- Trigger `day_records_lock_guard` → `att.day_records_lock_guard` (enabled flag `O`).
- Trigger `day_records_month_lock_guard` → `att.day_records_month_lock_guard` (enabled flag `O`).
- Trigger `day_records_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.device_watermarks

Records how far each attendance device has confirmed its data is complete.

att.device_watermarks — per-door completeness cursor (doc 14 §8.5).

Relation kind: table.

### device_id

**In everyday language:** link to another record to actual device, distinct from source cursor.

**Why it is kept:** Keeps this record connected to the correct device, so related details can be checked together.

**Example:** This record points to an existing entry in devices instead of copying all of that entry’s details.

Technical definition: FK to actual device, distinct from source cursor.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `device_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `device_watermarks_device_id_fkey`: `FOREIGN KEY (device_id) REFERENCES att.devices(id) ON DELETE CASCADE`
- `device_watermarks_pkey`: `PRIMARY KEY (device_id)`

### watermark_ts

**In everyday language:** Connector-proven gap-free completeness instant; monotonic DB rule prevents regression. Heartbeats alone cannot advance it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If data is confirmed complete only up to 5 PM, the system must not assume a later shift’s missing punches prove absence.

Technical definition: Connector-proven gap-free completeness instant; monotonic DB rule prevents regression. Heartbeats alone cannot advance it.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `watermark_ts: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Completeness receipt persistence timestamp, distinct from proved-through instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Completeness receipt persistence timestamp, distinct from proved-through instant.

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

Table indexes and lifecycle triggers:

- Index `device_watermarks_pkey`: `CREATE UNIQUE INDEX device_watermarks_pkey ON att.device_watermarks USING btree (device_id)`
- Index `device_watermarks_ts_idx`: `CREATE INDEX device_watermarks_ts_idx ON att.device_watermarks USING btree (watermark_ts)`
- Trigger `device_watermark_monotonic` → `att.device_watermark_monotonic` (enabled flag `O`).

## att.devices

Lists biometric attendance devices and their operating details.

att.devices — door health board (ATT-02).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Internal door identity used by per-door completeness FK.

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

- `devices_pkey`: `PRIMARY KEY (id)`

### source

**In everyday language:** Connector where the information came from for health/ingestion diagnostics.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the source.

Technical definition: Connector provenance for health/ingestion diagnostics.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'kent'::text |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `source: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### door_code

**In everyday language:** Unique source door identity linked by raw punches and connector reports.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A code such as GATE-A distinguishes the gate where the punch was recorded.

Technical definition: Unique source door identity linked by raw punches and connector reports.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `door_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `devices_door_code_key`: `UNIQUE (door_code)`

### location_id

**In everyday language:** Configured physical location link to another record for health/scope/reconciliation; must not reject legitimate cross-plant punches.

**Why it is kept:** Keeps this record connected to the correct location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: Configured physical location FK for health/scope/reconciliation; must not reject legitimate cross-plant punches.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `location_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `devices_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

### last_seen_at

**In everyday language:** Latest source contact/receipt heartbeat. Never proves ingestion completeness.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Latest source contact/receipt heartbeat. Never proves ingestion completeness.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `last_seen_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### expected_hourly_swipes

**In everyday language:** Expected hourly swipe-traffic baseline recorded for device anomaly review; a configured baseline is not evidence that monitoring consumes it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A baseline of 20 means twenty punches are expected in an hour for comparison; it is not twenty employees or twenty hours.

Technical definition: Expected hourly swipe-traffic baseline recorded for device anomaly review; a configured baseline is not evidence that monitoring consumes it.

| Property | Definition |
|---|---|
| SQL type | `numeric(8,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `expected_hourly_swipes: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_active

**In everyday language:** Configured active-device population for health/completeness checks.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Configured active-device population for health/completeness checks.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewed field purpose (19 Oct 2026) |
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

**In everyday language:** Device register where the information came from timestamp.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Device registry provenance timestamp.

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

**In everyday language:** Device register modification where the information came from timestamp.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Device registry modification provenance timestamp.

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

### alerted_silent_at

**In everyday language:** Last silent-device alert receipt/cooldown marker; re-arms only after renewed contact.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Last silent-device alert receipt/cooldown marker; re-arms only after renewed contact.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `alerted_silent_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `devices_door_code_key`: `CREATE UNIQUE INDEX devices_door_code_key ON att.devices USING btree (door_code)`
- Index `devices_pkey`: `CREATE UNIQUE INDEX devices_pkey ON att.devices USING btree (id)`
- Trigger `devices_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.employee_shifts

Records which shift arrangement applies to an employee over time.

att.employee_shifts — weekday vs Saturday scheme per employee (09 §4).

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_shifts_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `employee_shifts_pkey`: `PRIMARY KEY (employee_id)`

### weekday_shift_id

**In everyday language:** Identifies weekday shift connected to this record.

**Why it is kept:** Keeps this record connected to the correct weekday shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s weekday shift id to FOREIGN KEY (weekday_shift_id) REFERENCES att.shifts(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `weekday_shift_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_shifts_weekday_shift_id_fkey`: `FOREIGN KEY (weekday_shift_id) REFERENCES att.shifts(id)`

### saturday_shift_id

**In everyday language:** Identifies saturday shift connected to this record.

**Why it is kept:** Keeps this record connected to the correct saturday shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s saturday shift id to FOREIGN KEY (saturday_shift_id) REFERENCES att.shifts(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `saturday_shift_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_shifts_saturday_shift_id_fkey`: `FOREIGN KEY (saturday_shift_id) REFERENCES att.shifts(id)`

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

- `employee_shifts_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES core.users(id)`

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

- Index `employee_shifts_pkey`: `CREATE UNIQUE INDEX employee_shifts_pkey ON att.employee_shifts USING btree (employee_id)`
- Trigger `employee_shifts_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.holidays

Lists holidays and the employee groups or places to which they apply.

Holidays records; consult the field definitions and governing module specification.

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

- `holidays_pkey`: `PRIMARY KEY (id)`

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

- `holidays_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`
- `holidays_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`
- `holidays_scope_needs_company`: `CHECK ((((plant_id IS NULL) AND (location_id IS NULL)) OR (company_id IS NOT NULL)))`

### holiday_date

**In everyday language:** Calendar date subject to holiday scope.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date subject to holiday scope

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `holiday_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### name

**In everyday language:** Holiday display label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Holiday display label

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

### company_id

**In everyday language:** C-35 scope: not recorded company = whole group; plant/location narrow it further (all non-null columns must match).

**Why it is kept:** Keeps this record connected to the correct legal company, so related details can be checked together.

**Example:** This record points to an existing entry in companies instead of copying all of that entry’s details.

Technical definition: C-35 scope: NULL company = whole group; plant/location narrow it further (all non-null columns must match).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:751 |
| Code declaration | `company_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `holidays_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `holidays_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`
- `holidays_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`
- `holidays_scope_needs_company`: `CHECK ((((plant_id IS NULL) AND (location_id IS NULL)) OR (company_id IS NOT NULL)))`

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

- `holidays_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`
- `holidays_plant_id_fkey`: `FOREIGN KEY (plant_id) REFERENCES core.plants(id)`
- `holidays_scope_needs_company`: `CHECK ((((plant_id IS NULL) AND (location_id IS NULL)) OR (company_id IS NOT NULL)))`

Table indexes and lifecycle triggers:

- Index `holidays_date_idx`: `CREATE INDEX holidays_date_idx ON att.holidays USING btree (holiday_date)`
- Index `holidays_pkey`: `CREATE UNIQUE INDEX holidays_pkey ON att.holidays USING btree (id)`
- Index `holidays_scope_identity_uq`: `CREATE UNIQUE INDEX holidays_scope_identity_uq ON att.holidays USING btree (COALESCE(company_id, (0)::bigint), COALESCE(plant_id, (0)::bigint), COALESCE(location_id, (0)::bigint), holiday_date)`
- Trigger `holidays_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.ingest_watermarks

Records progress when receiving attendance data from an external source.

Ingest watermarks records; consult the field definitions and governing module specification.

Relation kind: table.

### source

**In everyday language:** Connector stream identity and cursor primary key.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the source.

Technical definition: Connector stream identity and cursor primary key.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `source: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `ingest_watermarks_pkey`: `PRIMARY KEY (source)`

### watermark_ts

**In everyday language:** Source received-time fetch cursor committed with ingestion; does not authorize final absence.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If data is confirmed complete only up to 5 PM, the system must not assume a later shift’s missing punches prove absence.

Technical definition: Source received-time fetch cursor committed with ingestion; does not authorize final absence.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `watermark_ts: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

**In everyday language:** Cursor persistence timestamp, not device completeness.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Cursor persistence timestamp, not device completeness.

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

Table indexes and lifecycle triggers:

- Index `ingest_watermarks_pkey`: `CREATE UNIQUE INDEX ingest_watermarks_pkey ON att.ingest_watermarks USING btree (source)`

## att.kent_unknown_faces

Keeps biometric events that could not be matched to an employee for investigation.

att.kent_unknown_faces — webhook type:0 events, never swipes.

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
| Default | nextval('att.kent_unknown_faces_id_seq'::regclass) |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `kent_unknown_faces_pkey`: `PRIMARY KEY (id)`

### batch_id

**In everyday language:** Identifies the payment group connected to this record.

**Why it is kept:** Keeps this record connected to the correct payment group, so related details can be checked together.

**Example:** This record points to an existing entry in kent webhook batches instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s batch id to FOREIGN KEY (batch_id) REFERENCES att.kent_webhook_batches(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `batch_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `kent_unknown_faces_batch_id_fkey`: `FOREIGN KEY (batch_id) REFERENCES att.kent_webhook_batches(id) ON DELETE CASCADE`

### event_ts

**In everyday language:** Unmatched biometric capture instant.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A device event may happen at 9 AM but reach HRMS later; this is the event’s own time.

Technical definition: Unmatched biometric capture instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `event_ts: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### device_id

**In everyday language:** External Kent device identifier, not HRMS internal device link to another record.

**Why it is kept:** Keeps this record connected to the correct device, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: External Kent device identifier, not HRMS internal device FK

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `device_id: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### device_name

**In everyday language:** Source device display label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the device name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Source device display label

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `device_name: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### location_name

**In everyday language:** Source location label for investigation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the location name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Source location label for investigation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `location_name: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### image_url

**In everyday language:** Source face-image reference; sensitive, not proof bytes are locally archived.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A source image reference tells an authorized reviewer where an image was referenced; it does not prove HRMS stores a permanent copy.

Technical definition: Source face-image reference; sensitive, not proof bytes are locally archived

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `image_url: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### raw

**In everyday language:** Original unmatched source record for reconciliation; restricted sensitive saved request or message details.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the raw.

Technical definition: Original unmatched source record for reconciliation; restricted sensitive payload

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `raw: unknown;` |
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

- Index `kent_unknown_faces_event_idx`: `CREATE INDEX kent_unknown_faces_event_idx ON att.kent_unknown_faces USING btree (event_ts DESC)`
- Index `kent_unknown_faces_pkey`: `CREATE UNIQUE INDEX kent_unknown_faces_pkey ON att.kent_unknown_faces USING btree (id)`

## att.kent_webhook_batches

Records groups of attendance events received from Kent and their processing results.

att.kent_webhook_batches — raw Kent webhook POSTs (KENT_RESEARCH §5.1).

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
| Default | nextval('att.kent_webhook_batches_id_seq'::regclass) |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `kent_webhook_batches_pkey`: `PRIMARY KEY (id)`

### received_at

**In everyday language:** HRMS webhook receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: HRMS webhook receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `received_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### remote_ip

**In everyday language:** Source network where the information came from.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A saved browser or connection detail can help an authorized administrator investigate which sign-in or submission produced the event.

Technical definition: Source network provenance

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `remote_ip: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### raw_body

**In everyday language:** Original webhook saved request or message details retained for replay/audit; may contain personal data.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Original webhook payload retained for replay/audit; may contain personal data

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `raw_body: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### records

**In everyday language:** Source batch record count.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Source batch record count

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `records: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### accepted

**In everyday language:** Accepted/rejected processing gate for batch.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An accepted incoming batch passed its processing gate; that does not mean an employee request was approved.

Technical definition: Accepted/rejected processing gate for batch

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `accepted: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### inserted

**In everyday language:** Successfully persisted swipe count.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A count of 12 means twelve source punches were saved from this incoming batch.

Technical definition: Successfully persisted swipe count

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `inserted: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### unknown_faces

**In everyday language:** Count routed to unmatched-face evidence.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A count of 3 means three unmatched-face events need investigation; it is not three confirmed absences.

Technical definition: Count routed to unmatched-face evidence

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `unknown_faces: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rejected

**In everyday language:** Invalid source-record count.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A count of 2 means two incoming records failed validation; it is a count here, not a request status.

Technical definition: Invalid source-record count

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `rejected: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### processed_at

**In everyday language:** Completed batch-processing instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Completed batch-processing instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `processed_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### error

**In everyday language:** Bounded processing error explanation; must not contain saved request or message details secrets.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A message explaining which import step failed helps staff correct the source rather than retry blindly.

Technical definition: Bounded processing error explanation; must not contain payload secrets

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `error: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `kent_webhook_batches_pkey`: `CREATE UNIQUE INDEX kent_webhook_batches_pkey ON att.kent_webhook_batches USING btree (id)`
- Index `kent_webhook_batches_received_idx`: `CREATE INDEX kent_webhook_batches_received_idx ON att.kent_webhook_batches USING btree (received_at DESC)`

## att.leave_blackouts

Lists dates on which leave restrictions apply.

Leave blackouts records; consult the field definitions and governing module specification.

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

- `leave_blackouts_pkey`: `PRIMARY KEY (id)`

### blackout_date

**In everyday language:** Calendar date on which leave policy blocks/flags requests.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date on which leave policy blocks/flags requests

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `blackout_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `leave_blackouts_location_id_blackout_date_key`: `UNIQUE (location_id, blackout_date)`

### location_id

**In everyday language:** Identifies location connected to this record.

**Why it is kept:** Keeps this record connected to the correct location, so related details can be checked together.

**Example:** This record points to an existing entry in locations instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s location id to FOREIGN KEY (location_id) REFERENCES core.locations(id).

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

- `leave_blackouts_location_id_blackout_date_key`: `UNIQUE (location_id, blackout_date)`
- `leave_blackouts_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

### name

**In everyday language:** Reason/name of the blackout.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Reason/name of the blackout

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

- Index `leave_blackouts_location_id_blackout_date_key`: `CREATE UNIQUE INDEX leave_blackouts_location_id_blackout_date_key ON att.leave_blackouts USING btree (location_id, blackout_date)`
- Index `leave_blackouts_pkey`: `CREATE UNIQUE INDEX leave_blackouts_pkey ON att.leave_blackouts USING btree (id)`
- Trigger `leave_blackouts_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.manager_month_approvals

Keeps managers’ monthly attendance approvals and later withdrawals of those approvals.

ATT-12 manager attendance approval ledger — prerequisite for month lock when policy enabled

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

- `manager_month_approvals_pkey`: `PRIMARY KEY (id)`

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

- `manager_month_approvals_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### month

**In everyday language:** Payroll attendance period key.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Payroll attendance period key

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `month: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### manager_employee_id

**In everyday language:** Identifies manager employee connected to this record.

**Why it is kept:** Keeps this record connected to the correct manager employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s manager employee id to FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `manager_employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `manager_month_approvals_manager_employee_id_fkey`: `FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id)`

### approved_by_user_id

**In everyday language:** Identifies approved by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct approved by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s approved by user id to FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `approved_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `manager_month_approvals_approved_by_user_id_fkey`: `FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id)`

### approved_at

**In everyday language:** Attestation event instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Attestation event instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `approved_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### note

**In everyday language:** Approval/invalidation explanation.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Approval/invalidation explanation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `note: string \| null;` |
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

### event_type

**In everyday language:** kept as history, with new entries added rather than old entries overwritten approve/invalidate event; latest event determines current attestation.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “approve” means Approve.

Technical definition: Append-only approve/invalidate event; latest event determines current attestation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'approve'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `event_type: Generated<'approve' \| 'invalidate'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `approve` | Approve. | DB CHECK: manager_month_approvals_event_type_check |
| `invalidate` | Invalidate. | DB CHECK: manager_month_approvals_event_type_check |

Database rules (including conditions shared with other fields):

- `manager_month_approvals_event_type_check`: `CHECK ((event_type = ANY (ARRAY['approve'::text, 'invalidate'::text])))`

Table indexes and lifecycle triggers:

- Index `manager_month_approvals_latest_idx`: `CREATE INDEX manager_month_approvals_latest_idx ON att.manager_month_approvals USING btree (company_id, month, manager_employee_id, id DESC)`
- Index `manager_month_approvals_lookup_idx`: `CREATE INDEX manager_month_approvals_lookup_idx ON att.manager_month_approvals USING btree (company_id, month)`
- Index `manager_month_approvals_pkey`: `CREATE UNIQUE INDEX manager_month_approvals_pkey ON att.manager_month_approvals USING btree (id)`
- Trigger `manager_month_approvals_append_only` → `att.reject_manager_approval_mutation` (enabled flag `O`).

## att.month_locks

Records when a company’s attendance period is frozen for payroll.

att.month_locks — ATT-15 payroll precondition.

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

- `month_locks_pkey`: `PRIMARY KEY (id)`

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

- `month_locks_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `month_locks_company_id_month_key`: `UNIQUE (company_id, month)`

### month

**In everyday language:** Company payroll period key, not arbitrary work-date month.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Company payroll period key, not arbitrary work-date month

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `month: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `month_locks_company_id_month_key`: `UNIQUE (company_id, month)`
- `month_locks_first_day_check`: `CHECK ((month = (date_trunc('month'::text, (month)::timestamp with time zone))::date))`

### locked_by

**In everyday language:** Identifies locked by connected to this record.

**Why it is kept:** Keeps this record connected to the correct locked by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s locked by to FOREIGN KEY (locked_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `locked_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `month_locks_locked_by_fkey`: `FOREIGN KEY (locked_by) REFERENCES core.users(id)`

### locked_at

**In everyday language:** Attendance freeze instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Attendance freeze instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `locked_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### checklist

**In everyday language:** Readiness facts captured at lock.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the checklist.

Technical definition: Readiness facts captured at lock

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | '{}'::jsonb |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `checklist: unknown;` |
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

### period_from

**In everyday language:** The beginning of the attendance period frozen for payroll; this boundary is included.

**Why it is kept:** Establishes which attendance dates belong to the frozen period.

**Example:** If the period begins on 01 Nov, that date is included. Older records without saved boundaries use their defined calendar-month rule.

Technical definition: Inclusive beginning of the frozen attendance window; paired with exclusive period_until. NULL legacy boundaries use the calendar-month fallback.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `period_from: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `month_locks_period_ck`: `CHECK ((((period_from IS NULL) = (period_until IS NULL)) AND ((period_from IS NULL) OR (period_from < period_until))))`

### period_until

**In everyday language:** The first instant after the frozen attendance period. It is not included in that period.

**Why it is kept:** Makes the end of one attendance period and the start of the next unambiguous.

**Example:** For a period ending just before 01 Dec 2026, 01 Dec belongs to the next period.

Technical definition: Exclusive upper boundary of the frozen attendance window [period_from, period_until). NULL legacy boundaries use the calendar-month fallback.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `period_until: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `month_locks_period_ck`: `CHECK ((((period_from IS NULL) = (period_until IS NULL)) AND ((period_from IS NULL) OR (period_from < period_until))))`

Table indexes and lifecycle triggers:

- Index `month_locks_company_id_month_key`: `CREATE UNIQUE INDEX month_locks_company_id_month_key ON att.month_locks USING btree (company_id, month)`
- Index `month_locks_pkey`: `CREATE UNIQUE INDEX month_locks_pkey ON att.month_locks USING btree (id)`
- Trigger `month_locks_immutable` → `att.month_locks_immutable` (enabled flag `O`).

## att.overtime_entries

Tracks detected overtime, the manager’s decision and whether it is paid or converted to leave.

att.overtime_entries — the 48-hour rule (ATT-08).

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

- `overtime_entries_pkey`: `PRIMARY KEY (id)`

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

- `overtime_entries_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `overtime_entries_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

### work_date

**In everyday language:** Attendance date supplying the overtime obligation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Attendance date supplying the OT obligation

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `work_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `overtime_entries_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

### detected_minutes

**In everyday language:** Processor's observed overtime before claim/approval.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Processor's observed overtime before claim/approval

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `detected_minutes: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `overtime_entries_check`: `CHECK ((claimed_minutes <= detected_minutes))`

### claimed_minutes

**In everyday language:** Configured rounded duration submitted for decision.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured rounded duration submitted for decision

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `claimed_minutes: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `overtime_entries_check`: `CHECK ((claimed_minutes <= detected_minutes))`
- `overtime_entries_check1`: `CHECK (((approved_minutes IS NULL) OR (approved_minutes <= claimed_minutes)))`

### approved_minutes

**In everyday language:** Manager-authorized duration; not merely detected time.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Manager-authorized duration; not merely detected time

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `approved_minutes: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `overtime_entries_check1`: `CHECK (((approved_minutes IS NULL) OR (approved_minutes <= claimed_minutes)))`

### status

**In everyday language:** Pending/approved/rejected/lapsed/comp-off obligation state.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Pending/approved/rejected/lapsed/comp-off obligation state

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'pending'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<'pending' \| 'approved' \| 'rejected' \| 'lapsed' \| 'converted_comp_off'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: overtime_entries_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: overtime_entries_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: overtime_entries_status_check |
| `lapsed` | Validity or decision window elapsed | DB CHECK: overtime_entries_status_check |
| `converted_comp_off` | Overtime converted to compensatory-off credit instead of cash | DB CHECK: overtime_entries_status_check |

Database rules (including conditions shared with other fields):

- `overtime_entries_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'lapsed'::text, 'converted_comp_off'::text])))`

### manager_id

**In everyday language:** Identifies manager connected to this record.

**Why it is kept:** Keeps this record connected to the correct manager, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s manager id to FOREIGN KEY (manager_id) REFERENCES core.employees(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `manager_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `overtime_entries_manager_id_fkey`: `FOREIGN KEY (manager_id) REFERENCES core.employees(id)`

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

### deadline_at

**In everyday language:** Configured hard decision deadline.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Configured hard decision deadline

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `deadline_at: Timestamp;` |
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

- `overtime_entries_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

### comp_off_credit_id

**In everyday language:** Identifies comp off credit connected to this record.

**Why it is kept:** Keeps this record connected to the correct comp off credit, so related details can be checked together.

**Example:** This record points to an existing entry in ledger instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s comp off credit id to FOREIGN KEY (comp_off_credit_id) REFERENCES lv.ledger(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `comp_off_credit_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `overtime_entries_check2`: `CHECK (((comp_off_credit_id IS NULL) OR (payroll_item_id IS NULL)))`
- `overtime_entries_comp_off_credit_fk`: `FOREIGN KEY (comp_off_credit_id) REFERENCES lv.ledger(id)`

### payroll_item_id

**In everyday language:** Intended consuming payslip header; link lacks a live link to another record and requires exactly-once consumption proof.

**Why it is kept:** Keeps this record connected to the correct payroll item, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Intended consuming payslip header; link lacks a live FK and requires exactly-once consumption proof

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `payroll_item_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `overtime_entries_check2`: `CHECK (((comp_off_credit_id IS NULL) OR (payroll_item_id IS NULL)))`

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

- Index `overtime_entries_employee_id_work_date_key`: `CREATE UNIQUE INDEX overtime_entries_employee_id_work_date_key ON att.overtime_entries USING btree (employee_id, work_date)`
- Index `overtime_entries_pkey`: `CREATE UNIQUE INDEX overtime_entries_pkey ON att.overtime_entries USING btree (id)`
- Index `overtime_pending_idx`: `CREATE INDEX overtime_pending_idx ON att.overtime_entries USING btree (manager_id, status) WHERE (status = 'pending'::text)`
- Index `overtime_wf_idx`: `CREATE UNIQUE INDEX overtime_wf_idx ON att.overtime_entries USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL)`
- Trigger `overtime_entries_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.quarantined_swipes

Separates questionable attendance punches for investigation.

att.quarantined_swipes — implausible timestamps parked for review (doc 14 §8.4).

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

- `quarantined_swipes_pkey`: `PRIMARY KEY (id)`

### employee_no

**In everyday language:** Original source e-code for quarantined event.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The employee number received with the punch is matched to the employee master before it can be trusted as an employee link.

Technical definition: Original source e-code for quarantined event

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `employee_no: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `quarantined_swipes_employee_no_swipe_ts_door_code_source_key`: `UNIQUE (employee_no, swipe_ts, door_code, source)`

### swipe_ts

**In everyday language:** Implausible source punch instant.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A punch made at 9 AM keeps that time even if the device uploads it later.

Technical definition: Implausible source punch instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `swipe_ts: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `quarantined_swipes_employee_no_swipe_ts_door_code_source_key`: `UNIQUE (employee_no, swipe_ts, door_code, source)`

### door_code

**In everyday language:** Source door identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A code such as GATE-A distinguishes the gate where the punch was recorded.

Technical definition: Source door identity

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `door_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `quarantined_swipes_employee_no_swipe_ts_door_code_source_key`: `UNIQUE (employee_no, swipe_ts, door_code, source)`

### direction

**In everyday language:** Source IN/OUT direction when supplied.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An IN punch records entry and an OUT punch records exit; a missing direction must not be treated as a known OUT.

Technical definition: Source IN/OUT direction when supplied

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `direction: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### swipe_type

**In everyday language:** Source biometric technology tag.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the swipe type.

Technical definition: Source biometric technology tag

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `swipe_type: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### received_at

**In everyday language:** Trusted source receipt used to measure drift.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Trusted source receipt used to measure drift

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `received_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### source

**In everyday language:** Connector stream where the information came from.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the source.

Technical definition: Connector stream provenance

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `source: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `quarantined_swipes_employee_no_swipe_ts_door_code_source_key`: `UNIQUE (employee_no, swipe_ts, door_code, source)`

### reason

**In everyday language:** Why the event was quarantined.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Why the event was quarantined

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

### reviewed

**In everyday language:** Exception-review marker; review/replay workflow must establish evidence.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Exception-review marker; review/replay workflow must establish evidence

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reviewed: Generated<boolean>;` |
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

- Index `quarantined_swipes_employee_no_swipe_ts_door_code_source_key`: `CREATE UNIQUE INDEX quarantined_swipes_employee_no_swipe_ts_door_code_source_key ON att.quarantined_swipes USING btree (employee_no, swipe_ts, door_code, source)`
- Index `quarantined_swipes_pkey`: `CREATE UNIQUE INDEX quarantined_swipes_pkey ON att.quarantined_swipes USING btree (id)`
- Index `quarantined_swipes_review_idx`: `CREATE INDEX quarantined_swipes_review_idx ON att.quarantined_swipes USING btree (reviewed, created_at)`

## att.recompute_queue

Lists attendance dates waiting to be calculated again after a relevant change.

Recompute queue records; consult the field definitions and governing module specification.

Relation kind: table.

### employee_id

**In everyday language:** Dirty attendance subject; live link to another record absent.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Dirty attendance subject; live FK absent

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

- `recompute_queue_pkey`: `PRIMARY KEY (employee_id, work_date)`

### work_date

**In everyday language:** Dirty attendance day needing recomputation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Dirty attendance day needing recomputation

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `work_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `recompute_queue_pkey`: `PRIMARY KEY (employee_id, work_date)`

### queued_at

**In everyday language:** Earliest eligible recompute instant, including future-half hold.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Earliest eligible recompute instant, including future-half hold

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `queued_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `recompute_queue_pkey`: `CREATE UNIQUE INDEX recompute_queue_pkey ON att.recompute_queue USING btree (employee_id, work_date)`

## att.regularizations

Records requests to correct attendance or record approved on-duty time.

att.regularizations — AR (past-only) / OD (future ok) / PERMISSION (time-bound) (ATT-06/07).

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

- `regularizations_pkey`: `PRIMARY KEY (id)`

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

- `regularizations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### kind

**In everyday language:** attendance correction request, official duty or short permission request type.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “AR” means Attendance regularization.

Technical definition: AR, official duty or short permission request type

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `kind: 'AR' \| 'OD' \| 'PERMISSION';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `AR` | Attendance regularization | DB CHECK: regularizations_kind_check |
| `OD` | On duty | DB CHECK: regularizations_kind_check |
| `PERMISSION` | Short time-bounded attendance permission | DB CHECK: regularizations_kind_check |

Database rules (including conditions shared with other fields):

- `regularizations_check1`: `CHECK (((kind <> 'PERMISSION'::text) OR ((from_time IS NOT NULL) AND (to_time IS NOT NULL) AND (from_date = to_date))))`
- `regularizations_kind_check`: `CHECK ((kind = ANY (ARRAY['AR'::text, 'OD'::text, 'PERMISSION'::text])))`

### from_date

**In everyday language:** Inclusive first requested date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Inclusive first requested date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `from_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `regularizations_check`: `CHECK ((from_date <= to_date))`
- `regularizations_check1`: `CHECK (((kind <> 'PERMISSION'::text) OR ((from_time IS NOT NULL) AND (to_time IS NOT NULL) AND (from_date = to_date))))`

### to_date

**In everyday language:** Inclusive last requested date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Inclusive last requested date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `to_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `regularizations_check`: `CHECK ((from_date <= to_date))`
- `regularizations_check1`: `CHECK (((kind <> 'PERMISSION'::text) OR ((from_time IS NOT NULL) AND (to_time IS NOT NULL) AND (from_date = to_date))))`

### from_time

**In everyday language:** Requested/configured start clock time, distinct from raw swipe.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A partial-day request may start at 2 PM; that start time does not by itself mean the whole day was approved.

Technical definition: Requested/configured start clock time, distinct from raw swipe

| Property | Definition |
|---|---|
| SQL type | `time without time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `from_time: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `regularizations_check1`: `CHECK (((kind <> 'PERMISSION'::text) OR ((from_time IS NOT NULL) AND (to_time IS NOT NULL) AND (from_date = to_date))))`

### to_time

**In everyday language:** Requested/configured end clock time, distinct from raw swipe.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A time-bounded request may end at 4 PM; the recorded end is part of its requested coverage.

Technical definition: Requested/configured end clock time, distinct from raw swipe

| Property | Definition |
|---|---|
| SQL type | `time without time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `to_time: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `regularizations_check1`: `CHECK (((kind <> 'PERMISSION'::text) OR ((from_time IS NOT NULL) AND (to_time IS NOT NULL) AND (from_date = to_date))))`

### reason

**In everyday language:** Employee justification.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Employee justification

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

### requested_status

**In everyday language:** Requested approved coverage result, never automatic consent.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the requested status.

Technical definition: Requested approved coverage result, never automatic consent

| Property | Definition |
|---|---|
| SQL type | `att.day_status` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `requested_status: DayStatus;` |
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
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `workflow_request_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `regularizations_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

### applied

**In everyday language:** Domain write-back marker after approved workflow effects.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Domain write-back marker after approved workflow effects

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `applied: Generated<boolean>;` |
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

### day_portion

**In everyday language:** Full day, first half or second half coverage owner.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “full_day” means Both configured attendance halves on each covered date.

Technical definition: Full day, first half or second half coverage owner

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'full_day'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `day_portion: Generated<'full_day' \| 'first_half' \| 'second_half'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `full_day` | Both configured attendance halves on each covered date | DB CHECK: regularizations_day_portion_check |
| `first_half` | First configured attendance half | DB CHECK: regularizations_day_portion_check |
| `second_half` | Second configured attendance half | DB CHECK: regularizations_day_portion_check |

Database rules (including conditions shared with other fields):

- `regularizations_day_portion_check`: `CHECK ((day_portion = ANY (ARRAY['full_day'::text, 'first_half'::text, 'second_half'::text])))`

Table indexes and lifecycle triggers:

- Index `regularizations_emp_idx`: `CREATE INDEX regularizations_emp_idx ON att.regularizations USING btree (employee_id, from_date)`
- Index `regularizations_half_coverage_idx`: `CREATE INDEX regularizations_half_coverage_idx ON att.regularizations USING btree (employee_id, from_date, to_date) WHERE ((day_portion <> 'full_day'::text) AND applied)`
- Index `regularizations_pkey`: `CREATE UNIQUE INDEX regularizations_pkey ON att.regularizations USING btree (id)`
- Index `regularizations_wf_idx`: `CREATE UNIQUE INDEX regularizations_wf_idx ON att.regularizations USING btree (workflow_request_id)`
- Trigger `regularizations_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.roster_publications

Records when a work schedule is published.

Roster publications records; consult the field definitions and governing module specification.

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

- `roster_publications_pkey`: `PRIMARY KEY (id)`

### manager_employee_id

**In everyday language:** Identifies manager employee connected to this record.

**Why it is kept:** Keeps this record connected to the correct manager employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s manager employee id to FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `manager_employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roster_publications_manager_employee_id_fkey`: `FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id)`

### period_from

**In everyday language:** Published roster interval beginning.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Published roster interval beginning

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `period_from: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roster_publications_check`: `CHECK ((period_to >= period_from))`

### period_to

**In everyday language:** Published roster interval ending.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Published roster interval ending

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `period_to: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roster_publications_check`: `CHECK ((period_to >= period_from))`

### published_at

**In everyday language:** Publication receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Publication receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `published_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### published_by

**In everyday language:** Identifies published by connected to this record.

**Why it is kept:** Keeps this record connected to the correct published by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s published by to FOREIGN KEY (published_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `published_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roster_publications_published_by_fkey`: `FOREIGN KEY (published_by) REFERENCES core.users(id)`

### revision

**In everyday language:** Publication revision number, not an employee counter.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Revision 2 identifies a later saved version than revision 1.

Technical definition: Publication revision number, not an employee counter

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 1 |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `revision: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### reason

**In everyday language:** Reason for publishing/revising.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Reason for publishing/revising

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `reason: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `roster_publications_pkey`: `CREATE UNIQUE INDEX roster_publications_pkey ON att.roster_publications USING btree (id)`
- Index `roster_publications_range`: `CREATE UNIQUE INDEX roster_publications_range ON att.roster_publications USING btree (manager_employee_id, period_from, period_to)`

## att.roster_revisions

Keeps the history of work-schedule changes.

Roster revisions records; consult the field definitions and governing module specification.

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

- `roster_revisions_pkey`: `PRIMARY KEY (id)`

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

- `roster_revisions_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### work_date

**In everyday language:** Roster day changed after publication.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Roster day changed after publication

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `work_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### old_shift_id

**In everyday language:** Identifies old shift connected to this record.

**Why it is kept:** Keeps this record connected to the correct old shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s old shift id to FOREIGN KEY (old_shift_id) REFERENCES att.shifts(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `old_shift_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roster_revisions_old_shift_id_fkey`: `FOREIGN KEY (old_shift_id) REFERENCES att.shifts(id)`

### new_shift_id

**In everyday language:** Identifies new shift connected to this record.

**Why it is kept:** Keeps this record connected to the correct new shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s new shift id to FOREIGN KEY (new_shift_id) REFERENCES att.shifts(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `new_shift_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roster_revisions_new_shift_id_fkey`: `FOREIGN KEY (new_shift_id) REFERENCES att.shifts(id)`

### old_week_off

**In everyday language:** Before-image off-day assignment.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Before-image off-day assignment

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `old_week_off: boolean;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### new_week_off

**In everyday language:** After-image off-day assignment.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: After-image off-day assignment

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `new_week_off: boolean;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### reason

**In everyday language:** Mandatory post-publication change reason.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Mandatory post-publication change reason

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

### changed_by

**In everyday language:** Identifies changed by connected to this record.

**Why it is kept:** Keeps this record connected to the correct changed by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s changed by to FOREIGN KEY (changed_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `changed_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `roster_revisions_changed_by_fkey`: `FOREIGN KEY (changed_by) REFERENCES core.users(id)`

### changed_at

**In everyday language:** Revision receipt instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Revision receipt instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `changed_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `roster_revisions_pkey`: `CREATE UNIQUE INDEX roster_revisions_pkey ON att.roster_revisions USING btree (id)`
- Trigger `roster_revisions_immutable` → `att.roster_revisions_immutable` (enabled flag `O`).

## att.rosters

Records an employee’s planned shift or weekly off for a date.

Rosters records; consult the field definitions and governing module specification.

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

- `rosters_pkey`: `PRIMARY KEY (id)`

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

- `rosters_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `rosters_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

### work_date

**In everyday language:** Employee's roster calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Employee's roster calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `work_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `rosters_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

### shift_id

**In everyday language:** Identifies shift connected to this record.

**Why it is kept:** Keeps this record connected to the correct shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s shift id to FOREIGN KEY (shift_id) REFERENCES att.shifts(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `shift_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `rosters_check`: `CHECK ((is_week_off OR (shift_id IS NOT NULL)))`
- `rosters_shift_id_fkey`: `FOREIGN KEY (shift_id) REFERENCES att.shifts(id)`

### is_week_off

**In everyday language:** Explicit off-day assignment; not inference from missing shift.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Explicit off-day assignment; not inference from missing shift

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `is_week_off: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules (including conditions shared with other fields):

- `rosters_check`: `CHECK ((is_week_off OR (shift_id IS NOT NULL)))`

### set_by

**In everyday language:** Identifies set by connected to this record.

**Why it is kept:** Keeps this record connected to the correct set by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s set by to FOREIGN KEY (set_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `set_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `rosters_set_by_fkey`: `FOREIGN KEY (set_by) REFERENCES core.users(id)`

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

- Index `rosters_employee_id_work_date_key`: `CREATE UNIQUE INDEX rosters_employee_id_work_date_key ON att.rosters USING btree (employee_id, work_date)`
- Index `rosters_pkey`: `CREATE UNIQUE INDEX rosters_pkey ON att.rosters USING btree (id)`
- Trigger `rosters_invalidate_manager_approval` → `att.invalidate_manager_month_approval` (enabled flag `O`).
- Trigger `rosters_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.shift_patterns

Defines repeating arrangements of work shifts and days off.

Shift patterns records; consult the field definitions and governing module specification.

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

- `shift_patterns_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Reusable rotation identity.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Reusable rotation identity

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

- `shift_patterns_code_key`: `UNIQUE (code)`

### name

**In everyday language:** Rotation display label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Rotation display label

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

### cycle

**In everyday language:** Ordered shift/off-day cycle used by pattern application; must validate every referenced shift.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the cycle.

Technical definition: Ordered shift/off-day cycle used by pattern application; must validate every referenced shift

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `cycle: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shift_patterns_cycle_array`: `CHECK ((jsonb_typeof(cycle) = 'array'::text))`

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

- `shift_patterns_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

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

- Index `shift_patterns_code_key`: `CREATE UNIQUE INDEX shift_patterns_code_key ON att.shift_patterns USING btree (code)`
- Index `shift_patterns_pkey`: `CREATE UNIQUE INDEX shift_patterns_pkey ON att.shift_patterns USING btree (id)`
- Trigger `shift_patterns_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.shift_swaps

Tracks requests to exchange scheduled shifts.

Shift swaps records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Domain request identity.

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

- `shift_swaps_pkey`: `PRIMARY KEY (id)`

### requester_employee_id

**In everyday language:** First employee whose roster would change.

**Why it is kept:** Keeps this record connected to the correct requester employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: First employee whose roster would change.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `requester_employee_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shift_swaps_requester_employee_id_fkey`: `FOREIGN KEY (requester_employee_id) REFERENCES core.employees(id)`

### counterpart_employee_id

**In everyday language:** Second affected employee; both need approval scope.

**Why it is kept:** Keeps this record connected to the correct counterpart employee, so related details can be checked together.

**Example:** This record points to an existing entry in employees instead of copying all of that entry’s details.

Technical definition: Second affected employee; both need approval scope.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `counterpart_employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shift_swaps_counterpart_employee_id_fkey`: `FOREIGN KEY (counterpart_employee_id) REFERENCES core.employees(id)`

### work_date

**In everyday language:** Roster date affected by the exchange/bid.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Roster date affected by the exchange/bid.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `work_date: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### requester_shift_id

**In everyday language:** Original first-person shift copy saved at that point in time; week-off copy saved at that point in time lives in existing workflow saved request or message details.

**Why it is kept:** Keeps this record connected to the correct requester shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Original first-person shift snapshot; week-off snapshot lives in existing workflow payload.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `requester_shift_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shift_swaps_requester_shift_id_fkey`: `FOREIGN KEY (requester_shift_id) REFERENCES att.shifts(id)`

### counterpart_shift_id

**In everyday language:** Original counterpart shift copy saved at that point in time.

**Why it is kept:** Keeps this record connected to the correct counterpart shift, so related details can be checked together.

**Example:** This record points to an existing entry in shifts instead of copying all of that entry’s details.

Technical definition: Original counterpart shift snapshot.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `counterpart_shift_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shift_swaps_counterpart_shift_id_fkey`: `FOREIGN KEY (counterpart_shift_id) REFERENCES att.shifts(id)`

### kind

**In everyday language:** Exchange versus bid operation; must not be inferred from missing people.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “swap” means Swap classification for kind.

Technical definition: Exchange versus bid operation; must not be inferred from missing people.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `kind: 'swap' \| 'bid';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `swap` | Swap classification for kind. | DB CHECK: shift_swaps_kind_check |
| `bid` | Bid classification for kind. | DB CHECK: shift_swaps_kind_check |

Database rules (including conditions shared with other fields):

- `shift_swaps_kind_check`: `CHECK ((kind = ANY (ARRAY['swap'::text, 'bid'::text])))`

### workflow_request_id

**In everyday language:** Approval-chain link; generic creation cannot manufacture an unattached swap.

**Why it is kept:** Keeps this record connected to the correct approval request, so related details can be checked together.

**Example:** This record points to an existing entry in requests instead of copying all of that entry’s details.

Technical definition: Approval-chain link; generic creation cannot manufacture an unattached swap.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `workflow_request_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shift_swaps_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

### applied

**In everyday language:** safe to repeat without making duplicates final-effect marker committed with both roster changes, not a substitute for workflow approval.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Idempotent final-effect marker committed with both roster changes, not a substitute for workflow approval.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `applied: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Request where the information came from timestamp.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Request provenance timestamp.

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

Table indexes and lifecycle triggers:

- Index `shift_swaps_pkey`: `CREATE UNIQUE INDEX shift_swaps_pkey ON att.shift_swaps USING btree (id)`
- Index `shift_swaps_requester`: `CREATE INDEX shift_swaps_requester ON att.shift_swaps USING btree (requester_employee_id, work_date)`

## att.shifts

Defines working times, breaks and attendance rules for each shift.

att.shifts — shift catalog; every time/threshold is a row, never code (ATT-04).

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Catalog row identity referenced by employee schemes, rosters and processed days.

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

- `shifts_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Unique business shift code, used by configuration and alternative handling when the main information is missing resolution.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Unique business shift code, used by configuration and fallback resolution.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_code_key`: `UNIQUE (code)`

### name

**In everyday language:** Human-readable shift label.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Human-readable shift label.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### start_time

**In everyday language:** Primary session start in IST wall-clock time.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A shift may start at 9 AM; attendance compares the relevant punches against the configured shift.

Technical definition: Primary session start in IST wall-clock time.

| Property | Definition |
|---|---|
| SQL type | `time without time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `start_time: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_primary_window_valid`: `CHECK (((start_time <> end_time) AND ((crosses_midnight AND (end_time < start_time)) OR ((NOT crosses_midnight) AND (end_time > start_time)))))`
- `shifts_session_split_valid`: `CHECK (((session_split IS NULL) OR ((NOT crosses_midnight) AND (session2_start IS NULL) AND (session_split > start_time) AND (session_split < end_time))))`

### end_time

**In everyday language:** Primary session end; second session, when configured, has its own end.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A shift may end at 6 PM; a shift crossing midnight needs its own configured interpretation.

Technical definition: Primary session end; second session, when configured, has its own end.

| Property | Definition |
|---|---|
| SQL type | `time without time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `end_time: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_primary_window_valid`: `CHECK (((start_time <> end_time) AND ((crosses_midnight AND (end_time < start_time)) OR ((NOT crosses_midnight) AND (end_time > start_time)))))`
- `shifts_second_session_valid`: `CHECK (((session2_start IS NULL) OR ((NOT crosses_midnight) AND (session_split IS NULL) AND (session2_start >= end_time) AND (session2_end > session2_start))))`
- `shifts_session_split_valid`: `CHECK (((session_split IS NULL) OR ((NOT crosses_midnight) AND (session2_start IS NULL) AND (session_split > start_time) AND (session_split < end_time))))`

### crosses_midnight

**In everyday language:** Primary session end is on the following calendar day; attribution stays on the shift date.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Primary session end is on the following calendar day; attribution stays on the shift date.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `crosses_midnight: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules (including conditions shared with other fields):

- `shifts_primary_window_valid`: `CHECK (((start_time <> end_time) AND ((crosses_midnight AND (end_time < start_time)) OR ((NOT crosses_midnight) AND (end_time > start_time)))))`
- `shifts_second_session_valid`: `CHECK (((session2_start IS NULL) OR ((NOT crosses_midnight) AND (session_split IS NULL) AND (session2_start >= end_time) AND (session2_end > session2_start))))`
- `shifts_session_split_valid`: `CHECK (((session_split IS NULL) OR ((NOT crosses_midnight) AND (session2_start IS NULL) AND (session_split > start_time) AND (session_split < end_time))))`

### session_split

**In everyday language:** Boundary dividing one continuous shift into two attendance halves; only one can apply at a time with separate second-session fields.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A configured 1 PM boundary separates the first and second attendance halves; HRMS must not invent a midpoint.

Technical definition: Boundary dividing one continuous shift into two attendance halves; mutually exclusive with separate second-session fields.

| Property | Definition |
|---|---|
| SQL type | `time without time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `session_split: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_second_session_valid`: `CHECK (((session2_start IS NULL) OR ((NOT crosses_midnight) AND (session_split IS NULL) AND (session2_start >= end_time) AND (session2_end > session2_start))))`
- `shifts_session_split_valid`: `CHECK (((session_split IS NULL) OR ((NOT crosses_midnight) AND (session2_start IS NULL) AND (session_split > start_time) AND (session_split < end_time))))`

### grace_in_minutes

**In everyday language:** Configured grace subtracted from late duration under docs04 §1.1; does not manufacture present-half coverage.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured grace subtracted from late duration under docs04 §1.1; does not manufacture present-half coverage.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `grace_in_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_minutes_nonnegative`: `CHECK (((grace_in_minutes >= 0) AND (grace_out_minutes >= 0) AND (break_minutes >= 0) AND (min_half_day_hours >= (0)::numeric) AND (min_full_day_hours >= min_half_day_hours)))`

### grace_out_minutes

**In everyday language:** Configured grace subtracted from early-exit duration under docs04 §1.1.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured grace subtracted from early-exit duration under docs04 §1.1.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `grace_out_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_minutes_nonnegative`: `CHECK (((grace_in_minutes >= 0) AND (grace_out_minutes >= 0) AND (break_minutes >= 0) AND (min_half_day_hours >= (0)::numeric) AND (min_full_day_hours >= min_half_day_hours)))`

### min_half_day_hours

**In everyday language:** Configured worked-hours threshold for a non-session half-day summary.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured worked-hours threshold for a non-session half-day summary.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `min_half_day_hours: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_hours_order`: `CHECK ((min_full_day_hours >= min_half_day_hours))`
- `shifts_minutes_nonnegative`: `CHECK (((grace_in_minutes >= 0) AND (grace_out_minutes >= 0) AND (break_minutes >= 0) AND (min_half_day_hours >= (0)::numeric) AND (min_full_day_hours >= min_half_day_hours)))`

### min_full_day_hours

**In everyday language:** Configured worked-hours threshold for a non-session full-day summary; cannot be less than half-day threshold.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured worked-hours threshold for a non-session full-day summary; cannot be less than half-day threshold.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `min_full_day_hours: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_hours_order`: `CHECK ((min_full_day_hours >= min_half_day_hours))`
- `shifts_minutes_nonnegative`: `CHECK (((grace_in_minutes >= 0) AND (grace_out_minutes >= 0) AND (break_minutes >= 0) AND (min_half_day_hours >= (0)::numeric) AND (min_full_day_hours >= min_half_day_hours)))`

### break_minutes

**In everyday language:** Configured break deduction when the break is unpaid.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured break deduction when the break is unpaid.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `break_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_minutes_nonnegative`: `CHECK (((grace_in_minutes >= 0) AND (grace_out_minutes >= 0) AND (break_minutes >= 0) AND (min_half_day_hours >= (0)::numeric) AND (min_full_day_hours >= min_half_day_hours)))`

### is_active

**In everyday language:** list of available choices availability for new assignments.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Catalog availability for new assignments.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewed field purpose (19 Oct 2026) |
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

**In everyday language:** list of available choices creation where the information came from.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Catalog creation provenance.

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

**In everyday language:** list of available choices modification where the information came from.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Catalog modification provenance.

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

### break_paid

**In everyday language:** Controls whether break_minutes is deducted; now connected to computation and HTTP persistence.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Controls whether break_minutes is deducted; now connected to computation and HTTP persistence.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `break_paid: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ot_start_offset_minutes

**In everyday language:** Configured delay after the final shift end before detected overtime starts; actual overtime approval/pay remains a separate flow.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Configured delay after the final shift end before detected overtime starts; actual OT approval/pay remains a separate flow.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 0 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `ot_start_offset_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_ot_offset`: `CHECK (((ot_start_offset_minutes >= 0) AND (ot_start_offset_minutes <= 240)))`

### late_slabs

**In everyday language:** Approved model for late policy tiers. Nonempty half-day penalty activation remains blocked pending the sponsor’s half-session/penalty contract.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the late slabs.

Technical definition: Approved model for late policy tiers. Nonempty half-day penalty activation remains blocked pending the sponsor’s half-session/penalty contract.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | '[]'::jsonb |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `late_slabs: Generated<unknown>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_policy_arrays`: `CHECK (((jsonb_typeof(late_slabs) = 'array'::text) AND (jsonb_typeof(early_exit_slabs) = 'array'::text)))`

### early_exit_slabs

**In everyday language:** Approved model for early-exit policy tiers; same pending contract as late_slabs. Stored representation is an array.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the early exit slabs.

Technical definition: Approved model for early-exit policy tiers; same pending contract as late_slabs. Stored representation is an array.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | '[]'::jsonb |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `early_exit_slabs: Generated<unknown>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_policy_arrays`: `CHECK (((jsonb_typeof(late_slabs) = 'array'::text) AND (jsonb_typeof(early_exit_slabs) = 'array'::text)))`

### allowance_component_code

**In everyday language:** Reserved link to a payroll earning component; consumption/link to another record validation is not complete, so nonempty activation is refused.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Reserved link to a payroll earning component; consumption/FK validation is not complete, so nonempty activation is refused.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `allowance_component_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### session2_start

**In everyday language:** Start of a separate second session; its preceding gap is not worked coverage.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A split shift may have a second work interval starting at 2 PM after a gap.

Technical definition: Start of a separate second session; its preceding gap is not worked coverage.

| Property | Definition |
|---|---|
| SQL type | `time without time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `session2_start: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_second_session_valid`: `CHECK (((session2_start IS NULL) OR ((NOT crosses_midnight) AND (session_split IS NULL) AND (session2_start >= end_time) AND (session2_end > session2_start))))`
- `shifts_session2_pair`: `CHECK (((session2_start IS NULL) = (session2_end IS NULL)))`
- `shifts_session_split_valid`: `CHECK (((session_split IS NULL) OR ((NOT crosses_midnight) AND (session2_start IS NULL) AND (session_split > start_time) AND (session_split < end_time))))`

### session2_end

**In everyday language:** End of the separate second session; also extends biometric completeness and request schedule through the final session.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** If the second interval ends at 6 PM, that is the final work boundary for the split shift.

Technical definition: End of the separate second session; also extends biometric completeness and request schedule through the final session.

| Property | Definition |
|---|---|
| SQL type | `time without time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `session2_end: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `shifts_second_session_valid`: `CHECK (((session2_start IS NULL) OR ((NOT crosses_midnight) AND (session_split IS NULL) AND (session2_start >= end_time) AND (session2_end > session2_start))))`
- `shifts_session2_pair`: `CHECK (((session2_start IS NULL) = (session2_end IS NULL)))`

Table indexes and lifecycle triggers:

- Index `shifts_code_key`: `CREATE UNIQUE INDEX shifts_code_key ON att.shifts USING btree (code)`
- Index `shifts_pkey`: `CREATE UNIQUE INDEX shifts_pkey ON att.shifts USING btree (id)`
- Trigger `shifts_updated_at` → `core.set_updated_at` (enabled flag `O`).

## att.swipe_events

Keeps original attendance punches received from devices or other approved sources.

att.swipe_events — RAW immutable swipes, monthly-partitioned (ATT-01).

Relation kind: partitioned parent table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Raw immutable event identity; partitioned uniqueness pairs identity with event timestamp.

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

- `swipe_events_pkey`: `PRIMARY KEY (id, swipe_ts)`

### employee_id

**In everyday language:** Resolved employee link to another record; not recorded retains unmatched evidence for HR reconciliation, not an invented employee.

**Why it is kept:** Keeps this record connected to the correct employee, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Resolved employee FK; NULL retains unmatched evidence for HR reconciliation, not an invented employee.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `employee_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### employee_no

**In everyday language:** Verbatim external e-code retained alongside resolved link to another record for reconciliation and duplicate-prevention.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The employee number received with the punch is matched to the employee master before it can be trusted as an employee link.

Technical definition: Verbatim external e-code retained alongside resolved FK for reconciliation and idempotency.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `employee_no: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `swipe_events_employee_no_swipe_ts_door_code_key`: `UNIQUE (employee_no, swipe_ts, door_code)`

### access_card

**In everyday language:** Source card identifier retained as evidence; employee identity resolution currently uses external e-code.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A card reference connects a device event to the card presented; it is not itself an attendance approval.

Technical definition: Source card identifier retained as evidence; employee identity resolution currently uses external e-code.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `access_card: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### shift_label

**In everyday language:** Source diagnostic label, never authority over configured roster. Documented passthrough but current RawSwipe interface/ingest does not populate it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the shift label.

Technical definition: Source diagnostic label, never authority over configured roster. Documented passthrough but current RawSwipe interface/ingest does not populate it.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `shift_label: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### swipe_ts

**In everyday language:** Device event instant; drives partition, employee-day attribution and unique event key.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A punch made at 9 AM keeps that time even if the device uploads it later.

Technical definition: Device event instant; drives partition, employee-day attribution and unique event key.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `swipe_ts: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `swipe_events_employee_no_swipe_ts_door_code_key`: `UNIQUE (employee_no, swipe_ts, door_code)`
- `swipe_events_pkey`: `PRIMARY KEY (id, swipe_ts)`

### door_code

**In everyday language:** External door identity; ties heartbeat/location and event duplicate-prevention. Cross-plant punches remain valid.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A code such as GATE-A distinguishes the gate where the punch was recorded.

Technical definition: External door identity; ties heartbeat/location and event idempotency. Cross-plant punches remain valid.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `door_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `swipe_events_employee_no_swipe_ts_door_code_key`: `UNIQUE (employee_no, swipe_ts, door_code)`

### longitude

**In everyday language:** ATT-14 mobile/geolocation evidence. Required planned scope; current RawSwipe pipeline does not carry it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Longitude describes east/west position. A recorded position does not by itself prove the employee was at an approved site.

Technical definition: ATT-14 mobile/geolocation evidence. Required planned scope; current RawSwipe pipeline does not carry it.

| Property | Definition |
|---|---|
| SQL type | `numeric(9,6)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `longitude: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### latitude

**In everyday language:** ATT-14 mobile/geolocation evidence paired with longitude. Required planned scope; current RawSwipe pipeline does not carry it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Latitude describes north/south position. It is location information and should be viewed only by authorized people.

Technical definition: ATT-14 mobile/geolocation evidence paired with longitude. Required planned scope; current RawSwipe pipeline does not carry it.

| Property | Definition |
|---|---|
| SQL type | `numeric(9,6)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `latitude: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### location_type

**In everyday language:** Source check-in location category retained for Kent export/mobile where the information came from; distinct from the employee's current assigned placement.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the location type shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Source check-in location category retained for Kent export/mobile provenance; distinct from the employee's current assigned placement.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `location_type: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### mobile_device_name

**In everyday language:** ATT-14 source mobile device diagnostic/fraud evidence. Current RawSwipe pipeline does not populate it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the mobile device name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: ATT-14 source mobile device diagnostic/fraud evidence. Current RawSwipe pipeline does not populate it.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `mobile_device_name: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### mobile_device_id

**In everyday language:** ATT-14 source mobile device identity/fraud evidence. Current RawSwipe pipeline does not populate it.

**Why it is kept:** Keeps this record connected to the correct mobile device, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: ATT-14 source mobile device identity/fraud evidence. Current RawSwipe pipeline does not populate it.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `mobile_device_id: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### swipe_type

**In everyday language:** Biometric/source event technology tag preserved by ingestion, not shift authority.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the swipe type.

Technical definition: Biometric/source event technology tag preserved by ingestion, not shift authority.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `swipe_type: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### direction

**In everyday language:** Whether the source says this was an entry punch or an exit punch. A missing direction stays unknown.

**Why it is kept:** Helps select arrival and departure without pretending an unknown punch is a confirmed exit.

**Example:** IN means entry, OUT means exit. A punch with no direction needs the configured handling for unknown punches.

Technical definition: Known IN/OUT constrains FILO boundaries; NULL permits unknown-direction fallback, not a manufactured known punch.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `direction: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### remarks

**In everyday language:** Verbatim Kent diagnostic text required for source parity; current RawSwipe contract does not carry it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A reviewer reads the saved explanation to understand the particular case before taking the next action.

Technical definition: Verbatim Kent diagnostic text required for source parity; current RawSwipe contract does not carry it.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `remarks: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### permission_reason

**In everyday language:** Source permission evidence for parity, not approval authority. Current RawSwipe contract does not carry it.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Source permission evidence for parity, not approval authority. Current RawSwipe contract does not carry it.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `permission_reason: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### signed_by

**In everyday language:** Source signatory evidence for parity, not runtime HRMS authorization. Current RawSwipe contract does not carry it.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the signed by.

Technical definition: Source signatory evidence for parity, not runtime HRMS authorization. Current RawSwipe contract does not carry it.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `signed_by: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### received_at

**In everyday language:** Source receipt instant drives source-cursor progression and clock-drift quarantine; distinct from event time and DB creation.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Source receipt instant drives source-cursor progression and clock-drift quarantine; distinct from event time and DB creation.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `received_at: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### source

**In everyday language:** Connector where the information came from separates Kent/manual/mobile sources; retained with protected against later changes event.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the source.

Technical definition: Connector provenance separates Kent/manual/mobile sources; retained with immutable event.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'kent'::text |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `source: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

**In everyday language:** Database ingestion where the information came from, distinct from device event and source receipt timestamps.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Database ingestion provenance, distinct from device event and source receipt timestamps.

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

Table indexes and lifecycle triggers:

- Index `swipe_events_emp_ts_idx`: `CREATE INDEX swipe_events_emp_ts_idx ON ONLY att.swipe_events USING btree (employee_id, swipe_ts)`
- Index `swipe_events_employee_no_swipe_ts_door_code_key`: `CREATE UNIQUE INDEX swipe_events_employee_no_swipe_ts_door_code_key ON ONLY att.swipe_events USING btree (employee_no, swipe_ts, door_code)`
- Index `swipe_events_pkey`: `CREATE UNIQUE INDEX swipe_events_pkey ON ONLY att.swipe_events USING btree (id, swipe_ts)`
- Index `swipe_events_ts_brin`: `CREATE INDEX swipe_events_ts_brin ON ONLY att.swipe_events USING brin (swipe_ts)`
- Trigger `swipe_events_enqueue_recompute` → `att.enqueue_recompute` (enabled flag `O`).
- Trigger `swipe_events_immutable` → `att.swipe_events_immutable` (enabled flag `O`).

