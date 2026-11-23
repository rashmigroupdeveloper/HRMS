-- "Request job changes" and "Request salary changes" (the user, 2026-11-21): raising a job change / a salary change
-- through approval gets areas of its own, apart from Employees Edit and Employee salary Edit (which no longer raise them).
-- Given to no role (the user: "Nobody - Super Admin only"); the Super Admin role has every area.
-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'JOB_CHANGE_REQUEST';
ALTER TYPE "access_area" ADD VALUE 'SALARY_CHANGE_REQUEST';
