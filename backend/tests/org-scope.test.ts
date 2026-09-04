/**
 * ORG-05 — parseOrgScope normalizes the shared filter contract.
 */
import { describe, expect, it } from 'vitest';
import { emptyOrgScope, parseOrgScope } from '../src/core/org/scope.js';

describe('parseOrgScope', () => {
  it('returns empty arrays when input is undefined', () => {
    expect(parseOrgScope(undefined)).toEqual(emptyOrgScope());
  });

  it('keeps provided slices and defaults the rest', () => {
    expect(
      parseOrgScope({
        plantCode: ['KGP'],
        misCode: ['HOT'],
      }),
    ).toEqual({
      companyCode: [],
      plantCode: ['KGP'],
      misCode: ['HOT'],
      departmentId: [],
      costCenterCode: [],
    });
  });

  it('rejects empty string codes', () => {
    expect(() => parseOrgScope({ plantCode: [''] })).toThrow();
  });
});
