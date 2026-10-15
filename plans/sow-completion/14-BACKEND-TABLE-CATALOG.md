# Backend table and field catalog

Prepared 2026-10-10. Complete union of 82 docs03 table definitions, 104 unpartitioned local business relations, proposed models and explicitly blocked recruitment domains. Existing physical names, column types/nullability/defaults, constraints, indexes and trigger definitions come from a read-only `hrms` catalog capture. Partitions are retained in the machine snapshot and not counted as separate business models. **Catalog presence does not prove code, policy approval or migration provenance.**

Baseline SQL below is exact specification evidence, including old simplifications; docs14/approved amendments and pack15 changes govern completion. Common docs03 ID/timestamp conventions are explicit there. Do not execute source fragments as migrations. The guarded SQL drafts normalize identity shorthand but are review material, not a verified migration chain.

See [schema plan](13-BACKEND-SCHEMA-PLAN.md), [changes](15-BACKEND-SCHEMA-CHANGES.md), `backend-schema-plan.json` and the current source inventories.


## ast.assets

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:782`.

```sql

CREATE TABLE ast.assets (
  asset_no TEXT UNIQUE NOT NULL,    -- searchable id (AR-1; Task-Matrix filter gap)
  category TEXT NOT NULL,           -- 'laptop'|'phone'|'sim'|'vehicle'|...
  description TEXT, serial_no TEXT,
  purchase_date DATE, warranty_till DATE,  -- past dates ALLOWED (AR-2 — greytHR blocked them)
  status TEXT NOT NULL DEFAULT 'in_stock', -- 'in_stock'|'assigned'|'maintenance'|'lost'|'scrapped'
  location_id BIGINT REFERENCES core.locations
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| asset_no | text | NO | — |

| category | text | NO | — |

| description | text | YES | — |

| serial_no | text | YES | — |

| purchase_date | date | YES | — |

| warranty_till | date | YES | — |

| status | text | NO | 'in_stock'::text |

| location_id | bigint | YES | — |

| company_id | bigint | NO | — |

| created_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `assets_asset_no_key`: `UNIQUE (asset_no)`

- Constraint `assets_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `assets_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

- Constraint `assets_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `assets_pkey`: `PRIMARY KEY (id)`

- Constraint `assets_status_check`: `CHECK (status = ANY (ARRAY['in_stock'::text, 'assigned'::text, 'maintenance'::text, 'lost'::text, 'scrapped'::text]))`

- Index `assets_asset_no_key`: `CREATE UNIQUE INDEX assets_asset_no_key ON ast.assets USING btree (asset_no)`

- Index `assets_asset_no_trgm`: `CREATE INDEX assets_asset_no_trgm ON ast.assets USING gin (lower(asset_no) gin_trgm_ops)`

- Index `assets_description_trgm`: `CREATE INDEX assets_description_trgm ON ast.assets USING gin (lower(COALESCE(description, ''::text)) gin_trgm_ops)`

- Index `assets_pkey`: `CREATE UNIQUE INDEX assets_pkey ON ast.assets USING btree (id)`

- Index `assets_search_idx`: `CREATE INDEX assets_search_idx ON ast.assets USING btree (company_id, status, category)`

- Index `assets_serial_idx`: `CREATE INDEX assets_serial_idx ON ast.assets USING btree (serial_no) WHERE (serial_no IS NOT NULL)`

- Index `assets_serial_trgm`: `CREATE INDEX assets_serial_trgm ON ast.assets USING gin (lower(COALESCE(serial_no, ''::text)) gin_trgm_ops)`


## ast.assignments

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** L04, W01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:791`.

```sql

CREATE TABLE ast.assignments (
  asset_id BIGINT NOT NULL REFERENCES ast.assets,
  holder_kind TEXT NOT NULL,        -- 'employee'|'third_party' (AR-3 dropdown)
  employee_id BIGINT REFERENCES core.employees,
  third_party_name TEXT, third_party_org TEXT, -- when holder_kind='third_party'
  assigned_at TIMESTAMPTZ NOT NULL, returned_at TIMESTAMPTZ,
  return_condition TEXT,            -- 'ok'|'damaged'|'not_returned' (AST-05 dashboard; exit clearance AST-04)
  assigned_by BIGINT NOT NULL REFERENCES core.users
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| asset_id | bigint | NO | — |

| holder_kind | text | NO | — |

| employee_id | bigint | YES | — |

| third_party_name | text | YES | — |

| third_party_org | text | YES | — |

| assigned_at | timestamp with time zone | NO | now() |

| returned_at | timestamp with time zone | YES | — |

| return_condition | text | YES | — |

| notes | text | YES | — |

| assigned_by | bigint | NO | — |

| returned_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `assignments_asset_id_fkey`: `FOREIGN KEY (asset_id) REFERENCES ast.assets(id)`

- Constraint `assignments_assigned_by_fkey`: `FOREIGN KEY (assigned_by) REFERENCES core.users(id)`

- Constraint `assignments_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `assignments_holder_kind_check`: `CHECK (holder_kind = ANY (ARRAY['employee'::text, 'third_party'::text]))`

- Constraint `assignments_holder_xor`: `CHECK (holder_kind = 'employee'::text AND employee_id IS NOT NULL AND third_party_name IS NULL OR holder_kind = 'third_party'::text AND employee_id IS NULL AND third_party_name IS NOT NULL)`

- Constraint `assignments_pkey`: `PRIMARY KEY (id)`

- Constraint `assignments_return_complete`: `CHECK (returned_at IS NULL AND return_condition IS NULL OR returned_at IS NOT NULL AND return_condition IS NOT NULL)`

- Constraint `assignments_return_condition_check`: `CHECK (return_condition = ANY (ARRAY['ok'::text, 'damaged'::text, 'not_returned'::text]))`

- Constraint `assignments_returned_by_fkey`: `FOREIGN KEY (returned_by) REFERENCES core.users(id)`

- Index `assignments_employee_idx`: `CREATE INDEX assignments_employee_idx ON ast.assignments USING btree (employee_id) WHERE (employee_id IS NOT NULL)`

- Index `assignments_one_open_per_asset`: `CREATE UNIQUE INDEX assignments_one_open_per_asset ON ast.assignments USING btree (asset_id) WHERE (returned_at IS NULL)`

- Index `assignments_pkey`: `CREATE UNIQUE INDEX assignments_pkey ON ast.assignments USING btree (id)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## ast.custody_events

**Status:** PROPOSED AMENDMENT. **Cards:** L04, W01.

**Proposed grain:** One immutable physical receipt/loss/clearance disposition. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## ast.maintenance

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:801`.

```sql

CREATE TABLE ast.maintenance (      -- AST-06 (SOW-8.2)
  asset_id BIGINT NOT NULL REFERENCES ast.assets,
  kind TEXT NOT NULL,               -- 'scheduled'|'incident'|'damage'
  scheduled_for DATE, reported_by BIGINT REFERENCES core.users,
  description TEXT NOT NULL, resolved_at TIMESTAMPTZ, cost NUMERIC(12,2)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| asset_id | bigint | NO | — |

| kind | text | NO | — |

| scheduled_for | date | YES | — |

| reported_by | bigint | YES | — |

| description | text | NO | — |

| resolved_at | timestamp with time zone | YES | — |

| resolution | text | YES | — |

| cost | numeric(12,2) | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `maintenance_asset_id_fkey`: `FOREIGN KEY (asset_id) REFERENCES ast.assets(id)`

- Constraint `maintenance_cost_check`: `CHECK (cost IS NULL OR cost >= 0::numeric)`

- Constraint `maintenance_kind_check`: `CHECK (kind = ANY (ARRAY['scheduled'::text, 'incident'::text, 'damage'::text, 'lost'::text]))`

- Constraint `maintenance_pkey`: `PRIMARY KEY (id)`

- Constraint `maintenance_reported_by_fkey`: `FOREIGN KEY (reported_by) REFERENCES core.users(id)`

- Index `maintenance_asset_idx`: `CREATE INDEX maintenance_asset_idx ON ast.maintenance USING btree (asset_id, created_at DESC)`

- Index `maintenance_open_idx`: `CREATE INDEX maintenance_open_idx ON ast.maintenance USING btree (scheduled_for) WHERE (resolved_at IS NULL)`

- Index `maintenance_pkey`: `CREATE UNIQUE INDEX maintenance_pkey ON ast.maintenance USING btree (id)`


## att.absence_cases

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A05.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:378`.

```sql

CREATE TABLE att.absence_cases (    -- ATT-10: 7–10 day continuous-absence engine
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  start_date DATE NOT NULL,
  days_absent SMALLINT NOT NULL,        -- rolling count while open
  stage TEXT NOT NULL DEFAULT 'watch',  -- 'watch'(≥4d) → 'show_cause'(≥7d) → 'warning' → 'termination_review' (PP-7 strict process)
  letter_id BIGINT REFERENCES core.letters,  -- issued show-cause/warning letter
  hr_owner_id BIGINT REFERENCES core.users,  -- routed 'through an official HR email' (PP-9 instruction)
  resolution TEXT,                       -- 'returned'|'regularized'|'exited'|NULL while open
  closed_at TIMESTAMPTZ
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| start_date | date | NO | — |

| days_absent | smallint | NO | — |

| stage | text | NO | 'watch'::text |

| letter_id | bigint | YES | — |

| hr_owner_id | bigint | YES | — |

| resolution | text | YES | — |

| closed_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `absence_cases_check`: `CHECK ((resolution IS NULL) = (closed_at IS NULL))`

- Constraint `absence_cases_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `absence_cases_hr_owner_id_fkey`: `FOREIGN KEY (hr_owner_id) REFERENCES core.users(id)`

- Constraint `absence_cases_letter_id_fkey`: `FOREIGN KEY (letter_id) REFERENCES core.letters(id)`

- Constraint `absence_cases_pkey`: `PRIMARY KEY (id)`

- Constraint `absence_cases_resolution_check`: `CHECK (resolution = ANY (ARRAY['returned'::text, 'regularized'::text, 'exited'::text]))`

- Constraint `absence_cases_stage_check`: `CHECK (stage = ANY (ARRAY['watch'::text, 'show_cause'::text, 'warning'::text, 'termination_review'::text]))`

- Index `absence_cases_one_open`: `CREATE UNIQUE INDEX absence_cases_one_open ON att.absence_cases USING btree (employee_id) WHERE (closed_at IS NULL)`

- Index `absence_cases_pkey`: `CREATE UNIQUE INDEX absence_cases_pkey ON att.absence_cases USING btree (id)`

- Trigger `absence_cases_updated_at`: `CREATE TRIGGER absence_cases_updated_at BEFORE UPDATE ON att.absence_cases FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## att.coverage_targets

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** A02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| location_id | bigint | NO | — |

| department_id | bigint | YES | — |

| shift_id | bigint | NO | — |

| weekday | smallint | NO | — |

| sanctioned | integer | NO | — |

| updated_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `coverage_targets_department_id_fkey`: `FOREIGN KEY (department_id) REFERENCES core.departments(id)`

- Constraint `coverage_targets_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `coverage_targets_pkey`: `PRIMARY KEY (id)`

- Constraint `coverage_targets_sanctioned_check`: `CHECK (sanctioned >= 0)`

- Constraint `coverage_targets_shift_id_fkey`: `FOREIGN KEY (shift_id) REFERENCES att.shifts(id)`

- Constraint `coverage_targets_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES core.users(id)`

- Constraint `coverage_targets_weekday_check`: `CHECK (weekday >= 0 AND weekday <= 6)`

- Index `coverage_targets_pkey`: `CREATE UNIQUE INDEX coverage_targets_pkey ON att.coverage_targets USING btree (id)`

- Index `coverage_targets_scope`: `CREATE UNIQUE INDEX coverage_targets_scope ON att.coverage_targets USING btree (location_id, weekday, shift_id, COALESCE(department_id, (0)::bigint))`

- Trigger `coverage_targets_updated_at`: `CREATE TRIGGER coverage_targets_updated_at BEFORE UPDATE ON att.coverage_targets FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.day_records

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A02, A05, X01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:330`.

```sql

CREATE TABLE att.day_records (      -- PROCESSED attendance; recomputable from raw until locked (ATT-03)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  work_date DATE NOT NULL,
  shift_id BIGINT REFERENCES att.shifts,           -- effective shift that day (roster resolution)
  status att.day_status NOT NULL,
  leave_type_id BIGINT REFERENCES lv.leave_types,  -- when status='L': which leave
  first_in TIMESTAMPTZ, last_out TIMESTAMPTZ,      -- from swipes; muster drill-down
  worked_minutes INTEGER,                          -- net of break; feeds OT + productivity KPIs (CEO: output/man-hour)
  late_minutes SMALLINT NOT NULL DEFAULT 0,        -- vs shift start + grace (ATT-11 alerts, deduction policy SOW-4.5b)
  early_exit_minutes SMALLINT NOT NULL DEFAULT 0,
  ot_minutes SMALLINT NOT NULL DEFAULT 0,          -- detected OT (pre-approval); payable only via att.overtime_entries
  weekoff_paid BOOLEAN,                            -- week-off eligibility outcome (ATT-09): computed at week close
  source TEXT NOT NULL DEFAULT 'auto',             -- 'auto'|'regularized'|'manual' — manual requires HR permission + audit
  is_locked BOOLEAN NOT NULL DEFAULT false,        -- month lock (ATT-15); locked rows immutable by trigger
  session_statuses JSONB,                          -- ordered sessions 1/2 with P/A/O; A:P, P:A, P:O (09-RECON §4); NULL = single-status day. Daily status remains the explicit summary; O is off, not absent.
  scheme_code TEXT,                                -- effective attendance scheme that day (e.g. 'GCS' Saturday scheme vs weekday 'G5')
  penalty_flag BOOLEAN NOT NULL DEFAULT false,     -- attendance-penalty policy outcome ("Penalty Days" live metric)
  computed_at TIMESTAMPTZ,
  UNIQUE(employee_id, work_date)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| work_date | date | NO | — |

| shift_id | bigint | YES | — |

| status | day_status | NO | — |

| leave_type_id | bigint | YES | — |

| first_in | timestamp with time zone | YES | — |

| last_out | timestamp with time zone | YES | — |

| worked_minutes | integer | YES | — |

| late_minutes | smallint | NO | 0 |

| early_exit_minutes | smallint | NO | 0 |

| ot_minutes | smallint | NO | 0 |

| weekoff_paid | boolean | YES | — |

| session_statuses | jsonb | YES | — |

| scheme_code | text | YES | — |

| penalty_flag | boolean | NO | false |

| source | text | NO | 'auto'::text |

| override_reason | text | YES | — |

| is_locked | boolean | NO | false |

| computed_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `day_records_check`: `CHECK (source <> 'manual'::text OR override_reason IS NOT NULL)`

- Constraint `day_records_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `day_records_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

- Constraint `day_records_leave_type_fk`: `FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id)`

- Constraint `day_records_minutes_nonnegative`: `CHECK (worked_minutes IS NULL OR worked_minutes >= 0) NOT VALID`

- Constraint `day_records_pkey`: `PRIMARY KEY (id)`

- Constraint `day_records_session_statuses_valid`: `CHECK ( CASE     WHEN session_statuses IS NULL THEN true     WHEN jsonb_typeof(session_statuses) <> 'array'::text THEN false     ELSE COALESCE(jsonb_array_length(session_statuses) = 2 AND ((session_statuses -> 0) -> 'session'::text) = '1'::jsonb AND ((session_statuses -> 1) -> 'session'::text) = '2'::jsonb AND (((session_statuses -> 0) ->> 'status'::text) = ANY (ARRAY['P'::text, 'A'::text, 'O'::text])) AND (((session_statuses -> 1) ->> 'status'::text) = ANY (ARRAY['P'::text, 'A'::text, 'O'::text])), false) END) NOT VALID`

- Constraint `day_records_shift_id_fkey`: `FOREIGN KEY (shift_id) REFERENCES att.shifts(id)`

- Constraint `day_records_source_check`: `CHECK (source = ANY (ARRAY['auto'::text, 'regularized'::text, 'manual'::text]))`

- Index `day_records_date_status_idx`: `CREATE INDEX day_records_date_status_idx ON att.day_records USING btree (work_date, status)`

- Index `day_records_employee_id_work_date_key`: `CREATE UNIQUE INDEX day_records_employee_id_work_date_key ON att.day_records USING btree (employee_id, work_date)`

- Index `day_records_pkey`: `CREATE UNIQUE INDEX day_records_pkey ON att.day_records USING btree (id)`

- Trigger `day_records_invalidate_manager_approval`: `CREATE TRIGGER day_records_invalidate_manager_approval AFTER INSERT OR DELETE OR UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION att.invalidate_manager_month_approval()`

- Trigger `day_records_lock_guard`: `CREATE TRIGGER day_records_lock_guard BEFORE DELETE OR UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION att.day_records_lock_guard()`

- Trigger `day_records_month_lock_guard`: `CREATE TRIGGER day_records_month_lock_guard BEFORE INSERT OR UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION att.day_records_month_lock_guard()`

- Trigger `day_records_updated_at`: `CREATE TRIGGER day_records_updated_at BEFORE UPDATE ON att.day_records FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## att.device_watermarks

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:273`.

```sql

CREATE TABLE att.device_watermarks ( -- P1-T07 / doc 14 §8.5: completeness, distinct from heartbeat/source cursor
  device_id BIGINT PRIMARY KEY REFERENCES att.devices ON DELETE CASCADE,
  watermark_ts TIMESTAMPTZ NOT NULL, -- connector has proved this door has no ingestion gap through this instant
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| device_id | bigint | NO | — |

| watermark_ts | timestamp with time zone | NO | — |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `device_watermarks_device_id_fkey`: `FOREIGN KEY (device_id) REFERENCES att.devices(id) ON DELETE CASCADE`

- Constraint `device_watermarks_pkey`: `PRIMARY KEY (device_id)`

- Index `device_watermarks_pkey`: `CREATE UNIQUE INDEX device_watermarks_pkey ON att.device_watermarks USING btree (device_id)`

- Index `device_watermarks_ts_idx`: `CREATE INDEX device_watermarks_ts_idx ON att.device_watermarks USING btree (watermark_ts)`

- Trigger `device_watermark_monotonic`: `CREATE TRIGGER device_watermark_monotonic BEFORE UPDATE ON att.device_watermarks FOR EACH ROW EXECUTE FUNCTION att.device_watermark_monotonic()`


## att.devices

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:264`.

```sql

CREATE TABLE att.devices (          -- Kent/Astra doors ('Seamless-Plant_S4', 'Seamless-Plant_G4') — health board (ATT-02)
  source TEXT NOT NULL,             -- 'kent' | 'mobile'
  door_code TEXT UNIQUE NOT NULL,   -- Door/Address from swipe export
  location_id BIGINT REFERENCES core.locations,
  last_seen_at TIMESTAMPTZ,         -- gap detection input
  expected_hourly_swipes NUMERIC(8,2), -- rolling average; zero-against-average triggers offline alert
  is_active BOOLEAN NOT NULL DEFAULT true
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| source | text | NO | 'kent'::text |

| door_code | text | NO | — |

| location_id | bigint | YES | — |

| last_seen_at | timestamp with time zone | YES | — |

| expected_hourly_swipes | numeric(8,2) | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| alerted_silent_at | timestamp with time zone | YES | — |

**Observed integrity and access hooks:**

- Constraint `devices_door_code_key`: `UNIQUE (door_code)`

- Constraint `devices_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `devices_pkey`: `PRIMARY KEY (id)`

- Index `devices_door_code_key`: `CREATE UNIQUE INDEX devices_door_code_key ON att.devices USING btree (door_code)`

- Index `devices_pkey`: `CREATE UNIQUE INDEX devices_pkey ON att.devices USING btree (id)`

- Trigger `devices_updated_at`: `CREATE TRIGGER devices_updated_at BEFORE UPDATE ON att.devices FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## att.employee_shifts

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| employee_id | bigint | NO | — |

| weekday_shift_id | bigint | NO | — |

| saturday_shift_id | bigint | YES | — |

| updated_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `employee_shifts_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `employee_shifts_pkey`: `PRIMARY KEY (employee_id)`

- Constraint `employee_shifts_saturday_shift_id_fkey`: `FOREIGN KEY (saturday_shift_id) REFERENCES att.shifts(id)`

- Constraint `employee_shifts_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES core.users(id)`

- Constraint `employee_shifts_weekday_shift_id_fkey`: `FOREIGN KEY (weekday_shift_id) REFERENCES att.shifts(id)`

- Index `employee_shifts_pkey`: `CREATE UNIQUE INDEX employee_shifts_pkey ON att.employee_shifts USING btree (employee_id)`

- Trigger `employee_shifts_updated_at`: `CREATE TRIGGER employee_shifts_updated_at BEFORE UPDATE ON att.employee_shifts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.holidays

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:319`.

```sql

CREATE TABLE att.holidays (         -- ATT-13; per location
  location_id BIGINT NOT NULL REFERENCES core.locations,
  holiday_date DATE NOT NULL, name TEXT NOT NULL,
  UNIQUE(location_id, holiday_date)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| location_id | bigint | YES | — |

| holiday_date | date | NO | — |

| name | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `holidays_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `holidays_pkey`: `PRIMARY KEY (id)`

- Index `holidays_company_wide_date_uq`: `CREATE UNIQUE INDEX holidays_company_wide_date_uq ON att.holidays USING btree (holiday_date) WHERE (location_id IS NULL)`

- Index `holidays_location_date_uq`: `CREATE UNIQUE INDEX holidays_location_date_uq ON att.holidays USING btree (location_id, holiday_date) WHERE (location_id IS NOT NULL)`

- Index `holidays_pkey`: `CREATE UNIQUE INDEX holidays_pkey ON att.holidays USING btree (id)`

- Trigger `holidays_updated_at`: `CREATE TRIGGER holidays_updated_at BEFORE UPDATE ON att.holidays FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## att.ingest_watermarks

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A01.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| source | text | NO | — |

| watermark_ts | timestamp with time zone | NO | — |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `ingest_watermarks_pkey`: `PRIMARY KEY (source)`

- Index `ingest_watermarks_pkey`: `CREATE UNIQUE INDEX ingest_watermarks_pkey ON att.ingest_watermarks USING btree (source)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.leave_blackouts

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| blackout_date | date | NO | — |

| location_id | bigint | YES | — |

| name | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `leave_blackouts_location_id_blackout_date_key`: `UNIQUE (location_id, blackout_date)`

- Constraint `leave_blackouts_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `leave_blackouts_pkey`: `PRIMARY KEY (id)`

- Index `leave_blackouts_location_id_blackout_date_key`: `CREATE UNIQUE INDEX leave_blackouts_location_id_blackout_date_key ON att.leave_blackouts USING btree (location_id, blackout_date)`

- Index `leave_blackouts_pkey`: `CREATE UNIQUE INDEX leave_blackouts_pkey ON att.leave_blackouts USING btree (id)`

- Trigger `leave_blackouts_updated_at`: `CREATE TRIGGER leave_blackouts_updated_at BEFORE UPDATE ON att.leave_blackouts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.manager_month_approvals

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A05.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| month | date | NO | — |

| manager_employee_id | bigint | NO | — |

| approved_by_user_id | bigint | YES | — |

| approved_at | timestamp with time zone | NO | now() |

| note | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

| event_type | text | NO | 'approve'::text |

**Observed integrity and access hooks:**

- Constraint `manager_month_approvals_approved_by_user_id_fkey`: `FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id)`

- Constraint `manager_month_approvals_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `manager_month_approvals_event_type_check`: `CHECK (event_type = ANY (ARRAY['approve'::text, 'invalidate'::text]))`

- Constraint `manager_month_approvals_manager_employee_id_fkey`: `FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id)`

- Constraint `manager_month_approvals_pkey`: `PRIMARY KEY (id)`

- Index `manager_month_approvals_latest_idx`: `CREATE INDEX manager_month_approvals_latest_idx ON att.manager_month_approvals USING btree (company_id, month, manager_employee_id, id DESC)`

- Index `manager_month_approvals_lookup_idx`: `CREATE INDEX manager_month_approvals_lookup_idx ON att.manager_month_approvals USING btree (company_id, month)`

- Index `manager_month_approvals_pkey`: `CREATE UNIQUE INDEX manager_month_approvals_pkey ON att.manager_month_approvals USING btree (id)`

- Trigger `manager_month_approvals_append_only`: `CREATE TRIGGER manager_month_approvals_append_only BEFORE DELETE OR UPDATE ON att.manager_month_approvals FOR EACH ROW EXECUTE FUNCTION att.reject_manager_approval_mutation()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.mobile_submissions

**Status:** PROPOSED AMENDMENT. **Cards:** X01.

**Proposed grain:** One authenticated mobile capture/queue attempt. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## att.month_locks

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A05, P02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:389`.

```sql

CREATE TABLE att.month_locks (      -- ATT-15; payroll precondition
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL,              -- first of month
  locked_by BIGINT NOT NULL REFERENCES core.users, locked_at TIMESTAMPTZ NOT NULL,
  UNIQUE(company_id, month)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| month | date | NO | — |

| locked_by | bigint | NO | — |

| locked_at | timestamp with time zone | NO | now() |

| checklist | jsonb | NO | '{}'::jsonb |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `month_locks_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `month_locks_company_id_month_key`: `UNIQUE (company_id, month)`

- Constraint `month_locks_first_day_check`: `CHECK (month = date_trunc('month'::text, month::timestamp with time zone)::date)`

- Constraint `month_locks_locked_by_fkey`: `FOREIGN KEY (locked_by) REFERENCES core.users(id)`

- Constraint `month_locks_pkey`: `PRIMARY KEY (id)`

- Index `month_locks_company_id_month_key`: `CREATE UNIQUE INDEX month_locks_company_id_month_key ON att.month_locks USING btree (company_id, month)`

- Index `month_locks_pkey`: `CREATE UNIQUE INDEX month_locks_pkey ON att.month_locks USING btree (id)`

- Trigger `month_locks_immutable`: `CREATE TRIGGER month_locks_immutable BEFORE DELETE OR UPDATE ON att.month_locks FOR EACH ROW EXECUTE FUNCTION att.month_locks_immutable()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## att.overtime_entries

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A03, P02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:363`.

```sql

CREATE TABLE att.overtime_entries ( -- ATT-08: the 48-hour rule
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  work_date DATE NOT NULL,
  detected_minutes SMALLINT NOT NULL,   -- from swipes beyond shift
  claimed_minutes SMALLINT NOT NULL,    -- what goes for approval (≤ detected; rounding policy applied)
  approved_minutes SMALLINT,            -- manager decision
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'approved'|'rejected'|'lapsed'|'converted_comp_off'
  manager_id BIGINT REFERENCES core.employees, -- who must act (daily OT summary recipient)
  decided_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ NOT NULL,     -- intimation + 48h (Protiviti Status doc); lapse job flips status
  comp_off_credit_id BIGINT REFERENCES lv.ledger, -- set when employee/policy chose comp-off instead of pay (Agreement 5.1.6)
  payroll_item_id BIGINT,               -- set when paid — proves each OT minute lands in exactly one place
  UNIQUE(employee_id, work_date)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| work_date | date | NO | — |

| detected_minutes | smallint | NO | — |

| claimed_minutes | smallint | NO | — |

| approved_minutes | smallint | YES | — |

| status | text | NO | 'pending'::text |

| manager_id | bigint | YES | — |

| decided_at | timestamp with time zone | YES | — |

| deadline_at | timestamp with time zone | NO | — |

| workflow_request_id | bigint | YES | — |

| comp_off_credit_id | bigint | YES | — |

| payroll_item_id | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `overtime_entries_check`: `CHECK (claimed_minutes <= detected_minutes)`

- Constraint `overtime_entries_check1`: `CHECK (approved_minutes IS NULL OR approved_minutes <= claimed_minutes)`

- Constraint `overtime_entries_check2`: `CHECK (comp_off_credit_id IS NULL OR payroll_item_id IS NULL)`

- Constraint `overtime_entries_comp_off_credit_fk`: `FOREIGN KEY (comp_off_credit_id) REFERENCES lv.ledger(id)`

- Constraint `overtime_entries_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `overtime_entries_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

- Constraint `overtime_entries_manager_id_fkey`: `FOREIGN KEY (manager_id) REFERENCES core.employees(id)`

- Constraint `overtime_entries_pkey`: `PRIMARY KEY (id)`

- Constraint `overtime_entries_status_check`: `CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'lapsed'::text, 'converted_comp_off'::text]))`

- Constraint `overtime_entries_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `overtime_entries_employee_id_work_date_key`: `CREATE UNIQUE INDEX overtime_entries_employee_id_work_date_key ON att.overtime_entries USING btree (employee_id, work_date)`

- Index `overtime_entries_pkey`: `CREATE UNIQUE INDEX overtime_entries_pkey ON att.overtime_entries USING btree (id)`

- Index `overtime_pending_idx`: `CREATE INDEX overtime_pending_idx ON att.overtime_entries USING btree (manager_id, status) WHERE (status = 'pending'::text)`

- Index `overtime_wf_idx`: `CREATE UNIQUE INDEX overtime_wf_idx ON att.overtime_entries USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL)`

- Trigger `overtime_entries_updated_at`: `CREATE TRIGGER overtime_entries_updated_at BEFORE UPDATE ON att.overtime_entries FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## att.quarantined_swipes

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A01, X01.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_no | text | NO | — |

| swipe_ts | timestamp with time zone | NO | — |

| door_code | text | YES | — |

| direction | text | YES | — |

| swipe_type | text | YES | — |

| received_at | timestamp with time zone | NO | — |

| source | text | NO | — |

| reason | text | NO | — |

| reviewed | boolean | NO | false |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `quarantined_swipes_employee_no_swipe_ts_door_code_source_key`: `UNIQUE (employee_no, swipe_ts, door_code, source)`

- Constraint `quarantined_swipes_pkey`: `PRIMARY KEY (id)`

- Index `quarantined_swipes_employee_no_swipe_ts_door_code_source_key`: `CREATE UNIQUE INDEX quarantined_swipes_employee_no_swipe_ts_door_code_source_key ON att.quarantined_swipes USING btree (employee_no, swipe_ts, door_code, source)`

- Index `quarantined_swipes_pkey`: `CREATE UNIQUE INDEX quarantined_swipes_pkey ON att.quarantined_swipes USING btree (id)`

- Index `quarantined_swipes_review_idx`: `CREATE INDEX quarantined_swipes_review_idx ON att.quarantined_swipes USING btree (reviewed, created_at)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.recompute_queue

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| employee_id | bigint | NO | — |

| work_date | date | NO | — |

| queued_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `recompute_queue_pkey`: `PRIMARY KEY (employee_id, work_date)`

- Index `recompute_queue_pkey`: `CREATE UNIQUE INDEX recompute_queue_pkey ON att.recompute_queue USING btree (employee_id, work_date)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.regularizations

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:352`.

```sql

CREATE TABLE att.regularizations (  -- AR (ATT-06) and OD (ATT-07) requests
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  kind TEXT NOT NULL,               -- 'AR' | 'OD' | 'PERMISSION' (short time-bounded exception, 09-RECON §5)
  from_date DATE NOT NULL, to_date DATE NOT NULL,  -- OD may be future-dated (KQ); AR past-only — validator enforces
  from_time TIME, to_time TIME,     -- partial-day OD; required for PERMISSION (the bounded hours)
  reason TEXT NOT NULL,             -- mandatory justification (audit)
  requested_status att.day_status NOT NULL,        -- what the day should become ('P' for AR, 'OD' for OD)
  workflow_request_id BIGINT NOT NULL,             -- approval chain instance (WF-01)
  applied BOOLEAN NOT NULL DEFAULT false           -- set when approved AND day_records recomputed
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| kind | text | NO | — |

| from_date | date | NO | — |

| to_date | date | NO | — |

| from_time | time without time zone | YES | — |

| to_time | time without time zone | YES | — |

| reason | text | NO | — |

| requested_status | day_status | NO | — |

| workflow_request_id | bigint | NO | — |

| applied | boolean | NO | false |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `regularizations_check`: `CHECK (from_date <= to_date)`

- Constraint `regularizations_check1`: `CHECK (kind <> 'PERMISSION'::text OR from_time IS NOT NULL AND to_time IS NOT NULL AND from_date = to_date)`

- Constraint `regularizations_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `regularizations_kind_check`: `CHECK (kind = ANY (ARRAY['AR'::text, 'OD'::text, 'PERMISSION'::text]))`

- Constraint `regularizations_pkey`: `PRIMARY KEY (id)`

- Constraint `regularizations_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `regularizations_emp_idx`: `CREATE INDEX regularizations_emp_idx ON att.regularizations USING btree (employee_id, from_date)`

- Index `regularizations_pkey`: `CREATE UNIQUE INDEX regularizations_pkey ON att.regularizations USING btree (id)`

- Index `regularizations_wf_idx`: `CREATE UNIQUE INDEX regularizations_wf_idx ON att.regularizations USING btree (workflow_request_id)`

- Trigger `regularizations_updated_at`: `CREATE TRIGGER regularizations_updated_at BEFORE UPDATE ON att.regularizations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## att.roster_publications

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** A02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| manager_employee_id | bigint | NO | — |

| period_from | date | NO | — |

| period_to | date | NO | — |

| published_at | timestamp with time zone | NO | now() |

| published_by | bigint | NO | — |

| revision | integer | NO | 1 |

| reason | text | YES | — |

**Observed integrity and access hooks:**

- Constraint `roster_publications_check`: `CHECK (period_to >= period_from)`

- Constraint `roster_publications_manager_employee_id_fkey`: `FOREIGN KEY (manager_employee_id) REFERENCES core.employees(id)`

- Constraint `roster_publications_pkey`: `PRIMARY KEY (id)`

- Constraint `roster_publications_published_by_fkey`: `FOREIGN KEY (published_by) REFERENCES core.users(id)`

- Index `roster_publications_pkey`: `CREATE UNIQUE INDEX roster_publications_pkey ON att.roster_publications USING btree (id)`

- Index `roster_publications_range`: `CREATE UNIQUE INDEX roster_publications_range ON att.roster_publications USING btree (manager_employee_id, period_from, period_to)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.roster_revisions

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** A02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| work_date | date | NO | — |

| old_shift_id | bigint | YES | — |

| new_shift_id | bigint | YES | — |

| old_week_off | boolean | NO | — |

| new_week_off | boolean | NO | — |

| reason | text | NO | — |

| changed_by | bigint | NO | — |

| changed_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `roster_revisions_changed_by_fkey`: `FOREIGN KEY (changed_by) REFERENCES core.users(id)`

- Constraint `roster_revisions_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `roster_revisions_new_shift_id_fkey`: `FOREIGN KEY (new_shift_id) REFERENCES att.shifts(id)`

- Constraint `roster_revisions_old_shift_id_fkey`: `FOREIGN KEY (old_shift_id) REFERENCES att.shifts(id)`

- Constraint `roster_revisions_pkey`: `PRIMARY KEY (id)`

- Index `roster_revisions_pkey`: `CREATE UNIQUE INDEX roster_revisions_pkey ON att.roster_revisions USING btree (id)`

- Trigger `roster_revisions_immutable`: `CREATE TRIGGER roster_revisions_immutable BEFORE DELETE OR UPDATE ON att.roster_revisions FOR EACH ROW EXECUTE FUNCTION att.roster_revisions_immutable()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.rosters

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:310`.

```sql

CREATE TABLE att.rosters (          -- manager-maintained month roster (ATT-04); one row per employee-date
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  work_date DATE NOT NULL,
  shift_id BIGINT REFERENCES att.shifts,           -- NULL + is_week_off=true = week-off day
  is_week_off BOOLEAN NOT NULL DEFAULT false,
  set_by BIGINT REFERENCES core.users,             -- manager accountability (Agreement 4.1a: roster by managers by 5th)
  UNIQUE(employee_id, work_date)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| work_date | date | NO | — |

| shift_id | bigint | YES | — |

| is_week_off | boolean | NO | false |

| set_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `rosters_check`: `CHECK (is_week_off OR shift_id IS NOT NULL)`

- Constraint `rosters_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `rosters_employee_id_work_date_key`: `UNIQUE (employee_id, work_date)`

- Constraint `rosters_pkey`: `PRIMARY KEY (id)`

- Constraint `rosters_set_by_fkey`: `FOREIGN KEY (set_by) REFERENCES core.users(id)`

- Constraint `rosters_shift_id_fkey`: `FOREIGN KEY (shift_id) REFERENCES att.shifts(id)`

- Index `rosters_employee_id_work_date_key`: `CREATE UNIQUE INDEX rosters_employee_id_work_date_key ON att.rosters USING btree (employee_id, work_date)`

- Index `rosters_pkey`: `CREATE UNIQUE INDEX rosters_pkey ON att.rosters USING btree (id)`

- Trigger `rosters_invalidate_manager_approval`: `CREATE TRIGGER rosters_invalidate_manager_approval AFTER INSERT OR DELETE OR UPDATE ON att.rosters FOR EACH ROW EXECUTE FUNCTION att.invalidate_manager_month_approval()`

- Trigger `rosters_updated_at`: `CREATE TRIGGER rosters_updated_at BEFORE UPDATE ON att.rosters FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## att.shift_patterns

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** A02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| cycle | jsonb | NO | — |

| created_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `shift_patterns_code_key`: `UNIQUE (code)`

- Constraint `shift_patterns_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

- Constraint `shift_patterns_cycle_array`: `CHECK (jsonb_typeof(cycle) = 'array'::text)`

- Constraint `shift_patterns_pkey`: `PRIMARY KEY (id)`

- Index `shift_patterns_code_key`: `CREATE UNIQUE INDEX shift_patterns_code_key ON att.shift_patterns USING btree (code)`

- Index `shift_patterns_pkey`: `CREATE UNIQUE INDEX shift_patterns_pkey ON att.shift_patterns USING btree (id)`

- Trigger `shift_patterns_updated_at`: `CREATE TRIGGER shift_patterns_updated_at BEFORE UPDATE ON att.shift_patterns FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.shift_swaps

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** A02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| requester_employee_id | bigint | NO | — |

| counterpart_employee_id | bigint | YES | — |

| work_date | date | NO | — |

| requester_shift_id | bigint | YES | — |

| counterpart_shift_id | bigint | YES | — |

| kind | text | NO | — |

| workflow_request_id | bigint | NO | — |

| applied | boolean | NO | false |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `shift_swaps_counterpart_employee_id_fkey`: `FOREIGN KEY (counterpart_employee_id) REFERENCES core.employees(id)`

- Constraint `shift_swaps_counterpart_shift_id_fkey`: `FOREIGN KEY (counterpart_shift_id) REFERENCES att.shifts(id)`

- Constraint `shift_swaps_kind_check`: `CHECK (kind = ANY (ARRAY['swap'::text, 'bid'::text]))`

- Constraint `shift_swaps_pkey`: `PRIMARY KEY (id)`

- Constraint `shift_swaps_requester_employee_id_fkey`: `FOREIGN KEY (requester_employee_id) REFERENCES core.employees(id)`

- Constraint `shift_swaps_requester_shift_id_fkey`: `FOREIGN KEY (requester_shift_id) REFERENCES att.shifts(id)`

- Constraint `shift_swaps_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `shift_swaps_pkey`: `CREATE UNIQUE INDEX shift_swaps_pkey ON att.shift_swaps USING btree (id)`

- Index `shift_swaps_requester`: `CREATE INDEX shift_swaps_requester ON att.shift_swaps USING btree (requester_employee_id, work_date)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## att.shifts

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:299`.

```sql

CREATE TABLE att.shifts (           -- ATT-04 / SOW-4.1
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,   -- 'GEN', 'A', 'B', 'C', 'NIGHT'
  start_time TIME NOT NULL, end_time TIME NOT NULL,
  crosses_midnight BOOLEAN NOT NULL DEFAULT false, -- night shifts: attendance date attribution rule
  grace_in_minutes SMALLINT NOT NULL DEFAULT 0,    -- late-coming grace (SOW-4.5a)
  grace_out_minutes SMALLINT NOT NULL DEFAULT 0,
  min_half_day_hours NUMERIC(4,2) NOT NULL,        -- below this = absent; between this and min_full = half day (ATT-05)
  min_full_day_hours NUMERIC(4,2) NOT NULL,
  break_minutes SMALLINT NOT NULL DEFAULT 0        -- net-hours computation
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| start_time | time without time zone | NO | — |

| end_time | time without time zone | NO | — |

| crosses_midnight | boolean | NO | false |

| session_split | time without time zone | YES | — |

| grace_in_minutes | smallint | NO | 0 |

| grace_out_minutes | smallint | NO | 0 |

| min_half_day_hours | numeric(4,2) | NO | — |

| min_full_day_hours | numeric(4,2) | NO | — |

| break_minutes | smallint | NO | 0 |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| break_paid | boolean | NO | false |

| ot_start_offset_minutes | smallint | NO | 0 |

| late_slabs | jsonb | NO | '[]'::jsonb |

| early_exit_slabs | jsonb | NO | '[]'::jsonb |

| allowance_component_code | text | YES | — |

| session2_start | time without time zone | YES | — |

| session2_end | time without time zone | YES | — |

**Observed integrity and access hooks:**

- Constraint `shifts_code_key`: `UNIQUE (code)`

- Constraint `shifts_hours_order`: `CHECK (min_full_day_hours >= min_half_day_hours)`

- Constraint `shifts_minutes_nonnegative`: `CHECK (grace_in_minutes >= 0 AND grace_out_minutes >= 0 AND break_minutes >= 0 AND min_half_day_hours >= 0::numeric AND min_full_day_hours >= min_half_day_hours)`

- Constraint `shifts_ot_offset`: `CHECK (ot_start_offset_minutes >= 0 AND ot_start_offset_minutes <= 240)`

- Constraint `shifts_pkey`: `PRIMARY KEY (id)`

- Constraint `shifts_primary_window_valid`: `CHECK (start_time <> end_time AND (crosses_midnight AND end_time < start_time OR NOT crosses_midnight AND end_time > start_time))`

- Constraint `shifts_second_session_valid`: `CHECK (session2_start IS NULL OR NOT crosses_midnight AND session_split IS NULL AND session2_start >= end_time AND session2_end > session2_start)`

- Constraint `shifts_session2_pair`: `CHECK ((session2_start IS NULL) = (session2_end IS NULL))`

- Constraint `shifts_session_split_valid`: `CHECK (session_split IS NULL OR NOT crosses_midnight AND session2_start IS NULL AND session_split > start_time AND session_split < end_time)`

- Index `shifts_code_key`: `CREATE UNIQUE INDEX shifts_code_key ON att.shifts USING btree (code)`

- Index `shifts_pkey`: `CREATE UNIQUE INDEX shifts_pkey ON att.shifts USING btree (id)`

- Trigger `shifts_updated_at`: `CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON att.shifts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## att.source_receipts

**Status:** PROPOSED AMENDMENT. **Cards:** A01.

**Proposed grain:** One connector completeness receipt per device and covered interval. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## att.swipe_events

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A01, X01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:281`.

```sql

CREATE TABLE att.swipe_events (     -- RAW, immutable (ATT-01). Columns mirror EmployeeSwipeDetails.xlsx so any Kent export loads losslessly.
  employee_id BIGINT REFERENCES core.employees, -- resolved from access_card/employee_no; NULL if unmatched (exception queue)
  employee_no TEXT NOT NULL,        -- as sent by Kent ('RGH033256') — kept verbatim for reconciliation
  access_card TEXT,                 -- card id as sent
  shift_label TEXT,                 -- Kent's shift field ('RGH-Gen-C','Default') — diagnostic only; our shift comes from roster
  swipe_ts TIMESTAMPTZ NOT NULL,    -- 'Swipe Date'
  door_code TEXT,                   -- 'Door/Address' → att.devices
  longitude NUMERIC(9,6), latitude NUMERIC(9,6), location_type TEXT, -- mobile/geo check-ins (ATT-14); Kent sends blank
  mobile_device_name TEXT, mobile_device_id TEXT,  -- mobile check-in device fingerprint (fraud review)
  swipe_type TEXT,                  -- 'Astra' etc. — source system tag
  direction TEXT,                   -- 'in'|'out'|NULL — Kent 'Status'; NULL means infer from first/last
  remarks TEXT, permission_reason TEXT, signed_by TEXT, -- Kent passthrough columns (present in export; kept for audit parity)
  received_at TIMESTAMPTZ NOT NULL, -- Kent 'Received On' — measures device→cloud lag (the PP-9 failure signal)
  source TEXT NOT NULL DEFAULT 'kent',            -- 'kent'|'mobile'|'manual'
  UNIQUE (employee_no, swipe_ts, door_code)        -- idempotent ingestion key
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | YES | — |

| employee_no | text | NO | — |

| access_card | text | YES | — |

| shift_label | text | YES | — |

| swipe_ts | timestamp with time zone | NO | — |

| door_code | text | YES | — |

| longitude | numeric(9,6) | YES | — |

| latitude | numeric(9,6) | YES | — |

| location_type | text | YES | — |

| mobile_device_name | text | YES | — |

| mobile_device_id | text | YES | — |

| swipe_type | text | YES | — |

| direction | text | YES | — |

| remarks | text | YES | — |

| permission_reason | text | YES | — |

| signed_by | text | YES | — |

| received_at | timestamp with time zone | NO | — |

| source | text | NO | 'kent'::text |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `swipe_events_employee_no_swipe_ts_door_code_key`: `UNIQUE (employee_no, swipe_ts, door_code)`

- Constraint `swipe_events_pkey`: `PRIMARY KEY (id, swipe_ts)`

- Index `swipe_events_emp_ts_idx`: `CREATE INDEX swipe_events_emp_ts_idx ON ONLY att.swipe_events USING btree (employee_id, swipe_ts)`

- Index `swipe_events_employee_no_swipe_ts_door_code_key`: `CREATE UNIQUE INDEX swipe_events_employee_no_swipe_ts_door_code_key ON ONLY att.swipe_events USING btree (employee_no, swipe_ts, door_code)`

- Index `swipe_events_pkey`: `CREATE UNIQUE INDEX swipe_events_pkey ON ONLY att.swipe_events USING btree (id, swipe_ts)`

- Index `swipe_events_ts_brin`: `CREATE INDEX swipe_events_ts_brin ON ONLY att.swipe_events USING brin (swipe_ts)`

- Trigger `swipe_events_enqueue_recompute`: `CREATE TRIGGER swipe_events_enqueue_recompute AFTER INSERT ON att.swipe_events FOR EACH ROW EXECUTE FUNCTION att.enqueue_recompute()`

- Trigger `swipe_events_immutable`: `CREATE TRIGGER swipe_events_immutable BEFORE DELETE OR UPDATE ON att.swipe_events FOR EACH ROW EXECUTE FUNCTION att.swipe_events_immutable()`


## cmp.calendar_items

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types; BLOCKED SOURCE/SCOPE RECONCILIATION. **Cards:** M01.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| obligation_code | text | NO | — |

| title | text | NO | — |

| frequency | text | NO | — |

| period_label | text | NO | — |

| due_on | date | NO | — |

| owner_user_id | bigint | YES | — |

| status | text | NO | 'due'::text |

| registration_id | bigint | YES | — |

| filed_at | timestamp with time zone | YES | — |

| filed_by_user_id | bigint | YES | — |

| waived_reason | text | YES | — |

| waived_by_user_id | bigint | YES | — |

| waived_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `calendar_filed_pairs`: `CHECK (status <> 'filed'::text OR filed_at IS NOT NULL AND filed_by_user_id IS NOT NULL)`

- Constraint `calendar_items_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `calendar_items_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

- Constraint `calendar_items_frequency_check`: `CHECK (frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'half_yearly'::text, 'annual'::text, 'one_off'::text]))`

- Constraint `calendar_items_owner_user_id_fkey`: `FOREIGN KEY (owner_user_id) REFERENCES core.users(id)`

- Constraint `calendar_items_pkey`: `PRIMARY KEY (id)`

- Constraint `calendar_items_registration_id_fkey`: `FOREIGN KEY (registration_id) REFERENCES cmp.registrations(id)`

- Constraint `calendar_items_status_check`: `CHECK (status = ANY (ARRAY['due'::text, 'filed'::text, 'waived'::text]))`

- Constraint `calendar_items_waived_by_user_id_fkey`: `FOREIGN KEY (waived_by_user_id) REFERENCES core.users(id)`

- Constraint `calendar_waived_pairs`: `CHECK (status <> 'waived'::text OR waived_at IS NOT NULL AND waived_by_user_id IS NOT NULL AND waived_reason IS NOT NULL AND length(btrim(waived_reason)) >= 3)`

- Index `calendar_due_idx`: `CREATE INDEX calendar_due_idx ON cmp.calendar_items USING btree (due_on, status)`

- Index `calendar_items_pkey`: `CREATE UNIQUE INDEX calendar_items_pkey ON cmp.calendar_items USING btree (id)`

- Index `calendar_period_unique`: `CREATE UNIQUE INDEX calendar_period_unique ON cmp.calendar_items USING btree (company_id, obligation_code, period_label)`

- Trigger `calendar_items_updated_at`: `CREATE TRIGGER calendar_items_updated_at BEFORE UPDATE ON cmp.calendar_items FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## cmp.filing_evidence

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types; BLOCKED SOURCE/SCOPE RECONCILIATION. **Cards:** M01.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| calendar_item_id | bigint | NO | — |

| reference | text | NO | — |

| document_path | text | YES | — |

| remark | text | YES | — |

| filed_by_user_id | bigint | NO | — |

| recorded_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `evidence_reference_present`: `CHECK (length(btrim(reference)) >= 2)`

- Constraint `filing_evidence_calendar_item_id_fkey`: `FOREIGN KEY (calendar_item_id) REFERENCES cmp.calendar_items(id)`

- Constraint `filing_evidence_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

- Constraint `filing_evidence_pkey`: `PRIMARY KEY (id)`

- Index `evidence_item_idx`: `CREATE INDEX evidence_item_idx ON cmp.filing_evidence USING btree (calendar_item_id, recorded_at DESC)`

- Index `filing_evidence_pkey`: `CREATE UNIQUE INDEX filing_evidence_pkey ON cmp.filing_evidence USING btree (id)`

- Trigger `filing_evidence_immutable`: `CREATE TRIGGER filing_evidence_immutable BEFORE DELETE OR UPDATE ON cmp.filing_evidence FOR EACH ROW EXECUTE FUNCTION cmp.filing_evidence_immutable()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## cmp.registrations

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types; BLOCKED SOURCE/SCOPE RECONCILIATION. **Cards:** M01.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| location_id | bigint | YES | — |

| kind | text | NO | — |

| registration_no | text | NO | — |

| issuing_authority | text | YES | — |

| valid_from | date | NO | — |

| valid_to | date | YES | — |

| renewal_owner_user_id | bigint | YES | — |

| document_path | text | YES | — |

| notes | text | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `registrations_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `registrations_kind_check`: `CHECK (kind = ANY (ARRAY['pf'::text, 'esic'::text, 'pt'::text, 'lwf'::text, 'factory_licence'::text, 'clra_licence'::text, 'shops'::text, 'single_registration'::text, 'other'::text]))`

- Constraint `registrations_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `registrations_number_present`: `CHECK (length(btrim(registration_no)) > 0)`

- Constraint `registrations_pkey`: `PRIMARY KEY (id)`

- Constraint `registrations_renewal_owner_user_id_fkey`: `FOREIGN KEY (renewal_owner_user_id) REFERENCES core.users(id)`

- Constraint `registrations_validity_ordered`: `CHECK (valid_to IS NULL OR valid_to > valid_from)`

- Index `registrations_expiry_idx`: `CREATE INDEX registrations_expiry_idx ON cmp.registrations USING btree (valid_to) WHERE (is_active AND (valid_to IS NOT NULL))`

- Index `registrations_pkey`: `CREATE UNIQUE INDEX registrations_pkey ON cmp.registrations USING btree (id)`

- Index `registrations_unique_live`: `CREATE UNIQUE INDEX registrations_unique_live ON cmp.registrations USING btree (company_id, COALESCE(location_id, (0)::bigint), kind, registration_no) WHERE is_active`

- Trigger `registrations_updated_at`: `CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON cmp.registrations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## core.audit_log

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:49`.

```sql

CREATE TABLE core.audit_log (      -- append-only (CORE-11, NFR-04); INSERT-only enforced by trigger
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES core.users,  -- who did it (NULL = system job)
  action  TEXT NOT NULL,           -- 'update' | 'create' | 'delete' | 'login' | 'approve' | 'finalize' ...
  entity  TEXT NOT NULL,           -- table or domain name, e.g. 'core.employees'
  entity_id BIGINT,                -- which record
  field   TEXT,                    -- which column (for field-level changes)
  old_value TEXT, new_value TEXT,  -- values as text; sensitive fields stored masked
  ip      INET,                    -- source of auth events
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope_org_unit_id BIGINT REFERENCES core.org_units, -- historical CORE-10 data scope; NULL = global/all-scope readers only
  hash_version SMALLINT NOT NULL DEFAULT 2 CHECK (hash_version IN (1, 2)), -- v1 legacy; v2 hashes scope
  prev_hash TEXT NOT NULL,         -- 'GENESIS' for the first row, otherwise previous row_hash
  row_hash  TEXT NOT NULL          -- SHA-256(prev_hash || row content), set by DB trigger (14 §7.4)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| actor_user_id | bigint | YES | — |

| action | text | NO | — |

| entity | text | NO | — |

| entity_id | bigint | YES | — |

| field | text | YES | — |

| old_value | text | YES | — |

| new_value | text | YES | — |

| ip | inet | YES | — |

| at | timestamp with time zone | NO | now() |

| prev_hash | text | NO | — |

| row_hash | text | NO | — |

| scope_org_unit_id | bigint | YES | — |

| hash_version | smallint | NO | 2 |

| chain_seq | bigint | NO | — |

**Observed integrity and access hooks:**

- Constraint `audit_log_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

- Constraint `audit_log_hash_version_check`: `CHECK (hash_version = ANY (ARRAY[1, 2]))`

- Constraint `audit_log_pkey`: `PRIMARY KEY (id)`

- Constraint `audit_log_scope_org_unit_id_fkey`: `FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id)`

- Index `audit_log_chain_seq_idx`: `CREATE UNIQUE INDEX audit_log_chain_seq_idx ON core.audit_log USING btree (chain_seq)`

- Index `audit_log_entity_idx`: `CREATE INDEX audit_log_entity_idx ON core.audit_log USING btree (entity, entity_id, at)`

- Index `audit_log_pkey`: `CREATE UNIQUE INDEX audit_log_pkey ON core.audit_log USING btree (id)`

- Index `audit_log_scope_idx`: `CREATE INDEX audit_log_scope_idx ON core.audit_log USING btree (scope_org_unit_id, at DESC, id DESC)`

- Trigger `audit_log_chain`: `CREATE TRIGGER audit_log_chain BEFORE INSERT ON core.audit_log FOR EACH ROW EXECUTE FUNCTION core.audit_log_chain()`

- Trigger `audit_log_immutable`: `CREATE TRIGGER audit_log_immutable BEFORE DELETE OR UPDATE ON core.audit_log FOR EACH ROW EXECUTE FUNCTION core.audit_log_immutable()`


## core.clearances

**Status:** SPEC BASELINE. **Cards:** L04, L05.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:714`.

```sql

CREATE TABLE core.clearances (      -- LC-06 department clearances (SOW-3.5b)
  separation_id BIGINT NOT NULL REFERENCES core.separations,
  department TEXT NOT NULL,         -- 'IT'|'Admin'|'Finance'|'HR'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'cleared'|'flagged'
  remarks TEXT,                     -- e.g. unreturned asset list (AST-04)
  cleared_by BIGINT REFERENCES core.users, cleared_at TIMESTAMPTZ,
  UNIQUE(separation_id, department)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## core.companies

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:71`.

```sql

CREATE TABLE core.companies (      -- legal entities (confirmed live, 09-RECON §10.1): RML (Rashmi Metaliks), RGH, EIPL (eHoome IOT),
                                   -- RPF (Rashmi Pipes & Fittings, Dubai), RPL (Rashmi Paradigm Ltd), RDL (Rashmi/Reach Dredging — confirm)
  code TEXT UNIQUE NOT NULL,       -- 'RML','RGH','EIPL','RPF','RPL','RDL' — also the e-code prefix (CORE-02)
  name TEXT NOT NULL,              -- 'Rashmi Metaliks Limited'
  ecode_next_seq INTEGER NOT NULL, -- next employee-code number for this entity; sequence-enforced generation (CORE-02)
  ecode_format TEXT NOT NULL,      -- e.g. 'RML0#####' — zero-padded template so codes match legacy series
  gstin TEXT, pan TEXT,            -- appear on statutory outputs and payslip footer (PAY-06)
  pf_establishment_code TEXT,      -- EPFO establishment id — required in ECR file (PAY-09)
  esic_code TEXT,                  -- ESIC employer code — required on ESIC returns (PAY-10)
  pt_registration_no TEXT,         -- WB PT enrolment — PT return (PAY-11)
  tan TEXT,                        -- TDS deductor number — 24Q/Form16 (PAY-13)
  address TEXT                     -- letterheads and statutory forms
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| ecode_prefix | text | NO | — |

| ecode_next_seq | integer | NO | 1 |

| is_india_payroll | boolean | NO | true |

| gstin | text | YES | — |

| pan | text | YES | — |

| pf_establishment_code | text | YES | — |

| esic_code | text | YES | — |

| pt_registration_no | text | YES | — |

| tan | text | YES | — |

| address | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| sap_company_code | text | YES | — |

**Observed integrity and access hooks:**

- Constraint `companies_code_key`: `UNIQUE (code)`

- Constraint `companies_ecode_prefix_key`: `UNIQUE (ecode_prefix)`

- Constraint `companies_name_key`: `UNIQUE (name)`

- Constraint `companies_pkey`: `PRIMARY KEY (id)`

- Constraint `companies_sap_company_code_key`: `UNIQUE (sap_company_code)`

- Index `companies_code_key`: `CREATE UNIQUE INDEX companies_code_key ON core.companies USING btree (code)`

- Index `companies_ecode_prefix_key`: `CREATE UNIQUE INDEX companies_ecode_prefix_key ON core.companies USING btree (ecode_prefix)`

- Index `companies_name_key`: `CREATE UNIQUE INDEX companies_name_key ON core.companies USING btree (name)`

- Index `companies_pkey`: `CREATE UNIQUE INDEX companies_pkey ON core.companies USING btree (id)`

- Index `companies_sap_company_code_key`: `CREATE UNIQUE INDEX companies_sap_company_code_key ON core.companies USING btree (sap_company_code)`

- Trigger `companies_updated_at`: `CREATE TRIGGER companies_updated_at BEFORE UPDATE ON core.companies FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.cost_centers

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:92`.

```sql

CREATE TABLE core.cost_centers (   -- e.g. plant 1701 / Substore (PP-8, CORE-04)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  code TEXT NOT NULL,              -- '1701' — matches SAP cost center for JV mapping (§6.7)
  name TEXT NOT NULL,              -- human label shown in muster/cost reports
  UNIQUE(company_id, code)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| code | text | NO | — |

| name | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| plant_id | bigint | YES | — |

**Observed integrity and access hooks:**

- Constraint `cost_centers_company_id_code_key`: `UNIQUE (company_id, code)`

- Constraint `cost_centers_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `cost_centers_id_company_uk`: `UNIQUE (id, company_id)`

- Constraint `cost_centers_pkey`: `PRIMARY KEY (id)`

- Constraint `cost_centers_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`

- Constraint `cost_centers_plant_id_fkey`: `FOREIGN KEY (plant_id) REFERENCES core.plants(id)`

- Index `cost_centers_company_id_code_key`: `CREATE UNIQUE INDEX cost_centers_company_id_code_key ON core.cost_centers USING btree (company_id, code)`

- Index `cost_centers_id_company_uk`: `CREATE UNIQUE INDEX cost_centers_id_company_uk ON core.cost_centers USING btree (id, company_id)`

- Index `cost_centers_pkey`: `CREATE UNIQUE INDEX cost_centers_pkey ON core.cost_centers USING btree (id)`

- Trigger `cost_centers_updated_at`: `CREATE TRIGGER cost_centers_updated_at BEFORE UPDATE ON core.cost_centers FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.departments

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:99`.

```sql

CREATE TABLE core.departments (    -- 'Human Resource', 'CEO Cell' … (Recruiter Details columns)
  name TEXT UNIQUE NOT NULL
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| name | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| mis_code_id | bigint | YES | — |

**Observed integrity and access hooks:**

- Constraint `departments_mis_code_id_fkey`: `FOREIGN KEY (mis_code_id) REFERENCES core.mis_codes(id)`

- Constraint `departments_name_key`: `UNIQUE (name)`

- Constraint `departments_pkey`: `PRIMARY KEY (id)`

- Index `departments_name_key`: `CREATE UNIQUE INDEX departments_name_key ON core.departments USING btree (name)`

- Index `departments_pkey`: `CREATE UNIQUE INDEX departments_pkey ON core.departments USING btree (id)`

- Trigger `departments_updated_at`: `CREATE TRIGGER departments_updated_at BEFORE UPDATE ON core.departments FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.designations

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:109`.

```sql

CREATE TABLE core.designations (   -- 'Deputy Manager', 'AGM-HR' … free-ish list, validated: special chars stripped (CORE-08)
  name TEXT UNIQUE NOT NULL
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| name | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `designations_name_key`: `UNIQUE (name)`

- Constraint `designations_pkey`: `PRIMARY KEY (id)`

- Index `designations_name_key`: `CREATE UNIQUE INDEX designations_name_key ON core.designations USING btree (name)`

- Index `designations_pkey`: `CREATE UNIQUE INDEX designations_pkey ON core.designations USING btree (id)`

- Trigger `designations_updated_at`: `CREATE TRIGGER designations_updated_at BEFORE UPDATE ON core.designations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.document_operations

**Status:** PROPOSED AMENDMENT. **Cards:** F04.

**Proposed grain:** One staged object operation/reconciliation intent. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## core.documents

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F04, P04, P06, L01, T04, M01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:225`.

```sql

CREATE TABLE core.documents (       -- single file registry for all uploads (ID proofs, certificates, letters, payslip PDFs)
  owner_employee_id BIGINT REFERENCES core.employees,
  kind TEXT NOT NULL,               -- 'aadhaar'|'pan'|'education'|'experience_letter'|'offer_letter'|'relieving_letter'|'policy'|'payslip'|...
  path TEXT NOT NULL,               -- MinIO object key (bucket/key); DB stores the reference, bytes live in MinIO
  original_name TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  uploaded_by BIGINT REFERENCES core.users
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| owner_employee_id | bigint | YES | — |

| kind | text | NO | — |

| path | text | NO | — |

| original_name | text | NO | — |

| mime | text | NO | — |

| size_bytes | integer | NO | — |

| uploaded_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| expires_on | date | YES | — |

| status | text | NO | 'active'::text |

**Observed integrity and access hooks:**

- Constraint `documents_owner_employee_id_fkey`: `FOREIGN KEY (owner_employee_id) REFERENCES core.employees(id)`

- Constraint `documents_pkey`: `PRIMARY KEY (id)`

- Constraint `documents_status_check`: `CHECK (status = ANY (ARRAY['active'::text, 'superseded'::text, 'withdrawn'::text]))`

- Constraint `documents_uploaded_by_fkey`: `FOREIGN KEY (uploaded_by) REFERENCES core.users(id)`

- Index `documents_expires_idx`: `CREATE INDEX documents_expires_idx ON core.documents USING btree (expires_on) WHERE ((expires_on IS NOT NULL) AND (status = 'active'::text))`

- Index `documents_owner_kind_idx`: `CREATE INDEX documents_owner_kind_idx ON core.documents USING btree (owner_employee_id, kind) WHERE (owner_employee_id IS NOT NULL)`

- Index `documents_pkey`: `CREATE UNIQUE INDEX documents_pkey ON core.documents USING btree (id)`

- Trigger `documents_updated_at`: `CREATE TRIGGER documents_updated_at BEFORE UPDATE ON core.documents FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## core.employee_assignments

**Status:** PROPOSED AMENDMENT. **Cards:** F02, A02, P01, L01, L03, W04.

**Proposed grain:** One approved effective placement interval per employee. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## core.employee_education

**Status:** SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:213`.

```sql

CREATE TABLE core.employee_education ( -- LOI attachments checklist ('Educational Documents'); background-verification record
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  qualification TEXT NOT NULL, institution TEXT, year_of_passing SMALLINT, document_id BIGINT REFERENCES core.documents
);

```


## core.employee_family

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:205`.

```sql

CREATE TABLE core.employee_family ( -- ESIC family declaration (SOW-5.10 ESIC 'family members details') + gratuity/PF nominee
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  name TEXT NOT NULL, relation TEXT NOT NULL, dob DATE,
  aadhaar TEXT,                     -- ESIC portal requires it for dependents
  is_esic_dependent BOOLEAN NOT NULL DEFAULT false,
  is_nominee BOOLEAN NOT NULL DEFAULT false, nominee_share_pct NUMERIC(5,2) -- PF/gratuity nomination forms
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| name | text | NO | — |

| relation | text | NO | — |

| dob | date | YES | — |

| aadhaar | text | YES | — |

| is_esic_dependent | boolean | NO | false |

| is_nominee | boolean | NO | false |

| nominee_share_pct | numeric(5,2) | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `employee_family_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `employee_family_pkey`: `PRIMARY KEY (id)`

- Index `employee_family_pkey`: `CREATE UNIQUE INDEX employee_family_pkey ON core.employee_family USING btree (id)`

- Trigger `employee_family_updated_at`: `CREATE TRIGGER employee_family_updated_at BEFORE UPDATE ON core.employee_family FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.employee_history

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02, L02, L03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:197`.

```sql

CREATE TABLE core.employee_history ( -- position/comp change log: every transfer/promotion/manager change (LC-05; promotion report RPT-05)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  effective_date DATE NOT NULL,
  change_type TEXT NOT NULL,        -- 'transfer_department'|'transfer_location'|'transfer_entity'|'promotion'|'manager_change'|'confirmation'|'category_change'
  field TEXT NOT NULL, old_value TEXT, new_value TEXT,
  reference_id BIGINT               -- link to the workflow request that caused it
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| effective_date | date | NO | — |

| change_type | text | NO | — |

| field | text | NO | — |

| old_value | text | YES | — |

| new_value | text | YES | — |

| reference_id | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `employee_history_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `employee_history_pkey`: `PRIMARY KEY (id)`

- Index `employee_history_pkey`: `CREATE UNIQUE INDEX employee_history_pkey ON core.employee_history USING btree (id)`

- Trigger `employee_history_updated_at`: `CREATE TRIGGER employee_history_updated_at BEFORE UPDATE ON core.employee_history FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.employee_prev_employment

**Status:** SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:218`.

```sql

CREATE TABLE core.employee_prev_employment ( -- SOW-3.2g 'capturing previous employment details'; LTA/gratuity continuity in F&F (SOW-10.1)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  company TEXT NOT NULL, designation TEXT, from_date DATE, to_date DATE,
  last_drawn_ctc NUMERIC(14,2),     -- offer benchmarking (LOI 'Current Salary')
  pf_member_id TEXT                 -- PF transfer-in support
);

```


## core.employees

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02, L01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:132`.

```sql

CREATE TABLE core.employees (
  id BIGINT ...,
  -- identity
  ecode         TEXT UNIQUE NOT NULL,   -- 'RML032772' — generated per company series (CORE-02); THE identifier on every report
  company_id    BIGINT NOT NULL REFERENCES core.companies,
  first_name    TEXT NOT NULL,
  last_name     TEXT,                   -- some legacy names are single-token ('Rachna') — hence nullable
  photo_path    TEXT,                   -- ESS/profile display
  gender        TEXT,                   -- ESIC returns & demographics reporting require it
  dob           DATE NOT NULL,          -- minor check (CORE-08), age KPIs (CEO: Average Age), retirement projection
  marital_status TEXT,                  -- tax (some exemptions) + ESIC family declarations
  blood_group   TEXT,                   -- plant-safety requirement for factory ID cards (standard steel-plant practice; on ID card print)
  -- contact
  personal_email TEXT,                  -- pre-joining link + payslip fallback + alumni contact (LC-01, LC-07)
  work_email     CITEXT UNIQUE,         -- SSO login + notifications; assigned by IT during onboarding (LC-02)
  mobile         TEXT NOT NULL,         -- alerts/OTP; column in attendance report (PP-25)
  emergency_contact_name TEXT, emergency_contact_phone TEXT, -- plant safety
  present_address TEXT, permanent_address TEXT,              -- LOI §1, PF/ESIC forms
  -- employment
  category      core.employment_category NOT NULL,  -- CORE-05
  contract_type core.contract_type NOT NULL,        -- LOI §4
  contract_end_date DATE,               -- only for fixed_term/consultant; renewal alerts
  doj           DATE NOT NULL,          -- date of joining — proration, tenure KPI, new-hire attrition (RPT-03)
  dol           DATE,                   -- date of leaving — set exactly once at exit (LC-07, PP-17)
  status        core.employee_status NOT NULL DEFAULT 'onboarding',
  exit_reason   TEXT,                   -- attrition analytics + EPFO date-of-leaving reason (SOW-5.10.5)
  designation_id BIGINT NOT NULL REFERENCES core.designations,
  department_id  BIGINT NOT NULL REFERENCES core.departments,
  org_unit_id    BIGINT NOT NULL REFERENCES core.org_units,
  location_id    BIGINT NOT NULL REFERENCES core.locations,   -- holiday calendar + muster grouping
  cost_center_id BIGINT NOT NULL REFERENCES core.cost_centers,-- PP-8; every employee must carry one
  grade_id       BIGINT REFERENCES core.grades,               -- salary template + leadership KPI
  reporting_manager_id  BIGINT REFERENCES core.employees,     -- approval chains + muster column (CORE-03, PP-5)
  functional_manager_id BIGINT REFERENCES core.employees,     -- dotted-line manager; master-report column (PI-PAY-8)
  -- probation & confirmation (LC-04, PAY-02)
  probation_months     SMALLINT,        -- from LOI ('Probation Duration')
  probation_salary_pct SMALLINT,        -- 70 | 80 | 90 (LOI §3; PI-ESS-1)
  probation_due_date   DATE,            -- doj + probation_months; reminder driver
  confirmation_date    DATE,            -- set by confirmation workflow; triggers salary switch
  -- statutory identifiers (CORE-07; all validated per CORE-08)
  pan TEXT, aadhaar TEXT,               -- masked outside payroll permission (NFR-03)
  uan TEXT, pf_number TEXT,             -- payslip print (PP-4) + ECR
  esic_ip_number TEXT,                  -- ESIC returns; only when gross ≤ threshold
  pf_applicable BOOLEAN NOT NULL DEFAULT true,   -- apprentices/consultants excluded (PAY-14)
  esic_applicable BOOLEAN NOT NULL DEFAULT false,-- derived at hire from gross, re-evaluated each contribution period
  pt_applicable BOOLEAN NOT NULL DEFAULT true,
  lwf_applicable BOOLEAN NOT NULL DEFAULT true,
  tax_regime TEXT NOT NULL DEFAULT 'new',        -- 'old'|'new' — employee election (PAY-13)
  -- banking (payroll)
  bank_name TEXT, bank_account TEXT, bank_ifsc TEXT,  -- bank transfer file (PAY-05); length/IFSC validation (CORE-08)
  payment_mode TEXT NOT NULL DEFAULT 'bank',          -- 'bank'|'cheque'|'hold' — some blue-collar cases
  -- attendance linkage
  access_card_no TEXT,                  -- Kent card id (EmployeeSwipeDetails 'Access Card'); maps device swipes → employee
  biometric_registered BOOLEAN NOT NULL DEFAULT false, -- onboarding checklist telemetry (LC-02)
  attendance_mode TEXT NOT NULL DEFAULT 'biometric'    -- 'biometric'|'mobile'|'manual' — sales staff use mobile (ATT-14)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| ecode | text | NO | — |

| company_id | bigint | NO | — |

| first_name | text | NO | — |

| last_name | text | YES | — |

| photo_path | text | YES | — |

| gender | text | YES | — |

| dob | date | YES | — |

| marital_status | text | YES | — |

| blood_group | text | YES | — |

| personal_email | text | YES | — |

| work_email | citext | YES | — |

| mobile | text | YES | — |

| emergency_contact_name | text | YES | — |

| emergency_contact_phone | text | YES | — |

| present_address | text | YES | — |

| permanent_address | text | YES | — |

| category | employment_category | YES | — |

| contract_type | contract_type | YES | — |

| contract_end_date | date | YES | — |

| doj | date | YES | — |

| dol | date | YES | — |

| status | employee_status | NO | 'onboarding'::core.employee_status |

| exit_reason | text | YES | — |

| designation_id | bigint | YES | — |

| department_id | bigint | YES | — |

| org_unit_id | bigint | YES | — |

| location_id | bigint | YES | — |

| cost_center_id | bigint | YES | — |

| grade_id | bigint | YES | — |

| reporting_manager_id | bigint | YES | — |

| functional_manager_id | bigint | YES | — |

| probation_months | smallint | YES | — |

| probation_salary_pct | smallint | YES | — |

| probation_due_date | date | YES | — |

| confirmation_date | date | YES | — |

| pan | text | YES | — |

| aadhaar | text | YES | — |

| uan | text | YES | — |

| pf_number | text | YES | — |

| esic_ip_number | text | YES | — |

| pf_applicable | boolean | NO | true |

| esic_applicable | boolean | NO | false |

| pt_applicable | boolean | NO | true |

| lwf_applicable | boolean | NO | true |

| tax_regime | text | NO | 'new'::text |

| bank_name | text | YES | — |

| bank_account | text | YES | — |

| bank_ifsc | text | YES | — |

| payment_mode | text | NO | 'bank'::text |

| access_card_no | text | YES | — |

| biometric_registered | boolean | NO | false |

| attendance_mode | text | NO | 'biometric'::text |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| plant_id | bigint | YES | — |

| hod_employee_id | bigint | YES | — |

**Observed integrity and access hooks:**

- Constraint `employees_attendance_mode_check`: `CHECK (attendance_mode = ANY (ARRAY['biometric'::text, 'mobile'::text, 'manual'::text]))`

- Constraint `employees_check`: `CHECK (status <> 'exited'::core.employee_status OR dol IS NOT NULL)`

- Constraint `employees_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `employees_cost_center_company_fk`: `FOREIGN KEY (cost_center_id, company_id) REFERENCES core.cost_centers(id, company_id)`

- Constraint `employees_cost_center_id_fkey`: `FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id)`

- Constraint `employees_department_id_fkey`: `FOREIGN KEY (department_id) REFERENCES core.departments(id)`

- Constraint `employees_designation_id_fkey`: `FOREIGN KEY (designation_id) REFERENCES core.designations(id)`

- Constraint `employees_ecode_key`: `UNIQUE (ecode)`

- Constraint `employees_functional_manager_id_fkey`: `FOREIGN KEY (functional_manager_id) REFERENCES core.employees(id)`

- Constraint `employees_grade_id_fkey`: `FOREIGN KEY (grade_id) REFERENCES core.grades(id)`

- Constraint `employees_hod_employee_id_fkey`: `FOREIGN KEY (hod_employee_id) REFERENCES core.employees(id)`

- Constraint `employees_hod_not_self`: `CHECK (hod_employee_id IS NULL OR hod_employee_id <> id)`

- Constraint `employees_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`

- Constraint `employees_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `employees_org_unit_company_fk`: `FOREIGN KEY (org_unit_id, company_id) REFERENCES core.org_units(id, company_id)`

- Constraint `employees_org_unit_id_fkey`: `FOREIGN KEY (org_unit_id) REFERENCES core.org_units(id)`

- Constraint `employees_payment_mode_check`: `CHECK (payment_mode = ANY (ARRAY['bank'::text, 'cheque'::text, 'hold'::text]))`

- Constraint `employees_pkey`: `PRIMARY KEY (id)`

- Constraint `employees_plant_company_fk`: `FOREIGN KEY (plant_id, company_id) REFERENCES core.plants(id, company_id)`

- Constraint `employees_plant_id_fkey`: `FOREIGN KEY (plant_id) REFERENCES core.plants(id)`

- Constraint `employees_reporting_manager_id_fkey`: `FOREIGN KEY (reporting_manager_id) REFERENCES core.employees(id)`

- Constraint `employees_tax_regime_check`: `CHECK (tax_regime = ANY (ARRAY['old'::text, 'new'::text]))`

- Constraint `employees_work_email_key`: `UNIQUE (work_email)`

- Index `employees_ecode_key`: `CREATE UNIQUE INDEX employees_ecode_key ON core.employees USING btree (ecode)`

- Index `employees_ecode_trgm`: `CREATE INDEX employees_ecode_trgm ON core.employees USING gin (lower(ecode) gin_trgm_ops)`

- Index `employees_fullname_trgm`: `CREATE INDEX employees_fullname_trgm ON core.employees USING gin (lower(((COALESCE(first_name, ''::text) \|\| ' '::text) \|\| COALESCE(last_name, ''::text))) gin_trgm_ops)`

- Index `employees_hod_idx`: `CREATE INDEX employees_hod_idx ON core.employees USING btree (hod_employee_id) WHERE (hod_employee_id IS NOT NULL)`

- Index `employees_pkey`: `CREATE UNIQUE INDEX employees_pkey ON core.employees USING btree (id)`

- Index `employees_rm_idx`: `CREATE INDEX employees_rm_idx ON core.employees USING btree (reporting_manager_id)`

- Index `employees_status_company_idx`: `CREATE INDEX employees_status_company_idx ON core.employees USING btree (status, company_id)`

- Index `employees_work_email_key`: `CREATE UNIQUE INDEX employees_work_email_key ON core.employees USING btree (work_email)`

- Trigger `employees_reporting_tree`: `CREATE TRIGGER employees_reporting_tree AFTER INSERT OR DELETE OR UPDATE OF reporting_manager_id ON core.employees FOR EACH STATEMENT EXECUTE FUNCTION core.rebuild_reporting_tree()`

- Trigger `employees_updated_at`: `CREATE TRIGGER employees_updated_at BEFORE UPDATE ON core.employees FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.grades

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:113`.

```sql

CREATE TABLE core.grades (         -- pay bands driving salary templates & loan eligibility (PAY-01, LN-01)
  code TEXT UNIQUE NOT NULL,       -- 'E1', 'M3' …
  name TEXT NOT NULL,
  rank SMALLINT NOT NULL           -- ordering for "leadership percentage" KPI (CEO dashboard: Leadership % needs a cutoff rank)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| rank | smallint | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `grades_code_key`: `UNIQUE (code)`

- Constraint `grades_pkey`: `PRIMARY KEY (id)`

- Index `grades_code_key`: `CREATE UNIQUE INDEX grades_code_key ON core.grades USING btree (code)`

- Index `grades_pkey`: `CREATE UNIQUE INDEX grades_pkey ON core.grades USING btree (id)`

- Trigger `grades_updated_at`: `CREATE TRIGGER grades_updated_at BEFORE UPDATE ON core.grades FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.import_batches

**Status:** PROPOSED AMENDMENT. **Cards:** F02, P07, T04.

**Proposed grain:** One sanitized source snapshot/import attempt. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## core.letter_templates

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F04, W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:241`.

```sql

CREATE TABLE core.letter_templates (
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  body_docx_document_id BIGINT NOT NULL REFERENCES core.documents, -- docx with merge fields
  merge_fields JSONB NOT NULL       -- declared fields, validated against employee data at render time
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| body_template | text | NO | — |

| body_docx_document_id | bigint | YES | — |

| merge_fields | jsonb | NO | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `letter_templates_body_docx_document_id_fkey`: `FOREIGN KEY (body_docx_document_id) REFERENCES core.documents(id)`

- Constraint `letter_templates_code_key`: `UNIQUE (code)`

- Constraint `letter_templates_pkey`: `PRIMARY KEY (id)`

- Index `letter_templates_code_key`: `CREATE UNIQUE INDEX letter_templates_code_key ON core.letter_templates USING btree (code)`

- Index `letter_templates_pkey`: `CREATE UNIQUE INDEX letter_templates_pkey ON core.letter_templates USING btree (id)`

- Trigger `letter_templates_updated_at`: `CREATE TRIGGER letter_templates_updated_at BEFORE UPDATE ON core.letter_templates FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.letters

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F04, A05, L02, L05, W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:233`.

```sql

CREATE TABLE core.letters (         -- generated letters (CORE-09); templates in core.letter_templates
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  template_code TEXT NOT NULL,      -- 'appointment'|'confirmation'|'experience'|'relieving'|'salary_certificate'|'show_cause'|'warning'
  document_id BIGINT NOT NULL REFERENCES core.documents,  -- rendered docx/pdf
  issued_by BIGINT REFERENCES core.users, issued_at TIMESTAMPTZ,
  workflow_request_id BIGINT        -- approval chain that authorized issuance (PP-14: letters must go through the system)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| template_code | text | NO | — |

| document_id | bigint | YES | — |

| issued_by | bigint | YES | — |

| issued_at | timestamp with time zone | YES | — |

| workflow_request_id | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| body_rendered | text | NO | — |

| status | text | NO | 'issued'::text |

**Observed integrity and access hooks:**

- Constraint `letters_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES core.documents(id)`

- Constraint `letters_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `letters_issued_by_fkey`: `FOREIGN KEY (issued_by) REFERENCES core.users(id)`

- Constraint `letters_pkey`: `PRIMARY KEY (id)`

- Constraint `letters_status_check`: `CHECK (status = ANY (ARRAY['draft'::text, 'pending_signature'::text, 'issued'::text]))`

- Constraint `letters_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `letters_emp_idx`: `CREATE INDEX letters_emp_idx ON core.letters USING btree (employee_id)`

- Index `letters_pkey`: `CREATE UNIQUE INDEX letters_pkey ON core.letters USING btree (id)`

- Index `letters_wf_idx`: `CREATE UNIQUE INDEX letters_wf_idx ON core.letters USING btree (workflow_request_id) WHERE (workflow_request_id IS NOT NULL)`

- Trigger `letters_updated_at`: `CREATE TRIGGER letters_updated_at BEFORE UPDATE ON core.letters FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.locations

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:85`.

```sql

CREATE TABLE core.locations (      -- physical sites: Kharagpur plant, Kolkata HO, Dubai — holiday calendars & muster grouping (ATT-13)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  name TEXT NOT NULL,              -- 'Kharagpur Plant', 'Kolkata HO'
  state_code TEXT NOT NULL,        -- 'WB' — selects PT slab table & LWF rates (PAY-11/12)
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| name | text | NO | — |

| state_code | text | NO | — |

| timezone | text | NO | 'Asia/Kolkata'::text |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `locations_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `locations_company_id_name_key`: `UNIQUE (company_id, name)`

- Constraint `locations_id_company_uk`: `UNIQUE (id, company_id)`

- Constraint `locations_pkey`: `PRIMARY KEY (id)`

- Index `locations_company_id_name_key`: `CREATE UNIQUE INDEX locations_company_id_name_key ON core.locations USING btree (company_id, name)`

- Index `locations_id_company_uk`: `CREATE UNIQUE INDEX locations_id_company_uk ON core.locations USING btree (id, company_id)`

- Index `locations_pkey`: `CREATE UNIQUE INDEX locations_pkey ON core.locations USING btree (id)`

- Trigger `locations_updated_at`: `CREATE TRIGGER locations_updated_at BEFORE UPDATE ON core.locations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.mis_codes

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| code | text | NO | — |

| name | text | NO | — |

| parent_id | bigint | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `mis_codes_code_check`: `CHECK (length(btrim(code)) > 0)`

- Constraint `mis_codes_company_id_code_key`: `UNIQUE (company_id, code)`

- Constraint `mis_codes_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `mis_codes_id_company_uk`: `UNIQUE (id, company_id)`

- Constraint `mis_codes_parent_company_fk`: `FOREIGN KEY (parent_id, company_id) REFERENCES core.mis_codes(id, company_id)`

- Constraint `mis_codes_parent_id_fkey`: `FOREIGN KEY (parent_id) REFERENCES core.mis_codes(id)`

- Constraint `mis_codes_pkey`: `PRIMARY KEY (id)`

- Index `mis_codes_company_id_code_key`: `CREATE UNIQUE INDEX mis_codes_company_id_code_key ON core.mis_codes USING btree (company_id, code)`

- Index `mis_codes_id_company_uk`: `CREATE UNIQUE INDEX mis_codes_id_company_uk ON core.mis_codes USING btree (id, company_id)`

- Index `mis_codes_pkey`: `CREATE UNIQUE INDEX mis_codes_pkey ON core.mis_codes USING btree (id)`

- Trigger `mis_codes_updated_at`: `CREATE TRIGGER mis_codes_updated_at BEFORE UPDATE ON core.mis_codes FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## core.onboarding_candidates

**Status:** SPEC BASELINE. **Cards:** L01, R01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:664`.

```sql

CREATE TABLE core.onboarding_candidates ( -- LC-01 bridge from ATS 'Joined List' / LOI payload (full field list = LOI doc §1–4)
  ats_candidate_id BIGINT,          -- FK into ats DB (kept loose across databases)
  loi_reference TEXT,               -- requisition/LOI id for the offer report join (RPT-02)
  full_name TEXT NOT NULL, personal_email TEXT NOT NULL, mobile TEXT NOT NULL,
  dob DATE, address TEXT, total_experience_years NUMERIC(4,1),
  previous_company TEXT, current_salary NUMERIC(14,2), expected_salary NUMERIC(14,2), -- LOI §1
  position_title TEXT NOT NULL, department TEXT, org_unit TEXT, designation TEXT,
  category core.employment_category NOT NULL, replacement_of_ecode TEXT, -- LOI §2 (replacement tracks previous ecode+salary)
  offered_ctc NUMERIC(14,2) NOT NULL, probation_months SMALLINT, probation_salary_pct SMALLINT, -- LOI §3 → PAY-02/07
  proposed_doj DATE NOT NULL, offer_date DATE NOT NULL, work_location TEXT,
  prejoin_link_token TEXT UNIQUE,   -- personal-email data-collection link (SOW-3.2a)
  prejoin_link_sent_at TIMESTAMPTZ, prejoin_completed_at TIMESTAMPTZ, -- delivery tracking (greytHR failure: links not received)
  status TEXT NOT NULL DEFAULT 'awaiting_prejoin', -- →'prejoin_done'→'converted'→ (or 'no_show')
  employee_id BIGINT REFERENCES core.employees      -- set on conversion (DOJ)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## core.onboarding_tasks

**Status:** SPEC BASELINE. **Cards:** L01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:680`.

```sql

CREATE TABLE core.onboarding_tasks ( -- LC-02: stakeholder checklist with escalation
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  task_code TEXT NOT NULL,          -- 'it_email'|'it_biometric'|'admin_assets'|'hr_induction'|'payroll_salary_setup'|...
  owner_role TEXT NOT NULL,         -- routed by role, resolved to users at creation
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open'|'done'|'escalated'
  done_by BIGINT REFERENCES core.users, done_at TIMESTAMPTZ
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## core.org_units

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:103`.

```sql

CREATE TABLE core.org_units (      -- OU per Recruiter Details ('Rashmi Metaliks Limited', 'eHoome iOT…'); reporting rollup for BU dashboards (RPT-04)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  parent_id BIGINT REFERENCES core.org_units,  -- tree for BU rollups
  name TEXT NOT NULL
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| parent_id | bigint | YES | — |

| name | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `org_units_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `org_units_id_company_uk`: `UNIQUE (id, company_id)`

- Constraint `org_units_parent_id_fkey`: `FOREIGN KEY (parent_id) REFERENCES core.org_units(id)`

- Constraint `org_units_pkey`: `PRIMARY KEY (id)`

- Index `org_units_id_company_uk`: `CREATE UNIQUE INDEX org_units_id_company_uk ON core.org_units USING btree (id, company_id)`

- Index `org_units_pkey`: `CREATE UNIQUE INDEX org_units_pkey ON core.org_units USING btree (id)`

- Trigger `org_units_updated_at`: `CREATE TRIGGER org_units_updated_at BEFORE UPDATE ON core.org_units FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.password_reset_tokens

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F03.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| user_id | bigint | NO | — |

| token_hash | text | NO | — |

| expires_at | timestamp with time zone | NO | — |

| used_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `password_reset_tokens_pkey`: `PRIMARY KEY (id)`

- Constraint `password_reset_tokens_token_hash_key`: `UNIQUE (token_hash)`

- Constraint `password_reset_tokens_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

- Index `password_reset_tokens_pkey`: `CREATE UNIQUE INDEX password_reset_tokens_pkey ON core.password_reset_tokens USING btree (id)`

- Index `password_reset_tokens_token_hash_key`: `CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON core.password_reset_tokens USING btree (token_hash)`

- Index `password_reset_tokens_user`: `CREATE INDEX password_reset_tokens_user ON core.password_reset_tokens USING btree (user_id, created_at DESC)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## core.permissions

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:32`.

```sql

CREATE TABLE core.permissions (    -- module × action grid (CORE-10)
  code TEXT UNIQUE NOT NULL        -- e.g. 'attendance.muster.export', 'payroll.run.finalize', 'employee.compensation.read'
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `permissions_code_key`: `UNIQUE (code)`

- Constraint `permissions_pkey`: `PRIMARY KEY (id)`

- Index `permissions_code_key`: `CREATE UNIQUE INDEX permissions_code_key ON core.permissions USING btree (code)`

- Index `permissions_pkey`: `CREATE UNIQUE INDEX permissions_pkey ON core.permissions USING btree (id)`

- Trigger `permissions_updated_at`: `CREATE TRIGGER permissions_updated_at BEFORE UPDATE ON core.permissions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.plants

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| plant_code | text | NO | — |

| name | text | NO | — |

| location_id | bigint | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `plants_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `plants_company_id_plant_code_key`: `UNIQUE (company_id, plant_code)`

- Constraint `plants_id_company_uk`: `UNIQUE (id, company_id)`

- Constraint `plants_location_company_fk`: `FOREIGN KEY (location_id, company_id) REFERENCES core.locations(id, company_id)`

- Constraint `plants_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `plants_pkey`: `PRIMARY KEY (id)`

- Constraint `plants_plant_code_check`: `CHECK (length(btrim(plant_code)) > 0)`

- Index `plants_company_id_plant_code_key`: `CREATE UNIQUE INDEX plants_company_id_plant_code_key ON core.plants USING btree (company_id, plant_code)`

- Index `plants_id_company_uk`: `CREATE UNIQUE INDEX plants_id_company_uk ON core.plants USING btree (id, company_id)`

- Index `plants_pkey`: `CREATE UNIQUE INDEX plants_pkey ON core.plants USING btree (id)`

- Trigger `plants_updated_at`: `CREATE TRIGGER plants_updated_at BEFORE UPDATE ON core.plants FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## core.policies

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:247`.

```sql

CREATE TABLE core.policies (        -- CORE-13 policy repository
  title TEXT NOT NULL, document_id BIGINT NOT NULL REFERENCES core.documents,
  effective_date DATE NOT NULL, requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
  audience JSONB                    -- optional filter: categories/departments/locations
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| title | text | NO | — |

| document_id | bigint | YES | — |

| effective_date | date | NO | — |

| requires_acknowledgment | boolean | NO | true |

| audience | jsonb | YES | — |

| is_active | boolean | NO | true |

| created_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| body_summary | text | YES | — |

**Observed integrity and access hooks:**

- Constraint `policies_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

- Constraint `policies_document_id_fkey`: `FOREIGN KEY (document_id) REFERENCES core.documents(id)`

- Constraint `policies_has_content`: `CHECK (document_id IS NOT NULL OR body_summary IS NOT NULL)`

- Constraint `policies_pkey`: `PRIMARY KEY (id)`

- Index `policies_pkey`: `CREATE UNIQUE INDEX policies_pkey ON core.policies USING btree (id)`

- Trigger `policies_updated_at`: `CREATE TRIGGER policies_updated_at BEFORE UPDATE ON core.policies FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.policy_acknowledgments

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:253`.

```sql

CREATE TABLE core.policy_acknowledgments (
  policy_id BIGINT NOT NULL REFERENCES core.policies,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  acknowledged_at TIMESTAMPTZ NOT NULL,
  UNIQUE(policy_id, employee_id)    -- real-time tracking tile = policies × active employees minus these rows
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| policy_id | bigint | NO | — |

| employee_id | bigint | NO | — |

| acknowledged_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `policy_acknowledgments_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `policy_acknowledgments_pkey`: `PRIMARY KEY (id)`

- Constraint `policy_acknowledgments_policy_id_employee_id_key`: `UNIQUE (policy_id, employee_id)`

- Constraint `policy_acknowledgments_policy_id_fkey`: `FOREIGN KEY (policy_id) REFERENCES core.policies(id)`

- Index `policy_acknowledgments_pkey`: `CREATE UNIQUE INDEX policy_acknowledgments_pkey ON core.policy_acknowledgments USING btree (id)`

- Index `policy_acknowledgments_policy_id_employee_id_key`: `CREATE UNIQUE INDEX policy_acknowledgments_policy_id_employee_id_key ON core.policy_acknowledgments USING btree (policy_id, employee_id)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## core.policy_versions

**Status:** PROPOSED AMENDMENT. **Cards:** W03.

**Proposed grain:** One immutable published policy content/audience version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## core.prejoin_invitations

**Status:** PROPOSED AMENDMENT. **Cards:** L01.

**Proposed grain:** One purpose-scoped invitation issuance, not a reusable login. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## core.probation_reviews

**Status:** SPEC BASELINE. **Cards:** P01, L02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:689`.

```sql

CREATE TABLE core.probation_reviews ( -- LC-04 (SOW-3.3)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  due_date DATE NOT NULL,
  manager_recommendation TEXT,      -- 'confirm'|'extend'|'terminate'
  extension_months SMALLINT,        -- when extended
  review_notes TEXT,
  workflow_request_id BIGINT,       -- multi-level confirmation chain (PI-ESS-10)
  outcome TEXT,                     -- 'confirmed'|'extended'|'separated'
  decided_at TIMESTAMPTZ
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## core.profile_change_requests

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| field | text | NO | — |

| old_value | text | YES | — |

| new_value | text | NO | — |

| status | text | NO | 'pending'::text |

| workflow_request_id | bigint | YES | — |

| decided_by | bigint | YES | — |

| decided_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `profile_change_requests_decided_by_fkey`: `FOREIGN KEY (decided_by) REFERENCES core.users(id)`

- Constraint `profile_change_requests_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `profile_change_requests_pkey`: `PRIMARY KEY (id)`

- Constraint `profile_change_requests_status_check`: `CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))`

- Constraint `profile_change_requests_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `profile_change_requests_pkey`: `CREATE UNIQUE INDEX profile_change_requests_pkey ON core.profile_change_requests USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## core.reporting_tree

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:192`.

```sql

CREATE TABLE core.reporting_tree (   -- company-AGNOSTIC: a manager may have reports in another entity (live: RPL DGM approves RDL staff, 09-RECON §10.3)
  manager_id BIGINT NOT NULL, employee_id BIGINT NOT NULL, depth SMALLINT NOT NULL,
  PRIMARY KEY (manager_id, employee_id)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| manager_id | bigint | NO | — |

| employee_id | bigint | NO | — |

| depth | smallint | NO | — |

**Observed integrity and access hooks:**

- Constraint `reporting_tree_pkey`: `PRIMARY KEY (manager_id, employee_id)`

- Index `reporting_tree_pkey`: `CREATE UNIQUE INDEX reporting_tree_pkey ON core.reporting_tree USING btree (manager_id, employee_id)`


## core.role_permissions

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:36`.

```sql

CREATE TABLE core.role_permissions (
  role_id BIGINT NOT NULL REFERENCES core.roles,
  permission_id BIGINT NOT NULL REFERENCES core.permissions,
  UNIQUE(role_id, permission_id)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| role_id | bigint | NO | — |

| permission_id | bigint | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

| scope | text | NO | 'all'::text |

**Observed integrity and access hooks:**

- Constraint `role_permissions_permission_id_fkey`: `FOREIGN KEY (permission_id) REFERENCES core.permissions(id) ON DELETE CASCADE`

- Constraint `role_permissions_pkey`: `PRIMARY KEY (id)`

- Constraint `role_permissions_role_id_fkey`: `FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE`

- Constraint `role_permissions_role_id_permission_id_key`: `UNIQUE (role_id, permission_id)`

- Constraint `role_permissions_scope_check`: `CHECK (scope = ANY (ARRAY['all'::text, 'subtree'::text, 'own'::text, 'org_unit'::text, 'readonly'::text]))`

- Index `role_permissions_pkey`: `CREATE UNIQUE INDEX role_permissions_pkey ON core.role_permissions USING btree (id)`

- Index `role_permissions_role_id_permission_id_key`: `CREATE UNIQUE INDEX role_permissions_role_id_permission_id_key ON core.role_permissions USING btree (role_id, permission_id)`

- Trigger `role_permissions_updated_at`: `CREATE TRIGGER role_permissions_updated_at BEFORE UPDATE ON core.role_permissions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.roles

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:27`.

```sql

CREATE TABLE core.roles (          -- e.g. employee, manager, hr_ops, hr_head, payroll, plant_head, ceo_cell, it_admin, super_admin
  code TEXT UNIQUE NOT NULL,       -- stable machine name used in permission checks
  name TEXT NOT NULL               -- display label
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `roles_code_key`: `UNIQUE (code)`

- Constraint `roles_pkey`: `PRIMARY KEY (id)`

- Index `roles_code_key`: `CREATE UNIQUE INDEX roles_code_key ON core.roles USING btree (code)`

- Index `roles_pkey`: `CREATE UNIQUE INDEX roles_pkey ON core.roles USING btree (id)`

- Trigger `roles_updated_at`: `CREATE TRIGGER roles_updated_at BEFORE UPDATE ON core.roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.separations

**Status:** SPEC BASELINE. **Cards:** L04, L05.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:700`.

```sql

CREATE TABLE core.separations (     -- LC-06 (SOW-3.5, PP-14)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  initiated_at TIMESTAMPTZ NOT NULL,
  initiated_by TEXT NOT NULL,       -- 'employee'|'hr' (absconding/termination path from att.absence_cases)
  reason TEXT NOT NULL,
  resignation_date DATE NOT NULL,
  notice_period_days SMALLINT NOT NULL,      -- from contract terms (LOI §4)
  requested_lwd DATE NOT NULL,               -- employee-requested last working day
  approved_lwd DATE,                         -- final LWD after approvals (drives DOL)
  workflow_request_id BIGINT NOT NULL,       -- multi-level chain; every approver notified (the Chaitanya-never-notified bug is a WF-02 test case)
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending'|'approved'|'withdrawn'|'rejected'|'completed'
  fnf_id BIGINT                              -- set when settlement created
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## core.settings

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** F03.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| key | text | NO | — |

| value | jsonb | NO | — |

| value_type | text | NO | — |

| description | text | NO | — |

| updated_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `settings_pkey`: `PRIMARY KEY (key)`

- Constraint `settings_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES core.users(id)`

- Index `settings_pkey`: `CREATE UNIQUE INDEX settings_pkey ON core.settings USING btree (key)`

- Trigger `settings_updated_at`: `CREATE TRIGGER settings_updated_at BEFORE UPDATE ON core.settings FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## core.source_mappings

**Status:** PROPOSED AMENDMENT. **Cards:** F02, L01, T04, R01.

**Proposed grain:** One immutable external ID to internal domain record mapping. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## core.transfer_requests

**Status:** PROPOSED AMENDMENT. **Cards:** L03.

**Proposed grain:** One approved effective placement change request. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## core.user_roles

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:42`.

```sql

CREATE TABLE core.user_roles (
  user_id BIGINT NOT NULL REFERENCES core.users,
  role_id BIGINT NOT NULL REFERENCES core.roles,
  scope_org_unit_id BIGINT REFERENCES core.org_units, -- optional: restrict a role to an entity/plant (e.g. plant_head of Plant 1701 only)
  UNIQUE(user_id, role_id, scope_org_unit_id)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| user_id | bigint | NO | — |

| role_id | bigint | NO | — |

| scope_org_unit_id | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `user_roles_pkey`: `PRIMARY KEY (id)`

- Constraint `user_roles_role_id_fkey`: `FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE`

- Constraint `user_roles_scope_fk`: `FOREIGN KEY (scope_org_unit_id) REFERENCES core.org_units(id)`

- Constraint `user_roles_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE`

- Constraint `user_roles_user_id_role_id_scope_org_unit_id_key`: `UNIQUE (user_id, role_id, scope_org_unit_id)`

- Index `user_roles_pkey`: `CREATE UNIQUE INDEX user_roles_pkey ON core.user_roles USING btree (id)`

- Index `user_roles_user_id_role_id_scope_org_unit_id_key`: `CREATE UNIQUE INDEX user_roles_user_id_role_id_scope_org_unit_id_key ON core.user_roles USING btree (user_id, role_id, scope_org_unit_id)`

- Trigger `user_roles_updated_at`: `CREATE TRIGGER user_roles_updated_at BEFORE UPDATE ON core.user_roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## core.users

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:16`.

```sql

CREATE TABLE core.users (
  id            BIGINT ...,
  employee_id   BIGINT REFERENCES core.employees,  -- NULL for pure-admin/service accounts; links login to person
  email         CITEXT UNIQUE NOT NULL,            -- login identifier; company email (Recruiter Details shows @rashmigroup.com)
  password_hash TEXT NOT NULL,                     -- bcrypt
  is_active     BOOLEAN NOT NULL DEFAULT true,     -- disable login on exit (LC-07) without deleting history
  last_login_at TIMESTAMPTZ,                       -- security review / dormant-account cleanup
  failed_attempts SMALLINT NOT NULL DEFAULT 0,     -- lockout counter (NFR-03)
  locked_until  TIMESTAMPTZ                        -- lockout expiry
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | YES | — |

| email | citext | NO | — |

| password_hash | text | NO | — |

| is_active | boolean | NO | true |

| last_login_at | timestamp with time zone | YES | — |

| failed_attempts | smallint | NO | 0 |

| locked_until | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `users_email_key`: `UNIQUE (email)`

- Constraint `users_employee_fk`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `users_pkey`: `PRIMARY KEY (id)`

- Index `users_email_key`: `CREATE UNIQUE INDEX users_email_key ON core.users USING btree (email)`

- Index `users_pkey`: `CREATE UNIQUE INDEX users_pkey ON core.users USING btree (id)`

- Trigger `users_updated_at`: `CREATE TRIGGER users_updated_at BEFORE UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## doc.types

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| code | text | NO | — |

| name | text | NO | — |

| typically_expires | boolean | NO | false |

| retention_class | text | YES | — |

| mandatory_for | text | NO | ''::text |

| sort_order | smallint | NO | 100 |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `types_code_present`: `CHECK (length(btrim(code)) > 0)`

- Constraint `types_name_present`: `CHECK (length(btrim(name)) > 0)`

- Constraint `types_pkey`: `PRIMARY KEY (code)`

- Index `types_pkey`: `CREATE UNIQUE INDEX types_pkey ON doc.types USING btree (code)`

- Trigger `doc_types_updated_at`: `CREATE TRIGGER doc_types_updated_at BEFORE UPDATE ON doc.types FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## eng.announcements

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:823`.

```sql

CREATE TABLE eng.announcements (    -- EN-01 (SOW-7.1)
  title TEXT NOT NULL, body TEXT NOT NULL, publish_at TIMESTAMPTZ NOT NULL,
  audience JSONB, created_by BIGINT NOT NULL REFERENCES core.users
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| title | text | NO | — |

| body | text | NO | — |

| audience | jsonb | NO | '{}'::jsonb |

| published_by | bigint | NO | — |

| published_at | timestamp with time zone | NO | now() |

| expires_at | timestamp with time zone | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `announcements_pkey`: `PRIMARY KEY (id)`

- Constraint `announcements_published_by_fkey`: `FOREIGN KEY (published_by) REFERENCES core.users(id)`

- Index `announcements_live_idx`: `CREATE INDEX announcements_live_idx ON eng.announcements USING btree (published_at DESC) WHERE is_active`

- Index `announcements_pkey`: `CREATE UNIQUE INDEX announcements_pkey ON eng.announcements USING btree (id)`


## eng.poll_responses

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** W03.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| poll_id | bigint | NO | — |

| respondent_user_id | bigint | YES | — |

| option_index | smallint | NO | — |

| comment | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

| respondent_hash | text | YES | — |

**Observed integrity and access hooks:**

- Constraint `poll_responses_identity_mode`: `CHECK ((respondent_user_id IS NULL) <> (respondent_hash IS NULL))`

- Constraint `poll_responses_option_index_check`: `CHECK (option_index >= 0)`

- Constraint `poll_responses_pkey`: `PRIMARY KEY (id)`

- Constraint `poll_responses_poll_id_fkey`: `FOREIGN KEY (poll_id) REFERENCES eng.polls(id)`

- Constraint `poll_responses_respondent_user_id_fkey`: `FOREIGN KEY (respondent_user_id) REFERENCES core.users(id)`

- Index `poll_responses_one_per_anon`: `CREATE UNIQUE INDEX poll_responses_one_per_anon ON eng.poll_responses USING btree (poll_id, respondent_hash) WHERE (respondent_hash IS NOT NULL)`

- Index `poll_responses_one_per_person`: `CREATE UNIQUE INDEX poll_responses_one_per_person ON eng.poll_responses USING btree (poll_id, respondent_user_id) WHERE (respondent_user_id IS NOT NULL)`

- Index `poll_responses_pkey`: `CREATE UNIQUE INDEX poll_responses_pkey ON eng.poll_responses USING btree (id)`

- Index `poll_responses_tally_idx`: `CREATE INDEX poll_responses_tally_idx ON eng.poll_responses USING btree (poll_id, option_index)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## eng.poll_votes

**Status:** SPEC BASELINE. **Cards:** F01 inventory/classification.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:830`.

```sql

CREATE TABLE eng.poll_votes (
  poll_id BIGINT NOT NULL REFERENCES eng.polls, voter_user_id BIGINT NOT NULL, option_index SMALLINT NOT NULL,
  UNIQUE(poll_id, voter_user_id)    -- one vote; voter id stored for uniqueness, excluded from result queries when anonymous
);

```


## eng.polls

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:827`.

```sql

CREATE TABLE eng.polls (            -- EN-02
  question TEXT NOT NULL, options JSONB NOT NULL, open_till TIMESTAMPTZ NOT NULL, is_anonymous BOOLEAN NOT NULL DEFAULT true
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| question | text | NO | — |

| options | jsonb | NO | — |

| kind | text | NO | 'poll'::text |

| is_anonymous | boolean | NO | false |

| audience | jsonb | NO | '{}'::jsonb |

| created_by | bigint | NO | — |

| opens_at | timestamp with time zone | NO | now() |

| closes_at | timestamp with time zone | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `polls_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

- Constraint `polls_kind_check`: `CHECK (kind = ANY (ARRAY['poll'::text, 'pulse'::text]))`

- Constraint `polls_pkey`: `PRIMARY KEY (id)`

- Index `polls_pkey`: `CREATE UNIQUE INDEX polls_pkey ON eng.polls USING btree (id)`


## eng.survey_responses

**Status:** SPEC BASELINE. **Cards:** W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:838`.

```sql

CREATE TABLE eng.survey_responses (
  survey_id BIGINT NOT NULL REFERENCES eng.surveys, respondent_hash TEXT NOT NULL, -- salted hash when anonymous (dedupe without identity)
  answers JSONB NOT NULL,
  UNIQUE(survey_id, respondent_hash)
);

```


## eng.surveys

**Status:** SPEC BASELINE. **Cards:** W03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:834`.

```sql

CREATE TABLE eng.surveys (          -- EN-03 pulse surveys (SOW-7.2)
  title TEXT NOT NULL, questions JSONB NOT NULL, -- [{q, type:'rating'|'text'|'choice', options?}]
  open_from TIMESTAMPTZ NOT NULL, open_till TIMESTAMPTZ NOT NULL, is_anonymous BOOLEAN NOT NULL DEFAULT true
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## hd.categories

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** W02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| assignee_role_code | text | YES | — |

| sla_hours | integer | NO | 24 |

| escalate_after_hours | integer | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `categories_code_key`: `UNIQUE (code)`

- Constraint `categories_escalate_after_hours_check`: `CHECK (escalate_after_hours IS NULL OR escalate_after_hours > 0)`

- Constraint `categories_pkey`: `PRIMARY KEY (id)`

- Constraint `categories_sla_hours_check`: `CHECK (sla_hours > 0)`

- Index `categories_code_key`: `CREATE UNIQUE INDEX categories_code_key ON hd.categories USING btree (code)`

- Index `categories_pkey`: `CREATE UNIQUE INDEX categories_pkey ON hd.categories USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## hd.escalation_rules

**Status:** PROPOSED AMENDMENT. **Cards:** W02.

**Proposed grain:** One effective category/level routing rule. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## hd.ticket_events

**Status:** PROPOSED AMENDMENT. **Cards:** W02.

**Proposed grain:** One immutable ticket lifecycle/SLA-cycle event. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## hd.ticket_messages

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:817`.

```sql

CREATE TABLE hd.ticket_messages (   -- thread (query logs for audit — SOW-9.4)
  ticket_id BIGINT NOT NULL REFERENCES hd.tickets,
  author_user_id BIGINT NOT NULL REFERENCES core.users,
  body TEXT NOT NULL, attachment_document_id BIGINT REFERENCES core.documents
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| ticket_id | bigint | NO | — |

| author_user_id | bigint | NO | — |

| body | text | NO | — |

| is_internal | boolean | NO | false |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `ticket_messages_author_user_id_fkey`: `FOREIGN KEY (author_user_id) REFERENCES core.users(id)`

- Constraint `ticket_messages_pkey`: `PRIMARY KEY (id)`

- Constraint `ticket_messages_ticket_id_fkey`: `FOREIGN KEY (ticket_id) REFERENCES hd.tickets(id)`

- Index `ticket_messages_pkey`: `CREATE UNIQUE INDEX ticket_messages_pkey ON hd.ticket_messages USING btree (id)`

- Index `ticket_messages_thread_idx`: `CREATE INDEX ticket_messages_thread_idx ON hd.ticket_messages USING btree (ticket_id, created_at)`

- Trigger `ticket_messages_append_only`: `CREATE TRIGGER ticket_messages_append_only BEFORE DELETE OR UPDATE ON hd.ticket_messages FOR EACH ROW EXECUTE FUNCTION hd.reject_message_mutation()`


## hd.tickets

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** W02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:808`.

```sql

CREATE TABLE hd.tickets (           -- HD-01 (SOW-9)
  raised_by BIGINT NOT NULL REFERENCES core.users,
  category TEXT NOT NULL,           -- configurable list (payroll query, attendance, IT, admin…)
  subject TEXT NOT NULL, body TEXT NOT NULL,
  assignee_user_id BIGINT REFERENCES core.users,  -- auto-assignment by category routing
  status TEXT NOT NULL DEFAULT 'open',            -- 'open'|'pending'|'resolved'|'closed'
  sla_due_at TIMESTAMPTZ NOT NULL, escalated_level SMALLINT NOT NULL DEFAULT 0, -- escalation matrix (SOW-9.2)
  resolved_at TIMESTAMPTZ, resolution TEXT
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| ticket_no | text | NO | — |

| raised_by | bigint | NO | — |

| category_id | bigint | NO | — |

| subject | text | NO | — |

| body | text | NO | — |

| assignee_user_id | bigint | YES | — |

| status | text | NO | 'open'::text |

| priority | text | NO | 'normal'::text |

| sla_due_at | timestamp with time zone | NO | — |

| escalated_level | smallint | NO | 0 |

| escalated_at | timestamp with time zone | YES | — |

| acknowledged_at | timestamp with time zone | YES | — |

| resolved_at | timestamp with time zone | YES | — |

| resolution | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `tickets_assignee_user_id_fkey`: `FOREIGN KEY (assignee_user_id) REFERENCES core.users(id)`

- Constraint `tickets_category_id_fkey`: `FOREIGN KEY (category_id) REFERENCES hd.categories(id)`

- Constraint `tickets_escalated_level_check`: `CHECK (escalated_level >= 0)`

- Constraint `tickets_pkey`: `PRIMARY KEY (id)`

- Constraint `tickets_priority_check`: `CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))`

- Constraint `tickets_raised_by_fkey`: `FOREIGN KEY (raised_by) REFERENCES core.users(id)`

- Constraint `tickets_resolution_complete`: `CHECK ((status <> ALL (ARRAY['resolved'::text, 'closed'::text])) OR resolved_at IS NOT NULL AND resolution IS NOT NULL)`

- Constraint `tickets_status_check`: `CHECK (status = ANY (ARRAY['open'::text, 'pending'::text, 'resolved'::text, 'closed'::text]))`

- Constraint `tickets_ticket_no_key`: `UNIQUE (ticket_no)`

- Index `tickets_assignee_idx`: `CREATE INDEX tickets_assignee_idx ON hd.tickets USING btree (assignee_user_id) WHERE (status = ANY (ARRAY['open'::text, 'pending'::text]))`

- Index `tickets_pkey`: `CREATE UNIQUE INDEX tickets_pkey ON hd.tickets USING btree (id)`

- Index `tickets_queue_idx`: `CREATE INDEX tickets_queue_idx ON hd.tickets USING btree (status, sla_due_at)`

- Index `tickets_raiser_idx`: `CREATE INDEX tickets_raiser_idx ON hd.tickets USING btree (raised_by, created_at DESC)`

- Index `tickets_ticket_no_key`: `CREATE UNIQUE INDEX tickets_ticket_no_key ON hd.tickets USING btree (ticket_no)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## ird.grievances

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| case_ref | text | NO | — |

| status | text | NO | 'submitted'::text |

| filed_at | timestamp with time zone | NO | now() |

| filed_by_user_id | bigint | NO | — |

| summary | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `grievances_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

- Constraint `grievances_pkey`: `PRIMARY KEY (id)`

- Constraint `grievances_ref_present`: `CHECK (length(btrim(case_ref)) > 0)`

- Constraint `grievances_status_check`: `CHECK (status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'escalated'::text, 'resolved'::text, 'closed'::text]))`

- Constraint `grievances_summary_present`: `CHECK (length(btrim(summary)) >= 10)`

- Index `grievances_pkey`: `CREATE UNIQUE INDEX grievances_pkey ON ird.grievances USING btree (id)`

- Index `grievances_ref_uq`: `CREATE UNIQUE INDEX grievances_ref_uq ON ird.grievances USING btree (case_ref)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## ird.ic_members

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| role | text | NO | — |

| active | boolean | NO | true |

| appointed_on | date | NO | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `ic_members_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `ic_members_pkey`: `PRIMARY KEY (id)`

- Constraint `ic_members_role_check`: `CHECK (role = ANY (ARRAY['presiding_officer'::text, 'member'::text, 'external'::text]))`

- Index `ic_members_active_idx`: `CREATE INDEX ic_members_active_idx ON ird.ic_members USING btree (active) WHERE active`

- Index `ic_members_pkey`: `CREATE UNIQUE INDEX ic_members_pkey ON ird.ic_members USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## ird.posh_case_access_log

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| case_id | bigint | NO | — |

| actor_user_id | bigint | NO | — |

| opened_at | timestamp with time zone | NO | now() |

| ip | text | YES | — |

| outcome | text | NO | 'opened'::text |

**Observed integrity and access hooks:**

- Constraint `posh_case_access_log_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

- Constraint `posh_case_access_log_case_id_fkey`: `FOREIGN KEY (case_id) REFERENCES ird.posh_cases(id)`

- Constraint `posh_case_access_log_outcome_check`: `CHECK (outcome = ANY (ARRAY['opened'::text, 'refused'::text]))`

- Constraint `posh_case_access_log_pkey`: `PRIMARY KEY (id)`

- Index `posh_case_access_log_pkey`: `CREATE UNIQUE INDEX posh_case_access_log_pkey ON ird.posh_case_access_log USING btree (id)`

- Trigger `posh_access_log_immutable`: `CREATE TRIGGER posh_access_log_immutable BEFORE DELETE OR UPDATE ON ird.posh_case_access_log FOR EACH ROW EXECUTE FUNCTION ird.posh_access_log_immutable()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## ird.posh_cases

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| case_ref | text | NO | — |

| status | text | NO | 'submitted'::text |

| filed_at | timestamp with time zone | NO | now() |

| filed_by_user_id | bigint | YES | — |

| is_anonymous | boolean | NO | false |

| summary_encrypted_or_text | text | NO | — |

| anonymous_token_hash | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `posh_cases_anonymous_pair`: `CHECK (is_anonymous = false AND filed_by_user_id IS NOT NULL OR is_anonymous = true AND filed_by_user_id IS NULL AND anonymous_token_hash IS NOT NULL)`

- Constraint `posh_cases_filed_by_user_id_fkey`: `FOREIGN KEY (filed_by_user_id) REFERENCES core.users(id)`

- Constraint `posh_cases_pkey`: `PRIMARY KEY (id)`

- Constraint `posh_cases_ref_present`: `CHECK (length(btrim(case_ref)) > 0)`

- Constraint `posh_cases_status_check`: `CHECK (status = ANY (ARRAY['submitted'::text, 'under_inquiry'::text, 'closed'::text, 'withdrawn'::text]))`

- Constraint `posh_cases_summary_present`: `CHECK (length(btrim(summary_encrypted_or_text)) >= 10)`

- Index `posh_cases_anon_token_uq`: `CREATE UNIQUE INDEX posh_cases_anon_token_uq ON ird.posh_cases USING btree (anonymous_token_hash) WHERE (anonymous_token_hash IS NOT NULL)`

- Index `posh_cases_pkey`: `CREATE UNIQUE INDEX posh_cases_pkey ON ird.posh_cases USING btree (id)`

- Index `posh_cases_ref_uq`: `CREATE UNIQUE INDEX posh_cases_ref_uq ON ird.posh_cases USING btree (case_ref)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## ird.whistleblower_reports

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| anonymous_token_hash | text | NO | — |

| status | text | NO | 'submitted'::text |

| filed_at | timestamp with time zone | NO | now() |

| summary | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `whistle_summary_present`: `CHECK (length(btrim(summary)) >= 10)`

- Constraint `whistle_token_present`: `CHECK (length(btrim(anonymous_token_hash)) = 64)`

- Constraint `whistleblower_reports_pkey`: `PRIMARY KEY (id)`

- Constraint `whistleblower_reports_status_check`: `CHECK (status = ANY (ARRAY['submitted'::text, 'triaged'::text, 'investigating'::text, 'closed'::text]))`

- Index `whistle_token_uq`: `CREATE UNIQUE INDEX whistle_token_uq ON ird.whistleblower_reports USING btree (anonymous_token_hash)`

- Index `whistleblower_reports_pkey`: `CREATE UNIQUE INDEX whistleblower_reports_pkey ON ird.whistleblower_reports USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## lv.applications

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:426`.

```sql

CREATE TABLE lv.applications (      -- LV-03
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  leave_type_id BIGINT NOT NULL REFERENCES lv.leave_types,
  from_date DATE NOT NULL, to_date DATE NOT NULL,
  from_half BOOLEAN NOT NULL DEFAULT false, to_half BOOLEAN NOT NULL DEFAULT false, -- half-day support
  days NUMERIC(4,1) NOT NULL,       -- computed net of sandwich rule; snapshot for payroll
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'cancelled'
  workflow_request_id BIGINT NOT NULL,
  ledger_txn_id BIGINT REFERENCES lv.ledger  -- debit created on approval; reversal on cancel
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| leave_type_id | bigint | NO | — |

| from_date | date | NO | — |

| to_date | date | NO | — |

| from_half | boolean | NO | false |

| to_half | boolean | NO | false |

| days | numeric(4,1) | NO | — |

| reason | text | YES | — |

| status | text | NO | 'pending'::text |

| workflow_request_id | bigint | NO | — |

| cancel_workflow_request_id | bigint | YES | — |

| ledger_txn_id | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `applications_cancel_workflow_request_id_fkey`: `FOREIGN KEY (cancel_workflow_request_id) REFERENCES wf.requests(id)`

- Constraint `applications_check`: `CHECK (from_date <= to_date)`

- Constraint `applications_days_check`: `CHECK (days > 0::numeric)`

- Constraint `applications_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `applications_leave_type_id_fkey`: `FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id)`

- Constraint `applications_ledger_txn_id_fkey`: `FOREIGN KEY (ledger_txn_id) REFERENCES lv.ledger(id)`

- Constraint `applications_pkey`: `PRIMARY KEY (id)`

- Constraint `applications_status_check`: `CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]))`

- Constraint `applications_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `applications_pkey`: `CREATE UNIQUE INDEX applications_pkey ON lv.applications USING btree (id)`

- Index `lv_applications_cancel_wf_idx`: `CREATE UNIQUE INDEX lv_applications_cancel_wf_idx ON lv.applications USING btree (cancel_workflow_request_id) WHERE (cancel_workflow_request_id IS NOT NULL)`

- Index `lv_applications_emp_idx`: `CREATE INDEX lv_applications_emp_idx ON lv.applications USING btree (employee_id, from_date)`

- Index `lv_applications_wf_idx`: `CREATE UNIQUE INDEX lv_applications_wf_idx ON lv.applications USING btree (workflow_request_id)`

- Trigger `applications_updated_at`: `CREATE TRIGGER applications_updated_at BEFORE UPDATE ON lv.applications FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## lv.credit_allocations

**Status:** PROPOSED AMENDMENT. **Cards:** A04.

**Proposed grain:** One debit/reversal allocation against a specific leave credit. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## lv.leave_types

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:400`.

```sql

CREATE TABLE lv.leave_types (       -- LV-01 (SOW-4.3a): CL, SL, EL, ML, CO, LWP
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT true,           -- LWP=false → LOP feed to payroll
  accrual_per_month NUMERIC(5,2) NOT NULL DEFAULT 0, -- monthly credit amount (LV-02); 0 = granted, not accrued
  accrual_requires_service_months SMALLINT NOT NULL DEFAULT 0, -- EL only after 12 months (Latest-Update 'Earned Leave')
  max_carry_forward NUMERIC(5,2),   -- year-end carry rule (SOW-4.3e); NULL = unlimited
  encashable BOOLEAN NOT NULL DEFAULT false,       -- EL encashment in F&F (PAY-15)
  max_per_request NUMERIC(4,1),     -- policy cap
  allow_half_day BOOLEAN NOT NULL DEFAULT true,
  sandwich_rule TEXT NOT NULL DEFAULT 'exclude',   -- 'include'|'exclude' holidays/week-offs inside a leave span (LV-03)
  applicable_categories core.employment_category[] -- e.g. ML rules, trainee restrictions
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| is_paid | boolean | NO | true |

| accrual_per_month | numeric(5,2) | NO | 0 |

| accrual_requires_service_months | smallint | NO | 0 |

| max_carry_forward | numeric(5,2) | YES | — |

| encashable | boolean | NO | false |

| max_per_request | numeric(4,1) | YES | — |

| allow_half_day | boolean | NO | true |

| sandwich_rule | text | NO | 'exclude'::text |

| applicable_categories | _employment_category | YES | — |

| applicable_gender | text | YES | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `leave_types_code_key`: `UNIQUE (code)`

- Constraint `leave_types_pkey`: `PRIMARY KEY (id)`

- Constraint `leave_types_sandwich_rule_check`: `CHECK (sandwich_rule = ANY (ARRAY['include'::text, 'exclude'::text]))`

- Index `leave_types_code_key`: `CREATE UNIQUE INDEX leave_types_code_key ON lv.leave_types USING btree (code)`

- Index `leave_types_pkey`: `CREATE UNIQUE INDEX leave_types_pkey ON lv.leave_types USING btree (id)`

- Trigger `leave_types_updated_at`: `CREATE TRIGGER leave_types_updated_at BEFORE UPDATE ON lv.leave_types FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## lv.ledger

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A04, L05.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:413`.

```sql

CREATE TABLE lv.ledger (            -- LV-05: immutable transactions; balance = SUM(delta)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  leave_type_id BIGINT NOT NULL REFERENCES lv.leave_types,
  txn_type TEXT NOT NULL,           -- 'accrual'|'grant'|'application'|'cancel'|'lapse'|'encash'|'comp_off_earn'|'adjustment'
  delta NUMERIC(5,2) NOT NULL,      -- + credit / − debit
  effective_date DATE NOT NULL,
  expiry_date DATE,                 -- comp-off expiry window (LV-04)
  reference_id BIGINT,              -- application id / payroll run id / OT entry id that caused it
  note TEXT,                        -- mandatory for 'adjustment' (audited manual correction)
  created_by BIGINT REFERENCES core.users -- NULL = system job (LV-02 auto-credit)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| leave_type_id | bigint | NO | — |

| txn_type | text | NO | — |

| delta | numeric(5,2) | NO | — |

| effective_date | date | NO | — |

| expiry_date | date | YES | — |

| reference_id | bigint | YES | — |

| note | text | YES | — |

| created_by | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `ledger_check`: `CHECK (txn_type <> 'adjustment'::text OR note IS NOT NULL)`

- Constraint `ledger_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES core.users(id)`

- Constraint `ledger_delta_check`: `CHECK (delta <> 0::numeric)`

- Constraint `ledger_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `ledger_leave_type_id_fkey`: `FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id)`

- Constraint `ledger_pkey`: `PRIMARY KEY (id)`

- Constraint `ledger_txn_type_check`: `CHECK (txn_type = ANY (ARRAY['accrual'::text, 'grant'::text, 'application'::text, 'cancel'::text, 'lapse'::text, 'encash'::text, 'comp_off_earn'::text, 'adjustment'::text]))`

- Index `ledger_pkey`: `CREATE UNIQUE INDEX ledger_pkey ON lv.ledger USING btree (id)`

- Index `lv_ledger_accrual_once`: `CREATE UNIQUE INDEX lv_ledger_accrual_once ON lv.ledger USING btree (employee_id, leave_type_id, effective_date) WHERE (txn_type = 'accrual'::text)`

- Index `lv_ledger_emp_type_idx`: `CREATE INDEX lv_ledger_emp_type_idx ON lv.ledger USING btree (employee_id, leave_type_id, effective_date)`

- Trigger `ledger_immutable`: `CREATE TRIGGER ledger_immutable BEFORE DELETE OR UPDATE ON lv.ledger FOR EACH ROW EXECUTE FUNCTION lv.ledger_immutable()`


## lv.operation_keys

**Status:** PROPOSED AMENDMENT. **Cards:** A04.

**Proposed grain:** One deterministic accrual/lapse/year-end operation. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## lv.restricted_holidays

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A04.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| holiday_date | date | NO | — |

| name | text | NO | — |

| location_id | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `restricted_holidays_holiday_date_name_key`: `UNIQUE (holiday_date, name)`

- Constraint `restricted_holidays_location_id_fkey`: `FOREIGN KEY (location_id) REFERENCES core.locations(id)`

- Constraint `restricted_holidays_pkey`: `PRIMARY KEY (id)`

- Index `restricted_holidays_holiday_date_name_key`: `CREATE UNIQUE INDEX restricted_holidays_holiday_date_name_key ON lv.restricted_holidays USING btree (holiday_date, name)`

- Index `restricted_holidays_pkey`: `CREATE UNIQUE INDEX restricted_holidays_pkey ON lv.restricted_holidays USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## lv.rh_selections

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A04.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| restricted_holiday_id | bigint | NO | — |

| workflow_request_id | bigint | NO | — |

| applied | boolean | NO | false |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `rh_selections_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `rh_selections_employee_id_restricted_holiday_id_key`: `UNIQUE (employee_id, restricted_holiday_id)`

- Constraint `rh_selections_pkey`: `PRIMARY KEY (id)`

- Constraint `rh_selections_restricted_holiday_id_fkey`: `FOREIGN KEY (restricted_holiday_id) REFERENCES lv.restricted_holidays(id)`

- Constraint `rh_selections_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `lv_rh_selections_wf_idx`: `CREATE UNIQUE INDEX lv_rh_selections_wf_idx ON lv.rh_selections USING btree (workflow_request_id)`

- Index `rh_selections_employee_id_restricted_holiday_id_key`: `CREATE UNIQUE INDEX rh_selections_employee_id_restricted_holiday_id_key ON lv.rh_selections USING btree (employee_id, restricted_holiday_id)`

- Index `rh_selections_pkey`: `CREATE UNIQUE INDEX rh_selections_pkey ON lv.rh_selections USING btree (id)`

- Trigger `rh_selections_updated_at`: `CREATE TRIGGER rh_selections_updated_at BEFORE UPDATE ON lv.rh_selections FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## pay.arrears

**Status:** SPEC BASELINE. **Cards:** P02, P07.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:526`.

```sql

CREATE TABLE pay.arrears (          -- PAY-16: revision arrears, component-wise
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  source_salary_id BIGINT NOT NULL REFERENCES pay.employee_salaries, -- the revision that caused it
  for_month DATE NOT NULL,          -- month being corrected
  paid_in_run_id BIGINT REFERENCES pay.payroll_runs,
  component_code TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.bank_batch_lines

**Status:** PROPOSED AMENDMENT. **Cards:** P04.

**Proposed grain:** One payable obligation portion in one frozen bank file version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.bank_batches

**Status:** SPEC BASELINE. **Cards:** P04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:579`.

```sql

CREATE TABLE pay.bank_batches (     -- PAY-05 bank transfer file per run
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  file_document_id BIGINT NOT NULL REFERENCES core.documents,
  total_amount NUMERIC(16,2) NOT NULL, record_count INTEGER NOT NULL,
  generated_by BIGINT NOT NULL REFERENCES core.users
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.budget_categories

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** P06, T01.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| budget_id | bigint | NO | — |

| claim_type_id | bigint | NO | — |

| allowance | numeric(14,2) | NO | — |

**Observed integrity and access hooks:**

- Constraint `budget_categories_allowance_check`: `CHECK (allowance >= 0::numeric)`

- Constraint `budget_categories_budget_id_claim_type_id_key`: `UNIQUE (budget_id, claim_type_id)`

- Constraint `budget_categories_budget_id_fkey`: `FOREIGN KEY (budget_id) REFERENCES pay.budgets(id) ON DELETE CASCADE`

- Constraint `budget_categories_claim_type_id_fkey`: `FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id)`

- Constraint `budget_categories_pkey`: `PRIMARY KEY (id)`

- Index `budget_categories_budget_id_claim_type_id_key`: `CREATE UNIQUE INDEX budget_categories_budget_id_claim_type_id_key ON pay.budget_categories USING btree (budget_id, claim_type_id)`

- Index `budget_categories_pkey`: `CREATE UNIQUE INDEX budget_categories_pkey ON pay.budget_categories USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## pay.budgets

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** P06, T01.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| reference | text | NO | — |

| title | text | NO | — |

| purpose | text | YES | — |

| employee_id | bigint | NO | — |

| company_id | bigint | NO | — |

| cost_center_id | bigint | YES | — |

| period_from | date | NO | — |

| period_to | date | NO | — |

| travel_type | text | YES | — |

| region | text | YES | — |

| from_location | text | YES | — |

| to_location | text | YES | — |

| travel_start | date | YES | — |

| travel_end | date | YES | — |

| nights | smallint | YES | — |

| desk_books_air | boolean | NO | false |

| desk_books_hotel | boolean | NO | false |

| desk_books_visa | boolean | NO | false |

| own_arrangement_reason | text | YES | — |

| limit_exceed_reason | text | YES | — |

| allowance | numeric(14,2) | NO | — |

| approved_allowance | numeric(14,2) | YES | — |

| currency | text | NO | 'INR'::text |

| fx_rate_to_inr | numeric(14,6) | NO | 1 |

| fx_rate_date | date | YES | — |

| status | text | NO | 'draft'::text |

| overspend_allowed | boolean | NO | false |

| workflow_request_id | bigint | YES | — |

| approved_by_user_id | bigint | YES | — |

| approved_at | timestamp with time zone | YES | — |

| rejection_reason | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `budgets_allowance_positive`: `CHECK (allowance > 0::numeric)`

- Constraint `budgets_approval_pairs`: `CHECK (status <> 'approved'::text OR approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)`

- Constraint `budgets_approved_allowance_check`: `CHECK (approved_allowance IS NULL OR approved_allowance >= 0::numeric)`

- Constraint `budgets_approved_allowance_present`: `CHECK (status <> 'approved'::text OR approved_allowance IS NOT NULL)`

- Constraint `budgets_approved_by_user_id_fkey`: `FOREIGN KEY (approved_by_user_id) REFERENCES core.users(id)`

- Constraint `budgets_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `budgets_cost_center_id_fkey`: `FOREIGN KEY (cost_center_id) REFERENCES core.cost_centers(id)`

- Constraint `budgets_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `budgets_fx_rate_to_inr_check`: `CHECK (fx_rate_to_inr > 0::numeric)`

- Constraint `budgets_nights_check`: `CHECK (nights IS NULL OR nights >= 0)`

- Constraint `budgets_period_ordered`: `CHECK (period_to >= period_from)`

- Constraint `budgets_pkey`: `PRIMARY KEY (id)`

- Constraint `budgets_reference_key`: `UNIQUE (reference)`

- Constraint `budgets_rejection_reasoned`: `CHECK (status <> 'rejected'::text OR length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)`

- Constraint `budgets_status_check`: `CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'closed'::text]))`

- Constraint `budgets_travel_dates_ordered`: `CHECK (travel_start IS NULL OR travel_end IS NULL OR travel_end >= travel_start)`

- Constraint `budgets_travel_type_check`: `CHECK (travel_type = ANY (ARRAY['domestic'::text, 'international'::text]))`

- Index `budgets_company_idx`: `CREATE INDEX budgets_company_idx ON pay.budgets USING btree (company_id, period_from)`

- Index `budgets_employee_idx`: `CREATE INDEX budgets_employee_idx ON pay.budgets USING btree (employee_id, status)`

- Index `budgets_pkey`: `CREATE UNIQUE INDEX budgets_pkey ON pay.budgets USING btree (id)`

- Index `budgets_reference_key`: `CREATE UNIQUE INDEX budgets_reference_key ON pay.budgets USING btree (reference)`

- Trigger `budgets_updated_at`: `CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON pay.budgets FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## pay.claim_bills

**Status:** SPEC BASELINE. **Cards:** P06.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:653`.

```sql

CREATE TABLE pay.claim_bills (      -- CLM-02 multiple bill uploads per claim
  claim_id BIGINT NOT NULL REFERENCES pay.claims,
  document_id BIGINT NOT NULL REFERENCES core.documents,
  bill_no TEXT, bill_date DATE, amount NUMERIC(14,2) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false, verified_by BIGINT REFERENCES core.users -- HR bill check (CLM-03)
);

```


## pay.claim_entitlements

**Status:** SPEC BASELINE. **Cards:** P06.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:632`.

```sql

CREATE TABLE pay.claim_entitlements ( -- per grade × type limit (CLM-01); NULL grade = default
  claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types,
  grade_id BIGINT REFERENCES core.grades,
  amount NUMERIC(14,2) NOT NULL,    -- entitlement per basis period
  effective_from DATE NOT NULL      -- policy revisions without history loss
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.claim_lines

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** P06, T01, T02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| claim_id | bigint | NO | — |

| claim_type_id | bigint | NO | — |

| description | text | YES | — |

| spent_on | date | NO | — |

| bill_no | text | YES | — |

| original_amount | numeric(14,2) | NO | — |

| original_currency | text | NO | 'INR'::text |

| fx_rate_to_inr | numeric(14,6) | NO | 1 |

| amount | numeric(14,2) | NO | — |

| document_path | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `claim_lines_amount_check`: `CHECK (amount > 0::numeric)`

- Constraint `claim_lines_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES pay.claims(id) ON DELETE CASCADE`

- Constraint `claim_lines_claim_type_id_fkey`: `FOREIGN KEY (claim_type_id) REFERENCES pay.claim_types(id)`

- Constraint `claim_lines_fx_rate_to_inr_check`: `CHECK (fx_rate_to_inr > 0::numeric)`

- Constraint `claim_lines_original_amount_check`: `CHECK (original_amount > 0::numeric)`

- Constraint `claim_lines_pkey`: `PRIMARY KEY (id)`

- Index `claim_lines_claim_idx`: `CREATE INDEX claim_lines_claim_idx ON pay.claim_lines USING btree (claim_id)`

- Index `claim_lines_pkey`: `CREATE UNIQUE INDEX claim_lines_pkey ON pay.claim_lines USING btree (id)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## pay.claim_reservations

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** P06, T01, T02.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| budget_id | bigint | NO | — |

| claim_id | bigint | NO | — |

| movement | text | NO | — |

| amount | numeric(14,2) | NO | — |

| by_category | jsonb | YES | — |

| reason | text | NO | — |

| actor_user_id | bigint | YES | — |

| occurred_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `claim_reservations_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

- Constraint `claim_reservations_amount_check`: `CHECK (amount > 0::numeric)`

- Constraint `claim_reservations_budget_id_fkey`: `FOREIGN KEY (budget_id) REFERENCES pay.budgets(id)`

- Constraint `claim_reservations_claim_id_fkey`: `FOREIGN KEY (claim_id) REFERENCES pay.claims(id)`

- Constraint `claim_reservations_movement_check`: `CHECK (movement = ANY (ARRAY['reserve'::text, 'release'::text]))`

- Constraint `claim_reservations_pkey`: `PRIMARY KEY (id)`

- Index `claim_reservations_budget_idx`: `CREATE INDEX claim_reservations_budget_idx ON pay.claim_reservations USING btree (budget_id, occurred_at)`

- Index `claim_reservations_claim_idx`: `CREATE INDEX claim_reservations_claim_idx ON pay.claim_reservations USING btree (claim_id)`

- Index `claim_reservations_pkey`: `CREATE UNIQUE INDEX claim_reservations_pkey ON pay.claim_reservations USING btree (id)`

- Trigger `claim_reservations_immutable`: `CREATE TRIGGER claim_reservations_immutable BEFORE DELETE OR UPDATE ON pay.claim_reservations FOR EACH ROW EXECUTE FUNCTION pay.claim_reservations_immutable()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## pay.claim_types

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** P06.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:623`.

```sql

CREATE TABLE pay.claim_types (
  code TEXT UNIQUE NOT NULL,        -- 'medical'|'conveyance'|'telephone'|'lta'|'relocation'|'misc'
  name TEXT NOT NULL,
  entitlement_basis TEXT NOT NULL,  -- 'annual'|'monthly'|'per_event' (CLM-01)
  bill_required BOOLEAN NOT NULL DEFAULT true,
  taxable_if_unsubstantiated BOOLEAN NOT NULL DEFAULT true, -- year-end TDS on unclaimed/unproven (CLM-05)
  payout_component_code TEXT NOT NULL REFERENCES pay.salary_components(code) -- which payslip line pays it (CLM-04)
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| code | text | NO | — |

| name | text | NO | — |

| requires_bill | boolean | NO | true |

| is_taxable | boolean | NO | false |

| is_active | boolean | NO | true |

| sort_order | smallint | NO | 100 |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `claim_types_code_key`: `UNIQUE (code)`

- Constraint `claim_types_pkey`: `PRIMARY KEY (id)`

- Index `claim_types_code_key`: `CREATE UNIQUE INDEX claim_types_code_key ON pay.claim_types USING btree (code)`

- Index `claim_types_pkey`: `CREATE UNIQUE INDEX claim_types_pkey ON pay.claim_types USING btree (id)`

- Trigger `claim_types_updated_at`: `CREATE TRIGGER claim_types_updated_at BEFORE UPDATE ON pay.claim_types FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## pay.claims

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** P06, L04, T01, T02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:639`.

```sql

CREATE TABLE pay.claims (
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  claim_type_id BIGINT NOT NULL REFERENCES pay.claim_types,
  period_from DATE NOT NULL, period_to DATE NOT NULL, -- expense period (entitlement bucket resolution)
  claimed_amount NUMERIC(14,2) NOT NULL,
  approved_amount NUMERIC(14,2),    -- partial approval allowed (CLM-03); NULL until decided
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'verified'|'approved'|'rejected'|'paid'
  workflow_request_id BIGINT NOT NULL,     -- RM → HR verify → payroll (chain in 08-ROLES §4)
  rejection_reason TEXT,             -- mandatory when rejected (CLM-03)
  advance_loan_id BIGINT REFERENCES pay.loans, -- travel-advance adjustment linkage (CLM-07)
  paid_in_run_id BIGINT REFERENCES pay.payroll_runs, -- payroll payout (CLM-04)
  paid_in_batch_id BIGINT REFERENCES pay.bank_batches -- OR off-cycle reimbursement batch — CHECK: not both
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| reference | text | NO | — |

| employee_id | bigint | NO | — |

| funding_kind | text | NO | 'budget'::text |

| budget_id | bigint | YES | — |

| reserved_budget_id | bigint | YES | — |

| period_from | date | NO | — |

| period_to | date | NO | — |

| claimed_amount | numeric(14,2) | NO | — |

| approved_amount | numeric(14,2) | YES | — |

| display_currency | text | NO | 'INR'::text |

| fx_rates_to_inr | jsonb | YES | — |

| fx_rate_date | date | YES | — |

| settlement_status | text | NO | 'unsettled'::text |

| settlement_mode | text | YES | — |

| settlement_amount | numeric(14,2) | YES | — |

| net_payable | numeric(14,2) | YES | — |

| settled_by_user_id | bigint | YES | — |

| settled_at | timestamp with time zone | YES | — |

| status | text | NO | 'draft'::text |

| workflow_request_id | bigint | YES | — |

| rejection_reason | text | YES | — |

| submitted_at | timestamp with time zone | YES | — |

| decided_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `claims_approved_amount_check`: `CHECK (approved_amount IS NULL OR approved_amount >= 0::numeric)`

- Constraint `claims_approved_within_claimed`: `CHECK (approved_amount IS NULL OR approved_amount <= claimed_amount)`

- Constraint `claims_budget_id_fkey`: `FOREIGN KEY (budget_id) REFERENCES pay.budgets(id)`

- Constraint `claims_budget_present`: `CHECK (funding_kind <> 'budget'::text OR budget_id IS NOT NULL)`

- Constraint `claims_claimed_amount_check`: `CHECK (claimed_amount > 0::numeric)`

- Constraint `claims_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `claims_funding_kind_check`: `CHECK (funding_kind = ANY (ARRAY['budget'::text, 'entitlement'::text]))`

- Constraint `claims_period_ordered`: `CHECK (period_to >= period_from)`

- Constraint `claims_pkey`: `PRIMARY KEY (id)`

- Constraint `claims_reference_key`: `UNIQUE (reference)`

- Constraint `claims_rejection_reasoned`: `CHECK (status <> 'rejected'::text OR length(btrim(COALESCE(rejection_reason, ''::text))) >= 3)`

- Constraint `claims_reserved_budget_id_fkey`: `FOREIGN KEY (reserved_budget_id) REFERENCES pay.budgets(id)`

- Constraint `claims_settled_by_user_id_fkey`: `FOREIGN KEY (settled_by_user_id) REFERENCES core.users(id)`

- Constraint `claims_settled_pairs`: `CHECK (settlement_status <> 'settled'::text OR settlement_mode IS NOT NULL AND settlement_amount IS NOT NULL AND settled_by_user_id IS NOT NULL AND settled_at IS NOT NULL)`

- Constraint `claims_settlement_amount_check`: `CHECK (settlement_amount IS NULL OR settlement_amount >= 0::numeric)`

- Constraint `claims_settlement_mode_check`: `CHECK (settlement_mode = ANY (ARRAY['AUTO'::text, 'MANUAL'::text]))`

- Constraint `claims_settlement_status_check`: `CHECK (settlement_status = ANY (ARRAY['unsettled'::text, 'settled'::text]))`

- Constraint `claims_settlement_within_claim`: `CHECK (settlement_amount IS NULL OR settlement_amount <= claimed_amount)`

- Constraint `claims_status_check`: `CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'sent_back'::text, 'approved'::text, 'rejected'::text, 'settled'::text]))`

- Index `claims_budget_idx`: `CREATE INDEX claims_budget_idx ON pay.claims USING btree (budget_id)`

- Index `claims_employee_idx`: `CREATE INDEX claims_employee_idx ON pay.claims USING btree (employee_id, status)`

- Index `claims_one_live_per_budget`: `CREATE UNIQUE INDEX claims_one_live_per_budget ON pay.claims USING btree (budget_id) WHERE ((budget_id IS NOT NULL) AND (status <> 'rejected'::text))`

- Index `claims_pkey`: `CREATE UNIQUE INDEX claims_pkey ON pay.claims USING btree (id)`

- Index `claims_reference_key`: `CREATE UNIQUE INDEX claims_reference_key ON pay.claims USING btree (reference)`

- Trigger `claims_updated_at`: `CREATE TRIGGER claims_updated_at BEFORE UPDATE ON pay.claims FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.employee_salaries

**Status:** SPEC BASELINE. **Cards:** P01, L01, L02, L03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:467`.

```sql

CREATE TABLE pay.employee_salaries ( -- effective-dated assignment (PAY-16 arrears need history)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  structure_id BIGINT NOT NULL REFERENCES pay.salary_structures,
  effective_from DATE NOT NULL,     -- revision effective date (SOW-5.2.1)
  annual_ctc NUMERIC(14,2) NOT NULL,-- must equal sum of annualized components (CORE-08 CTC-vs-breakup check)
  phase TEXT NOT NULL DEFAULT 'confirmed', -- 'probation'|'confirmed' — PAY-02 auto-switch writes a new row at confirmation
  component_amounts JSONB NOT NULL, -- resolved {code: monthly_amount} snapshot — payslips never depend on later template edits
  revision_reason TEXT,             -- 'annual_increment'|'promotion'|'confirmation'|'correction'
  approved_by BIGINT REFERENCES core.users,
  UNIQUE(employee_id, effective_from)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.fnf_settlements

**Status:** SPEC BASELINE. **Cards:** L05.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:586`.

```sql

CREATE TABLE pay.fnf_settlements (  -- PAY-15 / SOW-10
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  separation_id BIGINT NOT NULL,    -- lifecycle record that triggered it
  run_id BIGINT REFERENCES pay.payroll_runs,       -- run_type='fnf'
  last_working_day DATE NOT NULL,
  days_payable NUMERIC(4,1) NOT NULL,              -- SOW-10.1 input
  leave_encash_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  notice_recovery_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  gratuity_amount NUMERIC(14,2) NOT NULL DEFAULT 0, -- formula in 04-MODULE-SPECS §6.7; 0 if service < 4y240d
  other_payments NUMERIC(14,2) NOT NULL DEFAULT 0, other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  held_salary_released NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',            -- 'draft'|'clearances_pending'|'computed'|'approved'|'paid'
  tat_due_date DATE                                 -- 3-working-day TAT tracking (SOW-10.2)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.gl_accounts

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** P04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:573`.

```sql

CREATE TABLE pay.gl_accounts (      -- SAP JV mapping (§02-ARCH §5)
  component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
  cost_center_id BIGINT REFERENCES core.cost_centers, -- NULL = default mapping
  gl_code TEXT NOT NULL, gl_description TEXT
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_code | text | NO | — |

| plant_code | text | NO | — |

| cost_center_code | text | NO | — |

| component_code | text | NO | — |

| gl_code | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `gl_accounts_company_code_plant_code_cost_center_code_compon_key`: `UNIQUE (company_code, plant_code, cost_center_code, component_code)`

- Constraint `gl_accounts_gl_code_check`: `CHECK (length(btrim(gl_code)) > 0)`

- Constraint `gl_accounts_pkey`: `PRIMARY KEY (id)`

- Index `gl_accounts_company_code_plant_code_cost_center_code_compon_key`: `CREATE UNIQUE INDEX gl_accounts_company_code_plant_code_cost_center_code_compon_key ON pay.gl_accounts USING btree (company_code, plant_code, cost_center_code, component_code)`

- Index `gl_accounts_pkey`: `CREATE UNIQUE INDEX gl_accounts_pkey ON pay.gl_accounts USING btree (id)`

- Trigger `gl_accounts_org_codes_guard`: `CREATE TRIGGER gl_accounts_org_codes_guard BEFORE INSERT OR UPDATE OF company_code, plant_code, cost_center_code, component_code ON pay.gl_accounts FOR EACH ROW EXECUTE FUNCTION pay.validate_gl_account_org_codes()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.inputs

**Status:** SPEC BASELINE. **Cards:** P02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:512`.

```sql

CREATE TABLE pay.inputs (           -- ad-hoc monthly variable inputs (SOW-5.1.1): incentives, deductions, adjustments
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  component_code TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL,
  note TEXT NOT NULL, entered_by BIGINT NOT NULL REFERENCES core.users -- who keyed it (input audit; active-status check CORE-06 enforced by validator)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.investment_declarations

**Status:** SPEC BASELINE. **Cards:** P03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:556`.

```sql

CREATE TABLE pay.investment_declarations ( -- PAY-13 ESS declarations (SOW-3.2d)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  fy TEXT NOT NULL,
  section TEXT NOT NULL,            -- '80C'|'80D'|'HRA_RENT'|'24B'|'80CCD1B'|...
  declared_amount NUMERIC(14,2) NOT NULL,
  proof_document_id BIGINT REFERENCES core.documents, -- uploaded at proof window (SOW-10.1: proofs before F&F too)
  verified_amount NUMERIC(14,2),    -- HR-verified figure used in final tax
  verified_by BIGINT REFERENCES core.users, verified_at TIMESTAMPTZ,
  UNIQUE(employee_id, fy, section)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.it_slabs

**Status:** SPEC BASELINE. **Cards:** P03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:548`.

```sql

CREATE TABLE pay.it_slabs (         -- PAY-13: income-tax slabs per regime per FY (model from Frappe HR)
  fy TEXT NOT NULL,                 -- '2026-27'
  regime TEXT NOT NULL,             -- 'old'|'new'
  slab_from NUMERIC(14,2) NOT NULL, slab_to NUMERIC(14,2), rate NUMERIC(6,4) NOT NULL,
  surcharge_rules JSONB, cess_rate NUMERIC(6,4) NOT NULL DEFAULT 0.04,
  standard_deduction NUMERIC(14,2) NOT NULL, rebate_87a JSONB -- threshold+cap; marginal relief handled in engine
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.journal_batches

**Status:** PROPOSED AMENDMENT. **Cards:** P04.

**Proposed grain:** One frozen balanced JV version per accepted result. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.journal_lines

**Status:** PROPOSED AMENDMENT. **Cards:** P04.

**Proposed grain:** One GL/cost-center allocation line in a JV batch. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.loan_installments

**Status:** PROPOSED AMENDMENT. **Cards:** P05.

**Proposed grain:** One authorized scheduled installment/version for a loan. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.loan_postings

**Status:** SPEC BASELINE. **Cards:** P05, L04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:615`.

```sql

CREATE TABLE pay.loan_postings (    -- per-month deduction trail; reconciles outstanding
  loan_id BIGINT NOT NULL REFERENCES pay.loans,
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  principal_part NUMERIC(14,2) NOT NULL, interest_part NUMERIC(14,2) NOT NULL,
  perquisite_value NUMERIC(14,2) NOT NULL DEFAULT 0
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.loans

**Status:** SPEC BASELINE. **Cards:** P05, L04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:601`.

```sql

CREATE TABLE pay.loans (            -- M11 (SOW-5.5, LN-01..03)
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  loan_type TEXT NOT NULL,          -- 'loan_diminishing'|'loan_flat'|'emi_no_interest'|'salary_advance'|'travel_advance'
  principal NUMERIC(14,2) NOT NULL,
  interest_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  emi NUMERIC(14,2) NOT NULL,
  start_month DATE NOT NULL, tenure_months SMALLINT NOT NULL,
  outstanding NUMERIC(14,2) NOT NULL,       -- maintained by payroll deduction postings
  perquisite_applicable BOOLEAN NOT NULL DEFAULT false, -- SBI-rate perquisite valuation (SOW-5.5.3)
  source TEXT NOT NULL DEFAULT 'hrms',      -- 'hrms'|'sap_legacy' (PP-11 import)
  workflow_request_id BIGINT,               -- ESS application approval (LN-02)
  status TEXT NOT NULL DEFAULT 'active'     -- 'active'|'closed'|'written_off'
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.output_artifacts

**Status:** PROPOSED AMENDMENT. **Cards:** P03, P04, P07, M01.

**Proposed grain:** One immutable result/return/document artifact version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.parallel_comparison_lines

**Status:** PROPOSED AMENDMENT. **Cards:** P07.

**Proposed grain:** One employee/component variance with source lineage. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.parallel_comparisons

**Status:** PROPOSED AMENDMENT. **Cards:** P07.

**Proposed grain:** One frozen external register versus HRMS result comparison. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.payment_events

**Status:** PROPOSED AMENDMENT. **Cards:** P04, P05.

**Proposed grain:** One immutable external payment/recovery evidence event. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.payment_obligations

**Status:** PROPOSED AMENDMENT. **Cards:** A04, P02, P04, P05, P06, L05, W01, T02.

**Proposed grain:** One approved source amount owed to/from an employee/payer. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.payroll_item_lines

**Status:** SPEC BASELINE. **Cards:** P02, L05, W04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:505`.

```sql

CREATE TABLE pay.payroll_item_lines ( -- payslip lines: component × amount (audit + variance report needs line level)
  item_id BIGINT NOT NULL REFERENCES pay.payroll_items,
  component_code TEXT NOT NULL REFERENCES pay.salary_components(code),
  amount NUMERIC(14,2) NOT NULL,
  calc_note TEXT                    -- human-readable formula trace, e.g. 'BASIC 40000 × 28.5/30' — explainability (design principle: no black boxes)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.payroll_items

**Status:** SPEC BASELINE. **Cards:** P02, L05, W04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:491`.

```sql

CREATE TABLE pay.payroll_items (    -- one row per employee per run: the payslip header
  run_id BIGINT NOT NULL REFERENCES pay.payroll_runs,
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  days_in_month NUMERIC(4,1) NOT NULL,   -- proration base per policy (SOW-5.4: calendar/fixed)
  payable_days NUMERIC(4,1) NOT NULL,    -- from locked attendance: P+HD/2+WO(paid)+H+L(paid)+OD+CO
  lop_days NUMERIC(4,1) NOT NULL DEFAULT 0,       -- LWP + UAB + unpaid week-offs (ATT-09)
  lop_reversal_days NUMERIC(4,1) NOT NULL DEFAULT 0, -- previous-month LOP corrections (SOW-5.4e)
  ot_minutes INTEGER NOT NULL DEFAULT 0,  -- approved OT paid this run (from att.overtime_entries)
  gross NUMERIC(14,2) NOT NULL, total_deductions NUMERIC(14,2) NOT NULL, net_pay NUMERIC(14,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'payable', -- 'payable'|'hold_payment'|'hold_process' (PAY-08 / SOW-5.7)
  payslip_document_id BIGINT REFERENCES core.documents, -- rendered PDF (PAY-06)
  UNIQUE(run_id, employee_id)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.payroll_runs

**Status:** SPEC BASELINE. **Cards:** P02, P07, L05.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:479`.

```sql

CREATE TABLE pay.payroll_runs (     -- PAY-03 pipeline state machine
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL,              -- first of month
  run_type TEXT NOT NULL DEFAULT 'regular', -- 'regular'|'off_cycle'|'fnf'|'bonus'|'arrears'
  status TEXT NOT NULL DEFAULT 'draft',     -- 'draft'→'inputs_locked'→'computed'→'under_review'→'approved'→'finalized' (immutable)|'reopened'(audited)
  attendance_lock_id BIGINT REFERENCES att.month_locks, -- hard precondition (ATT-12/15): no run without locked attendance
  computed_at TIMESTAMPTZ, finalized_at TIMESTAMPTZ,
  finalized_by BIGINT REFERENCES core.users,
  notes TEXT,
  UNIQUE(company_id, month, run_type)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.previous_employer_income

**Status:** PROPOSED AMENDMENT. **Cards:** P03.

**Proposed grain:** One verified prior-employer/FY declaration version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.pt_slabs

**Status:** SPEC BASELINE. **Cards:** P03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:543`.

```sql

CREATE TABLE pay.pt_slabs (         -- PAY-11: per state, effective-dated
  state_code TEXT NOT NULL, min_monthly NUMERIC(14,2) NOT NULL, max_monthly NUMERIC(14,2),
  amount NUMERIC(8,2) NOT NULL, effective_from DATE NOT NULL
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.run_input_refs

**Status:** PROPOSED AMENDMENT. **Cards:** P02.

**Proposed grain:** One frozen input provenance entry per payroll result version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.salary_components

**Status:** SPEC BASELINE. **Cards:** P01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:447`.

```sql

CREATE TABLE pay.salary_components ( -- PAY-01; model ported from Frappe HR's Salary Component
  code TEXT UNIQUE NOT NULL,        -- 'BASIC','HRA','MEDICAL_ALLOW','SPECIAL_ALLOW','EDUCATION_ALLOW','BONUS','PF_EE','PF_ER','ESI_EE','PT','TDS','LWF','OT','LOP','GUEST_HOUSE',...
  name TEXT NOT NULL,               -- payslip line label (must match RML payslip template — PAY-06)
  kind TEXT NOT NULL,               -- 'earning'|'deduction'|'employer_contribution' (employer side prints on CTC sheet, not payslip net)
  formula TEXT,                     -- expression over other components/vars, e.g. 'BASIC * 0.4'; NULL = fixed amount per employee
  rounding TEXT NOT NULL DEFAULT 'round', -- 'round'|'floor' — statutory components have mandated rounding
  taxable BOOLEAN NOT NULL DEFAULT true,  -- feeds TDS projection
  part_of_gross BOOLEAN NOT NULL DEFAULT true,   -- ESIC gross determination (PAY-10)
  part_of_pf_wages BOOLEAN NOT NULL DEFAULT false, -- PF wage base flag (usually BASIC [+DA])
  prorate_on_lop BOOLEAN NOT NULL DEFAULT true,    -- most earnings prorate; some (e.g., statutory bonus) don't
  display_order SMALLINT NOT NULL   -- payslip line order — fixed template (PP-3)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.salary_holds

**Status:** SPEC BASELINE. **Cards:** P02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:519`.

```sql

CREATE TABLE pay.salary_holds (     -- PAY-08 exactly per SOW-5.7 scenarios
  employee_id BIGINT NOT NULL REFERENCES core.employees,
  hold_type TEXT NOT NULL,          -- 'payment' (process fully, drop from bank file) | 'process' (full LOP until release)
  reason TEXT NOT NULL, start_month DATE NOT NULL, released_month DATE,
  created_by BIGINT NOT NULL REFERENCES core.users
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.salary_structure_versions

**Status:** PROPOSED AMENDMENT. **Cards:** P01.

**Proposed grain:** One immutable published salary-template version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.salary_structures

**Status:** SPEC BASELINE. **Cards:** P01.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:460`.

```sql

CREATE TABLE pay.salary_structures ( -- template per grade/category/location (PAY-01, SOW-2.2a)
  name TEXT UNIQUE NOT NULL,        -- 'White Collar E1 — Kharagpur'
  company_id BIGINT NOT NULL REFERENCES core.companies,
  components JSONB NOT NULL,        -- ordered [{component_code, formula_override|amount_rule}] — template rows
  is_active BOOLEAN NOT NULL DEFAULT true
);

```


## pay.source_consumptions

**Status:** PROPOSED AMENDMENT. **Cards:** P02, P05, P06, W04, T02.

**Proposed grain:** One immutable source obligation consumed by an accepted output/result. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.statutory_memberships

**Status:** PROPOSED AMENDMENT. **Cards:** P03.

**Proposed grain:** One effective employee/entity/scheme eligibility interval. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.statutory_postings

**Status:** PROPOSED AMENDMENT. **Cards:** P03, P07.

**Proposed grain:** One immutable result-linked liability/YTD movement. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.statutory_rates

**Status:** SPEC BASELINE. **Cards:** P03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:535`.

```sql

CREATE TABLE pay.statutory_rates (
  scheme TEXT NOT NULL,             -- 'pf'|'eps'|'edli'|'pf_admin'|'esic_ee'|'esic_er'|'lwf_wb_ee'|'lwf_wb_er'|'gratuity'|'bonus'
  param TEXT NOT NULL,              -- 'rate'|'wage_ceiling'|'eligibility_ceiling'|...
  value NUMERIC(14,4) NOT NULL,     -- e.g. pf rate 0.12, eps ceiling 15000, esic eligibility 21000
  effective_from DATE NOT NULL,     -- historical correctness for arrears/reruns
  source_note TEXT NOT NULL         -- the notification/circular this value came from (audit answerability)
);

```

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## pay.tax_elections

**Status:** PROPOSED AMENDMENT. **Cards:** P03.

**Proposed grain:** One authorized employee/FY election version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## pay.tds_challans

**Status:** SPEC BASELINE. **Cards:** P03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:567`.

```sql

CREATE TABLE pay.tds_challans (     -- PAY-13 reconciliation (SOW-5.9.3)
  company_id BIGINT NOT NULL REFERENCES core.companies,
  month DATE NOT NULL, amount NUMERIC(14,2) NOT NULL,
  challan_no TEXT NOT NULL, bsr_code TEXT, paid_on DATE NOT NULL
);

```


## prv.breach_register

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| discovered_at | timestamp with time zone | NO | now() |

| summary | text | NO | — |

| notified_board_at | timestamp with time zone | YES | — |

| notified_principals_at | timestamp with time zone | YES | — |

| recorded_by | bigint | NO | — |

**Observed integrity and access hooks:**

- Constraint `breach_register_pkey`: `PRIMARY KEY (id)`

- Constraint `breach_register_recorded_by_fkey`: `FOREIGN KEY (recorded_by) REFERENCES core.users(id)`

- Index `breach_register_pkey`: `CREATE UNIQUE INDEX breach_register_pkey ON prv.breach_register USING btree (id)`

- Trigger `breach_register_immutable`: `CREATE TRIGGER breach_register_immutable BEFORE DELETE OR UPDATE ON prv.breach_register FOR EACH ROW EXECUTE FUNCTION prv.breach_register_immutable()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.consent_events

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| purpose | text | NO | — |

| action | text | NO | — |

| actor_user_id | bigint | NO | — |

| occurred_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `consent_events_action_check`: `CHECK (action = ANY (ARRAY['grant'::text, 'withdraw'::text]))`

- Constraint `consent_events_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

- Constraint `consent_events_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `consent_events_pkey`: `PRIMARY KEY (id)`

- Index `consent_events_pkey`: `CREATE UNIQUE INDEX consent_events_pkey ON prv.consent_events USING btree (id)`

- Trigger `consent_events_immutable`: `CREATE TRIGGER consent_events_immutable BEFORE DELETE OR UPDATE ON prv.consent_events FOR EACH ROW EXECUTE FUNCTION prv.consent_events_immutable()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.consents

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| purpose | text | NO | — |

| granted | boolean | NO | — |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `consents_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `consents_employee_id_purpose_key`: `UNIQUE (employee_id, purpose)`

- Constraint `consents_pkey`: `PRIMARY KEY (id)`

- Constraint `consents_purpose_check`: `CHECK (purpose = ANY (ARRAY['photograph'::text, 'wellness'::text, 'bgv'::text, 'family'::text, 'alumni'::text]))`

- Index `consents_employee_id_purpose_key`: `CREATE UNIQUE INDEX consents_employee_id_purpose_key ON prv.consents USING btree (employee_id, purpose)`

- Index `consents_pkey`: `CREATE UNIQUE INDEX consents_pkey ON prv.consents USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.legal_holds

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| data_class | text | YES | — |

| reason | text | NO | — |

| placed_by | bigint | NO | — |

| released_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `legal_holds_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `legal_holds_pkey`: `PRIMARY KEY (id)`

- Constraint `legal_holds_placed_by_fkey`: `FOREIGN KEY (placed_by) REFERENCES core.users(id)`

- Index `legal_holds_pkey`: `CREATE UNIQUE INDEX legal_holds_pkey ON prv.legal_holds USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.notice_acks

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| notice_id | bigint | NO | — |

| user_id | bigint | NO | — |

| acknowledged_at | timestamp with time zone | NO | now() |

| ip | text | YES | — |

**Observed integrity and access hooks:**

- Constraint `notice_acks_notice_id_fkey`: `FOREIGN KEY (notice_id) REFERENCES prv.notices(id)`

- Constraint `notice_acks_notice_id_user_id_key`: `UNIQUE (notice_id, user_id)`

- Constraint `notice_acks_pkey`: `PRIMARY KEY (id)`

- Constraint `notice_acks_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

- Index `notice_acks_notice_id_user_id_key`: `CREATE UNIQUE INDEX notice_acks_notice_id_user_id_key ON prv.notice_acks USING btree (notice_id, user_id)`

- Index `notice_acks_pkey`: `CREATE UNIQUE INDEX notice_acks_pkey ON prv.notice_acks USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.notices

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| version | integer | NO | — |

| principal_class | text | NO | — |

| title | text | NO | — |

| body | text | NO | — |

| effective_from | timestamp with time zone | NO | now() |

| is_current | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `notices_pkey`: `PRIMARY KEY (id)`

- Constraint `notices_principal_class_check`: `CHECK (principal_class = ANY (ARRAY['employee'::text, 'candidate'::text, 'contractor_worker'::text, 'dependant'::text]))`

- Constraint `notices_principal_class_version_key`: `UNIQUE (principal_class, version)`

- Index `notices_pkey`: `CREATE UNIQUE INDEX notices_pkey ON prv.notices USING btree (id)`

- Index `notices_principal_class_version_key`: `CREATE UNIQUE INDEX notices_principal_class_version_key ON prv.notices USING btree (principal_class, version)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.processing_register

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| data_class | text | NO | — |

| purpose | text | NO | — |

| lawful_basis | text | NO | — |

| retention_days | integer | NO | — |

| recipients | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `processing_register_data_class_key`: `UNIQUE (data_class)`

- Constraint `processing_register_lawful_basis_check`: `CHECK (lawful_basis = ANY (ARRAY['employment'::text, 'consent'::text, 'legal_obligation'::text]))`

- Constraint `processing_register_pkey`: `PRIMARY KEY (id)`

- Constraint `processing_register_retention_days_check`: `CHECK (retention_days > 0)`

- Index `processing_register_data_class_key`: `CREATE UNIQUE INDEX processing_register_data_class_key ON prv.processing_register USING btree (data_class)`

- Index `processing_register_pkey`: `CREATE UNIQUE INDEX processing_register_pkey ON prv.processing_register USING btree (id)`

- Trigger `processing_register_updated_at`: `CREATE TRIGGER processing_register_updated_at BEFORE UPDATE ON prv.processing_register FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.processors

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| name | text | NO | — |

| purpose | text | NO | — |

| dpa_status | text | NO | — |

| dpa_expires_on | date | YES | — |

| owner_email | text | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `processors_dpa_status_check`: `CHECK (dpa_status = ANY (ARRAY['active'::text, 'expired'::text, 'missing'::text]))`

- Constraint `processors_pkey`: `PRIMARY KEY (id)`

- Index `processors_pkey`: `CREATE UNIQUE INDEX processors_pkey ON prv.processors USING btree (id)`

- Trigger `processors_updated_at`: `CREATE TRIGGER processors_updated_at BEFORE UPDATE ON prv.processors FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.purge_log

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| proposal_id | bigint | NO | — |

| data_class | text | NO | — |

| row_count | integer | NO | — |

| rule | text | NO | — |

| executed_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `purge_log_pkey`: `PRIMARY KEY (id)`

- Constraint `purge_log_proposal_id_fkey`: `FOREIGN KEY (proposal_id) REFERENCES prv.purge_proposals(id)`

- Index `purge_log_pkey`: `CREATE UNIQUE INDEX purge_log_pkey ON prv.purge_log USING btree (id)`

- Trigger `purge_log_immutable`: `CREATE TRIGGER purge_log_immutable BEFORE DELETE OR UPDATE ON prv.purge_log FOR EACH ROW EXECUTE FUNCTION prv.purge_log_immutable()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.purge_proposals

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| data_class | text | NO | — |

| row_count | integer | NO | — |

| excluded_holds | integer | NO | 0 |

| proposed_by | bigint | NO | — |

| proposed_at | timestamp with time zone | NO | now() |

| confirmed_by | bigint | YES | — |

| confirmed_at | timestamp with time zone | YES | — |

**Observed integrity and access hooks:**

- Constraint `purge_proposals_check`: `CHECK (confirmed_by IS NULL OR confirmed_by <> proposed_by)`

- Constraint `purge_proposals_confirmed_by_fkey`: `FOREIGN KEY (confirmed_by) REFERENCES core.users(id)`

- Constraint `purge_proposals_pkey`: `PRIMARY KEY (id)`

- Constraint `purge_proposals_proposed_by_fkey`: `FOREIGN KEY (proposed_by) REFERENCES core.users(id)`

- Constraint `purge_proposals_row_count_check`: `CHECK (row_count >= 0)`

- Index `purge_proposals_pkey`: `CREATE UNIQUE INDEX purge_proposals_pkey ON prv.purge_proposals USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.retention_rules

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| data_class | text | NO | — |

| retention_days | integer | NO | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `retention_rules_data_class_fkey`: `FOREIGN KEY (data_class) REFERENCES prv.processing_register(data_class)`

- Constraint `retention_rules_data_class_key`: `UNIQUE (data_class)`

- Constraint `retention_rules_pkey`: `PRIMARY KEY (id)`

- Constraint `retention_rules_retention_days_check`: `CHECK (retention_days > 0)`

- Index `retention_rules_data_class_key`: `CREATE UNIQUE INDEX retention_rules_data_class_key ON prv.retention_rules USING btree (data_class)`

- Index `retention_rules_pkey`: `CREATE UNIQUE INDEX retention_rules_pkey ON prv.retention_rules USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## prv.rights_requests

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| employee_id | bigint | NO | — |

| kind | text | NO | — |

| status | text | NO | 'open'::text |

| reason | text | YES | — |

| refusal_reason | text | YES | — |

| workflow_request_id | bigint | YES | — |

| due_at | timestamp with time zone | NO | — |

| closed_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `rights_requests_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `rights_requests_kind_check`: `CHECK (kind = ANY (ARRAY['access'::text, 'correction'::text, 'erasure'::text]))`

- Constraint `rights_requests_pkey`: `PRIMARY KEY (id)`

- Constraint `rights_requests_status_check`: `CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'fulfilled'::text, 'refused'::text]))`

- Constraint `rights_requests_workflow_request_id_fkey`: `FOREIGN KEY (workflow_request_id) REFERENCES wf.requests(id)`

- Index `rights_requests_pkey`: `CREATE UNIQUE INDEX rights_requests_pkey ON prv.rights_requests USING btree (id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## recruit.candidates

**Status:** BLOCKED SOURCE/SCOPE RECONCILIATION. **Cards:** R01.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## recruit.offers

**Status:** BLOCKED SOURCE/SCOPE RECONCILIATION. **Cards:** R01.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## recruit.vacancies

**Status:** BLOCKED SOURCE/SCOPE RECONCILIATION. **Cards:** R01.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## reporting.kpi_daily

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** W04.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| snapshot_date | date | NO | — |

| company_id | bigint | YES | — |

| category | text | NO | 'total'::text |

| metric | text | NO | — |

| value | numeric(18,4) | YES | — |

| unavailable_reason | text | YES | — |

| computed_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `kpi_daily_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `kpi_daily_pkey`: `PRIMARY KEY (id)`

- Constraint `kpi_daily_snapshot_date_company_id_category_metric_key`: `UNIQUE (snapshot_date, company_id, category, metric)`

- Index `kpi_daily_lookup_idx`: `CREATE INDEX kpi_daily_lookup_idx ON reporting.kpi_daily USING btree (snapshot_date DESC, company_id, metric)`

- Index `kpi_daily_pkey`: `CREATE UNIQUE INDEX kpi_daily_pkey ON reporting.kpi_daily USING btree (id)`

- Index `kpi_daily_snapshot_date_company_id_category_metric_key`: `CREATE UNIQUE INDEX kpi_daily_snapshot_date_company_id_category_metric_key ON reporting.kpi_daily USING btree (snapshot_date, company_id, category, metric)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## reporting.muster_month

**Status:** OBSERVED LOCAL TABLE + Kysely typed. **Cards:** A05, W04.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| company_id | bigint | NO | — |

| month | date | NO | — |

| employee_id | bigint | NO | — |

| ecode | text | NO | — |

| employee_name | text | NO | — |

| reporting_manager | text | YES | — |

| functional_manager | text | YES | — |

| department | text | YES | — |

| designation | text | YES | — |

| org_unit | text | YES | — |

| cost_center | text | YES | — |

| contact | text | YES | — |

| category | text | YES | — |

| day_statuses | jsonb | NO | '{}'::jsonb |

| present | smallint | NO | 0 |

| absent | smallint | NO | 0 |

| half_days | smallint | NO | 0 |

| weekoffs | smallint | NO | 0 |

| weekoffs_unpaid | smallint | NO | 0 |

| holidays | smallint | NO | 0 |

| leave_days | numeric(5,1) | NO | 0 |

| od_days | smallint | NO | 0 |

| co_days | smallint | NO | 0 |

| uab_days | smallint | NO | 0 |

| lop_days | numeric(5,1) | NO | 0 |

| ot_hours | numeric(8,2) | NO | 0 |

| built_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `muster_month_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES core.companies(id)`

- Constraint `muster_month_company_id_month_employee_id_key`: `UNIQUE (company_id, month, employee_id)`

- Constraint `muster_month_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES core.employees(id)`

- Constraint `muster_month_pkey`: `PRIMARY KEY (id)`

- Index `muster_month_company_id_month_employee_id_key`: `CREATE UNIQUE INDEX muster_month_company_id_month_employee_id_key ON reporting.muster_month USING btree (company_id, month, employee_id)`

- Index `muster_month_lookup_idx`: `CREATE INDEX muster_month_lookup_idx ON reporting.muster_month USING btree (company_id, month)`

- Index `muster_month_pkey`: `CREATE UNIQUE INDEX muster_month_pkey ON reporting.muster_month USING btree (id)`

- Index `muster_month_rm_idx`: `CREATE INDEX muster_month_rm_idx ON reporting.muster_month USING btree (month, reporting_manager)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## reporting.snapshot_builds

**Status:** PROPOSED AMENDMENT. **Cards:** A05, W04.

**Proposed grain:** One versioned reporting build with source population/freshness. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## sec.access_events

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| occurred_at | timestamp with time zone | NO | now() |

| actor_user_id | bigint | NO | — |

| session_sid | uuid | YES | — |

| subject_employee_id | bigint | YES | — |

| resource | text | NO | — |

| field_class | text | NO | — |

| purpose | text | NO | — |

| record_count | integer | NO | 1 |

| ip | inet | YES | — |

**Observed integrity and access hooks:**

- Constraint `access_events_actor_user_id_fkey`: `FOREIGN KEY (actor_user_id) REFERENCES core.users(id)`

- Constraint `access_events_count_positive`: `CHECK (record_count > 0)`

- Constraint `access_events_pkey`: `PRIMARY KEY (id, occurred_at)`

- Constraint `access_events_purpose_stated`: `CHECK (length(btrim(purpose)) >= 3)`

- Index `access_events_actor_idx`: `CREATE INDEX access_events_actor_idx ON ONLY sec.access_events USING btree (actor_user_id, occurred_at DESC)`

- Index `access_events_pkey`: `CREATE UNIQUE INDEX access_events_pkey ON ONLY sec.access_events USING btree (id, occurred_at)`

- Index `access_events_subject_idx`: `CREATE INDEX access_events_subject_idx ON ONLY sec.access_events USING btree (subject_employee_id, occurred_at DESC)`

- Trigger `access_events_immutable`: `CREATE TRIGGER access_events_immutable BEFORE DELETE OR UPDATE ON sec.access_events FOR EACH ROW EXECUTE FUNCTION sec.access_events_immutable()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## sec.mfa_enrolments

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| user_id | bigint | NO | — |

| secret | text | NO | — |

| confirmed_at | timestamp with time zone | YES | — |

| disabled_at | timestamp with time zone | YES | — |

| disabled_by_user_id | bigint | YES | — |

| last_used_step | bigint | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `mfa_enrolments_disabled_by_user_id_fkey`: `FOREIGN KEY (disabled_by_user_id) REFERENCES core.users(id)`

- Constraint `mfa_enrolments_pkey`: `PRIMARY KEY (id)`

- Constraint `mfa_enrolments_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

- Index `mfa_enrolments_pkey`: `CREATE UNIQUE INDEX mfa_enrolments_pkey ON sec.mfa_enrolments USING btree (id)`

- Index `mfa_one_active_per_user`: `CREATE UNIQUE INDEX mfa_one_active_per_user ON sec.mfa_enrolments USING btree (user_id) WHERE (disabled_at IS NULL)`

- Trigger `mfa_enrolments_updated_at`: `CREATE TRIGGER mfa_enrolments_updated_at BEFORE UPDATE ON sec.mfa_enrolments FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## sec.mfa_recovery_codes

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| enrolment_id | bigint | NO | — |

| code_hash | text | NO | — |

| used_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `mfa_recovery_codes_enrolment_id_fkey`: `FOREIGN KEY (enrolment_id) REFERENCES sec.mfa_enrolments(id) ON DELETE CASCADE`

- Constraint `mfa_recovery_codes_pkey`: `PRIMARY KEY (id)`

- Index `mfa_recovery_codes_pkey`: `CREATE UNIQUE INDEX mfa_recovery_codes_pkey ON sec.mfa_recovery_codes USING btree (id)`

- Index `mfa_recovery_enrolment_idx`: `CREATE INDEX mfa_recovery_enrolment_idx ON sec.mfa_recovery_codes USING btree (enrolment_id)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## sec.password_history

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F01 inventory/classification.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| user_id | bigint | NO | — |

| password_hash | text | NO | — |

| changed_at | timestamp with time zone | NO | now() |

| changed_by_user_id | bigint | YES | — |

**Observed integrity and access hooks:**

- Constraint `password_history_changed_by_user_id_fkey`: `FOREIGN KEY (changed_by_user_id) REFERENCES core.users(id)`

- Constraint `password_history_pkey`: `PRIMARY KEY (id)`

- Constraint `password_history_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

- Index `password_history_pkey`: `CREATE UNIQUE INDEX password_history_pkey ON sec.password_history USING btree (id)`

- Index `password_history_user_idx`: `CREATE INDEX password_history_user_idx ON sec.password_history USING btree (user_id, changed_at DESC)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## sec.sessions

**Status:** OBSERVED LOCAL TABLE + NOT in Kysely Database types. **Cards:** F03.

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| sid | uuid | NO | gen_random_uuid() |

| user_id | bigint | NO | — |

| created_at | timestamp with time zone | NO | now() |

| last_seen_at | timestamp with time zone | NO | now() |

| expires_at | timestamp with time zone | NO | — |

| revoked_at | timestamp with time zone | YES | — |

| revoked_by_user_id | bigint | YES | — |

| revoke_reason | text | YES | — |

| ip | inet | YES | — |

| user_agent | text | YES | — |

| device_label | text | YES | — |

| stepped_up_at | timestamp with time zone | YES | — |

| stepped_up_until | timestamp with time zone | YES | — |

**Observed integrity and access hooks:**

- Constraint `sessions_expiry_after_start`: `CHECK (expires_at > created_at)`

- Constraint `sessions_pkey`: `PRIMARY KEY (id)`

- Constraint `sessions_revoke_pairs`: `CHECK (revoked_at IS NULL AND revoke_reason IS NULL OR revoked_at IS NOT NULL AND revoke_reason IS NOT NULL)`

- Constraint `sessions_revoked_by_user_id_fkey`: `FOREIGN KEY (revoked_by_user_id) REFERENCES core.users(id)`

- Constraint `sessions_sid_key`: `UNIQUE (sid)`

- Constraint `sessions_stepup_pairs`: `CHECK (stepped_up_at IS NULL AND stepped_up_until IS NULL OR stepped_up_at IS NOT NULL AND stepped_up_until IS NOT NULL AND stepped_up_until > stepped_up_at)`

- Constraint `sessions_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES core.users(id)`

- Index `sessions_pkey`: `CREATE UNIQUE INDEX sessions_pkey ON sec.sessions USING btree (id)`

- Index `sessions_sid_key`: `CREATE UNIQUE INDEX sessions_sid_key ON sec.sessions USING btree (sid)`

- Index `sessions_sid_live_idx`: `CREATE INDEX sessions_sid_live_idx ON sec.sessions USING btree (sid) WHERE (revoked_at IS NULL)`

- Index `sessions_user_idx`: `CREATE INDEX sessions_user_idx ON sec.sessions USING btree (user_id, last_seen_at DESC)`

**Ownership/source:** retain actual definitions; recover missing migration and governing spec under F01/D12 before adopting or changing. No guessed replacement DDL.


## te.advances

**Status:** PROPOSED AMENDMENT. **Cards:** L04, T02.

**Proposed grain:** One approved accountable advance, authorization distinct from funding. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.booking_events

**Status:** PROPOSED AMENDMENT. **Cards:** T03.

**Proposed grain:** One immutable provider acknowledgment/status/cost event. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.booking_operations

**Status:** PROPOSED AMENDMENT. **Cards:** T03.

**Proposed grain:** One durable booking/cancel/refund provider intent. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.currency_rates

**Status:** PROPOSED AMENDMENT. **Cards:** T01.

**Proposed grain:** One captured currency-to-INR source quote. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.employee_travel_levels

**Status:** PROPOSED AMENDMENT. **Cards:** T01.

**Proposed grain:** One effective employee travel-tier assignment. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.itinerary_segments

**Status:** PROPOSED AMENDMENT. **Cards:** T01, T03.

**Proposed grain:** One ordered trip/segment with stay/travel evidence. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.policy_versions

**Status:** PROPOSED AMENDMENT. **Cards:** T01.

**Proposed grain:** One reviewed effective travel-policy publication. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.settlement_advances

**Status:** PROPOSED AMENDMENT. **Cards:** T02.

**Proposed grain:** One settlement allocation against a funded advance. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.settlements

**Status:** PROPOSED AMENDMENT. **Cards:** T02, T03, T04.

**Proposed grain:** One approved claim revision settlement result. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.travel_levels

**Status:** PROPOSED AMENDMENT. **Cards:** T01.

**Proposed grain:** One source-approved domestic/international entitlement tier. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.trips

**Status:** PROPOSED AMENDMENT. **Cards:** T01, T04.

**Proposed grain:** One employee/payer travel intent revision. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## te.wallet_postings

**Status:** PROPOSED AMENDMENT. **Cards:** L04, T02, T04.

**Proposed grain:** One immutable accountable-funds movement. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## wf.definition_versions

**Status:** PROPOSED AMENDMENT. **Cards:** A03.

**Proposed grain:** One immutable published approval-chain version. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## wf.definitions

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:727`.

```sql

CREATE TABLE wf.definitions (       -- WF-01 configurable chains; LOI flowchart is the canonical example
  code TEXT UNIQUE NOT NULL,        -- 'leave'|'ar'|'od'|'ot'|'resignation'|'confirmation'|'transfer'|'loan'|'travel_advance'|'offer_loi'
  name TEXT NOT NULL,
  steps JSONB NOT NULL              -- ordered [{step:1, approver:'reporting_manager'|'functional_manager'|role_code|user_id,
                                    --           sla_hours:48, on_breach:'escalate'|'auto_reject'|'lapse', escalate_to:...}]
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| code | text | NO | — |

| name | text | NO | — |

| steps | jsonb | NO | — |

| is_active | boolean | NO | true |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `definitions_pkey`: `PRIMARY KEY (code)`

- Index `definitions_pkey`: `CREATE UNIQUE INDEX definitions_pkey ON wf.definitions USING btree (code)`

- Trigger `wf_definitions_updated_at`: `CREATE TRIGGER wf_definitions_updated_at BEFORE UPDATE ON wf.definitions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## wf.delegations

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:756`.

```sql

CREATE TABLE wf.delegations (       -- out-of-office approval delegation
  from_user_id BIGINT NOT NULL REFERENCES core.users,
  to_user_id BIGINT NOT NULL REFERENCES core.users,
  from_date DATE NOT NULL, to_date DATE NOT NULL
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| from_user_id | bigint | NO | — |

| to_user_id | bigint | NO | — |

| from_date | date | NO | — |

| to_date | date | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `delegations_check`: `CHECK (from_date <= to_date)`

- Constraint `delegations_check1`: `CHECK (from_user_id <> to_user_id)`

- Constraint `delegations_from_user_id_fkey`: `FOREIGN KEY (from_user_id) REFERENCES core.users(id)`

- Constraint `delegations_pkey`: `PRIMARY KEY (id)`

- Constraint `delegations_to_user_id_fkey`: `FOREIGN KEY (to_user_id) REFERENCES core.users(id)`

- Index `delegations_pkey`: `CREATE UNIQUE INDEX delegations_pkey ON wf.delegations USING btree (id)`

- Trigger `wf_delegations_updated_at`: `CREATE TRIGGER wf_delegations_updated_at BEFORE UPDATE ON wf.delegations FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## wf.event_subscriptions

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F04.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:772`.

```sql

CREATE TABLE wf.event_subscriptions ( -- per-event recipient matrix (PP-26: onboarding/exit → HR + BH + CEO Cell)
  event_code TEXT NOT NULL,         -- 'employee.joined'|'employee.exited'|'daily.boarding_report'|'attendance.uab'|...
  recipient_kind TEXT NOT NULL,     -- 'role'|'user'|'email'
  recipient_ref TEXT NOT NULL
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| event_code | text | NO | — |

| recipient_kind | text | NO | — |

| recipient_ref | text | NO | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `event_subscriptions_event_code_recipient_kind_recipient_ref_key`: `UNIQUE (event_code, recipient_kind, recipient_ref)`

- Constraint `event_subscriptions_pkey`: `PRIMARY KEY (id)`

- Constraint `event_subscriptions_recipient_kind_check`: `CHECK (recipient_kind = ANY (ARRAY['role'::text, 'user'::text, 'email'::text]))`

- Index `event_subscriptions_event_code_recipient_kind_recipient_ref_key`: `CREATE UNIQUE INDEX event_subscriptions_event_code_recipient_kind_recipient_ref_key ON wf.event_subscriptions USING btree (event_code, recipient_kind, recipient_ref)`

- Index `event_subscriptions_pkey`: `CREATE UNIQUE INDEX event_subscriptions_pkey ON wf.event_subscriptions USING btree (id)`

- Trigger `event_subscriptions_updated_at`: `CREATE TRIGGER event_subscriptions_updated_at BEFORE UPDATE ON wf.event_subscriptions FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`


## wf.notification_attempts

**Status:** PROPOSED AMENDMENT. **Cards:** F04.

**Proposed grain:** One immutable transport attempt/receipt. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## wf.notifications

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** F04, A03, W02.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:762`.

```sql

CREATE TABLE wf.notifications (     -- WF-02 queue (in-app + email)
  recipient_user_id BIGINT REFERENCES core.users,
  recipient_email TEXT,             -- external recipients (candidate pre-join links)
  channel TEXT NOT NULL,            -- 'in_app'|'email'
  template_code TEXT NOT NULL, payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued'|'sent'|'failed'|'dead'
  attempts SMALLINT NOT NULL DEFAULT 0, last_error TEXT, sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ               -- in-app read receipt
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| recipient_user_id | bigint | YES | — |

| recipient_email | text | YES | — |

| channel | text | NO | — |

| template_code | text | NO | — |

| payload | jsonb | NO | — |

| status | text | NO | 'queued'::text |

| attempts | smallint | NO | 0 |

| last_error | text | YES | — |

| sent_at | timestamp with time zone | YES | — |

| read_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `notifications_channel_check`: `CHECK (channel = ANY (ARRAY['in_app'::text, 'email'::text]))`

- Constraint `notifications_check`: `CHECK (recipient_user_id IS NOT NULL OR recipient_email IS NOT NULL)`

- Constraint `notifications_pkey`: `PRIMARY KEY (id)`

- Constraint `notifications_recipient_user_id_fkey`: `FOREIGN KEY (recipient_user_id) REFERENCES core.users(id)`

- Constraint `notifications_status_check`: `CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'dead'::text]))`

- Index `notifications_inbox_idx`: `CREATE INDEX notifications_inbox_idx ON wf.notifications USING btree (recipient_user_id, read_at) WHERE (channel = 'in_app'::text)`

- Index `notifications_pkey`: `CREATE UNIQUE INDEX notifications_pkey ON wf.notifications USING btree (id)`

- Index `notifications_queue_idx`: `CREATE INDEX notifications_queue_idx ON wf.notifications USING btree (status, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]))`

- Trigger `notifications_updated_at`: `CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON wf.notifications FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## wf.request_revisions

**Status:** PROPOSED AMENDMENT. **Cards:** A03.

**Proposed grain:** One validated domain/request revision. See exact proposed fields/integrity/transaction in [pack15](15-BACKEND-SCHEMA-CHANGES.md).


## wf.request_steps

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:744`.

```sql

CREATE TABLE wf.request_steps (     -- WF-04 visible timeline with timestamps (ATS offer-tracker pattern)
  request_id BIGINT NOT NULL REFERENCES wf.requests,
  step_no SMALLINT NOT NULL,
  approver_user_id BIGINT NOT NULL REFERENCES core.users, -- resolved person (incl. delegate)
  delegated_from BIGINT REFERENCES core.users,             -- delegation trail (WF-01)
  action TEXT,                       -- NULL while pending; 'approved'|'rejected'|'escalated'
  comment TEXT,
  notified_at TIMESTAMPTZ NOT NULL,  -- proof each approver was notified (the PP-14 failure)
  acted_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ NOT NULL
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| request_id | bigint | NO | — |

| step_no | smallint | NO | — |

| approver_user_id | bigint | NO | — |

| delegated_from | bigint | YES | — |

| action | text | YES | — |

| comment | text | YES | — |

| notified_at | timestamp with time zone | NO | — |

| acted_at | timestamp with time zone | YES | — |

| sla_due_at | timestamp with time zone | NO | — |

| created_at | timestamp with time zone | NO | now() |

| approver_spec | text | YES | — |

**Observed integrity and access hooks:**

- Constraint `request_steps_action_check`: `CHECK (action = ANY (ARRAY['approved'::text, 'rejected'::text, 'sent_back'::text, 'escalated'::text, 'skipped'::text]))`

- Constraint `request_steps_approver_user_id_fkey`: `FOREIGN KEY (approver_user_id) REFERENCES core.users(id)`

- Constraint `request_steps_delegated_from_fkey`: `FOREIGN KEY (delegated_from) REFERENCES core.users(id)`

- Constraint `request_steps_pkey`: `PRIMARY KEY (id)`

- Constraint `request_steps_request_id_fkey`: `FOREIGN KEY (request_id) REFERENCES wf.requests(id)`

- Index `request_steps_pkey`: `CREATE UNIQUE INDEX request_steps_pkey ON wf.request_steps USING btree (id)`

- Index `wf_one_open_step_per_request`: `CREATE UNIQUE INDEX wf_one_open_step_per_request ON wf.request_steps USING btree (request_id) WHERE (action IS NULL)`

- Index `wf_request_steps_inbox_idx`: `CREATE INDEX wf_request_steps_inbox_idx ON wf.request_steps USING btree (approver_user_id) WHERE (action IS NULL)`

- Index `wf_request_steps_request_idx`: `CREATE INDEX wf_request_steps_request_idx ON wf.request_steps USING btree (request_id, id)`

- Index `wf_request_steps_sla_idx`: `CREATE INDEX wf_request_steps_sla_idx ON wf.request_steps USING btree (sla_due_at) WHERE (action IS NULL)`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.


## wf.requests

**Status:** OBSERVED LOCAL TABLE + Kysely typed; SPEC BASELINE. **Cards:** A03, L02, L03.

**Exact baseline:** `docs/03-DATABASE-SCHEMA.md:734`.

```sql

CREATE TABLE wf.requests (          -- one row per approval instance
  definition_code TEXT NOT NULL REFERENCES wf.definitions(code),
  subject_employee_id BIGINT NOT NULL REFERENCES core.employees, -- whom it's about
  requested_by BIGINT NOT NULL REFERENCES core.users,
  payload JSONB NOT NULL,           -- snapshot of the request content shown to approvers
  current_step SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'|'cancelled'|'lapsed'
  decided_at TIMESTAMPTZ
);

```

**Observed local columns:**

| Column | Physical type | Nullable | Default / identity |

|---|---|---|---|

| id | bigint | NO | ALWAYS |

| definition_code | text | NO | — |

| subject_employee_id | bigint | NO | — |

| requested_by | bigint | NO | — |

| payload | jsonb | NO | — |

| current_step | smallint | NO | 1 |

| status | text | NO | 'pending'::text |

| decided_at | timestamp with time zone | YES | — |

| created_at | timestamp with time zone | NO | now() |

| updated_at | timestamp with time zone | NO | now() |

**Observed integrity and access hooks:**

- Constraint `requests_definition_code_fkey`: `FOREIGN KEY (definition_code) REFERENCES wf.definitions(code)`

- Constraint `requests_pkey`: `PRIMARY KEY (id)`

- Constraint `requests_requested_by_fkey`: `FOREIGN KEY (requested_by) REFERENCES core.users(id)`

- Constraint `requests_status_check`: `CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'lapsed'::text, 'sent_back'::text]))`

- Constraint `requests_subject_employee_id_fkey`: `FOREIGN KEY (subject_employee_id) REFERENCES core.employees(id)`

- Index `requests_pkey`: `CREATE UNIQUE INDEX requests_pkey ON wf.requests USING btree (id)`

- Index `wf_requests_subject_idx`: `CREATE INDEX wf_requests_subject_idx ON wf.requests USING btree (subject_employee_id, status)`

- Trigger `wf_requests_updated_at`: `CREATE TRIGGER wf_requests_updated_at BEFORE UPDATE ON wf.requests FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()`

**Required amendment:** see this table in [pack15](15-BACKEND-SCHEMA-CHANGES.md); retain PK/data and use an approved expand/backfill/validate/contract migration.
