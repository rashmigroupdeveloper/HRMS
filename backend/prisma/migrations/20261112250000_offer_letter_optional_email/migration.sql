-- The seeded offer letter: the "Email ID" line is optional ({{email?}} - left out for a candidate without e-mail,
-- e.g. blue-collar). Only if HR has not changed the seeded wording yet.
UPDATE "letter_templates"
SET "body" = replace("body", '**Email ID: {{email}}**', '**Email ID: {{email?}}**'), "updated_at" = CURRENT_TIMESTAMP
WHERE "name" = 'Offer letter' AND "updated_by_id" = 0;
