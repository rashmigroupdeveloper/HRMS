-- "Attendance setup" (the user, 2026-11-22): the attendance setup (shifts, policies, default shifts, holidays, roster
-- patterns, punches, the month lock) gets an area of its own, apart from "Attendance" (others' attendance)
-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'ATTENDANCE_SETUP';
