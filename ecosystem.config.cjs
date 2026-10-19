/**
 * PM2 process topology — docs/02 §2 (amended by docs/13 §0.1: single strong box
 * at 3k; worker/scheduler split ready for the 10k scale-up).
 *
 * hrms-api       — HTTP API (cluster mode; scale instances with load)
 * hrms-worker    — pg-boss job consumers (kent-sync, notifications, payroll compute)  [enabled Phase 1]
 * hrms-worker also registers persistent schedules; keep this process single-instance.
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
    // The worker owns pg-boss schedule registration; no separate entrypoint exists.
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
