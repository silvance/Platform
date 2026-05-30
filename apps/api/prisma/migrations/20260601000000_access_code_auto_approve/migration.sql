-- Add `auto_approve` to access_codes. Defaults to TRUE so every
-- existing code keeps the pre-flag behavior (auto-approve all
-- registrations that consume the code). Admins can opt new codes
-- into the "register and wait for approval" path by setting this
-- column to FALSE at create-time.

ALTER TABLE "access_codes"
  ADD COLUMN "auto_approve" BOOLEAN NOT NULL DEFAULT TRUE;
