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

/**
 * `csvList` — a repeated filter value carried in a query string.
 *
 * The directory drawer offers multi-select facets, so `?statuses=active,on_notice`
 * has to arrive as a real array. A bare `z.array()` rejects the comma-joined
 * string a query string actually carries, so this splits it first and lets a
 * genuine array (from a JSON body) pass through untouched — the same schema
 * then serves both transports.
 *
 * Empty segments are dropped so a trailing comma cannot become an empty filter
 * value that matches nothing.
 */
export function csvList<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((value) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
    }
    return value;
  }, z.array(item).min(1));
}
