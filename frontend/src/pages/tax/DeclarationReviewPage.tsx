/** PAY-13: scoped proof queue and partial verification. The API owns all policy checks. */
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { downloadBase64 } from '../../lib/files';
import { hasPermission, type SessionUser } from '../../lib/session';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
import { currentFy, fyOptions, inr } from './tax-utils';
interface Item {
  id: number;
  employeeId: number;
  ecode: string;
  name: string;
  section: string;
  declaredPaise: number;
  verifiedPaise: number | null;
  proofDocumentId: number | null;
  verified: boolean;
}
interface Queue {
  items: Item[];
  hasMore: boolean;
}
export function DeclarationReviewPage({ user }: { user: SessionUser }) {
  const [fy, setFy] = useState(currentFy());
  const [ecode, setEcode] = useState('');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const submitting = useRef(false);
  const canManage = hasPermission(user, 'payroll.run.manage');
  useEffect(() => {
    let cancelled = false;
    setQueue(null);
    setDraft({});
    setError(null);
    const timer = setTimeout(() => {
      void apiFetch<Queue>(
        `/api/payroll/declarations?fy=${fy}&ecode=${encodeURIComponent(ecode.trim())}&offset=${String(offset)}`,
      )
        .then((data) => {
          if (!cancelled) {
            setQueue(data);
            setDraft(
              Object.fromEntries(
                data.items.map((i) => [
                  i.id,
                  ((i.verifiedPaise ?? i.declaredPaise) / 100).toFixed(2),
                ]),
              ),
            );
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load declarations.');
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fy, ecode, offset, revision]);
  async function proof(id: number) {
    try {
      const file = await apiFetch<{ filename: string; mime: string; base64: string }>(
        `/api/payroll/declarations/${String(id)}/proof`,
      );
      downloadBase64(file.filename, file.base64, file.mime);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load proof.');
    }
  }
  async function verify(item: Item) {
    if (submitting.current) return;
    const amount = draft[item.id] ?? '';
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError('Enter a nonnegative amount with at most two decimal places.');
      return;
    }
    const [whole = '0', fraction = ''] = amount.split('.');
    const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(paise) || paise > item.declaredPaise) {
      setError('Verified amount cannot exceed the declared amount.');
      return;
    }
    submitting.current = true;
    setBusy(item.id);
    setError(null);
    try {
      await apiFetch('/api/payroll/statutory/verifyDeclaration', {
        method: 'POST',
        body: JSON.stringify({ declarationId: item.id, verifiedAmountPaise: paise }),
      });
      toast.success('Investment proof verification saved.');
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify declaration.');
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Investment proof verification"
        actions={<Button variant="secondary" onClick={()=>{setRevision(v=>v+1);}}>Refresh declarations</Button>}
        description="Review the attached evidence and accept the substantiated amount. Zero records that no amount was accepted. Verified declarations are locked."
      />
      <Card>
        <div className="flex flex-wrap gap-4">
          <Select
            label="Financial year"
            value={fy}
            onChange={(v) => {
              setFy(v);
              setOffset(0);
            }}
            options={fyOptions()}
          />
          <TextField
            label="Filter e-code"
            value={ecode}
            onChange={(e) => {
              setEcode(e.target.value);
              setOffset(0);
            }}
          />
        </div>
      </Card>
      {error && (
        <p role="alert" className="text-negative-ink">
          {error}
        </p>
      )}
      {!queue && !error && <p role="status">Loading declarations…</p>}
      {queue && (
        <Card>
          {queue.items.length === 0 ? (
            <EmptyState
              title="No declarations found"
              description="Choose a different financial year or clear the e-code filter."
            />
          ) : (
            <ul className="divide-y divide-line">
              {queue.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-end gap-4 py-4">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">
                      {i.ecode} · {i.name}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {i.section} · Declared {inr(i.declaredPaise / 100)}
                    </p>
                    <StatusBadge tone={i.verified ? 'positive' : 'neutral'}>
                      {i.verified
                        ? 'Verified'
                        : i.proofDocumentId
                          ? 'Proof submitted'
                          : 'Awaiting proof'}
                    </StatusBadge>
                  </div>
                  {i.proofDocumentId && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void proof(i.id);
                      }}
                    >
                      Download proof for {i.ecode} {i.section}
                    </Button>
                  )}
                  <TextField
                    label={`Verified amount (₹) for ${i.ecode} ${i.section}`}
                    inputMode="decimal"
                    value={draft[i.id] ?? ''}
                    disabled={i.verified || !canManage || busy !== null}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, [i.id]: e.target.value }));
                    }}
                  />
                  {canManage && !i.verified && (
                    <Button
                      loading={busy === i.id}
                      disabled={busy !== null}
                      onClick={() => {
                        void verify(i);
                      }}
                    >
                      Verify {i.ecode} {i.section}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              disabled={offset === 0}
              onClick={() => {
                setOffset((v) => Math.max(0, v - 50));
              }}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={!queue.hasMore}
              onClick={() => {
                setOffset((v) => v + 50);
              }}
            >
              Next
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
