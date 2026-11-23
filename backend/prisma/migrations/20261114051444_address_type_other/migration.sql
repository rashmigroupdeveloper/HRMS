-- AlterEnum
ALTER TYPE "address_type" ADD VALUE 'OTHER';

-- DropIndex
DROP INDEX "employee_addresses_employee_id_type_key";

-- CreateIndex
CREATE INDEX "employee_addresses_employee_id_idx" ON "employee_addresses"("employee_id");
