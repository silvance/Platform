-- M17: self-registration with admin approval.
--
-- Add a nullable `approved_at` timestamp to users. Existing rows
-- are back-filled with NOW() because they reached the DB before
-- this migration (seeded, admin-created via /admin/users, or
-- created in a pre-M17 era) — they're already trusted by virtue
-- of how they were created. Only future *self-registered*
-- accounts will land with approved_at = NULL, gated on admin
-- approval before login is allowed.

ALTER TABLE "users"
  ADD COLUMN "approved_at" TIMESTAMP(3);

UPDATE "users"
  SET "approved_at" = NOW()
  WHERE "approved_at" IS NULL;
