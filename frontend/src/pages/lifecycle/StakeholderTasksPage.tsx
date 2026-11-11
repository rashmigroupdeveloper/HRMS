/** LC-02: IT/Admin stakeholder queue, independent of HR's candidate conversion board. */
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button, EmptyState, PageHeader, toast } from '../../ui';
import { OnboardingTasks } from './OnboardingBoardViews';
import type { StakeholderTaskItem } from './onboarding-types';
export function StakeholderTasksPage() {
  const [tasks, setTasks] = useState<StakeholderTaskItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const [busyTaskId,setBusyTaskId]=useState<number|null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    void apiFetch<{ tasks: StakeholderTaskItem[] }>('/api/lifecycle/my-tasks')
      .then((r) => {
        if (!cancelled) setTasks(r.tasks);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load joining tasks.');
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  async function complete(taskId: number) {
    if (busy.current) return;
    busy.current = true;
    setBusyTaskId(taskId);
    try {
      await apiFetch('/api/lifecycle/my-tasks/complete', {
        method: 'POST',
        body: JSON.stringify({ taskId }),
      });
      toast.success('Joining task completed.');
      setRevision((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not complete task.');
    } finally {
      busy.current = false;
      setBusyTaskId(null);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding tasks"
        description="Joining tasks assigned to your stakeholder roles. Candidate profiles and employee conversion remain with HR."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setRevision((v) => v + 1);
            }}
          >
            Refresh tasks
          </Button>
        }
      />
      {tasks === null && !error && <p role="status">Loading tasks…</p>}
      {tasks?.length === 0 && !error && (
        <EmptyState
          title="No assigned joining tasks"
          description="Tasks appear here after HR confirms actual joining."
        />
      )}
      <OnboardingTasks
        tasks={tasks ?? []}
        busyTaskId={busyTaskId}
        taskError={error}
        onCompleteTask={complete}
        onVerifyBiometric={() => {
          toast.error(
            'Kent enrollment verification needs the authorized enrollment integration. Contact the integration administrator.',
          );
          return Promise.resolve();
        }}
      />
    </div>
  );
}
