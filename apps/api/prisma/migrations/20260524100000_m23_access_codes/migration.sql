-- M23: registration access codes.
--
-- Admin-managed joining codes that gate /register. A valid,
-- active, non-expired, non-exhausted code creates the new account
-- as role=user with approvedAt set immediately, so the user can
-- log in on the next request. No-code / bad-code registrations
-- are rejected outright with a generic message.
--
-- Codes are stored plaintext on purpose: the admin needs to
-- re-read them to share with new cohorts. They appear only in
-- admin-only API payloads and never in any user-facing surface.

CREATE TABLE "access_codes" (
  "id"                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"               TEXT         NOT NULL UNIQUE,
  "label"              TEXT         NOT NULL,
  "disabled_at"        TIMESTAMP(3),
  "expires_at"         TIMESTAMP(3),
  "uses_count"         INTEGER      NOT NULL DEFAULT 0,
  "uses_limit"         INTEGER,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "created_by_user_id" UUID,
  CONSTRAINT "access_codes_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
);
