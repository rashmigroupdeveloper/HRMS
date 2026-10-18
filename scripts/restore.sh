#!/usr/bin/env bash
# Restore a backup made by backup.sh into a NEW database (never over the live one) and
# a storage directory; verifies the manifest first. Usage:
#   restore.sh <backup-dir> <target-db-name>     Env: PGHOST/PGUSER/PGPASSWORD/PGPORT, RESTORE_STORAGE_DIR
set -euo pipefail
SRC=${1:?backup dir}; DB=${2:?target database name}
[[ "$DB" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "bad database name" >&2; exit 2; }
( cd "$SRC" && sha256sum -c MANIFEST.sha256 )
if psql -d postgres -Atc "select 1 from pg_database where datname='$DB'" | grep -q 1; then
  echo "database $DB already exists — refusing to overwrite" >&2; exit 3
fi
createdb "$DB"
pg_restore --no-owner --exit-on-error --dbname="$DB" "$SRC/db.dump"
if [ -n "${RESTORE_STORAGE_DIR:-}" ]; then mkdir -p "$RESTORE_STORAGE_DIR" && tar -C "$RESTORE_STORAGE_DIR" -xzf "$SRC/storage.tgz"; fi
echo "RESTORE OK $DB ($(psql -d "$DB" -Atc 'select count(*) from core.employees') employees)"
