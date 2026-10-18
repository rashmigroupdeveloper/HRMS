import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  ChevronsUpDown,
  Columns3,
  Download,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from './cn';
import { useMedia } from './useMedia';
import { downloadCsv, loadHidden, loadViews, saveHidden, saveViews, toCsv } from './table-state';
import type { TableView } from './table-state';

/**
 * DataTable — the workhorse grid (docs/05 §4 layout convention, §5).
 *
 * - Sticky header, numeric columns right-aligned + tabular (docs/05 §7).
 * - Row states per docs/12 §7.4: hover = `--accent-soft` wash;
 *   selected = SOLID gold fill (bolder than hover, the Crextio signature).
 *   Bulk-checked rows get the wash, so the one solid-gold row stays unique.
 * - Virtualized past `virtualizeThreshold` rows (default 50).
 * - Opt-in toolbar: search, sortable headers (`sortValue`), column chooser and
 *   saved views (need `tableId`, persisted per browser), CSV export
 *   (`exportName`), bulk select (`bulkActions`), and a `filters` slot.
 * - Below 640px the grid becomes a card list (title / subtitle / labelled
 *   facts) — no sideways-scrolling tables on a phone (docs/05 §8).
 */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** right-align + tabular numerals */ numeric?: boolean;
  /** CSS grid track, e.g. '1fr' | '120px' | 'minmax(0,2fr)' */ width?: string;
  /** Plain-text header for the column chooser, CSV and phone cards when `header` is a node. */
  label?: string;
  /** Enables header sorting; also used for search and CSV when `exportValue` is absent. */
  sortValue?: (row: T) => string | number | null;
  /** Value written to CSV. */
  exportValue?: (row: T) => string | number | null;
  /** Never offered in the column chooser (identity columns). */
  locked?: boolean;
  /** Hidden until the user turns it on in the column chooser. */
  defaultHidden?: boolean;
  /** Role on phone cards; default: 1st column title, 2nd subtitle, rest facts. */
  mobile?: 'title' | 'subtitle' | 'fact' | 'badge' | 'hidden';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | undefined;
  /** shown when rows is empty (docs/05 §6 #3 — never a blank table) */
  empty?: ReactNode;
  virtualizeThreshold?: number;
  /** scroll-container height in px; enables the sticky-header scroll region */
  maxHeight?: number;
  rowHeight?: number;
  /** Stable id: turns on the column chooser and saved views (localStorage). */
  tableId?: string;
  /** Show the toolbar search box (matches sortValue/exportValue/string cells). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** File name for CSV export of the visible (or checked) rows. */
  exportName?: string;
  /** Turns on checkboxes; rendered in the bulk bar with the checked rows. */
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  /** Page-owned filter controls, placed in the toolbar. */
  filters?: ReactNode;
  /** Accessible name for the grid. */
  caption?: string;
  /** Set false to keep the grid on phones (wide matrices, e.g. musters). */
  mobileCards?: boolean;
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null;

const labelOf = <T,>(c: Column<T>): string =>
  c.label ??
  (typeof c.header === 'string' || typeof c.header === 'number' ? String(c.header) : c.key);

function textOf<T>(c: Column<T>, row: T): string | number | null {
  if (c.exportValue) return c.exportValue(row);
  if (c.sortValue) return c.sortValue(row);
  const node = c.render(row);
  return typeof node === 'string' || typeof node === 'number' ? node : null;
}

function compare(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1; // nulls last, both directions
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-IN', { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  virtualizeThreshold = 50,
  maxHeight = 480,
  rowHeight = 52,
  tableId,
  searchable = false,
  searchPlaceholder = 'Search this list',
  exportName,
  bulkActions,
  filters,
  caption,
  mobileCards = true,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const phone = useMedia('(max-width: 639px)') && mobileCards;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>(null);
  const [hidden, setHidden] = useState<string[]>(() =>
    tableId === undefined
      ? columns.filter((c) => c.defaultHidden).map((c) => c.key)
      : loadHidden(tableId).length > 0
        ? loadHidden(tableId)
        : columns.filter((c) => c.defaultHidden).map((c) => c.key),
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const selectable = bulkActions !== undefined;

  useEffect(() => {
    if (tableId !== undefined) saveHidden(tableId, hidden);
  }, [tableId, hidden]);

  const visibleColumns = columns.filter((c) => c.locked === true || !hidden.includes(c.key));

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (q !== '') {
      out = out.filter((row) =>
        columns.some((c) => {
          const v = textOf(c, row);
          return v !== null && String(v).toLowerCase().includes(q);
        }),
      );
    }
    if (sort !== null) {
      const col = columns.find((c) => c.key === sort.key);
      const value = col?.sortValue;
      if (value) {
        out = [...out].sort((a, b) => (sort.dir === 'asc' ? 1 : -1) * compare(value(a), value(b)));
      }
    }
    return out;
  }, [rows, columns, search, sort]);

  // Drop checks for rows that disappeared (refetch, filter change upstream).
  const liveKeys = useMemo(() => new Set(rows.map(rowKey)), [rows, rowKey]);
  const checkedRows = rows.filter((r) => checked.has(rowKey(r)));
  const checkedCount = [...checked].filter((k) => liveKeys.has(k)).length;
  const clear = (): void => {
    setChecked(new Set());
  };
  const toggle = (key: string): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const allShownChecked = shown.length > 0 && shown.every((r) => checked.has(rowKey(r)));
  const someShownChecked = !allShownChecked && shown.some((r) => checked.has(rowKey(r)));
  const toggleAll = (): void => {
    setChecked(allShownChecked ? new Set() : new Set(shown.map(rowKey)));
  };

  const exportCsv = (): void => {
    const source = checkedCount > 0 ? shown.filter((r) => checked.has(rowKey(r))) : shown;
    // Only columns that yield text for at least one row (icon/action columns drop out).
    const cols = visibleColumns.filter((c) => source.some((r) => textOf(c, r) !== null));
    downloadCsv(
      exportName ?? 'export',
      toCsv(
        cols.map(labelOf),
        source.map((r) => cols.map((c) => textOf(c, r))),
      ),
    );
  };

  const views = tableId === undefined ? [] : loadViews(tableId);
  const [viewsVersion, setViewsVersion] = useState(0);
  void viewsVersion;
  const saveView = (name: string): void => {
    if (tableId === undefined || name.trim() === '') return;
    const next = [
      ...views.filter((v) => v.name !== name.trim()),
      { name: name.trim(), search, sort, hidden },
    ];
    saveViews(tableId, next);
    setViewsVersion((n) => n + 1);
  };
  const applyView = (view: TableView): void => {
    setSearch(view.search);
    setSort(view.sort);
    setHidden(view.hidden);
  };
  const deleteView = (name: string): void => {
    if (tableId === undefined) return;
    saveViews(
      tableId,
      views.filter((v) => v.name !== name),
    );
    setViewsVersion((n) => n + 1);
  };

  const showToolbar =
    searchable || exportName !== undefined || tableId !== undefined || filters !== undefined;

  const gridTemplate = [
    selectable ? '2.25rem' : null,
    ...visibleColumns.map((c) => c.width ?? '1fr'),
  ]
    .filter((t): t is string => t !== null)
    .join(' ');

  const virtualize = !phone && shown.length > virtualizeThreshold;
  const virtualizer = useVirtualizer({
    count: virtualize ? shown.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const clickable = Boolean(onRowClick);

  const rowClasses = (key: string): string =>
    cn(
      'grid items-center gap-3 px-4 text-sm',
      'transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)]',
      clickable && 'u-press cursor-pointer',
      key === selectedKey
        ? 'bg-accent text-accent-ink' // selected = solid gold (docs/12 §7.4)
        : checked.has(key)
          ? 'bg-accent-soft'
          : clickable && 'hover:bg-accent-soft', // hover = wash
    );

  const checkCell = (key: string, label: string): ReactNode =>
    selectable ? (
      <div role="cell" className="flex items-center">
        <input
          type="checkbox"
          className="size-4 cursor-pointer accent-[var(--ink)]"
          checked={checked.has(key)}
          aria-label={`Select ${label}`}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onChange={() => {
            toggle(key);
          }}
        />
      </div>
    ) : null;

  const cell = (col: Column<T>, row: T): ReactNode => (
    <div
      key={col.key}
      role="cell"
      className={cn('truncate', col.numeric && 'text-right tabular-nums')}
      data-numeric={col.numeric ? '' : undefined}
    >
      {col.render(row)}
    </div>
  );

  const activate = (row: T) => {
    if (onRowClick) onRowClick(row);
  };

  const rowLabel = (row: T): string => {
    const first = visibleColumns[0];
    const v = first === undefined ? null : textOf(first, row);
    return v === null ? rowKey(row) : String(v);
  };

  const toolbar = showToolbar ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3 sm:px-4">
      {searchable && (
        <label className="relative flex min-w-0 flex-1 basis-48 items-center">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 size-4 text-ink-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-full bg-surface-2 pl-9 pr-3 text-sm text-ink ring-1 ring-line-strong placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>
      )}
      {filters}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-1 text-xs tabular-nums text-ink-muted" aria-live="polite">
          {shown.length === rows.length
            ? `${rows.length.toLocaleString('en-IN')} rows`
            : `${shown.length.toLocaleString('en-IN')} of ${rows.length.toLocaleString('en-IN')}`}
        </span>
        {tableId !== undefined && (
          <ViewsMenu views={views} onApply={applyView} onSave={saveView} onDelete={deleteView} />
        )}
        {tableId !== undefined && (
          <ColumnMenu
            columns={columns}
            hidden={hidden}
            onToggle={(key) => {
              setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
            }}
          />
        )}
        {exportName !== undefined && (
          <ToolButton
            onClick={exportCsv}
            label={
              checkedCount > 0 ? `Export ${String(checkedCount)} selected as CSV` : 'Export CSV'
            }
          >
            <Download className="size-4" />
          </ToolButton>
        )}
      </div>
    </div>
  ) : null;

  const bulkBar =
    selectable && checkedCount > 0 ? (
      <div
        role="region"
        aria-label="Bulk actions"
        className="u-fade flex flex-wrap items-center gap-2 bg-hero px-4 py-2.5 text-sm text-hero-ink"
      >
        <span className="font-semibold tabular-nums">
          {checkedCount.toLocaleString('en-IN')} selected
        </span>
        <div className="flex flex-wrap items-center gap-2 u-on-hero">
          {bulkActions(checkedRows, clear)}
        </div>
        <button
          type="button"
          onClick={clear}
          className="u-tap ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-hero-muted hover:text-hero-ink"
        >
          <X aria-hidden className="size-3.5" /> Clear
        </button>
      </div>
    ) : null;

  const emptyState = (
    <div className="p-6">
      {rows.length > 0 && shown.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-ink">Nothing matches “{search}”.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
            }}
            className="u-tap mt-2 text-sm font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4"
          >
            Clear search
          </button>
        </div>
      ) : (
        (empty ?? <DefaultEmpty />)
      )}
    </div>
  );

  if (phone) {
    const role = (c: Column<T>, i: number): NonNullable<Column<T>['mobile']> =>
      c.mobile ?? (i === 0 ? 'title' : i === 1 ? 'subtitle' : 'fact');
    const parts = visibleColumns.map((c, i) => ({ c, r: role(c, i) }));
    return (
      <section
        aria-label={caption}
        className="overflow-hidden rounded-card bg-surface u-shadow-card"
      >
        {toolbar}
        {bulkBar}
        {shown.length === 0 ? (
          emptyState
        ) : (
          <ul className="divide-y divide-line/60">
            {shown.slice(0, 200).map((row) => {
              const key = rowKey(row);
              const facts = parts.filter((p) => p.r === 'fact');
              const body = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {parts
                        .filter((p) => p.r === 'title')
                        .map((p) => (
                          <div key={p.c.key} className="truncate text-sm font-semibold">
                            {p.c.render(row)}
                          </div>
                        ))}
                      {parts
                        .filter((p) => p.r === 'subtitle')
                        .map((p) => (
                          <div key={p.c.key} className="mt-0.5 truncate text-xs text-ink-muted">
                            {p.c.render(row)}
                          </div>
                        ))}
                    </div>
                    {parts
                      .filter((p) => p.r === 'badge')
                      .map((p) => (
                        <div key={p.c.key} className="shrink-0">
                          {p.c.render(row)}
                        </div>
                      ))}
                  </div>
                  {facts.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                      {facts.map(({ c }) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-2xs text-ink-muted">{labelOf(c)}</dt>
                          <dd className={cn('truncate text-sm', c.numeric && 'tabular-nums')}>
                            {c.render(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              );
              return (
                <li
                  key={key}
                  className={cn(
                    'flex gap-3 px-4 py-3.5',
                    key === selectedKey
                      ? 'bg-accent text-accent-ink'
                      : checked.has(key) && 'bg-accent-soft',
                  )}
                >
                  {selectable && (
                    <label className="-my-1 -ml-2 grid size-11 shrink-0 place-items-center">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--ink)]"
                        checked={checked.has(key)}
                        aria-label={`Select ${rowLabel(row)}`}
                        onChange={() => {
                          toggle(key);
                        }}
                      />
                    </label>
                  )}
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => {
                        activate(row);
                      }}
                      className="u-press min-w-0 flex-1 text-left"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {shown.length > 200 && (
          <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
            Showing the first 200 of {shown.length.toLocaleString('en-IN')} — search to narrow down.
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface u-shadow-card">
      {toolbar}
      {bulkBar}
      <div
        role="table"
        aria-label={caption}
        aria-rowcount={shown.length + 1}
        aria-colcount={visibleColumns.length + (selectable ? 1 : 0)}
      >
        {/* Header — role chain must be table > rowgroup > row > columnheader, or
            a screen reader cannot navigate the grid at all. */}
        <div role="rowgroup">
          <div
            role="row"
            aria-rowindex={1}
            className="grid items-center gap-3 border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {selectable && (
              <div role="columnheader" className="flex items-center">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-[var(--ink)]"
                  checked={allShownChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someShownChecked;
                  }}
                  aria-label="Select all rows"
                  onChange={toggleAll}
                />
              </div>
            )}
            {visibleColumns.map((c) => {
              const dir = sort?.key === c.key ? sort.dir : null;
              return (
                <div
                  key={c.key}
                  role="columnheader"
                  aria-sort={dir === null ? undefined : dir === 'asc' ? 'ascending' : 'descending'}
                  className={cn(c.numeric && 'text-right')}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSort(
                          dir === null
                            ? { key: c.key, dir: 'asc' }
                            : dir === 'asc'
                              ? { key: c.key, dir: 'desc' }
                              : null,
                        );
                      }}
                      className={cn(
                        'group -mx-1 inline-flex items-center gap-1 rounded-md px-1 uppercase tracking-wide hover:text-ink',
                        dir !== null && 'text-ink',
                      )}
                    >
                      {c.header}
                      {dir === 'asc' ? (
                        <ArrowUp aria-hidden className="size-3.5" />
                      ) : dir === 'desc' ? (
                        <ArrowDown aria-hidden className="size-3.5" />
                      ) : (
                        <ChevronsUpDown
                          aria-hidden
                          className="size-3.5 opacity-40 group-hover:opacity-100"
                        />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <div role="rowgroup">
            <div role="row">
              <div role="cell" aria-colspan={visibleColumns.length + (selectable ? 1 : 0)}>
                {emptyState}
              </div>
            </div>
          </div>
        ) : virtualize ? (
          <div
            ref={scrollRef}
            role="rowgroup"
            className="overflow-auto"
            style={{ maxHeight }}
            // Keyboard users must be able to scroll the region (axe scrollable-region-focusable).
            tabIndex={clickable ? undefined : 0}
          >
            {/* Presentational: the virtualizer's sizer must not sit in the
                accessibility tree between the rowgroup and its rows. */}
            <div
              role="presentation"
              style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const row = shown[vi.index];
                if (!row) return null;
                const key = rowKey(row);
                return (
                  <div
                    key={key}
                    role="row"
                    aria-rowindex={vi.index + 2}
                    aria-selected={key === selectedKey ? true : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={() => {
                      activate(row);
                    }}
                    onKeyDown={(e) => {
                      if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        activate(row);
                      }
                    }}
                    className={rowClasses(key)}
                    style={{
                      gridTemplateColumns: gridTemplate,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: vi.size,
                      transform: `translateY(${String(vi.start)}px)`,
                    }}
                  >
                    {checkCell(key, rowLabel(row))}
                    {visibleColumns.map((c) => cell(c, row))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            role="rowgroup"
            className="overflow-auto"
            style={{ maxHeight: shown.length * rowHeight > maxHeight ? maxHeight : undefined }}
            tabIndex={!clickable && shown.length * rowHeight > maxHeight ? 0 : undefined}
          >
            {shown.map((row, index) => {
              const key = rowKey(row);
              return (
                <div
                  key={key}
                  role="row"
                  aria-rowindex={index + 2}
                  aria-selected={key === selectedKey ? true : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => {
                    activate(row);
                  }}
                  onKeyDown={(e) => {
                    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      activate(row);
                    }
                  }}
                  className={cn(rowClasses(key), 'border-b border-line/60 last:border-0')}
                  style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
                >
                  {checkCell(key, rowLabel(row))}
                  {visibleColumns.map((c) => cell(c, row))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DefaultEmpty() {
  return <p className="py-6 text-center text-sm text-ink-muted">No records.</p>;
}

function ToolButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="u-press u-tap grid size-10 place-items-center rounded-full bg-surface-2 text-ink hover:bg-accent-soft"
    >
      {children}
    </button>
  );
}

/** Minimal disclosure popover: Esc and outside-click close, focus returns to the trigger. */
function Popover({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className={cn(
          'u-press u-tap grid size-10 place-items-center rounded-full text-ink',
          open ? 'bg-hero text-hero-ink' : 'bg-surface-2 hover:bg-accent-soft',
        )}
      >
        {icon}
      </button>
      {open && (
        <div
          id={id}
          className="u-fade absolute right-0 top-12 z-[var(--z-popover)] w-64 rounded-tile bg-surface p-2 u-shadow-float"
        >
          {children(() => {
            setOpen(false);
          })}
        </div>
      )}
    </div>
  );
}

function ColumnMenu<T>({
  columns,
  hidden,
  onToggle,
}: {
  columns: Column<T>[];
  hidden: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <Popover label="Choose columns" icon={<Columns3 className="size-4" />}>
      {() => (
        <fieldset>
          <legend className="px-2 pb-1 pt-1 text-xs font-semibold text-ink-muted">Columns</legend>
          {columns
            .filter((c) => c.locked !== true)
            .map((c) => (
              <label
                key={c.key}
                className="flex min-h-10 cursor-pointer items-center gap-3 rounded-row px-2 text-sm text-ink hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--ink)]"
                  checked={!hidden.includes(c.key)}
                  onChange={() => {
                    onToggle(c.key);
                  }}
                />
                {labelOf(c)}
              </label>
            ))}
        </fieldset>
      )}
    </Popover>
  );
}

function ViewsMenu({
  views,
  onApply,
  onSave,
  onDelete,
}: {
  views: TableView[];
  onApply: (v: TableView) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Popover label="Saved views" icon={<Bookmark className="size-4" />}>
      {(close) => (
        <div>
          <p className="px-2 pb-1 pt-1 text-xs font-semibold text-ink-muted">Saved views</p>
          {views.length === 0 ? (
            <p className="px-2 py-2 text-sm text-ink-muted">
              Save the current search, sort and columns to come back to them.
            </p>
          ) : (
            <ul>
              {views.map((v) => (
                <li key={v.name} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onApply(v);
                      close();
                    }}
                    className="min-h-10 flex-1 truncate rounded-row px-2 text-left text-sm text-ink hover:bg-surface-2"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete view ${v.name}`}
                    onClick={() => {
                      onDelete(v.name);
                    }}
                    className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-negative-ink"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-2 flex gap-1.5 border-t border-line px-1 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(name);
              setName('');
            }}
          >
            <label className="sr-only" htmlFor="dt-view-name">
              View name
            </label>
            <input
              id="dt-view-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="Name this view"
              className="h-9 min-w-0 flex-1 rounded-full bg-surface-2 px-3 text-sm ring-1 ring-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <button
              type="submit"
              disabled={name.trim() === ''}
              className="h-9 rounded-full bg-hero px-3 text-xs font-semibold text-hero-ink disabled:opacity-40"
            >
              Save
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
