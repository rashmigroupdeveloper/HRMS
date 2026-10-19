/**
 * ESS payslip (PAY-06, SOW 5.13) — the employee's own finalized payslips from
 * the real payroll register. No sample data: if payroll for a month is not
 * finalized yet, the page says so.
 */
import { useEffect, useState } from 'react';
import { Download, FileText, Printer, Wallet } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { downloadBase64 } from '../../lib/files';
import { Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, TextField, toast } from '../../ui';
import { currentFy } from '../tax/tax-utils';

interface Line { code: string; name: string; amountRupees: number; calcNote?: string | null }
interface Payslip {
  companyName: string; monthName: string;
  employee: { ecode: string; name: string; designation?: string | null; department?: string | null; panMasked?: string | null; uanMasked?: string | null; bankAccountMasked?: string | null };
  attendance: { daysInMonth: number; payableDays: number; lopDays: number; otMinutes: number };
  earnings: Line[]; deductions: Line[]; employerContributions?: Line[];
  grossRupees: number; totalDeductionsRupees: number; netPayRupees: number; netPayInWords: string;
}
interface Response { payslip: Payslip; html: string }

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
function previousMonth(): string {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  ist.setUTCDate(1); ist.setUTCMonth(ist.getUTCMonth() - 1);
  return ist.toISOString().slice(0, 7);
}

export function MyPayPage() {
  const [month, setMonth] = useState('');
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    apiFetch<Response | null>('/api/payroll/outputs/getMyPayslip', { method: 'POST', body: JSON.stringify(month ? { month } : {}) })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Your payslip could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  function printSlip() {
    if (!data) return;
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed'; frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0';
    frame.srcdoc = data.html;
    frame.onload = () => { frame.contentWindow?.print(); setTimeout(() => { frame.remove(); }, 1000); };
    document.body.appendChild(frame);
  }
  function downloadSlip() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data.html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = `payslip-${data.payslip.employee.ecode}-${data.payslip.monthName.replace(/\s+/g, '-')}.html`; a.click();
    URL.revokeObjectURL(url);
  }

  const slip = data?.payslip;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My pay" title="Payslips" description="Your finalized monthly payslips. Pick a month to see an older one."
        actions={<div className="flex items-end gap-2"><TextField label="Month" type="month" value={month || ''} max={previousMonth()} onChange={(e) => { setMonth(e.target.value); }} hint="Latest finalized month is shown by default" /><Button variant="secondary" leadingIcon={<Download size={14} />} onClick={() => {
          void apiFetch<{ filename: string; base64: string }>(`/api/tax/me/form16?fy=${currentFy()}&format=pdf`).then((f) => { downloadBase64(f.filename, f.base64, 'application/pdf'); }).catch((e: unknown) => { toast.error(e instanceof ApiError ? e.message : 'Form 16 is not available for this year yet.'); });
        }}>Form 16</Button></div>} />
      {loading && <Card><Skeleton className="h-40" /></Card>}
      {!loading && error && <Card><p role="alert" className="text-negative-ink">{error}</p></Card>}
      {!loading && !error && !slip && (
        <Card><EmptyState icon={<Wallet />} title={month ? `No finalized payslip for ${month}` : 'No payslip yet'} description="Payslips appear here once payroll for the month is finalized." /></Card>
      )}
      {!loading && slip && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><p className="text-xs text-ink-muted">Net pay · {slip.monthName}</p><p className="text-2xl font-semibold">{inr(slip.netPayRupees)}</p><p className="text-xs text-ink-muted">{slip.netPayInWords}</p></Card>
            <Card><p className="text-xs text-ink-muted">Gross earnings</p><p className="text-2xl font-semibold">{inr(slip.grossRupees)}</p></Card>
            <Card><p className="text-xs text-ink-muted">Deductions</p><p className="text-2xl font-semibold">{inr(slip.totalDeductionsRupees)}</p><p className="text-xs text-ink-muted">{slip.attendance.payableDays} of {slip.attendance.daysInMonth} days paid{slip.attendance.lopDays > 0 ? ` · ${String(slip.attendance.lopDays)} LOP` : ''}</p></Card>
          </div>
          <Card>
            <CardHeader title={`${slip.companyName} — ${slip.monthName}`} subtitle={`${slip.employee.name} (${slip.employee.ecode})${slip.employee.designation ? ` · ${slip.employee.designation}` : ''}`}
              action={<div className="flex gap-2"><Button variant="secondary" size="sm" leadingIcon={<Printer size={14} />} onClick={printSlip}>Print / PDF</Button><Button variant="secondary" size="sm" leadingIcon={<Download size={14} />} onClick={downloadSlip}>Download</Button></div>} />
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {([['Earnings', slip.earnings], ['Deductions', slip.deductions]] as const).map(([title, lines]) => (
                <section key={title} aria-label={title}>
                  <h3 className="mb-2 flex items-center gap-2 font-semibold"><FileText size={16} aria-hidden />{title}</h3>
                  <ul className="divide-y divide-line text-sm">
                    {lines.map((l) => <li key={l.code} className="flex justify-between gap-3 py-1.5"><span>{l.name}{l.calcNote && <span className="block text-xs text-ink-muted">{l.calcNote}</span>}</span><span className="tabular-nums">{inr(l.amountRupees)}</span></li>)}
                  </ul>
                </section>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-muted">PAN {slip.employee.panMasked ?? '—'} · UAN {slip.employee.uanMasked ?? '—'} · Bank {slip.employee.bankAccountMasked ?? '—'}</p>
          </Card>
        </>
      )}
    </div>
  );
}
