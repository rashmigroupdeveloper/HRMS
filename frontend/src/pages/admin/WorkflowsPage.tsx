/**
 * Approval-chain editor (docs/08 §4, WF-01).
 *
 * Approval routing is DATA, not code: who approves a leave request, how long
 * they have, and what happens when the SLA breaches are rows in
 * `wf.definitions`, editable here and effective on the very next request. The
 * seeded catalog is only a set of defaults.
 *
 * Editing a chain is audited old→new. Chains already in flight keep the steps
 * they started with — this changes what NEW requests will follow.
 */
import { useMemo, useState } from 'react';
import { GitBranch, Plus, Trash2, Workflow } from 'lucide-react';
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
  Select,
  StatusBadge,
  Switch,
  TextField,
  toast,
} from '../../ui';
import type { Column, SelectOption } from '../../ui';
import { DashboardError, DashboardSkeleton } from '../home/DashboardFeedback';
import { useDashboardResource } from '../home/useDashboardResource';

type OnBreach = 'escalate' | 'auto_reject' | 'lapse' | 'auto_approve';

interface StepSpec {
  step: number;
  approver: string;
  slaHours: number;
  onBreach: OnBreach;
  escalateTo?: string;
}

interface Definition {
  code: string;
  name: string;
  steps: unknown;
  isActive: boolean;
}

/** The approver vocabulary the engine resolves (workflow.service stepSpecSchema). */
const APPROVER_PRESETS: SelectOption[] = [
  { value: 'reporting_manager', label: 'Reporting manager', description: 'The employee’s RM at request time' },
  { value: 'functional_manager', label: 'Functional manager', description: 'Dotted-line manager' },
  { value: 'role:hr_ops', label: 'Role — HR Ops' },
  { value: 'role:hr_head', label: 'Role — HR Head' },
  { value: 'role:payroll_admin', label: 'Role — Payroll Admin' },
  { value: 'role:plant_head', label: 'Role — Plant Head' },
  { value: 'role:senior_manager', label: 'Role — Senior Manager' },
  { value: 'role:ceo_cell', label: 'Role — CEO Cell' },
];

const BREACH_OPTIONS: SelectOption[] = [
  { value: 'escalate', label: 'Escalate', description: 'Pass to the approver’s manager' },
  { value: 'lapse', label: 'Lapse', description: 'Request dies unapproved (OT 48h rule)' },
  { value: 'auto_approve', label: 'Auto-approve', description: 'Approve at cutoff (Restricted Holiday)' },
  { value: 'auto_reject', label: 'Auto-reject', description: 'Reject at cutoff' },
];

function parseSteps(raw: unknown): StepSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): StepSpec[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const e = entry as Record<string, unknown>;
    if (typeof e['approver'] !== 'string') return [];
    return [
      {
        step: typeof e['step'] === 'number' ? e['step'] : 1,
        approver: e['approver'],
        slaHours: typeof e['slaHours'] === 'number' ? e['slaHours'] : 48,
        onBreach: typeof e['onBreach'] === 'string' ? (e['onBreach'] as OnBreach) : 'escalate',
        ...(typeof e['escalateTo'] === 'string' ? { escalateTo: e['escalateTo'] } : {}),
      },
    ];
  });
}

function approverLabel(spec: string): string {
  const preset = APPROVER_PRESETS.find((p) => p.value === spec);
  if (preset) return preset.label;
  if (spec.startsWith('role:')) return `Role — ${spec.slice(5)}`;
  if (spec.startsWith('user:')) return `User #${spec.slice(5)}`;
  return spec;
}

export function WorkflowsPage({ user }: { user: SessionUser }) {
  const catalog = useDashboardResource<Definition[]>('/api/workflows/definitions');
  const canEdit = hasPermission(user, 'admin.settings');
  const [editing, setEditing] = useState<Definition | null>(null);

  if (catalog.loading) return <DashboardSkeleton />;
  if (catalog.error) return <DashboardError message={catalog.error} onRetry={catalog.reload} />;

  const columns: Column<Definition>[] = [
    {
      key: 'name',
      header: 'Workflow',
      width: 'minmax(220px,1.2fr)',
      render: (row) => (
        <div>
          <span className="font-semibold text-ink">{row.name}</span>
          <p className="mt-0.5 text-xs text-ink-muted">
            <code>{row.code}</code>
          </p>
        </div>
      ),
    },
    {
      key: 'chain',
      header: 'Approval chain',
      width: 'minmax(280px,2fr)',
      render: (row) => {
        const steps = parseSteps(row.steps);
        if (steps.length === 0) return <span className="text-ink-faint">Auto-approved (no steps)</span>;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {steps.map((s, i) => (
              <span key={`${String(s.step)}-${s.approver}`} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span aria-hidden="true" className="text-ink-faint">
                    →
                  </span>
                )}
                <Pill>{approverLabel(s.approver)}</Pill>
                <span className="text-[10px] tabular-nums text-ink-muted">{s.slaHours}h</span>
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'breach',
      header: 'On SLA breach',
      width: '140px',
      render: (row) => {
        const steps = parseSteps(row.steps);
        const last = steps.at(-1);
        if (!last) return <span className="text-ink-faint">—</span>;
        return (
          <StatusBadge tone={last.onBreach === 'lapse' ? 'negative' : 'neutral'}>{last.onBreach}</StatusBadge>
        );
      },
    },
    {
      key: 'active',
      header: 'Status',
      width: '110px',
      render: (row) => (
        <StatusBadge tone={row.isActive ? 'positive' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    {
      key: 'act',
      header: '',
      width: '100px',
      render: (row) =>
        canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(row);
            }}
          >
            Edit
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Master control · approvals</p>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-ink">Approval chains</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Who approves what, how long they have, and what happens when they don’t. Editing a chain
          takes effect on the next request raised — requests already in flight keep their original
          steps.
        </p>
      </header>

      <Card>
        <CardHeader
          title={`${(catalog.data ?? []).length.toLocaleString('en-IN')} workflows`}
          subtitle="Runtime data (wf.definitions) — never hardcoded in a handler."
        />
      </Card>

      <DataTable
        rows={catalog.data ?? []}
        columns={columns}
        rowKey={(row) => row.code}
        maxHeight={640}
        empty={
          <EmptyState
            icon={<Workflow />}
            title="No workflows defined"
            description="Run npm run seed:workflows to load the docs/08 §4 catalog."
          />
        }
      />

      <ChainEditor
        definition={editing}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          catalog.reload();
        }}
      />
    </div>
  );
}

function ChainEditor({
  definition,
  onClose,
  onSaved,
}: {
  definition: Definition | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [steps, setSteps] = useState<StepSpec[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (definition !== null && loadedFor !== definition.code) {
    setLoadedFor(definition.code);
    setSteps(parseSteps(definition.steps));
    setIsActive(definition.isActive);
    setError(null);
  }

  const renumbered = useMemo(() => steps.map((s, i) => ({ ...s, step: i + 1 })), [steps]);

  const update = (index: number, patch: Partial<StepSpec>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const remove = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };
  const add = () => {
    setSteps((prev) => [
      ...prev,
      { step: prev.length + 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'escalate' },
    ]);
  };

  const save = async () => {
    if (!definition) return;
    if (renumbered.length === 0) {
      setError('A chain needs at least one step. Deactivate it instead of emptying it.');
      return;
    }
    if (renumbered.some((s) => s.slaHours <= 0)) {
      setError('Every step needs an SLA greater than zero hours.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/workflows/definitions/${encodeURIComponent(definition.code)}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: definition.code,
          name: definition.name,
          steps: renumbered,
          isActive,
        }),
      });
      toast.success('Approval chain updated', {
        description: `${definition.name} applies to requests raised from now on. The change was audited.`,
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the chain.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={definition !== null}
      onClose={onClose}
      title={definition?.name ?? 'Workflow'}
      subtitle={definition ? `wf.definitions · ${definition.code}` : undefined}
      width={620}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save chain
          </Button>
        </div>
      }
    >
      {definition && (
        <div className="space-y-5">
          <Switch
            label="Chain is active"
            description="An inactive chain refuses new requests for this type."
            checked={isActive}
            onChange={(e) => {
              setIsActive(e.currentTarget.checked);
            }}
          />

          <div className="space-y-3">
            {renumbered.map((step, index) => (
              <Card key={index} padded={false}>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <GitBranch className="size-4 text-ink-muted" />
                      Step {step.step}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      leadingIcon={<Trash2 className="size-4" />}
                      onClick={() => {
                        remove(index);
                      }}
                    >
                      Remove
                    </Button>
                  </div>

                  <Select
                    label="Approver"
                    value={step.approver}
                    options={
                      APPROVER_PRESETS.some((p) => p.value === step.approver)
                        ? APPROVER_PRESETS
                        : [...APPROVER_PRESETS, { value: step.approver, label: approverLabel(step.approver) }]
                    }
                    onChange={(value) => {
                      update(index, { approver: value });
                    }}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="SLA (hours)"
                      type="number"
                      value={String(step.slaHours)}
                      onChange={(e) => {
                        update(index, { slaHours: Number(e.currentTarget.value) });
                      }}
                    />
                    <Select
                      label="On breach"
                      value={step.onBreach}
                      options={BREACH_OPTIONS}
                      onChange={(value) => {
                        update(index, { onBreach: value as OnBreach });
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button variant="secondary" leadingIcon={<Plus className="size-4" />} onClick={add}>
            Add step
          </Button>

          {error !== null && (
            <p className="text-sm text-negative" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs leading-5 text-ink-muted">
            Every step records a notification receipt when it opens (WF-04), so “the approver was
            never notified” stays provable rather than arguable.
          </p>
        </div>
      )}
    </Drawer>
  );
}
