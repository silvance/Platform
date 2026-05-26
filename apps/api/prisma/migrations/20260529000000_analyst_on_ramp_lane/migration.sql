-- Add the Analyst On-Ramp lane to the Lane enum. The lane sits
-- BEFORE foundations so the user-facing lane overview at /scenarios
-- shows it first — students with a DC3-Intro / A+ baseline land
-- here before the inference-discipline-heavy Foundations material.
--
-- Postgres enums grow with ALTER TYPE ... ADD VALUE; the `BEFORE`
-- clause places the new value in the right slot of the enum's
-- intrinsic ordering, so ORDER BY lane DESC/ASC keeps the
-- catalogue's display order consistent without any application
-- changes. Existing rows keep their current lane (default
-- foundations) — no row mutations needed.

ALTER TYPE "Lane" ADD VALUE 'analyst_on_ramp' BEFORE 'foundations';
