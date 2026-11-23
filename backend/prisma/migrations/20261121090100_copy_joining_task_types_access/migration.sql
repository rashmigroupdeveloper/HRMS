-- The task types were kept with Onboarding until 2026-11-21. So that nobody loses what they do on the day of the split,
-- every role with Onboarding gets the same level on "Joining task types" (the user, 2026-11-21); roles are then trimmed
-- on the Roles & access page. Done by System (0). (A separate migration: a new enum value is usable only once committed.)
INSERT INTO "role_permissions" ("role_id", "area", "level", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT rp."role_id", 'JOINING_TASK_TYPES'::"access_area", rp."level", now(), 0, now(), 0
FROM "role_permissions" rp
WHERE rp."area" = 'ONBOARDING'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" x WHERE x."role_id" = rp."role_id" AND x."area" = 'JOINING_TASK_TYPES');
