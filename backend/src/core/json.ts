/** CORE-08: decode JSON boundaries without allowing JSON.parse's `any` to escape. */
import { z } from 'zod';

export function parseJsonValue(value: unknown): unknown {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return parsed;
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  return z.record(z.unknown()).parse(parseJsonValue(value));
}
