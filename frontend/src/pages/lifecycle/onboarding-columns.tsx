/** LC-01: candidate table columns use actual source values and explicit actions. */
import { formatCalendarDate } from '../../lib/date';
import { ArrowRight } from 'lucide-react';
import { Button, StatusBadge, type Column } from '../../ui';
import type { CandidateItem, ReferenceCatalog } from './onboarding-types';
export function onboardingColumns(
  companies: ReferenceCatalog['companies'] | undefined,
  onCheckDuplicate: (candidate: CandidateItem) => Promise<void>,
  onConvert: (candidate: CandidateItem) => void,
): Column<CandidateItem>[] {
  return [
    {
      key: 'fullName',
      header: 'Candidate',
      render: (c) => (
        <div>
          <p className="font-medium text-ink">{c.fullName}</p>
          <p className="text-xs text-ink-muted">{c.positionTitle}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
            <span>{c.mobile}</span>
            <span>•</span>
            <span>{c.personalEmail}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department & Company',
      render: (c) => (
        <div>
          <p className="text-sm text-ink">{c.department ?? 'Not assigned'}</p>
          <p className="text-xs text-ink-muted">
            {companies?.find((company) => company.id === c.companyId)?.name ??
              (c.companyId ? `Company ${String(c.companyId)}` : 'Company not assigned')}
          </p>
        </div>
      ),
    },
    {
      key: 'offeredCtc',
      header: 'Offered CTC',
      render: (c) => (
        <span className="font-mono text-sm text-ink">
          ₹{Number(c.offeredCtc).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'proposedDoj',
      header: 'Proposed DOJ',
      render: (c) => <span className="text-sm text-ink">{formatCalendarDate(c.proposedDoj)}</span>,
    },
    {
      key: 'status',
      header: 'Pipeline Status',
      render: (c) => {
        switch (c.status) {
          case 'prejoin_done':
            return <StatusBadge tone="positive">Pre-join Done</StatusBadge>;
          case 'link_sent':
            return <StatusBadge tone="info">Link Sent</StatusBadge>;
          case 'no_show':
            return <StatusBadge tone="neutral">Did not join</StatusBadge>;
          case 'converted':
            return <StatusBadge tone="positive">Converted (Emp #{c.employeeId})</StatusBadge>;
          default:
            return <StatusBadge tone="neutral">Awaiting Link</StatusBadge>;
        }
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <div className="flex items-center gap-2">
          {c.status !== 'converted' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void onCheckDuplicate(c);
              }}
            >
              Check Dup
            </Button>
          )}

          {c.status === 'prejoin_done' && (
            <Button
              size="sm"
              variant="primary"
              leadingIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() => {
                onConvert(c);
              }}
            >
              Review joining
            </Button>
          )}

          {c.status === 'converted' && <StatusBadge tone="positive">Employee created</StatusBadge>}
        </div>
      ),
    },
  ];
}
