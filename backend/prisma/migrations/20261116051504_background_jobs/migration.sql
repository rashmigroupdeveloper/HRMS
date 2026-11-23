-- CreateEnum
CREATE TYPE "job_run_status" AS ENUM ('RUNNING', 'OK', 'FAILED');

-- CreateTable
CREATE TABLE "job_runs" (
    "id" SERIAL NOT NULL,
    "job" TEXT NOT NULL,
    "status" "job_run_status" NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "summary" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_job_started_at_idx" ON "job_runs"("job", "started_at");
