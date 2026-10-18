#!/usr/bin/env bash
# Handover item 7 / NFR backup: consistent Postgres dump (custom format) + the document store,
# with a SHA-256 manifest and retention. Run nightly from cron, e.g.
#   15 1 * * * DATABASE_URL=... STORAGE_DIR=... BACKUP_DIR=/srv/hrms-backups /opt/hrms/scripts/backup.sh
# Env: DATABASE_URL (required), STORAGE_DIR (default backend/var/storage), BACKUP_DIR (default ./backups),
#      RETENTION_DAYS (default 30).
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
HERE=$(cd "$(dirname "$0")" && pwd)
STORAGE_DIR=${STORAGE_DIR:-$HERE/../backend/var/storage}
BACKUP_DIR=${BACKUP_DIR:-$HERE/../backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/hrms-$STAMP"
mkdir -p "$OUT"
umask 077
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$OUT/db.dump"
if [ -d "$STORAGE_DIR" ]; then tar -C "$STORAGE_DIR" -czf "$OUT/storage.tgz" .; else tar -czf "$OUT/storage.tgz" -T /dev/null; fi
pg_restore --list "$OUT/db.dump" > /dev/null   # the dump must be readable
( cd "$OUT" && sha256sum db.dump storage.tgz > MANIFEST.sha256 )
echo "{\"createdAt\":\"$(date -Iseconds)\",\"dbBytes\":$(stat -c %s "$OUT/db.dump"),\"storageBytes\":$(stat -c %s "$OUT/storage.tgz")}" > "$OUT/meta.json"
find "$BACKUP_DIR" -maxdepth 1 -type d -name 'hrms-*' -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
echo "BACKUP OK $OUT"
