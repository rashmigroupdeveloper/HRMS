/**
 * Engagement & Workplace Communication Console (M10, EN-01..04, C34, SOW-208..217).
 *
 * Implements:
 *   1. Company Announcements (EN-01): targeted audience filters, attachments,
 *      publisher catalog, and immutable audit withdrawal.
 *   2. Pulse Polls (EN-02, EN-03): live voting, single-ballot deduplication,
 *      and cryptographic Anonymity Firewall (HMAC salt + userId + pollId).
 *   3. Structured Surveys (C34, EN-03): multi-question survey instrument
 *      (1-5 ratings, single choices, qualitative text) with anonymized analytics.
 *   4. Policy Compliance (EN-04, CORE-13): link to mandatory policy acknowledgment.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Lock,
  Megaphone,
  MessageSquareHeart,
  Paperclip,
  Plus,
  ShieldCheck,
  Vote,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import {
  Button,
  Card,
  DarkCard,
  Drawer,
  EmptyState,
  PageHeader,
  Pill,
  Select,
  StatusBadge,
  TextField,
  Textarea,
  toast,
} from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';

// ── Interfaces ─────────────────────────────────────────────────────────────

interface Announcement {
  id: number;
  title: string;
  body: string;
  attachmentDocumentId?: number | null;
  publishedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  publishedByEmail: string | null;
}

interface Poll {
  id: number;
  question: string;
  options: string[];
  kind: 'poll' | 'pulse';
  isAnonymous: boolean;
  opensAt: string;
  closesAt: string | null;
  isActive: boolean;
  hasResponded: boolean;
}

interface PollResult {
  pollId: number;
  question: string;
  isAnonymous: boolean;
  totalResponses: number;
  options: { index: number; label: string; votes: number }[];
  comments: { comment: string; byEmail: string | null }[];
}

interface SurveyQuestion {
  id: string;
  prompt: string;
  type: 'rating' | 'choice' | 'text';
  choices?: string[] | undefined;
}

interface Survey {
  id: number;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  isAnonymous: boolean;
  opensAt: string;
  closesAt: string | null;
  isActive: boolean;
  hasResponded: boolean;
}

interface SurveyResult {
  surveyId: number;
  title: string;
  isAnonymous: boolean;
  totalResponses: number;
  recommendations: string[];
  questionResults: {
    questionId: string;
    prompt: string;
    type: 'rating' | 'choice' | 'text';
    averageRating?: number;
    distribution?: { stars: number; count: number }[];
    options?: { label: string; votes: number }[];
    textSamples?: string[];
  }[];
}

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

// ── Main Page Component ───────────────────────────────────────────────────

export function EngagementPage({ user }: { user?: SessionUser }) {
  const canPublish = user ? hasPermission(user, 'engagement.publish') : false;
  const [tab, setTab] = useState<'announcements' | 'polls' | 'surveys'>('announcements');
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Engagement"
        title="Engagement"
        description="Announcements, anonymous pulse polls and surveys for the people you choose."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
              <Button
                size="sm"
                variant={tab === 'announcements' ? 'hero' : 'ghost'}
                leadingIcon={<Megaphone className="size-4" />}
                onClick={() => { setTab('announcements'); }}
              >
                Announcements
              </Button>
              <Button
                size="sm"
                variant={tab === 'polls' ? 'hero' : 'ghost'}
                leadingIcon={<Vote className="size-4" />}
                onClick={() => { setTab('polls'); }}
              >
                Pulse Polls
              </Button>
              <Button
                size="sm"
                variant={tab === 'surveys' ? 'hero' : 'ghost'}
                leadingIcon={<MessageSquareHeart className="size-4" />}
                onClick={() => { setTab('surveys'); }}
              >
                Surveys
              </Button>
            </div>
            <Link to="/policies">
              <Button size="sm" variant="secondary" leadingIcon={<FileText className="size-4" />}>
                Policies
              </Button>
            </Link>
          </div>
        }
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold text-hero-muted">
          How it works
        </p>
        <h2 className="mt-4 max-w-xl text-3xl font-light tracking-tight text-hero-ink">
          The right people hear it. Answers stay anonymous.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-hero-muted">
          Announcements reach only the plants, departments and categories you choose. Pulse polls
          and surveys never link a response back to the person who gave it, so feedback stays
          honest.
        </p>
      </DarkCard>

      {tab === 'announcements' && (
        <AnnouncementsTab
          canPublish={canPublish}
          reloadKey={reloadKey}
          onChanged={() => { setReloadKey((k) => k + 1); }}
        />
      )}

      {tab === 'polls' && (
        <PollsTab
          canPublish={canPublish}
          reloadKey={reloadKey}
          onChanged={() => { setReloadKey((k) => k + 1); }}
        />
      )}

      {tab === 'surveys' && (
        <SurveysTab
          canPublish={canPublish}
          reloadKey={reloadKey}
          onChanged={() => { setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

// ── 1. Announcements Tab ──────────────────────────────────────────────────

function AnnouncementsTab({
  canPublish,
  reloadKey,
  onChanged,
}: {
  canPublish: boolean;
  reloadKey: number;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [catalogMode, setCatalogMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        canPublish && catalogMode
          ? '/api/engagement/announcements/all'
          : '/api/engagement/announcements';
      const data = await apiFetch<Announcement[]>(endpoint);
      setItems(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load announcements.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canPublish, catalogMode]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const handleWithdraw = async (id: number) => {
    try {
      await apiFetch(`/api/engagement/announcements/${String(id)}/withdraw`, { method: 'POST' });
      toast.success('Announcement withdrawn', {
        description: 'Removed from active employee feeds while preserved in audit log.',
      });
      onChanged();
    } catch (cause) {
      toast.error('Could not withdraw announcement', {
        description: cause instanceof Error ? cause.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Company Announcements</h3>
          <p className="text-xs text-ink-muted">
            {catalogMode ? 'Full audit catalogue (includes withdrawn & expired)' : 'Active announcements targeted to your profile'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canPublish && (
            <>
              <Button
                size="sm"
                variant={catalogMode ? 'primary' : 'ghost'}
                onClick={() => { setCatalogMode((v) => !v); }}
              >
                {catalogMode ? 'Showing Full Catalog' : 'View Full Catalog'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => { setPublishing(true); }}
              >
                Publish Announcement
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone />}
            title="No announcements"
            description={catalogMode ? 'No announcements published yet.' : 'You are all caught up.'}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="relative flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-base font-semibold text-ink">{item.title}</h4>
                  <div className="flex items-center gap-1.5">
                    {!item.isActive && <StatusBadge tone="neutral">Withdrawn</StatusBadge>}
                    <span className="text-xs text-ink-muted">{stamp(item.publishedAt)}</span>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">
                  {item.body}
                </p>
                {item.attachmentDocumentId && (
                  <div className="mt-3 flex items-center gap-2">
                    <StatusBadge tone="info">
                      <Paperclip className="mr-1 inline size-3" />
                      Attachment #{item.attachmentDocumentId}
                    </StatusBadge>
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-subtle">
                <span>By {item.publishedByEmail ?? 'System'}</span>
                {canPublish && item.isActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleWithdraw(item.id)}
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <PublishAnnouncementDrawer
        open={publishing}
        onClose={() => { setPublishing(false); }}
        onPublished={() => {
          setPublishing(false);
          onChanged();
        }}
      />
    </div>
  );
}

function PublishAnnouncementDrawer({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachmentId, setAttachmentId] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const submit = async () => {
    if (title.trim() === '' || body.trim() === '') {
      setError('Please provide a title and body.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/engagement/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          attachmentDocumentId: attachmentId.trim() ? Number(attachmentId.trim()) : null,
          audience: categories.length > 0 ? { categories } : undefined,
        }),
      });
      toast.success('Announcement published', {
        description: 'Delivered to designated employee feeds immediately.',
      });
      setTitle('');
      setBody('');
      setAttachmentId('');
      setCategories([]);
      onPublished();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish announcement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Publish Announcement"
      subtitle="Broadcast to company or targeted workforce segment"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Publish Now
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <TextField
          label="Title"
          placeholder="e.g. Plant Safety Protocol Update"
          value={title}
          onChange={(e) => { setTitle(e.currentTarget.value); }}
        />
        <Textarea
          label="Content"
          placeholder="Detailed announcement copy..."
          rows={6}
          value={body}
          onChange={(e) => { setBody(e.currentTarget.value); }}
        />
        <TextField
          label="Attachment Document ID (optional)"
          placeholder="e.g. 1042"
          value={attachmentId}
          onChange={(e) => { setAttachmentId(e.currentTarget.value); }}
        />
        <div>
          <label className="text-xs font-semibold text-ink">Target Categories (Leave empty for All)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { code: 'white_collar', label: 'White Collar' },
              { code: 'blue_collar', label: 'Blue Collar / Works' },
              { code: 'contract', label: 'Contract' },
              { code: 'trainee', label: 'Trainees' },
            ].map((c) => {
              const active = categories.includes(c.code);
              return (
                <Button
                  key={c.code}
                  size="sm"
                  variant={active ? 'primary' : 'ghost'}
                  onClick={() => { toggleCategory(c.code); }}
                >
                  {c.label}
                </Button>
              );
            })}
          </div>
        </div>
        {error && <p className="text-xs text-negative-ink">{error}</p>}
      </div>
    </Drawer>
  );
}

// ── 2. Pulse Polls Tab ────────────────────────────────────────────────────

function PollsTab({
  canPublish,
  reloadKey,
  onChanged,
}: {
  canPublish: boolean;
  reloadKey: number;
  onChanged: () => void;
}) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [activeResult, setActiveResult] = useState<PollResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedOption, setSelectedOption] = useState<Record<number, number>>({});
  const [comment, setComment] = useState<Record<number, string>>({});
  const [voting, setVoting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Poll[]>('/api/engagement/polls');
      setPolls(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load polls.');
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const handleVote = async (pollId: number) => {
    const optIndex = selectedOption[pollId];
    if (optIndex === undefined) {
      toast.error('Select an option to cast your vote');
      return;
    }
    const rawComment = comment[pollId]?.trim();
    setVoting(pollId);
    try {
      await apiFetch(`/api/engagement/polls/${String(pollId)}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          optionIndex: optIndex,
          comment: rawComment ?? undefined,
        }),
      });
      toast.success('Vote recorded', {
        description: 'Pseudonymized cryptographic ballot token confirmed.',
      });
      onChanged();
    } catch (cause) {
      toast.error('Vote failed', {
        description: cause instanceof Error ? cause.message : 'Unknown error',
      });
    } finally {
      setVoting(null);
    }
  };

  const viewResults = async (pollId: number) => {
    try {
      const res = await apiFetch<PollResult>(`/api/engagement/polls/${String(pollId)}/results`);
      setActiveResult(res);
    } catch (cause) {
      toast.error('Could not load poll tally', {
        description: cause instanceof Error ? cause.message : 'Unknown error',
      });
    }
  };

  const handleClose = async (pollId: number) => {
    try {
      await apiFetch(`/api/engagement/polls/${String(pollId)}/close`, { method: 'POST' });
      toast.success('Poll closed');
      onChanged();
    } catch (cause) {
      toast.error('Could not close poll', {
        description: cause instanceof Error ? cause.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Pulse Polls & Mini Check-ins</h3>
          <p className="text-xs text-ink-muted">
            Single-click voice with permanent cryptographic anonymity enforcement
          </p>
        </div>
        {canPublish && (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus className="size-4" />}
            onClick={() => { setCreating(true); }}
          >
            Create Poll
          </Button>
        )}
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={() => void load()} />
      ) : polls.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Vote />}
            title="No active polls"
            description="When a pulse poll opens for your unit, it will appear here."
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {polls.map((p) => (
            <Card key={p.id} className="flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {p.isAnonymous ? (
                      <StatusBadge tone="positive">
                        <Lock className="mr-1 inline size-3" />
                        HMAC Anonymous Firewall
                      </StatusBadge>
                    ) : (
                      <Pill>Named Poll</Pill>
                    )}
                    <StatusBadge tone="info">{p.kind === 'pulse' ? 'Pulse Check' : 'Poll'}</StatusBadge>
                  </div>
                  <span className="text-xs text-ink-muted">Opened {stamp(p.opensAt)}</span>
                </div>

                <h4 className="mt-3 text-base font-semibold text-ink">{p.question}</h4>

                {!p.hasResponded ? (
                  <div className="mt-4 space-y-2">
                    {p.options.map((opt, idx) => (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-center gap-3 rounded-row border p-3 text-sm transition-[background-color,border-color,color] duration-(--motion-micro) ${
                          selectedOption[p.id] === idx
                            ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] font-medium text-ink'
                            : 'border-line hover:border-line-strong text-ink-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`poll-${String(p.id)}`}
                          checked={selectedOption[p.id] === idx}
                          onChange={() =>
                            { setSelectedOption((prev) => ({ ...prev, [p.id]: idx })); }
                          }
                          className="accent-accent"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                    <div className="pt-2">
                      <TextField
                        label="Optional feedback note"
                        placeholder="Add optional confidential comment..."
                        value={comment[p.id] ?? ''}
                        onChange={(e) =>
                          { setComment((prev) => ({ ...prev, [p.id]: e.currentTarget.value })); }
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-row bg-surface-2 p-4 text-center">
                    <CheckCircle2 className="mx-auto size-6 text-positive-ink" />
                    <p className="mt-1 text-sm font-semibold text-ink">You have answered this poll</p>
                    <p className="text-xs text-ink-muted">
                      Your response has been safely sealed and factored into the aggregate tally.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={<BarChart3 className="size-4" />}
                  onClick={() => void viewResults(p.id)}
                >
                  View Tally
                </Button>
                <div className="flex items-center gap-2">
                  {canPublish && p.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => void handleClose(p.id)}>
                      Close Poll
                    </Button>
                  )}
                  {!p.hasResponded && (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={voting === p.id}
                      onClick={() => void handleVote(p.id)}
                    >
                      Submit Vote
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Results Drawer */}
      <Drawer
        open={activeResult !== null}
        onClose={() => { setActiveResult(null); }}
        title={activeResult?.question ?? 'Poll Results'}
        subtitle={
          activeResult
            ? `Total ballots: ${activeResult.totalResponses.toLocaleString('en-IN')} · ${
                activeResult.isAnonymous ? 'Anonymity Firewall Protected' : 'Named Feedback'
              }`
            : undefined
        }
      >
        {activeResult && (
          <div className="space-y-6">
            <div className="space-y-4">
              {activeResult.options.map((opt) => {
                const pct =
                  activeResult.totalResponses > 0
                    ? Math.round((opt.votes / activeResult.totalResponses) * 100)
                    : 0;
                return (
                  <div key={opt.index} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-ink">
                      <span>{opt.label}</span>
                      <span>
                        {opt.votes} votes ({pct}%)
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full w-full origin-left bg-accent transition-transform duration-(--motion-medium) ease-(--ease-out-strong)"
                        style={{ transform: `scaleX(${String(pct / 100)})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {activeResult.comments.length > 0 && (
              <div className="border-t border-line pt-4 space-y-3">
                <h5 className="text-xs font-semibold text-ink-muted">
                  Feedback Comments ({activeResult.comments.length})
                </h5>
                <div className="space-y-2">
                  {activeResult.comments.map((c, i) => (
                    <div key={i} className="rounded-row bg-surface-2 p-3 text-xs">
                      <p className="text-ink">{c.comment}</p>
                      <p className="mt-1 text-ink-subtle">
                        {c.byEmail ? `By ${c.byEmail}` : 'Anonymous respondent'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <CreatePollDrawer
        open={creating}
        onClose={() => { setCreating(false); }}
        onCreated={() => {
          setCreating(false);
          onChanged();
        }}
      />
    </div>
  );
}

function CreatePollDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['Yes', 'No']);
  const [kind, setKind] = useState<'poll' | 'pulse'>('poll');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOption = (idx: number, val: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const addOption = () => {
    if (options.length < 8) setOptions((prev) => [...prev, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    const cleanOpts = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (question.trim() === '' || cleanOpts.length < 2) {
      setError('Please provide a question and at least 2 non-empty options.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/engagement/polls', {
        method: 'POST',
        body: JSON.stringify({
          question: question.trim(),
          options: cleanOpts,
          kind,
          isAnonymous,
        }),
      });
      toast.success('Poll created', {
        description: isAnonymous
          ? 'Anonymity firewall lock applied permanently.'
          : 'Named responses enabled.',
      });
      setQuestion('');
      setOptions(['Yes', 'No']);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create poll.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Create Poll or Pulse Check"
      subtitle="Gather fast sentiment across the organisation"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Create Poll
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <TextField
          label="Question"
          placeholder="e.g. How satisfied are you with the new canteen shift timing?"
          value={question}
          onChange={(e) => { setQuestion(e.currentTarget.value); }}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={kind}
            options={[
              { value: 'poll', label: 'Standard Poll' },
              { value: 'pulse', label: 'Pulse Check' },
            ]}
            onChange={(v) => { setKind(v as 'poll' | 'pulse'); }}
          />
          <Select
            label="Anonymity Firewall"
            value={isAnonymous ? 'anon' : 'named'}
            options={[
              { value: 'anon', label: 'Cryptographic Anonymous (Locked)' },
              { value: 'named', label: 'Named (HR Visible)' },
            ]}
            onChange={(v) => { setIsAnonymous(v === 'anon'); }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink">Options ({options.length}/8)</label>
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-1">
                <TextField
                  label={`Option ${String(idx + 1)}`}
                  value={opt}
                  placeholder={`e.g. Option ${String(idx + 1)}`}
                  onChange={(e) => { updateOption(idx, e.currentTarget.value); }}
                />
              </div>
              {options.length > 2 && (
                <div className="pt-5">
                  <Button size="sm" variant="ghost" onClick={() => { removeOption(idx); }}>
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
          {options.length < 8 && (
            <Button size="sm" variant="secondary" onClick={addOption}>
              + Add Option
            </Button>
          )}
        </div>

        {error && <p className="text-xs text-negative-ink">{error}</p>}
      </div>
    </Drawer>
  );
}

// ── 3. Structured Surveys Tab ─────────────────────────────────────────────

function SurveysTab({
  canPublish,
  reloadKey,
  onChanged,
}: {
  canPublish: boolean;
  reloadKey: number;
  onChanged: () => void;
}) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, unknown>>({});
  const [activeResult, setActiveResult] = useState<SurveyResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Survey[]>('/api/engagement/surveys');
      setSurveys(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load surveys.');
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const submitSurvey = async () => {
    if (!activeSurvey) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/engagement/surveys/${String(activeSurvey.id)}/respond`, {
        method: 'POST',
        body: JSON.stringify({ answers: surveyAnswers }),
      });
      toast.success('Survey completed', {
        description: 'Thank you for your valuable feedback.',
      });
      setActiveSurvey(null);
      setSurveyAnswers({});
      onChanged();
    } catch (cause) {
      toast.error('Submission failed', {
        description: cause instanceof Error ? cause.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const viewResults = async (surveyId: number) => {
    try {
      const res = await apiFetch<{
        surveyId: number;
        title: string;
        isAnonymous: boolean;
        totalResponses: number;
        recommendations?: string[];
        questions: {
          questionId: string;
          prompt: string;
          type: 'rating' | 'choice' | 'text';
          avgRating?: number | null;
          ratingDistribution?: Record<string, number>;
          choiceDistribution?: Record<string, number>;
          textAnswers?: { answer: string }[];
        }[];
      }>(`/api/engagement/surveys/${String(surveyId)}/results`);
      setActiveResult({
        surveyId: res.surveyId,
        title: res.title,
        isAnonymous: res.isAnonymous,
        totalResponses: res.totalResponses,
        recommendations: res.recommendations ?? [],
        questionResults: res.questions.map((question) => ({
          questionId: question.questionId,
          prompt: question.prompt,
          type: question.type,
          ...(question.avgRating != null ? { averageRating: question.avgRating } : {}),
          ...(question.ratingDistribution
            ? { distribution: Object.entries(question.ratingDistribution).map(([stars, count]) => ({ stars: Number(stars), count })) }
            : {}),
          ...(question.choiceDistribution
            ? { options: Object.entries(question.choiceDistribution).map(([label, votes]) => ({ label, votes })) }
            : {}),
          ...(question.textAnswers ? { textSamples: question.textAnswers.map((row) => row.answer) } : {}),
        })),
      });
    } catch (cause) {
      toast.error('Could not load survey results', {
        description: cause instanceof Error ? cause.message : 'Unknown error',
      });
    }
  };

  const closeSurvey = async (surveyId: number) => {
    try {
      await apiFetch(`/api/engagement/surveys/${String(surveyId)}/close`, { method: 'POST' });
      toast.success('Survey closed');
      onChanged();
    } catch (cause) {
      toast.error('Could not close survey', {
        description: cause instanceof Error ? cause.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Structured Feedback Surveys</h3>
          <p className="text-xs text-ink-muted">
            Multi-question instruments for workplace culture, plant safety, and operations
          </p>
        </div>
        {canPublish && (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus className="size-4" />}
            onClick={() => { setCreating(true); }}
          >
            Create Survey
          </Button>
        )}
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={() => void load()} />
      ) : surveys.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquareHeart />}
            title="No active surveys"
            description="When a structured feedback survey opens, it will be listed here."
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {surveys.map((s) => (
            <Card key={s.id} className="flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {s.isAnonymous ? (
                      <StatusBadge tone="positive">
                        <ShieldCheck className="mr-1 inline size-3" />
                        Anonymous Firewall
                      </StatusBadge>
                    ) : (
                      <Pill>Identified Survey</Pill>
                    )}
                    <StatusBadge tone="info">{s.questions.length} Questions</StatusBadge>
                  </div>
                  <span className="text-xs text-ink-muted">Opened {stamp(s.opensAt)}</span>
                </div>

                <h4 className="mt-3 text-base font-semibold text-ink">{s.title}</h4>
                {s.description && (
                  <p className="mt-1 text-sm text-ink-muted">{s.description}</p>
                )}

                {s.hasResponded && (
                  <div className="mt-4 rounded-row bg-surface-2 p-3 text-center">
                    <p className="text-xs font-semibold text-ink">
                      Response recorded · Thank you for participating
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={<BarChart3 className="size-4" />}
                  onClick={() => void viewResults(s.id)}
                >
                  View Analytics
                </Button>
                <div className="flex items-center gap-2">
                  {canPublish && s.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => void closeSurvey(s.id)}>
                      Close Survey
                    </Button>
                  )}
                  {!s.hasResponded && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setActiveSurvey(s);
                        setSurveyAnswers({});
                      }}
                    >
                      Take Survey
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Take Survey Drawer */}
      <Drawer
        open={activeSurvey !== null}
        onClose={() => { setActiveSurvey(null); }}
        width={640}
        title={activeSurvey?.title ?? 'Survey'}
        subtitle={activeSurvey?.isAnonymous ? 'Protected by cryptographic anonymity' : 'Attributed survey'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setActiveSurvey(null); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              onClick={() => void submitSurvey()}
            >
              Submit Responses
            </Button>
          </div>
        }
      >
        {activeSurvey && (
          <div className="space-y-6">
            {activeSurvey.questions.map((q, qIdx) => (
              <div key={q.id} className="rounded-row bg-surface-2 p-4 space-y-3">
                <p className="text-sm font-semibold text-ink">
                  {qIdx + 1}. {q.prompt}
                </p>

                {q.type === 'rating' && (
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <Button
                        key={num}
                        size="sm"
                        variant={surveyAnswers[q.id] === num ? 'primary' : 'ghost'}
                        onClick={() =>
                          { setSurveyAnswers((prev) => ({ ...prev, [q.id]: num })); }
                        }
                      >
                        {num} ★
                      </Button>
                    ))}
                  </div>
                )}

                {q.type === 'choice' && (
                  <div className="space-y-2">
                    {(q.choices ?? []).map((ch, chIdx) => (
                      <label
                        key={chIdx}
                        className={`flex cursor-pointer items-center gap-3 rounded-row border p-2.5 text-sm transition-[background-color,border-color,color] duration-(--motion-micro) ${
                          surveyAnswers[q.id] === ch
                            ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] font-medium text-ink'
                            : 'border-line text-ink-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`survey-q-${q.id}`}
                          checked={surveyAnswers[q.id] === ch}
                          onChange={() =>
                            { setSurveyAnswers((prev) => ({ ...prev, [q.id]: ch })); }
                          }
                          className="accent-accent"
                        />
                        <span>{ch}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === 'text' && (
                  <Textarea
                    label="Your response"
                    placeholder="Provide your thoughts in detail..."
                    rows={3}
                    value={typeof surveyAnswers[q.id] === 'string' ? (surveyAnswers[q.id] as string) : ''}
                    onChange={(e) =>
                      { setSurveyAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.currentTarget.value,
                      })); }
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* Survey Analytics Drawer */}
      <Drawer
        open={activeResult !== null}
        onClose={() => { setActiveResult(null); }}
        width={680}
        title={activeResult?.title ?? 'Survey Analytics'}
        subtitle={
          activeResult
            ? `Total participants: ${activeResult.totalResponses.toLocaleString('en-IN')} · ${
                activeResult.isAnonymous ? 'Anonymity Firewall Sealed' : 'Identified'
              }`
            : undefined
        }
      >
        {activeResult && (
          <div className="space-y-6">
            {activeResult.recommendations.length > 0 && (
              <div className="rounded-row bg-surface-2 px-4 py-3">
                <p className="text-sm font-semibold text-ink">What to do with this</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                  {activeResult.recommendations.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            )}
            {activeResult.questionResults.map((qr, idx) => (
              <div key={qr.questionId} className="rounded-row bg-surface-2 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h5 className="text-sm font-semibold text-ink">
                    {idx + 1}. {qr.prompt}
                  </h5>
                  <StatusBadge tone="info">{qr.type}</StatusBadge>
                </div>

                {qr.type === 'rating' && (
                  <div className="space-y-2">
                    <p className="text-2xl font-light text-ink">
                      {qr.averageRating?.toFixed(1) ?? '—'}{' '}
                      <span className="text-xs text-ink-muted">/ 5.0 Average</span>
                    </p>
                    <div className="grid grid-cols-5 gap-2 text-center text-xs text-ink-muted">
                      {(qr.distribution ?? []).map((d) => (
                        <div key={d.stars} className="rounded bg-surface p-1.5">
                          <span className="font-semibold text-ink">{d.stars}★</span>: {d.count}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {qr.type === 'choice' && (
                  <div className="space-y-2">
                    {(qr.options ?? []).map((opt, oIdx) => {
                      const pct =
                        activeResult.totalResponses > 0
                          ? Math.round((opt.votes / activeResult.totalResponses) * 100)
                          : 0;
                      return (
                        <div key={oIdx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-ink">
                            <span>{opt.label}</span>
                            <span>
                              {opt.votes} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                            <div
                              className="h-full bg-accent"
                              style={{ width: `${String(pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {qr.type === 'text' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-ink-muted">
                      Sample Responses ({(qr.textSamples ?? []).length})
                    </p>
                    <div className="space-y-1.5">
                      {(qr.textSamples ?? []).map((txt, tIdx) => (
                        <div key={tIdx} className="rounded bg-surface p-2.5 text-xs text-ink">
                          "{txt}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <CreateSurveyDrawer
        open={creating}
        onClose={() => { setCreating(false); }}
        onCreated={() => {
          setCreating(false);
          onChanged();
        }}
      />
    </div>
  );
}

function CreateSurveyDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    { id: 'q1', prompt: 'Overall workplace culture rating', type: 'rating' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addQuestion = (type: 'rating' | 'choice' | 'text') => {
    const id = `q${String(questions.length + 1)}`;
    const newQ: SurveyQuestion = {
      id,
      prompt: '',
      type,
      choices: type === 'choice' ? ['Option A', 'Option B'] : undefined,
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length > 1) {
      setQuestions((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const updatePrompt = (idx: number, prompt: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[idx];
      if (q) next[idx] = { ...q, prompt };
      return next;
    });
  };

  const submit = async () => {
    if (title.trim() === '' || questions.some((q) => q.prompt.trim() === '')) {
      setError('Provide survey title and valid prompts for all questions.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/engagement/surveys', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          questions,
          isAnonymous,
        }),
      });
      toast.success('Survey created', {
        description: 'Now open to designated employee workforce.',
      });
      setTitle('');
      setDescription('');
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create survey.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={680}
      title="Create Structured Survey"
      subtitle="Design multi-question feedback instruments"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Create Survey
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <TextField
          label="Survey Title"
          placeholder="e.g. Annual Safety & Working Environment Survey 2026"
          value={title}
          onChange={(e) => { setTitle(e.currentTarget.value); }}
        />
        <Textarea
          label="Purpose / Instructions"
          placeholder="Why this survey is being conducted..."
          rows={3}
          value={description}
          onChange={(e) => { setDescription(e.currentTarget.value); }}
        />
        <Select
          label="Anonymity Firewall"
          value={isAnonymous ? 'anon' : 'named'}
          options={[
            { value: 'anon', label: 'Cryptographic Anonymous (Permanent)' },
            { value: 'named', label: 'Named (Identified responses)' },
          ]}
          onChange={(v) => { setIsAnonymous(v === 'anon'); }}
        />

        <div className="space-y-4 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-ink-muted">
              Questions ({questions.length})
            </h5>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => { addQuestion('rating'); }}>
                + Rating
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { addQuestion('choice'); }}>
                + Choice
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { addQuestion('text'); }}>
                + Text
              </Button>
            </div>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="rounded-row bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">
                  Question {idx + 1} ({q.type})
                </span>
                {questions.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => { removeQuestion(idx); }}>
                    Remove
                  </Button>
                )}
              </div>
              <TextField
                label={`Prompt`}
                placeholder="Question prompt..."
                value={q.prompt}
                onChange={(e) => { updatePrompt(idx, e.currentTarget.value); }}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-negative-ink">{error}</p>}
      </div>
    </Drawer>
  );
}
