-- M12 — rename internal terminology.
--
-- The user-facing UI shipped "admin/user" framing in M7; the
-- internals still said "instructor/trainee". This migration aligns
-- the storage with the framing in one shot.
--
-- Two changes here:
-- 1. `scenario_progress.trainee_user_id` → `user_id` (column, indexes,
--    constraints).
-- 2. `Role` enum {instructor, trainee} → {admin, user} with a value
--    map so existing user rows survive.
--
-- The Postgres recipe for enum value rename is "create new, swap,
-- drop" (same pattern M8 used to drop short_answer/long_answer).
-- We map values via the USING clause; no rows are deleted.

-- ─── scenario_progress.trainee_user_id → user_id ────────────────

ALTER TABLE "scenario_progress" RENAME COLUMN "trainee_user_id" TO "user_id";

ALTER INDEX "scenario_progress_scenario_trainee_key"
  RENAME TO "scenario_progress_scenario_id_user_id_key";
ALTER INDEX "scenario_progress_trainee_idx"
  RENAME TO "scenario_progress_user_id_idx";
ALTER TABLE "scenario_progress"
  RENAME CONSTRAINT "scenario_progress_trainee_user_id_fkey"
  TO "scenario_progress_user_id_fkey";

-- ─── Role enum {instructor, trainee} → {admin, user} ────────────

CREATE TYPE "Role_new" AS ENUM ('admin', 'user');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'instructor' THEN 'admin'::"Role_new"
      WHEN 'trainee'    THEN 'user'::"Role_new"
    END
  );

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
