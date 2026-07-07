import type { ReactNode } from 'react';

/**
 * EmptyState — never a blank region (docs/05 §6 #3, §8). Explains WHY it's empty
 * and offers exactly one next action. Also the "All caught up" surface for a
 * cleared approvals inbox (docs/05 §6). Icon sits in a soft accent circle;
 * illustration warmth stays token-based (no second accent — firewall).
 */

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-accent-soft text-accent-ink [&_svg]:size-6">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
