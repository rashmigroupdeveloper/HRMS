-- Shift changes go through the approval service (the user, 2026-11-22): a new kind and a new feature. Added on their own,
-- before the migration that uses them (Postgres needs a new enum value committed first).
ALTER TYPE "approval_kind" ADD VALUE 'SHIFT_CHANGE';
ALTER TYPE "approval_feature" ADD VALUE 'SHIFT_CHANGE';
