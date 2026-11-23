-- The setup was part of "Attendance" until 2026-11-22. So that nobody loses what they do on the day of the split, every
-- role with Attendance gets the same level on "Attendance setup" (the user, 2026-11-22); roles are then trimmed on the
-- Roles & access page. Data access rows are on the role given to the employee, so they apply as before. Done by System (0).
-- (A separate migration: a new enum value is usable only once committed.)
INSERT INTO "role_permissions" ("role_id", "area", "level", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT rp."role_id", 'ATTENDANCE_SETUP'::"access_area", rp."level", now(), 0, now(), 0
FROM "role_permissions" rp
WHERE rp."area" = 'ATTENDANCE'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" x WHERE x."role_id" = rp."role_id" AND x."area" = 'ATTENDANCE_SETUP');
