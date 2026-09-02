/**
 * Employee lifecycle (M5, LC-01..07) — docs/05 §4.6.
 *
 * Three boards behind one route: join, confirm, leave. The boarding/exit
 * register is LIVE today (the same query as the 07:00 plant email). The rest
 * waits on Phase 3 — no invented cases.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, DarkCard, PageHeader, Pill, StatusBadge } from '../../ui';
import { PendingModule } from '../_shared/ModuleState';
import { useModuleResource } from '../_shared/useModuleResource';

type Board = 'onboarding' | 'probation' | 'separation';

interface BoardingExit {
  joins: unknown[];
  exits: unknown[];
}

const BOARDS: { code: Board; label: string; task: string; blurb: string }[] = [
  {
    code: 'onboarding',
    label: 'Onboarding',
    task: 'LC-01 / LC-02',
    blurb:
      'You will convert an accepted offer into an employee record, then IT, Admin and HR each get their own tasks with due dates.',
  },
  {
    code: 'probation',
    label: 'Probation',
    task: 'LC-04',
    blurb:
      'You will see who is due for confirmation, be reminded in time, and confirm salary and letter in one action.',
  },
  {
    code: 'separation',
    label: 'Separations',
    task: 'LC-06 / PAY-15',
    blurb:
      'You will follow a resignation from approval through clearances to full-and-final — and see when each approver was actually told.',
  },
];

export function LifecyclePage() {
  const [board, setBoard] = useState<Board>('onboarding');
  const active = BOARDS.find((b) => b.code === board) ?? BOARDS[0];

  // This one IS live — same endpoint as the 07:00 email (LC-03).
  const today = new Date().toISOString().slice(0, 10);
  const boarding = useModuleResource<BoardingExit>(
    `/api/lifecycle/boarding-exit?from=${today}&to=${today}`,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Lifecycle"
        title="Joining to exit"
        description="Follow someone from their first day to their last — joining, confirmation, and a goodbye that actually notifies every approver."
        actions={
          <div className="flex rounded-full bg-surface-2 p-1">
            {BOARDS.map((b) => (
              <Button
                key={b.code}
                size="sm"
                variant={board === b.code ? 'primary' : 'ghost'}
                onClick={() => {
                  setBoard(b.code);
                }}
              >
                {b.label}
              </Button>
            ))}
          </div>
        }
      />

      <DarkCard padded={false} className="p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          What you will do here
        </p>
        <h2 className="mt-4 max-w-xl text-4xl font-light tracking-tight text-hero-ink">
          Join, confirm, leave — with a receipt at every step.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-hero-muted">
          You will convert an offer, confirm probation, and close an exit so “nobody told me”
          stops being possible. Today’s joins and exits are already live below. The boards
          themselves are still being built, so we show no invented cases.
        </p>
      </DarkCard>

      <Card>
        <CardHeader
          title={active?.label ?? ''}
          subtitle={active?.blurb ?? ''}
          action={<Pill>{active?.task ?? ''}</Pill>}
        />
      </Card>

      <Card>
        <CardHeader
          title="Who joined and left today"
          subtitle="Live now — the same list that goes to plant heads at 07:00."
          action={
            <Link to="/reports/r24-boarding">
              <Button size="sm" variant="secondary">
                Open the register
              </Button>
            </Link>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          {boarding.loading ? (
            <StatusBadge tone="neutral">Checking…</StatusBadge>
          ) : boarding.data ? (
            <>
              <StatusBadge tone="positive">
                {boarding.data.joins.length} joining today
              </StatusBadge>
              <StatusBadge tone="info">{boarding.data.exits.length} exiting today</StatusBadge>
            </>
          ) : (
            <StatusBadge tone="neutral">Register unavailable</StatusBadge>
          )}
        </div>
      </Card>

      <PendingModule
        phase="Phase 3"
        task={active?.task ?? 'LC-01'}
        description="You will run onboarding, probation and exit here. Today’s joins and exits are already live above. The rest is still being built — we show nothing rather than invented cases."
      />
    </div>
  );
}
