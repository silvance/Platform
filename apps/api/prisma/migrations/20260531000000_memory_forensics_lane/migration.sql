-- Add the Memory Forensics lane to the Lane enum. Sits between
-- network_logs and mobile_forensics so the "telemetry → memory
-- → mobile" advanced-toolchain group reads in order on the
-- lane overview at /scenarios.
--
-- Postgres enums grow with ALTER TYPE ... ADD VALUE; the BEFORE
-- clause places the new value in the enum's intrinsic ordering,
-- so the catalogue's display order picks it up without any
-- application changes. Existing rows are not touched.

ALTER TYPE "Lane" ADD VALUE 'memory_forensics' BEFORE 'mobile_forensics';
