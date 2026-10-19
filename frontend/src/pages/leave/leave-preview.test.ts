import { describe, expect, it } from 'vitest';
import { sandwichPreviewCopy } from './leave-preview';

describe('sandwichPreviewCopy', () => {
  it('names include so the Sunday is not a surprise on submit', () => {
    expect(sandwichPreviewCopy('include', [{ date: '2032-05-02', reason: 'week_off' }])).toContain(
      'count (sandwich include)',
    );
  });

  it('counts week-offs and holidays separately for exclude', () => {
    expect(
      sandwichPreviewCopy('exclude', [
        { date: '2032-05-01', reason: 'holiday' },
        { date: '2032-05-02', reason: 'week_off' },
      ]),
    ).toBe('1 week-off skipped · 1 holiday skipped');
  });

  it('says skipped when the span has no off days yet', () => {
    expect(sandwichPreviewCopy('exclude', [])).toContain('are skipped');
  });
});
