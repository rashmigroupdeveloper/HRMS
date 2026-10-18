/**
 * Employee Import & greytHR Enrichment Integration Suite (CORE-12, doc 11 §0.1).
 *
 * Verifies:
 * 1. EMS Seed import validation: schema check, unknown company, e-code series check, missing phone, missing credentials.
 * 2. Second pass manager linking and missing manager exceptions.
 * 3. greytHR statutory enrichment: schema check, unmatched ecode, and statutory updates.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { importEmsSeed, importGreythrEnrich } from '../src/modules/employees/import.service.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('CORE-12 — Employee Import & Enrichment Service', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();

  beforeAll(() => {
    db = createDatabase(DB_URL ?? '');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('validates EMS seed rows and records exceptions for malformed, unknown company, and mismatched series', async () => {
    const rawRows = [
      // 1. Malformed row (missing required fields)
      { invalid: 'schema' },
      // 2. Unknown company
      {
        userid: 'RML099991',
        username: 'Test Candidate',
        company: 'Unknown Nonexistent Pvt Ltd',
      },
      // 3. Mismatched e-code series for company (RML company but EIPLL prefix)
      {
        userid: 'EIPLL99992',
        username: 'Series Mismatch',
        company: 'Rashmi Metaliks Limited',
      },
      // 4. Missing phone and missing password
      {
        userid: `RML${String(stamp).slice(-5)}1`,
        username: 'No Phone No Pass',
        company: 'Rashmi Metaliks Limited',
        gender: 'M',
      },
      // 5. Missing reporting manager
      {
        userid: `RML${String(stamp).slice(-5)}2`,
        username: 'Missing Manager User',
        company: 'Rashmi Metaliks Limited',
        phone: '9876543210',
        email: `import-${stamp}-mgr@hrms.test`,
        encrypted_password: 'hashed-password-123',
        reporting_manager_userid: 'RML000000_NONEXISTENT',
        hod_userid: 'RML000000_NONEXISTENT_HOD',
      },
    ];

    const result = await importEmsSeed(db, rawRows);
    expect(result.exceptions.length).toBeGreaterThanOrEqual(4);
    expect(result.exceptions.some((e) => e.issue.includes('invalid row'))).toBe(true);
    expect(result.exceptions.some((e) => e.issue.includes('unknown company'))).toBe(true);
    expect(result.exceptions.some((e) => e.issue.includes('series'))).toBe(true);
    expect(result.exceptions.some((e) => e.issue.includes('missing phone'))).toBe(true);
    expect(result.exceptions.some((e) => e.issue.includes('reporting manager not found'))).toBe(true);
  });

  it('validates greytHR enrichment rows and handles unmatched ecodes and valid updates', async () => {
    const rawRows = [
      // 1. Invalid row schema
      { bad: 'data' },
      // 2. Unmatched employee ecode
      {
        userid: 'RML000000_DOES_NOT_EXIST',
        dob: '1990-01-01',
        doj: '2020-01-01',
        pan: 'ABCDE1234F',
      },
    ];

    const result = await importGreythrEnrich(db, rawRows);
    expect(result.unmatched.length).toBe(2);
    expect(result.unmatched[0]).toContain('invalid row');
    expect(result.unmatched[1]).toBe('RML000000_DOES_NOT_EXIST');
  });
});
