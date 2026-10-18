#!/usr/bin/env bash
# Re-provision tooling after a box reset (system packages are not persistent; PG data lives in /workspace/.pg17data).
set -e
command -v pg_ctlcluster >/dev/null || { sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-17 postgresql-client-17; }
[ -x /opt/node24/bin/node ] || { cd /tmp && curl -fsSLO https://nodejs.org/dist/latest-v24.x/node-v24.22.0-linux-x64.tar.xz && sudo mkdir -p /opt/node24 && sudo tar -xJf node-v24.22.0-linux-x64.tar.xz -C /opt/node24 --strip-components=1; }
if ! pg_lsclusters | grep -q /workspace/.pg17data; then
  sudo pg_dropcluster 17 main --stop 2>/dev/null || true
  sudo mkdir -p /etc/postgresql/17/main
  sudo pg_createcluster 17 main -d /workspace/.pg17data 2>/dev/null || true
fi
sudo pg_ctlcluster 17 main start 2>/dev/null || true
for p in /workspace/hrms-fix/backend /workspace/hrms-fix/frontend; do [ -d $p/node_modules ] || (cd $p && PATH=/opt/node24/bin:$PATH npm ci --no-audit --no-fund); done
