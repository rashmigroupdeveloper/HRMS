/** DOC-02/03: audited downloads and a bounded, scoped document list. */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { downloadBase64 } from '../../lib/files';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Skeleton,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { Column, StatusTone } from '../../ui';
import type { VaultRow } from './documents.types';
const tones: Record<VaultRow['expiry']['state'], StatusTone> = {
  perpetual: 'neutral',
  valid: 'positive',
  expiring: 'warning',
  expired: 'negative',
};
const uploadedDate = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
interface Props {
  managed: boolean;
  rows: VaultRow[] | null;
  error: string | null;
  attention: boolean;
  offset: number;
  pageSize: number;
  onRetry: () => Promise<void>;
  onPage: (offset: number) => void;
}
export function DocumentFiles({
  managed,
  rows,
  error,
  attention,
  offset,
  pageSize: PAGE_SIZE,
  onRetry,
  onPage,
}: Props) {
  const endpoint = managed ? '/api/documents' : '/api/documents/mine';
  const [purpose, setPurpose] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);
  const download = async (row: VaultRow) => {
    if (purpose.trim().length < 3) {
      toast.error('Enter why you need the document before downloading it.');
      return;
    }
    setDownloading(row.id);
    try {
      const result = await apiFetch<{ fileName: string; mime: string; base64: string }>(
        `${endpoint}/${String(row.id)}/content?purpose=${encodeURIComponent(purpose.trim())}`,
      );
      downloadBase64(result.fileName, result.base64, result.mime);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not download the document');
    } finally {
      setDownloading(null);
    }
  };
  const columns: Column<VaultRow>[] = [
    ...(managed
      ? [
          {
            key: 'employee',
            header: 'Employee',
            render: (row: VaultRow) => (
              <span>
                {row.employeeName ?? 'Employee'} <span className="text-ink-muted">{row.ecode}</span>
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'type',
      header: 'Document',
      render: (row) => (
        <span>
          {row.typeName}
          <span className="block text-xs text-ink-muted">{row.originalName}</span>
        </span>
      ),
    },
    {
      key: 'uploaded',
      header: 'Uploaded',
      render: (row) => uploadedDate.format(new Date(row.uploadedAt)),
    },
    {
      key: 'expiry',
      header: 'Validity',
      render: (row) => (
        <StatusBadge tone={tones[row.expiry.state]}>
          {row.expiry.state === 'perpetual'
            ? 'No expiry'
            : row.expiry.state === 'expired'
              ? 'Expired'
              : row.expiry.state === 'valid'
                ? 'Valid'
                : `${String(row.expiry.daysRemaining)} days left`}
        </StatusBadge>
      ),
    },
    {
      key: 'download',
      header: 'Action',
      render: (row) => (
        <Button
          size="sm"
          disabled={row.status !== 'active' || downloading !== null}
          loading={downloading === row.id}
          onClick={() => {
            void download(row);
          }}
        >
          Download
        </Button>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="On file"
        subtitle="Downloads require a stated purpose and are recorded in the audit log."
      />
      <TextField
        label="Reason for download"
        hint="For example: personal records or checking employment documents."
        value={purpose}
        maxLength={200}
        onChange={(event) => {
          setPurpose(event.target.value);
        }}
      />
      <div className="mt-4">
        {error ? (
          <EmptyState
            title="Could not load documents"
            description={error}
            action={
              <Button
                onClick={() => {
                  void onRetry();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : rows === null ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No documents found"
            description={
              attention
                ? 'No documents on this page need attention.'
                : 'Upload a document to add it to the employee record.'
            }
          />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => String(row.id)} />
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          disabled={offset === 0}
          onClick={() => {
            onPage(Math.max(0, offset - PAGE_SIZE));
          }}
        >
          Previous
        </Button>
        <span className="text-sm text-ink-muted tabular-nums">
          Page {String(Math.floor(offset / PAGE_SIZE) + 1)}
        </span>
        <Button
          disabled={rows === null || rows.length < PAGE_SIZE || error !== null}
          onClick={() => {
            onPage(offset + PAGE_SIZE);
          }}
        >
          Next
        </Button>
      </div>
    </Card>
  );
}
