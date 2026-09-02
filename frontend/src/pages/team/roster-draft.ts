/** Pure roster-draft helpers (ATT-04/12). */
export interface RosterCellDraft {
  weekOff: boolean;
  shiftCode: string | null;
}

export type RosterDraft = Record<string, RosterCellDraft>;

interface RosterChange {
  employeeId: number;
  date: string;
  shiftCode?: string;
  weekOff: boolean;
}

export function rosterCellKey(employeeId: number, date: string): string {
  return `${String(employeeId)}|${date}`;
}

export function getRosterChanges(draft: RosterDraft, baseline: RosterDraft): RosterChange[] {
  const changes: RosterChange[] = [];

  for (const [key, cell] of Object.entries(draft)) {
    const saved = baseline[key];
    if (saved?.weekOff === cell.weekOff && saved.shiftCode === cell.shiftCode) continue;

    const [employeeIdText = '', date = ''] = key.split('|');
    const employeeId = Number(employeeIdText);
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0 || date === '') continue;

    if (cell.weekOff) {
      changes.push({ employeeId, date, weekOff: true });
    } else if (cell.shiftCode) {
      changes.push({ employeeId, date, shiftCode: cell.shiftCode, weekOff: false });
    }
  }

  return changes;
}

export function mergeSavedRosterChanges(
  baseline: RosterDraft,
  changes: RosterChange[],
): RosterDraft {
  const next = { ...baseline };
  for (const change of changes) {
    next[rosterCellKey(change.employeeId, change.date)] = {
      weekOff: change.weekOff,
      shiftCode: change.weekOff ? null : (change.shiftCode ?? null),
    };
  }
  return next;
}
