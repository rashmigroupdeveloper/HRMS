#!/usr/bin/env bash
# Box-only fix instance: backend :5110 (hrms_fix), frontend :5183 → proxy :5110. Never touches :5100/:5173.
export PATH=/opt/node24/bin:$PATH
mkdir -p /workspace/hrms-test/fix-verify/logs
pkill -f "hrms-fix/backend.*src/index.ts" 2>/dev/null; pkill -f "vite.*--port 5183" 2>/dev/null; sleep 1
cd /workspace/hrms-fix/backend && nohup npx tsx src/index.ts > /workspace/hrms-test/fix-verify/logs/backend.log 2>&1 &
cd /workspace/hrms-fix/frontend && VITE_API_TARGET=http://localhost:5110 nohup npx vite --port 5183 --strictPort > /workspace/hrms-test/fix-verify/logs/frontend.log 2>&1 &
sleep 6; curl -s -o /dev/null -w "backend %{http_code}\n" http://localhost:5110/api/health; curl -s -o /dev/null -w "frontend %{http_code}\n" http://localhost:5183/
