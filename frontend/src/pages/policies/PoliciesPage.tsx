/**
 * Policy repository (CORE-13, PI-ESS-5).
 * Everyone: policies targeting me → read → acknowledge (the ack prompt ESS
 * home nags about). Publishers (engagement.publish) get a publish drawer —
 * document and/or short summary. Report holders see the LIVE ack tile.
 */
import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, CheckCircle2, FileUp, ScrollText } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  SegmentedProgress,
  StatusBadge,
  TextField,
  Textarea,
  toast,
  todayISOIST,
} from '../../ui';
import type { Column } from '../../ui';

interface PolicyItem {
  id: number;
  title: string;
  documentId: number | null;
  bodySummary: string | null;
  effectiveDate: string;
  requiresAcknowledgment: boolean;
  acknowledgedAt: string | null;
}

interface AckTileRow {
  id: number;
  title: string;
  effectiveDate: string;
  targeted: number;
  acknowledged: number;
  pct: number;
}

export function PoliciesPage({ user }: { user: SessionUser }) {
  const [mine, setMine] = useState<PolicyItem[]>([]);
  const [tile, setTile] = useState<AckTileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reader, setReader] = useState<{ policy: PolicyItem; content: string } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', effectiveDate: todayISOIST(), summary: '', content: '' });
  const canPublish = hasPermission(user, 'engagement.publish');
  const seesTile = hasPermission(user, 'reports.hr');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMine(await apiFetch<PolicyItem[]>('/api/policies'));
      if (seesTile) setTile(await apiFetch<AckTileRow[]>('/api/policies/ack-status'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [seesTile]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReader = async (policy: PolicyItem) => {
    try {
      const doc = await apiFetch<{ mime: string; fileName: string; content: string }>(
        `/api/policies/${String(policy.id)}/content`,
      );
      setReader({ policy, content: doc.content });
    } catch (cause) {
      toast.error('Could not open the policy', { description: cause instanceof Error ? cause.message : 'Try again.' });
    }
  };

  const acknowledge = async (policy: PolicyItem) => {
    setBusy(true);
    try {
      await apiFetch(`/api/policies/${String(policy.id)}/ack`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('Acknowledged', { description: policy.title });
      setReader(null);
      await load();
    } catch (cause) {
      toast.error('Acknowledgment failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (form.title.trim().length < 3 || (!form.summary.trim() && !form.content.trim())) {
      toast.error('Publish needs a title and a summary or document text');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/policies', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          effectiveDate: form.effectiveDate,
          requiresAcknowledgment: true,
          ...(form.summary.trim() ? { bodySummary: form.summary.trim() } : {}),
          ...(form.content.trim()
            ? { fileName: `${form.title.trim()}.html`, mime: 'text/html', content: form.content }
            : {}),
        }),
      });
      toast.success('Policy published', { description: 'Targeted employees see it immediately; the weekly nag chases stragglers.' });
      setPublishOpen(false);
      setForm({ title: '', effectiveDate: todayISOIST(), summary: '', content: '' });
      await load();
    } catch (cause) {
      toast.error('Publish failed', { description: cause instanceof Error ? cause.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const tileColumns: Column<AckTileRow>[] = [
    { key: 'title', header: 'Policy', width: 'minmax(220px,2fr)', render: (row) => row.title },
    { key: 'eff', header: 'Effective', width: '110px', render: (row) => row.effectiveDate },
    { key: 'targeted', header: 'Targeted', width: '100px', numeric: true, render: (row) => row.targeted },
    { key: 'acked', header: 'Acked', width: '100px', numeric: true, render: (row) => row.acknowledged },
    {
      key: 'pct',
      header: 'Coverage',
      width: 'minmax(160px,1fr)',
      render: (row) => (
        <SegmentedProgress label={`${String(row.pct)}%`} primary={row.acknowledged} total={Math.max(row.targeted, 1)} />
      ),
    },
  ];

  const pending = mine.filter((p) => p.requiresAcknowledgment && !p.acknowledgedAt);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">CORE-13 · acknowledgment tracked live</p>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">Policies</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {pending.length > 0
              ? `${String(pending.length)} polic${pending.length === 1 ? 'y needs' : 'ies need'} your acknowledgment.`
              : 'You are fully acknowledged.'}
          </p>
        </div>
        {canPublish && (
          <Button variant="primary" leadingIcon={<FileUp className="size-4" />} onClick={() => { setPublishOpen(true); }}>
            Publish policy
          </Button>
        )}
      </header>

      {error && (
        <Card>
          <EmptyState icon={<ScrollText />} title="Could not load" description={error} action={<Button onClick={() => void load()}>Retry</Button>} />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mine.map((policy) => (
          <Card key={policy.id} interactive className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">{policy.title}</h2>
              {policy.requiresAcknowledgment &&
                (policy.acknowledgedAt ? (
                  <StatusBadge tone="positive">acknowledged</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">action needed</StatusBadge>
                ))}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Effective {policy.effectiveDate}</p>
            {policy.bodySummary && <p className="mt-3 text-sm leading-6 text-ink-muted">{policy.bodySummary}</p>}
            <div className="mt-auto flex gap-2 pt-4">
              <Button size="sm" variant="ghost" onClick={() => void openReader(policy)}>
                Read
              </Button>
              {policy.requiresAcknowledgment && !policy.acknowledgedAt && (
                <Button size="sm" variant="primary" loading={busy} leadingIcon={<CheckCircle2 className="size-4" />} onClick={() => void acknowledge(policy)}>
                  Acknowledge
                </Button>
              )}
            </div>
          </Card>
        ))}
        {mine.length === 0 && !loading && !error && (
          <Card className="md:col-span-2 xl:col-span-3">
            <EmptyState icon={<BookOpenCheck />} title="No policies target you yet" description="Published policies appear here the moment HR releases them." />
          </Card>
        )}
      </div>

      {seesTile && (
        <Card padded={false}>
          <div className="p-5 pb-1">
            <CardHeader title="Acknowledgment coverage" subtitle="Live query — targeted × acknowledged per policy (the HR tile)" />
          </div>
          <DataTable
            rows={tile}
            columns={tileColumns}
            rowKey={(row) => String(row.id)}
            maxHeight={360}
            empty={<EmptyState icon={<BookOpenCheck />} title="No ack-required policies" />}
          />
        </Card>
      )}

      <Drawer
        open={reader !== null}
        onClose={() => {
          setReader(null);
        }}
        title={reader?.policy.title ?? ''}
        subtitle={reader ? `Effective ${reader.policy.effectiveDate}` : undefined}
        footer={
          reader?.policy.requiresAcknowledgment && !reader.policy.acknowledgedAt ? (
            <Button variant="primary" loading={busy} leadingIcon={<CheckCircle2 className="size-4" />} onClick={() => void acknowledge(reader.policy)}>
              I have read this — acknowledge
            </Button>
          ) : undefined
        }
        width={560}
      >
        <article className="whitespace-pre-wrap text-sm leading-7 text-ink" dangerouslySetInnerHTML={{ __html: reader?.content ?? '' }} />
      </Drawer>

      <Drawer
        open={publishOpen}
        onClose={() => {
          setPublishOpen(false);
        }}
        title="Publish a policy"
        subtitle="A short summary, a full document body, or both — acknowledgment tracking starts immediately"
        footer={
          <Button variant="primary" loading={busy} onClick={() => void publish()}>
            Publish
          </Button>
        }
        width={560}
      >
        <div className="space-y-4">
          <TextField
            label="Title"
            value={form.title}
            onChange={(event) => {
              const title = event.currentTarget.value;
              setForm((previous) => ({ ...previous, title }));
            }}
          />
          <TextField
            label="Effective date"
            type="date"
            value={form.effectiveDate}
            onChange={(event) => {
              const effectiveDate = event.currentTarget.value;
              setForm((previous) => ({ ...previous, effectiveDate }));
            }}
          />
          <Textarea
            label="Short summary (shown on cards)"
            value={form.summary}
            rows={3}
            onChange={(event) => {
              const summary = event.currentTarget.value;
              setForm((previous) => ({ ...previous, summary }));
            }}
          />
          <Textarea
            label="Full policy text (optional — stored as the document)"
            value={form.content}
            rows={8}
            onChange={(event) => {
              const content = event.currentTarget.value;
              setForm((previous) => ({ ...previous, content }));
            }}
          />
        </div>
      </Drawer>
    </div>
  );
}
