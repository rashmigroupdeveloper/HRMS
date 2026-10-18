#!/usr/bin/env bash
source "$(dirname "$0")/env.sh"
pkill -f "vite --port $E2E_FRONTEND_PORT" ; pkill -f "E2E_INSTANCE" 
for p in $E2E_BACKEND_PORT $E2E_FRONTEND_PORT; do pid=$(ss -ltnp "sport = :$p" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2); [ -n "$pid" ] && kill $pid; done
sleep 1; true
