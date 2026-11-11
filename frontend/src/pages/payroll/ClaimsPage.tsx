import { Link } from 'react-router-dom';
import { hasPermission, type SessionUser } from '../../lib/session';
import { apiFetch } from '../../lib/api';
import { fileToBase64, downloadBase64 } from '../../lib/files';
import { todayISOIST } from '../../lib/date';
import { formatINR } from '../../lib/format';
import { ownedDraftKey } from '../../lib/draft-storage';
/**
 * Claims & Reimbursements Page (M12, CLM-01..07)
 *
 * Implements:
 * - ESS: Grade entitlement live balances, claim submission with multi-bill receipts
 * - Manager & HR: Bill proof verification queue with line-item review and partial approval
 * - Independently delegated reimbursement operators: link to separate payment console
 */
import { authFetch, responseError } from '../../lib/api';
import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, PlusCircle, ShieldCheck, XCircle, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  type Column,
  Drawer,
  ReceiptCapture,
  PageHeader,
  Select,
  StatusBadge,
  type StatusTone,
  TextField,
  toast,
  EmptyState,
} from '../../ui';
import { takeActionParam } from '../_shared/action-param';

type Tab = 'mine' | 'verify';

interface EntitlementSummary {
  claimTypeCode: string;
  claimTypeName: string;
  basis: 'annual' | 'monthly' | 'per_event';
  totalEntitlementRupees: number;
  approvedClaimsRupees: number;
  pendingClaimsRupees: number;
  availableBalanceRupees: number;
  billRequired: boolean;
  taxableIfUnsubstantiated: boolean;
  payoutComponentCode: string;
}

interface ClaimBill {
  id: number;
  documentId: number;
  billNo: string | null;
  billDate: string | null;
  amountRupees: number;
  verified: boolean;
  verifiedBy: number | null;
}

interface ClaimItem {
  id: number;
  employeeId: number;
  ecode: string;
  employeeName: string;
  claimTypeCode: string;
  claimTypeName: string;
  payoutComponentCode: string;
  periodFrom: string;
  periodTo: string;
  claimedAmountRupees: number;
  approvedAmountRupees: number | null;
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'paid';
  rejectionReason: string | null;
  advanceLoanId: number | null;
  paidInRunId: number | null;
  paidInBatchId: number | null;
  reimbursementBatchId: number | null;
  createdAt: string;
  bills: ClaimBill[];
}

export function ClaimsPage({ user }: { user: SessionUser }) {
  const canVerify = hasPermission(user, 'claims.approve');
  const canPayout = hasPermission(user, 'claims.payout.view');
  const canVerifyBills = hasPermission(user, 'claims.verify');
  const [tab, setTab] = useState<Tab>('mine');
  const [entitlements, setEntitlements] = useState<EntitlementSummary[]>([]);
  const [myClaims, setMyClaims] = useState<ClaimItem[]>([]);
  const [pendingClaims, setPendingClaims] = useState<ClaimItem[]>([]);

  const submitting = useRef(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const uploadVersions = useRef<Record<string, number>>({});
  const uploadsPending = Object.values(uploading).some(Boolean);

  // New Claim Drawer state
  const [newClaimOpen, setNewClaimOpen] = useState(() => takeActionParam('new'));
  const [selectedType, setSelectedType] = useState('medical');
  const [periodFrom, setPeriodFrom] = useState(() => `${todayISOIST().slice(0, 7)}-01`);
  const [periodTo, setPeriodTo] = useState(todayISOIST);
  const [bills, setBills] = useState<
    { id: string; billNo: string; billDate: string; amount: string; documentId: number }[]
  >([{ id: '1', billNo: '', billDate: todayISOIST(), amount: '', documentId: 0 }]);

  const draftKey = ownedDraftKey('claims', user.id);
  const skipDraftPersistRef = useRef(true);

  // Restore draft when new claim drawer opens
  useEffect(() => {
    if (!newClaimOpen) {
      skipDraftPersistRef.current = true;
      return;
    }
    skipDraftPersistRef.current = true;
    if (draftKey) {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as {
            savedAt?: number;
            selectedType?: string;
            periodFrom?: string;
            periodTo?: string;
            bills?: { id: string; billNo: string; billDate: string; amount: string; documentId: number }[];
          } | null;
          if (draft !== null && typeof draft.savedAt === 'number' && Date.now() - draft.savedAt < 24 * 60 * 60 * 1000) {
            if (typeof draft.selectedType === 'string') setSelectedType(draft.selectedType);
            if (typeof draft.periodFrom === 'string') setPeriodFrom(draft.periodFrom);
            if (typeof draft.periodTo === 'string') setPeriodTo(draft.periodTo);
            if (Array.isArray(draft.bills) && draft.bills.length > 0) {
              setBills(draft.bills);
            }
          }
        }
      } catch {
        // discard invalid draft
      }
    }
  }, [newClaimOpen, draftKey]);

  // Persist draft changes
  useEffect(() => {
    if (!newClaimOpen || !draftKey) return;
    if (skipDraftPersistRef.current) {
      skipDraftPersistRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            savedAt: Date.now(),
            selectedType,
            periodFrom,
            periodTo,
            bills,
          }),
        );
      } catch {
        // storage quota or blocked
      }
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [newClaimOpen, draftKey, selectedType, periodFrom, periodTo, bills]);

  // Verification modal state
  const [verifyDrawerOpen, setVerifyDrawerOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [verifiedBillIds, setVerifiedBillIds] = useState<Record<number, boolean>>({});
  const [partialAmount, setPartialAmount] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionAction, setDecisionAction] = useState<'approve' | 'partially_approve' | 'reject'>(
    'approve',
  );

  useEffect(() => {
    void loadData();
  }, [tab]);

  async function loadData() {
    try {
      if (tab === 'mine') {
        const entRes = await authFetch('/api/claims/my-entitlements');
        if (entRes.ok) {
          const entData = (await entRes.json()) as EntitlementSummary[];
          setEntitlements(entData);
        }
        const clmRes = await authFetch('/api/claims/my');
        if (clmRes.ok) {
          const clmData = (await clmRes.json()) as ClaimItem[];
          setMyClaims(clmData);
        }
      } else {
        const res = await authFetch('/api/claims/pending');
        if (res.ok) {
          const data = (await res.json()) as ClaimItem[];
          setPendingClaims(data.filter((c) => c.status === 'pending' || c.status === 'verified'));
        }
      }
    } catch (e: unknown) {
      // No sample data: show the real failure.
      toast.error(e instanceof Error ? e.message : 'Could not load data. Please retry.');
    }
  }

  function addBillRow() {
    setBills([
      ...bills,
      {
        id: String(Date.now()),
        billNo: '',
        billDate: todayISOIST(),
        amount: '',
        documentId: 0,
      },
    ]);
  }

  function removeBillRow(id: string) {
    uploadVersions.current[id] = (uploadVersions.current[id] ?? 0) + 1;
    setUploading((state) => ({ ...state, [id]: false }));
    if (bills.length > 1) {
      setBills(bills.filter((b) => b.id !== id));
    }
  }

  function updateBillRow(id: string, field: 'billNo' | 'billDate' | 'amount', value: string) {
    setBills(bills.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  const totalNewClaimAmount = bills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  const activeEntitlement = entitlements.find((e) => e.claimTypeCode === selectedType);
  const isOverEntitled = activeEntitlement
    ? totalNewClaimAmount > activeEntitlement.availableBalanceRupees
    : false;

  async function downloadReceipt(billId: number) {
    try {
      const file = await apiFetch<{ filename: string; mime: string; base64: string }>(
        `/api/claims/${tab === 'mine' ? 'me/' : ''}receipts/${String(billId)}`,
      );
      downloadBase64(file.filename, file.base64, file.mime);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download receipt.');
    }
  }

  async function attachReceipt(id: string, file: File | null) {
    const version = (uploadVersions.current[id] ?? 0) + 1;
    uploadVersions.current[id] = version;
    setBills((rows) => rows.map((row) => (row.id === id ? { ...row, documentId: 0 } : row)));
    setUploading((state) => ({ ...state, [id]: file !== null }));
    if (!file) return;
    try {
      const result = await apiFetch<{ documentId: number }>('/api/claims/receipts', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, base64: await fileToBase64(file) }),
      });
      if (uploadVersions.current[id] === version) {
        setBills((rows) =>
          rows.map((row) => (row.id === id ? { ...row, documentId: result.documentId } : row)),
        );
        toast.success('Receipt uploaded.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload receipt.');
    } finally {
      if (uploadVersions.current[id] === version)
        setUploading((state) => ({ ...state, [id]: false }));
    }
  }

  async function handleSubmitClaim() {
    if (submitting.current || uploadsPending) return;
    if (bills.some((b) => b.documentId <= 0)) {
      toast.error('Upload a receipt for each bill before submitting.');
      return;
    }

    if (totalNewClaimAmount <= 0) {
      toast.error('Bill amount must be positive');
      return;
    }
    submitting.current = true;
    setClaimBusy(true);
    try {
      const res = await authFetch('/api/claims/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimTypeCode: selectedType,
          periodFrom,
          periodTo,
          bills: bills.map((b) => ({
            documentId: b.documentId,
            billNo: b.billNo || undefined,
            billDate: b.billDate || undefined,
            amountRupees: parseFloat(b.amount),
          })),
        }),
      });

      if (res.ok) {
        toast.success('Claim submitted to the configured approval chain.');
        if (draftKey) {
          try {
            window.localStorage.removeItem(draftKey);
          } catch {
            // ignore
          }
        }
        setBills([{ id: String(Date.now()), billNo: '', billDate: todayISOIST(), amount: '', documentId: 0 }]);
        setNewClaimOpen(false);
        void loadData();
      } else {
        toast.error(await responseError(res, 'Submission failed'));
      }
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : 'Could not reach the server. Nothing was saved.',
      );
    } finally {
      submitting.current = false;
      setClaimBusy(false);
    }
  }

  function handleOpenVerification(claim: ClaimItem) {
    setSelectedClaim(claim);
    setPartialAmount(String(claim.approvedAmountRupees ?? claim.claimedAmountRupees));
    setDecisionReason('');
    setDecisionAction('approve');
    const flags: Record<number, boolean> = {};
    claim.bills.forEach((b) => {
      flags[b.id] = b.verified;
    });
    setVerifiedBillIds(flags);
    setVerifyDrawerOpen(true);
  }

  async function handleConfirmDecision() {
    if (!selectedClaim) return;

    if (decisionAction === 'reject' && !decisionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    if (decisionAction === 'partially_approve' && !decisionReason.trim()) {
      toast.error('Explanation is required for partial approval');
      return;
    }

    try {
      const res = await authFetch('/api/claims/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: selectedClaim.id,
          action: decisionAction,
          approvedAmountRupees:
            decisionAction === 'partially_approve'
              ? parseFloat(partialAmount)
              : decisionAction === 'approve'
                ? selectedClaim.claimedAmountRupees
                : 0,
          rejectionReason: decisionReason || undefined,
          billVerifications: Object.entries(verifiedBillIds).map(([billId, verified]) => ({
            billId: parseInt(billId, 10),
            verified,
          })),
        }),
      });

      if (res.ok) {
        const result = (await res.json()) as { status: string };
        toast.success(
          result.status === 'pending' || result.status === 'verified'
            ? 'Approval step recorded; the remaining configured approvers must act.'
            : `Claim ${result.status}.`,
        );
        setVerifyDrawerOpen(false);
        void loadData();
      } else {
        toast.error(await responseError(res, 'Decision recording failed'));
      }
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : 'Could not reach the server. Nothing was saved.',
      );
    }
  }

  const claimColumns: Column<ClaimItem>[] = [
    {
      key: 'id',
      sortValue: (r) => r.id,
      exportValue: (r) => `CLM-${String(r.id)}`,
      mobile: 'subtitle',
      header: 'Claim ID',
      render: (r) => <span className="font-mono text-xs font-semibold">CLM-{r.id}</span>,
    },
    ...(tab !== 'mine'
      ? [
          {
            key: 'employeeName',
            sortValue: (r: ClaimItem) => `${r.employeeName} ${r.ecode}`,
            header: 'Employee',
            render: (r: ClaimItem) => (
              <div>
                <span className="font-medium text-ink">{r.employeeName}</span>
                <span className="block text-xs font-mono text-ink-muted">{r.ecode}</span>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'claimTypeName',
      sortValue: (r) => r.claimTypeName,
      mobile: 'title',
      header: 'Category',
      render: (r) => <span className="text-xs font-medium text-ink">{r.claimTypeName}</span>,
    },
    {
      key: 'period',
      sortValue: (r) => r.periodFrom,
      exportValue: (r) => `${r.periodFrom} to ${r.periodTo}`,
      header: 'Expense Period',
      render: (r) => (
        <span className="text-xs text-ink-muted">
          {r.periodFrom} to {r.periodTo}
        </span>
      ),
    },
    {
      key: 'claimedAmountRupees',
      numeric: true,
      sortValue: (r) => r.claimedAmountRupees,
      header: 'Claimed',
      render: (r) => (
        <span className="tabular-nums font-medium text-ink">
          {formatINR(r.claimedAmountRupees)}
        </span>
      ),
    },
    {
      key: 'approvedAmountRupees',
      numeric: true,
      sortValue: (r) => r.approvedAmountRupees,
      header: 'Approved',
      render: (r) => (
        <span className="tabular-nums font-semibold text-accent-ink">
          {r.approvedAmountRupees !== null ? formatINR(r.approvedAmountRupees) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      sortValue: (r) => r.status,
      mobile: 'badge',
      header: 'Status',
      render: (r) => {
        let tone: StatusTone = 'neutral';
        if (r.status === 'approved' || r.status === 'paid') {
          tone = 'positive';
        } else if (r.status === 'pending' || r.status === 'verified') {
          tone = 'warning';
        } else {
          tone = 'negative';
        }
        return (
          <StatusBadge tone={tone}>
            {r.status === 'approved' && r.reimbursementBatchId !== null
              ? 'AWAITING REIMBURSEMENT PAYMENT'
              : r.status.toUpperCase()}
          </StatusBadge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => {
        if (tab === 'verify') {
          return (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                handleOpenVerification(r);
              }}
            >
              Verify Bills
            </Button>
          );
        }
        return (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedClaim(r);
              setVerifyDrawerOpen(true);
            }}
          >
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Claims"
        title="Reimbursements"
        description="Upload receipts, follow configured approvals, and track separate reimbursement payments."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 max-w-full overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] [&>*]:shrink-0">
              <Button
                size="sm"
                variant={tab === 'mine' ? 'primary' : 'ghost'}
                onClick={() => {
                  setTab('mine');
                }}
              >
                My Claims
              </Button>
              {canVerify && (
                <Button
                  size="sm"
                  variant={tab === 'verify' ? 'primary' : 'ghost'}
                  onClick={() => {
                    setTab('verify');
                  }}
                >
                  Verification Queue
                </Button>
              )}
              {canPayout && (
                <Link to="/claims/payments">
                  <Button size="sm" variant="secondary">
                    Reimbursement payments
                  </Button>
                </Link>
              )}
            </div>
            {tab === 'mine' && (
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<PlusCircle className="size-4" />}
                onClick={() => {
                  setNewClaimOpen(true);
                }}
              >
                Submit Claim
              </Button>
            )}
          </div>
        }
      />

      {/* Tab: My Claims */}
      {tab === 'mine' && (
        <div className="space-y-6">
          {/* Entitlement Cards Grid */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3">
              Entitlements & available balances
            </h3>
            {entitlements.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Wallet />}
                  title="No claim entitlements"
                  description="Entitlements come from your grade. If you expected some, ask HR to check your grade and claim policy."
                />
              </Card>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {entitlements.map((e) => (
                <Card key={e.claimTypeCode} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-ink-muted">{e.claimTypeName}</p>
                      <StatusBadge tone="neutral">{e.basis}</StatusBadge>
                    </div>
                    <p className="mt-3 text-2xl font-light text-ink">
                      {formatINR(e.availableBalanceRupees)}
                    </p>
                    <p className="text-xs text-ink-muted">Available this period</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line text-xs text-ink-muted space-y-1">
                    <div className="flex justify-between">
                      <span>Total Limit:</span>
                      <span className="font-medium text-ink">
                        {formatINR(e.totalEntitlementRupees)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Approved:</span>
                      <span className="text-positive-ink font-medium">
                        {formatINR(e.approvedClaimsRupees)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>In Review:</span>
                      <span className="text-warning-ink font-medium">
                        {formatINR(e.pendingClaimsRupees)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Claims History */}
          <Card padded={false}>
            <div className="p-6">
              <CardHeader
                title="Submitted Claims History"
                subtitle="Attached bills and receipts remain permanently linked through verification and settlement."
              />
            </div>
            <DataTable<ClaimItem>
              columns={claimColumns}
              rows={myClaims}
              rowKey={(r) => String(r.id)}
              tableId="claims.mine"
              caption="My claims"
              exportName="my-claims"
            />
          </Card>
        </div>
      )}

      {/* Tab: Verification Queue */}
      {tab === 'verify' && (
        <Card padded={false}>
          <div className="p-6">
            <CardHeader
              title="HR & Manager Proof Verification Queue"
              subtitle="Inspect receipts, verify line-item validity, and approve full or partial amounts."
            />
          </div>
          <DataTable<ClaimItem>
            columns={claimColumns}
            rows={pendingClaims}
            rowKey={(r) => String(r.id)}
            tableId="claims.verify"
            caption="Claims awaiting verification"
            searchable
            searchPlaceholder="Search employee, e-code, category…"
            exportName="claims-verification-queue"
          />
        </Card>
      )}

      {/* New Claim Drawer */}
      <Drawer
        open={newClaimOpen}
        onClose={() => {
          setNewClaimOpen(false);
        }}
        title="Submit Reimbursement Claim"
        subtitle="Upload verified receipts and bills against grade entitlements."
        width={560}
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Claim Type"
              value={selectedType}
              onChange={(val) => {
                setSelectedType(val);
              }}
              options={entitlements.map((e) => ({
                value: e.claimTypeCode,
                label: `${e.claimTypeName} (${formatINR(e.availableBalanceRupees)} available)`,
              }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Period From"
                type="date"
                value={periodFrom}
                onChange={(e) => {
                  setPeriodFrom(e.target.value);
                }}
              />
              <TextField
                label="Period To"
                type="date"
                value={periodTo}
                onChange={(e) => {
                  setPeriodTo(e.target.value);
                }}
              />
            </div>
          </div>

          {/* Bills List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">Attached Receipts & Bills</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={addBillRow}
                leadingIcon={<PlusCircle className="size-4" />}
              >
                Add Another Bill
              </Button>
            </div>

            {bills.map((b, idx) => (
              <div
                key={b.id}
                className="grid grid-cols-2 items-end gap-3 rounded-tile bg-surface-2 p-3 sm:grid-cols-[1fr_auto_7rem_auto]"
              >
                <span className="col-span-2 text-xs font-semibold tabular-nums text-ink-muted sm:hidden">
                  Bill {idx + 1}
                </span>
                <TextField
                  label="Bill No"
                  placeholder="e.g. INV-1002"
                  value={b.billNo}
                  onChange={(e) => {
                    updateBillRow(b.id, 'billNo', e.target.value);
                  }}
                  className="col-span-2 sm:col-span-1"
                />
                <TextField
                  label="Bill Date"
                  type="date"
                  value={b.billDate}
                  onChange={(e) => {
                    updateBillRow(b.id, 'billDate', e.target.value);
                  }}
                />
                <TextField
                  label="Amount (₹)"
                  placeholder="2500"
                  type="number"
                  value={b.amount}
                  onChange={(e) => {
                    updateBillRow(b.id, 'amount', e.target.value);
                  }}
                  inputMode="decimal"
                />
                {bills.length > 1 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      removeBillRow(b.id);
                    }}
                    className="mb-1 justify-self-end"
                    aria-label={`Remove bill ${String(idx + 1)}`}
                  >
                    <XCircle className="size-4 text-negative-ink" />
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <ReceiptCapture
                  className="col-span-2 sm:col-span-4"
                  label={`Receipt for bill ${String(idx + 1)}`}
                  onChange={(file) => {
                    void attachReceipt(b.id, file);
                  }}
                />
                {uploading[b.id] && <p role="status">Uploading receipt…</p>}
              </div>
            ))}
          </div>

          <p className="text-xs text-ink-muted">
            Upload a receipt for each bill. HR reviews the stored evidence during approval.
          </p>

          {/* Total & Validation */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-surface-2 p-4">
            <div>
              <p className="text-xs text-ink-muted">Total Claimed Amount</p>
              <p className="text-xl font-semibold text-ink">{formatINR(totalNewClaimAmount)}</p>
            </div>
            {isOverEntitled ? (
              <div className="flex items-center gap-2 text-negative-ink text-xs font-medium">
                <AlertCircle className="size-4" />
                <span>
                  Exceeds available balance (
                  {formatINR(activeEntitlement?.availableBalanceRupees ?? 0)})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-positive-ink text-xs font-medium">
                <CheckCircle2 className="size-4" />
                <span>Within entitlement balance</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button
              variant="ghost"
              onClick={() => {
                setNewClaimOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={claimBusy}
              disabled={
                uploadsPending || totalNewClaimAmount <= 0 || bills.some((b) => b.documentId <= 0)
              }
              onClick={() => {
                void handleSubmitClaim();
              }}
            >
              Submit for Approval
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Bill Verification & Decision Drawer */}
      <Drawer
        open={verifyDrawerOpen}
        onClose={() => {
          setVerifyDrawerOpen(false);
        }}
        title={selectedClaim ? `Review Claim: CLM-${String(selectedClaim.id)}` : 'Review Claim'}
        subtitle={
          selectedClaim
            ? `${selectedClaim.employeeName} (${selectedClaim.ecode}) • ${selectedClaim.claimTypeName}`
            : ''
        }
        width={560}
      >
        {selectedClaim && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface-2 p-4">
              <div>
                <span className="text-xs text-ink-muted">Claimed Amount</span>
                <p className="text-lg font-semibold text-ink">
                  {formatINR(selectedClaim.claimedAmountRupees)}
                </p>
              </div>
              <div>
                <span className="text-xs text-ink-muted">Expense Period</span>
                <p className="text-sm font-medium text-ink">
                  {selectedClaim.periodFrom} to {selectedClaim.periodTo}
                </p>
              </div>
            </div>

            {/* Bill Line-item Check */}
            <div>
              <h4 className="text-sm font-semibold text-ink mb-3">Line-item Bill Verification</h4>
              <div className="space-y-2">
                {selectedClaim.bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between rounded-lg border border-line p-3 bg-surface-1"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        Bill No: {bill.billNo ?? 'N/A'} • {bill.billDate ?? ''}
                      </p>
                      <p className="text-xs text-ink-muted">Receipt Ref: DOC-{bill.documentId}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="tabular-nums font-semibold text-ink">
                        {formatINR(bill.amountRupees)}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void downloadReceipt(bill.id);
                        }}
                      >
                        Download receipt {bill.billNo ?? String(bill.id)}
                      </Button>
                      {tab === 'verify' && canVerifyBills && (
                        <Button
                          size="sm"
                          variant={verifiedBillIds[bill.id] ? 'primary' : 'secondary'}
                          onClick={() => {
                            setVerifiedBillIds({
                              ...verifiedBillIds,
                              [bill.id]: !verifiedBillIds[bill.id],
                            });
                          }}
                          leadingIcon={<ShieldCheck className="size-4" />}
                        >
                          {verifiedBillIds[bill.id] ? 'Verified' : 'Verify'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Controls (Manager / HR) */}
            {tab === 'verify' && (
              <div className="space-y-4 pt-4 border-t border-line">
                <Select
                  label="Decision"
                  value={decisionAction}
                  onChange={(val) => {
                    setDecisionAction(val as 'approve' | 'partially_approve' | 'reject');
                  }}
                  options={[
                    { value: 'approve', label: 'Full Approval (100% of Claim)' },
                    { value: 'partially_approve', label: 'Partial Approval (Reduced Amount)' },
                    { value: 'reject', label: 'Decline / Reject Claim' },
                  ]}
                />

                {decisionAction === 'partially_approve' && (
                  <TextField
                    label="Approved Amount (₹)"
                    type="number"
                    value={partialAmount}
                    onChange={(e) => {
                      setPartialAmount(e.target.value);
                    }}
                    hint="Must be less than claimed amount. Explanation required."
                  />
                )}

                {(decisionAction === 'reject' || decisionAction === 'partially_approve') && (
                  <TextField
                    label="Mandatory Reason / Notes"
                    value={decisionReason}
                    onChange={(e) => {
                      setDecisionReason(e.target.value);
                    }}
                    placeholder="Provide justification for adjustment or rejection..."
                  />
                )}

                <div className="flex justify-end gap-3 pt-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setVerifyDrawerOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void handleConfirmDecision();
                    }}
                  >
                    Submit Decision
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
