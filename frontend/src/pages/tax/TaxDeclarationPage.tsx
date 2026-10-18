/**
 * ESS investment declaration + regime choice + Form 16 (handover item 3, SOW payroll/TDS).
 * Windows come from settings (tax.declaration_window / tax.proof_window); the server enforces them.
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { downloadBase64, fileToBase64 } from '../../lib/files';
import { Button, Card, CardHeader, PageHeader, Select, Skeleton, StatusBadge, TextField, toast } from '../../ui';
import { currentFy, fyOptions, inr } from './tax-utils';

interface Section { code: string; label: string; capRupees: number | null }
interface Item { id: number; section: string; declaredRupees: number; verifiedRupees: number | null; proofDocumentId: number | null; status: 'declared' | 'proof_submitted' | 'verified' }
interface Mine { fy: string; regime: 'old' | 'new' | null; declarationOpen: boolean; proofOpen: boolean; windows: { declaration: { open: string; close: string }; proof: { open: string; close: string } }; sections: Section[]; items: Item[] }

const msg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function TaxDeclarationPage() {
  const [fy, setFy] = useState(currentFy());
  const [data, setData] = useState<Mine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    apiFetch<Mine>(`/api/tax/me/declarations?fy=${fy}`)
      .then((d) => { setData(d); setDraft(Object.fromEntries(d.items.map((i) => [i.section, String(i.declaredRupees)]))); })
      .catch((e: unknown) => { setData(null); setError(msg(e, 'Could not load your declarations.')); });
  }, [fy]);
  useEffect(load, [load]);

  async function save(section: string, proofDocumentId?: number) {
    setBusy(section);
    try {
      await apiFetch('/api/tax/me/declarations', { method: 'POST', body: JSON.stringify({ fy, section, amountRupees: Number(draft[section] ?? 0), ...(proofDocumentId ? { proofDocumentId } : {}) }) });
      toast.success(proofDocumentId ? 'Proof attached.' : 'Declaration saved.'); load();
    } catch (e) { toast.error(msg(e, 'Could not save.')); } finally { setBusy(null); }
  }
  async function attach(section: string, file: File | undefined) {
    if (!file) return;
    setBusy(section);
    try {
      const { documentId } = await apiFetch<{ documentId: number }>('/api/tax/me/proofs', { method: 'POST', body: JSON.stringify({ filename: file.name, base64: await fileToBase64(file) }) });
      await save(section, documentId);
    } catch (e) { toast.error(msg(e, 'Could not upload the proof.')); setBusy(null); }
  }
  async function regime(r: 'old' | 'new') {
    try { await apiFetch('/api/tax/me/regime', { method: 'POST', body: JSON.stringify({ fy, regime: r }) }); toast.success(`${r === 'new' ? 'New' : 'Old'} regime selected.`); load(); }
    catch (e) { toast.error(msg(e, 'Could not change regime.')); }
  }
  async function form16() {
    try { const f = await apiFetch<{ filename: string; base64: string }>(`/api/tax/me/form16?fy=${fy}&format=pdf`); downloadBase64(f.filename, f.base64, 'application/pdf'); }
    catch (e) { toast.error(msg(e, 'Form 16 is not available for this year yet.')); }
  }

  const byCode = new Map(data?.items.map((i) => [i.section, i]) ?? []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My pay · Tax" title="Investment declaration"
        description="Declare planned tax-saving investments, attach proofs in the proof window, and download Form 16."
        actions={<Button variant="secondary" leadingIcon={<Download />} onClick={() => void form16()}>Form 16 (PDF)</Button>} />
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40"><Select label="Financial year" value={fy} onChange={setFy} options={fyOptions()} /></div>
          {data && (
            <>
              <div className="text-sm">
                <div className="font-medium">Tax regime</div>
                <div className="mt-1 flex gap-2">
                  {(['old', 'new'] as const).map((r) => (
                    <Button key={r} size="sm" variant={data.regime === r ? 'primary' : 'ghost'} disabled={!data.declarationOpen} onClick={() => void regime(r)}>{r === 'new' ? 'New regime' : 'Old regime'}</Button>
                  ))}
                </div>
              </div>
              <StatusBadge tone={data.declarationOpen ? 'positive' : 'neutral'}>{data.declarationOpen ? 'Declaration window open' : `Declarations ${data.windows.declaration.open} → ${data.windows.declaration.close}`}</StatusBadge>
              <StatusBadge tone={data.proofOpen ? 'positive' : 'neutral'}>{data.proofOpen ? 'Proof window open' : `Proofs ${data.windows.proof.open} → ${data.windows.proof.close}`}</StatusBadge>
            </>
          )}
        </div>
        {data?.regime === 'new' && <p className="mt-3 text-sm text-[var(--text-muted)]">Under the new regime most Chapter VI-A deductions do not reduce TDS; declarations are kept for your records.</p>}
      </Card>
      <Card>
        <CardHeader title="Sections" />
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        {!data && !error && <Skeleton className="h-40" />}
        {data && (
          <ul className="divide-y divide-[var(--border)]">
            {data.sections.map((s) => {
              const item = byCode.get(s.code);
              const locked = item?.status === 'verified';
              return (
                <li key={s.code} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,2fr)_10rem_auto] sm:items-end">
                  <div>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{s.capRupees === null ? 'No fixed cap' : `Cap ${inr(s.capRupees)}`}{item ? ` · ${item.status.replace('_', ' ')}` : ''}{item && item.verifiedRupees !== null ? ` · verified ${inr(item.verifiedRupees)}` : ''}</div>
                  </div>
                  <TextField label="Amount (₹)" type="number" inputMode="numeric" value={draft[s.code] ?? ''} disabled={locked || !data.declarationOpen}
                    onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, [s.code]: v })); }} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" loading={busy === s.code} disabled={locked || !data.declarationOpen || (draft[s.code] ?? '') === ''} onClick={() => void save(s.code)}>Save</Button>
                    {item && !locked && (data.proofOpen || data.declarationOpen) && (
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-[var(--surface-2)]">
                        <Upload className="size-4" aria-hidden />{item.proofDocumentId ? 'Replace proof' : 'Attach proof'}
                        <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => void attach(s.code, e.target.files?.[0])} />
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
