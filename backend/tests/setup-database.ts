/** NFR-03/04: integration tests must never consume the application's .env DB. */
import { config } from 'dotenv';
import { testDatabaseTarget } from './test-database-target.js';

const declaredTestUrl = process.env['TEST_DATABASE_URL'] ?? '';
const declaredLocalName = process.env['LOCAL_TEST_DATABASE_NAME'] ?? '';
config();
process.env['TEST_DATABASE_URL'] = declaredTestUrl;
process.env['LOCAL_TEST_DATABASE_NAME'] = declaredLocalName;
const testUrl = testDatabaseTarget(process.env);
if (testUrl === undefined || testUrl === '') {
  // Leave an empty value so a later dotenv/config import cannot reload the app DB.
  process.env['DATABASE_URL'] = '';
} else {
  process.env['DATABASE_URL'] = testUrl;
}
// Dedicated hardening tests inject tight limits; other suites exercise business behavior.
process.env['RATE_LIMIT_AUTH_PER_IDENTIFIER'] = '10000';
process.env['RATE_LIMIT_AUTH_PER_ADDRESS'] = '10000';
process.env['RATE_LIMIT_GLOBAL_PER_ADDRESS'] = '100000';
