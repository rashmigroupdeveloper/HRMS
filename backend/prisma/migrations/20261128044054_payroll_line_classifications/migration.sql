-- AlterTable
ALTER TABLE "payroll_run_lines" ADD COLUMN     "kind" "salary_component_kind",
ADD COLUMN     "state_code" CHAR(2),
ADD COLUMN     "statutory_role" "statutory_role";
