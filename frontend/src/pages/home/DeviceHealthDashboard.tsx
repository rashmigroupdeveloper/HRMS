import { AlertTriangle, CheckCircle2, DatabaseZap, RadioTower } from 'lucide-react';
import { todayLongIST } from '../../lib/date';
import { Card, CardHeader, DarkCard, EmptyState, KpiPillRow, StatusBadge } from '../../ui';
import type { DeviceHealth } from './dashboard-types';
import { formatTimestamp } from './dashboard-format';

export function DeviceHealthDashboard({ data }: { data: DeviceHealth[] }) {
  const active = data.filter((device) => device.isActive);
  const silent = active.filter((device) => device.silent);
  const missingWatermarks = active.filter((device) => device.watermarkAt === null);
  const healthy = active.length - silent.length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">{todayLongIST()}</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Device health
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Kent doors, last contact and per-device ingestion watermarks.
        </p>
      </header>

      <KpiPillRow
        pills={[
          { label: 'Active devices', value: active.length, state: 'filled', icon: <RadioTower /> },
          { label: 'Healthy', value: healthy, state: 'outline', icon: <CheckCircle2 /> },
          {
            label: 'Silent',
            value: silent.length,
            state: silent.length > 0 ? 'accent' : 'outline',
            icon: <AlertTriangle />,
          },
          {
            label: 'No watermark',
            value: missingWatermarks.length,
            state: 'hatched',
            icon: <DatabaseZap />,
          },
        ]}
      />

      <DarkCard>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
              Ingestion readiness
            </p>
            <h2 className="mt-3 text-4xl font-light">
              {silent.length === 0 && missingWatermarks.length === 0
                ? 'Every door is reporting'
                : `${String(silent.length + missingWatermarks.length)} checks need attention`}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-hero-muted">
              Month finalisation depends on every expected door delivering through the cutoff. A
              silent door or missing watermark must remain visible until resolved.
            </p>
          </div>
          <StatusBadge tone={silent.length === 0 ? 'positive' : 'negative'}>
            {silent.length === 0 ? 'Feed healthy' : 'Finalisation risk'}
          </StatusBadge>
        </div>
      </DarkCard>

      <Card>
        <CardHeader title="Kent doors" subtitle="Operational state from the attendance connector" />
        {data.length === 0 ? (
          <EmptyState
            icon={<RadioTower />}
            title="No devices registered"
            description="Register expected Kent doors before enabling attendance finalisation."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className="text-xs text-ink-muted">
                  <th className="px-4 py-2 font-medium">Door</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Last seen</th>
                  <th className="px-4 py-2 font-medium">Delivered through</th>
                  <th className="px-4 py-2 text-right font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {data.map((device) => (
                  <tr
                    key={device.doorCode}
                    className="bg-surface-2 transition-colors hover:bg-accent-soft"
                  >
                    <td className="rounded-l-row px-4 py-3 text-sm font-semibold text-ink">
                      {device.doorCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-muted">{device.source}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-ink">
                      {formatTimestamp(device.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-ink">
                      {formatTimestamp(device.watermarkAt)}
                    </td>
                    <td className="rounded-r-row px-4 py-3 text-right">
                      <StatusBadge
                        tone={
                          !device.isActive ? 'neutral' : device.silent ? 'negative' : 'positive'
                        }
                      >
                        {!device.isActive ? 'Inactive' : device.silent ? 'Silent' : 'Reporting'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
