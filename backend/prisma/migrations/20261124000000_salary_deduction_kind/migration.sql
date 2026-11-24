-- Deductions as salary components (the user, 2026-11-24 - the payslip shows PF, professional tax and canteen recovery):
-- the new enum value on its own (used by the next migration's seed rows).
ALTER TYPE "salary_component_kind" ADD VALUE 'DEDUCTION';
