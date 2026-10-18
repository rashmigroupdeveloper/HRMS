/** LC-01/02: candidate rows and post-joining task presentation. */
import { Check, Fingerprint } from 'lucide-react';
import { Button, Card, CardHeader, StatusBadge } from '../../ui';
import type { StakeholderTaskItem } from './onboarding-types';
interface TasksProps {
  tasks: StakeholderTaskItem[];
  taskError: string | null;
  onVerifyBiometric: (employeeId: number) => Promise<void>;
  onCompleteTask: (taskId: number) => Promise<void>;
}
export function OnboardingTasks({
  tasks,
  taskError,
  onVerifyBiometric,
  onCompleteTask,
}: TasksProps) {
  return (
    <Card>
      <CardHeader
        headingLevel={2}
        title="Joining checklist"
        subtitle="Tasks for IT, Admin and HR after the employee joins."
      />

      {taskError && (
        <p role="alert" className="text-sm text-negative-ink">
          {taskError}
        </p>
      )}
      <div className="divide-y divide-line">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                  {task.department}
                </span>
                <p className="text-sm font-medium text-ink">{task.taskName}</p>
                {task.status === 'completed' && (
                  <StatusBadge tone="positive">Completed</StatusBadge>
                )}
                {task.status === 'open' && (
                  <StatusBadge tone="neutral">Open ({task.slaHours}h SLA)</StatusBadge>
                )}
                {task.status === 'escalated' && (
                  <StatusBadge tone="negative">Escalated SLA Overdue</StatusBadge>
                )}
              </div>
              <p className="text-xs text-ink-muted">
                {task.ecode} · {task.employeeName} • Due by {task.dueDate} • Team: {task.department}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {task.taskCode === 'it_biometric' && task.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={<Fingerprint className="h-4 w-4" />}
                  onClick={() => {
                    void onVerifyBiometric(task.employeeId);
                  }}
                >
                  Kent Sync Verify
                </Button>
              )}

              {task.status !== 'completed' && task.taskCode !== 'it_biometric' && (
                <Button
                  size="sm"
                  variant="ghost"
                  leadingIcon={<Check className="h-4 w-4" />}
                  onClick={() => {
                    void onCompleteTask(task.id);
                  }}
                >
                  Mark Done
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
