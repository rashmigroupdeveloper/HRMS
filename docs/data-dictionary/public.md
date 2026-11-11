# public — field dictionary

3 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## public.pgmigrations

Pgmigrations records; consult the field definitions and governing module specification.

Relation kind: table.

### id

Migration-runner bookkeeping row identity; not an employee or business identifier.

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

Migration file/version name recorded by the migration runner; infrastructure bookkeeping, not a business catalog name.

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

Instant the migration runner recorded execution of this migration.

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

