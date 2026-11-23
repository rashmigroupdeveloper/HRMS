-- AlterTable
ALTER TABLE "joining_task_types" ADD COLUMN     "default_assignee_id" INTEGER;

-- AlterTable
ALTER TABLE "joining_tasks" ADD COLUMN     "assigned_to_id" INTEGER;

-- CreateIndex
CREATE INDEX "joining_tasks_assigned_to_id_done_at_idx" ON "joining_tasks"("assigned_to_id", "done_at");

