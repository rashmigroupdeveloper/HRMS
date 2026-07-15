/**
 * Roster editor (ATT-04) — paint-mode: pick a brush (a shift from the
 * manager-readable catalog, or week-off), tap days, save once. The bulk write
 * auto-dirties recompute, so painted days re-derive their status within a
 * minute. Locked/manual days are protected server-side.
 */
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, Drawer, Skeleton, StatusBadge, toast } from '../../ui';
import { cn } from '../../ui';

interface CatalogShift {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
}

interface RosterEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee: { employeeId: number; name: string; ecode: string } | null;
  month: string; // YYYY-MM
}

function daysOf(month: string): string[] {
  const [year = 0, number = 1] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
}

const WEEK_OFF = '__WO__';

export function RosterEditorDrawer({ open, onClose, onSaved, employee, month }: RosterEditorDrawerProps) {
  const [catalog, setCatalog] = useState<CatalogShift[] | null>(null);
  const [brush, setBrush] = useState<string | null>(null);
  const [painted, setPainted] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => daysOf(month), [month]);

  useEffect(() => {
    if (!open) return;
    setPainted({});
    if (catalog === null) {
      apiFetch<CatalogShift[]>('/api/attendance/roster/shift-catalog')
        .then((rows) => {
          setCatalog(rows);
          setBrush(rows[0]?.code ?? null);
        })
        .catch(() => {
          toast.error('Shift catalog failed to load', { description: 'Roster editing needs the active shift list.' });
        });
    }
  }, [open, catalog]);

  const paint = (date: string) => {
    if (!brush) return;
    setPainted((previous) => {
      if (previous[date] === brush) {
        return Object.fromEntries(Object.entries(previous).filter(([key]) => key !== date));
      }
      return { ...previous, [date]: brush };
    });
  };

  const save = async () => {
    if (!employee) return;
    const entries = Object.entries(painted).map(([date, value]) => ({
      employeeId: employee.employeeId,
      date,
      ...(value === WEEK_OFF ? { weekOff: true } : { shiftCode: value, weekOff: false }),
    }));
    if (entries.length === 0) {
      toast.error('Nothing painted yet', { description: 'Pick a brush and tap the days to change.' });
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<{ upserted: number }>('/api/attendance/roster', {
        method: 'PUT',
        body: JSON.stringify({ entries }),
      });
      toast.success(`Roster updated — ${String(result.upserted)} day(s)`, {
        description: 'Statuses recompute automatically within a minute.',
      });
      setPainted({});
      onSaved();
      onClose();
    } catch (cause) {
      toast.error('Roster save failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={employee ? `Roster · ${employee.name}` : 'Roster'}
      subtitle={employee ? `${employee.ecode} · ${month} — tap days to paint, tap again to unpaint` : undefined}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">{String(Object.keys(painted).length)} day(s) staged</p>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Save roster
          </Button>
        </div>
      }
      width={520}
    >
      {catalog === null ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Brush</p>
            <div className="flex flex-wrap gap-2">
              {catalog.map((shift) => (
                <button
                  key={shift.code}
                  type="button"
                  onClick={() => {
                    setBrush(shift.code);
                  }}
                  className={cn(
                    'u-press rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    brush === shift.code ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink hover:bg-accent-soft',
                  )}
                  title={`${shift.startTime}–${shift.endTime}${shift.crossesMidnight ? ' (+1d)' : ''}`}
                >
                  {shift.code}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setBrush(WEEK_OFF);
                }}
                className={cn(
                  'u-press rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  brush === WEEK_OFF ? 'bg-accent text-accent-ink' : 'u-hatch bg-surface-2 text-ink-muted hover:bg-accent-soft',
                )}
              >
                Week-off
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{month}</p>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((date) => {
                const value = painted[date];
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => {
                      paint(date);
                    }}
                    className={cn(
                      'u-press grid h-12 place-items-center rounded-row text-xs font-semibold transition-colors',
                      value ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink hover:bg-accent-soft',
                    )}
                    aria-pressed={Boolean(value)}
                    title={value ? `${date} → ${value === WEEK_OFF ? 'Week-off' : value}` : date}
                  >
                    <span>
                      {Number(date.slice(-2))}
                      {value && <span className="block text-[9px] font-medium opacity-80">{value === WEEK_OFF ? 'WO' : value}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="info">Painted days overwrite the roster for this employee</StatusBadge>
            <StatusBadge tone="neutral">Unpainted days keep their scheme default</StatusBadge>
          </div>
        </div>
      )}
    </Drawer>
  );
}
