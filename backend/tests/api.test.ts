/**
 * oRPC layer smoke tests — the typed procedure surface + the OpenAPI contract.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

interface HealthBody {
  status: string;
  service: string;
  ts: string;
}

interface OpenApiDoc {
  openapi: string;
  info: { title: string };
  paths: Record<string, unknown>;
}

describe('oRPC API layer', () => {
  it('GET /api/system/health serves the typed procedure', async () => {
    const res = await request(createApp()).get('/api/system/health');

    expect(res.status).toBe(200);
    const body = res.body as HealthBody;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('hrms-api');
    expect(new Date(body.ts).getTime()).not.toBeNaN();
  });

  it('GET /api/openapi.json emits the contract with the procedure documented', async () => {
    const res = await request(createApp()).get('/api/openapi.json');

    expect(res.status).toBe(200);
    const spec = res.body as OpenApiDoc;
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('Rashmi HRMS API');
    expect(spec.paths).toHaveProperty('/system/health');
  });

  it('unknown /api paths fall through to 404, not a crash', async () => {
    const res = await request(createApp()).get('/api/does/not/exist');
    expect(res.status).toBe(404);
  });
});
