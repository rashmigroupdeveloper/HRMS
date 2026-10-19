import { describe, expect, it } from 'vitest';
import { genderSchema } from '../src/core/validation/gender.js';
describe('joining-master gender normalization (REQ-002/CORE-12)', () => {
  it.each([['M', 'Male'], [' male ', 'Male'], ['F', 'Female'], ['female', 'Female'], ['T', 'Transgender'], ['Other', 'Transgender']])('normalizes %s to %s', (input, output) => {
    expect(genderSchema.parse(input)).toBe(output);
  });
  it('preserves missing values and refuses unknown source data', () => {
    expect(genderSchema.parse(null)).toBeNull();
    expect(genderSchema.parse(' ')).toBeUndefined();
    expect(genderSchema.safeParse('unrecognized')).toMatchObject({ success: false });
  });
});
