-- Add the Linux Forensics lane to the Lane enum, plus a matching
-- linux_artifacts SkillArea. Sits immediately after
-- windows_artifacts so the OS-specific artifact lanes (Windows →
-- Linux → macOS) read in order on the /scenarios overview as the
-- catalogue grows.
--
-- Postgres enums grow with ALTER TYPE ... ADD VALUE; the BEFORE /
-- AFTER clause places the new value in the enum's intrinsic
-- ordering, so the catalogue's display order picks it up without
-- any application changes. Existing rows are not touched.

ALTER TYPE "Lane" ADD VALUE 'linux_forensics' AFTER 'windows_artifacts';

ALTER TYPE "SkillArea" ADD VALUE 'linux_artifacts' AFTER 'windows_artifacts';
