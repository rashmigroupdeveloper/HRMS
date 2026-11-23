-- "Wait" now reminds the approver every SLA hours, and "wait" without SLA hours sends no reminder (the user, 2026-11-20).
-- Until now every waiting step had a reminder every 3 days: the chain steps and the steps still waiting keep it as a
-- 72-hour SLA, so nothing goes quiet. Data only.
UPDATE "approval_chain_steps" SET "sla_hours" = 72 WHERE "sla_hours" IS NULL AND "on_breach" = 'WAIT';

UPDATE "approval_request_steps"
SET "sla_hours" = 72,
    "due_at" = CASE WHEN "status" = 'OPEN' THEN COALESCE("opened_at", now()) + interval '72 hours' END
WHERE "sla_hours" IS NULL AND "on_breach" = 'WAIT' AND "status" IN ('WAITING', 'OPEN');
