import { ArrowRight, ScanSearch } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardHeader,
  DarkCard,
  DataTable,
  EmptyState,
  KpiNumber,
  PageHeader,
  StatusBadge,
} from '../../ui';
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

  const rows = resource.data ?? [];
  const open = rows.length > 0;
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
      <PageHeader
        eyebrow="Attendance operations · ATT-01"
        title="Swipe exceptions"
        description="Biometric events are retained even when an employee number cannot be mapped."
      />

      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          Mapping queue
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-4xl font-light tabular-nums">
              <KpiNumber value={rows.length} animateOnMount={false} />
            </p>
            <p className="mt-1 text-sm text-hero-muted">
              {open
                ? 'ghost employee numbers. Month lock stays blocked until this queue is empty.'
                : 'unmatched numbers. Every stored swipe maps to an HRMS employee.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone={open ? 'negative' : 'positive'}>
              {open ? 'Mapping required' : 'Queue clear'}
            </StatusBadge>
            {open ? null : (
              <Link
                to="/attendance/month-lock"
                className="u-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
              >
                Run month-lock checklist <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </DarkCard>

      {open ? (
        <Card>
          <CardHeader
            title="Resolution guidance"
            subtitle="Correct the employee mapping, then the idempotent ingestion pipeline can reprocess the events."
          />
        </Card>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.employeeNo}
        empty={
          <EmptyState
            icon={<ScanSearch />}
            title="No unmatched swipes"
            description="Every stored biometric employee number maps to an HRMS employee. Run the month-lock checklist when you are ready to freeze."
          />
        }
      />
    </div>
  );
}
