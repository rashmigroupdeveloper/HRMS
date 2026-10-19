/**
 * Access control console (docs/08 §2, CORE-10).
 *
 * The sponsor rule made operable: a business procedure declares ONE permission
 * code, and which ROLES hold that code is database state — editable here, in
 * effect on the next request, fully audited. No handler ever hardcodes a role.
 *
 * Two panels:
 *   Permissions — the role × permission grid, toggled per cell (grant/revoke).
 *   People      — search a real person, see their roles, add or remove one.
 *
 * Users are picked by NAME/e-code, never by raw numeric id: a mistyped id
 * silently grants the wrong person a role, which is exactly the failure this
 * console exists to prevent.
 */
import { useStepUpAction } from '../../app/useStepUpAction';
import { ConnectedAccountsPanel } from './ConnectedAccountsPanel';
import { SessionsPanel } from './SessionsPanel';
import { LoginAccountsPanel } from './LoginAccountsPanel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, KeyRound, Search, ShieldCheck, UserRoundCog } from 'lucide-react';
import { downloadBase64 } from '../../lib/files';
import { hasPermission, type SessionUser } from '../../lib/session';
import { apiFetch } from '../../lib/api';
import {
  Button,
  Card,
  DarkCard,
  CardHeader,
  Checkbox,
  EmptyState,
  Pill,
  Select,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import type { SelectOption } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

interface AccessMatrix {
  roles: { code: string; name: string }[];
  permissions: string[];
  grants: { role: string; permission: string }[];
}

interface RoleAssignment {
  code: string;
  scopeOrgUnitId: number | null;
  scopeName: string | null;
}

interface DirectoryUser {
  userId: number;
  email: string;
  ecode: string | null;
  name: string | null;
  roles: string[];
  assignments: RoleAssignment[];
}

/** `attendance.roster.write` → "attendance" — the module the permission guards. */
/** HR operations and plant head must name one entity. Payroll chooses entity or whole group. */
const ENTITY_SCOPED_ROLES = new Set(['hr_ops', 'plant_head']);

function assignmentLabel(assignment: RoleAssignment): string {
  if (assignment.code === 'payroll_admin') {
    return assignment.scopeOrgUnitId === null
      ? 'payroll_admin · whole group'
      : `payroll_admin · ${assignment.scopeName ?? 'entity'}`;
  }
  return assignment.scopeName ? `${assignment.code} · ${assignment.scopeName}` : assignment.code;
}

function domainOf(permission: string): string {
  const dot = permission.indexOf('.');
  return dot === -1 ? 'general' : permission.slice(0, dot);
}

type Tab = 'permissions' | 'people' | 'accounts' | 'sessions' | 'connected';

export function AccessControlPage({ user }: { user: SessionUser }) {
  const canEditRoles = hasPermission(user, 'admin.roles');
  const canUsers = hasPermission(user, 'admin.users');
  const canMatrix = canEditRoles || hasPermission(user, 'admin.rbac.read');
  // Only tabs this role can act on are shown (forbidden actions are hidden, not 403s).
  const tabs: [Tab, string][] = ([
    ['permissions', 'Permissions', canMatrix],
    ['people', 'People', canEditRoles],
    ['accounts', 'Login accounts', canUsers],
    ['sessions', 'Sessions', canUsers],
    ['connected', 'Connected accounts', canUsers],
  ] as [Tab, string, boolean][]).filter((t) => t[2]).map(([k, l]) => [k, l]);
  const [picked, setTab] = useState<Tab | null>(null);
  // IT's daily job (unlock / reset / activate) opens first for account admins.
  const tab: Tab = picked ?? (canUsers ? 'accounts' : tabs[0]?.[0] ?? 'permissions');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Master control · access</p>
          <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">
            Roles &amp; permissions
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Permissions are declared once by each API; who holds them is data. Changes take effect on
            the next request and are audited.
          </p>
        </div>
        <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
          {tabs.map(([key, label]) => (
            <Button key={key} size="sm" variant={tab === key ? 'primary' : 'ghost'} onClick={() => { setTab(key); }}>
              {label}
            </Button>
          ))}
        </div>
      </header>

      {tab === 'permissions' ? <PermissionGrid readOnly={!canEditRoles} /> : tab === 'people' ? <PeoplePanel /> : tab === 'accounts' ? <LoginAccountsPanel /> : tab === 'sessions' ? <SessionsPanel /> : <ConnectedAccountsPanel />}
    </div>
  );
}

function PermissionGrid({ readOnly }: { readOnly: boolean }) {
  const stepUp = useStepUpAction();
  const matrix = useDashboardResource<AccessMatrix>('/api/rbac/matrix');
  const [pending, setPending] = useState<string | null>(null);
  const [domain, setDomain] = useState('all');
  const [local, setLocal] = useState<Set<string> | null>(null);

  const granted = useMemo(() => {
    if (local !== null) return local;
    return new Set((matrix.data?.grants ?? []).map((g) => `${g.role}|${g.permission}`));
  }, [matrix.data, local]);

  const domains = useMemo(() => {
    const set = new Set((matrix.data?.permissions ?? []).map(domainOf));
    return ['all', ...[...set].sort()];
  }, [matrix.data]);

  const permissions = useMemo(
    () =>
      (matrix.data?.permissions ?? []).filter((p) => domain === 'all' || domainOf(p) === domain),
    [matrix.data, domain],
  );

  if (matrix.loading) return <DashboardSkeleton />;
  if (matrix.error) return <DashboardError message={matrix.error} onRetry={matrix.reload} />;
  const roles = matrix.data?.roles ?? [];

  const toggle = async (role: string, permission: string, next: boolean) => {
    const key = `${role}|${permission}`;
    setPending(key);
    // Optimistic — the grid must feel like a switchboard, not a form submit.
    setLocal((prev) => {
      const base = new Set(prev ?? granted);
      if (next) base.add(key);
      else base.delete(key);
      return base;
    });
    try {
      await stepUp.run(() => apiFetch('/api/rbac/grants', {
        method: next ? 'POST' : 'DELETE',
        body: JSON.stringify({ role, permission, scope: 'all' }),
      }), `${next ? 'Grant' : 'Revoke'} ${permission} for ${role}.`);
      toast.success(next ? 'Permission granted' : 'Permission revoked', {
        description: `${role} → ${permission}. Effective next request; audited.`,
      });
    } catch (cause) {
      // Roll the cell back rather than leave the grid lying about reality.
      setLocal((prev) => {
        const base = new Set(prev ?? granted);
        if (next) base.delete(key);
        else base.add(key);
        return base;
      });
      toast.error('Change failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      {stepUp.dialog}
      <Card>
        <div className="flex flex-wrap items-center gap-1.5">
          {domains.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={domain === d ? 'primary' : 'ghost'}
              onClick={() => {
                setDomain(d);
              }}
            >
              {d}
            </Button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
          <ShieldCheck className="size-4" />
          {permissions.length} permission(s) × {roles.length} roles. A ticked box means that role
          holds that permission right now.{readOnly ? ' Read-only review.' : ''}
        </p>
        <div className="mt-3">
          <Button size="sm" variant="ghost" leadingIcon={<Download />} onClick={() => {
            apiFetch<{ filename: string; base64: string }>('/api/rbac/matrix/export')
              .then((f) => { downloadBase64(f.filename, f.base64); })
              .catch((e: unknown) => { toast.error('Export failed', { description: e instanceof Error ? e.message : 'Try again.' }); });
          }}>
            Export to Excel
          </Button>
        </div>
      </Card>

      <Card padded={false}>
        {permissions.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title="No permissions in this domain"
            description="Pick another domain."
          />
        ) : (
          <div className="relative overflow-auto">
            <div className="min-w-max">
              <div
                className="sticky top-0 z-10 grid bg-surface-2 text-xs text-ink-muted"
                style={{ gridTemplateColumns: `280px repeat(${String(roles.length)}, 104px)` }}
              >
                <div className="sticky left-0 z-20 bg-surface-2 px-4 py-3 font-semibold">
                  Permission
                </div>
                {roles.map((r) => (
                  <div key={r.code} className="grid place-items-center px-1 py-3 text-center">
                    <span title={r.name}>{r.code}</span>
                  </div>
                ))}
              </div>
              {permissions.map((permission) => (
                <div
                  key={permission}
                  className="grid border-t border-line/50"
                  style={{ gridTemplateColumns: `280px repeat(${String(roles.length)}, 104px)` }}
                >
                  <div className="sticky left-0 z-10 bg-surface px-4 py-3">
                    <code className="text-xs font-semibold text-ink">{permission}</code>
                  </div>
                  {roles.map((r) => {
                    const key = `${r.code}|${permission}`;
                    const on = granted.has(key);
                    return (
                      <div key={r.code} className="grid place-items-center py-2">
                        <Checkbox
                          label=""
                          aria-label={`${on ? 'Revoke' : 'Grant'} ${permission} for ${r.code}`}
                          checked={on}
                          disabled={readOnly || pending === key}
                          onChange={(e) => {
                            void toggle(r.code, permission, e.currentTarget.checked);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function PeoplePanel() {
  const stepUp = useStepUpAction();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [addRole, setAddRole] = useState<Record<number, string>>({});
  const matrix = useDashboardResource<AccessMatrix>('/api/rbac/matrix');

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (term.trim() !== '') params.set('q', term.trim());
      setUsers(await apiFetch<DirectoryUser[]>(`/api/rbac/users?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounced so typing a name doesn't hammer the API.
    const timer = setTimeout(() => {
      void load(query);
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [query, load]);

  const roleOptions: SelectOption[] = (matrix.data?.roles ?? []).map((r) => ({
    value: r.code,
    label: r.name,
    description: r.code,
  }));

  const [orgUnits, setOrgUnits] = useState<SelectOption[]>([]);
  const [addScope, setAddScope] = useState<Record<number, string>>({});
  const [payrollCoverage, setPayrollCoverage] = useState<Record<number, 'group' | 'entity' | ''>>({});
  useEffect(() => {
    apiFetch<{ orgUnits: { id: number; name: string; companyCode: string }[] }>('/api/core/org-units')
      .then((r) => { setOrgUnits(r.orgUnits.map((o) => ({ value: String(o.id), label: `${o.companyCode} · ${o.name}` }))); })
      .catch(() => { setOrgUnits([]); });
  }, []);

  const mutate = async (user: DirectoryUser, role: string, add: boolean) => {
    setBusy(user.userId);
    const coverage = payrollCoverage[user.userId] ?? '';
    const body = !add
      ? { userId: user.userId, role }
      : role === 'payroll_admin'
        ? {
            userId: user.userId,
            role,
            coverage,
            ...(coverage === 'entity' && addScope[user.userId] ? { scopeOrgUnitId: Number(addScope[user.userId]) } : {}),
          }
        : {
            userId: user.userId,
            role,
            ...(ENTITY_SCOPED_ROLES.has(role) && addScope[user.userId]
              ? { scopeOrgUnitId: Number(addScope[user.userId]) }
              : {}),
          };
    try {
      await stepUp.run(() => apiFetch('/api/rbac/user-roles', {
        method: add ? 'POST' : 'DELETE',
        body: JSON.stringify(body),
      }), `${add ? 'Assign' : 'Remove'} ${role} ${add ? 'to' : 'from'} ${user.name ?? user.email}.`);
      toast.success(add ? 'Role assigned' : 'Role removed', {
        description: `${user.name ?? user.email} · ${role}. Effective next request; audited.`,
      });
      await load(query);
    } catch (cause) {
      toast.error(add ? 'Could not assign the role' : 'Could not remove the role', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setBusy(null);
    }
  };

  const chosenRole = (userId: number) => addRole[userId] ?? '';
  const payrollReady = (userId: number) => {
    const coverage = payrollCoverage[userId] ?? '';
    if (coverage === 'group') return true;
    return coverage === 'entity' && Boolean(addScope[userId]);
  };

  return (
    <>
      {stepUp.dialog}
      <DarkCard padded={false} className="p-8">
        <p className="text-sm text-hero-muted">Who payroll can see</p>
        <h2 className="mt-2 text-3xl font-light text-hero-ink">A payroll grant names its reach.</h2>
        <p className="mt-2 max-w-xl text-sm text-hero-muted">
          Payroll can be the whole group or one company. Admin, HR head, IT and CEO cell are always the whole group. HR operations and a plant head stay on one entity.
        </p>
      </DarkCard>
      <Card>
        <TextField
          label="Find a person"
          placeholder="Name, e-code or email…"
          value={query}
          leadingIcon={<Search className="size-4" />}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
          }}
        />
      </Card>

      {loading ? (
        <DashboardSkeleton />
      ) : error !== null ? (
        <DashboardError
          message={error}
          onRetry={() => {
            void load(query);
          }}
        />
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserRoundCog />}
            title="No matching users"
            description="Search by name, employee code or login email."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.userId}>
              <CardHeader
                title={user.name ?? user.email}
                subtitle={[user.ecode, user.email].filter((v) => v !== null).join(' · ')}
                action={
                  <div className="flex items-end gap-2">
                    <Select
                      label="Add role"
                      value={addRole[user.userId] ?? ''}
                      placeholder="Choose…"
                      options={roleOptions.filter((r) => r.value === 'payroll_admin' || !user.roles.includes(r.value))}
                      onChange={(value) => {
                        setAddRole((prev) => ({ ...prev, [user.userId]: value }));
                      }}
                    />
                    {chosenRole(user.userId) === 'payroll_admin' && (
                      <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Payroll coverage">
                        {(['group', 'entity'] as const).map((coverage) => (
                          <Button
                            key={coverage}
                            type="button"
                            size="sm"
                            variant={(payrollCoverage[user.userId] ?? '') === coverage ? 'primary' : 'ghost'}
                            onClick={() => { setPayrollCoverage((prev) => ({ ...prev, [user.userId]: coverage })); }}
                          >
                            {coverage === 'group' ? 'Whole group' : 'One entity'}
                          </Button>
                        ))}
                      </div>
                    )}
                    {(ENTITY_SCOPED_ROLES.has(chosenRole(user.userId)) || (chosenRole(user.userId) === 'payroll_admin' && payrollCoverage[user.userId] === 'entity')) && (
                      <Select
                        label="Entity (org unit)"
                        required
                        value={addScope[user.userId] ?? ''}
                        placeholder="Choose…"
                        options={orgUnits}
                        onChange={(value) => { setAddScope((prev) => ({ ...prev, [user.userId]: value })); }}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy === user.userId}
                      disabled={chosenRole(user.userId) === '' || (ENTITY_SCOPED_ROLES.has(chosenRole(user.userId)) && !addScope[user.userId]) || (chosenRole(user.userId) === 'payroll_admin' && !payrollReady(user.userId))}
                      onClick={() => {
                        void mutate(user, addRole[user.userId] ?? '', true);
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                {user.roles.length === 0 ? (
                  <StatusBadge tone="neutral">No roles — cannot sign in to any surface</StatusBadge>
                ) : (
                  (user.assignments.length > 0 ? user.assignments : user.roles.map((code) => ({ code, scopeOrgUnitId: null, scopeName: null }))).map((assignment) => (
                    <span key={`${assignment.code}-${String(assignment.scopeOrgUnitId)}`} className="flex items-center gap-1">
                      <Pill>{assignmentLabel(assignment)}</Pill>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === user.userId}
                        aria-label={`Remove role ${assignment.code} from ${user.name ?? user.email}`}
                        onClick={() => {
                          void mutate(user, assignment.code, false);
                        }}
                      >
                        Remove
                      </Button>
                    </span>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
