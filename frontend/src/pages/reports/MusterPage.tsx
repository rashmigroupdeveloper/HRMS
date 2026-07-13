import { useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { currentMonthIST } from '../home/dashboard-format';

interface MusterRow {
  ecode: string;
  employeeName: string;
  reportingManager: string | null;
  department: string | null;
  orgUnit: string | null;
  costCenter: string | null;
  present: number;
  absent: number;
  leaveDays: number;
  uabDays: number;
  otHours: number;
}

export function MusterPage() {
  const [companyId, setCompanyId] = useState('');
  const [month, setMonth] = useState(() => currentMonthIST());
  const [rows, setRows] = useState<MusterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^\d+$/.test(companyId);

  const load = async (rebuild: boolean) => {
    if (!valid) {
      setError('Enter a valid company ID.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (rebuild)
        await apiFetch('/api/reports/muster/build', {
          method: 'POST',
          body: JSON.stringify({ companyId: Number(companyId), month }),
        });
      setRows(
        await apiFetch<MusterRow[]>(`/api/reports/muster?companyId=${companyId}&month=${month}`),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Muster could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  const download = async () => {
    if (!valid) {
      setError('Enter a valid company ID.');
      return;
    }
    setLoading(true);
    try {
      const file = await apiFetch<{ filename: string; base64: string }>(
        `/api/reports/muster/export?companyId=${companyId}&month=${month}`,
      );
      const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Muster export prepared', { description: file.filename });
    } catch (cause) {
      toast.error('Export failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  };
  const columns: Column<MusterRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      width: 'minmax(180px,1.4fr)',
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.employeeName}</p>
          <p className="text-xs text-ink-muted">{row.ecode}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      width: '150px',
      render: (row) => row.department ?? '—',
    },
    {
      key: 'manager',
      header: 'Reporting manager',
      width: '170px',
      render: (row) => row.reportingManager ?? '—',
    },
    { key: 'present', header: 'P', width: '64px', numeric: true, render: (row) => row.present },
    { key: 'absent', header: 'A', width: '64px', numeric: true, render: (row) => row.absent },
    { key: 'leave', header: 'Leave', width: '72px', numeric: true, render: (row) => row.leaveDays },
    {
      key: 'uab',
      header: 'UAB',
      width: '72px',
      numeric: true,
      render: (row) => (
        <StatusBadge tone={row.uabDays ? 'negative' : 'neutral'}>{row.uabDays}</StatusBadge>
      ),
    },
    { key: 'ot', header: 'OT hrs', width: '80px', numeric: true, render: (row) => row.otHours },
  ];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">RPT-01 · snapshot-backed</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Muster summary
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          The on-screen grid and Excel file read the same monthly snapshot.
        </p>
      </header>
      <Card>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <TextField
            label="Company ID"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.currentTarget.value);
            }}
            error={error ?? undefined}
          />
          <TextField
            label="Month"
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.currentTarget.value);
            }}
          />
          <Button
            loading={loading}
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={() => void load(true)}
          >
            Rebuild & view
          </Button>
          <Button
            variant="primary"
            disabled={!rows.length}
            leadingIcon={<Download className="size-4" />}
            onClick={() => void download()}
          >
            Export Excel
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader
          title={`${rows.length.toLocaleString('en-IN')} employees`}
          subtitle={rows.length ? `Company ${companyId} · ${month}` : 'Choose company and month'}
        />
      </Card>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.ecode}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<FileSpreadsheet />}
            title="No muster loaded"
            description="Run the snapshot build to inspect the selected company and month."
          />
        }
      />
    </div>
  );
}
