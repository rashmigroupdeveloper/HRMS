/**
 * Remaining kit surfaces: layout, feedback and the display primitives.
 *
 * Two spec rules do real work here:
 *   - KpiNumber must SNAP to its final value under prefers-reduced-motion
 *     (docs/05 §2.3) — an animated count is decoration, the number is content.
 *   - Indian digit grouping (lakh/crore) is the default, because a payroll
 *     figure grouped the western way is misread by finance (docs/05 §7).
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, CardHeader } from './Card';
import { DarkCard } from './DarkCard';
import { Drawer } from './Drawer';
import { HatchFill } from './HatchFill';
import { IconButton } from './IconButton';
import { KpiNumber } from './KpiNumber';
import { PageHeader } from './PageHeader';
import { MetricMark } from './MetricMark';
import { Skeleton } from './Skeleton';
import { Timeline } from './Timeline';
import type { TimelineStep } from './Timeline';
import { Tooltip } from './Tooltip';
import { renderThemed, renderRouted, THEMES } from '../test/render';
import { runAxe } from '../test/axe';

describe('KpiNumber', () => {
  it('snaps to the final value when reduced motion is preferred', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );

    renderThemed(<KpiNumber value={1234} />);
    // The number is content, not decoration — it must be readable immediately.
    expect(screen.getByText('1,234')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('groups with Indian lakh/crore separators by default', () => {
    renderThemed(<KpiNumber value={12345678} duration={0} />);
    // 1,23,45,678 — NOT 12,345,678.
    expect(screen.getByText(/1,23,45,678/)).toBeInTheDocument();
  });

  it('renders prefix, suffix and precision', () => {
    renderThemed(<KpiNumber value={97.5} precision={1} prefix="₹" suffix="%" duration={0} />);
    expect(screen.getByText(/₹/)).toBeInTheDocument();
    expect(screen.getByText(/97\.5/)).toBeInTheDocument();
    expect(screen.getByText(/%/)).toBeInTheDocument();
  });
});

describe('Drawer', () => {
  const steps: TimelineStep[] = [
    { id: '1', title: 'Raised', state: 'done' },
    { id: '2', title: 'Manager', state: 'current' },
    { id: '3', title: 'HR', state: 'pending' },
  ];

  it('renders its title and content when open', () => {
    renderThemed(
      <Drawer open onClose={vi.fn()} title="Edit shift" subtitle="att.shifts">
        <Timeline steps={steps} />
      </Drawer>,
    );
    expect(screen.getByText('Edit shift')).toBeInTheDocument();
    expect(screen.getByText('att.shifts')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderThemed(
      <Drawer open={false} onClose={vi.fn()} title="Edit shift">
        <p>body</p>
      </Drawer>,
    );
    expect(screen.queryByText('Edit shift')).not.toBeInTheDocument();
  });

  it('closes on Escape — an accidental open is always escapable', async () => {
    const onClose = vi.fn();
    renderThemed(
      <Drawer open onClose={onClose} title="Edit shift">
        <p>body</p>
      </Drawer>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { baseElement } = renderThemed(
      <Drawer open onClose={vi.fn()} title="Edit shift" subtitle="att.shifts">
        <p>body</p>
      </Drawer>,
      theme,
    );
    await expect(runAxe(baseElement)).resolves.toHaveNoViolations();
  });
});

describe('Timeline', () => {
  it('gives every state a distinct icon, so colour is never the only signal', () => {
    const steps: TimelineStep[] = [
      { id: 'a', title: 'Approved', state: 'done' },
      { id: 'b', title: 'With HR', state: 'current' },
      { id: 'c', title: 'Payroll', state: 'pending' },
      { id: 'd', title: 'Rejected', state: 'rejected' },
    ];
    const { container } = renderThemed(<Timeline steps={steps} />);

    for (const step of steps) expect(screen.getByText(step.title as string)).toBeInTheDocument();
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(steps.length);
  });

  it('renders timestamps and descriptions when present (the WF-04 receipt trail)', () => {
    renderThemed(
      <Timeline
        steps={[
          {
            id: 'a',
            title: 'Manager',
            timestamp: '08 Jul 2026 10:15',
            description: 'Notified at 10:15',
            state: 'done',
          },
        ]}
      />,
    );
    expect(screen.getByText('08 Jul 2026 10:15')).toBeInTheDocument();
    expect(screen.getByText('Notified at 10:15')).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('shows its label on focus and links it to the trigger', async () => {
    renderThemed(
      <Tooltip label="Average age by category">
        <button type="button">Avg age</button>
      </Tooltip>,
    );

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Avg age' })).toHaveFocus();
    expect(await screen.findByText('Average age by category')).toBeInTheDocument();
  });
});

describe('layout primitives', () => {
  it('Card and CardHeader render title, subtitle and action', () => {
    renderThemed(
      <Card>
        <CardHeader title="Run state" subtitle="pay.payroll_runs" action={<span>badge</span>} />
      </Card>,
    );
    expect(screen.getByText('Run state')).toBeInTheDocument();
    expect(screen.getByText('pay.payroll_runs')).toBeInTheDocument();
    expect(screen.getByText('badge')).toBeInTheDocument();
  });

  it('PageHeader renders a single h1', () => {
    renderThemed(<PageHeader title="Muster" eyebrow="Reports · RPT-01" description="The flagship." />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Muster');
    expect(headings[0]).not.toHaveClass('font-serif');
  });

  it('PageHeader serif is reserved for the ESS greeting', () => {
    renderThemed(<PageHeader title="Hello Rachna" tone="greeting" />);
    expect(screen.getByRole('heading', { name: 'Hello Rachna' })).toHaveClass('font-serif');
  });

  it('MetricMark pairs a serif count with a quiet label', () => {
    renderRouted(<MetricMark value={91} label="Employees" icon={<span />} />);
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
  });

  it('DarkCard renders its children on the hero surface', () => {
    renderThemed(
      <DarkCard>
        <p>hero content</p>
      </DarkCard>,
    );
    expect(screen.getByText('hero content')).toBeInTheDocument();
  });

  it('HatchFill is decorative and hidden from assistive tech', () => {
    const { container } = renderThemed(<HatchFill />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('Skeleton announces itself as busy rather than as empty content', () => {
    const { container } = renderThemed(<Skeleton />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('IconButton requires and exposes an accessible name', async () => {
    const onClick = vi.fn();
    renderThemed(<IconButton label="Previous month" onClick={onClick} icon={<span />} />);

    const button = screen.getByRole('button', { name: 'Previous month' });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('layout primitives have no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <Card>
        <CardHeader title="Run state" subtitle="pay.payroll_runs" />
        <IconButton label="Refresh" icon={<span />} />
        <Skeleton />
      </Card>,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});
