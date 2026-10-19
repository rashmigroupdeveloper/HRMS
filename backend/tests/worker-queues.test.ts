/** E2E-027: every queue the worker schedules must be created first, or pg-boss fails on a fresh DB. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('worker queues', () => {
  it('creates every scheduled queue', () => {
    const src = readFileSync(new URL('../src/jobs/worker.ts', import.meta.url), 'utf8');
    const list = /const queues = \[([\s\S]*?)\];/.exec(src)?.[1] ?? '';
    const created = new Set([...list.matchAll(/([A-Z_]+_QUEUE)/g)].map((m) => m[1]));
    const scheduled = [...src.matchAll(/schedule\(([A-Z_]+_QUEUE)/g)].map((m) => m[1]);
    expect(scheduled.length).toBeGreaterThan(5);
    expect(scheduled.filter((q) => !created.has(q))).toEqual([]);
  });
});
