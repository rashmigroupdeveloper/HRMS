/** CORE-10: drafts belong to one authenticated identity, never the browser's next user. */
export function ownedDraftKey(kind: 'ar' | 'leave', ownerId?: number): string | null {
  try { localStorage.removeItem(`rashmi.draft.${kind}`); } catch { /* discard unowned legacy drafts */ }
  return ownerId !== undefined && Number.isSafeInteger(ownerId) && ownerId > 0
    ? `rashmi.draft.${kind}.user.${String(ownerId)}` : null;
}
