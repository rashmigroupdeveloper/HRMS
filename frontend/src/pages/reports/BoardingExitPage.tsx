/**
 * R24 — boarding & exit (LC-03/PP-6): the on-demand range view behind the
 * 07:00 email, with the server-built XLSX (same query) and a send-now trigger
 * for integration-permission holders.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, Send, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { downloadBase64 } from '../../lib/downloads';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import { Button, Card, CardHeader, DataTable, EmptyState, PageHeader, TextField, toast, todayISOIST } from '../../ui';
import type { Column } from '../../ui';

interface PersonRow {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  company: string;
  reportingManager: string | null;
  costCenter: string | null;
  location: string | null;
  date: string;
  exitReason?: string | null;
}

interface BoardingExitReport {
  from: string;
  to: string;
  joins: PersonRow[];
  exits: PersonRow[];
}

const columns = (kind: 'join' | 'exit'): Column<PersonRow>[] => [
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
  { key: 'designation', header: 'Designation', width: '160px', render: (row) => row.designation ?? '—' },
  { key: 'department', header: 'Department', width: '140px', render: (row) => row.department ?? '—' },
  { key: 'company', header: 'Company', width: '100px', render: (row) => row.company },
  { key: 'rm', header: 'Reporting manager', width: '170px', render: (row) => row.reportingManager ?? '—' },
  { key: 'location', header: 'Plant / location', width: '150px', render: (row) => row.location ?? '—' },
  { key: 'date', header: kind === 'join' ? 'DOJ' : 'DOL', width: '110px', render: (row) => row.date },
  ...(kind === 'exit'
    ? [
        {
          key: 'reason',
          header: 'Reason',
          width: '160px',
          render: (row: PersonRow) => row.exitReason ?? '—',
        },
      ]
    : []),
];

export function BoardingExitPage({ user }: { user: SessionUser }) {
  const today = todayISOIST();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<BoardingExitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await apiFetch<BoardingExitReport>(`/api/lifecycle/boarding-exit?from=${from}&to=${to}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    try {
      const file = await apiFetch<{ fileName: string; mime: string; base64: string }>(
        `/api/lifecycle/boarding-exit/excel?from=${from}&to=${to}`,
      );
      downloadBase64(file.fileName, file.mime, file.base64);
      toast.success('Workbook prepared', { description: file.fileName });
    } catch (cause) {
      toast.error('Export failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    }
  };

  const sendNow = async () => {
    try {
      const result = await apiFetch<{ queued: number }>('/api/lifecycle/boarding-exit/send', {
        method: 'POST',
        body: JSON.stringify({ date: from }),
      });
      toast.success('Daily email queued', {
        description: `${String(result.queued)} recipient(s) — audience is wf.event_subscriptions data.`,
      });
    } catch (cause) {
      toast.error('Send failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span>
            <Link to="/reports" className="inline-flex items-center gap-1 hover:text-ink">
              <ArrowLeft className="size-3.5" /> Reports
            </Link>{' '}
            · R24 · behind the 07:00 daily email
          </span>
        }
        title="Boarding & exits"
        description="Joins and exits for a date range — the email version goes out even on empty days."
        actions={
          <>
            {hasPermission(user, 'admin.integrations') && (
              <Button variant="ghost" leadingIcon={<Send className="size-4" />} onClick={() => void sendNow()}>
                Send today’s email now
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!report}
              leadingIcon={<Download className="size-4" />}
              onClick={() => void download()}
            >
              Download Excel
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <TextField
            className="w-52"
            label="From"
            type="date"
            value={from}
            error={error ?? undefined}
            onChange={(event) => {
              setFrom(event.currentTarget.value);
            }}
          />
          <TextField
            className="w-52"
            label="To"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.currentTarget.value);
            }}
          />
          <Button loading={loading} leadingIcon={<RefreshCw className="size-4" />} onClick={() => void load()}>
            Run
          </Button>
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-1">
          <CardHeader
            title={`Joins — ${String(report?.joins.length ?? 0)}`}
            subtitle={report ? `${report.from} → ${report.to}` : 'Run the report'}
          />
        </div>
        <DataTable
          rows={report?.joins ?? []}
          columns={columns('join')}
          rowKey={(row) => `j-${row.ecode}`}
          maxHeight={360}
          empty={<EmptyState icon={<Users />} title="No joins in range" description="An empty day is a real answer — the email still goes out." />}
        />
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-1">
          <CardHeader title={`Exits — ${String(report?.exits.length ?? 0)}`} subtitle="Includes exit reason" />
        </div>
        <DataTable
          rows={report?.exits ?? []}
          columns={columns('exit')}
          rowKey={(row) => `x-${row.ecode}`}
          maxHeight={360}
          empty={<EmptyState icon={<Users />} title="No exits in range" description="Nobody left in the selected window." />}
        />
      </Card>
    </div>
  );
}
