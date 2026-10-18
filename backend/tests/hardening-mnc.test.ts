/** MNC hardening (handover item 8): readiness probe, request ids, CSV formula-injection guard. */
import { describe, expect, it } from 'vitest';
import { httpRequest } from './http-client.js';
import { createApp } from '../src/app.js';
import { csvCell, formulaSafe } from '../src/core/bulk/index.js';

describe('readiness and request ids', () => {
  it('GET /health/ready is 503 without a database and echoes a request id', async () => {
    const res = await (await httpRequest(createApp())).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, data: { status: 'unavailable', checks: { database: 'down' } } });
    expect(typeof res.headers['x-request-id']).toBe('string');
  });
});

describe('csv formula-injection guard', () => {
  it('prefixes executable text and keeps plain numbers', () => {
    expect(formulaSafe('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(formulaSafe('-12.5')).toBe('-12.5');
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});
