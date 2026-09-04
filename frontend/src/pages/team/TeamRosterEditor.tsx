/**
 * Manager roster editor — hours meters, coverage strip, publish, cyclic apply (SHF-03..06).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  EmptyState,
  formatDateIN,
  IconButton,
  SegmentedProgress,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import { DashboardSkeleton } from '../home/DashboardFeedback';
import { currentMonthIST } from '../home/dashboard-format';
import {
  getRosterChanges,
  mergeSavedRosterChanges,
  rosterCellKey,
  type RosterCellDraft,
  type RosterDraft,
} from './roster-draft';
import {
  meterOverCap,
  parseCycleLine,
  shortfallCells,
  type CoverageCell,
  type RosterMeter,
} from './roster-coverage';
import { monthDays, monthRange, monthTitle, moveMonth } from './team-month';

interface ShiftOption {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
}

interface RosterMember {
  employeeId: number;
  ecode: string;
  name: string;
  days: Record<string, { shiftCode: string | null; weekOff: boolean }>;
}

interface PatternRow {
  code: string;
  name: string;
  cycle: { shiftCode: string | null; weekOff: boolean }[];
}

interface Publication {
  published: boolean;
  publishedAt: string | null;
  revision: number | null;
}

function MonthNav({ month, onMonth }: { month: string; onMonth: (next: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Previous month"
        icon={<ChevronLeft />}
        size="sm"
        onClick={() => {
          onMonth(moveMonth(month, -1));
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onMonth(currentMonthIST());
        }}
      >
        This month
      </Button>
      <IconButton
        label="Next month"
        icon={<ChevronRight />}
        size="sm"
        onClick={() => {
          onMonth(moveMonth(month, 1));
        }}
      />
    </div>
  );
}

export function TeamRosterEditor({
  month,
  subtree,
  onMonth,
}: {
  month: string;
  subtree: boolean;
  onMonth: (next: string) => void;
}) {
  const days = useMemo(() => monthDays(month), [month]);
  const range = useMemo(() => monthRange(month), [month]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [draft, setDraft] = useState<RosterDraft>({});
  const [rosterBaseline, setRosterBaseline] = useState<RosterDraft>({});
  const [defaultShift, setDefaultShift] = useState('');
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reason, setReason] = useState('');
  const [meters, setMeters] = useState<RosterMeter[]>([]);
  const [coverage, setCoverage] = useState<CoverageCell[]>([]);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [patternCode, setPatternCode] = useState('');
  const [cycleLine, setCycleLine] = useState('GEN,GEN,GEN,GEN,GEN,GEN,WO');
  const [patternPreview, setPatternPreview] = useState<
    { employeeId: number; date: string; shiftCode: string | null; weekOff: boolean }[] | null
  >(null);
  const [confirmApply, setConfirmApply] = useState(false);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    try {
      const [shiftList, teamRoster, meterList, coverageList, pub, patternList] = await Promise.all([
        apiFetch<ShiftOption[]>('/api/attendance/config/shifts/active'),
        apiFetch<RosterMember[]>(`/api/attendance/roster?month=${month}&subtree=${String(subtree)}`),
        apiFetch<RosterMeter[]>(`/api/attendance/roster/meters?month=${month}&subtree=${String(subtree)}`),
        apiFetch<CoverageCell[]>(
          `/api/attendance/roster/coverage?from=${range.from}&to=${range.to}&subtree=${String(subtree)}`,
        ),
        apiFetch<Publication>(
          `/api/attendance/roster/publication?from=${range.from}&to=${range.to}`,
        ),
        apiFetch<PatternRow[]>('/api/attendance/patterns'),
      ]);
      setShifts(shiftList);
      setRoster(teamRoster);
      setMeters(meterList);
      setCoverage(coverageList);
      setPublication(pub);
      setPatterns(patternList);
      setDefaultShift((prev) => (prev !== '' ? prev : (shiftList[0]?.code ?? '')));
      setPatternCode((prev) => prev !== '' ? prev : (patternList[0]?.code ?? ''));
      const next: RosterDraft = {};
      for (const member of teamRoster) {
        for (const date of Object.keys(member.days)) {
          const cell = member.days[date];
          if (!cell) continue;
          next[rosterCellKey(member.employeeId, date)] = {
            weekOff: cell.weekOff,
            shiftCode: cell.shiftCode,
          };
        }
      }
      setDraft(next);
      setRosterBaseline(next);
    } catch (cause) {
      toast.error('Roster could not load', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setRosterLoading(false);
    }
  }, [month, subtree, range.from, range.to]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const getCell = (employeeId: number, date: string): RosterCellDraft => {
    const key = rosterCellKey(employeeId, date);
    return draft[key] ?? { weekOff: false, shiftCode: null };
  };

  const setCell = (employeeId: number, date: string, value: RosterCellDraft) => {
    setDraft((prev) => ({ ...prev, [rosterCellKey(employeeId, date)]: value }));
  };

  const fillWeekOffsSunday = () => {
    if (!roster.length) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const member of roster) {
        for (const date of days) {
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          if (dow === 0) {
            next[rosterCellKey(member.employeeId, date)] = { weekOff: true, shiftCode: null };
          }
        }
      }
      return next;
    });
    toast.success('Sundays marked week-off in draft');
  };

  const fillDefaultShiftWeekdays = () => {
    if (!defaultShift) {
      toast.error('Pick a default shift first');
      return;
    }
    setDraft((prev) => {
      const next = { ...prev };
      for (const member of roster) {
        for (const date of days) {
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          if (dow !== 0) {
            next[rosterCellKey(member.employeeId, date)] = { weekOff: false, shiftCode: defaultShift };
          }
        }
      }
      return next;
    });
    toast.success(`Weekdays set to ${defaultShift} in draft`);
  };

  const rosterChanges = useMemo(
    () => getRosterChanges(draft, rosterBaseline),
    [draft, rosterBaseline],
  );

  const needsRevisionReason = publication?.published === true && rosterChanges.length > 0;

  const saveRoster = async () => {
    const entries = rosterChanges;
    if (entries.length === 0) {
      toast.error('Nothing to save', { description: 'Edit cells or use bulk fill first.' });
      return;
    }
    if (needsRevisionReason && reason.trim().length < 5) {
      toast.error('Published roster needs a reason', {
        description: 'A change after publish is a dated revision (SHF-05). Name what changed.',
      });
      return;
    }
    setSaving(true);
    try {
      const chunks = Array.from(
        { length: Math.ceil(entries.length / 500) },
        (_, index) => entries.slice(index * 500, index * 500 + 500),
      );
      let total = 0;
      for (const chunk of chunks) {
        const result = await apiFetch<{ upserted: number }>('/api/attendance/roster', {
          method: 'PUT',
          body: JSON.stringify({
            entries: chunk,
            ...(needsRevisionReason ? { reason: reason.trim() } : {}),
          }),
        });
        total += result.upserted;
        setRosterBaseline((current) => mergeSavedRosterChanges(current, chunk));
      }
      toast.success('Roster saved', { description: `${String(total)} day(s) updated` });
      setReason('');
      await loadRoster();
    } catch (cause) {
      toast.error('Roster save failed', {
        description:
          cause instanceof Error
            ? `${cause.message} Saved batches are retained; retry to continue.`
            : 'Saved batches are retained; retry to continue.',
      });
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const result = await apiFetch<{ revision: number; notified: number }>(
        '/api/attendance/roster/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            from: range.from,
            to: range.to,
            subtree,
            ...(reason.trim().length >= 5 ? { reason: reason.trim() } : {}),
          }),
        },
      );
      toast.success(`Roster published · revision ${String(result.revision)}`, {
        description: `${String(result.notified)} people notified. Silent overwrite is now a dated revision.`,
      });
      setReason('');
      await loadRoster();
    } catch (cause) {
      toast.error('Publish failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setPublishing(false);
    }
  };

  const savePattern = async () => {
    const cycle = parseCycleLine(cycleLine);
    if (cycle.length === 0 || patternCode.trim() === '') {
      toast.error('Name a pattern code and a cycle (comma-separated shift codes, WO for week-off).');
      return;
    }
    try {
      await apiFetch(`/api/attendance/patterns/${encodeURIComponent(patternCode.trim())}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: patternCode.trim().toUpperCase(),
          name: patternCode.trim().toUpperCase(),
          cycle,
        }),
      });
      toast.success('Pattern saved');
      await loadRoster();
    } catch (cause) {
      toast.error('Pattern save failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    }
  };

  const dryRunPattern = async () => {
    if (!patternCode) {
      toast.error('Pick or save a pattern first');
      return;
    }
    try {
      const result = await apiFetch<{
        preview: { employeeId: number; date: string; shiftCode: string | null; weekOff: boolean }[];
      }>(`/api/attendance/patterns/${encodeURIComponent(patternCode)}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          code: patternCode,
          from: range.from,
          to: range.to,
          employeeIds: roster.map((m) => m.employeeId),
          dryRun: true,
        }),
      });
      setPatternPreview(result.preview);
      setConfirmApply(true);
    } catch (cause) {
      toast.error('Dry-run failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    }
  };

  const commitPattern = async () => {
    try {
      const result = await apiFetch<{ upserted: number }>(
        `/api/attendance/patterns/${encodeURIComponent(patternCode)}/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            code: patternCode,
            from: range.from,
            to: range.to,
            employeeIds: roster.map((m) => m.employeeId),
            dryRun: false,
            ...(publication?.published ? { reason: reason.trim() || 'Apply cyclic pattern' } : {}),
          }),
        },
      );
      toast.success('Pattern applied', { description: `${String(result.upserted)} day(s)` });
      setConfirmApply(false);
      setPatternPreview(null);
      await loadRoster();
    } catch (cause) {
      toast.error('Pattern apply refused', {
        description: cause instanceof Error ? cause.message : 'The rule, the fail, and who can override are in this message.',
      });
    }
  };

  const gaps = shortfallCells(coverage);
  const hottest = meters.find(meterOverCap) ?? meters[0];

  return (
    <div className="space-y-4">
      <Card rail>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{monthTitle(month)}</h2>
            <p className="text-xs text-ink-muted">
              {String(roster.length)} employees ·{' '}
              {publication?.published
                ? `Published rev ${String(publication.revision ?? 1)}`
                : 'Draft — not yet published'}
            </p>
          </div>
          <MonthNav month={month} onMonth={onMonth} />
        </div>
      </Card>

      {hottest && (
        <Card>
          <CardHeader
            title="Hours this week / this quarter"
            subtitle="SHF-03 — a save over the cap is refused. Labour Codes will replace the defaults at Stage 5.1."
          />
          <SegmentedProgress
            label={
              meterOverCap(hottest)
                ? 'Over cap — save will name the rule'
                : 'Planned hours (hottest person on this grid)'
            }
            primary={hottest.weekHours}
            secondary={hottest.quarterHours}
            total={hottest.quarterCap}
          />
        </Card>
      )}

      {gaps.length > 0 && (
        <Card>
          <CardHeader
            title="Coverage shortfall"
            subtitle="Sanctioned vs remaining after leave. Click a number — the grid is the list."
          />
          <ul className="flex flex-wrap gap-2">
            {gaps.map((cell) => (
              <li key={`${cell.date}|${cell.shiftCode}`}>
                <StatusBadge tone="negative">
                  {formatDateIN(cell.date)} {cell.shiftCode} · short {String(cell.shortfall)} (left {String(cell.remaining)} / {String(cell.sanctioned)})
                </StatusBadge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Roster editor"
          subtitle="Bulk-assign, then publish. Writes recompute dirty days (ATT-04 · SHF-05)."
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={publishing}
                onClick={() => void publish()}
              >
                Publish month
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={saving}
                disabled={rosterChanges.length === 0}
                leadingIcon={<Save className="size-4" />}
                onClick={() => void saveRoster()}
              >
                Save roster{rosterChanges.length > 0 ? ` (${String(rosterChanges.length)})` : ''}
              </Button>
            </div>
          }
        />
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-ink">
            <span className="mb-1 block text-xs font-semibold text-ink-muted">Default shift</span>
            <select
              className="rounded-row border border-line bg-surface px-3 py-2 text-sm"
              value={defaultShift}
              onChange={(e) => {
                setDefaultShift(e.currentTarget.value);
              }}
            >
              {shifts.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.name} ({s.startTime}–{s.endTime})
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="secondary" onClick={fillDefaultShiftWeekdays}>
            Fill weekdays
          </Button>
          <Button size="sm" variant="secondary" onClick={fillWeekOffsSunday}>
            Sundays → week-off
          </Button>
          <Button size="sm" variant="ghost" loading={rosterLoading} onClick={() => void loadRoster()}>
            Reload
          </Button>
        </div>

        {(needsRevisionReason || publication?.published) && (
          <div className="mb-4">
            <TextField
              label="Revision / publish reason"
              value={reason}
              hint={
                needsRevisionReason
                  ? 'This month is published. The save is a dated revision and needs a reason (min 5 characters).'
                  : 'Optional note stored on the publication.'
              }
              onChange={(event) => {
                setReason(event.currentTarget.value);
              }}
            />
          </div>
        )}

        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <TextField
            label="Cyclic pattern (comma cycle)"
            value={cycleLine}
            hint="GEN,GEN,GEN,GEN,GEN,GEN,WO — save, dry-run, then confirm."
            onChange={(event) => {
              setCycleLine(event.currentTarget.value);
              setPatternCode((prev) => (prev === '' ? 'ROTATE' : prev));
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => void savePattern()}>
            Save pattern
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void dryRunPattern()}>
            Dry-run apply
          </Button>
        </div>
        {patterns.length > 0 && (
          <label className="mb-4 block text-sm text-ink">
            <span className="mb-1 block text-xs font-semibold text-ink-muted">Saved pattern</span>
            <select
              className="rounded-row border border-line bg-surface px-3 py-2 text-sm"
              value={patternCode}
              onChange={(e) => {
                setPatternCode(e.currentTarget.value);
              }}
            >
              {patterns.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {rosterLoading ? (
          <DashboardSkeleton />
        ) : roster.length === 0 ? (
          <EmptyState
            icon={<CalendarRange />}
            title="No team members"
            description="Assign reporting relationships, then reload."
          />
        ) : (
          <div className="overflow-auto">
            <div className="min-w-max">
              <div
                className="sticky top-0 z-10 grid bg-surface-2 text-xs text-ink-muted"
                style={{ gridTemplateColumns: `200px repeat(${String(days.length)}, 72px)` }}
              >
                <div className="sticky left-0 z-20 bg-surface-2 px-3 py-2 font-semibold">
                  Employee
                </div>
                {days.map((date) => (
                  <div key={date} className="grid place-items-center py-2 tabular-nums">
                    {Number(date.slice(-2))}
                  </div>
                ))}
              </div>
              {roster.map((member) => {
                const meter = meters.find((m) => m.employeeId === member.employeeId);
                return (
                  <div
                    key={member.employeeId}
                    className="grid border-t border-line/50"
                    style={{ gridTemplateColumns: `200px repeat(${String(days.length)}, 72px)` }}
                  >
                    <div className="sticky left-0 z-10 bg-surface px-3 py-2">
                      <Link
                        to={`/people/${member.ecode}`}
                        className="block min-w-0 rounded-row outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                        <p className="text-xs text-ink-muted">
                          {member.ecode} · #{String(member.employeeId)}
                          {meter
                            ? ` · ${String(meter.weekHours)}h / ${String(meter.weekCap)}h wk`
                            : ''}
                        </p>
                      </Link>
                    </div>
                    {days.map((date) => {
                      const cell = getCell(member.employeeId, date);
                      return (
                        <div key={date} className="grid place-items-center p-1">
                          <select
                            className="w-full rounded-[8px] border border-line bg-surface px-1 py-1 text-[10px]"
                            value={cell.weekOff ? 'WO' : (cell.shiftCode ?? '')}
                            onChange={(e) => {
                              const value = e.currentTarget.value;
                              if (value === 'WO') {
                                setCell(member.employeeId, date, { weekOff: true, shiftCode: null });
                              } else if (value === '') {
                                setCell(member.employeeId, date, { weekOff: false, shiftCode: null });
                              } else {
                                setCell(member.employeeId, date, { weekOff: false, shiftCode: value });
                              }
                            }}
                            aria-label={`Roster ${member.ecode} ${date}`}
                          >
                            <option value="">—</option>
                            <option value="WO">WO</option>
                            {shifts.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.code}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirmApply}
        onClose={() => {
          setConfirmApply(false);
        }}
        onConfirm={() => {
          void commitPattern();
        }}
        title="Apply cyclic pattern"
        description={
          patternPreview === null
            ? 'No preview.'
            : `Dry-run will write ${String(patternPreview.length)} employee-days. Overlap, rest and hours-cap checks run on commit.`
        }
        confirmLabel="Commit pattern"
      />
    </div>
  );
}
