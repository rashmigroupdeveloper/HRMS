/**
 * DataTable opt-in toolbar (docs/05 §5 workhorse grid): search, sortable
 * headers, column chooser persisted per tableId, CSV export and bulk select.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { toCsv } from './table-state';
import { renderThemed } from '../test/render';
import { runAxe } from '../test/axe';

interface Row {
  ecode: string;
  name: string;
  days: number;
}

const rows: Row[] = [
  { ecode: 'E2', name: 'Priya Sharma', days: 4 },
  { ecode: 'E1', name: 'Arun Kumar', days: 12 },
  { ecode: 'E3', name: 'Debajit Roy', days: 0 },
];

const columns: Column<Row>[] = [
  { key: 'ecode', header: 'E-code', render: (r) => r.ecode, sortValue: (r) => r.ecode, locked: true },
  { key: 'name', header: 'Name', render: (r) => <b>{r.name}</b>, sortValue: (r) => r.name },
  { key: 'days', header: 'Days', numeric: true, render: (r) => r.days, sortValue: (r) => r.days },
];

const names = (): string[] =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? '');

afterEach(() => {
  window.localStorage.clear();
});

describe('DataTable toolbar', () => {
  it('filters rows by search across sortValue text', async () => {
    renderThemed(<DataTable columns={columns} rows={rows} rowKey={(r) => r.ecode} searchable caption="People" />);
    await userEvent.type(screen.getByRole('searchbox'), 'deba');
    expect(names()).toEqual(['E3']);
  });

  it('sorts by a header and exposes aria-sort', async () => {
    renderThemed(<DataTable columns={columns} rows={rows} rowKey={(r) => r.ecode} caption="People" />);
    await userEvent.click(screen.getByRole('button', { name: /days/i }));
    expect(names()).toEqual(['E3', 'E2', 'E1']);
    expect(screen.getByRole('columnheader', { name: /days/i })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(screen.getByRole('button', { name: /days/i }));
    expect(names()).toEqual(['E1', 'E2', 'E3']);
  });

  it('hides a column from the chooser and remembers it per tableId', async () => {
    const { unmount } = renderThemed(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.ecode} tableId="t1" caption="People" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Choose columns' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Days' }));
    expect(screen.queryByRole('columnheader', { name: /days/i })).not.toBeInTheDocument();
    unmount();
    renderThemed(<DataTable columns={columns} rows={rows} rowKey={(r) => r.ecode} tableId="t1" caption="People" />);
    expect(screen.queryByRole('columnheader', { name: /days/i })).not.toBeInTheDocument();
  });

  it('bulk-selects rows and hands them to the bulk actions', async () => {
    const act = vi.fn();
    renderThemed(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.ecode}
        caption="People"
        bulkActions={(selected) => (
          <button
            type="button"
            onClick={() => {
              act(selected.map((r) => r.ecode));
            }}
          >
            Approve
          </button>
        )}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(act).toHaveBeenCalledWith(['E2', 'E1', 'E3']);
  });

  it('writes Excel-safe CSV (BOM, quoting)', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'He said "hi"']])).toBe('\uFEFFa,b\r\n"x,y","He said ""hi"""');
  });

  it('has no axe violations with the full toolbar', async () => {
    const { container } = renderThemed(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.ecode}
        caption="People"
        tableId="t2"
        searchable
        exportName="people"
        bulkActions={() => null}
      />,
    );
    expect(await runAxe(container)).toHaveNoViolations();
  });
});
