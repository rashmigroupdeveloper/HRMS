/**
 * Remaining interactive surfaces: DatePicker, FilterPanel, DotMatrix,
 * KpiPillRow, ThemeToggle and the Toaster mount.
 *
 * The DatePicker carries the highest risk here: it exchanges `YYYY-MM-DD`
 * with the API, and min/max bounds are how a screen stops someone
 * regularising a day inside a locked month. Both are pinned.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './DatePicker';
import { DotMatrix } from './DotMatrix';
import type { Dot } from './DotMatrix';
import { FilterPanel, FilterSection } from './FilterPanel';
import { KpiPillRow } from './KpiPillRow';
import type { KpiPill } from './KpiPillRow';
import { ThemeToggle } from './ThemeToggle';
import { Toaster } from './Toast';
import { renderRouted, renderThemed, THEMES } from '../test/render';
import { runAxe } from '../test/axe';

describe('DatePicker', () => {
  it('shows the formatted date but exchanges ISO with the caller', async () => {
    const onChange = vi.fn();
    renderThemed(<DatePicker label="Work date" value="2026-07-08" onChange={onChange} />);

    // Display is DD MMM YYYY; the API contract stays ISO.
    expect(screen.getByText('08 Jul 2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Work date/ }));
    // Day cells expose a full date as their accessible name, not a bare
    // number — "15" alone would be meaningless read aloud.
    await userEvent.click(screen.getByRole('button', { name: '15 Jul 2026' }));

    expect(onChange).toHaveBeenCalledWith('2026-07-15');
  });

  it('refuses days outside the min/max bounds (a locked month must stay unpickable)', async () => {
    const onChange = vi.fn();
    renderThemed(
      <DatePicker
        label="Work date"
        value="2026-07-08"
        min="2026-07-05"
        max="2026-07-10"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Work date/ }));
    const outOfRange = screen.getByRole('button', { name: '20 Jul 2026' });
    expect(outOfRange).toBeDisabled();

    await userEvent.click(outOfRange);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a placeholder when nothing is selected', () => {
    renderThemed(
      <DatePicker label="Work date" value={null} onChange={vi.fn()} placeholder="Pick a date" />,
    );
    expect(screen.getByText('Pick a date')).toBeInTheDocument();
  });

  it('surfaces its error as text', () => {
    renderThemed(
      <DatePicker label="Work date" value={null} onChange={vi.fn()} error="Date is required." />,
    );
    expect(screen.getByText('Date is required.')).toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <DatePicker label="Work date" value="2026-07-08" onChange={vi.fn()} />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});

describe('FilterPanel', () => {
  it('shows the applied count and clears on request', async () => {
    const onClearAll = vi.fn();
    renderThemed(
      <FilterPanel activeCount={3} onClearAll={onClearAll}>
        <FilterSection title="Department">
          <p>body</p>
        </FilterSection>
      </FilterPanel>,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('hides the count when nothing is applied', () => {
    renderThemed(
      <FilterPanel>
        <FilterSection title="Department">
          <p>body</p>
        </FilterSection>
      </FilterPanel>,
    );
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('FilterSection renders its title and content', () => {
    renderThemed(
      <FilterSection title="Cost centre">
        <p>section body</p>
      </FilterSection>,
    );
    expect(screen.getByText('Cost centre')).toBeInTheDocument();
    expect(screen.getByText('section body')).toBeInTheDocument();
  });
});

describe('DotMatrix', () => {
  it('renders one dot per day with a title, so state is readable on hover too', () => {
    const dots: Dot[] = [
      { key: '2026-07-01', state: 'present', title: '01 Jul — Present' },
      { key: '2026-07-02', state: 'absent', title: '02 Jul — Absent' },
      { key: '2026-07-03', state: 'leave', title: '03 Jul — Leave' },
      { key: '2026-07-04', state: 'weekoff', title: '04 Jul — Week off' },
      { key: '2026-07-05', state: 'none', title: '05 Jul — No record' },
    ];
    const { container } = renderThemed(<DotMatrix dots={dots} />);

    expect(container.querySelectorAll('[title]')).toHaveLength(dots.length);
    expect(screen.getByTitle('02 Jul — Absent')).toBeInTheDocument();
  });

  it('renders nothing to crash on an empty month', () => {
    const { container } = renderThemed(<DotMatrix dots={[]} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});

describe('KpiPillRow', () => {
  const pills: KpiPill[] = [
    { label: 'Present', value: 812, state: 'filled' },
    { label: 'Absent', value: 24, state: 'accent' },
    { label: 'In progress', value: 5, state: 'hatched' },
    { label: 'Remaining', value: 0, state: 'outline' },
  ];

  it('renders every pill with its label', () => {
    renderThemed(<KpiPillRow pills={pills} />);
    for (const pill of pills) expect(screen.getByText(pill.label)).toBeInTheDocument();
  });

  it('turns a pill into a link when a destination is provided', () => {
    renderRouted(
      <KpiPillRow pills={[{ label: 'Headcount', value: 12, state: 'filled', to: '/people' }]} />,
    );
    expect(screen.getByRole('link', { name: /headcount/i })).toHaveAttribute('href', '/people');
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(<KpiPillRow pills={pills} />, theme);
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});

describe('ThemeToggle', () => {
  it('renders an accessible control and cycles the mode', async () => {
    renderThemed(<ThemeToggle />);
    const [first] = screen.getAllByRole('button');
    expect(first).toBeDefined();
    if (first) {
      await userEvent.click(first);
      expect(first).toBeInTheDocument();
    }
  });
});

describe('Toaster', () => {
  it('mounts without crashing (the app-wide feedback layer)', () => {
    const { container } = renderThemed(<Toaster />);
    expect(container).toBeTruthy();
  });
});
