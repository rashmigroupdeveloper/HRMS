/** CORE-10: drafts belong to one authenticated identity, never the browser's next user. */
export type DraftKind = 'ar' | 'leave' | 'claims' | 'prejoin' | 'resignation';

export function ownedDraftKey(kind: DraftKind, ownerId?: number): string | null {
  try { localStorage.removeItem(`rashmi.draft.${kind}`); } catch { /* discard unowned legacy drafts */ }
  return ownerId !== undefined && Number.isSafeInteger(ownerId) && ownerId > 0
    ? `rashmi.draft.${kind}.user.${String(ownerId)}` : null;
}
