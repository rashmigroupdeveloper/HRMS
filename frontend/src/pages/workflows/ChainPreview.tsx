/**
 * SHF-16 — who will approve this, in this order, with SLAs.
 * Composes Timeline; not a new primitive.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Timeline, type TimelineStep } from '../../ui';

export interface ChainPreviewStep {
  step: number;
  approverSpec: string;
  slaHours: number;
  vacant: boolean;
  userId: number | null;
  displayName: string | null;
  delegatedFromUserId: number | null;
  delegatedFromName: string | null;
}

function specLabel(spec: string): string {
  if (spec === 'reporting_manager') return 'Reporting manager';
  if (spec === 'functional_manager') return 'Functional manager';
  if (spec.startsWith('role:')) return `Role ${spec.slice('role:'.length).replaceAll('_', ' ')}`;
  if (spec.startsWith('user:')) return 'Named approver';
  return spec;
}

export function stepsToTimeline(steps: ChainPreviewStep[]): TimelineStep[] {
  return steps.map((step, index) => {
    const who = step.vacant
      ? `${specLabel(step.approverSpec)} (vacant — will be skipped)`
      : (step.displayName ?? specLabel(step.approverSpec));
    const delegated =
      step.delegatedFromName !== null
        ? `Delegated from ${step.delegatedFromName}`
        : specLabel(step.approverSpec);
    return {
      id: `step-${String(step.step)}`,
      title: who,
      timestamp: `${String(step.slaHours)}h SLA`,
      description: step.vacant ? delegated : delegated,
      state: index === 0 && !step.vacant ? 'current' : 'pending',
    };
  });
}

export function ChainPreview({ definitionCode }: { definitionCode: string }) {
  const [steps, setSteps] = useState<ChainPreviewStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void apiFetch<ChainPreviewStep[]>(
      `/api/workflows/preview?definitionCode=${encodeURIComponent(definitionCode)}`,
    )
      .then((rows) => {
        if (!cancelled) setSteps(rows);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSteps(null);
          setError(cause instanceof Error ? cause.message : 'Could not load the approval chain.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [definitionCode]);

  if (error !== null) {
    return (
      <p className="rounded-row bg-surface-2 px-4 py-3 text-sm text-ink-muted" role="status">
        Approval chain unavailable: {error}
      </p>
    );
  }
  if (steps === null) {
    return (
      <p className="text-sm text-ink-muted" aria-live="polite">
        Loading who will approve this…
      </p>
    );
  }
  if (steps.length === 0) {
    return (
      <p className="rounded-row bg-surface-2 px-4 py-3 text-sm text-ink-muted">
        No approval chain is configured for this request type.
      </p>
    );
  }

  return (
    <div className="rounded-row bg-surface-2 px-4 py-3">
      <p className="mb-3 text-sm font-semibold text-ink">Who will approve this</p>
      <Timeline steps={stepsToTimeline(steps)} />
    </div>
  );
}
