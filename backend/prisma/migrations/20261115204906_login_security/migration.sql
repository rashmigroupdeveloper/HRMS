-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "confirmed_until" TIMESTAMPTZ(3),
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "user_accounts" ADD COLUMN     "disabled_at" TIMESTAMPTZ(3),
ADD COLUMN     "disabled_by_id" INTEGER,
ADD COLUMN     "disabled_reason" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "password_history" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" INTEGER NOT NULL,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_history_account_id_idx" ON "password_history"("account_id");

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
