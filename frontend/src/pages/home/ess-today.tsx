import { Card, CardHeader } from '../../ui';
import type { EssDashboardData } from './dashboard-types';
import { formatTime } from './dashboard-format';

export function EssTodayRail({
  data,
  statusWords,
}: {
  data: EssDashboardData;
  statusWords: string;
}) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader
        title="Today"
        subtitle={data.shift ? `${data.shift.startTime}–${data.shift.endTime}` : 'No shift assigned'}
      />
      <div className="relative space-y-3 pl-4">
        <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-line" />
        <div className="relative">
          <span aria-hidden className="absolute -left-4 top-5 size-2.5 rounded-full bg-hero" />
          <div className="rounded-tile bg-hero p-4 text-hero-ink">
            <p className="text-xs text-hero-muted">Now</p>
            <p className="mt-1 font-serif text-2xl font-light">{statusWords}</p>
          </div>
        </div>
        <div className="relative">
          <span
            aria-hidden
            className="absolute -left-4 top-5 size-2.5 rounded-full bg-surface ring-1 ring-inset ring-[var(--line-strong)]"
          />
          <div className="rounded-tile bg-surface-2 p-4">
            <p className="text-xs text-ink-muted">First in</p>
            <p className="mt-1 text-lg font-light tabular-nums text-ink">
              {formatTime(data.todayStatus?.firstIn ?? null)}
            </p>
          </div>
        </div>
        <div className="relative">
          <span
            aria-hidden
            className="absolute -left-4 top-5 size-2.5 rounded-full bg-surface ring-1 ring-inset ring-[var(--line-strong)]"
          />
          <div className="rounded-tile bg-surface-2 p-4">
            <p className="text-xs text-ink-muted">Last out</p>
            <p className="mt-1 text-lg font-light tabular-nums text-ink">
              {formatTime(data.todayStatus?.lastOut ?? null)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
