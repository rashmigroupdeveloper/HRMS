-- The "Employees" area was split into four on 2026-11-16 (directory & job / personal details / IDs, bank & PF-ESIC /
-- documents). So that nobody loses access on the day of the split, every role that had Employees gets the same level
-- on the three new areas; roles are then trimmed on the Roles & access page. Done by System (0).
INSERT INTO "role_permissions" ("role_id", "area", "level", "created_at", "created_by_id", "updated_at", "updated_by_id")
SELECT rp."role_id", new_area."area", rp."level", now(), 0, now(), 0
FROM "role_permissions" rp
CROSS JOIN (VALUES ('EMPLOYEE_PERSONAL_DETAILS'::"access_area"), ('EMPLOYEE_IDS_BANK'::"access_area"), ('EMPLOYEE_DOCUMENTS'::"access_area")) AS new_area("area")
WHERE rp."area" = 'EMPLOYEES'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" x WHERE x."role_id" = rp."role_id" AND x."area" = new_area."area");
