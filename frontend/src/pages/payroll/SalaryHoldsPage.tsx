/** PAY-08: payment/process hold operations; policies remain Super Admin controlled. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { hasPermission, type SessionUser } from '../../lib/session';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
  TextField,
  Textarea,
  toast,
} from '../../ui';
interface Employee {
  id: number;
  ecode: string;
  name: string;
}
interface Hold {
  id: number;
  employee_id: number;
  hold_type: 'payment' | 'process';
  reason: string;
  start_month: string;
  released_month: string | null;
}
const monthStart = (value: string) => `${value}-01`;
export function SalaryHoldsPage({ user }: { user: SessionUser }) {
  const canManage = hasPermission(user, 'payroll.run.manage');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Employee[]>([]);
  const [employee, setEmployee] = useState('');
  const [holds, setHolds] = useState<Hold[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [type, setType] = useState('payment');
  const [month, setMonth] = useState('');
  const [reason, setReason] = useState('');
  const [releaseMonth, setReleaseMonth] = useState('');
  useEffect(() => {
    setEmployee('');
    setPeople([]);
    setHolds([]);
    setError(null);
    if (!query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void apiFetch<Employee[]>(
        `/api/payroll/holds/employees?ecode=${encodeURIComponent(query.trim())}`,
      )
        .then((rows) => {
          if (!cancelled) setPeople(rows);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Could not find employees.');
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    setHolds([]);
    if (!employee) return;
    let cancelled = false;
    void apiFetch<Hold[]>('/api/payroll/holds/list', {
      method: 'POST',
      body: JSON.stringify({ employee_id: Number(employee) }),
    })
      .then((rows) => {
        if (!cancelled) setHolds(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load holds.');
      });
    return () => {
      cancelled = true;
    };
  }, [employee]);
  async function mutate(path: string, body: Record<string, unknown>) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
      const rows = await apiFetch<Hold[]>('/api/payroll/holds/list', {
        method: 'POST',
        body: JSON.stringify({ employee_id: Number(employee) }),
      });
      setHolds(rows);
      toast.success('Salary hold updated. Recompute an open run to reflect the change.');
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the hold.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary holds"
        description="A payment hold computes salary and withholds the bank payout. A process hold stops salary processing until release."
        actions={
          <Link to="/payroll">
            <Button variant="secondary">Payroll runs</Button>
          </Link>
        }
      />
      <Card>
        <CardHeader title="Choose employee" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Search e-code"
            disabled={busy}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
          <Select
            label="Employee"
            disabled={busy}
            value={employee}
            onChange={setEmployee}
            options={people.map((p) => ({ value: String(p.id), label: `${p.ecode} · ${p.name}` }))}
          />
        </div>
      </Card>
      {error && (
        <p role="alert" className="text-negative-ink">
          {error}
        </p>
      )}
      {employee && (
        <Card>
          <CardHeader
            title="Hold history"
            subtitle="The release month is the first month without this hold. Computed or settled periods cannot be changed here."
          />
          {holds.length === 0 ? (
            <EmptyState title="No salary holds" description="Place a hold below when authorized." />
          ) : (
            <ul className="divide-y divide-line">
              {holds.map((h) => (
                <li key={h.id} className="space-y-2 py-4">
                  <p>
                    {h.hold_type === 'payment' ? 'Payment' : 'Process'} hold ·{' '}
                    {h.start_month.slice(0, 7)} ·{' '}
                    {h.released_month ? `Released ${h.released_month.slice(0, 7)}` : 'Active'}
                  </p>
                  <p className="text-sm text-ink-muted">{h.reason}</p>
                  {canManage && !h.released_month && (
                    <Button
                      variant="secondary"
                      disabled={!releaseMonth || busy}
                      onClick={() => {
                        void mutate('/api/payroll/holds/release', {
                          hold_id: h.id,
                          released_month: monthStart(releaseMonth),
                        });
                      }}
                    >
                      Release hold #{h.id}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="mt-4 max-w-xs">
              <TextField
                label="Release effective month"
                type="month"
                value={releaseMonth}
                onChange={(e) => {
                  setReleaseMonth(e.target.value);
                }}
              />
            </div>
          )}
        </Card>
      )}
      {canManage && employee && (
        <Card>
          <CardHeader title="Place salary hold" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select
              label="Hold type"
              value={type}
              onChange={setType}
              options={[
                { value: 'payment', label: 'Payment hold' },
                { value: 'process', label: 'Process hold' },
              ]}
            />
            <TextField
              label="Start month"
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
              }}
            />
            <Textarea
              label="Reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
              }}
            />
          </div>
          <Button
            className="mt-4"
            loading={busy}
            disabled={!month || reason.trim().length < 3}
            onClick={() => {
              void mutate('/api/payroll/holds/place', {
                employee_id: Number(employee),
                hold_type: type,
                start_month: monthStart(month),
                reason: reason.trim(),
              });
            }}
          >
            Place hold
          </Button>
        </Card>
      )}
    </div>
  );
}
