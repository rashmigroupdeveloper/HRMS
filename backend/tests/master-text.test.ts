import { describe, expect, it } from 'vitest';
import { cleanMasterLabel } from '../src/core/validation/master-text.js';

describe('cleanMasterLabel', () => {
  it('strips characters payroll will not accept and keeps the words', () => {
    expect(cleanMasterLabel(`Plant & "QA" 'Lead'`)).toBe('Plant QA Lead');
  });

  it('returns empty when the name was only rejected characters', () => {
    expect(cleanMasterLabel(`& "'`)).toBe('');
  });
});
