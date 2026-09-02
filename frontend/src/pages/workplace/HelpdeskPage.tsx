/**
 * Helpdesk (M9 — HD-01, SOW-9) — docs/08 §3 puts this in three different
 * shells, so one page serves three intents:
 *
 *   employee  → "My tickets": raise one, follow the thread.
 *   agent     → "Queue": SLA-sorted, breach-first, resolve with a reason.
 *   hr/report → "Performance": R29 monthly, with the Excel finance asks for.
 *
 * The queue is sorted by SLA rather than by date on purpose: an agent opening
 * this page should see what is about to breach, not what is newest.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Inbox, LifeBuoy, Plus, Send, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  DarkCard,
  DataTable,
  Drawer,
  EmptyState,
  PageHeader,
  Pill,
  Select,
  StatusBadge,
  TextField,
  Textarea,
  toast,
} from '../../ui';
import type { Column, SelectOption } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { downloadExcel } from '../reports/report-utils';

interface Category {
  code: string;
  name: string;
  slaHours: number;
}

interface Ticket {
  id: number;
  ticketNo: string;
  subject: string;
  categoryCode: string;
  categoryName: string;
  status: string;
  priority: string;
  raisedByEmail: string | null;
  assigneeEmail: string | null;
  slaDueAt: string;
  breached: boolean;
  escalatedLevel: number;
  resolvedAt: string | null;
  createdAt: string;
}

interface Message {
  id: number;
  body: string;
  isInternal: boolean;
  authorEmail: string | null;
  createdAt: string;
}

interface Performance {
  categoryCode: string;
  categoryName: string;
  raised: number;
  resolved: number;
  breached: number;
  avgResolutionHours: number | null;
}

const STATUS_TONE: Record<string, 'positive' | 'info' | 'warning' | 'neutral'> = {
  open: 'info',
  pending: 'warning',
  resolved: 'positive',
  closed: 'neutral',
};

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** "in 3h" / "4h overdue" — the number an agent actually needs. */
function slaLabel(dueIso: string, resolved: boolean): { text: string; overdue: boolean } {
  if (resolved) return { text: 'met', overdue: false };
  const diffMs = new Date(dueIso).getTime() - Date.now();
  const hours = Math.round(Math.abs(diffMs) / 3_600_000);
  return diffMs >= 0
    ? { text: `in ${String(hours)}h`, overdue: false }
    : { text: `${String(hours)}h overdue`, overdue: true };
}

export function HelpdeskPage({ user }: { user: SessionUser }) {
  const isAgent = hasPermission(user, 'helpdesk.agent');
  const canReport = hasPermission(user, 'reports.hr');
  const [tab, setTab] = useState<'mine' | 'queue' | 'performance'>(isAgent ? 'queue' : 'mine');
  const [raising, setRaising] = useState(false);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const tabs: { code: 'mine' | 'queue' | 'performance'; label: string }[] = [
    { code: 'mine', label: 'My tickets' },
    ...(isAgent ? ([{ code: 'queue' as const, label: 'Queue' }]) : []),
    ...(canReport ? ([{ code: 'performance' as const, label: 'Performance' }]) : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Helpdesk"
        title="Ask for help"
        description="Ask for help and see it through — every ticket has someone responsible and a clock, so it cannot sit unanswered."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-surface-2 p-1">
              {tabs.map((t) => (
                <Button
                  key={t.code}
                  size="sm"
                  variant={tab === t.code ? 'hero' : 'ghost'}
                  onClick={() => {
                    setTab(t.code);
                  }}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <Button
              variant="primary"
              leadingIcon={<Plus className="size-4" />}
              onClick={() => {
                setRaising(true);
              }}
            >
              Raise ticket
            </Button>
          </div>
        }
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          Why this exists
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          Ask once. Follow it through.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You raise a ticket, the desk is told immediately, and the queue is sorted by what is
          about to miss its answer time — not by what is newest.
        </p>
      </DarkCard>

      {tab === 'performance' ? (
        <PerformancePanel />
      ) : (
        <TicketList
          mode={tab}
          isAgent={isAgent}
          reloadKey={reloadKey}
          onOpen={setOpenTicket}
        />
      )}

      <RaiseDrawer
        open={raising}
        onClose={() => {
          setRaising(false);
        }}
        onRaised={() => {
          setRaising(false);
          setReloadKey((k) => k + 1);
        }}
      />

      <TicketDrawer
        ticket={openTicket}
        isAgent={isAgent}
        onClose={() => {
          setOpenTicket(null);
        }}
        onChanged={() => {
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function TicketList({
  mode,
  isAgent,
  reloadKey,
  onOpen,
}: {
  mode: 'mine' | 'queue';
  isAgent: boolean;
  reloadKey: number;
  onOpen: (t: Ticket) => void;
}) {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [breachedOnly, setBreachedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path =
        mode === 'mine'
          ? '/api/helpdesk/tickets/mine'
          : (() => {
              const p = new URLSearchParams({ limit: '100' });
              if (status !== '') p.set('status', status);
              if (breachedOnly) p.set('breachedOnly', 'true');
              return `/api/helpdesk/tickets?${p.toString()}`;
            })();
      const page = await apiFetch<{ rows: Ticket[]; total: number }>(path);
      setRows(page.rows);
      setTotal(page.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load tickets.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, status, breachedOnly]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const columns: Column<Ticket>[] = [
    {
      key: 'ticket',
      header: 'Ticket',
      width: 'minmax(220px,1.4fr)',
      render: (r) => (
        <div>
          <span className="font-semibold text-ink">{r.subject}</span>
          <p className="mt-0.5 text-xs text-ink-muted">
            {r.ticketNo} · {r.categoryName}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (r) => <StatusBadge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</StatusBadge>,
    },
    {
      key: 'sla',
      header: 'SLA',
      width: '140px',
      render: (r) => {
        const sla = slaLabel(r.slaDueAt, r.resolvedAt !== null);
        return sla.overdue ? (
          <StatusBadge tone="negative">{sla.text}</StatusBadge>
        ) : (
          <span className="text-sm text-ink-muted">{sla.text}</span>
        );
      },
    },
    ...(isAgent && mode === 'queue'
      ? [
          {
            key: 'assignee',
            header: 'Assigned to',
            width: 'minmax(180px,1fr)',
            render: (r: Ticket) => (
              <span className="text-sm text-ink-muted">{r.assigneeEmail ?? 'Unassigned'}</span>
            ),
          },
        ]
      : []),
    {
      key: 'esc',
      header: 'Escalations',
      width: '110px',
      numeric: true,
      render: (r) =>
        r.escalatedLevel > 0 ? <Pill>{r.escalatedLevel}</Pill> : <span className="text-ink-faint">—</span>,
    },
    {
      key: 'created',
      header: 'Raised',
      width: '130px',
      render: (r) => <span className="text-xs text-ink-muted">{stamp(r.createdAt)}</span>,
    },
  ];

  return (
    <>
      {mode === 'queue' && (
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Select
                label="Status"
                value={status}
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'open', label: 'Open' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
                onChange={setStatus}
              />
            </div>
            <Button
              variant={breachedOnly ? 'primary' : 'secondary'}
              leadingIcon={<AlertTriangle className="size-4" />}
              onClick={() => {
                setBreachedOnly((v) => !v);
              }}
            >
              {breachedOnly ? 'Showing breached only' : 'Breached only'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`${total.toLocaleString('en-IN')} ticket${total === 1 ? '' : 's'}`}
          subtitle="Sorted by SLA — what is closest to breaching comes first, not what is newest."
        />
      </Card>

      {loading ? (
        <DashboardSkeleton />
      ) : error !== null ? (
        <DashboardError message={error} onRetry={() => void load()} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => String(r.id)}
          onRowClick={onOpen}
          maxHeight={600}
          empty={
            <EmptyState
              icon={<Inbox />}
              title={mode === 'mine' ? 'You have no tickets' : 'Queue is clear'}
              description={
                mode === 'mine'
                  ? 'Raise one and it will be acknowledged straight away.'
                  : 'Nothing is waiting. Breached tickets would appear at the top.'
              }
            />
          }
        />
      )}
    </>
  );
}

function RaiseDrawer({
  open,
  onClose,
  onRaised,
}: {
  open: boolean;
  onClose: () => void;
  onRaised: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCode, setCategoryCode] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<Category[]>('/api/helpdesk/categories')
      .then((list) => {
        setCategories(list);
        setCategoryCode((current) => (current === '' ? (list[0]?.code ?? '') : current));
      })
      .catch(() => {
        setError('Could not load categories.');
      });
  }, [open]);

  const chosen = categories.find((c) => c.code === categoryCode);

  const submit = async () => {
    if (subject.trim().length < 3 || body.trim() === '') {
      setError('Give the ticket a subject and describe the issue.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<{ ticketNo: string }>('/api/helpdesk/tickets', {
        method: 'POST',
        body: JSON.stringify({ categoryCode, subject: subject.trim(), body: body.trim(), priority }),
      });
      toast.success(`Ticket ${created.ticketNo} raised`, {
        description: 'You will get an acknowledgement, and the desk has been notified.',
      });
      setSubject('');
      setBody('');
      onRaised();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not raise the ticket.');
    } finally {
      setSaving(false);
    }
  };

  const options: SelectOption[] = categories.map((c) => ({
    value: c.code,
    label: c.name,
    description: `Answered within ${String(c.slaHours)}h`,
  }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Raise a ticket"
      subtitle="Acknowledged immediately; routed by category"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Raise ticket
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select label="Category" value={categoryCode} options={options} onChange={setCategoryCode} />
        {chosen && (
          <p className="rounded-row bg-surface-2 px-4 py-3 text-xs leading-5 text-ink-muted">
            This category is answered within <strong className="text-ink">{chosen.slaHours} hours</strong>.
            The clock starts as soon as you raise it.
          </p>
        )}
        <TextField
          label="Subject"
          value={subject}
          onChange={(e) => {
            setSubject(e.currentTarget.value);
          }}
        />
        <Textarea
          label="What is the problem?"
          rows={6}
          value={body}
          onChange={(e) => {
            setBody(e.currentTarget.value);
          }}
        />
        <Select
          label="Priority"
          value={priority}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
          onChange={setPriority}
        />
        {error !== null && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}

function TicketDrawer({
  ticket,
  isAgent,
  onClose,
  onChanged,
}: {
  ticket: Ticket | null;
  isAgent: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async (id: number) => {
    setThread(await apiFetch<Message[]>(`/api/helpdesk/tickets/${String(id)}/thread`));
  }, []);

  useEffect(() => {
    if (ticket === null) return;
    void loadThread(ticket.id).catch(() => {
      setError('Could not load the conversation.');
    });
  }, [ticket, loadThread]);

  const send = async () => {
    if (ticket === null || reply.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/helpdesk/tickets/${String(ticket.id)}/reply`, {
        method: 'POST',
        body: JSON.stringify({ ticketId: ticket.id, body: reply.trim(), isInternal: internal }),
      });
      setReply('');
      await loadThread(ticket.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the reply.');
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    if (ticket === null) return;
    if (resolution.trim() === '') {
      setError('Say how it was resolved — a ticket closed without a reason helps nobody.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/helpdesk/tickets/${String(ticket.id)}/status`, {
        method: 'POST',
        body: JSON.stringify({ ticketId: ticket.id, status: 'resolved', resolution: resolution.trim() }),
      });
      toast.success('Ticket resolved', { description: 'The raiser has been notified.' });
      setResolution('');
      onChanged();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resolve the ticket.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={ticket !== null}
      onClose={onClose}
      width={620}
      title={ticket === null ? 'Ticket' : ticket.subject}
      subtitle={ticket === null ? undefined : `${ticket.ticketNo} · ${ticket.categoryName}`}
    >
      {ticket && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={STATUS_TONE[ticket.status] ?? 'neutral'}>{ticket.status}</StatusBadge>
            {(() => {
              const sla = slaLabel(ticket.slaDueAt, ticket.resolvedAt !== null);
              return sla.overdue ? (
                <StatusBadge tone="negative">SLA {sla.text}</StatusBadge>
              ) : (
                <Pill>SLA {sla.text}</Pill>
              );
            })()}
            {ticket.escalatedLevel > 0 && <Pill>Escalated ×{ticket.escalatedLevel}</Pill>}
          </div>

          <div className="space-y-3">
            {thread.length === 0 ? (
              <p className="text-sm text-ink-muted">No replies yet.</p>
            ) : (
              thread.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-row p-4 ${m.isInternal ? 'bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))]' : 'bg-surface-2'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink">{m.authorEmail ?? 'system'}</span>
                    <span className="text-xs text-ink-muted">{stamp(m.createdAt)}</span>
                  </div>
                  {m.isInternal && (
                    <Pill>
                      Internal note
                    </Pill>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{m.body}</p>
                </div>
              ))
            )}
          </div>

          <Textarea
            label="Reply"
            rows={4}
            value={reply}
            onChange={(e) => {
              setReply(e.currentTarget.value);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {isAgent && (
              <Button
                size="sm"
                variant={internal ? 'primary' : 'ghost'}
                onClick={() => {
                  setInternal((v) => !v);
                }}
              >
                {internal ? 'Internal note' : 'Visible to raiser'}
              </Button>
            )}
            <Button
              variant="secondary"
              loading={busy}
              leadingIcon={<Send className="size-4" />}
              onClick={() => void send()}
            >
              Send reply
            </Button>
          </div>

          {isAgent && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <div className="space-y-3 rounded-row bg-surface-2 p-4">
              <Textarea
                label="Resolution"
                rows={3}
                value={resolution}
                onChange={(e) => {
                  setResolution(e.currentTarget.value);
                }}
              />
              <Button variant="primary" loading={busy} onClick={() => void resolve()}>
                Resolve ticket
              </Button>
            </div>
          )}

          {error !== null && (
            <p className="text-sm text-negative" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function PerformancePanel() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Performance[]>(`/api/helpdesk/performance?month=${month}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load performance.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<Performance>[] = [
    { key: 'cat', header: 'Category', width: 'minmax(200px,1.4fr)', render: (r) => r.categoryName },
    { key: 'raised', header: 'Raised', width: '100px', numeric: true, render: (r) => r.raised },
    { key: 'resolved', header: 'Resolved', width: '110px', numeric: true, render: (r) => r.resolved },
    {
      key: 'breached',
      header: 'SLA breached',
      width: '130px',
      numeric: true,
      render: (r) =>
        r.breached > 0 ? <StatusBadge tone="negative">{r.breached}</StatusBadge> : <span>0</span>,
    },
    {
      key: 'avg',
      header: 'Avg resolution',
      width: '150px',
      numeric: true,
      render: (r) =>
        r.avgResolutionHours === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span className="tabular-nums">{r.avgResolutionHours.toFixed(1)} h</span>
        ),
    },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <TextField
              label="Month"
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.currentTarget.value);
              }}
            />
          </div>
          <Button
            variant="primary"
            leadingIcon={<TrendingUp className="size-4" />}
            onClick={() => void downloadExcel(`/api/helpdesk/performance/export?month=${month}`)}
          >
            Export R29
          </Button>
        </div>
      </Card>

      {loading ? (
        <DashboardSkeleton />
      ) : error !== null ? (
        <DashboardError message={error} onRetry={() => void load()} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.categoryCode}
          maxHeight={520}
          empty={
            <EmptyState
              icon={<LifeBuoy />}
              title="No tickets in this month"
              description="Pick another month, or the desk had a quiet one."
            />
          }
        />
      )}
    </>
  );
}
