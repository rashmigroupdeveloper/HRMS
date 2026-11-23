-- Comp-off claims (the user, 2026-11-22): the new enum values on their own (used by the next migration's seed rows).
ALTER TYPE "approval_feature" ADD VALUE 'COMP_OFF';
ALTER TYPE "approval_kind" ADD VALUE 'COMP_OFF';
ALTER TYPE "leave_entry_kind" ADD VALUE 'COMP_OFF';
ALTER TYPE "leave_entry_kind" ADD VALUE 'EXPIRED';
