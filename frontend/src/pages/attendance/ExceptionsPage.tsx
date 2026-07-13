import { ScanSearch } from 'lucide-react';
import { Card, CardHeader, DataTable, EmptyState, StatusBadge } from '../../ui';
import type { Column } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { formatTimestamp } from '../home/dashboard-format';
import { useDashboardResource } from '../home/useDashboardResource';

interface UnmatchedSwipe {
  employeeNo: string;
  swipes: number;
  firstSeen: string;
  lastSeen: string;
}

export function ExceptionsPage() {
  const resource = useDashboardResource<UnmatchedSwipe[]>(
    '/api/attendance/exceptions/unmatched?limit=200',
  );
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  const columns: Column<UnmatchedSwipe>[] = [
    {
      key: 'employee',
      header: 'Employee number',
      width: '1fr',
      render: (row) => <span className="font-semibold text-ink">{row.employeeNo}</span>,
    },
    { key: 'swipes', header: 'Swipes', width: '100px', numeric: true, render: (row) => row.swipes },
    {
      key: 'first',
      header: 'First seen',
      width: '170px',
      render: (row) => formatTimestamp(row.firstSeen),
    },
    {
      key: 'last',
      header: 'Last seen',
      width: '170px',
      render: (row) => formatTimestamp(row.lastSeen),
    },
    {
      key: 'state',
      header: 'State',
      width: '140px',
      render: () => <StatusBadge tone="negative">Unmatched</StatusBadge>,
    },
  ];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Attendance operations</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Swipe exceptions
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Biometric events are retained even when an employee number cannot be mapped.
        </p>
      </header>
      <Card>
        <CardHeader
          title="Resolution guidance"
          subtitle="Correct the employee mapping, then the idempotent ingestion pipeline can reprocess the events."
        />
      </Card>
      <DataTable
        rows={resource.data ?? []}
        columns={columns}
        rowKey={(row) => row.employeeNo}
        empty={
          <EmptyState
            icon={<ScanSearch />}
            title="No unmatched swipes"
            description="Every stored biometric employee number maps to an HRMS employee."
          />
        }
      />
    </div>
  );
}
