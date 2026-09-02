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
  DarkCard,
  DataTable,
  Drawer,
  EmptyState,
  KpiNumber,
  PageHeader,
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
      toast.error('Could not open the policy', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    }
  };

  const acknowledge = async (policy: PolicyItem) => {
    setBusy(true);
    try {
      await apiFetch(`/api/policies/${String(policy.id)}/ack`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('You are covered', { description: policy.title });
      setReader(null);
      await load();
    } catch (cause) {
      toast.error('Acknowledgment failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
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
      toast.success('Policy published', {
        description: 'Targeted employees see it immediately; the weekly nag chases stragglers.',
      });
      setPublishOpen(false);
      setForm({ title: '', effectiveDate: todayISOIST(), summary: '', content: '' });
      await load();
    } catch (cause) {
      toast.error('Publish failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const tileColumns: Column<AckTileRow>[] = [
    { key: 'title', header: 'Policy', width: 'minmax(220px,2fr)', render: (row) => row.title },
    { key: 'eff', header: 'Effective', width: '110px', render: (row) => row.effectiveDate },
    { key: 'targeted', header: 'Targeted', width: '100px', numeric: true, render: (row) => row.targeted },
    { key: 'acked', header: 'Already acknowledged', width: '140px', numeric: true, render: (row) => row.acknowledged },
    {
      key: 'pct',
      header: 'Coverage',
      width: 'minmax(160px,1fr)',
      render: (row) => (
        <SegmentedProgress
          label={`${String(row.pct)}% of ${String(row.targeted)}`}
          primary={row.acknowledged}
          total={Math.max(row.targeted, 1)}
        />
      ),
    },
  ];

  const pending = mine.filter((policy) => policy.requiresAcknowledgment && !policy.acknowledgedAt);
  const acked = mine.filter((policy) => policy.acknowledgedAt !== null).length;
  const firstPending = pending[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Read first — then you are covered"
        title="Policies"
        description={
          mine.length > 0
            ? `${String(acked)} of ${String(mine.length)} already acknowledged.`
            : 'Policies aimed at you appear here the moment HR publishes them.'
        }
        actions={
          canPublish && (
            <Button
              variant="secondary"
              leadingIcon={<FileUp className="size-4" />}
              onClick={() => {
                setPublishOpen(true);
              }}
            >
              Publish a policy
            </Button>
          )
        }
      />

      {error && (
        <Card>
          <EmptyState
            icon={<ScrollText />}
            title="Policies could not be loaded"
            description={error}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        </Card>
      )}

      {mine.length > 0 && (
        <DarkCard className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="text-xs font-medium tracking-tight text-hero-muted">
              Already on your list
            </p>
            <p className="mt-3 text-5xl font-light tabular-nums">
              <KpiNumber value={mine.length} />
            </p>
            <p className="mt-1 text-sm text-hero-muted">
              {`${String(acked)} of ${String(mine.length)} already acknowledged`}
              {pending.length > 0
                ? ` · ${firstPending?.title ?? 'the next one'} still needs your read`
                : ' — you are covered'}
            </p>
          </div>
          {firstPending !== undefined && (
            <Button
              variant="primary"
              leadingIcon={<CheckCircle2 className="size-4" />}
              onClick={() => void openReader(firstPending)}
            >
              Read {firstPending.title}
            </Button>
          )}
        </DarkCard>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mine.map((policy) => (
          <Card key={policy.id} interactive className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">{policy.title}</h2>
              {policy.requiresAcknowledgment &&
                (policy.acknowledgedAt ? (
                  <StatusBadge tone="positive">already acknowledged</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">needs your read</StatusBadge>
                ))}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Effective {policy.effectiveDate}</p>
            {policy.bodySummary && (
              <p className="mt-3 text-sm leading-6 text-ink-muted">{policy.bodySummary}</p>
            )}
            <div className="mt-auto flex gap-2 pt-4">
              <Button size="sm" variant="ghost" onClick={() => void openReader(policy)}>
                Read
              </Button>
              {policy.requiresAcknowledgment && !policy.acknowledgedAt && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onClick={() => void acknowledge(policy)}
                >
                  I have read this
                </Button>
              )}
            </div>
          </Card>
        ))}
        {mine.length === 0 && !loading && !error && (
          <Card className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={<BookOpenCheck />}
              title="No policy is aimed at you yet"
              description="When HR publishes a plant or company policy, it appears here so you can read it before the acknowledgment deadline. Nothing is waiting on you until then."
            />
          </Card>
        )}
      </div>

      {seesTile && (
        <Card padded={false}>
          <div className="p-5 pb-1">
            <CardHeader
              title="How many people are already covered"
              subtitle="Live · acknowledged of targeted — not a stored percentage"
            />
          </div>
          <DataTable
            rows={tile}
            columns={tileColumns}
            rowKey={(row) => String(row.id)}
            maxHeight={360}
            empty={
              <EmptyState
                icon={<BookOpenCheck />}
                title="No acknowledgment-required policies yet"
                description="Coverage appears here the moment a policy that needs a read is published."
              />
            }
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
            <Button
              variant="primary"
              loading={busy}
              leadingIcon={<CheckCircle2 className="size-4" />}
              onClick={() => void acknowledge(reader.policy)}
            >
              I have read this — mark me covered
            </Button>
          ) : undefined
        }
        width={560}
      >
        <article
          className="whitespace-pre-wrap text-sm leading-7 text-ink"
          dangerouslySetInnerHTML={{ __html: reader?.content ?? '' }}
        />
      </Drawer>

      <Drawer
        open={publishOpen}
        onClose={() => {
          setPublishOpen(false);
        }}
        title="Publish a policy"
        subtitle="Effective date defaults to today. Employees see it as soon as you publish."
        footer={
          <Button variant="primary" loading={busy} onClick={() => void publish()}>
            Publish for everyone targeted
          </Button>
        }
        width={560}
      >
        <div className="space-y-4">
          {form.title.trim().length > 0 && (
            <div className="rounded-row bg-surface-2 px-4 py-3">
              <p className="text-xs text-ink-muted">Employees will see</p>
              <p className="mt-1 text-sm font-semibold text-ink">{form.title.trim()}</p>
              <p className="mt-1 text-xs text-ink-muted">Effective {form.effectiveDate}</p>
            </div>
          )}
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
