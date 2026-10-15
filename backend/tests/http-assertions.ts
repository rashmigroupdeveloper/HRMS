/** CORE-10 / NFR-03: fail on HTTP errors before casting a success body. */
import { expect } from 'vitest';

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/** Only error code/validation paths: never log tokens, cookies or input values. */
export function expectHttpStatus(
  response: { status: number; body: unknown; headers?: Record<string, unknown> },
  expected: number,
): void {
  const body = record(response.body);
  const data = record(body?.['data']);
  const issues = data?.['issues'];
  const paths = Array.isArray(issues)
    ? issues.map((issue: unknown) => {
      const path = record(issue)?.['path'];
      return Array.isArray(path)
        ? path.filter((part: unknown): part is string | number => typeof part === 'string' || typeof part === 'number')
        : [];
    })
    : [];
  const code = body?.['code'];
  const diagnostic = JSON.stringify({
    status: response.status,
    code: typeof code === 'string' ? code : null,
    contentType: response.headers?.['content-type'],
    server: response.headers?.['server'],
    bodyKeys: body ? Object.keys(body) : [],
    validationPaths: paths,
  });
  expect(response.status, diagnostic).toBe(expected);
}
