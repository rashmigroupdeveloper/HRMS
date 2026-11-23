-- The default shift (attendance, 2026-11-16): employees with no shift assigned work General 09:00-18:00 with Sunday off
-- (the old HRMS's GEN: 10 minutes grace, 30 minutes unpaid break, 4 hours = half day, 7 hours = full day). HR changes it
-- or adds others on the Attendance setup page.
INSERT INTO "shifts" ("code", "name", "start_minute", "end_minute", "grace_minutes", "break_minutes", "half_day_minutes", "full_day_minutes", "is_default", "is_active", "created_at", "created_by_id", "updated_at", "updated_by_id")
VALUES ('GEN', 'General', 540, 1080, 10, 30, 240, 420, true, true, now(), 0, now(), 0)
ON CONFLICT ("code") DO NOTHING;
