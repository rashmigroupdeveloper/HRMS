import type { ReactNode } from 'react';
import { Check, X, Clock, CircleDot } from 'lucide-react';
import { cn } from './cn';

/**
 * Timeline — workflow / approval-chain steps with timestamps (docs/05 §4
 * WF-04 pattern; the anti-PP-14 "every approver + notified_at" receipt trail,
 * docs/05 §4.6). Vertical connector; each node shows its state.
 *
 * States: done (positive check), current (accent ring — the active approver),
 * pending (faint), rejected (negative). Color is never the only signal — each
 * node carries a distinct icon.
 */

export type TimelineState = 'done' | 'current' | 'pending' | 'rejected';

export interface TimelineStep {
  id: string;
  title: ReactNode;
  timestamp?: ReactNode;
  description?: ReactNode;
  state: TimelineState;
}

const NODE: Record<TimelineState, { ring: string; icon: ReactNode }> = {
  done: {
    ring: 'bg-positive text-hero-ink',
    icon: <Check />,
  },
  current: {
    ring: 'bg-accent text-accent-ink ring-4 ring-accent-soft',
    icon: <CircleDot />,
  },
  pending: {
    ring: 'bg-surface-2 text-ink-faint ring-1 ring-inset ring-[var(--line-strong)]',
    icon: <Clock />,
  },
  rejected: {
    ring: 'bg-negative text-hero-ink',
    icon: <X />,
  },
};

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const node = NODE[step.state];
        const last = i === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector */}
            {!last && (
              <span
                aria-hidden
                className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-line"
              />
            )}
            <span
              className={cn(
                'z-10 grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-3.5',
                node.ring,
              )}
            >
              {node.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    'text-sm font-medium',
                    step.state === 'pending' ? 'text-ink-muted' : 'text-ink',
                  )}
                >
                  {step.title}
                </span>
                {step.timestamp && (
                  <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                    {step.timestamp}
                  </span>
                )}
              </div>
              {step.description && (
                <p className="mt-0.5 text-sm text-ink-muted">{step.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
