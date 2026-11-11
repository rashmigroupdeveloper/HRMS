# pay — field dictionary

340 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## pay.arrears

Records salary adjustments relating to an earlier payroll period.

Arrears records; consult the field definitions and governing module specification.

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

- `arrears_pkey`: `PRIMARY KEY (id)`

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

- `arrears_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### source_salary_id

**In everyday language:** Identifies the earlier salary arrangement connected to this record.

**Why it is kept:** Keeps this record connected to the correct earlier salary arrangement, so related details can be checked together.

**Example:** This record points to an existing entry in employee salaries instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s source salary id to FOREIGN KEY (source_salary_id) REFERENCES pay.employee_salaries(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `source_salary_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `arrears_source_salary_id_fkey`: `FOREIGN KEY (source_salary_id) REFERENCES pay.employee_salaries(id)`

### for_month

**In everyday language:** The earlier salary month to which this adjustment belongs.

**Why it is kept:** Separates the month being corrected from the month in which the adjustment is paid.

**Example:** An adjustment for October can be paid in November while still identifying October as the original period.

Technical definition: Original payroll period to which this arrears adjustment relates, separate from the paying run.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `for_month: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### paid_in_run_id

**In everyday language:** Identifies the payroll calculation that paid the amount connected to this record.

**Why it is kept:** Keeps this record connected to the correct payroll calculation that paid the amount, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s paid in run id to FOREIGN KEY (paid_in_run_id) REFERENCES pay.payroll_runs(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `paid_in_run_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `arrears_paid_in_run_id_fkey`: `FOREIGN KEY (paid_in_run_id) REFERENCES pay.payroll_runs(id)`

### component_code

**In everyday language:** Salary-component business code used to classify this amount or accounting mapping.

**Why it is kept:** Keeps this record connected to the correct pay head, so related details can be checked together.

**Example:** This record points to an existing entry in salary components instead of copying all of that entry’s details.

Technical definition: Salary-component business code used to classify this amount or accounting mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `component_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `arrears_component_code_fkey`: `FOREIGN KEY (component_code) REFERENCES pay.salary_components(code)`

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

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

- Index `arrears_emp_month_idx`: `CREATE INDEX arrears_emp_month_idx ON pay.arrears USING btree (employee_id, for_month)`
- Index `arrears_pkey`: `CREATE UNIQUE INDEX arrears_pkey ON pay.arrears USING btree (id)`

## pay.bank_batches

Groups salary payments into bank-payment files.

Bank batches records; consult the field definitions and governing module specification.

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

- `bank_batches_pkey`: `PRIMARY KEY (id)`

### run_id

**In everyday language:** Identifies the payroll calculation connected to this record.

**Why it is kept:** Keeps this record connected to the correct payroll calculation, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `run_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bank_batches_run_id_fkey`: `FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id)`

### file_document_id

**In everyday language:** Identifies file document connected to this record.

**Why it is kept:** Keeps this record connected to the correct file document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s file document id to FOREIGN KEY (file_document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `file_document_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bank_batches_file_document_id_fkey`: `FOREIGN KEY (file_document_id) REFERENCES core.documents(id)`

### total_amount

**In everyday language:** Aggregate monetary amount represented by the batch, in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Aggregate monetary amount represented by the batch, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(16,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `total_amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### record_count

**In everyday language:** Number of records represented or accessed in this batch/event.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Number of records represented or accessed in this batch/event.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `record_count: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### generated_by

**In everyday language:** Identifies generated by connected to this record.

**Why it is kept:** Keeps this record connected to the correct generated by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s generated by to FOREIGN KEY (generated_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `generated_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bank_batches_generated_by_fkey`: `FOREIGN KEY (generated_by) REFERENCES core.users(id)`

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

### superseded_at

**In everyday language:** Null while this is the one active file for the run. A later file supersedes it.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Null while this is the one active file for the run. A later file supersedes it.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:1705 |
| Code declaration | `superseded_at: ColumnType<Date \| null, never, Date \| string \| null>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `bank_batches_one_active`: `CREATE UNIQUE INDEX bank_batches_one_active ON pay.bank_batches USING btree (run_id) WHERE (superseded_at IS NULL)`
- Index `bank_batches_pkey`: `CREATE UNIQUE INDEX bank_batches_pkey ON pay.bank_batches USING btree (id)`

## pay.budget_categories

Breaks a reimbursement budget into expense categories and their allowances.

Budget categories records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_categories_pkey`: `PRIMARY KEY (id)`

### budget_id

**In everyday language:** Identifies budget connected to this record.

**Why it is kept:** Keeps this record connected to the correct budget, so related details can be checked together.

**Example:** This record points to an existing entry in budgets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s budget id to FOREIGN KEY (budget_id) REFERENCES pay.budgets(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `budget_id: number;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_categories_budget_id_claim_type_id_key`: `UNIQUE (budget_id, claim_type_id)`
- `budget_categories_budget_id_fkey`: `FOREIGN KEY (budget_id) REFERENCES pay.budgets(id) ON DELETE CASCADE`

### claim_type_id

**In everyday language:** Identifies claim type connected to this record.

**Why it is kept:** Keeps this record connected to the correct claim type, so related details can be checked together.

**Example:** This record points to an existing entry in claim types instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_type_id: number;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_categories_budget_id_claim_type_id_key`: `UNIQUE (budget_id, claim_type_id)`
- `budget_categories_claim_type_id_fkey`: `FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id)`

### allowance

**In everyday language:** Rupee allowance allocated to this claim category within its budget; this is an amount, not a yes/no choice flag.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Rupee allowance allocated to this claim category within its budget; this is an amount, not a boolean flag.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `allowance: Numeric;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_categories_allowance_check`: `CHECK ((allowance >= (0)::numeric))`

Table indexes and lifecycle triggers:

- Index `budget_categories_budget_id_claim_type_id_key`: `CREATE UNIQUE INDEX budget_categories_budget_id_claim_type_id_key ON pay.budget_categories USING btree (budget_id, claim_type_id)`
- Index `budget_categories_pkey`: `CREATE UNIQUE INDEX budget_categories_pkey ON pay.budget_categories USING btree (id)`

## pay.budgets

Tracks proposed and approved expense budgets.

The budget IS the travel request (live recon §1): the EMS `trips` collection
is empty because IBudget carries the itinerary itself.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_pkey`: `PRIMARY KEY (id)`

### reference

**In everyday language:** Human-readable business reference used to identify this request.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Human-readable business reference used to identify this request.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `reference: string;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_reference_key`: `UNIQUE (reference)`

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
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
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `purpose: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### cost_center_id

**In everyday language:** Identifies cost center connected to this record.

**Why it is kept:** Keeps this record connected to the correct cost center, so related details can be checked together.

**Example:** This record points to an existing entry in cost centers instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s cost center id to FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `cost_center_id: number \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_cost_center_id_fkey`: `FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id)`

### period_from

**In everyday language:** First calendar date of the covered period.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First calendar date of the covered period.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `period_from: DateOnly;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_period_ordered`: `CHECK ((period_to >= period_from))`

### period_to

**In everyday language:** Last calendar date of the covered period; see constraints and service for boundary validation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Last calendar date of the covered period; see constraints and service for boundary validation.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `period_to: DateOnly;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_period_ordered`: `CHECK ((period_to >= period_from))`

### travel_type

**In everyday language:** Domestic or international travel classification used for entitlement and routing.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “domestic” means Domestic classification for travel type.

Technical definition: Domestic or international travel classification used for entitlement and routing.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `travel_type: TravelType \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `domestic` | Domestic classification for travel type. | DB CHECK: budgets_travel_type_check |
| `international` | International classification for travel type. | DB CHECK: budgets_travel_type_check |

Database rules (including conditions shared with other fields):

- `budgets_travel_type_check`: `CHECK ((travel_type = ANY (ARRAY['domestic'::text, 'international'::text])))`

### region

**In everyday language:** Travel region used when selecting applicable budget/entitlement rules.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the region shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Travel region used when selecting applicable budget/entitlement rules.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `region: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### from_location

**In everyday language:** Origin location of the proposed travel.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the from location shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Origin location of the proposed travel.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `from_location: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### to_location

**In everyday language:** Destination location of the proposed travel.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the to location shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Destination location of the proposed travel.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `to_location: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### travel_start

**In everyday language:** First planned date of travel.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First planned date of travel.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `travel_start: DateOnly \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_travel_dates_ordered`: `CHECK (((travel_start IS NULL) OR (travel_end IS NULL) OR (travel_end >= travel_start)))`

### travel_end

**In everyday language:** Last planned date of travel.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Last planned date of travel.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `travel_end: DateOnly \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_travel_dates_ordered`: `CHECK (((travel_start IS NULL) OR (travel_end IS NULL) OR (travel_end >= travel_start)))`

### nights

**In everyday language:** Number of hotel nights budgeted for the journey.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Number of hotel nights budgeted for the journey.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `nights: number \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_nights_check`: `CHECK (((nights IS NULL) OR (nights >= 0)))`

### desk_books_air

**In everyday language:** Whether the travel desk is responsible for flight booking.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether the travel desk is responsible for flight booking.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `desk_books_air: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### desk_books_hotel

**In everyday language:** Whether the travel desk is responsible for hotel booking.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether the travel desk is responsible for hotel booking.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `desk_books_hotel: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### desk_books_visa

**In everyday language:** Whether the travel desk is responsible for visa arrangements.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether the travel desk is responsible for visa arrangements.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `desk_books_visa: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### own_arrangement_reason

**In everyday language:** Explanation for arrangements made outside the travel desk.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Explanation for arrangements made outside the travel desk.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `own_arrangement_reason: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### limit_exceed_reason

**In everyday language:** Justification for exceeding the configured entitlement limit.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Justification for exceeding the configured entitlement limit.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `limit_exceed_reason: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### allowance

**In everyday language:** Requested total. The history of additions and deductions draws on approved_allowance once approved.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Requested total. The ledger draws on `approved_allowance` once approved.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | backend/src/core/db/types.pay-claims.ts:69 |
| Code declaration | `allowance: Numeric;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_allowance_positive`: `CHECK ((allowance > (0)::numeric))`

### approved_allowance

**In everyday language:** Approved allowance amount for the budget.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Approved allowance amount for the budget.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `approved_allowance: Numeric \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_approved_allowance_check`: `CHECK (((approved_allowance IS NULL) OR (approved_allowance >= (0)::numeric)))`
- `budgets_approved_allowance_present`: `CHECK (((status <> 'approved'::text) OR (approved_allowance IS NOT NULL)))`

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
| Code declaration | `currency: Generated<string>;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
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
| SQL type | `numeric(14,6)` |
| Required | Yes |
| Default | 1 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fx_rate_to_inr: DefaultedNumeric;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_fx_rate_to_inr_check`: `CHECK ((fx_rate_to_inr > (0)::numeric))`

### fx_rate_date

**In everyday language:** Calendar date associated with the exchange-rate copy saved at that point in time.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date associated with the exchange-rate snapshot.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fx_rate_date: DateOnly \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

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
| Code declaration | `status: Generated<BudgetStatus>;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: budgets_status_check |
| `pending` | Awaiting the required decision or next action | DB CHECK: budgets_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: budgets_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: budgets_status_check |
| `closed` | Record is closed in this lifecycle. | DB CHECK: budgets_status_check |

Database rules (including conditions shared with other fields):

- `budgets_approval_pairs`: `CHECK (((status <> 'approved'::text) OR ((approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL))))`
- `budgets_approved_allowance_present`: `CHECK (((status <> 'approved'::text) OR (approved_allowance IS NOT NULL)))`
- `budgets_rejection_reasoned`: `CHECK (((status <> 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)))`
- `budgets_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'closed'::text])))`

### overspend_allowed

**In everyday language:** Whether the approved budget permits spending above its normal limit.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether the approved budget permits spending above its normal limit.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `overspend_allowed: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_approval_pairs`: `CHECK (((status <> 'approved'::text) OR ((approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL))))`
- `budgets_approved_by_user_id_fkey`: `FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id)`

### approved_at

**In everyday language:** Date and time of approved for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of approved for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `approved_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_approval_pairs`: `CHECK (((status <> 'approved'::text) OR ((approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL))))`

### rejection_reason

**In everyday language:** Explanation recorded when the request is rejected.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Explanation recorded when the request is rejected.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `rejection_reason: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_rejection_reasoned`: `CHECK (((status <> 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)))`

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `budgets_company_idx`: `CREATE INDEX budgets_company_idx ON pay.budgets USING btree (company_id, period_from)`
- Index `budgets_employee_idx`: `CREATE INDEX budgets_employee_idx ON pay.budgets USING btree (employee_id, status)`
- Index `budgets_pkey`: `CREATE UNIQUE INDEX budgets_pkey ON pay.budgets USING btree (id)`
- Index `budgets_reference_key`: `CREATE UNIQUE INDEX budgets_reference_key ON pay.budgets USING btree (reference)`
- Trigger `budgets_updated_at` → `core.set_updated_at` (enabled flag `O`).

## pay.claim_bills

Keeps bills submitted to support reimbursement claims.

Claim bills records; consult the field definitions and governing module specification.

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

- `claim_bills_pkey`: `PRIMARY KEY (id)`

### claim_id

**In everyday language:** Identifies the expense claim connected to this record.

**Why it is kept:** Keeps this record connected to the correct expense claim, so related details can be checked together.

**Example:** This record points to an existing entry in claims instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE.

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

- `claim_bills_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE`

### document_id

**In everyday language:** Identifies document connected to this record.

**Why it is kept:** Keeps this record connected to the correct document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s document id to FOREIGN KEY (document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `document_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_bills_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES core.documents(id)`

### bill_no

**In everyday language:** Supplier's bill or receipt reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Supplier's bill or receipt reference.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `bill_no: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bill_date

**In everyday language:** Calendar date printed on the bill or receipt.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date printed on the bill or receipt.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `bill_date: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### verified

**In everyday language:** Legacy bill verification flag; review current verified_by/verified_at authority before relying on this flag alone.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Legacy bill verification flag; review current verified_by/verified_at authority before relying on this flag alone.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `verified: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### verified_by

**In everyday language:** Identifies verified by connected to this record.

**Why it is kept:** Keeps this record connected to the correct verified by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s verified by to FOREIGN KEY (verified_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `verified_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_bills_verified_by_fkey`: `FOREIGN KEY (verified_by) REFERENCES core.users(id)`

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

- Index `claim_bills_pkey`: `CREATE UNIQUE INDEX claim_bills_pkey ON pay.claim_bills USING btree (id)`

## pay.claim_entitlements

Records an employee’s configured reimbursement entitlement.

Claim entitlements records; consult the field definitions and governing module specification.

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

- `claim_entitlements_pkey`: `PRIMARY KEY (id)`

### claim_type_id

**In everyday language:** Identifies claim type connected to this record.

**Why it is kept:** Keeps this record connected to the correct claim type, so related details can be checked together.

**Example:** This record points to an existing entry in claim types instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_type_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_entitlements_claim_type_id_fkey`: `FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id)`

### grade_id

**In everyday language:** Identifies grade connected to this record.

**Why it is kept:** Keeps this record connected to the correct grade, so related details can be checked together.

**Example:** This record points to an existing entry in grades instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s grade id to FOREIGN KEY (grade_id) REFERENCES core.grades(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `grade_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_entitlements_grade_id_fkey`: `FOREIGN KEY (grade_id) REFERENCES core.grades(id)`

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### effective_from

**In everyday language:** Date from which this version or rule applies.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Date from which this version or rule applies.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `effective_from: Timestamp;` |
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

- Index `claim_entitlements_pkey`: `CREATE UNIQUE INDEX claim_entitlements_pkey ON pay.claim_entitlements USING btree (id)`

## pay.claim_lines

Keeps the individual expenses within a reimbursement claim.

Claim lines records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_lines_pkey`: `PRIMARY KEY (id)`

### claim_id

**In everyday language:** Identifies the expense claim connected to this record.

**Why it is kept:** Keeps this record connected to the correct expense claim, so related details can be checked together.

**Example:** This record points to an existing entry in claims instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_id: number;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_lines_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE`

### claim_type_id

**In everyday language:** Identifies claim type connected to this record.

**Why it is kept:** Keeps this record connected to the correct claim type, so related details can be checked together.

**Example:** This record points to an existing entry in claim types instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_type_id: number;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_lines_claim_type_id_fkey`: `FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id)`

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### spent_on

**In everyday language:** Calendar date on which the claimed expense was incurred.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date on which the claimed expense was incurred.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `spent_on: DateOnly;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bill_no

**In everyday language:** Supplier's bill or receipt reference.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Supplier's bill or receipt reference.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `bill_no: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### original_amount

**In everyday language:** Expense amount expressed in its original currency before conversion to INR.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Expense amount expressed in its original currency before conversion to INR.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `original_amount: Numeric;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_lines_original_amount_check`: `CHECK ((original_amount > (0)::numeric))`

### original_currency

**In everyday language:** Currency code of the expense before INR conversion.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An overseas receipt may be in USD before it is converted to Indian rupees.

Technical definition: Currency code of the expense before INR conversion.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'INR'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `original_currency: Generated<string>;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
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
| SQL type | `numeric(14,6)` |
| Required | Yes |
| Default | 1 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fx_rate_to_inr: DefaultedNumeric;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_lines_fx_rate_to_inr_check`: `CHECK ((fx_rate_to_inr > (0)::numeric))`

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: Numeric;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_lines_amount_check`: `CHECK ((amount > (0)::numeric))`

### document_path

**In everyday language:** Private stored-document/object key for supporting evidence; not a public download URL.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A bill can be linked to a privately stored receipt so the authorized reviewer can inspect its evidence.

Technical definition: Private stored-document/object key for supporting evidence; not a public download URL.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `document_path: string \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `claim_lines_claim_idx`: `CREATE INDEX claim_lines_claim_idx ON pay.claim_lines USING btree (claim_id)`
- Index `claim_lines_pkey`: `CREATE UNIQUE INDEX claim_lines_pkey ON pay.claim_lines USING btree (id)`

## pay.claim_reservations

Tracks amounts reserved against or released back to expense budgets.

Append-only. A release is a NEW row, never an update to the reserve row.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_reservations_pkey`: `PRIMARY KEY (id)`

### budget_id

**In everyday language:** Identifies budget connected to this record.

**Why it is kept:** Keeps this record connected to the correct budget, so related details can be checked together.

**Example:** This record points to an existing entry in budgets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s budget id to FOREIGN KEY (budget_id) REFERENCES pay.budgets(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `budget_id: number;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_reservations_budget_id_fkey`: `FOREIGN KEY (budget_id) REFERENCES pay.budgets(id)`

### claim_id

**In everyday language:** Identifies the expense claim connected to this record.

**Why it is kept:** Keeps this record connected to the correct expense claim, so related details can be checked together.

**Example:** This record points to an existing entry in claims instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_id: number;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_reservations_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES pay.claims(id)`

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
| Code declaration | `movement: ReservationMovement;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `reserve` | Reserve classification for movement. | DB CHECK: claim_reservations_movement_check |
| `release` | Release classification for movement. | DB CHECK: claim_reservations_movement_check |

Database rules (including conditions shared with other fields):

- `claim_reservations_movement_check`: `CHECK ((movement = ANY (ARRAY['reserve'::text, 'release'::text])))`

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: Numeric;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_reservations_amount_check`: `CHECK ((amount > (0)::numeric))`

### by_category

**In everyday language:** Per-category breakdown, mirroring the live budgetReserved{} copy saved at that point in time.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the by category.

Technical definition: Per-category breakdown, mirroring the live budgetReserved{} snapshot.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | backend/src/core/db/types.pay-claims.ts:144 |
| Code declaration | `by_category: Record<string, number> \| null;` |
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_reservations_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `claim_reservations_budget_idx`: `CREATE INDEX claim_reservations_budget_idx ON pay.claim_reservations USING btree (budget_id, occurred_at)`
- Index `claim_reservations_claim_idx`: `CREATE INDEX claim_reservations_claim_idx ON pay.claim_reservations USING btree (claim_id)`
- Index `claim_reservations_pkey`: `CREATE UNIQUE INDEX claim_reservations_pkey ON pay.claim_reservations USING btree (id)`
- Trigger `claim_reservations_immutable` → `pay.claim_reservations_immutable` (enabled flag `O`).

## pay.claim_types

Defines reimbursement categories and their supporting-document and tax policies.

Claim types records; consult the field definitions and governing module specification.

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

- `claim_types_pkey`: `PRIMARY KEY (id)`

### code

**In everyday language:** Stable machine-readable business code identifying this list of available choices entry.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable machine-readable business code identifying this catalog entry.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_types_code_key`: `UNIQUE (code)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### requires_bill

**In everyday language:** Bill-required flag retained in the claim-type list of available choices; distinct from bill_required and subject to the current service's authority.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Bill-required flag retained in the claim-type catalog; distinct from bill_required and subject to the current service's authority.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `requires_bill: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_taxable

**In everyday language:** Taxability flag retained in the claim-type list of available choices; distinct from conditional substantiation policy.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Taxability flag retained in the claim-type catalog; distinct from conditional substantiation policy.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `is_taxable: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

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
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sort_order

**In everyday language:** Numeric ordering used when displaying list of available choices entries.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An entry with order 1 can be shown before an entry with order 2.

Technical definition: Numeric ordering used when displaying catalog entries.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 100 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `sort_order: Generated<number>;` |
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

### entitlement_basis

**In everyday language:** Basis on which the claim type's entitlement is evaluated.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the entitlement basis shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Basis on which the claim type's entitlement is evaluated.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'monthly'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `entitlement_basis: ClaimBasis;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bill_required

**In everyday language:** Claim-type policy indicating whether supporting bill evidence is required; distinct from legacy requires_bill.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Claim-type policy indicating whether supporting bill evidence is required; distinct from legacy requires_bill.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `bill_required: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### taxable_if_unsubstantiated

**In everyday language:** Whether unsupported reimbursement becomes taxable under the configured claim-type policy.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether unsupported reimbursement becomes taxable under the configured claim-type policy.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `taxable_if_unsubstantiated: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### payout_component_code

**In everyday language:** Configured salary-component reference retained for the older combined-payment model; current reimbursements use independent batches.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Configured salary-component reference retained for the older combined-payment model; current reimbursements use independent batches.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'REIMB'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `payout_component_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `claim_types_code_key`: `CREATE UNIQUE INDEX claim_types_code_key ON pay.claim_types USING btree (code)`
- Index `claim_types_pkey`: `CREATE UNIQUE INDEX claim_types_pkey ON pay.claim_types USING btree (id)`
- Trigger `claim_types_updated_at` → `core.set_updated_at` (enabled flag `O`).

## pay.claims

Tracks reimbursement requests, review decisions and payment links.

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

### reference

**In everyday language:** Human-readable business reference used to identify this request.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Human-readable business reference used to identify this request.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `reference: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_reference_key`: `UNIQUE (reference)`

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

### funding_kind

**In everyday language:** Whether the claim draws on a budget or another configured entitlement source.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “budget” means Budget classification for funding kind.

Technical definition: Whether the claim draws on a budget or another configured entitlement source.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'budget'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `funding_kind: Generated<'budget' \| 'entitlement'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `budget` | Budget classification for funding kind. | DB CHECK: claims_funding_kind_check |
| `entitlement` | Entitlement classification for funding kind. | DB CHECK: claims_funding_kind_check |

Database rules (including conditions shared with other fields):

- `claims_budget_present`: `CHECK (((funding_kind <> 'budget'::text) OR (budget_id IS NOT NULL)))`
- `claims_funding_kind_check`: `CHECK ((funding_kind = ANY (ARRAY['budget'::text, 'entitlement'::text])))`

### budget_id

**In everyday language:** Identifies budget connected to this record.

**Why it is kept:** Keeps this record connected to the correct budget, so related details can be checked together.

**Example:** This record points to an existing entry in budgets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s budget id to FOREIGN KEY (budget_id) REFERENCES pay.budgets(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `budget_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_budget_id_fkey`: `FOREIGN KEY (budget_id) REFERENCES pay.budgets(id)`
- `claims_budget_present`: `CHECK (((funding_kind <> 'budget'::text) OR (budget_id IS NOT NULL)))`

### reserved_budget_id

**In everyday language:** Identifies reserved budget connected to this record.

**Why it is kept:** Keeps this record connected to the correct reserved budget, so related details can be checked together.

**Example:** This record points to an existing entry in budgets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s reserved budget id to FOREIGN KEY (reserved_budget_id) REFERENCES pay.budgets(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `reserved_budget_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_reserved_budget_id_fkey`: `FOREIGN KEY (reserved_budget_id) REFERENCES pay.budgets(id)`

### period_from

**In everyday language:** First calendar date of the covered period.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First calendar date of the covered period.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `period_from: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_period_ordered`: `CHECK ((period_to >= period_from))`

### period_to

**In everyday language:** Last calendar date of the covered period; see constraints and service for boundary validation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Last calendar date of the covered period; see constraints and service for boundary validation.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `period_to: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_period_ordered`: `CHECK ((period_to >= period_from))`

### claimed_amount

**In everyday language:** Total amount requested by the claimant, in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Total amount requested by the claimant, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `claimed_amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_approved_within_claimed`: `CHECK (((approved_amount IS NULL) OR (approved_amount <= claimed_amount)))`
- `claims_claimed_amount_check`: `CHECK ((claimed_amount > (0)::numeric))`
- `claims_settlement_within_claim`: `CHECK (((settlement_amount IS NULL) OR (settlement_amount <= claimed_amount)))`

### approved_amount

**In everyday language:** Amount authorized after review, in rupees; may differ from claimed amount.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Amount authorized after review, in rupees; may differ from claimed amount.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `approved_amount: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_approved_amount_check`: `CHECK (((approved_amount IS NULL) OR (approved_amount >= (0)::numeric)))`
- `claims_approved_within_claimed`: `CHECK (((approved_amount IS NULL) OR (approved_amount <= claimed_amount)))`

### display_currency

**In everyday language:** Currency selected for presenting the claim to users.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A claim can be shown in the selected currency while retaining the amounts and exchange-rate details needed for checking.

Technical definition: Currency selected for presenting the claim to users.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'INR'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `display_currency: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### fx_rates_to_inr

**In everyday language:** copy saved at that point in time mapping original currencies to INR conversion rates used for this claim.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** A claim with multiple currencies can save a separate INR conversion rate for each currency.

Technical definition: Snapshot mapping original currencies to INR conversion rates used for this claim.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fx_rates_to_inr: Record<string, number> \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### fx_rate_date

**In everyday language:** Calendar date associated with the exchange-rate copy saved at that point in time.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date associated with the exchange-rate snapshot.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fx_rate_date: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

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
| Code declaration | `settlement_status: Generated<'unsettled' \| 'settled'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `unsettled` | Record is unsettled in this lifecycle. | DB CHECK: claims_settlement_status_check |
| `settled` | Record is settled in this lifecycle. | DB CHECK: claims_settlement_status_check |

Database rules (including conditions shared with other fields):

- `claims_settled_pairs`: `CHECK (((settlement_status <> 'settled'::text) OR ((settlement_mode IS NOT NULL) AND (settlement_amount IS NOT NULL) AND (settled_by_user_id IS NOT NULL) AND (settled_at IS NOT NULL))))`
- `claims_settlement_status_check`: `CHECK ((settlement_status = ANY (ARRAY['unsettled'::text, 'settled'::text])))`

### settlement_mode

**In everyday language:** Configured payment or recovery method for settling the claim.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “AUTO” means Auto.

Technical definition: Configured payment or recovery method for settling the claim.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `settlement_mode: 'AUTO' \| 'MANUAL' \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `AUTO` | Auto. | DB CHECK: claims_settlement_mode_check |
| `MANUAL` | Manual. | DB CHECK: claims_settlement_mode_check |

Database rules (including conditions shared with other fields):

- `claims_settled_pairs`: `CHECK (((settlement_status <> 'settled'::text) OR ((settlement_mode IS NOT NULL) AND (settlement_amount IS NOT NULL) AND (settled_by_user_id IS NOT NULL) AND (settled_at IS NOT NULL))))`
- `claims_settlement_mode_check`: `CHECK ((settlement_mode = ANY (ARRAY['AUTO'::text, 'MANUAL'::text])))`

### settlement_amount

**In everyday language:** Amount recorded for settlement in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Amount recorded for settlement in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `settlement_amount: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_settled_pairs`: `CHECK (((settlement_status <> 'settled'::text) OR ((settlement_mode IS NOT NULL) AND (settlement_amount IS NOT NULL) AND (settled_by_user_id IS NOT NULL) AND (settled_at IS NOT NULL))))`
- `claims_settlement_amount_check`: `CHECK (((settlement_amount IS NULL) OR (settlement_amount >= (0)::numeric)))`
- `claims_settlement_within_claim`: `CHECK (((settlement_amount IS NULL) OR (settlement_amount <= claimed_amount)))`

### net_payable

**In everyday language:** Net rupee amount due after the applicable earnings, adjustments and deductions.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Net rupee amount due after the applicable earnings, adjustments and deductions.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `net_payable: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### settled_by_user_id

**In everyday language:** Identifies settled by user connected to this record.

**Why it is kept:** Keeps this record connected to the correct settled by user, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s settled by user id to FOREIGN KEY (settled_by_user_id) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `settled_by_user_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_settled_by_user_id_fkey`: `FOREIGN KEY (settled_by_user_id) REFERENCES core.users(id)`
- `claims_settled_pairs`: `CHECK (((settlement_status <> 'settled'::text) OR ((settlement_mode IS NOT NULL) AND (settlement_amount IS NOT NULL) AND (settled_by_user_id IS NOT NULL) AND (settled_at IS NOT NULL))))`

### settled_at

**In everyday language:** Date and time of settled for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of settled for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `settled_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_settled_pairs`: `CHECK (((settlement_status <> 'settled'::text) OR ((settlement_mode IS NOT NULL) AND (settlement_amount IS NOT NULL) AND (settled_by_user_id IS NOT NULL) AND (settled_at IS NOT NULL))))`

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
| Code declaration | `status: Generated<ClaimStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: claims_status_check |
| `submitted` | Record is submitted in this lifecycle. | DB CHECK: claims_status_check |
| `sent_back` | Returned to requester for correction and resubmission | DB CHECK: claims_status_check |
| `pending` | Awaiting the required decision or next action | DB CHECK: claims_status_check |
| `verified` | Record is verified in this lifecycle. | DB CHECK: claims_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: claims_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: claims_status_check |
| `paid` | Payment recorded as completed | DB CHECK: claims_status_check |
| `settled` | Record is settled in this lifecycle. | DB CHECK: claims_status_check |

Database rules (including conditions shared with other fields):

- `claims_rejection_reasoned`: `CHECK (((status <> 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)))`
- `claims_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'sent_back'::text, 'pending'::text, 'verified'::text, 'approved'::text, 'rejected'::text, 'paid'::text, 'settled'::text])))`

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

### rejection_reason

**In everyday language:** Explanation recorded when the request is rejected.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Explanation recorded when the request is rejected.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `rejection_reason: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_rejection_reasoned`: `CHECK (((status <> 'rejected'::text) OR (length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)))`

### submitted_at

**In everyday language:** Date and time of submitted for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of submitted for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `submitted_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### decided_at

**In everyday language:** Date and time of decided for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of decided for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `decided_at: Timestamp \| null;` |
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

### claim_type_id

**In everyday language:** Identifies claim type connected to this record.

**Why it is kept:** Keeps this record connected to the correct claim type, so related details can be checked together.

**Example:** This record points to an existing entry in claim types instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_type_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_claim_type_id_fkey`: `FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id)`

### advance_loan_id

**In everyday language:** Identifies advance loan connected to this record.

**Why it is kept:** Keeps this record connected to the correct advance loan, so related details can be checked together.

**Example:** This record points to an existing entry in loans instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s advance loan id to FOREIGN KEY (advance_loan_id) REFERENCES pay.loans(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `advance_loan_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_advance_loan_id_fkey`: `FOREIGN KEY (advance_loan_id) REFERENCES pay.loans(id)`

### paid_in_run_id

**In everyday language:** The older salary run through which this claim was paid, where such a historical link exists.

**Why it is kept:** Preserves the explanation of historical combined payments.

**Example:** An old claim can be traced to its original salary payment without creating another payment.

Technical definition: Historical combined-payment payroll-run destination. New independent reimbursements do not populate this link; retained for reconciliation without inferred backfill.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `paid_in_run_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_independent_payment_target`: `CHECK ((num_nonnulls(paid_in_run_id, paid_in_batch_id, reimbursement_batch_id) <= 1))`
- `claims_paid_in_run_id_fkey`: `FOREIGN KEY (paid_in_run_id) REFERENCES pay.payroll_runs(id)`

### paid_in_batch_id

**In everyday language:** The older salary bank-payment batch linked to this claim, where recorded.

**Why it is kept:** Supports checking historical combined payments.

**Example:** Finance compares an old claim with the bank batch that paid it.

Technical definition: Historical salary bank-batch destination. New reimbursements use reimbursement_batch_id; legacy links must not cause automatic re-payment.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `paid_in_batch_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_independent_payment_target`: `CHECK ((num_nonnulls(paid_in_run_id, paid_in_batch_id, reimbursement_batch_id) <= 1))`
- `claims_paid_in_batch_id_fkey`: `FOREIGN KEY (paid_in_batch_id) REFERENCES pay.bank_batches(id)`

### reimbursement_batch_id

**In everyday language:** The group of reimbursement payments in which this approved claim is being paid.

**Why it is kept:** Connects an expense repayment to its own payment record, separately from salary.

**Example:** An approved expense claim appears in a reimbursement payment batch rather than becoming a salary item.

Technical definition: Independent reimbursement batch paying this claim. Kept separate from salary runs and salary bank batches; at most one legacy/new destination is permitted.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `reimbursement_batch_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_independent_payment_target`: `CHECK ((num_nonnulls(paid_in_run_id, paid_in_batch_id, reimbursement_batch_id) <= 1))`
- `claims_reimbursement_batch_id_fkey`: `FOREIGN KEY (reimbursement_batch_id) REFERENCES pay.reimbursement_batches(id)`

Table indexes and lifecycle triggers:

- Index `claims_budget_idx`: `CREATE INDEX claims_budget_idx ON pay.claims USING btree (budget_id)`
- Index `claims_emp_idx`: `CREATE INDEX claims_emp_idx ON pay.claims USING btree (employee_id, status)`
- Index `claims_employee_idx`: `CREATE INDEX claims_employee_idx ON pay.claims USING btree (employee_id, status)`
- Index `claims_one_live_per_budget`: `CREATE UNIQUE INDEX claims_one_live_per_budget ON pay.claims USING btree (budget_id) WHERE ((budget_id IS NOT NULL) AND (status <> 'rejected'::text))`
- Index `claims_pkey`: `CREATE UNIQUE INDEX claims_pkey ON pay.claims USING btree (id)`
- Index `claims_reference_key`: `CREATE UNIQUE INDEX claims_reference_key ON pay.claims USING btree (reference)`
- Trigger `claims_updated_at` → `core.set_updated_at` (enabled flag `O`).

## pay.employee_salaries

Keeps salary arrangements and the dates on which each version applies.

Employee salaries records; consult the field definitions and governing module specification.

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

- `employee_salaries_pkey`: `PRIMARY KEY (id)`

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

- `employee_salaries_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `no_overlapping_salaries`: `EXCLUDE USING gist (employee_id WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&)`

### structure_id

**In everyday language:** Identifies the salary arrangement connected to this record.

**Why it is kept:** Keeps this record connected to the correct salary arrangement, so related details can be checked together.

**Example:** This record points to an existing entry in salary structures instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s structure id to FOREIGN KEY (structure_id) REFERENCES pay.salary_structures(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `structure_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_salaries_structure_id_fkey`: `FOREIGN KEY (structure_id) REFERENCES pay.salary_structures(id)`

### effective_from

**In everyday language:** Date from which this version or rule applies.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Date from which this version or rule applies.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `effective_from: Date;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `valid_salary_dates`: `CHECK ((effective_from < effective_to))`

### effective_to

**In everyday language:** End of this version's applicability; not recorded represents no recorded end. Exact range/exclusion rules appear in constraints.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: End of this version's applicability; NULL represents no recorded end. Exact range/exclusion rules appear in constraints.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | '9999-12-31'::date |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `effective_to: Generated<Date>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `valid_salary_dates`: `CHECK ((effective_from < effective_to))`

### annual_ctc

**In everyday language:** The employee’s annual cost to the company under this salary arrangement.

**Why it is kept:** Records the annual employment-cost basis for that salary version.

**Example:** An annual cost-to-company figure is not the same as the employee’s monthly bank payment.

Technical definition: Annual cost-to-company amount in rupees for this salary version.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `annual_ctc: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### phase

**In everyday language:** Salary phase distinguishing probation from confirmed employment.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “probation” means Probation.

Technical definition: Salary phase distinguishing probation from confirmed employment.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'confirmed'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `phase: Generated<SalaryPhase>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `probation` | Probation. | DB CHECK: employee_salaries_phase_check |
| `confirmed` | Confirmed. | DB CHECK: employee_salaries_phase_check |

Database rules (including conditions shared with other fields):

- `employee_salaries_phase_check`: `CHECK ((phase = ANY (ARRAY['probation'::text, 'confirmed'::text])))`

### component_amounts

**In everyday language:** Monthly whole numbers of paise copy saved at that point in time written by salary assignment (PAY-02).

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the component amounts.

Technical definition: Monthly integer paise snapshot written by salary assignment (PAY-02).

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | No database default |
| Definition basis | backend/src/core/db/types.ts:1528 |
| Code declaration | `component_amounts: Record<string, number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### probation_percent

**In everyday language:** Configured percentage of confirmed salary payable during probation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An illustrative 80% means the configured probation proportion, not an additional 80% payment.

Technical definition: Configured percentage of confirmed salary payable during probation.

| Property | Definition |
|---|---|
| SQL type | `numeric(5,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `probation_percent: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### revision_reason

**In everyday language:** Business explanation for the dated so the correct version applies salary revision.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “joining” means Joining.

Technical definition: Business explanation for the effective-dated salary revision.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `revision_reason: SalaryRevisionReason \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `joining` | Joining. | DB CHECK: employee_salaries_revision_reason_check |
| `annual_increment` | Annual increment. | DB CHECK: employee_salaries_revision_reason_check |
| `promotion` | Promotion. | DB CHECK: employee_salaries_revision_reason_check |
| `confirmation` | Confirmation. | DB CHECK: employee_salaries_revision_reason_check |
| `correction` | Correction. | DB CHECK: employee_salaries_revision_reason_check |
| `probation_start` | Probation start. | DB CHECK: employee_salaries_revision_reason_check |

Database rules (including conditions shared with other fields):

- `employee_salaries_revision_reason_check`: `CHECK ((revision_reason = ANY (ARRAY['joining'::text, 'annual_increment'::text, 'promotion'::text, 'confirmation'::text, 'correction'::text, 'probation_start'::text])))`

### approved_by

**In everyday language:** Identifies approved by connected to this record.

**Why it is kept:** Keeps this record connected to the correct approved by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s approved by to FOREIGN KEY (approved_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `approved_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_salaries_approved_by_fkey`: `FOREIGN KEY (approved_by) REFERENCES core.users(id)`

### approved_at

**In everyday language:** Date and time of approved for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of approved for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `approved_at: Timestamp \| null;` |
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

- Index `employee_salaries_emp_idx`: `CREATE INDEX employee_salaries_emp_idx ON pay.employee_salaries USING btree (employee_id, effective_from DESC)`
- Index `employee_salaries_pkey`: `CREATE UNIQUE INDEX employee_salaries_pkey ON pay.employee_salaries USING btree (id)`
- Index `no_overlapping_salaries`: `CREATE INDEX no_overlapping_salaries ON pay.employee_salaries USING gist (employee_id, daterange(effective_from, effective_to, '[)'::text))`

## pay.fnf_settlements

Keeps the final calculation of amounts payable and recoverable when an employee leaves.

Fnf settlements records; consult the field definitions and governing module specification.

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

- `fnf_settlements_pkey`: `PRIMARY KEY (id)`

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

- `fnf_settlements_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### separation_id

**In everyday language:** Identity of the separation case for which final settlement is calculated.

**Why it is kept:** Keeps this record connected to the correct separation, so related details can be checked together.

**Example:** This saved reference identifies the related item in the context described above. It may belong to another system or to different record types; no database foreign-key guarantee is shown here.

Technical definition: Identity of the separation case for which final settlement is calculated.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `separation_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### run_id

**In everyday language:** Identifies the payroll calculation connected to this record.

**Why it is kept:** Keeps this record connected to the correct payroll calculation, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `run_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `fnf_settlements_run_id_fkey`: `FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id)`

### last_working_day

**In everyday language:** Approved last working date used as the final-settlement calculation boundary.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Approved last working date used as the final-settlement calculation boundary.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `last_working_day: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### days_payable

**In everyday language:** Number of days eligible for salary in the final settlement.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Number of days eligible for salary in the final settlement.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `days_payable: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### leave_encash_days

**In everyday language:** Eligible unused leave days selected for encashment.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Eligible unused leave days selected for encashment.

| Property | Definition |
|---|---|
| SQL type | `numeric(5,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `leave_encash_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notice_recovery_days

**In everyday language:** Notice-period shortfall days selected for recovery.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Notice-period shortfall days selected for recovery.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `notice_recovery_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gratuity_amount

**In everyday language:** Calculated gratuity payable in rupees under the selected policy.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Calculated gratuity payable in rupees under the selected policy.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `gratuity_amount: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### other_payments

**In everyday language:** Aggregate additional final-settlement payments in rupees, stored as exact an exact number.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Aggregate additional final-settlement payments in rupees, stored as exact NUMERIC.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `other_payments: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### other_deductions

**In everyday language:** Aggregate additional final-settlement deductions in rupees, stored as exact an exact number.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Aggregate additional final-settlement deductions in rupees, stored as exact NUMERIC.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `other_deductions: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### held_salary_released

**In everyday language:** Previously held salary released into the final settlement, in rupees.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Previously held salary released into the final settlement, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `held_salary_released: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

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
| Code declaration | `status: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: fnf_settlements_status_check |
| `clearances_pending` | Record is clearances pending in this lifecycle. | DB CHECK: fnf_settlements_status_check |
| `computed` | Calculation results exist; final approval/payment still separate | DB CHECK: fnf_settlements_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: fnf_settlements_status_check |
| `paid` | Payment recorded as completed | DB CHECK: fnf_settlements_status_check |

Database rules (including conditions shared with other fields):

- `fnf_settlements_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'clearances_pending'::text, 'computed'::text, 'approved'::text, 'paid'::text])))`

### tat_due_date

**In everyday language:** Target completion date under the configured final-settlement turnaround policy.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Target completion date under the configured final-settlement turnaround policy.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `tat_due_date: Timestamp \| null;` |
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

### leave_encash_amount

**In everyday language:** Rupee value of eligible leave encashment.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Rupee value of eligible leave encashment.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `leave_encash_amount: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notice_recovery_amount

**In everyday language:** Rupee value recovered for notice-period shortfall.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Rupee value recovered for notice-period shortfall.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `notice_recovery_amount: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gross_payable

**In everyday language:** Total final-settlement earnings before deductions, in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Total final-settlement earnings before deductions, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `gross_payable: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### total_deductions

**In everyday language:** Total deductions from the associated payroll result or settlement, in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Total deductions from the associated payroll result or settlement, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `total_deductions: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### net_payable

**In everyday language:** Net rupee amount due after the applicable earnings, adjustments and deductions.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Net rupee amount due after the applicable earnings, adjustments and deductions.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `net_payable: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### paid_at

**In everyday language:** Date and time of paid for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of paid for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `paid_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### relieving_letter_id

**In everyday language:** Identifies relieving letter connected to this record.

**Why it is kept:** Keeps this record connected to the correct relieving letter, so related details can be checked together.

**Example:** This record points to an existing entry in letters instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s relieving letter id to FOREIGN KEY (relieving_letter_id) REFERENCES core.letters(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `relieving_letter_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `fnf_settlements_relieving_letter_id_fkey`: `FOREIGN KEY (relieving_letter_id) REFERENCES core.letters(id)`

### service_certificate_id

**In everyday language:** Identifies service certificate connected to this record.

**Why it is kept:** Keeps this record connected to the correct service certificate, so related details can be checked together.

**Example:** This record points to an existing entry in letters instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s service certificate id to FOREIGN KEY (service_certificate_id) REFERENCES core.letters(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `service_certificate_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `fnf_settlements_service_certificate_id_fkey`: `FOREIGN KEY (service_certificate_id) REFERENCES core.letters(id)`

### calc_breakdown

**In everyday language:** Stored explanation and component breakdown of the settlement calculation; a result copy saved at that point in time rather than a new policy source.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the calc breakdown.

Technical definition: Stored explanation and component breakdown of the settlement calculation; a result snapshot rather than a new policy source.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `calc_breakdown: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `fnf_settlements_pkey`: `CREATE UNIQUE INDEX fnf_settlements_pkey ON pay.fnf_settlements USING btree (id)`

## pay.gl_accounts

Maps payroll components to Finance’s accounting codes.

Gl accounts records; consult the field definitions and governing module specification.

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

- `gl_accounts_pkey`: `PRIMARY KEY (id)`

### company_code

**In everyday language:** Legal-entity code used for accounting integration mapping.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Legal-entity code used for accounting integration mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `company_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `gl_accounts_company_code_plant_code_cost_center_code_compon_key`: `UNIQUE (company_code, plant_code, cost_center_code, component_code)`

### plant_code

**In everyday language:** Plant code used for accounting integration mapping.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Plant code used for accounting integration mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `plant_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `gl_accounts_company_code_plant_code_cost_center_code_compon_key`: `UNIQUE (company_code, plant_code, cost_center_code, component_code)`

### cost_center_code

**In everyday language:** Cost-center code used for accounting integration mapping.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Cost-center code used for accounting integration mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `cost_center_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `gl_accounts_company_code_plant_code_cost_center_code_compon_key`: `UNIQUE (company_code, plant_code, cost_center_code, component_code)`

### component_code

**In everyday language:** Salary-component business code used to classify this amount or accounting mapping.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Salary-component business code used to classify this amount or accounting mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `component_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `gl_accounts_company_code_plant_code_cost_center_code_compon_key`: `UNIQUE (company_code, plant_code, cost_center_code, component_code)`

### gl_code

**In everyday language:** General-history of additions and deductions account code used for the accounting/JV export.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: General-ledger account code used for the accounting/JV export.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `gl_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `gl_accounts_gl_code_check`: `CHECK ((length(btrim(gl_code)) > 0))`

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

- Index `gl_accounts_company_code_plant_code_cost_center_code_compon_key`: `CREATE UNIQUE INDEX gl_accounts_company_code_plant_code_cost_center_code_compon_key ON pay.gl_accounts USING btree (company_code, plant_code, cost_center_code, component_code)`
- Index `gl_accounts_pkey`: `CREATE UNIQUE INDEX gl_accounts_pkey ON pay.gl_accounts USING btree (id)`
- Trigger `gl_accounts_org_codes_guard` → `pay.validate_gl_account_org_codes` (enabled flag `O`).

## pay.inputs

Keeps approved monthly salary additions or deductions outside the normal salary arrangement.

Inputs records; consult the field definitions and governing module specification.

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

- `inputs_pkey`: `PRIMARY KEY (id)`

### run_id

**In everyday language:** Identifies the payroll calculation connected to this record.

**Why it is kept:** Keeps this record connected to the correct payroll calculation, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `run_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `inputs_run_id_fkey`: `FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id)`

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

- `inputs_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### component_code

**In everyday language:** Salary-component business code used to classify this amount or accounting mapping.

**Why it is kept:** Keeps this record connected to the correct pay head, so related details can be checked together.

**Example:** This record points to an existing entry in salary components instead of copying all of that entry’s details.

Technical definition: Salary-component business code used to classify this amount or accounting mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `component_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `inputs_component_code_fkey`: `FOREIGN KEY (component_code) REFERENCES pay.salary_components(code)`

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### note

**In everyday language:** Free-text explanation attached to this input, adjustment or history of additions and deductions record.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Free-text explanation attached to this input, adjustment or ledger record.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `note: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### entered_by

**In everyday language:** Identifies entered by connected to this record.

**Why it is kept:** Keeps this record connected to the correct entered by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s entered by to FOREIGN KEY (entered_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `entered_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `inputs_entered_by_fkey`: `FOREIGN KEY (entered_by) REFERENCES core.users(id)`

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

### claim_id

**In everyday language:** An older link showing which reimbursement claim produced a salary adjustment.

**Why it is kept:** Allows old combined salary-and-claim payments to be checked later; new reimbursements use separate payments.

**Example:** Finance checks an old salary record against the claim it originally paid. This link is not an instruction to pay it again.

Technical definition: Historical claim provenance for the superseded combined-payment model. Nullable for manual/legacy inputs; new reimbursements do not create salary-input rows.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `claim_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `inputs_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES pay.claims(id)`

Table indexes and lifecycle triggers:

- Index `inputs_claim_unique`: `CREATE UNIQUE INDEX inputs_claim_unique ON pay.inputs USING btree (claim_id) WHERE (claim_id IS NOT NULL)`
- Index `inputs_pkey`: `CREATE UNIQUE INDEX inputs_pkey ON pay.inputs USING btree (id)`
- Index `payroll_inputs_run_emp_idx`: `CREATE INDEX payroll_inputs_run_emp_idx ON pay.inputs USING btree (run_id, employee_id)`

## pay.investment_declarations

Keeps employees’ tax-saving declarations and amounts accepted after review.

Investment declarations records; consult the field definitions and governing module specification.

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

- `investment_declarations_pkey`: `PRIMARY KEY (id)`

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

- `investment_declarations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `investment_declarations_employee_id_fy_section_key`: `UNIQUE (employee_id, fy, section)`

### fy

**In everyday language:** Indian financial-year key identifying the tax year to which this record applies.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A value such as 2026-27 identifies an Indian financial year; use the stored year format defined by the system.

Technical definition: Indian financial-year key identifying the tax year to which this record applies.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fy: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `investment_declarations_employee_id_fy_section_key`: `UNIQUE (employee_id, fy, section)`

### section

**In everyday language:** Income-tax deduction/exemption section under which the investment is declared.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the section.

Technical definition: Income-tax deduction/exemption section under which the investment is declared.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `section: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `investment_declarations_employee_id_fy_section_key`: `UNIQUE (employee_id, fy, section)`

### declared_amount

**In everyday language:** Rupee amount declared by the employee before verification.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Rupee amount declared by the employee before verification.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `declared_amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### proof_document_id

**In everyday language:** Identifies proof document connected to this record.

**Why it is kept:** Keeps this record connected to the correct proof document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s proof document id to FOREIGN KEY (proof_document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `proof_document_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `investment_declarations_proof_document_id_fkey`: `FOREIGN KEY (proof_document_id) REFERENCES core.documents(id)`

### verified_amount

**In everyday language:** Rupee amount accepted after document review.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Rupee amount accepted after document review.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `verified_amount: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### verified_by

**In everyday language:** Identifies verified by connected to this record.

**Why it is kept:** Keeps this record connected to the correct verified by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s verified by to FOREIGN KEY (verified_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `verified_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `investment_declarations_verified_by_fkey`: `FOREIGN KEY (verified_by) REFERENCES core.users(id)`

### verified_at

**In everyday language:** Date and time of verified for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of verified for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `verified_at: Timestamp \| null;` |
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

- Index `investment_declarations_employee_id_fy_section_key`: `CREATE UNIQUE INDEX investment_declarations_employee_id_fy_section_key ON pay.investment_declarations USING btree (employee_id, fy, section)`
- Index `investment_declarations_pkey`: `CREATE UNIQUE INDEX investment_declarations_pkey ON pay.investment_declarations USING btree (id)`

## pay.it_slabs

Keeps configured income-tax bands and related calculation parameters.

It slabs records; consult the field definitions and governing module specification.

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

- `it_slabs_pkey`: `PRIMARY KEY (id)`

### fy

**In everyday language:** Indian financial-year key identifying the tax year to which this record applies.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A value such as 2026-27 identifies an Indian financial year; use the stored year format defined by the system.

Technical definition: Indian financial-year key identifying the tax year to which this record applies.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `fy: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### regime

**In everyday language:** Income-tax regime used to select slabs and deductions.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “old” means Old income-tax regime.

Technical definition: Income-tax regime used to select slabs and deductions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `regime: 'old' \| 'new';` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `old` | Old income-tax regime | DB CHECK: it_slabs_regime_check |
| `new` | New income-tax regime | DB CHECK: it_slabs_regime_check |

Database rules (including conditions shared with other fields):

- `it_slabs_regime_check`: `CHECK ((regime = ANY (ARRAY['old'::text, 'new'::text])))`

### slab_from

**In everyday language:** Lower taxable-income boundary of the income-tax slab, in rupees.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Lower taxable-income boundary of the income-tax slab, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `slab_from: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### slab_to

**In everyday language:** Upper taxable-income boundary of the income-tax slab, in rupees; not recorded may represent an open upper band.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Upper taxable-income boundary of the income-tax slab, in rupees; NULL may represent an open upper band.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `slab_to: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rate

**In everyday language:** Decimal tax/contribution multiplier, subject to the stored precision and constraints.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A rate is a multiplier or percentage representation, not a rupee amount; read it using the particular rule’s units.

Technical definition: Decimal tax/contribution multiplier, subject to the stored precision and constraints.

| Property | Definition |
|---|---|
| SQL type | `numeric(6,4)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `rate: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### surcharge_rules

**In everyday language:** Structured surcharge bands and calculation parameters for this tax regime/year.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the surcharge rules.

Technical definition: Structured surcharge bands and calculation parameters for this tax regime/year.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `surcharge_rules: unknown;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### cess_rate

**In everyday language:** Decimal cess multiplier applied by the income-tax calculation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A decimal multiplier of 0.04 illustrates 4%; it is an example of representation, not a statement of the applicable legal rate.

Technical definition: Decimal cess multiplier applied by the income-tax calculation.

| Property | Definition |
|---|---|
| SQL type | `numeric(6,4)` |
| Required | Yes |
| Default | 0.04 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `cess_rate: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### standard_deduction

**In everyday language:** Configured standard deduction amount in rupees for the regime/year.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Configured standard deduction amount in rupees for the regime/year.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `standard_deduction: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rebate_87a

**In everyday language:** Structured Section 87A rebate parameters for the tax regime/year.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the rebate 87a.

Technical definition: Structured Section 87A rebate parameters for the tax regime/year.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `rebate_87a: unknown;` |
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

- Index `it_slabs_pkey`: `CREATE UNIQUE INDEX it_slabs_pkey ON pay.it_slabs USING btree (id)`

## pay.loan_postings

Keeps individual loan repayment movements and their principal and interest parts.

Loan postings records; consult the field definitions and governing module specification.

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

- `loan_postings_pkey`: `PRIMARY KEY (id)`

### loan_id

**In everyday language:** Identifies loan connected to this record.

**Why it is kept:** Keeps this record connected to the correct loan, so related details can be checked together.

**Example:** This record points to an existing entry in loans instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s loan id to FOREIGN KEY (loan_id) REFERENCES pay.loans(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `loan_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loan_postings_loan_id_fkey`: `FOREIGN KEY (loan_id) REFERENCES pay.loans(id)`

### run_id

**In everyday language:** Identifies the payroll calculation connected to this record.

**Why it is kept:** Keeps this record connected to the correct payroll calculation, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `run_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loan_postings_run_id_fkey`: `FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id)`

### principal_part

**In everyday language:** Loan principal repaid by this posting, in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Loan principal repaid by this posting, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `principal_part: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### interest_part

**In everyday language:** Loan interest paid by this posting, in rupees.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Loan interest paid by this posting, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `interest_part: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### perquisite_value

**In everyday language:** Taxable loan-benefit value attributed to this posting, in rupees.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the taxable value of an employment benefit, not necessarily cash transferred to the employee.

Technical definition: Taxable loan-benefit value attributed to this posting, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `perquisite_value: Generated<string>;` |
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

- Index `loan_postings_loan_run_unique`: `CREATE UNIQUE INDEX loan_postings_loan_run_unique ON pay.loan_postings USING btree (loan_id, run_id)`
- Index `loan_postings_pkey`: `CREATE UNIQUE INDEX loan_postings_pkey ON pay.loan_postings USING btree (id)`

## pay.loans

Tracks employee loans or salary advances and their repayment arrangements.

Loans records; consult the field definitions and governing module specification.

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

- `loans_pkey`: `PRIMARY KEY (id)`

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

- `loans_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### loan_type

**In everyday language:** Business category of the employee loan or salary advance.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “loan_diminishing” means Loan using diminishing-balance interest.

Technical definition: Business category of the employee loan or salary advance.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `loan_type: LoanType;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `loan_diminishing` | Loan using diminishing-balance interest | DB CHECK: loans_loan_type_check |
| `loan_flat` | Loan using flat interest | DB CHECK: loans_loan_type_check |
| `emi_no_interest` | Instalments without interest | DB CHECK: loans_loan_type_check |
| `salary_advance` | Salary advance. | DB CHECK: loans_loan_type_check |
| `travel_advance` | Travel advance. | DB CHECK: loans_loan_type_check |

Database rules (including conditions shared with other fields):

- `loans_loan_type_check`: `CHECK ((loan_type = ANY (ARRAY['loan_diminishing'::text, 'loan_flat'::text, 'emi_no_interest'::text, 'salary_advance'::text, 'travel_advance'::text])))`

### principal

**In everyday language:** Original sanctioned loan principal in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Original sanctioned loan principal in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `principal: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loans_outstanding_range`: `CHECK (((outstanding >= (0)::numeric) AND (outstanding <= principal)))`
- `loans_principal_positive`: `CHECK ((principal > (0)::numeric))`

### interest_rate

**In everyday language:** Configured interest rate for the loan; its exact representation is retained in the source declaration and constraints.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The rate is interpreted using this loan’s configured calculation convention; it is not the rupee amount of interest itself.

Technical definition: Configured interest rate for the loan; its exact representation is retained in the source declaration and constraints.

| Property | Definition |
|---|---|
| SQL type | `numeric(6,3)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `interest_rate: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loans_interest_range`: `CHECK (((interest_rate >= (0)::numeric) AND (interest_rate <= (100)::numeric)))`

### emi

**In everyday language:** Scheduled equated monthly repayment instalment in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Scheduled equated monthly instalment in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `emi: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loans_emi_positive`: `CHECK ((emi > (0)::numeric))`

### start_month

**In everyday language:** First payroll month in which this loan repayment or salary hold applies.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First payroll month in which this loan repayment or salary hold applies.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `start_month: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### tenure_months

**In everyday language:** Scheduled duration of loan repayment in months.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Scheduled duration of loan repayment in months.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `tenure_months: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loans_tenure_positive`: `CHECK ((tenure_months > 0))`

### outstanding

**In everyday language:** Stored loan outstanding balance in rupees; history of additions and deductions postings must be reconciled before treating a stored balance as authoritative.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A remaining loan balance is checked against the history of disbursement and repayments; the stored balance is not a second independent account.

Technical definition: Stored loan outstanding balance in rupees; ledger postings must be reconciled before treating a stored balance as authoritative.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `outstanding: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loans_outstanding_range`: `CHECK (((outstanding >= (0)::numeric) AND (outstanding <= principal)))`

### perquisite_applicable

**In everyday language:** Whether the loan is subject to taxable perquisite calculation.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether the loan is subject to taxable perquisite calculation.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `perquisite_applicable: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### source

**In everyday language:** Origin system or process supplying this record; exact accepted values depend on the table.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “hrms” means Native HRMS-origin record.

Technical definition: Origin system or process supplying this record; exact accepted values depend on the table.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'hrms'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `source: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `hrms` | Native HRMS-origin record | DB CHECK: loans_source_check |
| `sap_legacy` | Imported legacy SAP-origin record | DB CHECK: loans_source_check |

Database rules (including conditions shared with other fields):

- `loans_source_check`: `CHECK ((source = ANY (ARRAY['hrms'::text, 'sap_legacy'::text])))`

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

### status

**In everyday language:** Current progress from creation to closure state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “pending” means Awaiting the required decision or next action.

Technical definition: Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'pending'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `status: Generated<LoanStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `pending` | Awaiting the required decision or next action | DB CHECK: loans_status_check |
| `active` | Record is active in this lifecycle. | DB CHECK: loans_status_check |
| `closed` | Record is closed in this lifecycle. | DB CHECK: loans_status_check |
| `written_off` | Record is written off in this lifecycle. | DB CHECK: loans_status_check |
| `rejected` | Request refused by an authorized reviewer | DB CHECK: loans_status_check |
| `cancelled` | Request cancelled | DB CHECK: loans_status_check |

Database rules (including conditions shared with other fields):

- `loans_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'closed'::text, 'written_off'::text, 'rejected'::text, 'cancelled'::text])))`

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

### source_reference

**In everyday language:** Reference linking the loan to its originating external/source-system record.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Reference linking the loan to its originating external/source-system record.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `source_reference: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `loans_emp_idx`: `CREATE INDEX loans_emp_idx ON pay.loans USING btree (employee_id, status)`
- Index `loans_pkey`: `CREATE UNIQUE INDEX loans_pkey ON pay.loans USING btree (id)`
- Index `loans_source_reference_unique`: `CREATE UNIQUE INDEX loans_source_reference_unique ON pay.loans USING btree (employee_id, source_reference) WHERE (source_reference IS NOT NULL)`
- Index `loans_workflow_request_unique`: `CREATE UNIQUE INDEX loans_workflow_request_unique ON pay.loans USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL)`

## pay.payroll_item_lines

Explains each earning, deduction or employer contribution within an employee’s salary calculation.

Payroll item lines records; consult the field definitions and governing module specification.

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

- `payroll_item_lines_pkey`: `PRIMARY KEY (id)`

### item_id

**In everyday language:** Identifies item connected to this record.

**Why it is kept:** Keeps this record connected to the correct item, so related details can be checked together.

**Example:** This record points to an existing entry in payroll items instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s item id to FOREIGN KEY (item_id) REFERENCES pay.payroll_items(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `item_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_item_lines_item_id_fkey`: `FOREIGN KEY (item_id) REFERENCES pay.payroll_items(id) ON DELETE CASCADE`

### component_code

**In everyday language:** Salary-component business code used to classify this amount or accounting mapping.

**Why it is kept:** Keeps this record connected to the correct pay head, so related details can be checked together.

**Example:** This record points to an existing entry in salary components instead of copying all of that entry’s details.

Technical definition: Salary-component business code used to classify this amount or accounting mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `component_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_item_lines_component_code_fkey`: `FOREIGN KEY (component_code) REFERENCES pay.salary_components(code)`

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### calc_note

**In everyday language:** The written explanation of how one payslip amount was worked out.

**Why it is kept:** Helps an employee or payroll reviewer understand the amount rather than seeing only a number.

**Example:** A line explains that an allowance was adjusted because only part of the month was payable.

Technical definition: Human-readable explanation of how the payroll line amount was calculated.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `calc_note: string \| null;` |
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

### loan_id

**In everyday language:** Identifies loan connected to this record.

**Why it is kept:** Keeps this record connected to the correct loan, so related details can be checked together.

**Example:** This record points to an existing entry in loans instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s loan id to FOREIGN KEY (loan_id) REFERENCES pay.loans(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `loan_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_item_lines_loan_id_fkey`: `FOREIGN KEY (loan_id) REFERENCES pay.loans(id)`

### carry_forward_id

**In everyday language:** Identifies carry forward connected to this record.

**Why it is kept:** Keeps this record connected to the correct carry forward, so related details can be checked together.

**Example:** This record points to an existing entry in recovery carry forwards instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s carry forward id to FOREIGN KEY (carry_forward_id) REFERENCES pay.recovery_carry_forwards(id) ON DELETE SET NULL.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `carry_forward_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_item_lines_carry_forward_id_fkey`: `FOREIGN KEY (carry_forward_id) REFERENCES pay.recovery_carry_forwards(id) ON DELETE SET NULL`

Table indexes and lifecycle triggers:

- Index `payroll_item_lines_item_idx`: `CREATE INDEX payroll_item_lines_item_idx ON pay.payroll_item_lines USING btree (item_id)`
- Index `payroll_item_lines_pkey`: `CREATE UNIQUE INDEX payroll_item_lines_pkey ON pay.payroll_item_lines USING btree (id)`

## pay.payroll_items

Keeps one employee’s result within a payroll run.

Payroll items records; consult the field definitions and governing module specification.

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

- `payroll_items_pkey`: `PRIMARY KEY (id)`

### run_id

**In everyday language:** Identifies the payroll calculation connected to this record.

**Why it is kept:** Keeps this record connected to the correct payroll calculation, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `run_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_items_run_id_employee_id_key`: `UNIQUE (run_id, employee_id)`
- `payroll_items_run_id_fkey`: `FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id) ON DELETE CASCADE`

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

- `payroll_items_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `payroll_items_run_id_employee_id_key`: `UNIQUE (run_id, employee_id)`

### days_in_month

**In everyday language:** Payroll day divisor selected by policy for this employee/month; not necessarily the calendar month's day count.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Payroll day divisor selected by policy for this employee/month; not necessarily the calendar month's day count.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `days_in_month: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### payable_days

**In everyday language:** The number of days counted for payment in this payroll calculation.

**Why it is kept:** Supplies the day count used when salary is adjusted for attendance.

**Example:** A period can have 30 calendar days while fewer days qualify for salary.

Technical definition: Payable attendance days used for payroll proration.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `payable_days: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### lop_days

**In everyday language:** Loss-of-pay days used by the stored payroll/report result.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Loss-of-pay days used by the stored payroll/report result.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `lop_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### lop_reversal_days

**In everyday language:** Previously deducted loss-of-pay days reversed in this result.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Previously deducted loss-of-pay days reversed in this result.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `lop_reversal_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Days; fractional values represent part of a day.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ot_minutes

**In everyday language:** Approved overtime duration in minutes included in the payroll result.

**Why it is kept:** Records the quantity or duration described here so it can be checked using the correct unit.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Approved overtime duration in minutes included in the payroll result.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `ot_minutes: Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gross

**In everyday language:** Gross payroll earnings in rupees, worked out from other saved information from the applicable component flags.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Gross payroll earnings in rupees, derived from the applicable component flags.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `gross: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### total_deductions

**In everyday language:** Total deductions from the associated payroll result or settlement, in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Total deductions from the associated payroll result or settlement, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `total_deductions: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### net_pay

**In everyday language:** The salary amount left for the employee after deductions.

**Why it is kept:** Shows the result of the salary calculation before any separate payment or hold checks.

**Example:** Illustration: ₹30,000 earnings minus ₹2,000 deductions leaves ₹28,000 net pay.

Technical definition: Net employee salary payable in rupees after deductions.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `net_pay: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### payment_status

**In everyday language:** Payment/hold/review state of this payroll result, separate from payroll-run status.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “payable” means Record is payable in this progress from creation to closure.

Technical definition: Payment/hold/review state of this payroll result, separate from payroll-run status.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'payable'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `payment_status: Generated<PayrollPaymentStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `payable` | Record is payable in this lifecycle. | DB CHECK: payroll_items_payment_status_check |
| `hold_payment` | Compute salary but hold payment | DB CHECK: payroll_items_payment_status_check |
| `hold_process` | Hold salary processing | DB CHECK: payroll_items_payment_status_check |

Database rules (including conditions shared with other fields):

- `payroll_items_payment_status_check`: `CHECK ((payment_status = ANY (ARRAY['payable'::text, 'hold_payment'::text, 'hold_process'::text])))`

### payslip_document_id

**In everyday language:** Identifies payslip document connected to this record.

**Why it is kept:** Keeps this record connected to the correct payslip document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s payslip document id to FOREIGN KEY (payslip_document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `payslip_document_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_items_payslip_document_id_fkey`: `FOREIGN KEY (payslip_document_id) REFERENCES core.documents(id)`

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

### employer_cost

**In everyday language:** Employer-side payroll cost in rupees associated with this result.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Employer-side payroll cost in rupees associated with this result.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `employer_cost: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `payroll_items_emp_idx`: `CREATE INDEX payroll_items_emp_idx ON pay.payroll_items USING btree (employee_id)`
- Index `payroll_items_pkey`: `CREATE UNIQUE INDEX payroll_items_pkey ON pay.payroll_items USING btree (id)`
- Index `payroll_items_run_id_employee_id_key`: `CREATE UNIQUE INDEX payroll_items_run_id_employee_id_key ON pay.payroll_items USING btree (run_id, employee_id)`
- Index `payroll_items_run_idx`: `CREATE INDEX payroll_items_run_idx ON pay.payroll_items USING btree (run_id)`
- Trigger `trg_payroll_items_immutability` → `pay.enforce_finalized_items_immutability` (enabled flag `O`).

## pay.payroll_runs

Tracks a company’s payroll calculation and approval process for a period.

Payroll runs records; consult the field definitions and governing module specification.

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

- `payroll_runs_pkey`: `PRIMARY KEY (id)`

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

- `payroll_runs_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`
- `payroll_runs_company_id_month_run_type_key`: `UNIQUE (company_id, month, run_type)`

### month

**In everyday language:** Payroll/reporting period key; inspect its technical storage format for DATE versus text representation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Payroll/reporting period key; inspect its SQL type for DATE versus text representation.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `month: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_runs_company_id_month_run_type_key`: `UNIQUE (company_id, month, run_type)`

### run_type

**In everyday language:** Category of payroll run, such as regular, overtime or another permitted run category.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “regular” means Regular.

Technical definition: Category of payroll run, such as regular, overtime or another permitted run category.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'regular'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `run_type: Generated<PayrollRunType>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `regular` | Regular. | DB CHECK: payroll_runs_run_type_check |
| `off_cycle` | Off cycle. | DB CHECK: payroll_runs_run_type_check |
| `fnf` | Full and final settlement | DB CHECK: payroll_runs_run_type_check |
| `bonus` | Bonus. | DB CHECK: payroll_runs_run_type_check |
| `arrears` | Arrears. | DB CHECK: payroll_runs_run_type_check |

Database rules (including conditions shared with other fields):

- `payroll_runs_company_id_month_run_type_key`: `UNIQUE (company_id, month, run_type)`
- `payroll_runs_run_type_check`: `CHECK ((run_type = ANY (ARRAY['regular'::text, 'off_cycle'::text, 'fnf'::text, 'bonus'::text, 'arrears'::text])))`

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
| Code declaration | `status: Generated<PayrollRunStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: check_attendance_lock_when_computed |
| `inputs_locked` | Payroll input collection is frozen | DB CHECK: check_attendance_lock_when_computed |
| `draft` | Editable draft before submission/preparation | DB CHECK: payroll_runs_status_check |
| `inputs_locked` | Payroll input collection is frozen | DB CHECK: payroll_runs_status_check |
| `computed` | Calculation results exist; final approval/payment still separate | DB CHECK: payroll_runs_status_check |
| `under_review` | Record is under review in this lifecycle. | DB CHECK: payroll_runs_status_check |
| `approved` | Authorized by the applicable approval process | DB CHECK: payroll_runs_status_check |
| `finalized` | Payroll approved and frozen; payment remains a separate step | DB CHECK: payroll_runs_status_check |
| `reopened` | Record is reopened in this lifecycle. | DB CHECK: payroll_runs_status_check |
| `paid` | Payment recorded as completed | DB CHECK: payroll_runs_status_check |

Database rules (including conditions shared with other fields):

- `check_attendance_lock_when_computed`: `CHECK (((status = ANY (ARRAY['draft'::text, 'inputs_locked'::text])) OR (attendance_lock_id IS NOT NULL)))`
- `payroll_runs_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'inputs_locked'::text, 'computed'::text, 'under_review'::text, 'approved'::text, 'finalized'::text, 'reopened'::text, 'paid'::text])))`

### attendance_lock_id

**In everyday language:** Identifies attendance lock connected to this record.

**Why it is kept:** Keeps this record connected to the correct attendance lock, so related details can be checked together.

**Example:** This record points to an existing entry in month locks instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s attendance lock id to FOREIGN KEY (attendance_lock_id) REFERENCES att.month_locks(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `attendance_lock_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `check_attendance_lock_when_computed`: `CHECK (((status = ANY (ARRAY['draft'::text, 'inputs_locked'::text])) OR (attendance_lock_id IS NOT NULL)))`
- `payroll_runs_attendance_lock_id_fkey`: `FOREIGN KEY (attendance_lock_id) REFERENCES att.month_locks(id)`

### computed_at

**In everyday language:** Date and time of computed for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of computed for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `computed_at: NullableTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### approved_at

**In everyday language:** Date and time of approved for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of approved for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `approved_at: NullableTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### approved_by

**In everyday language:** Identifies approved by connected to this record.

**Why it is kept:** Keeps this record connected to the correct approved by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s approved by to FOREIGN KEY (approved_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `approved_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_runs_approved_by_fkey`: `FOREIGN KEY (approved_by) REFERENCES core.users(id)`

### finalized_at

**In everyday language:** Date and time of finalized for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of finalized for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `finalized_at: NullableTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### finalized_by

**In everyday language:** Identifies finalized by connected to this record.

**Why it is kept:** Keeps this record connected to the correct finalized by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s finalized by to FOREIGN KEY (finalized_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `finalized_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_runs_finalized_by_fkey`: `FOREIGN KEY (finalized_by) REFERENCES core.users(id)`

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

- Index `payroll_runs_company_id_month_run_type_key`: `CREATE UNIQUE INDEX payroll_runs_company_id_month_run_type_key ON pay.payroll_runs USING btree (company_id, month, run_type)`
- Index `payroll_runs_company_month_idx`: `CREATE INDEX payroll_runs_company_month_idx ON pay.payroll_runs USING btree (company_id, month)`
- Index `payroll_runs_pkey`: `CREATE UNIQUE INDEX payroll_runs_pkey ON pay.payroll_runs USING btree (id)`
- Trigger `trg_payroll_runs_immutability` → `pay.enforce_finalized_run_immutability` (enabled flag `O`).

## pay.pt_slabs

Keeps configured professional-tax bands.

Pt slabs records; consult the field definitions and governing module specification.

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

- `pt_slabs_pkey`: `PRIMARY KEY (id)`

### state_code

**In everyday language:** State/jurisdiction code used for statutory slab selection.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A stored state code selects the applicable state or address jurisdiction; it does not represent a company code.

Technical definition: State/jurisdiction code used for statutory slab selection.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `state_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### min_monthly

**In everyday language:** Lower monthly wage boundary for professional-tax slab selection, in rupees.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the recorded quantity for the meaning described above. A missing value is different from a recorded zero.

Technical definition: Lower monthly wage boundary for professional-tax slab selection, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `min_monthly: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### max_monthly

**In everyday language:** Upper monthly wage boundary for professional-tax slab selection, in rupees.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Read this number using the specific measure described above. A percentage, version number and priority order have different meanings.

Technical definition: Upper monthly wage boundary for professional-tax slab selection, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `max_monthly: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(8,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### effective_from

**In everyday language:** Date from which this version or rule applies.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Date from which this version or rule applies.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `effective_from: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### basis

**In everyday language:** Wage basis on which professional tax is assessed.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “earned_monthly” means Earned monthly.

Technical definition: Wage basis on which professional tax is assessed.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'earned_monthly'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `basis: Generated<'earned_monthly' \| 'contracted_monthly'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `earned_monthly` | Earned monthly. | DB CHECK: pt_slabs_basis_check |
| `contracted_monthly` | Contracted monthly. | DB CHECK: pt_slabs_basis_check |

Database rules (including conditions shared with other fields):

- `pt_slabs_basis_check`: `CHECK ((basis = ANY (ARRAY['earned_monthly'::text, 'contracted_monthly'::text])))`

Table indexes and lifecycle triggers:

- Index `pt_slabs_lookup_idx`: `CREATE INDEX pt_slabs_lookup_idx ON pay.pt_slabs USING btree (state_code, effective_from DESC)`
- Index `pt_slabs_pkey`: `CREATE UNIQUE INDEX pt_slabs_pkey ON pay.pt_slabs USING btree (id)`

## pay.recovery_carry_forwards

Tracks deductions that must be recovered through a later payroll result.

Recovery carry forwards records; consult the field definitions and governing module specification.

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

- `recovery_carry_forwards_pkey`: `PRIMARY KEY (id)`

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

- `recovery_carry_forwards_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `recovery_carry_forwards_from_run_id_employee_id_component_c_key`: `UNIQUE (from_run_id, employee_id, component_code)`

### component_code

**In everyday language:** Salary-component business code used to classify this amount or accounting mapping.

**Why it is kept:** Keeps this record connected to the correct pay head, so related details can be checked together.

**Example:** This record points to an existing entry in salary components instead of copying all of that entry’s details.

Technical definition: Salary-component business code used to classify this amount or accounting mapping.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `component_code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `recovery_carry_forwards_component_code_fkey`: `FOREIGN KEY (component_code) REFERENCES pay.salary_components(code)`
- `recovery_carry_forwards_from_run_id_employee_id_component_c_key`: `UNIQUE (from_run_id, employee_id, component_code)`

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `recovery_carry_forwards_amount_check`: `CHECK ((amount > (0)::numeric))`

### from_run_id

**In everyday language:** Identifies from run connected to this record.

**Why it is kept:** Keeps this record connected to the correct from run, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s from run id to FOREIGN KEY (from_run_id) REFERENCES pay.payroll_runs(id) ON DELETE CASCADE.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `from_run_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `recovery_carry_forwards_from_run_id_employee_id_component_c_key`: `UNIQUE (from_run_id, employee_id, component_code)`
- `recovery_carry_forwards_from_run_id_fkey`: `FOREIGN KEY (from_run_id) REFERENCES pay.payroll_runs(id) ON DELETE CASCADE`

### consumed_run_id

**In everyday language:** Identifies consumed run connected to this record.

**Why it is kept:** Keeps this record connected to the correct consumed run, so related details can be checked together.

**Example:** This record points to an existing entry in payroll runs instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s consumed run id to FOREIGN KEY (consumed_run_id) REFERENCES pay.payroll_runs(id) ON DELETE SET NULL.

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `consumed_run_id: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `recovery_carry_forwards_consumed_run_id_fkey`: `FOREIGN KEY (consumed_run_id) REFERENCES pay.payroll_runs(id) ON DELETE SET NULL`

### note

**In everyday language:** Free-text explanation attached to this input, adjustment or history of additions and deductions record.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Free-text explanation attached to this input, adjustment or ledger record.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `note: string;` |
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

- Index `recovery_carry_forwards_from_run_id_employee_id_component_c_key`: `CREATE UNIQUE INDEX recovery_carry_forwards_from_run_id_employee_id_component_c_key ON pay.recovery_carry_forwards USING btree (from_run_id, employee_id, component_code)`
- Index `recovery_carry_forwards_open_idx`: `CREATE INDEX recovery_carry_forwards_open_idx ON pay.recovery_carry_forwards USING btree (employee_id) WHERE (consumed_run_id IS NULL)`
- Index `recovery_carry_forwards_pkey`: `CREATE UNIQUE INDEX recovery_carry_forwards_pkey ON pay.recovery_carry_forwards USING btree (id)`

## pay.reimbursement_batch_items

Lists the approved claims included in a reimbursement payment batch.

Reimbursement batch items records; consult the field definitions and governing module specification.

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
| Default | nextval('pay.reimbursement_batch_items_id_seq'::regclass) |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id:Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batch_items_pkey`: `PRIMARY KEY (id)`

### batch_id

**In everyday language:** Identifies the payment group connected to this record.

**Why it is kept:** Keeps this record connected to the correct payment group, so related details can be checked together.

**Example:** This record points to an existing entry in reimbursement batches instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s batch id to FOREIGN KEY (batch_id) REFERENCES pay.reimbursement_batches(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `batch_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batch_items_batch_id_claim_id_key`: `UNIQUE (batch_id, claim_id)`
- `reimbursement_batch_items_batch_id_fkey`: `FOREIGN KEY (batch_id) REFERENCES pay.reimbursement_batches(id)`

### claim_id

**In everyday language:** Identifies the expense claim connected to this record.

**Why it is kept:** Keeps this record connected to the correct expense claim, so related details can be checked together.

**Example:** This record points to an existing entry in claims instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `claim_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batch_items_batch_id_claim_id_key`: `UNIQUE (batch_id, claim_id)`
- `reimbursement_batch_items_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES pay.claims(id)`

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
| Code declaration | `employee_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batch_items_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### amount

**In everyday language:** Approved claim amount closed to ordinary changes into this reimbursement batch item, in rupees; a payment copy saved at that point in time, not a fresh claim approval.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Approved claim amount frozen into this reimbursement batch item, in rupees; a payment snapshot, not a fresh claim approval.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `amount:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batch_items_amount_check`: `CHECK ((amount > (0)::numeric))`

Table indexes and lifecycle triggers:

- Index `reimbursement_batch_claim`: `CREATE INDEX reimbursement_batch_claim ON pay.reimbursement_batch_items USING btree (claim_id)`
- Index `reimbursement_batch_items_batch_id_claim_id_key`: `CREATE UNIQUE INDEX reimbursement_batch_items_batch_id_claim_id_key ON pay.reimbursement_batch_items USING btree (batch_id, claim_id)`
- Index `reimbursement_batch_items_pkey`: `CREATE UNIQUE INDEX reimbursement_batch_items_pkey ON pay.reimbursement_batch_items USING btree (id)`
- Trigger `reimbursement_items_guard` → `pay.guard_reimbursement_items` (enabled flag `O`).

## pay.reimbursement_batches

Groups reimbursement payments separately from salary payment batches.

CLM-04: separate from salary runs, salary bank batches and salary payslips.

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
| Default | nextval('pay.reimbursement_batches_id_seq'::regclass) |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `id:Generated<number>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batches_pkey`: `PRIMARY KEY (id)`

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
| Code declaration | `company_id:number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batches_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

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
| Code declaration | `status:Generated<'draft'\|'prepared'\|'paid'\|'cancelled'>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `draft` | Editable draft before submission/preparation | DB CHECK: reimbursement_batches_status_check |
| `prepared` | Payment batch prepared with frozen payment contents | DB CHECK: reimbursement_batches_status_check |
| `paid` | Payment recorded as completed | DB CHECK: reimbursement_batches_status_check |
| `cancelled` | Request cancelled | DB CHECK: reimbursement_batches_status_check |

Database rules (including conditions shared with other fields):

- `reimbursement_batches_check`: `CHECK (((status <> ALL (ARRAY['prepared'::text, 'paid'::text])) OR (bank_document_id IS NOT NULL)))`
- `reimbursement_batches_check1`: `CHECK (((status <> 'paid'::text) OR ((paid_by IS NOT NULL) AND (paid_at IS NOT NULL) AND (payment_reference IS NOT NULL) AND (length(TRIM(BOTH FROM payment_reference)) >= 3))))`
- `reimbursement_batches_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'prepared'::text, 'paid'::text, 'cancelled'::text])))`

### total_amount

**In everyday language:** Aggregate monetary amount represented by the batch, in rupees.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Aggregate monetary amount represented by the batch, in rupees.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `total_amount:string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batches_total_amount_check`: `CHECK ((total_amount > (0)::numeric))`

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

- `reimbursement_batches_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

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
| Code declaration | `created_at:DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bank_document_id

**In everyday language:** Identifies bank document connected to this record.

**Why it is kept:** Keeps this record connected to the correct bank document, so related details can be checked together.

**Example:** This record points to an existing entry in documents instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s bank document id to FOREIGN KEY (bank_document_id) REFERENCES core.documents(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `bank_document_id:number\|null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batches_bank_document_id_fkey`: `FOREIGN KEY (bank_document_id) REFERENCES core.documents(id)`
- `reimbursement_batches_check`: `CHECK (((status <> ALL (ARRAY['prepared'::text, 'paid'::text])) OR (bank_document_id IS NOT NULL)))`

### paid_by

**In everyday language:** Identifies paid by connected to this record.

**Why it is kept:** Keeps this record connected to the correct paid by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s paid by to FOREIGN KEY (paid_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `paid_by:number\|null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batches_check1`: `CHECK (((status <> 'paid'::text) OR ((paid_by IS NOT NULL) AND (paid_at IS NOT NULL) AND (payment_reference IS NOT NULL) AND (length(TRIM(BOTH FROM payment_reference)) >= 3))))`
- `reimbursement_batches_paid_by_fkey`: `FOREIGN KEY (paid_by) REFERENCES core.users(id)`

### paid_at

**In everyday language:** Date and time of paid for this record.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant of paid for this record.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | timestamp field convention |
| Code declaration | `paid_at:NullableTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batches_check1`: `CHECK (((status <> 'paid'::text) OR ((paid_by IS NOT NULL) AND (paid_at IS NOT NULL) AND (payment_reference IS NOT NULL) AND (length(TRIM(BOTH FROM payment_reference)) >= 3))))`

### payment_reference

**In everyday language:** External bank/payment transaction reference recorded when the reimbursement batch is paid.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** Finance records the bank’s transaction reference so the payment can be checked later.

Technical definition: External bank/payment transaction reference recorded when the reimbursement batch is paid.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `payment_reference:string\|null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `reimbursement_batches_check1`: `CHECK (((status <> 'paid'::text) OR ((paid_by IS NOT NULL) AND (paid_at IS NOT NULL) AND (payment_reference IS NOT NULL) AND (length(TRIM(BOTH FROM payment_reference)) >= 3))))`

Table indexes and lifecycle triggers:

- Index `reimbursement_batches_pkey`: `CREATE UNIQUE INDEX reimbursement_batches_pkey ON pay.reimbursement_batches USING btree (id)`
- Trigger `reimbursement_batch_guard` → `pay.guard_reimbursement_batch` (enabled flag `O`).

## pay.salary_components

Defines pay heads such as earnings, deductions and employer contributions.

Salary components records; consult the field definitions and governing module specification.

Relation kind: table.

### code

**In everyday language:** Stable machine-readable business code identifying this list of available choices entry.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Stable machine-readable business code identifying this catalog entry.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | catalog relationship / shared record convention |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `salary_components_pkey`: `PRIMARY KEY (code)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### kind

**In everyday language:** Classification of this record; exact accepted codes and conditions are listed in its database rules.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “earning” means Earning classification for kind.

Technical definition: Classification of this record; exact accepted codes and conditions are listed in its database rules.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `kind: SalaryComponentKind;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `earning` | Earning classification for kind. | DB CHECK: salary_components_kind_check |
| `deduction` | Deduction classification for kind. | DB CHECK: salary_components_kind_check |
| `employer_contribution` | Employer contribution classification for kind. | DB CHECK: salary_components_kind_check |

Database rules (including conditions shared with other fields):

- `salary_components_kind_check`: `CHECK ((kind = ANY (ARRAY['earning'::text, 'deduction'::text, 'employer_contribution'::text])))`

### formula

**In everyday language:** Configured salary-component expression evaluated by the salary calculation engine.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A rule can calculate one pay head using another pay head. The configured expression explains the dependency.

Technical definition: Configured salary-component expression evaluated by the salary calculation engine.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `formula: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### rounding

**In everyday language:** Rounding policy code applied to the salary component's calculated amount.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “round” means Round to nearest configured unit.

Technical definition: Rounding policy code applied to the salary component's calculated amount.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'round'::text |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `rounding: Generated<SalaryRoundingMode>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `round` | Round to nearest configured unit | DB CHECK: salary_components_rounding_check |
| `floor` | Round downward | DB CHECK: salary_components_rounding_check |
| `ceil` | Round upward | DB CHECK: salary_components_rounding_check |
| `nearest_10` | Round to nearest ten-unit boundary | DB CHECK: salary_components_rounding_check |

Database rules (including conditions shared with other fields):

- `salary_components_rounding_check`: `CHECK ((rounding = ANY (ARRAY['round'::text, 'floor'::text, 'ceil'::text, 'nearest_10'::text])))`

### taxable

**In everyday language:** Whether this salary component contributes taxable income.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether this salary component contributes taxable income.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `taxable: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### part_of_gross

**In everyday language:** Whether this component contributes to the configured gross wage base.

**Why it is kept:** Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.

**Example:** Yes means the condition described here is true; No means it is false.

Technical definition: Whether this component contributes to the configured gross wage base.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `part_of_gross: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### part_of_pf_wages

**In everyday language:** Whether this pay head is included in the wage amount used for provident-fund calculation.

**Why it is kept:** Lets the configured salary calculation select its provident-fund wage base.

**Example:** A pay head included in provident-fund wages can affect that calculation; the payable rate comes from separate rules.

Technical definition: Whether this component contributes to the configured provident-fund wage base.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `part_of_pf_wages: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### prorate_on_lop

**In everyday language:** Whether this pay head is reduced when part of the period is unpaid.

**Why it is kept:** Tells payroll which amounts should follow the payable-day adjustment.

**Example:** A monthly allowance marked this way is adjusted when some days count as loss of pay.

Technical definition: Whether the component is reduced according to loss-of-pay proration.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `prorate_on_lop: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### display_order

**In everyday language:** Numeric ordering for displaying this list of available choices/component entry.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A pay head with order 1 can appear before one with order 2 on the display.

Technical definition: Numeric ordering for displaying this catalog/component entry.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `display_order: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

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

Table indexes and lifecycle triggers:

- Index `salary_components_pkey`: `CREATE UNIQUE INDEX salary_components_pkey ON pay.salary_components USING btree (code)`

## pay.salary_holds

Records instructions to hold salary calculation or salary payment.

Salary holds records; consult the field definitions and governing module specification.

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

- `salary_holds_pkey`: `PRIMARY KEY (id)`

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

- `salary_holds_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

### hold_type

**In everyday language:** Salary-hold category determining whether processing or payment is held.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “payment” means Payment.

Technical definition: Salary-hold category determining whether processing or payment is held.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `hold_type: SalaryHoldType;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `payment` | Payment. | DB CHECK: salary_holds_hold_type_check |
| `process` | Process. | DB CHECK: salary_holds_hold_type_check |

Database rules (including conditions shared with other fields):

- `salary_holds_hold_type_check`: `CHECK ((hold_type = ANY (ARRAY['payment'::text, 'process'::text])))`

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

### start_month

**In everyday language:** First payroll month in which this loan repayment or salary hold applies.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: First payroll month in which this loan repayment or salary hold applies.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `start_month: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### released_month

**In everyday language:** Payroll period in which this salary hold was released.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Payroll period in which this salary hold was released.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `released_month: Timestamp \| null;` |
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
| Code declaration | `created_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `salary_holds_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

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

- Index `salary_holds_emp_idx`: `CREATE INDEX salary_holds_emp_idx ON pay.salary_holds USING btree (employee_id)`
- Index `salary_holds_pkey`: `CREATE UNIQUE INDEX salary_holds_pkey ON pay.salary_holds USING btree (id)`

## pay.salary_structures

Defines reusable arrangements of salary components.

Salary structures records; consult the field definitions and governing module specification.

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

- `salary_structures_pkey`: `PRIMARY KEY (id)`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `salary_structures_name_key`: `UNIQUE (name)`

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

- `salary_structures_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

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

### components

**In everyday language:** Structured salary-structure component configuration, including component expressions/amounts; source shape is retained with the field.

**Why it is kept:** Keeps related details together when a single short answer would not describe the event or result.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the components.

Technical definition: Structured salary-structure component configuration, including component expressions/amounts; source shape is retained with the field.

| Property | Definition |
|---|---|
| SQL type | `jsonb` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `components: SalaryComponentItem[];` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

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

Table indexes and lifecycle triggers:

- Index `salary_structures_company_idx`: `CREATE INDEX salary_structures_company_idx ON pay.salary_structures USING btree (company_id, is_active)`
- Index `salary_structures_name_key`: `CREATE UNIQUE INDEX salary_structures_name_key ON pay.salary_structures USING btree (name)`
- Index `salary_structures_pkey`: `CREATE UNIQUE INDEX salary_structures_pkey ON pay.salary_structures USING btree (id)`

## pay.statutory_rates

Keeps dated statutory calculation parameters and their recorded sources.

Statutory rates records; consult the field definitions and governing module specification.

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

- `statutory_rates_pkey`: `PRIMARY KEY (id)`

### scheme

**In everyday language:** Statutory scheme code selecting the contribution/tax parameter family.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the scheme.

Technical definition: Statutory scheme code selecting the contribution/tax parameter family.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `scheme: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### param

**In everyday language:** Parameter name within the statutory scheme, such as a rate, ceiling or cap.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** When reviewing this record, staff read this saved detail alongside its other details to understand the param.

Technical definition: Parameter name within the statutory scheme, such as a rate, ceiling or cap.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `param: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### value

**In everyday language:** The configured number used for this particular statutory parameter. Read it together with the scheme and parameter name.

**Why it is kept:** Distinguishes rates, rupee ceilings and other limits so a number is not used in the wrong way.

**Example:** A value for a percentage rate has a different meaning from a value for a rupee ceiling; the number alone is not enough.

Technical definition: Exact configured statutory parameter value; units depend on scheme and parameter, not on the numeric SQL type alone.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,4)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `value: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### effective_from

**In everyday language:** Date from which this version or rule applies.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Date from which this version or rule applies.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `effective_from: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### source_note

**In everyday language:** Recorded source/justification for the dated so the correct version applies statutory parameter.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Recorded source/justification for the effective-dated statutory parameter.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `source_note: string;` |
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

- Index `statutory_rates_pkey`: `CREATE UNIQUE INDEX statutory_rates_pkey ON pay.statutory_rates USING btree (id)`
- Index `statutory_rates_unique`: `CREATE UNIQUE INDEX statutory_rates_unique ON pay.statutory_rates USING btree (scheme, param, effective_from)`

## pay.tds_challans

Keeps payment references for income tax deducted from salaries and remitted to government.

Tds challans records; consult the field definitions and governing module specification.

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

- `tds_challans_pkey`: `PRIMARY KEY (id)`

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

- `tds_challans_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

### month

**In everyday language:** Payroll/reporting period key; inspect its technical storage format for DATE versus text representation.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Payroll/reporting period key; inspect its SQL type for DATE versus text representation.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `month: Timestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### amount

**In everyday language:** Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; kept accurately to the recorded decimal places.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

| Property | Definition |
|---|---|
| SQL type | `numeric(14,2)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `amount: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### challan_no

**In everyday language:** Government challan/payment acknowledgment reference for remitted income tax deducted from salary.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Government challan/payment acknowledgment reference for remitted TDS.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `challan_no: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### bsr_code

**In everyday language:** Bank branch BSR code associated with the income tax deducted from salary challan.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is a reference staff or the system can match to the related item. Two items with similar descriptions can have different references.

Technical definition: Bank branch BSR code associated with the TDS challan.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `bsr_code: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### paid_on

**In everyday language:** Calendar date on which the remittance was made.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Calendar date on which the remittance was made.

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `paid_on: Timestamp;` |
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

- Index `tds_challans_pkey`: `CREATE UNIQUE INDEX tds_challans_pkey ON pay.tds_challans USING btree (id)`

