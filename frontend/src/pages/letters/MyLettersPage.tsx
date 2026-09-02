/**
 * My letters (ESS, CORE-09) — issued letters on my record: appointment,
 * confirmation, certificates, show-cause. Drafts in the signature chain are
 * NOT shown; a letter exists for the employee only once issued.
 */
import { useEffect, useState } from 'react';
import { FileText, MailOpen } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  DarkCard,
  DataTable,
  Drawer,
  EmptyState,
  KpiNumber,
  PageHeader,
  formatDateIN,
  toast,
} from '../../ui';
import type { Column } from '../../ui';

interface LetterRow {
  id: number;
  templateCode: string;
  documentId: number;
  issuedAt: string | null;
  workflowRequestId: number | null;
}

function issuedLabel(iso: string | null): string {
  if (!iso) return 'Issued';
  const day = iso.slice(0, 10);
  return formatDateIN(day);
}

function templateLabel(code: string): string {
  return code.replaceAll('_', ' ');
}

export function MyLettersPage() {
  const [rows, setRows] = useState<LetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ fileName: string; content: string } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<LetterRow[]>('/api/letters/mine')
      .then(setRows)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Failed to load letters');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(load, []);

  const open = async (row: LetterRow) => {
    try {
      setViewer(
        await apiFetch<{ mime: string; fileName: string; content: string }>(
          `/api/letters/${String(row.id)}/content`,
        ),
      );
    } catch (cause) {
      toast.error('Could not open the letter', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    }
  };

  const latest = rows[0];
  const columns: Column<LetterRow>[] = [
    {
      key: 'template',
      header: 'Letter',
      width: 'minmax(200px,1fr)',
      render: (row) => templateLabel(row.templateCode),
    },
    {
      key: 'issued',
      header: 'Already issued',
      width: '220px',
      render: (row) => issuedLabel(row.issuedAt),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Already on your employee file"
        title="My letters"
        description="Appointment, confirmation and certificates land here the moment the signature chain finishes — not while they are still drafts."
      />

      {error && (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="Letters could not be loaded"
            description={error}
            action={<Button onClick={load}>Try again</Button>}
          />
        </Card>
      )}

      {rows.length > 0 && latest !== undefined && (
        <DarkCard className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="text-xs font-medium tracking-tight text-hero-muted">
              Already issued to you
            </p>
            <p className="mt-3 text-5xl font-light tabular-nums">
              <KpiNumber value={rows.length} />
            </p>
            <p className="mt-1 text-sm text-hero-muted">
              Latest · {templateLabel(latest.templateCode)} · {issuedLabel(latest.issuedAt)}
            </p>
          </div>
          <Button
            variant="primary"
            leadingIcon={<MailOpen className="size-4" />}
            onClick={() => {
              void open(latest);
            }}
          >
            Open the latest letter
          </Button>
        </DarkCard>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => void open(row)}
        maxHeight={560}
        empty={
          <EmptyState
            icon={<FileText />}
            title={loading ? 'Looking up your file…' : 'No letter has been issued yet'}
            description={
              loading
                ? 'Issued letters appear the moment HR finishes the signature chain.'
                : 'Your file is open. Appointment and confirmation letters appear here once they are signed — nothing is waiting on you until then.'
            }
          />
        }
      />

      <Drawer
        open={viewer !== null}
        onClose={() => {
          setViewer(null);
        }}
        title={viewer?.fileName ?? ''}
        width={560}
      >
        <article
          className="whitespace-pre-wrap text-sm leading-7 text-ink"
          dangerouslySetInnerHTML={{ __html: viewer?.content ?? '' }}
        />
      </Drawer>
    </div>
  );
}
