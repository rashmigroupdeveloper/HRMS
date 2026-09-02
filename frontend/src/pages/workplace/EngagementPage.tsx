/**
 * Engagement (M10, EN-01..04) — announcements, polls, pulse surveys.
 *
 * Policy acknowledgement (CORE-13) is already live under /policies. Until the
 * rest of the feed lands, this screen explains what people will get and shows
 * no invented posts.
 */
import { BarChart3, Megaphone, MessageSquareHeart, Vote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, DarkCard, EmptyState, PageHeader } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

interface Announcement {
  id: number;
  title: string;
  body: string;
  publishedAt: string;
  publishedByEmail: string | null;
}

const SURFACES = [
  {
    icon: Megaphone,
    title: 'Announcements',
    body: 'Reach a plant, a department, or a category — not the whole group by default.',
  },
  {
    icon: Vote,
    title: 'Polls',
    body: 'Ask a question. If a poll is anonymous, that promise cannot be switched off later.',
  },
  {
    icon: MessageSquareHeart,
    title: 'Pulse checks',
    body: 'Short, repeating check-ins so engagement is a habit, not a once-a-year survey.',
  },
  {
    icon: BarChart3,
    title: 'Policy acknowledgements',
    body: 'Already live — who has read a policy, and a reminder that only reaches those who have not.',
  },
];

export function EngagementPage() {
  const announcements = useModuleResource<Announcement[]>('/api/engagement/announcements');

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Engagement"
        title="Communication"
        description="Hear from the company, and be heard back — announcements, polls and short pulse checks that reach the people they are meant for."
        actions={
          <Link to="/policies">
            <Button size="sm" variant="secondary">
              Open policies
            </Button>
          </Link>
        }
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          What you will do here
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          Hear from the company. Be heard back.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will publish announcements, run polls, and send short pulse checks to the people they
          are meant for. Policy acknowledgements already live under Policies. Until the feed is
          ready, we show nothing rather than invented posts.
        </p>
      </DarkCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {SURFACES.map((surface) => (
          <Card key={surface.title}>
            <div className="flex items-start gap-3">
              <surface.icon className="mt-0.5 size-5 shrink-0 text-ink-faint" />
              <div>
                <p className="text-sm font-semibold text-ink">{surface.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{surface.body}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {announcements.pending ? (
        <PendingModule
          phase="Phase 3"
          task="EN-02/03"
          description="Polls and pulse checks are still being built. Announcements below are live."
        />
      ) : (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Announcements
          </h2>
          {announcements.data === null || announcements.data.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title="Nothing announced yet"
              description="When something is published to your plant, department or category, it appears here."
            />
          ) : (
            <ul className="space-y-3">
              {announcements.data.map((a) => (
                <li key={a.id}>
                  <Card>
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted">
                      {a.body}
                    </p>
                    <p className="mt-3 text-xs text-ink-faint">
                      {new Date(a.publishedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {a.publishedByEmail === null ? '' : ` · ${a.publishedByEmail}`}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
