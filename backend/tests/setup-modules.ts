// Runs before every test file (vitest setupFiles): loads the leave module, as the API and the worker do (src/router.ts,
// src/worker.ts) - attendance's day calculation asks it for everyone's leave and refuses to work without it (2026-11-22).
import '#modules/leave'
