/** P0-T11, ATT-04/09: deployed jobs exist and run at the specified IST time. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CronExpressionParser } from 'cron-parser';

const require = createRequire(import.meta.url);
const topology = require('../../ecosystem.config.cjs') as {
  apps: { name: string; script: string; instances: number; exec_mode: string; env: { NODE_ENV: string } }[];
};
const source = readFileSync(new URL('../src/jobs/worker.ts', import.meta.url), 'utf8');
function nextRun(queue: string, currentDate: string): string {
  const match = new RegExp(`schedule\\(${queue},\\s*'([^']+)'([\\s\\S]*?)\\);`).exec(source);
  if (!match?.[1]) throw new Error(`Missing schedule for ${queue}`);
  const tz = /tz:\s*'([^']+)'/.exec(match[2] ?? '')?.[1] ?? 'UTC';
  return CronExpressionParser.parse(match[1], { currentDate, tz }).next().toISOString() ?? '';
}
describe('production job topology and clock', () => {
  it('deploys exactly one implemented background worker', () => {
    const workers = topology.apps.filter(app => app.name === 'hrms-worker');
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatchObject({ script: 'dist/jobs/worker.js', instances: 1, exec_mode: 'fork', env: { NODE_ENV: 'production' } });
    expect(topology.apps.some(app => app.name === 'hrms-scheduler')).toBe(false);
  });
  it('closes the previous week on Monday at 02:00 IST', () => {
    expect(nextRun('WEEK_CLOSE_QUEUE', '2026-10-04T19:00:00Z')).toBe('2026-10-04T20:30:00.000Z');
  });
  it('reminds managers on the fifth at 09:00 IST', () => {
    expect(nextRun('ROSTER_REMINDER_QUEUE', '2026-11-04T21:00:00Z')).toBe('2026-11-05T03:30:00.000Z');
  });
});
