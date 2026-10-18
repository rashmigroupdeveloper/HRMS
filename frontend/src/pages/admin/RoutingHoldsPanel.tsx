/** WF-01/04: repair missing approvers without treating vacancy as consent. */
import { useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { notifyWorkflowChanged } from '../../lib/workflow-events';
import { Button, Card, CardHeader, Drawer, EmptyState, Skeleton, StatusBadge, Textarea } from '../../ui';
import { formatTimestamp } from '../home/dashboard-format';
import { useDashboardResource } from '../home/useDashboardResource';

interface RoutingHold { requestId: number; type: string; subjectEmployeeId: number; createdAt: string }
type RoutingState = 'held_for_hr' | 'awaiting_approver' | 'lapsed';
const PAGE_SIZE = 25;
const OUTCOME: Record<RoutingState, string> = {
  held_for_hr: 'Still waiting for HR: no eligible approver was found. Check the employee’s managers and active holders of the configured approval roles, then retry.',
  awaiting_approver: 'Routing restored. The assigned approver has a queued notification; the request is awaiting their decision.',
  lapsed: 'The decision deadline expired. The request has lapsed and was not approved.',
};

export function RoutingHoldsPanel({ userId }: { userId: number }) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RoutingHold | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const holds = useDashboardResource<RoutingHold[]>(`/api/workflows/routing-holds?limit=${String(PAGE_SIZE + 1)}&offset=${String(page * PAGE_SIZE)}`);
  const rows = holds.data?.slice(0, PAGE_SIZE) ?? [];
  return <section aria-label="Requests waiting for HR routing" className="space-y-4">
    <Card>
      <CardHeader headingLevel={2} title="Waiting for HR routing" subtitle="Every configured approver is missing or inactive. These requests have not been approved." />
      <p className="mt-3 text-sm text-ink-muted text-pretty">Repair the employee’s manager assignment or the configured approval role, then retry routing with a record of the repair.</p>
      {result && <p role="status" className="mt-3 text-sm text-ink">{result}</p>}
      <div className="mt-4 space-y-3" aria-busy={holds.loading}>
        <HoldsContent holds={holds} rows={rows} page={page} onPrevious={() => { setPage(value => value - 1); }} onSelect={setSelected} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-ink-muted">Page {page + 1}</p>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" disabled={page === 0 || holds.loading} onClick={() => { setPage(value => value - 1); }}>Previous holds</Button>
          <Button variant="ghost" size="sm" disabled={holds.loading || Boolean(holds.error) || (holds.data?.length ?? 0) <= PAGE_SIZE} onClick={() => { setPage(value => value + 1); }}>Next holds</Button>
        </div>
      </div>
    </Card>
    {selected && <RoutingRepair key={`${String(userId)}:${String(selected.requestId)}`} userId={userId} hold={selected}
      onClose={() => { setSelected(null); }} onSaved={state => {
        setResult(`Request ${String(selected.requestId)}: ${OUTCOME[state]}`);
        setSelected(null); holds.reload(); notifyWorkflowChanged();
      }} />}
  </section>;
}

function HoldsContent({ holds, rows, page, onPrevious, onSelect }: {
  holds: ReturnType<typeof useDashboardResource<RoutingHold[]>>; rows: RoutingHold[]; page: number;
  onPrevious: () => void; onSelect: (hold: RoutingHold) => void;
}) {
  if (holds.loading) return <><Skeleton /><Skeleton /><Skeleton /></>;
  if (holds.error) return <div role="alert" className="space-y-3"><p className="text-sm text-ink">{holds.error}</p><Button variant="secondary" onClick={holds.reload}>Try again</Button></div>;
  if (rows.length === 0) return <EmptyState title={page === 0 ? 'No routing holds' : 'No more routing holds'}
    description={page === 0 ? 'No requests in your permitted population are waiting for routing repair.' : 'Return to the previous page to review earlier requests.'}
    action={<Button variant="secondary" onClick={page === 0 ? holds.reload : onPrevious}>{page === 0 ? 'Refresh holds' : 'Previous page'}</Button>} />;
  return <ul className="divide-y divide-line">{rows.map(row => <li key={row.requestId} className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div><h3 className="text-sm font-semibold text-ink">Request <span className="tabular-nums">{row.requestId}</span> · {row.type.replaceAll('_', ' ')}</h3>
      <p className="mt-1 text-xs text-ink-muted">Employee <span className="tabular-nums">{row.subjectEmployeeId}</span> · raised {formatTimestamp(row.createdAt)} IST</p></div>
    <div className="flex items-center gap-3"><StatusBadge tone="warning">Waiting for HR</StatusBadge>
      <Button variant="secondary" size="sm" onClick={() => { onSelect(row); }}>Review routing {row.requestId}</Button></div>
  </li>)}</ul>;
}

function RoutingRepair({ userId, hold, onClose, onSaved }: {
  userId: number; hold: RoutingHold; onClose: () => void; onSaved: (state: RoutingState) => void;
}) {
  const key = `hrms.routing-repair:${String(userId)}:${String(hold.requestId)}`;
  const [reason, setReason] = useState(() => { try { return sessionStorage.getItem(key) ?? ''; } catch { return ''; } });
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
  const retry = async () => {
    if (savingRef.current) return;
    if (!reason.trim()) { setError('Describe the routing repair before retrying.'); noteRef.current?.focus(); return; }
    savingRef.current = true; setSaving(true); setError(undefined);
    try {
      const result = await apiFetch<{ routingState: RoutingState }>(`/api/workflows/requests/${String(hold.requestId)}/retry-routing`, {
        method: 'POST', body: JSON.stringify({ requestId: hold.requestId, reason: reason.trim() }),
      });
      if (!(Object.hasOwn(OUTCOME, result.routingState))) throw new Error('The server returned an unknown routing outcome. Refresh the request before retrying.');
      try { sessionStorage.removeItem(key); } catch { /* Draft storage is optional. */ }
      onSaved(result.routingState);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Routing could not be retried. Your note is preserved.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <Drawer open onClose={() => { if (!savingRef.current) onClose(); }} title={`Repair routing · request ${String(hold.requestId)}`}
    footer={<div className="flex justify-end gap-3"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button loading={saving} onClick={() => { void retry(); }}>Retry routing</Button></div>}>
    <p className="mb-4 text-sm text-ink-muted text-pretty">Check the employee’s managers and the approval chain’s active role holders before retrying. The configured chain will be evaluated again. This action records your note and queues a notification if an eligible approver is found.</p>
    <Textarea ref={noteRef} label="Routing repair note" required maxLength={1000} value={reason} error={error} disabled={saving}
      hint="Describe which manager, account or approval role was repaired. Draft stays in this browser tab until a successful retry."
      onChange={event => {
        const value = event.currentTarget.value; setReason(value);
        try { sessionStorage.setItem(key, value); } catch { /* Keep the live form usable if storage is unavailable. */ }
      }} />
  </Drawer>;
}
