import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/core/config/env.js';

describe('setup smoke', () => {
  it('GET /health returns the response envelope', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok', service: 'hrms-api' },
      error: null,
    });
  });

  it('loadEnv fails fast on a missing DATABASE_URL', () => {
    expect(() => loadEnv({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/);
  });

  it('loadEnv parses a valid environment', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '5100',
      DATABASE_URL: 'postgres://hrms:pw@localhost:5432/hrms',
      JWT_SECRET: 'a-test-secret-that-is-at-least-32-characters!',
    });
    expect(env.PORT).toBe(5100);
    expect(env.NODE_ENV).toBe('test');
  });
});
