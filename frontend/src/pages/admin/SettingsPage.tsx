import { Settings2 } from 'lucide-react';
import { Card, CardHeader, DataTable, EmptyState, Pill } from '../../ui';
import type { Column } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

interface SettingRow {
  key: string;
  value: unknown;
  valueType: 'number' | 'string' | 'boolean' | 'json';
  description: string;
}

export function SettingsPage() {
  const settings = useDashboardResource<SettingRow[]>('/api/settings');
  if (settings.loading) return <DashboardSkeleton />;
  if (settings.error) return <DashboardError message={settings.error} onRetry={settings.reload} />;
  const columns: Column<SettingRow>[] = [
    {
      key: 'key',
      header: 'Setting',
      width: 'minmax(220px,1fr)',
      render: (row) => <span className="font-semibold text-ink">{row.key}</span>,
    },
    {
      key: 'value',
      header: 'Current value',
      width: 'minmax(160px,0.8fr)',
      render: (row) => (
        <code className="rounded-row bg-surface-2 px-2 py-1 text-xs text-ink">
          {typeof row.value === 'string' ? row.value : JSON.stringify(row.value)}
        </code>
      ),
    },
    { key: 'type', header: 'Type', width: '100px', render: (row) => <Pill>{row.valueType}</Pill> },
    {
      key: 'description',
      header: 'Purpose',
      width: 'minmax(260px,1.5fr)',
      render: (row) => row.description,
    },
  ];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Config over code</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Policy settings
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every threshold, grace period and policy switch is runtime data—not a deployment.
        </p>
      </header>
      <Card>
        <CardHeader
          title="Safe policy surface"
          subtitle="Values shown exactly as stored with their declared type"
        />
        <p className="text-sm leading-6 text-ink-muted">
          Editing remains intentionally excluded until the UI has type-aware validation and an
          old→new confirmation preview. The audited write API already exists.
        </p>
      </Card>
      <DataTable
        rows={settings.data ?? []}
        columns={columns}
        rowKey={(row) => row.key}
        empty={
          <EmptyState
            icon={<Settings2 />}
            title="No settings configured"
            description="Seed required settings before enabling attendance policies."
          />
        }
      />
    </div>
  );
}
