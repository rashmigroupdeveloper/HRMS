/**
 * PM2 process topology — docs/02 §2 (amended by docs/13 §0.1: single strong box
 * at 3k; worker/scheduler split ready for the 10k scale-up).
 *
 * hrms-api       — HTTP API (cluster mode; scale instances with load)
 * hrms-worker    — pg-boss job consumers (kent-sync, notifications, payroll compute)  [enabled Phase 1]
 * hrms-scheduler — cron leader, SINGLE instance only (leave accrual, daily emails)    [enabled Phase 1]
 */
module.exports = {
  apps: [
    {
      name: 'hrms-api',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      out_file: '/var/log/hrms/api.out.log',
      error_file: '/var/log/hrms/api.err.log',
      merge_logs: true,
      time: true,
    },
    /**
     * ENABLED 5 Sep 2026 (audit W0-T27, finding [H2]).
     *
     * This block sat commented as "uncomment when Phase 1 lands the job system"
     * long after Phase 1 Stages 1.1-1.11 had landed. The consequence of the
     * omission was total: deployed as configured, the platform ran NO Kent sync,
     * no attendance recompute, no OT 48-hour lapse, no week-off close, no leave
     * accrual (LV-02 — the PP-1 pain point), no comp-off expiry, no absence
     * scan, no 07:00 boarding/exit email, no SLA escalation, no KPI snapshot,
     * no helpdesk escalation, no policy nag and no notification delivery.
     * Attendance and leave would simply stop being maintained, silently.
     *
     * The path was wrong too: `tsconfig.build.json` sets rootDir `src`, so
     * `src/jobs/worker.ts` emits to `dist/jobs/worker.js`, not `dist/worker.js`.
     *
     * There is deliberately no separate `hrms-scheduler`: no such entrypoint
     * exists, and pg-boss keeps schedules in the database, so this single
     * `instances: 1` worker IS the cron leader. Never scale it above one.
     */
    {
      name: 'hrms-worker',
      cwd: './backend',
      script: 'dist/jobs/worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      out_file: '/var/log/hrms/worker.out.log',
      error_file: '/var/log/hrms/worker.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
