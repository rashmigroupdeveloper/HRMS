/**
 * Manager attendance-approval ledger (ATT-12) — INTEGRATION STUB.
 *
 * The backend ledger (per-manager monthly sign-off rows feeding the month-lock
 * checklist) is not built yet. Pages consume THIS module only, so when the API
 * lands the swap happens here — one file, zero page changes (the KentConnector
 * discipline applied to the frontend).
 */

interface ApprovalLedgerEntry {
  managerEcode: string;
  managerName: string;
  month: string;
  approvedAt: string | null;
  pendingEmployees: number;
}

interface ApprovalLedgerResult {
  /** false until the backend ships — pages render an honest "not wired" state. */
  available: boolean;
  entries: ApprovalLedgerEntry[];
}

export function fetchApprovalLedger(month: string): Promise<ApprovalLedgerResult> {
  // TODO(integration): replace with apiFetch(`/api/attendance/approval-ledger?month=${month}`)
  // once the backend procedure exists. Keep the return shape.
  void month;
  return Promise.resolve({ available: false, entries: [] });
}
