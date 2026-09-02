/**
 * Policy settings console (CORE-10, docs/04 §8) — the screen that makes
 * "config over code" true for HR instead of aspirational.
 *
 * Every policy number in the product reads from `core.settings`; this page is
 * the only sanctioned way to change one without a deploy. Writes go through
 * `PUT /settings/{key}` (permission `admin.settings`), which audits old→new
 * into the hash chain, so a rate change is always attributable.
 *
 * Read is open to any authenticated user (the values are not secret and HR
 * needs to see the rules they work under); the editor only appears for holders
 * of `admin.settings`.
 */
import { useMemo, useState } from 'react';
import { Search, Settings2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { SessionUser } from '../../lib/session';
import { hasPermission } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  Pill,
  Switch,
  TextField,
  Textarea,
  toast,
} from '../../ui';
import type { Column } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

type ValueType = 'number' | 'string' | 'boolean' | 'json';

interface SettingRow {
  key: string;
  value: unknown;
  valueType: ValueType;
  description: string;
}

/** `att.grace_minutes` → "att" — the module that owns the policy. */
function groupOf(key: string): string {
  const dot = key.indexOf('.');
  return dot === -1 ? 'general' : key.slice(0, dot);
}

function displayValue(row: SettingRow): string {
  if (row.valueType === 'json') return JSON.stringify(row.value);
  if (row.valueType === 'boolean') return row.value === true ? 'true' : 'false';
  return String(row.value);
}

/** Parse the editor's text back to the declared type. Returns an error message
 *  instead of throwing so the drawer can show it inline. */
function parseValue(raw: string, type: ValueType): { ok: true; value: unknown } | { ok: false; error: string } {
  if (type === 'number') {
    const n = Number(raw.trim());
    if (raw.trim() === '' || Number.isNaN(n)) return { ok: false, error: 'Enter a number.' };
    return { ok: true, value: n };
  }
  if (type === 'boolean') return { ok: true, value: raw === 'true' };
  if (type === 'json') {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, error: 'Not valid JSON.' };
    }
  }
  if (raw.trim() === '') return { ok: false, error: 'Value cannot be empty.' };
  return { ok: true, value: raw };
}

export function SettingsPage({ user }: { user: SessionUser }) {
  const settings = useDashboardResource<SettingRow[]>('/api/settings');
  const canEdit = hasPermission(user, 'admin.settings');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [editing, setEditing] = useState<SettingRow | null>(null);

  const groups = useMemo(() => {
    const set = new Set((settings.data ?? []).map((s) => groupOf(s.key)));
    return ['all', ...[...set].sort()];
  }, [settings.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (settings.data ?? []).filter((s) => {
      if (group !== 'all' && groupOf(s.key) !== group) return false;
      if (term === '') return true;
      return s.key.toLowerCase().includes(term) || s.description.toLowerCase().includes(term);
    });
  }, [settings.data, search, group]);

  if (settings.loading) return <DashboardSkeleton />;
  if (settings.error) return <DashboardError message={settings.error} onRetry={settings.reload} />;

  const columns: Column<SettingRow>[] = [
    {
      key: 'key',
      header: 'Setting',
      width: 'minmax(240px,1.2fr)',
      render: (row) => (
        <div>
          <span className="font-semibold text-ink">{row.key}</span>
          <p className="mt-0.5 text-xs text-ink-muted">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Current value',
      width: 'minmax(150px,0.7fr)',
      render: (row) => (
        <code className="rounded-row bg-surface-2 px-2 py-1 text-xs text-ink">{displayValue(row)}</code>
      ),
    },
    { key: 'type', header: 'Type', width: '96px', render: (row) => <Pill>{row.valueType}</Pill> },
    {
      key: 'act',
      header: '',
      width: '110px',
      render: (row) =>
        canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(row);
            }}
          >
            Change
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Master control · policy store</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every policy number the product uses — grace minutes, OT thresholds, caps, divisors — lives
          here, not in code. Changes take effect on the next request and are audited old→new.
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <TextField
              label="Search"
              placeholder="Key or description…"
              value={search}
              leadingIcon={<Search className="size-4" />}
              onChange={(e) => {
                setSearch(e.currentTarget.value);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={group === g ? 'primary' : 'ghost'}
                onClick={() => {
                  setGroup(g);
                }}
              >
                {g}
              </Button>
            ))}
          </div>
        </div>
        {!canEdit && (
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-4" />
            Read-only — changing a policy value requires the <code>admin.settings</code> permission.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`${rows.length.toLocaleString('en-IN')} of ${(settings.data ?? []).length.toLocaleString('en-IN')} settings`}
          subtitle="Grouped by the module that owns the policy."
        />
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.key}
        maxHeight={620}
        empty={
          <EmptyState
            icon={<Settings2 />}
            title="No settings match"
            description="Clear the search or pick another module."
          />
        }
      />

      <SettingEditor
        setting={editing}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          settings.reload();
        }}
      />
    </div>
  );
}

function SettingEditor({
  setting,
  onClose,
  onSaved,
}: {
  setting: SettingRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Seed the editor when a different setting opens (no effect needed —
  // derive-during-render keeps the drawer honest if the row changes underneath).
  if (setting !== null && loadedFor !== setting.key) {
    setLoadedFor(setting.key);
    setRaw(setting.valueType === 'json' ? JSON.stringify(setting.value, null, 2) : displayValue(setting));
    setReason('');
    setError(null);
  }

  const save = async () => {
    if (!setting) return;
    const parsed = parseValue(raw, setting.valueType);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (reason.trim().length < 4) {
      setError('Give a short reason — it is stored with the audit entry.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/settings/${encodeURIComponent(setting.key)}`, {
        method: 'PUT',
        body: JSON.stringify({
          key: setting.key,
          value: parsed.value,
          valueType: setting.valueType,
          description: `${setting.description} · changed: ${reason.trim()}`,
        }),
      });
      toast.success('Policy updated', {
        description: `${setting.key} takes effect on the next request; the change was audited.`,
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={setting !== null}
      onClose={onClose}
      title={setting?.key ?? 'Setting'}
      subtitle={setting?.description}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save change
          </Button>
        </div>
      }
    >
      {setting && (
        <div className="space-y-5">
          <div className="rounded-row bg-surface-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Current</p>
            <code className="mt-1 block break-all text-sm text-ink">{displayValue(setting)}</code>
          </div>

          {setting.valueType === 'boolean' ? (
            <Switch
              label="Enabled"
              description="Turning this off changes behaviour on the next request."
              checked={raw === 'true'}
              onChange={(e) => {
                setRaw(e.currentTarget.checked ? 'true' : 'false');
              }}
            />
          ) : setting.valueType === 'json' ? (
            <Textarea
              label="New value (JSON)"
              rows={8}
              value={raw}
              onChange={(e) => {
                setRaw(e.currentTarget.value);
              }}
            />
          ) : (
            <TextField
              label="New value"
              type={setting.valueType === 'number' ? 'number' : 'text'}
              value={raw}
              onChange={(e) => {
                setRaw(e.currentTarget.value);
              }}
            />
          )}

          <TextField
            label="Reason for the change"
            placeholder="e.g. HR circular 12/2026 — grace raised to 10 min"
            value={reason}
            onChange={(e) => {
              setReason(e.currentTarget.value);
            }}
          />

          {error !== null && (
            <p className="text-sm text-negative" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs leading-5 text-ink-muted">
            This writes an audit row (old → new) attributed to you. Policy values are never hardcoded,
            so this is the only place the number changes.
          </p>
        </div>
      )}
    </Drawer>
  );
}
