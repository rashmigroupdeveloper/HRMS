import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from './cn';

/**
 * DataTable — the workhorse grid (docs/05 §4 layout convention, §5).
 *
 * - Sticky header, numeric columns right-aligned + tabular (docs/05 §7).
 * - Row states per docs/12 §7.4: hover = `--accent-soft` wash;
 *   selected = SOLID gold fill (bolder than hover, the Crextio signature).
 * - Virtualized past `virtualizeThreshold` rows (default 50) via
 *   @tanstack/react-virtual (docs/05 §6 kill-list #7). Below it, plain flow.
 * - Keyboard: rows are focusable, Enter/Space activate (arrow-key roving is a
 *   follow-up when the grid gets wired to real navigation).
 */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** right-align + tabular numerals */ numeric?: boolean;
  /** CSS grid track, e.g. '1fr' | '120px' | 'minmax(0,2fr)' */ width?: string;
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
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = rows.length > virtualizeThreshold;

  const gridTemplate = columns
    .map((c) => c.width ?? '1fr')
    .join(' ');

  const virtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
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
        : clickable && 'hover:bg-accent-soft', // hover = wash
    );

  const cell = (col: Column<T>, row: T): ReactNode => (
    <div
      key={col.key}
      className={cn(
        'truncate',
        col.numeric && 'text-right tabular-nums',
      )}
      data-numeric={col.numeric ? '' : undefined}
    >
      {col.render(row)}
    </div>
  );

  const activate = (row: T) => {
    if (onRowClick) onRowClick(row);
  };

  return (
    <div className="overflow-hidden rounded-card bg-surface u-shadow-card">
      {/* Header */}
      <div
        className="grid gap-3 border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((c) => (
          <div key={c.key} className={cn(c.numeric && 'text-right')}>
            {c.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="p-6">{empty ?? <DefaultEmpty />}</div>
      ) : virtualize ? (
        <div
          ref={scrollRef}
          className="overflow-auto"
          style={{ maxHeight }}
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              if (!row) return null;
              const key = rowKey(row);
              return (
                <div
                  key={key}
                  role="row"
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => { activate(row); }}
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
                  {columns.map((c) => cell(c, row))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="overflow-auto"
          style={{ maxHeight: rows.length * rowHeight > maxHeight ? maxHeight : undefined }}
        >
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <div
                key={key}
                role="row"
                tabIndex={clickable ? 0 : undefined}
                onClick={() => { activate(row); }}
                onKeyDown={(e) => {
                  if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    activate(row);
                  }
                }}
                className={cn(rowClasses(key), 'border-b border-line/60 last:border-0')}
                style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
              >
                {columns.map((c) => cell(c, row))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DefaultEmpty() {
  return (
    <p className="py-6 text-center text-sm text-ink-muted">No records.</p>
  );
}
