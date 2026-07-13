import { useState } from 'react';
import { KeyRound, ShieldCheck, UserRoundCog } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Select,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

interface AccessMatrix {
  roles: { code: string; name: string }[];
  permissions: string[];
  grants: { role: string; permission: string }[];
}

export function AccessControlPage() {
  const matrix = useDashboardResource<AccessMatrix>('/api/rbac/matrix');
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  if (matrix.loading) return <DashboardSkeleton />;
  if (matrix.error) return <DashboardError message={matrix.error} onRetry={matrix.reload} />;
  const data = matrix.data;

  const assign = async () => {
    if (!role || !/^\d+$/.test(userId)) return;
    setLoading(true);
    try {
      await apiFetch('/api/rbac/user-roles', {
        method: 'POST',
        body: JSON.stringify({ userId: Number(userId), role }),
      });
      toast.success('Role assigned', {
        description: 'The change takes effect on the next request and was audited.',
      });
      setUserId('');
    } catch (cause) {
      toast.error('Role could not be assigned', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Runtime access control</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Users & roles
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Database-held role permissions; every change is effective on the next request and
          hash-chain audited.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader
            title="Assign role"
            subtitle="Use the internal user ID from the user account record"
          />
          <div className="space-y-4">
            <TextField
              label="User ID"
              value={userId}
              onChange={(event) => {
                setUserId(event.currentTarget.value);
              }}
              placeholder="e.g. 42"
            />
            <Select
              label="Role"
              value={role}
              onChange={(value) => {
                setRole(value);
              }}
              options={(data?.roles ?? []).map((item) => ({
                value: item.code,
                label: item.name,
                description: item.code,
              }))}
            />
            <Button
              variant="primary"
              loading={loading}
              disabled={!role || !/^\d+$/.test(userId)}
              leadingIcon={<UserRoundCog className="size-4" />}
              onClick={() => void assign()}
            >
              Assign role
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Access overview"
            subtitle={`${String(data?.roles.length ?? 0)} roles · ${String(data?.permissions.length ?? 0)} permission codes`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.roles.map((item) => {
              const count = data.grants.filter((grant) => grant.role === item.code).length;
              return (
                <div key={item.code} className="rounded-tile bg-surface-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-ink-muted">{item.code}</p>
                    </div>
                    <StatusBadge tone="info">{count} grants</StatusBadge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader
          title="Permission matrix"
          subtitle="Read-only overview in this surface; grant/revoke endpoints remain audited"
        />
        {data?.permissions.length ? (
          <div className="overflow-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className="text-ink-muted">
                  <th className="sticky left-0 bg-surface px-3 py-2">Permission</th>
                  {data.roles.map((item) => (
                    <th key={item.code} className="px-2 py-2 text-center">
                      {item.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.permissions.map((permission) => (
                  <tr key={permission} className="border-t border-line/50 hover:bg-accent-soft">
                    <td className="sticky left-0 bg-surface px-3 py-2 font-medium text-ink">
                      {permission}
                    </td>
                    {data.roles.map((item) => (
                      <td key={item.code} className="px-2 py-2 text-center">
                        {data.grants.some(
                          (grant) => grant.role === item.code && grant.permission === permission,
                        ) ? (
                          <ShieldCheck
                            className="mx-auto size-4 text-positive"
                            aria-label="Granted"
                          />
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<KeyRound />}
            title="No permissions seeded"
            description="Run the idempotent RBAC seed before assigning access."
          />
        )}
      </Card>
    </div>
  );
}
