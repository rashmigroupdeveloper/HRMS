-- CreateEnum
CREATE TYPE "letter_kind" AS ENUM ('OFFER_LETTER');

-- CreateEnum
CREATE TYPE "salutation" AS ENUM ('MR', 'MS', 'MRS', 'DR');

-- CreateEnum
CREATE TYPE "offer_response" AS ENUM ('ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "salary_component_kind" AS ENUM ('EARNING', 'EMPLOYER_CONTRIBUTION');

-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'LETTER_TEMPLATES';

-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'SIGNED_OFFER_LETTER';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "address" TEXT,
ADD COLUMN     "notice_months_confirmed" SMALLINT,
ADD COLUMN     "notice_months_probation" SMALLINT,
ADD COLUMN     "offer_number" TEXT,
ADD COLUMN     "performance_pay_annual" INTEGER,
ADD COLUMN     "probation_months" SMALLINT,
ADD COLUMN     "salutation" "salutation";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "letterhead_footer_key" TEXT,
ADD COLUMN     "letterhead_header_key" TEXT,
ADD COLUMN     "signature_key" TEXT;

-- CreateTable
CREATE TABLE "letter_templates" (
    "id" SERIAL NOT NULL,
    "kind" "letter_kind" NOT NULL,
    "joining_type" "joining_type",
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "letter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_salary_lines" (
    "id" SERIAL NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "salary_component_id" INTEGER NOT NULL,
    "monthly_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "candidate_salary_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_letters" (
    "id" SERIAL NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "revision" SMALLINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL,
    "sent_by_id" INTEGER NOT NULL,
    "link_token_hash" CHAR(64) NOT NULL,
    "emailed_at" TIMESTAMPTZ(3),
    "emailed_by_id" INTEGER,
    "otp_hash" CHAR(64),
    "otp_expires_at" TIMESTAMPTZ(3),
    "otp_failed_attempts" SMALLINT NOT NULL DEFAULT 0,
    "otp_sent_count" SMALLINT NOT NULL DEFAULT 0,
    "otp_sent_at" TIMESTAMPTZ(3),
    "otp_sent_by_id" INTEGER,
    "response" "offer_response",
    "responded_at" TIMESTAMPTZ(3),
    "responded_by_id" INTEGER,
    "response_name" TEXT,
    "response_ip" TEXT,
    "response_user_agent" TEXT,
    "decline_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "offer_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_number_sequences" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "year" SMALLINT NOT NULL,
    "last_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "offer_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_components" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "salary_component_kind" NOT NULL,
    "display_order" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "letter_templates_name_key" ON "letter_templates"("name");

-- CreateIndex
CREATE INDEX "letter_templates_kind_joining_type_idx" ON "letter_templates"("kind", "joining_type");

-- CreateIndex
CREATE INDEX "candidate_salary_lines_salary_component_id_idx" ON "candidate_salary_lines"("salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_salary_lines_candidate_id_salary_component_id_key" ON "candidate_salary_lines"("candidate_id", "salary_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_storage_key_key" ON "offer_letters"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_link_token_hash_key" ON "offer_letters"("link_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_candidate_id_revision_key" ON "offer_letters"("candidate_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "offer_number_sequences_company_id_year_key" ON "offer_number_sequences"("company_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_name_key" ON "salary_components"("name");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_offer_number_key" ON "candidates"("offer_number");

-- AddForeignKey
ALTER TABLE "candidate_salary_lines" ADD CONSTRAINT "candidate_salary_lines_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_salary_lines" ADD CONSTRAINT "candidate_salary_lines_salary_component_id_fkey" FOREIGN KEY ("salary_component_id") REFERENCES "salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_number_sequences" ADD CONSTRAINT "offer_number_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Seed: the salary components of the RML offer letter Annexure-I (by System = 0)
INSERT INTO "salary_components" ("name", "kind", "display_order", "created_by_id", "updated_at", "updated_by_id") VALUES
  ('Basic', 'EARNING', 10, 0, CURRENT_TIMESTAMP, 0),
  ('HRA', 'EARNING', 20, 0, CURRENT_TIMESTAMP, 0),
  ('Education Allowance', 'EARNING', 30, 0, CURRENT_TIMESTAMP, 0),
  ('Conveyance', 'EARNING', 40, 0, CURRENT_TIMESTAMP, 0),
  ('Medical', 'EARNING', 50, 0, CURRENT_TIMESTAMP, 0),
  ('Special Allowance', 'EARNING', 60, 0, CURRENT_TIMESTAMP, 0),
  ('Reimbursement', 'EARNING', 70, 0, CURRENT_TIMESTAMP, 0),
  ('LTA', 'EARNING', 80, 0, CURRENT_TIMESTAMP, 0),
  ('Bonus', 'EARNING', 90, 0, CURRENT_TIMESTAMP, 0),
  ('Employer Contribution to PF', 'EMPLOYER_CONTRIBUTION', 110, 0, CURRENT_TIMESTAMP, 0),
  ('Employer Contribution to ESI', 'EMPLOYER_CONTRIBUTION', 120, 0, CURRENT_TIMESTAMP, 0),
  ('Employer Contribution to Gratuity', 'EMPLOYER_CONTRIBUTION', 130, 0, CURRENT_TIMESTAMP, 0);

-- Seed: the offer letter wording, from the RML appointment letter of Oct 2025 (by System = 0); HR edits it on the
-- Letter templates page
INSERT INTO "letter_templates" ("kind", "joining_type", "name", "body", "created_by_id", "updated_at", "updated_by_id") VALUES
  ('OFFER_LETTER', NULL, 'Offer letter', $letter$**Ref: {{offer_number}}** >> **Date: {{letter_date}}**

**PRIVATE AND CONFIDENTIAL**

**{{salutation}} {{name}}**
**Address: {{address}}**
**Email ID: {{email}}**

Dear **{{name}},**

Pursuant to the discussion we had with you recently, we are pleased to offer you the position of **"{{designation}}"** at **RASHMI GROUP** as per the following terms and conditions.

1. **Your compensation package would be as in Annexure-I.** However, the structure of your compensation plan may be reviewed from time to time with the Compensation policy.

2. Your increments and promotions will be made on the basis of merit and will be at the sole discretion of the company.

3. Your probation appointment takes effect from {{joining_date}}.

4. You will be on probation for period of {{probation_months}} months from the date of your probation appointment. You will be confirmed in writing on successful completion of the said probationary period. If no confirmation is made at the end of the said probationary period, it will be deemed to have been extended until the company confirms you in writing.

4.1 During probation period your services are terminable by either party giving notice of {{notice_probation}} to the other in writing, or salary in lieu of notice. Either party need not assign any reason for such termination.

4.2 After confirmation, separation could be done by either party giving notice of {{notice_confirmed}} to the other in writing or salary in lieu of notice. Either party need not assign any reason for such termination.

4.3 However, in case of breach of the disciplinary rules of the company or misconduct, your services may be terminable with immediate effect. In such event, it would not be necessary for the company to give you any notice whatsoever.

4.4 In case notice pay (salary in lieu of notice) is payable by either party, under points 4.1 or 4.2, the notice pay shall mean the basic salary only and shall not include the cash equivalent of any perquisites.

5. Though your initial posting will be at **{{location}}** you will be subject to transfer to any other units, branches, offices, group companies currently existing or which may come into being in future at the absolute discretion of the company, depending upon the exigencies of business. On such transfer you will be governed by the rules and regulations, working hours, perquisites, allowances, facilities, and such other conditions of employment, as applicable at the place of transfer, and as may be amended from time to time.

6. You will retire from the services of the company on attaining the age of 60 years, or earlier if found medically unfit. Your continuance in service with the Company is subject to your remaining physically and mentally fit. You will submit yourself to medical examination as per the direction of the Management.

7. You are expected to promote and expand the business of the company and not directly or indirectly and either solely or jointly be engaged in any service or other business or profession whether during or after the hours of employment without written sanction from the company.

8. In the course of employment with the company, by virtue of the position held by you, you may acquire knowledge/information regarding the company's secret processes, methods of manufacture, business practices etc. Such secret knowledge/ information, howsoever obtained by you, shall not be disclosed or allowed to be disclosed to other parties in the interest of the company's business. Therefore, you shall not, at any time during the term of service with the company or thereafter, make available or accessible such secret knowledge/ information to any other party, directly or indirectly. Further any invention you may make in the course of your work (or in any way connected with the Company's business) and any patents arising there from will be the property of the Company.

9. That after leaving the Company, you shall not join or associate yourself with any Competitor of the Company for a period of at least 2(two) years following cessation of your engagement with this Company.

10. Your attendance will also be tracked by online tracking system as and when required on real time basis.

11. During your services with the company, you will be governed by the rules and regulations in respect to conduct and discipline, retirement and other matters as may be framed by the company from time to time.

12. Any variation of the above terms and conditions will not be valid unless expressly made in writing.

This offer is valid until **{{valid_until}}**. Please accept it online through the link sent to you by e-mail, or sign and return the duplicate copy of this letter (initialing each page, including Annexure-I), as a token of your having accepted the above terms and conditions.

**Thanking You!**

**Yours Sincerely,**

**For RASHMI GROUP,**

{{signature}}

**(Authorized Signatory)**

---

# Annexure-I

{{ctc_table}}

The Gratuity will be payable as per the "Payment of Gratuity Act, 1972"$letter$, 0, CURRENT_TIMESTAMP, 0);
