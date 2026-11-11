# public — field dictionary

3 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## public.pgmigrations

Records database maintenance updates applied by the technical migration tool.

Pgmigrations records; consult the field definitions and governing module specification.

Relation kind: table.

### id

**In everyday language:** The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.

**Why it is kept:** Allows the correct record to be found and linked without relying on a name or description.

**Example:** If two records have the same display name, their internal numbers still tell them apart.

Technical definition: Migration-runner bookkeeping row identity; not an employee or business identifier.

| Property | Definition |
|---|---|
| SQL type | `integer` |
| Required | Yes |
| Default | nextval('pgmigrations_id_seq'::regclass) |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `Not part of application Database interface` |
| Code source | Migration runner |
| Scope | Migration infrastructure; excluded from application-field count |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `pgmigrations_pkey`: `PRIMARY KEY (id)`

### name

**In everyday language:** Migration file/version name recorded by the migration runner; infrastructure bookkeeping, not a business list of available choices name.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item.

Technical definition: Migration file/version name recorded by the migration runner; infrastructure bookkeeping, not a business catalog name.

| Property | Definition |
|---|---|
| SQL type | `character varying(255)` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; grounded in docs/03, docs/04 and current declaration |
| Code declaration | `Not part of application Database interface` |
| Code source | Migration runner |
| Scope | Migration infrastructure; excluded from application-field count |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### run_on

**In everyday language:** Date and time the migration runner recorded execution of this migration.

**Why it is kept:** Keeps this specific detail with the record so staff can identify, explain or check it in context.

**Example:** A time such as 9 AM describes the timing of this particular activity; whether a calendar date is also stored depends on the field.

Technical definition: Instant the migration runner recorded execution of this migration.

| Property | Definition |
|---|---|
| SQL type | `timestamp without time zone` |
| Required | Yes |
| Default | No database default |
| Definition basis | dictionary supplement; docs/03, docs/04 and current catalog |
| Code declaration | `Not part of application Database interface` |
| Code source | Migration runner |
| Scope | Migration infrastructure; excluded from application-field count |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

Table indexes and lifecycle triggers:

- Index `pgmigrations_pkey`: `CREATE UNIQUE INDEX pgmigrations_pkey ON public.pgmigrations USING btree (id)`

