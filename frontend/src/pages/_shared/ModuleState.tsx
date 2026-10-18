/**
 * Shared scaffolding for surfaces whose backend lands in a later phase.
 *
 * docs/05 §4.8 sets the rule explicitly — "*Contract column reads 'Phase 4'
 * until that module exists — never fake data*". This is that rule made
 * reusable: a screen is built for the person who landed here, names what they
 * will get, and when the endpoint isn't there yet it says so plainly instead
 * of rendering invented numbers.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { Card, EmptyState, Pill } from '../../ui';

interface PendingModuleProps {
  /** Plan phase that delivers the backend, e.g. "Phase 2". */
  phase: string;
  /** Plan task id(s), e.g. "P2-T04". */
  task: string;
  /** What this screen will show once the backend lands. */
  description: string;
  /** The endpoint this page already calls. */
  endpoint?: string;
  action?: ReactNode;
}

export function PendingModule({ description, action }: PendingModuleProps) {
  // `phase` / `task` / `endpoint` stay in the props for traceability in code review, but
  // are never rendered: plan ids and API paths are build-team detail, not
  // something an employee or HR head should read (.impeccable critique P1).
  return (
    <Card>
      <EmptyState
        icon={<Hourglass />}
        title="Not live yet"
        description={description}
        action={action ?? <Pill>Coming soon</Pill>}
      />
      <p className="mt-4 text-center text-sm leading-6 text-ink-muted">
        Nothing is shown here rather than numbers that were never computed. See{' '}
        <Link to="/reports" className="font-medium text-ink underline underline-offset-2">
          Reports
        </Link>{' '}
        for what is live today.
      </p>
    </Card>
  );
}

/** Page heading shared by every module surface (docs/05 §3 shell). */
export function ModuleHeader({
  eyebrow,
  title,
  intro,
  action,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-sm text-ink-muted">{eyebrow}</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{intro}</p>
      </div>
      {action}
    </header>
  );
}
