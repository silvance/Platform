-- Add the Mobile Forensics lane to the Lane enum so mobile-device
-- extraction scenarios (Cellebrite UFD / GrayKey BFU+AFU+FFS /
-- AXIOM multi-tool verification) live under their own discoverable
-- lane rather than being hidden inside Foundations or Evidence
-- Handling. Postgres enums grow with ALTER TYPE ... ADD VALUE,
-- which is non-destructive and doesn't touch existing rows.

ALTER TYPE "Lane" ADD VALUE 'mobile_forensics';
