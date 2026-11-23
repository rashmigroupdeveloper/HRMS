-- AlterTable
ALTER TABLE "job_change_requests" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "cancelled_by_id" INTEGER;
