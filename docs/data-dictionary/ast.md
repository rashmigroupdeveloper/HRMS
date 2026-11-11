# ast — field dictionary

36 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## ast.assets

Lists company property such as laptops, phones and vehicles.

AST-01 asset registry; warranty_till accepts past dates (AST-02)

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

- `assets_pkey`: `PRIMARY KEY (id)`

### asset_no

**In everyday language:** Unique human asset tag used by search and allocation.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** An asset tag such as LAP-001 lets Admin find one particular laptop.

Technical definition: Unique human asset tag used by search and allocation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `asset_no: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `assets_asset_no_key`: `UNIQUE (asset_no)`

### category

**In everyday language:** Asset class used by register filters.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The saved category helps a reviewer group similar records; its meaning depends on the register being viewed.

Technical definition: Asset class used by register filters

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `category: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### description

**In everyday language:** Human description of the physical asset.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Human description of the physical asset

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `description: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### serial_no

**In everyday language:** Manufacturer serial used by search.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** The manufacturer’s serial number helps identify the physical device even when its company tag is replaced.

Technical definition: Manufacturer serial used by search

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `serial_no: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### purchase_date

**In everyday language:** Acquisition calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Acquisition calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `purchase_date: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### warranty_till

**In everyday language:** Warranty expiry date; legitimately may be in the past.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Warranty expiry date; legitimately may be in the past

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `warranty_till: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### status

**In everyday language:** register availability/loss/maintenance state; must agree with custody.

**Why it is kept:** Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.

**Example:** “in_stock” means Record is in stock in this progress from creation to closure.

Technical definition: Registry availability/loss/maintenance state; must agree with custody

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | 'in_stock'::text |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `status: Generated<AssetStatus>;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `in_stock` | Record is in stock in this lifecycle. | DB CHECK: assets_status_check |
| `assigned` | Record is assigned in this lifecycle. | DB CHECK: assets_status_check |
| `maintenance` | Record is maintenance in this lifecycle. | DB CHECK: assets_status_check |
| `lost` | Record is lost in this lifecycle. | DB CHECK: assets_status_check |
| `scrapped` | Record is scrapped in this lifecycle. | DB CHECK: assets_status_check |

Database rules (including conditions shared with other fields):

- `assets_status_check`: `CHECK ((status = ANY (ARRAY['in_stock'::text, 'assigned'::text, 'maintenance'::text, 'lost'::text, 'scrapped'::text])))`

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

- `assets_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

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

- `assets_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

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

- `assets_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

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

- Index `assets_asset_no_key`: `CREATE UNIQUE INDEX assets_asset_no_key ON ast.assets USING btree (asset_no)`
- Index `assets_asset_no_trgm`: `CREATE INDEX assets_asset_no_trgm ON ast.assets USING gin (lower(asset_no) gin_trgm_ops)`
- Index `assets_description_trgm`: `CREATE INDEX assets_description_trgm ON ast.assets USING gin (lower(COALESCE(description, ''::text)) gin_trgm_ops)`
- Index `assets_pkey`: `CREATE UNIQUE INDEX assets_pkey ON ast.assets USING btree (id)`
- Index `assets_search_idx`: `CREATE INDEX assets_search_idx ON ast.assets USING btree (company_id, status, category)`
- Index `assets_serial_idx`: `CREATE INDEX assets_serial_idx ON ast.assets USING btree (serial_no) WHERE (serial_no IS NOT NULL)`
- Index `assets_serial_trgm`: `CREATE INDEX assets_serial_trgm ON ast.assets USING gin (lower(COALESCE(serial_no, ''::text)) gin_trgm_ops)`

## ast.assignments

Records who has been given each company asset and whether it has been returned.

AST-03 employee/third-party allocation; open row = still held (AST-04/05)

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

- `assignments_pkey`: `PRIMARY KEY (id)`

### asset_id

**In everyday language:** Identifies asset connected to this record.

**Why it is kept:** Keeps this record connected to the correct asset, so related details can be checked together.

**Example:** This record points to an existing entry in assets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s asset id to FOREIGN KEY (asset_id) REFERENCES ast.assets(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `asset_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `assignments_asset_id_fkey`: `FOREIGN KEY (asset_id) REFERENCES ast.assets(id)`

### holder_kind

**In everyday language:** Employee versus third-party custody choice that tells the system which kind this is.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “employee” means Employee classification for holder kind.

Technical definition: Employee versus third-party custody discriminator

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `holder_kind: HolderKind;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `employee` | Employee classification for holder kind. | DB CHECK: assignments_holder_kind_check |
| `third_party` | Third party classification for holder kind. | DB CHECK: assignments_holder_kind_check |

Database rules (including conditions shared with other fields):

- `assignments_holder_kind_check`: `CHECK ((holder_kind = ANY (ARRAY['employee'::text, 'third_party'::text])))`
- `assignments_holder_xor`: `CHECK ((((holder_kind = 'employee'::text) AND (employee_id IS NOT NULL) AND (third_party_name IS NULL)) OR ((holder_kind = 'third_party'::text) AND (employee_id IS NULL) AND (third_party_name IS NOT NULL))))`

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
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `assignments_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`
- `assignments_holder_xor`: `CHECK ((((holder_kind = 'employee'::text) AND (employee_id IS NOT NULL) AND (third_party_name IS NULL)) OR ((holder_kind = 'third_party'::text) AND (employee_id IS NULL) AND (third_party_name IS NOT NULL))))`

### third_party_name

**In everyday language:** Named non-employee holder; only one can apply at a time with employee link to another record.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the third party name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Named non-employee holder; mutually exclusive with employee FK

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `third_party_name: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `assignments_holder_xor`: `CHECK ((((holder_kind = 'employee'::text) AND (employee_id IS NOT NULL) AND (third_party_name IS NULL)) OR ((holder_kind = 'third_party'::text) AND (employee_id IS NULL) AND (third_party_name IS NOT NULL))))`

### third_party_org

**In everyday language:** External holder's organization.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the third party org shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: External holder's organization

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `third_party_org: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### assigned_at

**In everyday language:** Physical custody issuance instant.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Physical custody issuance instant

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `assigned_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### returned_at

**In everyday language:** Physical return/closure instant; must not claim return for missing property.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Physical return/closure instant; must not claim return for missing property

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `returned_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `assignments_return_complete`: `CHECK ((((returned_at IS NULL) AND (return_condition IS NULL)) OR ((returned_at IS NOT NULL) AND (return_condition IS NOT NULL))))`

### return_condition

**In everyday language:** Condition or non-return outcome requiring stock/clearance reconciliation.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “ok” means Ok.

Technical definition: Condition or non-return outcome requiring stock/clearance reconciliation

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `return_condition: ReturnCondition \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `ok` | Ok. | DB CHECK: assignments_return_condition_check |
| `damaged` | Damaged. | DB CHECK: assignments_return_condition_check |
| `not_returned` | Not returned. | DB CHECK: assignments_return_condition_check |

Database rules (including conditions shared with other fields):

- `assignments_return_complete`: `CHECK ((((returned_at IS NULL) AND (return_condition IS NULL)) OR ((returned_at IS NOT NULL) AND (return_condition IS NOT NULL))))`
- `assignments_return_condition_check`: `CHECK ((return_condition = ANY (ARRAY['ok'::text, 'damaged'::text, 'not_returned'::text])))`

### notes

**In everyday language:** Issuance/return context retained with custody.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Issuance/return context retained with custody

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `notes: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### assigned_by

**In everyday language:** Identifies assigned by connected to this record.

**Why it is kept:** Keeps this record connected to the correct assigned by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s assigned by to FOREIGN KEY (assigned_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `assigned_by: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `assignments_assigned_by_fkey`: `FOREIGN KEY (assigned_by) REFERENCES core.users(id)`

### returned_by

**In everyday language:** Identifies returned by connected to this record.

**Why it is kept:** Keeps this record connected to the correct returned by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s returned by to FOREIGN KEY (returned_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `returned_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `assignments_returned_by_fkey`: `FOREIGN KEY (returned_by) REFERENCES core.users(id)`

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

- Index `assignments_employee_idx`: `CREATE INDEX assignments_employee_idx ON ast.assignments USING btree (employee_id) WHERE (employee_id IS NOT NULL)`
- Index `assignments_one_open_per_asset`: `CREATE UNIQUE INDEX assignments_one_open_per_asset ON ast.assignments USING btree (asset_id) WHERE (returned_at IS NULL)`
- Index `assignments_pkey`: `CREATE UNIQUE INDEX assignments_pkey ON ast.assignments USING btree (id)`

## ast.maintenance

Keeps the service, repair and damage history of company assets.

AST-06 maintenance, incident, damage and loss trail

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

- `maintenance_pkey`: `PRIMARY KEY (id)`

### asset_id

**In everyday language:** Identifies asset connected to this record.

**Why it is kept:** Keeps this record connected to the correct asset, so related details can be checked together.

**Example:** This record points to an existing entry in assets instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s asset id to FOREIGN KEY (asset_id) REFERENCES ast.assets(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | Yes |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `asset_id: number;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `maintenance_asset_id_fkey`: `FOREIGN KEY (asset_id) REFERENCES ast.assets(id)`

### kind

**In everyday language:** Scheduled service, incident, damage or loss category.

**Why it is kept:** Gives staff and the system a consistent choice for the classification described here.

**Example:** “scheduled” means Scheduled classification for kind.

Technical definition: Scheduled service, incident, damage or loss category

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `kind: MaintenanceKind;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `scheduled` | Scheduled classification for kind. | DB CHECK: maintenance_kind_check |
| `incident` | Incident classification for kind. | DB CHECK: maintenance_kind_check |
| `damage` | Damage classification for kind. | DB CHECK: maintenance_kind_check |
| `lost` | Lost classification for kind. | DB CHECK: maintenance_kind_check |

Database rules (including conditions shared with other fields):

- `maintenance_kind_check`: `CHECK ((kind = ANY (ARRAY['scheduled'::text, 'incident'::text, 'damage'::text, 'lost'::text])))`

### scheduled_for

**In everyday language:** Planned service calendar date.

**Why it is kept:** Places the information on the correct calendar date or applicable period.

**Example:** 11 Nov 2026 is a calendar date. Any start/end-date rules still apply.

Technical definition: Planned service calendar date

| Property | Definition |
|---|---|
| SQL type | `date` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `scheduled_for: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### reported_by

**In everyday language:** Identifies reported by connected to this record.

**Why it is kept:** Keeps this record connected to the correct reported by, so related details can be checked together.

**Example:** This record points to an existing entry in users instead of copying all of that entry’s details.

Technical definition: Reference linking this record’s reported by to FOREIGN KEY (reported_by) REFERENCES core.users(id).

| Property | Definition |
|---|---|
| SQL type | `bigint` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | database foreign key |
| Code declaration | `reported_by: number \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `maintenance_reported_by_fkey`: `FOREIGN KEY (reported_by) REFERENCES core.users(id)`

### description

**In everyday language:** Reported service/incident details.

**Why it is kept:** Preserves the explanation so another person can understand the record later.

**Example:** The saved wording answers the question described above; it should explain the specific case rather than just say “done”.

Technical definition: Reported service/incident details

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `description: string;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### resolved_at

**In everyday language:** Date and time the recorded asset maintenance/incident was resolved.

**Why it is kept:** Establishes the recorded timing or time boundary for this detail, so staff can interpret the record in the right order.

**Example:** A saved time might show 11 Nov 2026, 10:30 AM IST. For an expiry or deadline, this is a boundary, not evidence that an event happened. NULL means no time is recorded.

Technical definition: Instant the recorded asset maintenance/incident was resolved.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `resolved_at: Timestamp \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### resolution

**In everyday language:** Explanation of the recorded asset maintenance/incident resolution.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A reviewer reads the saved explanation to understand the particular case before taking the next action.

Technical definition: Explanation of the recorded asset maintenance/incident resolution.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `resolution: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### cost

**In everyday language:** Recorded service cost in rupees an exact number; not a payable history of additions and deductions.

**Why it is kept:** Keeps the specific money figure described here available for calculation, review or payment checking.

**Example:** ₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.

Technical definition: Recorded service cost in rupees NUMERIC; not a payable ledger

| Property | Definition |
|---|---|
| SQL type | `numeric(12,2)` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewer-authored field meaning (19 Oct 2026) |
| Code declaration | `cost: string \| null;` |
| Code source | [backend/src/core/db/types.ts](../../backend/src/core/db/types.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Units: Rupees unless an explicit currency field/definition says otherwise.

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `maintenance_cost_check`: `CHECK (((cost IS NULL) OR (cost >= (0)::numeric)))`

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

- Index `maintenance_asset_idx`: `CREATE INDEX maintenance_asset_idx ON ast.maintenance USING btree (asset_id, created_at DESC)`
- Index `maintenance_open_idx`: `CREATE INDEX maintenance_open_idx ON ast.maintenance USING btree (scheduled_for) WHERE (resolved_at IS NULL)`
- Index `maintenance_pkey`: `CREATE UNIQUE INDEX maintenance_pkey ON ast.maintenance USING btree (id)`

