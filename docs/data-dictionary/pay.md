# pay — field dictionary

340 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## pay.arrears

Arrears records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `arrears_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

Reference linking this record’s source salary id to FOREIGN KEY (source_salary_id) REFERENCES pay.employee_salaries(id).

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

Original payroll period to which this arrears adjustment relates, separate from the paying run.

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

Reference linking this record’s paid in run id to FOREIGN KEY (paid_in_run_id) REFERENCES pay.payroll_runs(id).

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

Salary-component business code used to classify this amount or accounting mapping.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Instant this record was created.

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

Bank batches records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `bank_batches_pkey`: `PRIMARY KEY (id)`

### run_id

Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

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

Reference linking this record’s file document id to FOREIGN KEY (file_document_id) REFERENCES core.documents(id).

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

Aggregate monetary amount represented by the batch, in rupees.

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

Number of records represented or accessed in this batch/event.

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

Reference linking this record’s generated by to FOREIGN KEY (generated_by) REFERENCES core.users(id).

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

Instant this record was created.

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

Null while this is the one active file for the run. A later file supersedes it.

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

Budget categories records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budget_categories_pkey`: `PRIMARY KEY (id)`

### budget_id

Reference linking this record’s budget id to FOREIGN KEY (budget_id) REFERENCES pay.budgets(id) ON DELETE CASCADE.

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

Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

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

Rupee allowance allocated to this claim category within its budget; this is an amount, not a boolean flag.

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

The budget IS the travel request (live recon §1): the EMS `trips` collection
is empty because IBudget carries the itinerary itself.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `budgets_pkey`: `PRIMARY KEY (id)`

### reference

Human-readable business reference used to identify this request.

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

Human-readable title of this request or published content.

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

Declared business purpose of this request, processing activity or consent.

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

Employee to whom this record belongs; references the permanent employee master.

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

Legal entity that owns or scopes this record.

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

Reference linking this record’s cost center id to FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id).

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

First calendar date of the covered period.

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

Last calendar date of the covered period; see constraints and service for boundary validation.

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

Domestic or international travel classification used for entitlement and routing.

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

Travel region used when selecting applicable budget/entitlement rules.

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

Origin location of the proposed travel.

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

Destination location of the proposed travel.

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

First planned date of travel.

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

Last planned date of travel.

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

Number of hotel nights budgeted for the journey.

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

Whether the travel desk is responsible for flight booking.

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

Whether the travel desk is responsible for hotel booking.

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

Whether the travel desk is responsible for visa arrangements.

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

Explanation for arrangements made outside the travel desk.

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

Justification for exceeding the configured entitlement limit.

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

Requested total. The ledger draws on `approved_allowance` once approved.

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

Approved allowance amount for the budget.

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

Currency code in which the associated original amount is expressed.

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

Conversion multiplier from one unit of the original currency to Indian rupees; monetary conversion uses exact decimal arithmetic.

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

Calendar date associated with the exchange-rate snapshot.

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

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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

Whether the approved budget permits spending above its normal limit.

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

Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database FK is present.

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

Reference linking this record’s approved by user id to FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id).

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

Instant of approved for this record.

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

Explanation recorded when the request is rejected.

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

Instant this record was created.

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

Instant this record was last updated; not a complete change history.

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

Claim bills records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_bills_pkey`: `PRIMARY KEY (id)`

### claim_id

Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE.

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

Reference linking this record’s document id to FOREIGN KEY (document_id) REFERENCES core.documents(id).

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

Supplier's bill or receipt reference.

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

Calendar date printed on the bill or receipt.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Legacy bill verification flag; review current verified_by/verified_at authority before relying on this flag alone.

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

Reference linking this record’s verified by to FOREIGN KEY (verified_by) REFERENCES core.users(id).

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

Instant this record was created.

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

Claim entitlements records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_entitlements_pkey`: `PRIMARY KEY (id)`

### claim_type_id

Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

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

Reference linking this record’s grade id to FOREIGN KEY (grade_id) REFERENCES core.grades(id).

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Date from which this version or rule applies.

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

Instant this record was created.

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

Claim lines records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_lines_pkey`: `PRIMARY KEY (id)`

### claim_id

Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE.

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

Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

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

Human-readable description of this record.

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

Calendar date on which the claimed expense was incurred.

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

Supplier's bill or receipt reference.

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

Expense amount expressed in its original currency before conversion to INR.

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

Currency code of the expense before INR conversion.

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

Conversion multiplier from one unit of the original currency to Indian rupees; monetary conversion uses exact decimal arithmetic.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Private stored-document/object key for supporting evidence; not a public download URL.

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

Instant this record was created.

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

Append-only. A release is a NEW row, never an update to the reserve row.

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
| Code source | [backend/src/core/db/types.pay-claims.ts](../../backend/src/core/db/types.pay-claims.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_reservations_pkey`: `PRIMARY KEY (id)`

### budget_id

Reference linking this record’s budget id to FOREIGN KEY (budget_id) REFERENCES pay.budgets(id).

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

Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id).

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

Ledger movement classification controlling reservation or release; permitted codes are listed in the database rules.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Per-category breakdown, mirroring the live budgetReserved{} snapshot.

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

Recorded business justification for the operation or decision.

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

Reference linking this record’s actor user id to FOREIGN KEY (actor_user_id) REFERENCES core.users(id).

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

Instant of occurred for this record.

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

Claim types records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claim_types_pkey`: `PRIMARY KEY (id)`

### code

Stable machine-readable business code identifying this catalog entry.

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

Human-readable display name of this catalog record.

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

Bill-required flag retained in the claim-type catalog; distinct from bill_required and subject to the current service's authority.

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

Taxability flag retained in the claim-type catalog; distinct from conditional substantiation policy.

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

Whether this catalog or account record is currently available for use; historical references remain.

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

Numeric ordering used when displaying catalog entries.

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

Instant this record was created.

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

Instant this record was last updated; not a complete change history.

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

Basis on which the claim type's entitlement is evaluated.

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

Claim-type policy indicating whether supporting bill evidence is required; distinct from legacy requires_bill.

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

Whether unsupported reimbursement becomes taxable under the configured claim-type policy.

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

Configured salary-component reference retained for the older combined-payment model; current reimbursements use independent batches.

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

Claims records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `claims_pkey`: `PRIMARY KEY (id)`

### reference

Human-readable business reference used to identify this request.

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

Employee to whom this record belongs; references the permanent employee master.

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

Whether the claim draws on a budget or another configured entitlement source.

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

Reference linking this record’s budget id to FOREIGN KEY (budget_id) REFERENCES pay.budgets(id).

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

Reference linking this record’s reserved budget id to FOREIGN KEY (reserved_budget_id) REFERENCES pay.budgets(id).

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

First calendar date of the covered period.

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

Last calendar date of the covered period; see constraints and service for boundary validation.

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

Total amount requested by the claimant, in rupees.

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

Amount authorized after review, in rupees; may differ from claimed amount.

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

Currency selected for presenting the claim to users.

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

Snapshot mapping original currencies to INR conversion rates used for this claim.

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

Calendar date associated with the exchange-rate snapshot.

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

State of financial settlement, separate from approval status.

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

Configured payment or recovery method for settling the claim.

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

Amount recorded for settlement in rupees.

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

Net rupee amount due after the applicable earnings, adjustments and deductions.

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

Reference linking this record’s settled by user id to FOREIGN KEY (settled_by_user_id) REFERENCES core.users(id).

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

Instant of settled for this record.

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

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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

Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database FK is present.

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

Explanation recorded when the request is rejected.

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

Instant of submitted for this record.

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

Instant of decided for this record.

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

Instant this record was created.

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

Instant this record was last updated; not a complete change history.

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

Reference linking this record’s claim type id to FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id).

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

Reference linking this record’s advance loan id to FOREIGN KEY (advance_loan_id) REFERENCES pay.loans(id).

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

Historical combined-payment payroll-run destination. New independent reimbursements do not populate this link; retained for reconciliation without inferred backfill.

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

Historical salary bank-batch destination. New reimbursements use reimbursement_batch_id; legacy links must not cause automatic re-payment.

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

Independent reimbursement batch paying this claim. Kept separate from salary runs and salary bank batches; at most one legacy/new destination is permitted.

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

Employee salaries records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `employee_salaries_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

Reference linking this record’s structure id to FOREIGN KEY (structure_id) REFERENCES pay.salary_structures(id).

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

Date from which this version or rule applies.

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

End of this version's applicability; NULL represents no recorded end. Exact range/exclusion rules appear in constraints.

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

Annual cost-to-company amount in rupees for this salary version.

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

Salary phase distinguishing probation from confirmed employment.

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

Monthly integer paise snapshot written by salary assignment (PAY-02).

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

Configured percentage of confirmed salary payable during probation.

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

Business explanation for the effective-dated salary revision.

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

Reference linking this record’s approved by to FOREIGN KEY (approved_by) REFERENCES core.users(id).

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

Instant of approved for this record.

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

Instant this record was created.

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

Fnf settlements records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `fnf_settlements_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

Identity of the separation case for which final settlement is calculated.

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

Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

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

Approved last working date used as the final-settlement calculation boundary.

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

Number of days eligible for salary in the final settlement.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `days_payable: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### leave_encash_days

Eligible unused leave days selected for encashment.

| Property | Definition |
|---|---|
| SQL type | `numeric(5,2)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `leave_encash_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### notice_recovery_days

Notice-period shortfall days selected for recovery.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `notice_recovery_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### gratuity_amount

Calculated gratuity payable in rupees under the selected policy.

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

Aggregate additional final-settlement payments in rupees, stored as exact NUMERIC.

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

Aggregate additional final-settlement deductions in rupees, stored as exact NUMERIC.

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

Previously held salary released into the final settlement, in rupees.

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

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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

Target completion date under the configured final-settlement turnaround policy.

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

Instant this record was created.

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

Rupee value of eligible leave encashment.

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

Rupee value recovered for notice-period shortfall.

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

Total final-settlement earnings before deductions, in rupees.

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

Total deductions from the associated payroll result or settlement, in rupees.

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

Net rupee amount due after the applicable earnings, adjustments and deductions.

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

Instant of paid for this record.

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

Reference linking this record’s relieving letter id to FOREIGN KEY (relieving_letter_id) REFERENCES core.letters(id).

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

Reference linking this record’s service certificate id to FOREIGN KEY (service_certificate_id) REFERENCES core.letters(id).

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

Stored explanation and component breakdown of the settlement calculation; a result snapshot rather than a new policy source.

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

Gl accounts records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `gl_accounts_pkey`: `PRIMARY KEY (id)`

### company_code

Legal-entity code used for accounting integration mapping.

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

Plant code used for accounting integration mapping.

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

Cost-center code used for accounting integration mapping.

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

Salary-component business code used to classify this amount or accounting mapping.

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

General-ledger account code used for the accounting/JV export.

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

Instant this record was created.

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

Inputs records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `inputs_pkey`: `PRIMARY KEY (id)`

### run_id

Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

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

Employee to whom this record belongs; references the permanent employee master.

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

Salary-component business code used to classify this amount or accounting mapping.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Free-text explanation attached to this input, adjustment or ledger record.

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

Reference linking this record’s entered by to FOREIGN KEY (entered_by) REFERENCES core.users(id).

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

Instant this record was created.

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

Historical claim provenance for the superseded combined-payment model. Nullable for manual/legacy inputs; new reimbursements do not create salary-input rows.

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

Investment declarations records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `investment_declarations_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

Indian financial-year key identifying the tax year to which this record applies.

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

Income-tax deduction/exemption section under which the investment is declared.

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

Rupee amount declared by the employee before verification.

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

Reference linking this record’s proof document id to FOREIGN KEY (proof_document_id) REFERENCES core.documents(id).

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

Rupee amount accepted after document review.

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

Reference linking this record’s verified by to FOREIGN KEY (verified_by) REFERENCES core.users(id).

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

Instant of verified for this record.

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

Instant this record was created.

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

It slabs records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `it_slabs_pkey`: `PRIMARY KEY (id)`

### fy

Indian financial-year key identifying the tax year to which this record applies.

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

Income-tax regime used to select slabs and deductions.

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

Lower taxable-income boundary of the income-tax slab, in rupees.

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

Upper taxable-income boundary of the income-tax slab, in rupees; NULL may represent an open upper band.

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

Decimal tax/contribution multiplier, subject to the stored precision and constraints.

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

Structured surcharge bands and calculation parameters for this tax regime/year.

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

Decimal cess multiplier applied by the income-tax calculation.

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

Configured standard deduction amount in rupees for the regime/year.

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

Structured Section 87A rebate parameters for the tax regime/year.

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

Instant this record was created.

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

Loan postings records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loan_postings_pkey`: `PRIMARY KEY (id)`

### loan_id

Reference linking this record’s loan id to FOREIGN KEY (loan_id) REFERENCES pay.loans(id).

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

Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id).

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

Loan principal repaid by this posting, in rupees.

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

Loan interest paid by this posting, in rupees.

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

Taxable loan-benefit value attributed to this posting, in rupees.

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

Instant this record was created.

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

Loans records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `loans_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

Business category of the employee loan or salary advance.

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

Original sanctioned loan principal in rupees.

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

Configured interest rate for the loan; its exact representation is retained in the source declaration and constraints.

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

Scheduled equated monthly instalment in rupees.

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

First payroll month in which this loan repayment or salary hold applies.

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

Scheduled duration of loan repayment in months.

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

Stored loan outstanding balance in rupees; ledger postings must be reconciled before treating a stored balance as authoritative.

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

Whether the loan is subject to taxable perquisite calculation.

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

Origin system or process supplying this record; exact accepted values depend on the table.

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

Identifier connecting this domain request to the approval workflow instance; inspect the relationship rules for whether a database FK is present.

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

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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

Instant this record was created.

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

Reference linking the loan to its originating external/source-system record.

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

Payroll item lines records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_item_lines_pkey`: `PRIMARY KEY (id)`

### item_id

Reference linking this record’s item id to FOREIGN KEY (item_id) REFERENCES pay.payroll_items(id) ON DELETE CASCADE.

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

Salary-component business code used to classify this amount or accounting mapping.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Human-readable explanation of how the payroll line amount was calculated.

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

Instant this record was created.

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

Reference linking this record’s loan id to FOREIGN KEY (loan_id) REFERENCES pay.loans(id).

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

Reference linking this record’s carry forward id to FOREIGN KEY (carry_forward_id) REFERENCES pay.recovery_carry_forwards(id) ON DELETE SET NULL.

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

Payroll items records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_items_pkey`: `PRIMARY KEY (id)`

### run_id

Reference linking this record’s run id to FOREIGN KEY (run_id) REFERENCES pay.payroll_runs(id) ON DELETE CASCADE.

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

Employee to whom this record belongs; references the permanent employee master.

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

Payroll day divisor selected by policy for this employee/month; not necessarily the calendar month's day count.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `days_in_month: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### payable_days

Payable attendance days used for payroll proration.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `payable_days: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### lop_days

Loss-of-pay days used by the stored payroll/report result.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `lop_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### lop_reversal_days

Previously deducted loss-of-pay days reversed in this result.

| Property | Definition |
|---|---|
| SQL type | `numeric(4,1)` |
| Required | Yes |
| Default | 0 |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `lop_reversal_days: Generated<string>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### ot_minutes

Approved overtime duration in minutes included in the payroll result.

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

Gross payroll earnings in rupees, derived from the applicable component flags.

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

Total deductions from the associated payroll result or settlement, in rupees.

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

Net employee salary payable in rupees after deductions.

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

Payment/hold/review state of this payroll result, separate from payroll-run status.

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

Reference linking this record’s payslip document id to FOREIGN KEY (payslip_document_id) REFERENCES core.documents(id).

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

Instant this record was created.

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

Employer-side payroll cost in rupees associated with this result.

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

Payroll runs records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `payroll_runs_pkey`: `PRIMARY KEY (id)`

### company_id

Legal entity that owns or scopes this record.

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

Payroll/reporting period key; inspect its SQL type for DATE versus text representation.

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

Category of payroll run, such as regular, overtime or another permitted run category.

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

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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

Reference linking this record’s attendance lock id to FOREIGN KEY (attendance_lock_id) REFERENCES att.month_locks(id).

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

Instant of computed for this record.

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

Instant of approved for this record.

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

Reference linking this record’s approved by to FOREIGN KEY (approved_by) REFERENCES core.users(id).

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

Instant of finalized for this record.

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

Reference linking this record’s finalized by to FOREIGN KEY (finalized_by) REFERENCES core.users(id).

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

Free-text business context associated with this record.

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

Instant this record was created.

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

Instant this record was last updated; not a complete change history.

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

Pt slabs records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `pt_slabs_pkey`: `PRIMARY KEY (id)`

### state_code

State/jurisdiction code used for statutory slab selection.

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

Lower monthly wage boundary for professional-tax slab selection, in rupees.

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

Upper monthly wage boundary for professional-tax slab selection, in rupees.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Date from which this version or rule applies.

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

Wage basis on which professional tax is assessed.

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

Recovery carry forwards records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `recovery_carry_forwards_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

Salary-component business code used to classify this amount or accounting mapping.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Reference linking this record’s from run id to FOREIGN KEY (from_run_id) REFERENCES pay.payroll_runs(id) ON DELETE CASCADE.

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

Reference linking this record’s consumed run id to FOREIGN KEY (consumed_run_id) REFERENCES pay.payroll_runs(id) ON DELETE SET NULL.

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

Free-text explanation attached to this input, adjustment or ledger record.

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

Instant this record was created.

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

Reimbursement batch items records; consult the field definitions and governing module specification.

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

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

Reference linking this record’s batch id to FOREIGN KEY (batch_id) REFERENCES pay.reimbursement_batches(id).

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

Reference linking this record’s claim id to FOREIGN KEY (claim_id) REFERENCES pay.claims(id).

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

Employee to whom this record belongs; references the permanent employee master.

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

Approved claim amount frozen into this reimbursement batch item, in rupees; a payment snapshot, not a fresh claim approval.

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

CLM-04: separate from salary runs, salary bank batches and salary payslips.

Relation kind: table.

### id

Internal unique identity of this record; distinct from display codes and external identifiers.

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

Legal entity that owns or scopes this record.

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

Current lifecycle state of this record. Exact accepted states and coupled conditions are listed under database rules; this alone does not authorize transitions.

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

Aggregate monetary amount represented by the batch, in rupees.

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

User who created this record.

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

Instant this record was created.

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

Reference linking this record’s bank document id to FOREIGN KEY (bank_document_id) REFERENCES core.documents(id).

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

Reference linking this record’s paid by to FOREIGN KEY (paid_by) REFERENCES core.users(id).

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

Instant of paid for this record.

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

External bank/payment transaction reference recorded when the reimbursement batch is paid.

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

Salary components records; consult the field definitions and governing module specification.

Relation kind: table.

### code

Stable machine-readable business code identifying this catalog entry.

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

Human-readable display name of this catalog record.

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

Classification of this record; exact accepted codes and conditions are listed in its database rules.

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

Configured salary-component expression evaluated by the salary calculation engine.

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

Rounding policy code applied to the salary component's calculated amount.

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

Whether this salary component contributes taxable income.

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

Whether this component contributes to the configured gross wage base.

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

Whether this component contributes to the configured provident-fund wage base.

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

Whether the component is reduced according to loss-of-pay proration.

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

Numeric ordering for displaying this catalog/component entry.

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

Whether this catalog or account record is currently available for use; historical references remain.

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

Instant this record was created.

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

Salary holds records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `salary_holds_pkey`: `PRIMARY KEY (id)`

### employee_id

Employee to whom this record belongs; references the permanent employee master.

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

Salary-hold category determining whether processing or payment is held.

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

Recorded business justification for the operation or decision.

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

First payroll month in which this loan repayment or salary hold applies.

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

Payroll period in which this salary hold was released.

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

User who created this record.

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

Instant this record was created.

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

Salary structures records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `salary_structures_pkey`: `PRIMARY KEY (id)`

### name

Human-readable display name of this catalog record.

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

Legal entity that owns or scopes this record.

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

Human-readable description of this record.

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

Structured salary-structure component configuration, including component expressions/amounts; source shape is retained with the field.

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

Whether this catalog or account record is currently available for use; historical references remain.

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

Instant this record was created.

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

Instant this record was last updated; not a complete change history.

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

Statutory rates records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `statutory_rates_pkey`: `PRIMARY KEY (id)`

### scheme

Statutory scheme code selecting the contribution/tax parameter family.

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

Parameter name within the statutory scheme, such as a rate, ceiling or cap.

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

Exact configured statutory parameter value; units depend on scheme and parameter, not on the numeric SQL type alone.

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

Date from which this version or rule applies.

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

Recorded source/justification for the effective-dated statutory parameter.

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

Instant this record was created.

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

Tds challans records; consult the field definitions and governing module specification.

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `tds_challans_pkey`: `PRIMARY KEY (id)`

### company_id

Legal entity that owns or scopes this record.

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

Payroll/reporting period key; inspect its SQL type for DATE versus text representation.

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

Monetary amount for this record in rupees unless an explicit currency field specifies otherwise; exact database NUMERIC, never binary floating-point.

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

Government challan/payment acknowledgment reference for remitted TDS.

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

Bank branch BSR code associated with the TDS challan.

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

Calendar date on which the remittance was made.

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

Instant this record was created.

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

