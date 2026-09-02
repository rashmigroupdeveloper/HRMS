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

export function PendingModule({ phase, task, description, endpoint, action }: PendingModuleProps) {
  return (
    <Card>
      <EmptyState
        icon={<Hourglass />}
        title={`Awaiting the ${phase} backend`}
        description={description}
        action={
          action ?? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Pill>{phase}</Pill>
                <Pill>{task}</Pill>
              </div>
              {endpoint !== undefined && (
                <details className="max-w-sm text-left text-xs text-ink-muted">
                  <summary className="cursor-pointer font-medium text-ink">For the build team</summary>
                  <code className="mt-2 block rounded-row bg-surface-2 px-2 py-1">{endpoint}</code>
                </details>
              )}
            </div>
          )
        }
      />
      <p className="mt-4 text-center text-xs leading-5 text-ink-muted">
        The screen is built and wired. Nothing is shown here rather than showing numbers that were
        never computed — see{' '}
        <Link to="/reports" className="underline underline-offset-2">
          the reports catalog
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
