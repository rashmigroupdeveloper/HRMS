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
    // Uncomment when Phase 1 lands the job system (docs/02 §6 job catalog):
    // {
    //   name: 'hrms-worker',
    //   cwd: './backend',
    //   script: 'dist/worker.js',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   env: { NODE_ENV: 'production' },
    // },
    // {
    //   name: 'hrms-scheduler',
    //   cwd: './backend',
    //   script: 'dist/scheduler.js',
    //   instances: 1, // NEVER more than 1 — cron leader
    //   exec_mode: 'fork',
    //   env: { NODE_ENV: 'production' },
    // },
  ],
};
