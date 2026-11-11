# Technical maintenance history — everyday-language guide

[Start here](README.md). Examples are made up to explain the meaning; they are not employee data or policy instructions.

## public.pgmigrations

Records database maintenance updates applied by the technical migration tool.

| Field | What it means | Why it is kept | Simple example | Choices, where listed |
|---|---|---|---|---|
| `id` | The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register. | Allows the correct record to be found and linked without relying on a name or description. | If two records have the same display name, their internal numbers still tell them apart. | Read the saved detail using its explanation; there is no fixed choice list shown here. |
| `name` | Migration file/version name recorded by the migration runner; infrastructure bookkeeping, not a business list of available choices name. | Keeps this specific detail with the record so staff can identify, explain or check it in context. | This is the name shown when staff read this record. For example, the same named person or place can appear in several records without making those records the same item. | Read the saved detail using its explanation; there is no fixed choice list shown here. |
| `run_on` | Date and time the migration runner recorded execution of this migration. | Keeps this specific detail with the record so staff can identify, explain or check it in context. | A time such as 9 AM describes the timing of this particular activity; whether a calendar date is also stored depends on the field. | Read the saved detail using its explanation; there is no fixed choice list shown here. |

