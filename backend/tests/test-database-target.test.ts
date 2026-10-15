import { describe, expect, it } from 'vitest';
import { testDatabaseTarget } from './test-database-target.js';

describe('explicit integration database target (NFR-03/04)', () => {
  it('does not fall back to the application database', () => {
    expect(testDatabaseTarget({ DATABASE_URL: 'postgresql://localhost/hrms' })).toBeUndefined();
  });
  it('accepts the dedicated CI database', () => {
    const target = 'postgresql://127.0.0.1:55432/hrms_ci_test';
    expect(testDatabaseTarget({ TEST_DATABASE_URL: target, NODE_ENV: 'test' })).toBe(target);
  });
  it('requires an explicit declaration for the sponsor-approved local shared test database', () => {
    const target = 'postgresql://localhost:5432/hrms';
    expect(() => testDatabaseTarget({ TEST_DATABASE_URL: target, NODE_ENV: 'test' })).toThrow();
    expect(testDatabaseTarget({ TEST_DATABASE_URL: target, NODE_ENV: 'test', LOCAL_TEST_DATABASE_NAME: 'hrms' })).toBe(target);
  });
  it.each([
    ['postgresql://remote.example/hrms', 'test', 'hrms'],
    ['postgresql://localhost/other', 'test', 'hrms'],
    ['postgresql://localhost/hrms', 'development', 'hrms'],
    ['postgresql://localhost/hrms_test', 'production', undefined],
    ['https://localhost/hrms_test', 'test', undefined],
    ['postgresql://localhost/hrms', 'test', 'hrms/other'],
  ])('rejects an unauthorized target %s in %s', (target, environment, localName) => {
    const source: NodeJS.ProcessEnv = { TEST_DATABASE_URL: target, NODE_ENV: environment };
    if (localName) source['LOCAL_TEST_DATABASE_NAME'] = localName;
    expect(() => testDatabaseTarget(source)).toThrow();
  });
});
