#!/usr/bin/env bash
# Re-copy guide screenshots after a new crawl. Prefers screens/after, falls back to screens/before.
# Usage: SCREENS=/workspace/STATE/screens docs/guides/refresh-images.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
SCREENS="${SCREENS:-/workspace/STATE/screens}"
mkdir -p "$here/img"
: > "$here/img/SOURCES.txt"
grep -v '^#' "$here/images.txt" | while read -r dest role vp shot; do
  [ -z "${dest:-}" ] && continue
  for stage in after before; do
    src="$SCREENS/$stage/$role/$vp/$shot.png"
    if [ -f "$src" ]; then cp "$src" "$here/img/$dest"; echo "$dest <- $stage/$role/$vp/$shot.png" >> "$here/img/SOURCES.txt"; continue 2; fi
  done
  echo "MISSING $dest ($role/$vp/$shot)" | tee -a "$here/img/SOURCES.txt" >&2
done
