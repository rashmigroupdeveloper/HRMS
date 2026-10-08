/**
 * HTTP HARDENING — regression net for docs/audit/05-SECURITY-REVIEW.md §§4-5.
 *
 * The audit's `curl -i` against a running server returned exactly one security
 * header, and it was the wrong kind: `X-Powered-By: Express`. No HSTS, no
 * nosniff, no frame-ancestors, no CSP, no Referrer-Policy — on an application
 * that approves resignations and will move money. Separately, 30 failed logins
 * completed in ONE second, which combined with a working (and
 * attacker-triggerable) account lockout meant ~5,330 unauthenticated requests
 * could lock out all 1,066 employees.
 */
import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createApp } from '../src/app.js';

describe('HTTP hardening (findings D4, D5, D6, D8)', () => {
  let app: Express;
  afterEach(() => { vi.unstubAllEnvs(); });

  beforeAll(() => {
    app = createApp({
      db: null,
      jwtSecret: 'hardening-test-secret-at-least-32-chars!!',
      secureCookies: false,
      // Tight on purpose: this file is the one that proves the limiter bites.
      // Every other suite runs permissive, so a legitimate dozen logins is not
      // mistaken for an attack.
      rateLimits: {
        authPerIdentifier: 5,
        authPerAddress: 8,
        globalPerAddress: 1000,
      },
    });
  });
  afterAll(() => { /* no resources held */ });

  it('refuses the published fallback signing secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => createApp()).toThrow('jwtSecret is required');
  });

  it('requires an explicit production origin allowlist', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', '');
    expect(() => createApp({ jwtSecret: 'synthetic-production-test-secret-32-chars' })).toThrow('CORS_ORIGIN');
  });

  it('sets HSTS in production and permits only configured origins', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'https://hrms.example.invalid');
    const production = createApp({ jwtSecret: 'synthetic-production-test-secret-32-chars' });
    const permitted = await request(production).get('/health').set('Origin', 'https://hrms.example.invalid');
    expect(permitted.headers['strict-transport-security']).toContain('max-age=');
    expect(permitted.headers['access-control-allow-origin']).toBe('https://hrms.example.invalid');
    const forbidden = await request(production).get('/health').set('Origin', 'https://untrusted.example.invalid');
    expect(forbidden.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('throttles identifier-less and non-object auth payloads too', async () => {
    const limited = createApp({ rateLimits: { authPerIdentifier: 1, authPerAddress: 100, globalPerAddress: 100 } });
    expect((await request(limited).post('/api/auth/login').send({ password: 'wrong' })).status).not.toBe(429);
    expect((await request(limited).post('/api/auth/login').send({ password: 'wrong' })).status).toBe(429);
  });

  it('keeps different employees behind one plant address in separate general buckets', async () => {
    const secret = 'synthetic-rate-limit-test-secret-32-characters';
    const general = createApp({ jwtSecret: secret, rateLimits: { authPerIdentifier: 100, authPerAddress: 100, globalPerAddress: 1 } });
    const first = await signAccessToken(1, 'one@hrms.invalid', secret);
    const second = await signAccessToken(2, 'two@hrms.invalid', secret);
    expect((await request(general).get('/api/openapi.json').auth(first, { type: 'bearer' })).status).toBe(200);
    expect((await request(general).get('/api/openapi.json').auth(second, { type: 'bearer' })).status).toBe(200);
    expect((await request(general).get('/api/openapi.json').auth(first, { type: 'bearer' })).status).toBe(429);
  });

  it('sends the security headers that were entirely absent', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
  });

  it('no longer advertises the framework', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rate-limits repeated auth attempts from one address', async () => {
    // The audit ran 30 in a second, all processed. The limiter allows 30 per
    // 15 min, so the 31st must be refused regardless of credentials.
    let sawLimit = false;
    for (let i = 0; i < 20; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'nobody@hrms.invalid', password: `wrong-${String(i)}` });
      if (res.status === 429) { sawLimit = true; break; }
    }
    expect(sawLimit).toBe(true);
  }, 60_000);

  it('accepts a body far larger than the old 100 kB ceiling', async () => {
    // A scanned PAN or Aadhaar is 200 kB-2 MB. At the Express default this
    // returned 413 with an HTML stack trace, so the document vault (DOC-02),
    // policy publish (CORE-13) and letters (CORE-09) did not work at all.
    const big = 'A'.repeat(400_000);
    const res = await request(app)
      .post('/api/documents/mine')
      .send({ documentType: 'pan', fileName: 'x.pdf', mime: 'application/pdf', content: big });
    // Unauthenticated, so 401 — the point is that it was PARSED, not rejected
    // by the body-size limit.
    expect(res.status).not.toBe(413);
  });

  it('cannot bypass the per-account limit by rotating IPv6 addresses in one subnet', async () => {
    const ipv6App = createApp({
      db: null,
      rateLimits: { authPerIdentifier: 5, authPerAddress: 100, globalPerAddress: 1000 },
    });
    for (let i = 1; i <= 6; i += 1) {
      const response = await request(ipv6App).post('/api/auth/login')
        .set('X-Forwarded-For', `2001:db8:1234:5600::${String(i)}`)
        .send({ identifier: 'same-account@hrms.invalid', password: 'wrong-password' });
      if (i <= 5) expect(response.status).not.toBe(429);
      else expect(response.status).toBe(429);
    }
  });

  it('answers errors as JSON, never an HTML stack trace', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier": "broken'); // deliberately malformed JSON
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers['content-type']).toContain('application/json');
    expect(JSON.stringify(res.body)).not.toContain('/Users/');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });
});
