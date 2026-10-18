/**
 * Salary Structures Management & CTC Breakup Simulator (PAY-01, PAY-02, SOW-072..075, SOW-082..090).
 * Warm Editorial design system — docs/05 §4.5 & docs/12.
 */
import { useEffect, useState } from 'react';
import {
  Layers,
  Calculator,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  PageHeader,
  Select,
  StatusBadge,
  TextField,
  toast,
  type Column,
} from '../../ui';
import { apiFetch } from '../../lib/api';

interface SalaryComponentItem {
  component_code: string;
  formula_override?: string | null;
  amount_rule?: string | null;
}

interface SalaryStructure {
  id: number;
  name: string;
  company_id: number;
  description: string | null;
  components: SalaryComponentItem[];
  is_active: boolean;
  created_at: string;
}

interface SalaryComponent {
  code: string;
  name: string;
  kind: 'earning' | 'deduction' | 'employer_contribution';
  formula: string | null;
  rounding: string;
  taxable: boolean;
  part_of_gross: boolean;
  part_of_pf_wages: boolean;
  display_order: number;
}

interface BreakupResult {
  monthly: Record<string, number>;
  annual: Record<string, number>;
  monthlyGross: number;
  annualGross: number;
  monthlyEmployerCost: number;
  annualEmployerCost: number;
  monthlyCtc: number;
  annualCtc: number;
  monthlyDeductions: number;
  monthlyNet: number;
  evaluationOrder: string[];
  validation: {
    valid: boolean;
    diffPaise: number;
    message?: string;
  };
}

export function SalaryStructuresPage() {
  const [activeTab, setActiveTab] = useState<'structures' | 'components' | 'simulator'>('structures');
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);

  // Structure Creation Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [structureName, setStructureName] = useState('');
  const [structureDesc, setStructureDesc] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([
    'BASIC',
    'HRA',
    'MEDICAL_ALLOW',
    'SPECIAL_ALLOW',
    'EDUCATION_ALLOW',
    'STATUTORY_BONUS',
    'PF_EE',
    'PT',
    'PF_ER',
    'EPS_ER',
    'EDLI',
    'PF_ADMIN',
  ]);
  const [savingStructure, setSavingStructure] = useState(false);

  // Simulator State
  const [simCtcRupees, setSimCtcRupees] = useState<number>(600000);
  const [simProbationPercent, setSimProbationPercent] = useState<string>('none');
  const [simStructureId, setSimStructureId] = useState<number | undefined>(undefined);
  const [breakup, setBreakup] = useState<BreakupResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [structsRes, compsRes] = await Promise.all([
        apiFetch<SalaryStructure[]>('/api/payroll/structures').catch(() => []),
        apiFetch<SalaryComponent[]>('/api/payroll/components').catch(() => []),
      ]);
      setStructures(structsRes);
      setComponents(compsRes);
      if (structsRes.length > 0 && !simStructureId) {
        setSimStructureId(structsRes[0]?.id);
      }
    } catch (err: unknown) {
      toast.error('Error loading salary data', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulate() {
    if (!simCtcRupees || simCtcRupees <= 0) {
      toast.warning('Please enter a valid Annual CTC');
      return;
    }
    setSimulating(true);
    try {
      const probationVal = simProbationPercent === 'none' ? undefined : Number(simProbationPercent);
      const res = await apiFetch<BreakupResult>('/api/payroll/structures/preview', {
        method: 'POST',
        body: JSON.stringify({
          structure_id: simStructureId,
          annual_ctc_rupees: simCtcRupees,
          probation_percent: probationVal,
        }),
      });
      setBreakup(res);
      toast.success('Breakup resolved via DAG formula evaluator');
    } catch (err: unknown) {
      toast.error('Simulation failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSimulating(false);
    }
  }

  async function handleCreateStructure() {
    if (!structureName.trim()) {
      toast.warning('Structure name is required');
      return;
    }
    if (selectedComponents.length === 0) {
      toast.warning('Select at least one component');
      return;
    }

    setSavingStructure(true);
    try {
      const items: SalaryComponentItem[] = selectedComponents.map((code) => ({
        component_code: code,
      }));
      await apiFetch<SalaryStructure>('/api/payroll/structures', {
        method: 'POST',
        body: JSON.stringify({
          name: structureName.trim(),
          company_id: 1,
          description: structureDesc.trim() || null,
          components: items,
          is_active: true,
        }),
      });
      toast.success('Salary structure created and validated');
      setDrawerOpen(false);
      setStructureName('');
      setStructureDesc('');
      void loadData();
    } catch (err: unknown) {
      toast.error('Failed to create structure', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSavingStructure(false);
    }
  }

  const structureColumns: Column<SalaryStructure>[] = [
    {
      key: 'name',
      header: 'Structure Name',
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          {row.description && <div className="text-xs text-ink-muted">{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'components',
      header: 'Components',
      render: (row) => (
        <span className="text-xs font-mono text-ink-muted">
          {row.components.length} components
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge tone={row.is_active ? 'positive' : 'neutral'}>
          {row.is_active ? 'Active' : 'Archived'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      numeric: true,
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSimStructureId(row.id);
            setActiveTab('simulator');
          }}
        >
          Test in Simulator
        </Button>
      ),
    },
  ];

  const componentColumns: Column<SalaryComponent>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Component Name',
      render: (row) => <span className="text-sm text-ink">{row.name}</span>,
    },
    {
      key: 'kind',
      header: 'Type',
      render: (row) => {
        const tone = row.kind === 'earning' ? 'positive' : row.kind === 'deduction' ? 'warning' : 'info';
        return <StatusBadge tone={tone}>{row.kind.replace('_', ' ')}</StatusBadge>;
      },
    },
    {
      key: 'formula',
      header: 'Formula Rule',
      render: (row) =>
        row.formula ? (
          <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded text-ink">
            {row.formula}
          </code>
        ) : (
          <span className="text-xs text-ink-subtle">Fixed / Override</span>
        ),
    },
    {
      key: 'flags',
      header: 'Statutory Flags',
      render: (row) => (
        <div className="flex gap-1.5 text-[10px] text-ink-muted">
          {row.part_of_gross && <span className="px-1 bg-surface-2 rounded">Gross</span>}
          {row.part_of_pf_wages && <span className="px-1 bg-surface-2 rounded">PF Base</span>}
          {row.taxable && <span className="px-1 bg-surface-2 rounded">Taxable</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Salary Structures & CTC Breakups"
        description="Directed Acyclic Graph (DAG) formula evaluator, RML live component templates & probation scaling."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leadingIcon={<Calculator className="size-4" />}
              onClick={() => {
                setActiveTab('simulator');
              }}
            >
              CTC Simulator
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Plus className="size-4" />}
              onClick={() => {
                setDrawerOpen(true);
              }}
            >
              New Structure
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-line pb-2 [scrollbar-width:none] [&>*]:shrink-0">
        <button
          onClick={() => {
            setActiveTab('structures');
          }}
          className={`px-4 py-2 text-sm font-medium rounded-row transition-colors ${
            activeTab === 'structures'
              ? 'bg-surface-2 text-ink font-semibold'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="size-4" />
            Salary Structures ({structures.length})
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('components');
          }}
          className={`px-4 py-2 text-sm font-medium rounded-row transition-colors ${
            activeTab === 'components'
              ? 'bg-surface-2 text-ink font-semibold'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="size-4" />
            Components Catalog ({components.length})
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('simulator');
          }}
          className={`px-4 py-2 text-sm font-medium rounded-row transition-colors ${
            activeTab === 'simulator'
              ? 'bg-surface-2 text-ink font-semibold'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calculator className="size-4" />
            Live CTC Simulator & DAG Checker
          </div>
        </button>
      </div>

      {/* Structures Tab */}
      {activeTab === 'structures' && (
        <Card>
          <CardHeader
            title="Standard Salary Templates"
            subtitle="Configured per grade, employment category, and plant location. Evaluated in topological DAG order."
          />
          <div className="p-4">
            {structures.length === 0 && !loading ? (
              <EmptyState
                icon={<Layers className="size-6" />}
                title="No Salary Structures"
                description="Create a salary structure to begin defining CTC breakups and formulas."
                action={
                  <Button
                    variant="primary"
                    onClick={() => {
                      setDrawerOpen(true);
                    }}
                  >
                    Create Structure
                  </Button>
                }
              />
            ) : (
              <DataTable<SalaryStructure>
                columns={structureColumns}
                rows={structures}
                rowKey={(s) => String(s.id)}
              />
            )}
          </div>
        </Card>
      )}

      {/* Components Catalog Tab */}
      {activeTab === 'components' && (
        <Card>
          <CardHeader
            title="Salary Components Master"
            subtitle="Seeded with live RML ground truth (09-RECON §2): Basic, HRA 50%, fixed Medical/Education, Special balancing."
          />
          <div className="p-4">
            <DataTable<SalaryComponent>
              columns={componentColumns}
              rows={components}
              rowKey={(c) => c.code}
            />
          </div>
        </Card>
      )}

      {/* CTC Simulator Tab */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="CTC Breakup Simulator & DAG Formula Verifier"
              subtitle="Computes exact paise amounts across all components, verifies zero-float conservation and probation scaling."
            />
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Select
                  label="Salary Structure"
                  value={simStructureId ? String(simStructureId) : null}
                  onChange={(val) => {
                    setSimStructureId(Number(val));
                  }}
                  options={structures.map((s) => ({ value: String(s.id), label: s.name }))}
                />
              </div>

              <div>
                <TextField
                  label="Annual CTC (₹)"
                  type="number"
                  value={String(simCtcRupees)}
                  onChange={(e) => {
                    setSimCtcRupees(Number(e.target.value));
                  }}
                  placeholder="e.g. 600000"
                />
              </div>

              <div>
                <Select
                  label="Probation Phase Scaling"
                  value={simProbationPercent}
                  onChange={(val) => {
                    setSimProbationPercent(val);
                  }}
                  options={[
                    { value: 'none', label: 'Confirmed (100%)' },
                    { value: '90', label: 'Probation 90%' },
                    { value: '80', label: 'Probation 80%' },
                    { value: '70', label: 'Probation 70%' },
                  ]}
                />
              </div>

              <div>
                <Button
                  variant="primary"
                  className="w-full"
                  leadingIcon={<Calculator className="size-4" />}
                  onClick={() => {
                    void handleSimulate();
                  }}
                  loading={simulating}
                >
                  Simulate Breakup
                </Button>
              </div>
            </div>
          </Card>

          {breakup && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Summary Tiles */}
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
                    Monthly Gross
                  </div>
                  <div className="text-2xl font-bold font-mono mt-1 text-ink">
                    ₹{breakup.monthlyGross.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    Annual: ₹{breakup.annualGross.toLocaleString('en-IN')}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
                    Monthly Deductions
                  </div>
                  <div className="text-2xl font-bold font-mono mt-1 text-warning-ink">
                    ₹{breakup.monthlyDeductions.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    PF EE, PT, ESIC, Tax
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
                    Net Take-Home
                  </div>
                  <div className="text-2xl font-bold font-mono mt-1 text-positive-ink">
                    ₹{breakup.monthlyNet.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    Gross − Deductions
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
                    Employer Costs
                  </div>
                  <div className="text-2xl font-bold font-mono mt-1 text-ink-muted">
                    ₹{breakup.monthlyEmployerCost.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    PF ER, EPS, EDLI, Gratuity
                  </div>
                </Card>
              </div>

              {/* Validation & Verification Badge */}
              <div className="lg:col-span-3">
                <div
                  className={`p-4 rounded-card flex items-center justify-between border ${
                    breakup.validation.valid
                      ? 'bg-[color-mix(in_srgb,var(--positive)_12%,var(--surface))] border-positive text-positive-ink'
                      : 'bg-[color-mix(in_srgb,var(--negative)_12%,var(--surface))] border-negative text-negative-ink'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {breakup.validation.valid ? (
                      <CheckCircle2 className="size-5 text-positive-ink" />
                    ) : (
                      <AlertTriangle className="size-5 text-negative-ink" />
                    )}
                    <div>
                      <div className="font-semibold text-sm">
                        {breakup.validation.valid
                          ? 'Zero-Float Paisa Conservation Verified'
                          : 'CTC Breakup Mismatch Detected'}
                      </div>
                      <div className="text-xs opacity-90">
                        {breakup.validation.valid
                          ? `Annual CTC exactly equals Σ(Monthly Components × 12). Discrepancy: ${String(breakup.validation.diffPaise)} paise.`
                          : breakup.validation.message}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-mono font-medium">
                    Order: {breakup.evaluationOrder.join(' → ')}
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown Table */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader
                    title="Component Breakup (Paise to Rupee)"
                    subtitle="Deterministic output from topological DAG formula resolution"
                  />
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-xs text-ink-muted text-left">
                          <th className="py-2">Component</th>
                          <th className="py-2 text-right">Monthly (₹)</th>
                          <th className="py-2 text-right">Annual (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-line">
                        {Object.entries(breakup.monthly).map(([code, amt]) => (
                          <tr key={code} className="hover:bg-surface-2">
                            <td className="py-2.5 font-mono text-xs font-semibold text-ink">
                              {code}
                            </td>
                            <td className="py-2.5 text-right font-mono font-medium text-ink">
                              ₹{amt.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 text-right font-mono text-ink-muted">
                              ₹{(breakup.annual[code] ?? amt * 12).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* DAG Execution Trace */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader
                    title="DAG Resolution Sequence"
                    subtitle="Evaluation order guaranteeing dependent inputs exist"
                  />
                  <div className="p-4 space-y-2">
                    {breakup.evaluationOrder.map((code, idx) => (
                      <div
                        key={code}
                        className="flex items-center gap-2 p-2 rounded-row bg-surface-2 text-xs"
                      >
                        <span className="size-5 flex items-center justify-center rounded-full bg-surface font-mono text-[10px] text-ink-muted">
                          {idx + 1}
                        </span>
                        <span className="font-mono font-semibold text-ink">
                          {code}
                        </span>
                        <ArrowRight className="size-3 ml-auto text-ink-subtle" />
                        <span className="font-mono font-medium text-accent">
                          ₹{(breakup.monthly[code] ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Structure Creator Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
        title="Create Salary Structure"
      >
        <div className="space-y-4 p-4">
          <div>
            <TextField
              label="Structure Name *"
              value={structureName}
              onChange={(e) => {
                setStructureName(e.target.value);
              }}
              placeholder="e.g. White Collar E1 — Kharagpur"
            />
          </div>

          <div>
            <TextField
              label="Description"
              value={structureDesc}
              onChange={(e) => {
                setStructureDesc(e.target.value);
              }}
              placeholder="e.g. Standard manufacturing staff grade"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-2">
              Select Components in Structure
            </label>
            <div className="space-y-2 max-h-80 overflow-y-auto border border-line rounded-row p-2">
              {components.map((c) => {
                const isSelected = selectedComponents.includes(c.code);
                return (
                  <label
                    key={c.code}
                    className="flex items-center gap-2 p-1.5 rounded-row hover:bg-surface-2 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedComponents([...selectedComponents, c.code]);
                        } else {
                          setSelectedComponents(selectedComponents.filter((x) => x !== c.code));
                        }
                      }}
                      className="rounded border-line"
                    />
                    <span className="font-mono font-semibold text-ink">{c.code}</span>
                    <span className="text-ink-muted">— {c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex gap-2">
            <Button
              variant="primary"
              className="w-full"
              loading={savingStructure}
              onClick={() => {
                void handleCreateStructure();
              }}
            >
              Save Structure
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDrawerOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
