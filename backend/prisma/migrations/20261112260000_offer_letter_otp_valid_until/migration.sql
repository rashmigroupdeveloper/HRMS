-- The one-time code's expiry is a deadline, not an action time: named like offer_valid_until / locked_until
ALTER TABLE "offer_letters" RENAME COLUMN "otp_expires_at" TO "otp_valid_until";
