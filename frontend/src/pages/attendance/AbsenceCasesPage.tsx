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
  DarkCard,
  DataTable,
  Drawer,
  EmptyState,
  KpiNumber,
  PageHeader,
  Select,
  StatusBadge,
  Switch,
  TextField,
  formatDateIN,
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

const STAGE_LABEL: Record<string, string> = {
  watch: 'Watch',
  show_cause: 'Show-cause',
  warning: 'Warning',
  termination_review: 'Termination review',
};

const STAGE_TONE: Record<string, StatusTone> = {
  watch: 'info',
  show_cause: 'warning',
  warning: 'negative',
  termination_review: 'negative',
};

function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage.replaceAll('_', ' ');
}

function stageTone(stage: string): StatusTone {
  return STAGE_TONE[stage] ?? 'neutral';
}

type NextKind = 'letter' | 'escalate-warning' | 'escalate-termination' | 'wait';

function nextAction(row: CaseRow): { title: string; body: string; kind: NextKind } {
  if (row.stage === 'watch') {
    return {
      title: 'Stay on watch',
      body: 'The daily scan moves this case to show-cause at the configured day count. Regularise the missing days to close it.',
      kind: 'wait',
    };
  }
  if (row.stage === 'show_cause' && row.letterId === null) {
    return {
      title: 'Draft the show-cause notice',
      body: 'Issue the letter through the signature chain. Escalation waits until this is on record.',
      kind: 'letter',
    };
  }
  if (row.stage === 'show_cause') {
    return {
      title: 'Escalate to warning',
      body: 'Show-cause is on file. Moving forward is a deliberate, audited human step — never automatic.',
      kind: 'escalate-warning',
    };
  }
  if (row.stage === 'warning' && row.letterId === null) {
    return {
      title: 'Draft the warning letter',
      body: 'A warning through the chain should land before termination review.',
      kind: 'letter',
    };
  }
  if (row.stage === 'warning') {
    return {
      title: 'Move to termination review',
      body: 'Forward-only. This is the last attendance-ops stage before separation handling.',
      kind: 'escalate-termination',
    };
  }
  return {
    title: 'In termination review',
    body: 'No further attendance-ops step. Separation continues on the lifecycle path.',
    kind: 'wait',
  };
}

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
  const needsLetter = rows.filter(
    (row) => row.closedAt === null && row.letterId === null && (row.stage === 'show_cause' || row.stage === 'warning'),
  ).length;
  const openCount = rows.filter((row) => row.closedAt === null).length;
  const selectedNext = selected ? nextAction(selected) : null;

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
      toast.success(`Case escalated to ${stageLabel(stage)}`, { description: `${selected.name} (${selected.ecode})` });
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

  const openCase = (row: CaseRow) => {
    if (row.closedAt) return;
    setSelected(row);
    setLetterTemplate(row.stage === 'warning' ? 'warning' : 'show_cause');
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
    {
      key: 'since',
      header: 'Absent since',
      width: '140px',
      render: (row) => formatDateIN(row.startDate.slice(0, 10)),
    },
    { key: 'days', header: 'Days', width: '80px', numeric: true, render: (row) => row.daysAbsent },
    {
      key: 'stage',
      header: 'Stage',
      width: '170px',
      render: (row) => <StatusBadge tone={stageTone(row.stage)}>{stageLabel(row.stage)}</StatusBadge>,
    },
    {
      key: 'next',
      header: 'Next action',
      width: 'minmax(160px,1fr)',
      render: (row) =>
        row.closedAt ? (
          <span className="text-ink-muted">Closed</span>
        ) : (
          <span className="font-medium text-ink">{nextAction(row).title}</span>
        ),
    },
    {
      key: 'letter',
      header: 'Letter',
      width: '110px',
      render: (row) => (row.letterId ? `#${String(row.letterId)}` : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance ops · ATT-10 / PP-7"
        title="Absence cases"
        description="Opened automatically by the daily scan; letters and escalations stay human decisions."
        actions={
          <Switch
            label="Open cases only"
            checked={onlyOpen}
            onChange={(event) => {
              setOnlyOpen(event.currentTarget.checked);
            }}
          />
        }
      />

      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          Letters still owed
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-4xl font-light tabular-nums">
              <KpiNumber value={needsLetter} animateOnMount={false} />
            </p>
            <p className="mt-1 text-sm text-hero-muted">
              {needsLetter
                ? `of ${String(openCount)} open cases still need a show-cause or warning letter`
                : openCount
                  ? `${String(openCount)} open cases — letters are on file. Escalation stays a human click.`
                  : 'open cases needing a letter. The watch queue is clear.'}
            </p>
          </div>
          <StatusBadge tone={needsLetter ? 'negative' : 'positive'}>
            {needsLetter ? 'Action required' : 'Queue clear'}
          </StatusBadge>
        </div>
      </DarkCard>

      {error && (
        <Card>
          <EmptyState
            icon={<ShieldAlert />}
            title="Could not load cases"
            description={error}
            action={<Button onClick={() => void load()}>Retry</Button>}
          />
        </Card>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        selectedKey={selected ? String(selected.id) : undefined}
        {...(canAct
          ? {
              onRowClick: (row: CaseRow) => {
                openCase(row);
              },
            }
          : {})}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<UserMinus />}
            title={loading ? 'Loading…' : onlyOpen ? 'No open cases' : 'No case history'}
            description={
              loading
                ? 'Reading the absence queue.'
                : onlyOpen
                  ? 'Nobody is in a continuous-absence case right now.'
                  : 'The daily scan has not opened a case yet.'
            }
            action={
              loading ? undefined : onlyOpen ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setOnlyOpen(false);
                  }}
                >
                  Show closed cases
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Drawer
        open={selected !== null}
        onClose={() => {
          setSelected(null);
        }}
        title={selected ? `${selected.name} (${selected.ecode})` : ''}
        subtitle={
          selected
            ? `Absent since ${formatDateIN(selected.startDate.slice(0, 10))} · ${String(selected.daysAbsent)} days · ${stageLabel(selected.stage)}`
            : undefined
        }
      >
        {selected && selectedNext && (
          <div className="space-y-6">
            <Card>
              <p className="text-xs font-medium text-ink-muted">Next action</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selectedNext.title}</h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{selectedNext.body}</p>
              {selectedNext.kind === 'escalate-warning' && (
                <div className="mt-4">
                  <Button variant="primary" onClick={() => { setConfirmStage('warning'); }}>
                    {selectedNext.title}
                  </Button>
                </div>
              )}
              {selectedNext.kind === 'escalate-termination' && (
                <div className="mt-4">
                  <Button variant="primary" onClick={() => { setConfirmStage('termination_review'); }}>
                    {selectedNext.title}
                  </Button>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-ink">
                {selectedNext.kind === 'letter' ? selectedNext.title : 'Issue a letter'}
              </h3>
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
                <Button
                  variant={selectedNext.kind === 'letter' ? 'primary' : 'secondary'}
                  loading={busy}
                  leadingIcon={<FileWarning className="size-4" />}
                  onClick={() => void issueLetter()}
                >
                  {selectedNext.kind === 'letter' ? selectedNext.title : 'Draft letter'}
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
