/**
 * OT decisions (ATT-08, PP-19) — the manager console behind the 18:00 digest.
 * Undecided entries LAPSE at the deadline, so the clock is the loudest column.
 * Decisions: approve (full or partial minutes), reject, convert to comp-off —
 * money XOR comp-off is a database constraint, mirrored here as one choice.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlarmClock, Check, Repeat, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  EmptyState,
  formatDateIN,
  PageHeader,
  Pill,
  Skeleton,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { StatusTone } from '../../ui';

interface OtEntry {
  id: number;
  employeeId: number;
  workDate: string;
  detectedMinutes: number;
  claimedMinutes: number;
  approvedMinutes: number | null;
  status: string;
  deadlineAt: string;
  decidedAt: string | null;
  workflowRequestId: number | null;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  if (rest === 0) return `${String(hours)}h`;
  return `${String(hours)}h ${String(rest).padStart(2, '0')}m`;
}

function lapseCopy(deadline: string): { label: string; tone: StatusTone } {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) {
    return { label: 'Lapsed — pays nothing', tone: 'negative' };
  }
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) {
    const mins = Math.max(1, Math.round(ms / 60_000));
    return { label: `Lapses in ${String(mins)}m`, tone: 'negative' };
  }
  const tone: StatusTone = hours <= 8 ? 'negative' : hours <= 24 ? 'warning' : 'neutral';
  return { label: `Lapses in ${String(hours)}h`, tone };
}

function mismatchNote(entry: OtEntry): string | null {
  const delta = entry.claimedMinutes - entry.detectedMinutes;
  if (delta === 0) return null;
  if (delta > 0) return `Claim is ${formatDuration(delta)} above swipe detection.`;
  return `Claim is ${formatDuration(Math.abs(delta))} below swipe detection.`;
}

export function OtDecisionsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );

  const nearest = rows[0] ?? null;
  const nearestLapse = nearest ? lapseCopy(nearest.deadlineAt) : null;

  const adoptQueue = useCallback((next: OtEntry[], preferId: number | null) => {
    const focus =
      (preferId !== null ? next.find((row) => row.id === preferId) : undefined) ?? next[0] ?? null;
    setRows(next);
    setSelectedId(focus?.id ?? null);
    setMinutes(focus ? String(focus.claimedMinutes) : '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      adoptQueue(await apiFetch<OtEntry[]>('/api/attendance/ot/pending'), selectedIdRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load pending OT');
    } finally {
      setLoading(false);
    }
  }, [adoptQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEntry = (row: OtEntry) => {
    setSelectedId(row.id);
    setMinutes(String(row.claimedMinutes));
  };

  const decide = async (action: 'approve' | 'reject' | 'convert_comp_off') => {
    if (!selected) return;
    const partial = minutes.trim();
    if (
      action !== 'reject' &&
      (!/^\d+$/.test(partial) || Number(partial) <= 0 || Number(partial) > selected.claimedMinutes)
    ) {
      toast.error('Invalid minutes', {
        description: `Enter 1–${String(selected.claimedMinutes)}. Defaults to the full claim.`,
      });
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/attendance/ot/decide', {
        method: 'POST',
        body: JSON.stringify({
          entryId: selected.id,
          action,
          ...(action !== 'reject' && Number(partial) !== selected.claimedMinutes
            ? { approvedMinutes: Number(partial) }
            : {}),
        }),
      });
      const labels = {
        approve: 'approved',
        reject: 'rejected',
        convert_comp_off: 'converted to comp-off',
      } as const;
      toast.success(`Overtime ${labels[action]}`, {
        description: `Employee #${String(selected.employeeId)} · ${formatDateIN(selected.workDate)}`,
      });
      adoptQueue(await apiFetch<OtEntry[]>('/api/attendance/ot/pending'), null);
    } catch (cause) {
      toast.error('Decision failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const selectedLapse = selected ? lapseCopy(selected.deadlineAt) : null;
  const selectedMismatch = selected ? mismatchNote(selected) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manager workspace · ATT-08"
        title="Overtime decisions"
        description={
          nearestLapse
            ? `${String(rows.length)} waiting. Nearest ${nearestLapse.label.toLowerCase()} — a lapse pays nothing and credits nothing.`
            : 'Undecided overtime lapses at 48 hours. They already worked the extra; your decision is how it is honoured.'
        }
      />

      {error && (
        <Card role="alert" aria-live="assertive">
          <EmptyState
            icon={<AlarmClock />}
            title="Could not load overtime"
            description={error}
            action={<Button onClick={() => void load()}>Retry</Button>}
          />
        </Card>
      )}

      {loading && !error && (
        <div role="status" className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Loading overtime">
          <Skeleton variant="block" className="h-72 rounded-card" />
          <Skeleton variant="block" className="h-72 rounded-card" />
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <Card>
          <EmptyState
            icon={<Check />}
            title="All caught up"
            description="Nothing waiting. New overtime lands here after the 18:00 digest — you have already honoured what they worked."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  void navigate('/my/team');
                }}
              >
                Back to my team
              </Button>
            }
          />
        </Card>
      )}

      {!loading && !error && selected && selectedLapse && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card padded={false} className="order-2 lg:order-1">
            <div className="p-5">
              <CardHeader
                title="Waiting on you"
                subtitle="Nearest deadline first — the 48-hour rule is real."
              />
            </div>
            <div className="max-h-[560px] overflow-auto">
              {rows.map((row) => {
                const lapse = lapseCopy(row.deadlineAt);
                const active = row.id === selected.id;
                return (
                  <div
                    key={row.id}
                    className={`flex items-start gap-3 px-5 py-4 ${
                      active ? 'bg-accent-soft' : 'hover:bg-accent-soft'
                    }`}
                  >
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => {
                        openEntry(row);
                      }}
                      className="min-w-0 flex-1 rounded-row text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <p className="text-sm font-semibold text-ink">
                        Employee #{String(row.employeeId)}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatDateIN(row.workDate)} · detected {formatDuration(row.detectedMinutes)}{' '}
                        · claimed {formatDuration(row.claimedMinutes)}
                      </p>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge tone={lapse.tone}>{lapse.label}</StatusBadge>
                      {row.workflowRequestId !== null && (
                        <Link
                          to={`/approvals/${String(row.workflowRequestId)}`}
                          className="text-xs font-medium text-ink underline-offset-2 hover:underline"
                        >
                          Approvals
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2">
            <DarkCard>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-hero-muted">
                    Employee #{String(selected.employeeId)}
                  </p>
                  <h2 className="mt-3 text-3xl font-light tracking-tight">
                    {formatDuration(selected.claimedMinutes)}
                  </h2>
                  <p className="mt-1 text-sm text-hero-muted">
                    claimed for {formatDateIN(selected.workDate)} — already worked past the rostered end.
                  </p>
                </div>
                <StatusBadge tone={selectedLapse.tone}>{selectedLapse.label}</StatusBadge>
              </div>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
                  <dt className="text-xs text-hero-muted">Detected from swipes</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-hero-ink">
                    {formatDuration(selected.detectedMinutes)}
                  </dd>
                </div>
                <div className="rounded-tile bg-[color-mix(in_srgb,var(--surface)_9%,transparent)] p-4">
                  <dt className="text-xs text-hero-muted">Claimed</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-hero-ink">
                    {formatDuration(selected.claimedMinutes)}
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-sm leading-6 text-hero-muted">
                {selectedMismatch ?? 'Claim matches swipe detection.'} After the deadline this
                entry lapses automatically — pay and comp-off both become zero.
              </p>
              {selected.workflowRequestId !== null && (
                <Link
                  to={`/approvals/${String(selected.workflowRequestId)}`}
                  className="mt-4 inline-block text-sm text-hero-ink underline-offset-2 hover:underline"
                >
                  View the routed approval
                </Link>
              )}
            </DarkCard>

            <Card>
              <TextField
                label="Minutes to honour"
                value={minutes}
                inputMode="numeric"
                hint={`Starts at the full claim (${formatDuration(selected.claimedMinutes)}). Lower it only to approve part.`}
                onChange={(event) => {
                  setMinutes(event.currentTarget.value);
                }}
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  loading={busy}
                  leadingIcon={<Check className="size-4" />}
                  onClick={() => void decide('approve')}
                >
                  Approve as OT pay
                </Button>
                <Button
                  variant="ghost"
                  loading={busy}
                  leadingIcon={<Repeat className="size-4" />}
                  onClick={() => void decide('convert_comp_off')}
                >
                  Convert to comp-off
                </Button>
                <Button
                  variant="ghost"
                  loading={busy}
                  leadingIcon={<X className="size-4" />}
                  onClick={() => void decide('reject')}
                >
                  Reject
                </Button>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Pay or rest, never both — the ledger enforces it. Comp-off credits expire per
                policy.
              </p>
              {selected.workflowRequestId !== null && (
                <div className="mt-3">
                  <Pill>Routed through workflow</Pill>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
