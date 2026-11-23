-- CreateEnum
CREATE TYPE "identity_document_type" AS ENUM ('AADHAAR', 'PAN', 'FOREIGN_TAX_ID', 'PASSPORT', 'DRIVING_LICENCE');

-- CreateEnum
CREATE TYPE "bank_account_type" AS ENUM ('SAVINGS', 'CURRENT');

-- CreateEnum
CREATE TYPE "epf_relative" AS ENUM ('FATHER', 'SPOUSE');

-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('PRESENT', 'PERMANENT');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('PHOTO', 'SIGNED_JOINING_FORM', 'MEDICAL_FORM', 'EPF_FORM_11', 'ESIC_FORM_1', 'GRATUITY_FORM_F', 'AADHAAR_COPY', 'PAN_COPY', 'PASSPORT_COPY', 'BANK_PROOF');

-- CreateEnum
CREATE TYPE "bgv_status" AS ENUM ('NOT_STARTED', 'INITIATED', 'CLEARED', 'FAILED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "gender" DROP NOT NULL;

-- CreateTable
CREATE TABLE "employee_identity_documents" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "type" "identity_document_type" NOT NULL,
    "number_encrypted" TEXT NOT NULL,
    "number_last4" VARCHAR(4) NOT NULL,
    "number_hash" TEXT NOT NULL,
    "name_on_document" TEXT,
    "issuing_country" CHAR(2),
    "valid_from" DATE,
    "valid_until" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_identity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_bank_accounts" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "bank_name" TEXT NOT NULL,
    "branch" TEXT,
    "account_holder_name" TEXT NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_number_last4" VARCHAR(4) NOT NULL,
    "ifsc" TEXT,
    "account_type" "bank_account_type" NOT NULL,
    "is_salary_account" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_statutory" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "pf_applicable" BOOLEAN NOT NULL DEFAULT false,
    "uan" TEXT,
    "pf_number" TEXT,
    "epf_relative" "epf_relative" NOT NULL DEFAULT 'FATHER',
    "is_mobile_aadhaar_linked" BOOLEAN,
    "is_international_worker" BOOLEAN NOT NULL DEFAULT false,
    "was_epf_member" BOOLEAN,
    "was_eps_member" BOOLEAN,
    "previous_pf_number" TEXT,
    "previous_exit_date" DATE,
    "scheme_certificate_number" TEXT,
    "ppo_number" TEXT,
    "first_epf_enrolled_on" DATE,
    "first_epf_wages" INTEGER,
    "is_epf_member_before_sep_2014" BOOLEAN,
    "epf_withdrawn" BOOLEAN,
    "eps_withdrawn" BOOLEAN,
    "eps_withdrawn_after_sep_2014" BOOLEAN,
    "esic_applicable" BOOLEAN NOT NULL DEFAULT false,
    "esic_ip_number" TEXT,
    "esic_branch_office" TEXT,
    "esic_dispensary" TEXT,
    "previous_esic_ip_number" TEXT,
    "previous_employer_code" TEXT,
    "previous_employer_name" TEXT,
    "previous_employer_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_statutory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_addresses" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "type" "address_type" NOT NULL,
    "house_no" TEXT NOT NULL,
    "locality" TEXT,
    "city_or_village" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT,
    "country_code" CHAR(2) NOT NULL DEFAULT 'IN',
    "postal_code" TEXT,
    "post_office" TEXT,
    "police_station" TEXT,
    "sub_division" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_emergency_contacts" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "alternate_mobile" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "type" "document_type" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_onboardings" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "form_date" DATE,
    "declaration_accepted_at" TIMESTAMPTZ(3),
    "joining_formalities_completed_at" TIMESTAMPTZ(3),
    "payroll_updated_at" TIMESTAMPTZ(3),
    "id_card_issued_at" TIMESTAMPTZ(3),
    "background_verification" "bgv_status" NOT NULL DEFAULT 'NOT_STARTED',
    "induction_date" DATE,
    "hr_representative_name" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_identity_documents_employee_id_type_key" ON "employee_identity_documents"("employee_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "employee_identity_documents_type_number_hash_key" ON "employee_identity_documents"("type", "number_hash");

-- CreateIndex
CREATE INDEX "employee_bank_accounts_employee_id_idx" ON "employee_bank_accounts"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_statutory_employee_id_key" ON "employee_statutory"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_statutory_uan_key" ON "employee_statutory"("uan");

-- CreateIndex
CREATE UNIQUE INDEX "employee_statutory_esic_ip_number_key" ON "employee_statutory"("esic_ip_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_addresses_employee_id_type_key" ON "employee_addresses"("employee_id", "type");

-- CreateIndex
CREATE INDEX "employee_emergency_contacts_employee_id_idx" ON "employee_emergency_contacts"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_documents_storage_key_key" ON "employee_documents"("storage_key");

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_type_idx" ON "employee_documents"("employee_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "employee_onboardings_employee_id_key" ON "employee_onboardings"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_identity_documents" ADD CONSTRAINT "employee_identity_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_statutory" ADD CONSTRAINT "employee_statutory_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_addresses" ADD CONSTRAINT "employee_addresses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_emergency_contacts" ADD CONSTRAINT "employee_emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboardings" ADD CONSTRAINT "employee_onboardings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

