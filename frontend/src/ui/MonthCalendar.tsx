import { useRef } from 'react';
import { cn } from './cn';
import { Tooltip } from './Tooltip';
import { placeSpans, WEEKDAYS_MIN, monthLabel, monthMatrix, todayISOIST } from './calendar';
import type { CalendarSpan } from './calendar';

/**
 * MonthCalendar — the attendance month surface (docs/05 §5, docs/12 §7).
 * Each in-month day carries an attendance state. Weekends and week-offs use
 * the diagonal hatch. The selected day is a solid gold cell — the one accent.
 * Leave, holidays and duty draw as bars across the dates they cover.
 *
 * Color is never the only signal: every day cell names its state, a state dot
 * pairs with the legend, and each bar carries its own label.
 * Keyboard: arrow keys walk the grid (roving tabindex), Enter/Space select.
 */

export type AttendanceDayState = 'present' | 'absent' | 'leave' | 'halfday' | 'holiday' | 'weekoff';

export interface AttendanceDay {
  state: AttendanceDayState;
  /** Tooltip line, e.g. "In 09:02 · Out 18:11 · Gate 3". */
  note?: string;
  /** Optional session glyph, e.g. A:P; summary state still drives the dot. */
  label?: string | undefined;
}

interface MonthCalendarProps {
  year: number;
  /** 1–12. */
  month: number;
  /** Day-of-month → attendance info. Days absent from the map render plain. */
  days?: Partial<Record<number, AttendanceDay>>;
  /** Inclusive ranges drawn across the week (leave, holiday, duty). */
  spans?: readonly CalendarSpan[];
  /** `YYYY-MM-DD` drawn as the solid gold cell. */
  selectedIso?: string | null;
  onSelectDay?: (iso: string) => void;
  showLegend?: boolean;
  className?: string;
}

const STATE_LABEL: Record<AttendanceDayState, string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'On leave',
  halfday: 'Half day',
  holiday: 'Holiday',
  weekoff: 'Week off',
};

/** State dot color — paired with the aria-label + legend, never alone. */
const STATE_DOT: Record<AttendanceDayState, string> = {
  present: 'bg-positive',
  absent: 'bg-negative',
  leave: 'bg-info',
  halfday: 'bg-warning',
  holiday: 'bg-accent',
  weekoff: '',
};

const SPAN_DOT: Record<CalendarSpan['tone'], string> = {
  holiday: 'bg-accent',
  leave: 'bg-hero',
  duty: 'bg-ink',
};

const LANE = '1.75rem';

export function MonthCalendar({
  year,
  month,
  days = {},
  spans = [],
  selectedIso = null,
  onSelectDay,
  showLegend = true,
  className,
}: MonthCalendarProps) {
  const weeks = monthMatrix(year, month);
  const todayISO = todayISOIST();
  const gridRef = useRef<HTMLDivElement>(null);

  const usedStates = [
    ...new Set(
      Object.values(days)
        .filter((d) => d !== undefined)
        .map((d) => d.state),
    ),
  ];

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowLeft'
          ? -1
          : e.key === 'ArrowDown'
            ? 7
            : e.key === 'ArrowUp'
              ? -7
              : 0;
    if (step === 0) return;
    e.preventDefault();
    const cells = [...(gridRef.current?.querySelectorAll<HTMLElement>('[data-day]') ?? [])];
    const at = cells.indexOf(document.activeElement as HTMLElement);
    cells[Math.min(Math.max(at + step, 0), cells.length - 1)]?.focus();
  };

  let firstInMonthSeen = false;

  return (
    <div className={className}>
      <div className="grid grid-cols-7 gap-1.5" aria-hidden>
        {WEEKDAYS_MIN.map((wd) => (
          <span
            key={wd}
            className="grid h-6 place-items-center text-[11px] font-medium text-ink-muted"
          >
            {wd}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={monthLabel(year, month)}
        onKeyDown={onGridKeyDown}
        className="mt-1 space-y-1.5"
      >
        {weeks.map((week) => {
          const placed = placeSpans(spans, week.map((cell) => cell.iso));
          const lanes = placed.reduce((max, span) => Math.max(max, span.lane + 1), 0);
          return (
            <div key={week[0]?.iso} role="row" className="relative">
              <div
                className="grid grid-cols-7 gap-1.5"
                style={lanes > 0 ? { paddingBottom: `calc(${String(lanes)} * ${LANE})` } : undefined}
              >
                {week.map((cell) => {
                  if (!cell.inMonth) {
                    return <span key={cell.iso} role="gridcell" aria-hidden className="h-11" />;
                  }
                  const info = days[cell.day];
                  const covered = spans.some((span) => cell.iso >= span.from && cell.iso <= span.to);
                  const isWeekOff = info?.state === 'weekoff';
                  const isHoliday = info?.state === 'holiday';
                  const isWeekend = cell.weekday >= 5;
                  const isToday = cell.iso === todayISO;
                  const isSelected = cell.iso === selectedIso;
                  const tabbable = !firstInMonthSeen;
                  firstInMonthSeen = true;

                  const dayButton = (
                    <button
                      type="button"
                      data-day={cell.day}
                      tabIndex={tabbable ? 0 : -1}
                      aria-label={`${String(cell.day)}${info?.label ? ` ${info.label},` : ''} ${monthLabel(year, month)}${info ? ` — ${info.note ?? STATE_LABEL[info.state]}` : ''}${isSelected ? ', selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => onSelectDay?.(cell.iso)}
                      className={cn(
                        'u-press relative grid h-11 w-full place-items-center rounded-[14px]',
                        'text-sm tabular-nums transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)]',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                        isSelected
                          ? 'bg-accent font-semibold text-accent-ink'
                          : isWeekOff || (isWeekend && info === undefined)
                            ? 'u-hatch bg-surface-2 text-ink-muted'
                            : isHoliday
                              ? 'bg-accent-soft text-accent-ink'
                              : 'text-ink hover:bg-surface-2',
                        isToday && !isSelected && 'font-semibold ring-1 ring-inset ring-accent',
                        onSelectDay === undefined && 'cursor-default',
                      )}
                    >
                      <span>{cell.day}</span>
                      {info?.label && (
                        <span aria-hidden className="text-[10px] leading-none">
                          {info.label}
                        </span>
                      )}
                      {info && !isWeekOff && !info.label && !covered && !isSelected && (
                        <span
                          aria-hidden
                          className={cn(
                            'absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full',
                            STATE_DOT[info.state],
                          )}
                        />
                      )}
                    </button>
                  );

                  return (
                    <div key={cell.iso} role="gridcell" className="contents">
                      {info?.note !== undefined ? (
                        <Tooltip label={info.note}>{dayButton}</Tooltip>
                      ) : (
                        dayButton
                      )}
                    </div>
                  );
                })}
              </div>
              {placed.length > 0 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-7 gap-1.5">
                  {placed.map((span) => (
                    <div
                      key={`${span.id}:${String(span.start)}`}
                      style={{
                        gridColumn: `${String(span.start + 1)} / span ${String(span.length)}`,
                        marginBottom: `calc(${String(lanes - 1 - span.lane)} * ${LANE})`,
                      }}
                      className="flex h-6 items-center gap-1.5 rounded-full bg-surface px-2 text-[11px] font-medium text-ink u-shadow-card ring-1 ring-inset ring-line"
                    >
                      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', SPAN_DOT[span.tone])} />
                      <span className="truncate">{span.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showLegend && usedStates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {usedStates.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              {s === 'weekoff' ? (
                <span className="u-hatch inline-block size-2.5 rounded-[3px] bg-surface-2" />
              ) : (
                <span className={cn('inline-block size-2 rounded-full', STATE_DOT[s])} />
              )}
              {STATE_LABEL[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
