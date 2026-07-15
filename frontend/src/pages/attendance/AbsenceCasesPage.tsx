/**
 * Absence-case queue (ATT-10/11, PP-7) — the HR side of the automated
 * vigilance: watch → show_cause → warning → termination_review. Escalation is
 * a deliberate, audited action; the show-cause/warning letter is issued FROM
 * the case and rides the signature chain.
 */
import { useCallback, useEffect, useState } from 'react';
import { FileWarning, ShieldAlert, UserMinus } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import {
  Button,
  Card,
  ConfirmModal,
  DataTable,
  Drawer,
  EmptyState,
  Select,
  StatusBadge,
  Switch,
  TextField,
  toast,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';

interface CaseRow {
  id: number;
  employeeId: number;
  ecode: string;
  name: string;
  startDate: string;
  daysAbsent: number;
  stage: string;
  letterId: number | null;
  resolution: string | null;
  closedAt: string | null;
}

const STAGE_TONE: Record<string, StatusTone> = {
  watch: 'info',
  show_cause: 'negative',
  warning: 'negative',
  termination_review: 'negative',
};

export function AbsenceCasesPage({ user }: { user: SessionUser }) {
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CaseRow | null>(null);
  const [confirmStage, setConfirmStage] = useState<'warning' | 'termination_review' | null>(null);
  const [letterTemplate, setLetterTemplate] = useState<'show_cause' | 'warning'>('show_cause');
  const [responseDays, setResponseDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const canAct = hasPermission(user, 'letters.issue');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<CaseRow[]>(`/api/attendance/absence-cases?open=${String(onlyOpen)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [onlyOpen]);

  useEffect(() => {
    void load();
  }, [load]);

  const escalate = async (stage: 'warning' | 'termination_review') => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiFetch(`/api/attendance/absence-cases/${String(selected.id)}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
      });
      toast.success(`Case escalated to ${stage.replace('_', ' ')}`, { description: `${selected.name} (${selected.ecode})` });
      setConfirmStage(null);
      setSelected(null);
      await load();
    } catch (cause) {
      toast.error('Escalation failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const issueLetter = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ letterId: number; workflowRequestId: number | null }>(
        `/api/attendance/absence-cases/${String(selected.id)}/letter`,
        {
          method: 'POST',
          body: JSON.stringify({
            template: letterTemplate,
            ...(letterTemplate === 'show_cause' && /^\d+$/.test(responseDays)
              ? { responseDays: Number(responseDays) }
              : {}),
          }),
        },
      );
      toast.success('Letter drafted into the signature chain', {
        description: `Letter #${String(result.letterId)} — issues on final approval (PP-14).`,
      });
      setSelected(null);
      await load();
    } catch (cause) {
      toast.error('Letter failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<CaseRow>[] = [
    {
      key: 'who',
      header: 'Employee',
      width: 'minmax(180px,1.4fr)',
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.name}</p>
          <p className="text-xs text-ink-muted">{row.ecode}</p>
        </div>
      ),
    },
    { key: 'since', header: 'Absent since', width: '120px', render: (row) => row.startDate },
    { key: 'days', header: 'Days', width: '80px', numeric: true, render: (row) => row.daysAbsent },
    {
      key: 'stage',
      header: 'Stage',
      width: '160px',
      render: (row) => <StatusBadge tone={STAGE_TONE[row.stage] ?? 'neutral'}>{row.stage.replace('_', ' ')}</StatusBadge>,
    },
    {
      key: 'letter',
      header: 'Letter',
      width: '110px',
      render: (row) => (row.letterId ? `#${String(row.letterId)}` : '—'),
    },
    {
      key: 'state',
      header: 'Case',
      width: '130px',
      render: (row) =>
        row.closedAt ? <StatusBadge tone="positive">{row.resolution ?? 'closed'}</StatusBadge> : <StatusBadge tone="neutral">open</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Attendance ops · ATT-10 / PP-7</p>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">Absence cases</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Opened automatically by the daily scan; letters and escalations stay human decisions.
          </p>
        </div>
        <Switch
          label="Open cases only"
          checked={onlyOpen}
          onChange={(event) => {
            setOnlyOpen(event.currentTarget.checked);
          }}
        />
      </header>

      {error && (
        <Card>
          <EmptyState icon={<ShieldAlert />} title="Could not load cases" description={error} action={<Button onClick={() => void load()}>Retry</Button>} />
        </Card>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        {...(canAct
          ? {
              onRowClick: (row: CaseRow) => {
                if (!row.closedAt) setSelected(row);
              },
            }
          : {})}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<UserMinus />}
            title={loading ? 'Loading…' : 'No cases'}
            description={onlyOpen ? 'Nobody is in a continuous-absence case right now.' : 'No case history yet.'}
          />
        }
      />

      <Drawer
        open={selected !== null}
        onClose={() => {
          setSelected(null);
        }}
        title={selected ? `${selected.name} (${selected.ecode})` : ''}
        subtitle={selected ? `Absent since ${selected.startDate} · ${String(selected.daysAbsent)} days · stage ${selected.stage}` : undefined}
      >
        {selected && (
          <div className="space-y-6">
            <Card>
              <h3 className="text-sm font-semibold text-ink">Issue letter through the system</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Drafts against the case, walks hr_ops → hr_head, and is archived on the employee (CORE-09).
              </p>
              <div className="mt-4 space-y-4">
                <Select
                  label="Template"
                  value={letterTemplate}
                  options={[
                    { value: 'show_cause', label: 'Show-cause notice', description: 'Continuous absence — reply within N days' },
                    { value: 'warning', label: 'Warning letter' },
                  ]}
                  onChange={(value) => {
                    setLetterTemplate(value as 'show_cause' | 'warning');
                  }}
                />
                {letterTemplate === 'show_cause' && (
                  <TextField
                    label="Response window (days)"
                    value={responseDays}
                    error={/^\d+$/.test(responseDays) ? undefined : 'Numbers only'}
                    onChange={(event) => {
                      setResponseDays(event.currentTarget.value);
                    }}
                  />
                )}
                <Button variant="primary" loading={busy} leadingIcon={<FileWarning className="size-4" />} onClick={() => void issueLetter()}>
                  Draft letter
                </Button>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-ink">Escalate (forward-only, audited)</h3>
              <p className="mt-1 text-xs text-ink-muted">PP-7 keeps these human: no automatic warnings or terminations.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" disabled={selected.stage !== 'show_cause'} onClick={() => { setConfirmStage('warning'); }}>
                  Move to warning
                </Button>
                <Button variant="ghost" disabled={selected.stage !== 'warning'} onClick={() => { setConfirmStage('termination_review'); }}>
                  Move to termination review
                </Button>
              </div>
            </Card>
          </div>
        )}
      </Drawer>

      <ConfirmModal
        open={confirmStage !== null}
        danger
        title={confirmStage === 'warning' ? 'Escalate to warning?' : 'Escalate to termination review?'}
        description={
          selected
            ? `${selected.name} (${selected.ecode}) — this stage change is forward-only and lands in the audit log.`
            : ''
        }
        confirmLabel="Escalate"
        onConfirm={() => {
          if (confirmStage) void escalate(confirmStage);
        }}
        onClose={() => {
          setConfirmStage(null);
        }}
      />
    </div>
  );
}
