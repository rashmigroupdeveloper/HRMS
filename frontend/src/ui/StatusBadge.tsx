import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  CircleDot,
} from 'lucide-react';
import { cn } from './cn';

/**
 * StatusBadge — pastel status pill with icon + label. Color is NEVER the only
 * signal (docs/05 §1 rule 6, §7 color-not-only): every tone pairs a Lucide
 * icon and a text label. Tints derive from semantic tokens via color-mix so
 * they read correctly in both themes.
 */

export type StatusTone =
  | 'positive'
  | 'warning'
  | 'negative'
  | 'info'
  | 'neutral';

const TONE_STYLE: Record<StatusTone, string> = {
  positive:
    'bg-[color-mix(in_srgb,var(--positive)_16%,var(--surface))] text-positive',
  warning:
    'bg-[color-mix(in_srgb,var(--warning)_18%,var(--surface))] text-warning',
  negative:
    'bg-[color-mix(in_srgb,var(--negative)_16%,var(--surface))] text-negative',
  info: 'bg-[color-mix(in_srgb,var(--info)_16%,var(--surface))] text-info',
  neutral: 'bg-surface-2 text-ink-muted',
};

const TONE_ICON: Record<StatusTone, ReactNode> = {
  positive: <CheckCircle2 />,
  warning: <Clock />,
  negative: <XCircle />,
  info: <Info />,
  neutral: <CircleDot />,
};

interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  /** Override the default tone icon (still icon + label — never icon-less). */
  icon?: ReactNode;
}

export function StatusBadge({ tone, children, icon }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-xs font-medium [&_svg]:size-3.5',
        TONE_STYLE[tone],
      )}
    >
      {icon ?? TONE_ICON[tone]}
      {children}
    </span>
  );
}

/**
 * Pill — a neutral, unlabeled-tone chip (category, entity, count). Softer than
 * StatusBadge; used where the label itself is the meaning (e.g. "White Collar").
 */
export function Pill({
  children,
  accent = false,
  icon,
}: {
  children: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium [&_svg]:size-3.5',
        accent ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-ink',
      )}
    >
      {icon}
      {children}
    </span>
  );
}
