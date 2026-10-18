/**
 * Core Organization Masters Integration Test (CORE-01, LC-05).
 *
 * Verifies that /core/companies, /core/departments, /core/locations,
 * /core/designations, and /core/grades return real organization master data
 * for consumption by TransfersPage and other lifecycle surfaces.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { signAccessToken } from '../src/core/auth/jwt.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Core Organization Masters API', () => {
  let db: Kysely<Database>;
  let app: Express;
  let authHeader: string;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const jwtSecret = 'test-jwt-secret-for-core-masters-test-at-least-32-chars';
    app = createApp({
      db,
      jwtSecret,
      secureCookies: false,
    });

    // Create auth token for existing employee / user
    const user = await db
      .selectFrom('core.users')
      .innerJoin('core.employees', 'core.employees.id', 'core.users.employee_id')
      .select(['core.users.id', 'core.users.email', 'core.users.employee_id', 'core.employees.ecode'])
      .where('core.users.is_active', '=', true)
      .executeTakeFirst();

    if (!user) {
      throw new Error('No active user found in test database');
    }

    const session = await db
      .insertInto('sec.sessions')
      .values({
        user_id: user.id,
        expires_at: new Date(Date.now() + 3600000),
      })
      .returning('sid')
      .executeTakeFirstOrThrow();

    const token = await signAccessToken(
      user.id,
      user.email,
      jwtSecret,
      session.sid,
    );
    authHeader = `Bearer ${token}`;
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('GET /api/core/companies returns group legal entities with ecode_prefix', async () => {
    const res = await request(app)
      .get('/api/core/companies')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('companies');
    const body = res.body as { companies: { id: number; code: string; name: string; ecode_prefix: string }[] };
    expect(Array.isArray(body.companies)).toBe(true);
    expect(body.companies.length).toBeGreaterThan(0);
    const rml = body.companies.find((c) => c.ecode_prefix === 'RML');
    expect(rml).toBeDefined();
    expect(rml?.name).toContain('Rashmi');
  });

  it('GET /api/core/departments returns active corporate and plant departments', async () => {
    const res = await request(app)
      .get('/api/core/departments')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('departments');
    const body = res.body as { departments: { id: number; name: string; code: string }[] };
    expect(Array.isArray(body.departments)).toBe(true);
    expect(body.departments.length).toBeGreaterThan(0);
  });

  it('GET /api/core/locations returns registered office and plant locations', async () => {
    const res = await request(app)
      .get('/api/core/locations')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('locations');
    const body = res.body as { locations: { id: number; name: string; code: string }[] };
    expect(Array.isArray(body.locations)).toBe(true);
    expect(body.locations.length).toBeGreaterThan(0);
  });

  it('GET /api/core/designations returns catalog designations', async () => {
    const res = await request(app)
      .get('/api/core/designations')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('designations');
    const body = res.body as { designations: { id: number; title: string }[] };
    expect(Array.isArray(body.designations)).toBe(true);
    expect(body.designations.length).toBeGreaterThan(0);
  });

  it('GET /api/core/grades returns standard job hierarchy grades with ranks', async () => {
    const res = await request(app)
      .get('/api/core/grades')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('grades');
    const body = res.body as { grades: { id: number; code: string; rank: number }[] };
    expect(Array.isArray(body.grades)).toBe(true);
    expect(body.grades.length).toBeGreaterThan(0);
  });
});
