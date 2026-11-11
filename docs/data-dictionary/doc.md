# doc — field dictionary

11 fields. Catalog captured 2026-11-11T04:50:11.132Z. [Dictionary guide](README.md).

## doc.types

doc.types — which document kinds exist, and whether they expire / are mandatory.

Relation kind: table.

### code

Canonical document classification key; existing core.documents.doc_type FK, legacy kind fallback only.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `code: string;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `types_code_present`: `CHECK ((length(btrim(code)) > 0))`
- `types_pkey`: `PRIMARY KEY (code)`

### name

Employee/HR-facing catalog label.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `name: string;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `types_name_present`: `CHECK ((length(btrim(name)) > 0))`

### typically_expires

Requires expiry at vault upload; classifies attention on read, not delivered reminders.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `typically_expires: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### retention_class

Document purpose/security class; statutory_id and health classes require extra field authority. Retention/purge enforcement remains open.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | No (NULL allowed; NULL is distinct from zero/false/empty) |
| Default | No database default |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `retention_class: string \| null;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### mandatory_for

Comma-separated employment categories; empty = never mandatory by category.

| Property | Definition |
|---|---|
| SQL type | `text` |
| Required | Yes |
| Default | ''::text |
| Definition basis | backend/src/core/db/types.doc.ts:16 |
| Code declaration | `mandatory_for: Generated<string>;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### sort_order

Stable catalog/checklist presentation order, not policy priority.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 100 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `sort_order: Generated<number>;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### is_active

Catalog availability for new uploads/active vault reads; retirement lifecycle/history handling requires full acceptance.

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | true |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `is_active: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### created_at

Catalog provenance timestamp.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `created_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### updated_at

Catalog modification timestamp; not a versioned retention policy.

| Property | Definition |
|---|---|
| SQL type | `timestamp with time zone` |
| Required | Yes |
| Default | now() |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `updated_at: DefaultedTimestamp;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### joining_checklist

Shown on the joining document checklist (REQ-004).

| Property | Definition |
|---|---|
| SQL type | `boolean` |
| Required | Yes |
| Default | false |
| Definition basis | backend/src/core/db/types.doc.ts:20 |
| Code declaration | `joining_checklist: Generated<boolean>;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Allowed entries (source distinguishes database enforcement from code declarations):

| Entry | Meaning | Source |
|---|---|---|
| `true` | The condition described by this field is enabled/true. | SQL boolean |
| `false` | The condition described by this field is disabled/false. | SQL boolean |

Database rules: no column-linked constraint in the captured catalog beyond the type/nullability/default above.

### max_files

Documented joining checklist per-type file limit; current recovered vault does not enforce it. Define scope/version semantics before connecting; do not claim active constraint.

| Property | Definition |
|---|---|
| SQL type | `smallint` |
| Required | Yes |
| Default | 1 |
| Definition basis | reviewed field purpose (19 Oct 2026) |
| Code declaration | `max_files: Generated<number>;` |
| Code source | [backend/src/core/db/types.doc.ts](../../backend/src/core/db/types.doc.ts) |
| Scope | Defined; documentation does not certify end-to-end implementation |

Value domain: no finite value list extracted. Use the SQL/code type and the complete rules below. Foreign-key values come from the referenced catalog; free text and extensible JSON have no invented fixed list.

Database rules (including conditions shared with other fields):

- `types_max_files_check`: `CHECK (((max_files >= 1) AND (max_files <= 20)))`

Table indexes and lifecycle triggers:

- Index `types_pkey`: `CREATE UNIQUE INDEX types_pkey ON doc.types USING btree (code)`
- Trigger `doc_types_updated_at` → `core.set_updated_at` (enabled flag `O`).

