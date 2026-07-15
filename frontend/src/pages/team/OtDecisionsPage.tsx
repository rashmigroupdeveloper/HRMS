/**
 * OT decisions (ATT-08, PP-19) — the manager console behind the 18:00 digest.
 * Undecided entries LAPSE at the deadline, so the clock is the loudest column.
 * Decisions: approve (full or partial minutes), reject, convert to comp-off —
 * money XOR comp-off is a database constraint, mirrored here as one choice.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlarmClock, Check, Repeat, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Button, Card, DataTable, Drawer, EmptyState, StatusBadge, TextField, toast } from '../../ui';
import type { Column } from '../../ui';

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

function hoursLeft(deadline: string): number {
  return Math.floor((new Date(deadline).getTime() - Date.now()) / 3600_000);
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const left = hoursLeft(deadline);
  if (left < 0) return <StatusBadge tone="negative">overdue</StatusBadge>;
  if (left <= 8) return <StatusBadge tone="negative">{`${String(left)}h left`}</StatusBadge>;
  if (left <= 24) return <StatusBadge tone="warning">{`${String(left)}h left`}</StatusBadge>;
  return <StatusBadge tone="neutral">{`${String(left)}h left`}</StatusBadge>;
}

export function OtDecisionsPage() {
  const [rows, setRows] = useState<OtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OtEntry | null>(null);
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<OtEntry[]>('/api/attendance/ot/pending'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load pending OT');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (action: 'approve' | 'reject' | 'convert_comp_off') => {
    if (!selected) return;
    const partial = minutes.trim();
    if (action !== 'reject' && partial && (!/^\d+$/.test(partial) || Number(partial) <= 0 || Number(partial) > selected.claimedMinutes)) {
      toast.error('Invalid minutes', { description: `Enter 1–${String(selected.claimedMinutes)} or leave blank for the full claim.` });
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/attendance/ot/decide', {
        method: 'POST',
        body: JSON.stringify({
          entryId: selected.id,
          action,
          ...(action !== 'reject' && partial ? { approvedMinutes: Number(partial) } : {}),
        }),
      });
      const labels = { approve: 'approved', reject: 'rejected', convert_comp_off: 'converted to comp-off' } as const;
      toast.success(`Overtime ${labels[action]}`, { description: `Employee #${String(selected.employeeId)} · ${selected.workDate}` });
      setSelected(null);
      setMinutes('');
      await load();
    } catch (cause) {
      toast.error('Decision failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<OtEntry>[] = [
    { key: 'emp', header: 'Employee #', width: '110px', render: (row) => String(row.employeeId) },
    { key: 'date', header: 'Work date', width: '120px', render: (row) => row.workDate },
    { key: 'detected', header: 'Detected min', width: '110px', numeric: true, render: (row) => row.detectedMinutes },
    { key: 'claimed', header: 'Claimed min', width: '110px', numeric: true, render: (row) => row.claimedMinutes },
    { key: 'deadline', header: 'Decide within', width: '130px', render: (row) => <DeadlineBadge deadline={row.deadlineAt} /> },
    {
      key: 'via',
      header: 'Routed',
      width: '120px',
      render: (row) => (row.workflowRequestId ? 'workflow' : 'direct'),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Manager workspace · ATT-08</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">Overtime decisions</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Undecided entries lapse at the 48-hour mark — a lapse pays nothing and credits nothing.
        </p>
      </header>

      {error && (
        <Card>
          <EmptyState icon={<AlarmClock />} title="Could not load" description={error} action={<Button onClick={() => void load()}>Retry</Button>} />
        </Card>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          setSelected(row);
          setMinutes('');
        }}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<AlarmClock />}
            title={loading ? 'Loading…' : 'Nothing waiting on you'}
            description="New overtime appears here the moment the swipes show it."
          />
        }
      />

      <Drawer
        open={selected !== null}
        onClose={() => {
          setSelected(null);
        }}
        title={selected ? `OT · employee #${String(selected.employeeId)}` : ''}
        subtitle={selected ? `${selected.workDate} · detected ${String(selected.detectedMinutes)} min · claimed ${String(selected.claimedMinutes)} min` : undefined}
      >
        {selected && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-muted">Deadline</p>
                <DeadlineBadge deadline={selected.deadlineAt} />
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                After the deadline the entry lapses automatically (the hard 48-hour rule).
              </p>
            </Card>

            <TextField
              label="Approved minutes (blank = full claim)"
              value={minutes}
              hint={`1–${String(selected.claimedMinutes)} — partial approval writes the smaller figure`}
              onChange={(event) => {
                setMinutes(event.currentTarget.value);
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" loading={busy} leadingIcon={<Check className="size-4" />} onClick={() => void decide('approve')}>
                Approve as OT pay
              </Button>
              <Button variant="ghost" loading={busy} leadingIcon={<Repeat className="size-4" />} onClick={() => void decide('convert_comp_off')}>
                Convert to comp-off
              </Button>
              <Button variant="ghost" loading={busy} leadingIcon={<X className="size-4" />} onClick={() => void decide('reject')}>
                Reject
              </Button>
            </div>
            <p className="text-xs text-ink-muted">
              Pay or comp-off, never both — the ledger enforces it; comp-off credits expire per policy.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
