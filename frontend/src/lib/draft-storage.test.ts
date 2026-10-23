import { beforeEach, expect, it } from 'vitest';
import { ownedDraftKey } from './draft-storage';
beforeEach(() => { localStorage.clear(); });
it.each(['ar', 'leave'] as const)('isolates %s drafts and refuses unowned legacy content', kind => {
  localStorage.setItem(`rashmi.draft.${kind}`, 'private legacy text');
  const first = ownedDraftKey(kind, 10);
  const second = ownedDraftKey(kind, 20);
  expect(first).not.toBe(second);
  expect(localStorage.getItem(`rashmi.draft.${kind}`)).toBeNull();
  expect(first).not.toBeNull();
  localStorage.setItem(first ?? '', 'first employee only');
  expect(localStorage.getItem(second ?? '')).toBeNull();
  expect(localStorage.getItem(ownedDraftKey(kind, 10) ?? '')).toBe('first employee only');
  expect(ownedDraftKey(kind)).toBeNull();
  expect(ownedDraftKey(kind, Number.NaN)).toBeNull();
});
