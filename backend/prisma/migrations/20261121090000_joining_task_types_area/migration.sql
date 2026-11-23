-- "Joining task types" (the user, 2026-11-21): the list of joining tasks gets an area of its own, apart from Onboarding
-- (which kept it until now) and from "Joining tasks" (doing the tasks given to you)
-- AlterEnum
ALTER TYPE "access_area" ADD VALUE 'JOINING_TASK_TYPES';
