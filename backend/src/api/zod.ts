/**
 * Shared zod helpers for the API layer.
 *
 * `booleanQuery` — a boolean carried in a QUERY string. oRPC's OpenAPI handler
 * does NOT coerce query params to booleans: a plain `z.boolean()` 400s on the
 * string 'true', and `z.coerce.boolean()` is worse still — `Boolean('false')`
 * is TRUE, so a `?flag=false` silently reads as `true`. This preprocess maps
 * the wire string correctly and passes real booleans through untouched, so the
 * same schema works from a query string AND a JSON body.
 */
import { z } from 'zod';

export function booleanQuery() {
  return z.preprocess((value) => {
    if (typeof value === 'string') return value === 'true' || value === '1';
    return value;
  }, z.boolean());
}
