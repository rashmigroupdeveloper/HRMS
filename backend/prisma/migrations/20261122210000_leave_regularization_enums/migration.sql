-- Leave and regularization / on duty (2026-11-22): the new enum values, on their own - Postgres needs a new enum value
-- committed before a migration uses it (the next one seeds rows with them).
ALTER TYPE "access_area" ADD VALUE 'LEAVE';
ALTER TYPE "approval_feature" ADD VALUE 'LEAVE';
ALTER TYPE "approval_feature" ADD VALUE 'REGULARIZATION';
ALTER TYPE "approval_kind" ADD VALUE 'LEAVE';
ALTER TYPE "approval_kind" ADD VALUE 'LEAVE_CANCEL';
ALTER TYPE "approval_kind" ADD VALUE 'REGULARIZATION';
ALTER TYPE "approval_kind" ADD VALUE 'ON_DUTY';
-- approved leave / official duty on the attendance days
ALTER TYPE "day_status" ADD VALUE 'LEAVE';
ALTER TYPE "day_status" ADD VALUE 'ON_DUTY';
