import { useState } from 'react';
import { CalendarSync, History, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Button, Card, CardHeader, DarkCard, EmptyState, toast } from '../../ui';

export function LeaveAdminPage() {
  const [loading, setLoading] = useState<'accrual' | 'lapse' | null>(null);
  const run = async (kind: 'accrual' | 'lapse') => {
    setLoading(kind);
    try {
      const result = await apiFetch<Record<string, number>>(
        kind === 'accrual' ? '/api/leave/accrual/run' : '/api/leave/comp-off/expire',
        { method: 'POST' },
      );
      toast.success(kind === 'accrual' ? 'Accrual run completed' : 'Expired comp-off lapsed', {
        description: Object.entries(result)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(' · '),
      });
    } catch (cause) {
      toast.error('Operation failed', {
        description: cause instanceof Error ? cause.message : 'Try again.',
      });
    } finally {
      setLoading(null);
    }
  };
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-muted">Leave administration</p>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight text-ink">
          Leave operations
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Policy-driven ledger operations available in the current backend.
        </p>
      </header>
      <DarkCard>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hero-muted">
          Ledger discipline
        </p>
        <h2 className="mt-3 text-3xl font-light">Balances are never edited counters</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-hero-muted">
          Accruals, adjustments, leave debits and comp-off lapses remain immutable transactions
          whose sum is the balance.
        </p>
      </DarkCard>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Monthly accrual"
            subtitle="Runs automatically on the first day at 00:05 IST"
          />
          <Button
            variant="primary"
            loading={loading === 'accrual'}
            leadingIcon={<CalendarSync className="size-4" />}
            onClick={() => void run('accrual')}
          >
            Run accrual now
          </Button>
        </Card>
        <Card>
          <CardHeader
            title="Comp-off expiry"
            subtitle="Lapse credits whose configured expiry has passed"
          />
          <Button
            loading={loading === 'lapse'}
            leadingIcon={<History className="size-4" />}
            onClick={() => void run('lapse')}
          >
            Run expiry sweep
          </Button>
        </Card>
      </div>
      <Card>
        <EmptyState
          icon={<ShieldCheck />}
          title="HR leave register needs a read contract"
          description="The current backend supports employee histories and HR ledger mutations, but not a permission-scoped company leave-register query. No synthetic register is rendered."
        />
      </Card>
    </div>
  );
}
