#!/bin/bash
# usage: snapshot.sh <label>
set -e
export PGPASSWORD=hrms_local_dev
D=/workspace/hrms-test/payroll/snapshots
L=$1
pg_dump -h localhost -U hrms -d hrms --schema-only --no-owner > $D/schema_$L.sql
psql -h localhost -U hrms -d hrms -At -F $'\t' > $D/rowcounts_$L.tsv <<'SQL'
select table_schema||'.'||table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint
from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema') order by 1;
SQL
echo "$L: $(wc -l < $D/rowcounts_$L.tsv) tables, $(awk -F'\t' '{s+=$2} END{print s}' $D/rowcounts_$L.tsv) rows"
