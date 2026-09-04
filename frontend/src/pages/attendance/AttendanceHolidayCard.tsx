import { Card, CardHeader, formatDateIN } from '../../ui';

export interface HolidayRow {
  date: string;
  name: string;
  locationId: number | null;
}

export function AttendanceHolidayCard({
  year,
  today,
  rows,
}: {
  year: number;
  today: string;
  rows: readonly HolidayRow[];
}) {
  const upcoming = rows.filter((row) => row.date >= today);
  const observed = rows.filter((row) => row.date < today);
  const line = (row: HolidayRow) => `${formatDateIN(row.date)} — ${row.name}`;
  return (
    <Card>
      <CardHeader
        title={`${String(year)} holidays`}
        subtitle="These days are already off — you do not apply leave for them."
      />
      {upcoming.length > 0 ? (
        <ul className="space-y-2">
          {upcoming.map((row) => (
            <li key={`${row.date}:${row.name}`} className="rounded-row bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">
              {line(row)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-pretty text-sm leading-6 text-ink-muted">No further holidays this year.</p>
      )}
      {observed.length > 0 ? (
        <details className="mt-4 text-sm text-ink-muted">
          <summary className="cursor-pointer font-medium text-ink">Already observed · {String(observed.length)}</summary>
          <ul className="mt-2 space-y-1">
            {observed.map((row) => (
              <li key={`${row.date}:${row.name}`}>{line(row)}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
