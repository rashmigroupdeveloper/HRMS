/** CLM-04: reimbursement payments have independent state and authorization. */
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { downloadBase64 } from '../../lib/files';
import { hasPermission, type SessionUser } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatusBadge,
  TextField,
  toast,
} from '../../ui';
interface Eligible {
  claimId: number;
  employeeId: number;
  ecode: string;
  name: string;
  companyId: number;
  companyName: string;
  amountRupees: number;
}
interface Batch {
  id: number;
  companyId: number;
  companyName: string;
  status: string;
  totalRupees: number;
  paymentReference: string | null;
}
const inr = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function ReimbursementPaymentsPage({ user }: { user: SessionUser }) {
  return <OwnedReimbursementPaymentsPage key={user.id} user={user} />;
}
function OwnedReimbursementPaymentsPage({ user }: { user: SessionUser }) {
  const manage = hasPermission(user, 'claims.payout.manage');
  const confirm = hasPermission(user, 'claims.payout.confirm');
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [references, setReferences] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected([]);
    void Promise.all([
      apiFetch<Eligible[]>('/api/claims/payments/eligible'),
      apiFetch<Batch[]>('/api/claims/payments'),
    ])
      .then(([e, b]) => {
        if (!cancelled) {
          setEligible(e);
          setBatches(b);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setEligible([]);
          setBatches([]);
          setError(e instanceof Error ? e.message : 'Could not load reimbursement payments.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  async function action(
    key: string,
    path: string,
    body: Record<string, unknown>,
    download = false,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(key);
    setError(null);
    try {
      const result = await apiFetch<{ filename?: string; mime?: string; base64?: string }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (download && result.filename && result.base64)
        downloadBase64(result.filename, result.base64, result.mime ?? 'text/csv');
      toast.success(
        download ? 'Separate reimbursement bank file prepared.' : 'Reimbursement payment updated.',
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update reimbursement payment.');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursement payments"
        description="Pay approved expense claims separately from salary. Access and employee scope are delegated independently by Super Admin."
        actions={
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => {
              setRevision((v) => v + 1);
            }}
          >
            Refresh
          </Button>
        }
      />
      {error && (
        <p role="alert" className="text-negative-ink">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading reimbursement payments…</p>}
      <Card>
        <CardHeader
          title="Approved claims awaiting payment"
          subtitle="Select claims from one company for a separate transfer batch."
        />
        {!loading && eligible.length === 0 ? (
          <EmptyState
            title="No claims ready for payment"
            description="Claims appear after their configured approval chain is complete."
          />
        ) : (
          <ul className="divide-y divide-line">
            {eligible.map((c) => (
              <li
                key={c.claimId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    disabled={!manage || busy !== null}
                    checked={selected.includes(c.claimId)}
                    onChange={(e) => {
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, c.claimId]
                          : ids.filter((id) => id !== c.claimId),
                      );
                    }}
                  />
                  <span>
                    Claim #{c.claimId} · {c.ecode} · {c.name} · {c.companyName}
                  </span>
                </label>
                <span className="tabular-nums">{inr(c.amountRupees)}</span>
              </li>
            ))}
          </ul>
        )}
        {manage && (
          <Button
            className="mt-4"
            loading={busy === 'create'}
            disabled={selected.length === 0 || busy !== null}
            onClick={() => {
              void action('create', '/api/claims/payments', { claimIds: selected });
            }}
          >
            Create reimbursement batch
          </Button>
        )}
      </Card>
      <Card>
        <CardHeader
          title="Reimbursement batches"
          subtitle="Bank preparation reserves a separate payment artifact. Confirm paid only after the reimbursement transfer succeeds."
        />
        {!loading && batches.length === 0 ? (
          <EmptyState
            title="No reimbursement batches"
            description="Create a batch from approved claims above."
          />
        ) : (
          <ul className="divide-y divide-line">
            {batches.map((b) => (
              <li key={b.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p>
                    Reimbursement #{b.id} · {b.companyName} · {inr(b.totalRupees)}
                  </p>
                  <StatusBadge tone={b.status === 'paid' ? 'positive' : 'neutral'}>
                    {b.status}
                  </StatusBadge>
                </div>
                {b.paymentReference && (
                  <p className="text-sm text-ink-muted">Transfer reference: {b.paymentReference}</p>
                )}
                {manage && b.status !== 'cancelled' && (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      void action(
                        `bank-${String(b.id)}`,
                        `/api/claims/payments/${String(b.id)}/bank-file`,
                        { id: b.id },
                        true,
                      );
                    }}
                  >
                    {b.status === 'draft' ? 'Prepare' : 'Download'} reimbursement bank file #{b.id}
                  </Button>
                )}
                {confirm && b.status === 'prepared' && (
                  <div className="flex flex-wrap items-end gap-3">
                    <TextField
                      label={`Reimbursement transfer reference for batch ${String(b.id)}`}
                      value={references[b.id] ?? ''}
                      disabled={busy !== null}
                      onChange={(e) => {
                        setReferences((r) => ({ ...r, [b.id]: e.target.value }));
                      }}
                    />
                    <Button
                      disabled={busy !== null || (references[b.id] ?? '').trim().length < 3}
                      loading={busy === `paid-${String(b.id)}`}
                      onClick={() => {
                        void action(
                          `paid-${String(b.id)}`,
                          `/api/claims/payments/${String(b.id)}/paid`,
                          { id: b.id, paymentReference: references[b.id] },
                        );
                      }}
                    >
                      Confirm reimbursement #{b.id} paid
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
