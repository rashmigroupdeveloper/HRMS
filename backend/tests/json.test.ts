import { describe, expect, it } from 'vitest';
import { parseJsonObject, parseJsonValue } from '../src/core/json.js';

describe('CORE-08 JSON database boundaries', () => {
  it('accepts native JSONB objects and legacy serialized objects with the same fields', () => {
    const row = { BASIC: 1000000, metadata: { revision: 'approved' } };
    expect(parseJsonObject(row)).toEqual(row);
    expect(parseJsonObject('{"BASIC":1000000,"metadata":{"revision":"approved"}}')).toEqual(row);
  });

  it.each([null, 1, true, [], '[1]', 'null', '"not an object"'])(
    'rejects %j when the database contract requires an object', value => {
      expect(() => parseJsonObject(value)).toThrow();
    },
  );

  it('rejects malformed legacy JSON rather than manufacturing an empty object', () => {
    expect(() => parseJsonObject('{')).toThrow(SyntaxError);
  });

  it('preserves array and null values for domain-specific schemas to validate', () => {
    expect(parseJsonValue('[{"assetId":1}]')).toEqual([{ assetId: 1 }]);
    expect(parseJsonValue(null)).toBeNull();
  });
});
