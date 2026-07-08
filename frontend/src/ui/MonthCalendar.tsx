import { useRef } from 'react';
import { cn } from './cn';
import { Tooltip } from './Tooltip';
import {
  WEEKDAYS_MIN,
  monthLabel,
  monthMatrix,
  todayISOIST,
} from './calendar';

/**
 * MonthCalendar — the attendance month surface (docs/05 §5). Read-oriented:
 * each in-month day carries an attendance state; weekends/week-offs use the
 * diagonal-hatch signature (docs/12 §7.2 "calendar weekend cells"), today is
 * ringed in gold (the view's one accent), and a day with a `note` grows a
 * charcoal-pill tooltip — the manager's "wait, he *was* there" answered on
 * hover (docs/05 §6, team month-grid signature).
 *
 * Color is never the only signal (§1 rule 6): every day cell carries an
 * aria-label naming its state, a state dot AND the legend row pairs swatch +
 * label. Keyboard: arrow keys walk the grid (roving tabindex), Enter/Space
 * select when `onSelectDay` is given.
 */

export type AttendanceDayState =
  | 'present'
  | 'absent'
  | 'leave'
  | 'halfday'
  | 'holiday'
  | 'weekoff';

export interface AttendanceDay {
  state: AttendanceDayState;
  /** Tooltip line, e.g. "In 09:02 · Out 18:11 · Gate 3". */
  note?: string;
}

interface MonthCalendarProps {
  year: number;
  /** 1–12. */
  month: number;
  /** Day-of-month → attendance info. Days absent from the map render plain. */
  days?: Partial<Record<number, AttendanceDay>>;
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

export function MonthCalendar({
  year,
  month,
  days = {},
  onSelectDay,
  showLegend = true,
  className,
}: MonthCalendarProps) {
  const weeks = monthMatrix(year, month);
  const todayISO = todayISOIST();
  const gridRef = useRef<HTMLDivElement>(null);

  // States actually present this month drive the legend — no dead entries.
  const usedStates = [
    ...new Set(
      Object.values(days)
        .filter((d) => d !== undefined)
        .map((d) => d.state),
    ),
  ];

  // Roving arrows over the in-month cells only.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === 'ArrowRight' ? 1
      : e.key === 'ArrowLeft' ? -1
      : e.key === 'ArrowDown' ? 7
      : e.key === 'ArrowUp' ? -7
      : 0;
    if (step === 0) return;
    e.preventDefault();
    const cells = [
      ...(gridRef.current?.querySelectorAll<HTMLElement>('[data-day]') ?? []),
    ];
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
            className="grid h-6 place-items-center text-[11px] font-medium text-ink-faint"
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
        className="mt-1 grid grid-cols-7 gap-1.5"
      >
        {weeks.flat().map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.iso} aria-hidden className="h-10" />;
          }
          const info = days[cell.day];
          const isWeekOff = info?.state === 'weekoff';
          const isHoliday = info?.state === 'holiday';
          const isToday = cell.iso === todayISO;
          const tabbable = !firstInMonthSeen;
          firstInMonthSeen = true;

          const dayButton = (
            <button
              type="button"
              data-day={cell.day}
              tabIndex={tabbable ? 0 : -1}
              aria-label={`${cell.iso}${info ? ` — ${STATE_LABEL[info.state]}` : ''}`}
              onClick={() => onSelectDay?.(cell.iso)}
              className={cn(
                'u-press relative grid h-10 w-full place-items-center rounded-[10px]',
                'text-sm tabular-nums transition-colors duration-[var(--motion-micro)] ease-[var(--ease-std)]',
                isWeekOff
                  ? 'u-hatch bg-surface-2 text-ink-faint'
                  : isHoliday
                    ? 'bg-accent-soft text-accent-ink'
                    : 'text-ink hover:bg-surface-2',
                isToday && 'font-semibold ring-1 ring-inset ring-accent',
                onSelectDay === undefined && 'cursor-default',
              )}
            >
              {cell.day}
              {info && !isWeekOff && (
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

          return info?.note !== undefined ? (
            <Tooltip key={cell.iso} label={info.note}>
              {dayButton}
            </Tooltip>
          ) : (
            <span key={cell.iso} className="contents">
              {dayButton}
            </span>
          );
        })}
      </div>

      {showLegend && usedStates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {usedStates.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
            >
              {s === 'weekoff' ? (
                <span className="u-hatch inline-block size-2.5 rounded-[3px] bg-surface-2" />
              ) : (
                <span
                  className={cn(
                    'inline-block size-2 rounded-full',
                    STATE_DOT[s],
                  )}
                />
              )}
              {STATE_LABEL[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
