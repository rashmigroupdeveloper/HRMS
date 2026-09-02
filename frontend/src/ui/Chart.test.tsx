/**
 * Chart primitives (docs/05 §7 "Charts").
 *
 * The chart rules are unusually specific and unusually easy to violate
 * silently, so each is pinned:
 *   - legend ALWAYS visible, never hover-only;
 *   - a gap in the data is a GAP, never a drop to zero;
 *   - every chart offers a table alternative;
 *   - an empty series explains itself — never a blank axis frame;
 *   - points are keyboard-reachable, so tooltips are not mouse-only;
 *   - INR lakh/crore grouping on labels.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart, TrendChart } from './Chart';
import type { ChartPoint } from './Chart';
import { renderThemed, THEMES } from '../test/render';
import { runAxe } from '../test/axe';

const points: ChartPoint[] = [
  { label: 'Apr', value: 4.2 },
  { label: 'May', value: 3.8 },
  { label: 'Jun', value: null }, // a month with no snapshot
  { label: 'Jul', value: 5.1 },
];

const table = <table><tbody><tr><td>table alternative</td></tr></tbody></table>;

describe('TrendChart', () => {
  it('always shows the legend — never hover-only (§7 legend-visible)', () => {
    renderThemed(
      <TrendChart points={points} seriesLabel="Absenteeism %" unit="%" tableAlternative={table} />,
    );
    expect(screen.getByText('Absenteeism %')).toBeInTheDocument();
  });

  it('breaks the line at a gap instead of plotting zero', () => {
    const { container } = renderThemed(
      <TrendChart points={points} seriesLabel="Absenteeism %" tableAlternative={table} />,
    );
    const path = container.querySelector('path[stroke="var(--accent)"]');
    // A single unbroken path across a null month would mean June was drawn as
    // a value. Two move commands = the line genuinely breaks.
    expect(path?.getAttribute('d')?.match(/M/g)?.length).toBe(2);
  });

  it('renders a focusable point per measured value, so tooltips are keyboard-reachable', async () => {
    renderThemed(
      <TrendChart points={points} seriesLabel="Absenteeism %" unit="%" precision={1} tableAlternative={table} />,
    );
    // 3 measured values (June is null).
    const dots = screen.getAllByRole('button');
    const dataPoints = dots.filter((d) => d.tagName.toLowerCase() === 'circle');
    expect(dataPoints).toHaveLength(3);

    await userEvent.tab();
    expect(document.activeElement?.tagName.toLowerCase()).toBe('circle');
  });

  it('names the exact value on each point for assistive tech', () => {
    renderThemed(
      <TrendChart points={points} seriesLabel="Absenteeism %" unit="%" precision={1} tableAlternative={table} />,
    );
    expect(screen.getByRole('button', { name: 'Apr: 4.2%' })).toBeInTheDocument();
  });

  it('offers a data table alternative (§7 data-table)', async () => {
    renderThemed(<TrendChart points={points} seriesLabel="OT hours" tableAlternative={table} />);
    await userEvent.click(screen.getByRole('button', { name: /show data table/i }));
    expect(screen.getByText('table alternative')).toBeInTheDocument();
  });

  it('explains an empty series instead of drawing a blank axis frame', () => {
    renderThemed(
      <TrendChart
        points={[{ label: 'Apr', value: null }]}
        seriesLabel="OT hours"
        emptyMessage="No snapshots yet."
        tableAlternative={table}
      />,
    );
    expect(screen.getByText('No snapshots yet.')).toBeInTheDocument();
    // And the alternative is still offered, not withheld.
    expect(screen.getByText('table alternative')).toBeInTheDocument();
  });

  it('groups large numbers the Indian way on point labels', () => {
    renderThemed(
      <TrendChart
        points={[{ label: 'Apr', value: 12345678 }]}
        seriesLabel="Cost"
        tableAlternative={table}
      />,
    );
    expect(screen.getByRole('button', { name: 'Apr: 1,23,45,678' })).toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <TrendChart points={points} seriesLabel="Absenteeism %" unit="%" tableAlternative={table} />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});

describe('BarChart', () => {
  const bars: ChartPoint[] = [
    { label: 'White collar', value: 120 },
    { label: 'Blue collar', value: 340 },
    { label: 'Trainee', value: null },
  ];

  it('labels every bar with its exact value for assistive tech', () => {
    renderThemed(<BarChart points={bars} seriesLabel="Headcount" tableAlternative={table} />);
    expect(screen.getByRole('img', { name: 'Blue collar: 340' })).toBeInTheDocument();
    // An unmeasured category says so rather than showing an empty bar.
    expect(screen.getByRole('img', { name: 'Trainee: not measured' })).toBeInTheDocument();
  });

  it('explains an empty dataset', () => {
    renderThemed(
      <BarChart
        points={[{ label: 'x', value: null }]}
        seriesLabel="Headcount"
        emptyMessage="Nothing to compare."
        tableAlternative={table}
      />,
    );
    expect(screen.getByText('Nothing to compare.')).toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <BarChart points={bars} seriesLabel="Headcount" tableAlternative={table} />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});
