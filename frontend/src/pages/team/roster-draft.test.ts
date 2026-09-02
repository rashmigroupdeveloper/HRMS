import { describe, expect, it } from 'vitest';
import {
  getRosterChanges,
  mergeSavedRosterChanges,
  rosterCellKey,
  type RosterDraft,
} from './roster-draft';

describe('roster draft changes (ATT-04/12)', () => {
  const existing: RosterDraft = {
    [rosterCellKey(41, '2026-09-01')]: { weekOff: false, shiftCode: 'GEN' },
    [rosterCellKey(41, '2026-09-02')]: { weekOff: true, shiftCode: null },
  };

  it('does not serialize unchanged server rows', () => {
    expect(getRosterChanges({ ...existing }, existing)).toEqual([]);
  });

  it('serializes only changed or newly filled cells', () => {
    const draft: RosterDraft = {
      ...existing,
      [rosterCellKey(41, '2026-09-01')]: { weekOff: false, shiftCode: 'NIGHT' },
      [rosterCellKey(42, '2026-09-03')]: { weekOff: true, shiftCode: null },
    };

    expect(getRosterChanges(draft, existing)).toEqual([
      { employeeId: 41, date: '2026-09-01', shiftCode: 'NIGHT', weekOff: false },
      { employeeId: 42, date: '2026-09-03', weekOff: true },
    ]);
  });

  it('marks completed chunks as saved so a retry contains only the remainder', () => {
    const changes = [
      { employeeId: 41, date: '2026-09-01', shiftCode: 'NIGHT', weekOff: false },
    ];
    const draft: RosterDraft = {
      ...existing,
      [rosterCellKey(41, '2026-09-01')]: { weekOff: false, shiftCode: 'NIGHT' },
      [rosterCellKey(42, '2026-09-03')]: { weekOff: true, shiftCode: null },
    };

    const saved = mergeSavedRosterChanges(existing, changes);
    expect(getRosterChanges(draft, saved)).toEqual([
      { employeeId: 42, date: '2026-09-03', weekOff: true },
    ]);
  });
});
