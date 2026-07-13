import type { DeviceHealth } from '../home/dashboard-types';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { DeviceHealthDashboard } from '../home/DeviceHealthDashboard';
import { useDashboardResource } from '../home/useDashboardResource';

export function DeviceHealthPage() {
  const resource = useDashboardResource<DeviceHealth[]>('/api/attendance/devices');
  if (resource.loading) return <DashboardSkeleton />;
  if (resource.error) return <DashboardError message={resource.error} onRetry={resource.reload} />;
  return resource.data ? <DeviceHealthDashboard data={resource.data} /> : null;
}
