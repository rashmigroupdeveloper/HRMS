/**
 * Payroll Review Grid (docs/05 §4.5, PAY-03, SOW-177..178).
 *
 * Interactive employee review grid:
 * - Δ vs last month sorting (biggest changes rise to the top)
 * - Anomaly filter (negative net, >10% variance, payment holds)
 * - Row selection opens PayslipDrawer with per-line calc_note
 */

import { useState } from 'react';
import { AlertCircle, ArrowUpDown, User } from 'lucide-react';
import {
  Card,
  CardHeader,
  Checkbox,
  Pill,
  StatusBadge,
  TextField,
} from '../../ui';
import type { PayslipDrawerEmployee } from './PayslipDrawer';

export interface GridEmployeeItem extends PayslipDrawerEmployee {
  grossDelta?: number;
  netDelta?: number;
  anomalies?: string[];
  isHold?: boolean;
}

interface PayrollReviewGridProps {
  items: GridEmployeeItem[];
  onSelectEmployee: (emp: GridEmployeeItem) => void;
}

export function PayrollReviewGrid({
  items,
  onSelectEmployee,
}: PayrollReviewGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [sortByDelta, setSortByDelta] = useState(true);

  // Filter items
  const filtered = items.filter((item) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ecode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.department?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const isAnomaly =
      item.netPayRupees < 0 ||
      (item.isHold ?? false) ||
      (item.anomalies?.length ?? 0) > 0 ||
      Math.abs(item.grossDelta ?? 0) >= 5000;

    if (anomaliesOnly && !isAnomaly) return false;
    return matchesSearch;
  });

  // Sort: biggest change vs last month on top (docs/05 §4.5)
  const sorted = [...filtered].sort((a, b) => {
    if (sortByDelta) {
      const deltaA = Math.abs(a.grossDelta ?? 0);
      const deltaB = Math.abs(b.grossDelta ?? 0);
      return deltaB - deltaA;
    }
    return b.netPayRupees - a.netPayRupees;
  });

  const totalNet = items.reduce((acc, i) => acc + i.netPayRupees, 0);
  const anomalyCount = items.filter(
    (i) => i.netPayRupees < 0 || (i.isHold ?? false) || (i.anomalies?.length ?? 0) > 0
  ).length;

  return (
    <Card className="space-y-4">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span>Employee Register & Review Grid</span>
            <Pill>{String(items.length)} employees</Pill>
            {anomalyCount > 0 && (
              <StatusBadge tone="warning">
                <AlertCircle className="mr-1 size-3" />
                {String(anomalyCount)} anomalies
              </StatusBadge>
            )}
          </div>
        }
        subtitle="People × payable days · LOP · gross · deductions · net · Δ vs last month. Tap any row to inspect line calculations."
        action={
          <div className="text-right">
            <span className="text-xs text-ink-muted">Total Net Payout: </span>
            <span className="text-sm font-semibold tabular-nums text-ink">
              ₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-rule py-3">
        <div className="w-72">
          <TextField
            label="Search"
            placeholder="Search by name, e-code, dept..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.currentTarget.value); }}
          />
        </div>

        <div className="flex items-center gap-4">
          <Checkbox
            label="Show anomalies only"
            checked={anomaliesOnly}
            onChange={(e) => { setAnomaliesOnly(e.currentTarget.checked); }}
          />

          <button
            type="button"
            onClick={() => { setSortByDelta(!sortByDelta); }}
            className="inline-flex items-center gap-1.5 rounded-btn border border-rule bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
          >
            <ArrowUpDown className="size-3.5" />
            {sortByDelta ? 'Sorted by: Largest Δ (Month-on-Month)' : 'Sorted by: Net Pay'}
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-rule bg-surface-2 text-ink-muted">
              <th className="py-2.5 pl-3 pr-2 font-medium">Employee</th>
              <th className="px-2 py-2.5 font-medium">Department</th>
              <th className="px-2 py-2.5 text-center font-medium">Payable / LOP</th>
              <th className="px-2 py-2.5 text-center font-medium">OT (hrs)</th>
              <th className="px-2 py-2.5 text-right font-medium">Gross (₹)</th>
              <th className="px-2 py-2.5 text-right font-medium">Deductions (₹)</th>
              <th className="px-2 py-2.5 text-right font-medium">Net Pay (₹)</th>
              <th className="px-2 py-2.5 text-right font-medium">Δ vs Last Mo</th>
              <th className="py-2.5 pl-2 pr-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-ink-muted">
                  No employee records match the filter criteria.
                </td>
              </tr>
            ) : (
              sorted.map((emp) => {
                const hasAnomaly = emp.netPayRupees < 0 || (emp.anomalies && emp.anomalies.length > 0);
                const isPositiveDelta = (emp.grossDelta ?? 0) >= 0;

                return (
                  <tr
                    key={emp.id}
                    onClick={() => { onSelectEmployee(emp); }}
                    className="cursor-pointer transition-colors hover:bg-surface-2"
                  >
                    <td className="py-3 pl-3 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-surface-3 text-ink-muted">
                          <User className="size-3.5" />
                        </div>
                        <div>
                          <p className="font-medium text-ink">{emp.name}</p>
                          <p className="font-mono text-[11px] text-ink-muted">{emp.ecode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-ink-muted">
                      {emp.department ?? 'General'}
                    </td>
                    <td className="px-2 py-3 text-center tabular-nums">
                      <span className="font-medium text-ink">{emp.payableDays.toFixed(1)}</span>
                      {emp.lopDays > 0 && (
                        <span className="ml-1 text-[11px] text-danger">(-{emp.lopDays.toFixed(1)})</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center tabular-nums text-ink-muted">
                      {emp.otMinutes > 0 ? (emp.otMinutes / 60).toFixed(1) : '—'}
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums text-ink">
                      {emp.grossRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums text-ink-muted">
                      {emp.deductionsRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums font-semibold">
                      <span className={emp.netPayRupees < 0 ? 'text-danger' : 'text-accent'}>
                        ₹{emp.netPayRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums">
                      {emp.grossDelta !== undefined && emp.grossDelta !== 0 ? (
                        <span className={`text-[11px] font-medium ${isPositiveDelta ? 'text-positive' : 'text-danger'}`}>
                          {isPositiveDelta ? '+' : ''}₹{emp.grossDelta.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="py-3 pl-2 pr-3 text-center">
                      {emp.isHold ? (
                        <StatusBadge tone="warning">On Hold</StatusBadge>
                      ) : hasAnomaly ? (
                        <StatusBadge tone="negative">Flagged</StatusBadge>
                      ) : (
                        <StatusBadge tone="positive">Payable</StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
