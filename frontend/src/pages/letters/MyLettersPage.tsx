/**
 * My letters (ESS, CORE-09) — issued letters on my record: appointment,
 * confirmation, certificates, show-cause. Drafts in the signature chain are
 * NOT shown; a letter exists for the employee only once issued.
 */
import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Button, Card, DataTable, Drawer, EmptyState, toast } from '../../ui';
import type { Column } from '../../ui';

interface LetterRow {
  id: number;
  templateCode: string;
  documentId: number;
  issuedAt: string | null;
  workflowRequestId: number | null;
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
      setViewer(await apiFetch<{ mime: string; fileName: string; content: string }>(`/api/letters/${String(row.id)}/content`));
    } catch (cause) {
      toast.error('Could not open the letter', { description: cause instanceof Error ? cause.message : 'Try again.' });
    }
  };

  const columns: Column<LetterRow>[] = [
    { key: 'template', header: 'Letter', width: 'minmax(200px,1fr)', render: (row) => row.templateCode.replaceAll('_', ' ') },
    { key: 'issued', header: 'Issued on', width: '220px', render: (row) => (row.issuedAt ? new Date(row.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—') },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Employee self-service</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">My letters</h1>
        <p className="mt-1 text-sm text-ink-muted">Everything HR has formally issued to you, archived permanently.</p>
      </header>

      {error && (
        <Card>
          <EmptyState icon={<FileText />} title="Could not load" description={error} action={<Button onClick={load}>Retry</Button>} />
        </Card>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        onRowClick={(row) => void open(row)}
        maxHeight={560}
        empty={<EmptyState icon={<FileText />} title={loading ? 'Loading…' : 'No letters yet'} description="Issued letters land here the moment the signature chain approves them." />}
      />

      <Drawer
        open={viewer !== null}
        onClose={() => {
          setViewer(null);
        }}
        title={viewer?.fileName ?? ''}
        width={560}
      >
        <article className="whitespace-pre-wrap text-sm leading-7 text-ink" dangerouslySetInnerHTML={{ __html: viewer?.content ?? '' }} />
      </Drawer>
    </div>
  );
}
