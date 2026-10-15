/** NFR-03/04: explicit test targets, with the sponsor's local-only exception. */
export function testDatabaseTarget(source: NodeJS.ProcessEnv): string | undefined {
  const target = source['TEST_DATABASE_URL'];
  if (!target) return undefined;
  if (source['NODE_ENV'] === 'production') {
    throw new Error('Integration tests cannot target a production environment');
  }
  const url = new URL(target);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('TEST_DATABASE_URL must be a PostgreSQL connection');
  }
  const localName = source['LOCAL_TEST_DATABASE_NAME'];
  if (localName) {
    // Never treat a suffix or flag alone as authorization for a remote app DB.
    if (source['NODE_ENV'] !== 'test'
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || !/^[a-zA-Z0-9_]+$/.test(localName)
      || url.pathname !== `/${localName}`) {
      throw new Error('The explicitly declared local test database must match a loopback test target');
    }
    return target;
  }
  if (!/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname)) {
    throw new Error('TEST_DATABASE_URL must name a dedicated *_test database');
  }
  return target;
}
