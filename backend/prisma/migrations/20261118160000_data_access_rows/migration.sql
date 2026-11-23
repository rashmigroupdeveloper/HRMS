-- Data access (agreed with the user 2026-11-18): each role given to an employee gets rows saying WHOSE records it covers
-- (company -> plant -> department, empty = all) at View or Edit.

-- CreateTable
CREATE TABLE "user_account_role_scopes" (
    "id" SERIAL NOT NULL,
    "account_role_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "plant_id" INTEGER,
    "department_id" INTEGER,
    "level" "access_level" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "user_account_role_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_account_role_scopes_account_role_id_idx" ON "user_account_role_scopes"("account_role_id");

-- AddForeignKey
ALTER TABLE "user_account_role_scopes" ADD CONSTRAINT "user_account_role_scopes_account_role_id_fkey" FOREIGN KEY ("account_role_id") REFERENCES "user_account_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_role_scopes" ADD CONSTRAINT "user_account_role_scopes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_role_scopes" ADD CONSTRAINT "user_account_role_scopes_plant_id_company_id_fkey" FOREIGN KEY ("plant_id", "company_id") REFERENCES "plants"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_role_scopes" ADD CONSTRAINT "user_account_role_scopes_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- On deploy nothing changes: every role already given covers every company at Edit (HR narrows them on Roles & access)
INSERT INTO "user_account_role_scopes" ("account_role_id", "level", "created_by_id", "updated_at", "updated_by_id")
SELECT "id", 'WRITE', 0, CURRENT_TIMESTAMP, 0 FROM "user_account_roles";
