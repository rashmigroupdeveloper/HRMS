/**
 * Alumni portal (UI-01): the signed-in former employee's real exit record — profile,
 * F&F settlement figures, relieving documents and Form 16. No sample data.
 */
import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError, apiFetch } from '../../lib/api';
import { downloadBase64 } from '../../lib/files';
import { Button, Card, CardHeader, EmptyState, Skeleton, StatusBadge, toast } from '../../ui';
import { currentFy } from '../tax/tax-utils';

interface AlumniMe {
  profile: { ecode: string; name: string; designation: string | null; department: string | null; companyName: string; doj: string | null; dol: string | null };
  settlement: { status: string; netPayableRupees: number; gratuityRupees: number; leaveEncashRupees: number; noticeRecoveryRupees: number; paidAt: string | null; relievingLetterId: number | null; serviceCertificateId: number | null } | null;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

export function AlumniPortalPage() {
  const [data, setData] = useState<AlumniMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AlumniMe>('/api/lifecycle/alumni/me').then(setData).catch((e: unknown) => { setError(e instanceof ApiError ? e.message : 'Could not load your exit record.'); });
  }, []);

  async function form16() {
    const dol = data?.profile.dol;
    const fy = dol ? currentFy(new Date(`${dol}T00:00:00Z`)) : currentFy();
    try { const f = await apiFetch<{ filename: string; base64: string }>(`/api/tax/me/form16?fy=${fy}&format=pdf`); downloadBase64(f.filename, f.base64, 'application/pdf'); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Form 16 is not available yet.'); }
  }

  if (error) return <EmptyState title="Exit record unavailable" description={error} />;
  if (!data) return <Skeleton className="h-64" />;
  const { profile: p, settlement: s } = data;
  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6">
      <Card>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">{p.name}</h1>
          <StatusBadge tone="neutral">Alumni</StatusBadge>
        </div>
        <div className="text-sm text-ink-muted mt-1">{[p.ecode, p.designation, p.department, p.companyName].filter(Boolean).join(' · ')}</div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-muted">Date of joining</dt><dd className="font-semibold">{fmt(p.doj)}</dd></div>
          <div><dt className="text-ink-muted">Last working day</dt><dd className="font-semibold">{fmt(p.dol)}</dd></div>
          <div><dt className="text-ink-muted">F&F status</dt><dd className="font-semibold">{s ? s.status.replace(/_/g, ' ') : 'Not computed yet'}</dd></div>
        </dl>
      </Card>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Full & final settlement" />
          {s ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>Gratuity</dt><dd>{inr(s.gratuityRupees)}</dd></div>
              <div className="flex justify-between"><dt>Leave encashment</dt><dd>{inr(s.leaveEncashRupees)}</dd></div>
              <div className="flex justify-between"><dt>Notice recovery</dt><dd>−{inr(s.noticeRecoveryRupees)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Net payable</dt><dd>{inr(s.netPayableRupees)}</dd></div>
              <div className="flex justify-between text-ink-muted"><dt>Paid on</dt><dd>{fmt(s.paidAt)}</dd></div>
            </dl>
          ) : <p className="text-sm text-ink-muted">HR has not computed your settlement yet.</p>}
        </Card>
        <Card>
          <CardHeader title="Documents" />
          <div className="flex flex-col gap-2">
            <Link to="/my/letters"><Button variant="secondary" leadingIcon={<FileText />} disabled={!s?.relievingLetterId}>Relieving letter & service certificate</Button></Link>
            <Button variant="secondary" leadingIcon={<Download />} onClick={() => void form16()}>Form 16 (PDF)</Button>
          </div>
          {!s?.relievingLetterId && <p className="mt-2 text-xs text-ink-muted">Letters are issued when the F&F is paid.</p>}
        </Card>
      </div>
    </div>
  );
}
