/**
 * Warm Editorial component kit (docs/05 §5) — the ONLY UI system in the product
 * (docs/05 §0.1 firewall: no second component library, ever). Every screen
 * composes from here; screens never invent primitives.
 *
 * Stage 0.3 status: core primitives + Crextio-signature set + theme +
 * DataTable / Drawer / ConfirmModal / EmptyState / Timeline / TextField shipped.
 * Still to port (follow-up): FilterPanel, MonthCalendar, RosterGrid,
 * ApprovalInbox, Toast (sonner).
 */

export { cn } from './cn';
export { useTheme } from './theme';
export type { ThemeMode } from './theme';
export { ThemeToggle } from './ThemeToggle';

export { Button } from './Button';
export { IconButton } from './IconButton';
export { TextField } from './TextField';
export { Card, CardHeader } from './Card';
export { DarkCard } from './DarkCard';
export { StatusBadge, Pill } from './StatusBadge';
export type { StatusTone } from './StatusBadge';
export { KpiNumber } from './KpiNumber';

export { HatchFill } from './HatchFill';
export { KpiPillRow } from './KpiPillRow';
export type { KpiPill, PillState } from './KpiPillRow';
export { SegmentedProgress } from './SegmentedProgress';
export { DotMatrix } from './DotMatrix';
export type { Dot, DotState } from './DotMatrix';

export { DataTable } from './DataTable';
export type { Column } from './DataTable';
export { Drawer } from './Drawer';
export { ConfirmModal } from './ConfirmModal';
export { EmptyState } from './EmptyState';
export { Timeline } from './Timeline';
export type { TimelineStep, TimelineState } from './Timeline';
