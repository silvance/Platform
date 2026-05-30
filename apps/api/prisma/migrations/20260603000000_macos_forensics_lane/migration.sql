-- Add the macOS Forensics lane to the Lane enum, plus a matching
-- macos_artifacts SkillArea. Sits immediately after
-- linux_forensics so the OS-specific artifact lanes
-- (Windows → Linux → macOS) read in order on the /scenarios
-- overview as the catalogue grows.
--
-- Postgres enums grow with ALTER TYPE ... ADD VALUE; the AFTER
-- clause places the new value in the enum's intrinsic ordering,
-- so the catalogue's display order picks it up without any
-- application changes. Existing rows are not touched.

ALTER TYPE "Lane" ADD VALUE 'macos_forensics' AFTER 'linux_forensics';

ALTER TYPE "SkillArea" ADD VALUE 'macos_artifacts' AFTER 'linux_artifacts';
