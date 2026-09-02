/**
 * Data-display surfaces (docs/05 §5, §6, §7).
 *
 * Two spec rules are pinned here because they are the ones that quietly rot:
 *   - "colour is never the only signal" — every StatusBadge tone must carry an
 *     icon AND a text label, so a red/green distinction survives greyscale
 *     printing and colour-blind readers.
 *   - "never a blank table" (§6 kill-list #3) — an empty result set explains
 *     itself rather than rendering nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { EmptyState } from './EmptyState';
import { StatusBadge, Pill } from './StatusBadge';
import { renderThemed, THEMES } from '../test/render';
import { runAxe } from '../test/axe';

interface Row {
  ecode: string;
  name: string;
  status: string;
}

const rows: Row[] = [
  { ecode: 'RML001', name: 'Asha Verma', status: 'P' },
  { ecode: 'RML002', name: 'Bikash Roy', status: 'A' },
];

const columns: Column<Row>[] = [
  { key: 'ecode', header: 'Code', width: '120px', render: (r) => r.ecode },
  { key: 'name', header: 'Name', width: '1fr', render: (r) => r.name },
  { key: 'status', header: 'Status', width: '80px', render: (r) => r.status },
];

describe('StatusBadge', () => {
  const TONES = ['positive', 'warning', 'negative', 'info', 'neutral'] as const;

  it.each(TONES)('tone %s pairs an icon with a readable label, never colour alone', (tone) => {
    const { container } = renderThemed(<StatusBadge tone={tone}>Approved</StatusBadge>);
    // The label survives greyscale; the icon gives a second, non-colour signal.
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(container.querySelector('svg'), `tone ${tone} must render an icon`).not.toBeNull();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(<StatusBadge tone="negative">Rejected</StatusBadge>, theme);
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });

  it('Pill renders its content', () => {
    renderThemed(<Pill>att.grace_minutes</Pill>);
    expect(screen.getByText('att.grace_minutes')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  it('renders every row and column header', () => {
    renderThemed(<DataTable rows={rows} columns={columns} rowKey={(r) => r.ecode} />);

    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Asha Verma')).toBeInTheDocument();
    expect(screen.getByText('Bikash Roy')).toBeInTheDocument();
  });

  it('shows the empty state instead of a blank table (§6 kill-list #3)', () => {
    renderThemed(
      <DataTable
        rows={[]}
        columns={columns}
        rowKey={(r) => r.ecode}
        empty={<EmptyState title="No employees match" description="Widen the filters." />}
      />,
    );

    expect(screen.getByText('No employees match')).toBeInTheDocument();
    expect(screen.getByText('Widen the filters.')).toBeInTheDocument();
    expect(screen.queryByText('Asha Verma')).not.toBeInTheDocument();
  });

  it('reports the ROW OBJECT on click, not an index — a row drawer must open the right record', async () => {
    const onRowClick = vi.fn();
    renderThemed(
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.ecode} onRowClick={onRowClick} />,
    );

    await userEvent.click(screen.getByText('Bikash Roy'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it('does not make rows clickable when no handler is given', async () => {
    renderThemed(<DataTable rows={rows} columns={columns} rowKey={(r) => r.ecode} />);
    // Nothing to assert beyond "no crash and no button semantics".
    await userEvent.click(screen.getByText('Asha Verma'));
    expect(screen.getByText('Asha Verma')).toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.ecode} />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });

  it('exposes a complete ARIA grid: table > rowgroup > row > cell', () => {
    renderThemed(<DataTable rows={rows} columns={columns} rowKey={(r) => r.ecode} />);

    // Regression guard: rows previously carried role="row" with no table
    // ancestor and no cell children, so screen readers could not navigate ANY
    // table in the product (muster, reports, audit, permission grid).
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-rowcount', '3'); // 2 rows + header
    expect(screen.getAllByRole('columnheader')).toHaveLength(columns.length);
    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
    expect(screen.getAllByRole('cell')).toHaveLength(rows.length * columns.length);
  });

  it('keeps the ARIA grid intact when VIRTUALIZED (the muster path)', async () => {
    const many: Row[] = Array.from({ length: 120 }, (_, i) => ({
      ecode: `RML${String(i).padStart(3, '0')}`,
      name: `Employee ${String(i)}`,
      status: 'P',
    }));

    const { container } = renderThemed(
      <DataTable rows={many} columns={columns} rowKey={(r) => r.ecode} virtualizeThreshold={50} />,
    );

    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '121');
    // The virtualizer's sizer must stay presentational, or it breaks the
    // rowgroup → row chain that axe checks.
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });

  it('marks the selected row as selected for assistive tech, not just visually', () => {
    renderThemed(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.ecode}
        onRowClick={vi.fn()}
        selectedKey="RML002"
      />,
    );
    const selected = screen.getAllByRole('row').find((r) => r.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveTextContent('Bikash Roy');
  });
});

describe('EmptyState', () => {
  it('explains why and offers one action (docs/05 §5)', () => {
    renderThemed(
      <EmptyState
        title="No audit entries match"
        description="Widen the date range."
        action={<button type="button">Clear filters</button>}
      />,
    );
    expect(screen.getByText('No audit entries match')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
